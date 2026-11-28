import { mutate, getDB } from "./store";
import { uid } from "./format";
import type {
  JournalType, TaxRegime, DeclarationStatus, DBState, DocFolder, DocStatus,
  ClientRequestStatus, PayrollConfig, DocumentRequest, EntryTemplate, JournalEntry, Payslip,
  DocumentItem, AccountingPeriod,
} from "./types";
import { computeTax } from "./tax";
import { computeTvaFiscal, fiscalBaseFromMoves, totalAdjustments } from "./fiscalite";
import { calculerBulletin, paieParamsFromConfig, totaliserBulletins, ecrituresPaie } from "./paie";
import { sealLog } from "./auditChain";
import { movementsByAccount } from "./accounting";
import { hashPassword, verifyPassword } from "./hash";
import { TEMPLATE_BY_ID, scaleTemplate } from "./entryTemplates";
import { extractFromDocument, OCR_FIELD_DEFS } from "./ocr";
import { getDocumentFile, putDocumentFile } from "./documentStore";
import { nextEntryNumber } from "./entryNumbering";
import { resolveAccountingDate } from "./periods";

function audit(s: DBState, userId: string, orgId: string, action: string, entity: string, entityId: string, after: string) {
  // P2 — chaque trace est scellée à la suite de la précédente : une altération
  // ultérieure du stockage devient détectable (voir lib/auditChain.ts).
  const previous = s.auditLogs[0];
  const sealed = sealLog({
    id: uid(),
    userId: userId || "system",
    organizationId: orgId,
    action,
    entity,
    entityId,
    before: null,
    after,
    ip: "127.0.0.1",
    createdAt: new Date().toISOString(),
  }, previous && previous.hash ? { seq: previous.seq ?? -1, hash: previous.hash } : null);
  s.auditLogs.unshift(sealed);
}


/** Notification non bloquante (remplace `alert`, qui gelait l'UI). */
function notify(orgId: string, title: string, body: string, type: "info" | "warning" | "danger" = "warning") {
  mutate((s) => {
    s.notifications.unshift({
      id: uid(), userId: null, organizationId: orgId, title, body, type, read: false,
      createdAt: new Date().toISOString(),
    });
  });
}

export function currentOrgId(): string | null {
  const u = getDB().users.find((x) => x.id === getDB().session.userId);
  return u?.organizationId || null;
}

export function currentUserId(): string | null {
  return getDB().session.userId;
}

// ---------------- Scope entreprise (sélecteur du shell) ----------------
const COMPANY_KEY = "fimaac_company";

/** Persiste l'entreprise active du scope cabinet. */
export function setCurrentCompany(companyId: string): void {
  try {
    localStorage.setItem(COMPANY_KEY, companyId);
  } catch { /* stockage indisponible */ }
}

/** Entreprise active mémorisée (null si aucune). */
export function getCurrentCompany(): string | null {
  try {
    return localStorage.getItem(COMPANY_KEY);
  } catch {
    return null;
  }
}

/** Oublie l'entreprise active (déconnexion / changement de cabinet). */
export function clearCurrentCompany(): void {
  try {
    localStorage.removeItem(COMPANY_KEY);
  } catch { /* ignore */ }
}

// ---------------- Companies ----------------
export function addCompany(data: Partial<{ name: string; tradeName: string; legalForm: string; nif: string; sector: string; activity: string; city: string; capital: number; taxRegime: TaxRegime; vatPayer: boolean; riskLevel: "low" | "medium" | "high" }>): void {
  const orgId = currentOrgId();
  if (!orgId) return;
  const id = uid();
  mutate((s) => {
    s.companies.push({
      id,
      organizationId: orgId,
      name: data.name || "Nouvelle entreprise",
      tradeName: data.tradeName || data.name || "",
      legalForm: data.legalForm || "SARL",
      nif: data.nif || "",
      sector: data.sector || "",
      activity: data.activity || "",
      city: data.city || "Lomé",
      capital: data.capital || 0,
      taxRegime: data.taxRegime || "ri",
      vatPayer: data.vatPayer ?? true,
      currency: "XOF",
      fiscalYearStartMonth: 1,
      riskLevel: data.riskLevel || "low",
      cabinetOrganizationId: orgId,
      createdAt: new Date().toISOString(),
    });
    s.taxProfiles.push({ id: uid(), companyId: id, regime: data.taxRegime || "ri", vatPayer: data.vatPayer ?? true, tfeLiable: true, obligations: data.vatPayer ? ["TVA mensuelle"] : [] });
    audit(s, currentUserId() || "", orgId, "CREATE_COMPANY", "Company", id, `Création de l'entreprise ${data.name}`);
  });
}

// ---------------- Journals / Fiscal year ----------------
export function ensureFiscalYear(companyId: string, year: number, startMonth = 1): void {
  const db = getDB();
  if (db.fiscalYears.some((f) => f.companyId === companyId && f.label.includes(String(year)))) return;
  mutate((s) => {
    const fyId = uid();
    const start = new Date(year, startMonth - 1, 1);
    const end = new Date(year + (startMonth === 1 ? 0 : 1), startMonth - 1, 0);
    s.fiscalYears.push({
      id: fyId,
      companyId,
      label: `Exercice ${year}`,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      status: "open",
    });
    for (let m = 1; m <= 12; m++) {
      const realMonth = ((startMonth - 1 + m - 1) % 12) + 1;
      s.periods.push({
        id: uid(),
        fiscalYearId: fyId,
        companyId,
        label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, realMonth - 1, 1)),
        month: realMonth,
        year,
        startDate: `${year}-${String(realMonth).padStart(2, "0")}-01`,
        endDate: `${year}-${String(realMonth).padStart(2, "0")}-28`,
        status: "open",
      });
    }
  });
}

export function addJournal(companyId: string, code: string, name: string, type: JournalType): void {
  mutate((s) => {
    s.journals.push({ id: uid(), companyId, code, name, type, createdAt: new Date().toISOString() });
  });
}

// ---------------- Entries ----------------
export function addEntry(companyId: string, data: { date: string; journalId: string; reference: string; label: string; lines: { accountId: string; label: string; debit: number; credit: number; tierId?: string | null }[]; status: "draft" | "validated"; attachmentDocIds?: string[] }): string {
  const db = getDB();
  // P9 : l'exercice et la période sont ceux qui CONTIENNENT la date. L'ancienne
  // version prenait le premier exercice et, à défaut de période, la première du
  // dossier : une écriture hors exercice atterrissait silencieusement ailleurs.
  const placement = resolveAccountingDate(data.date, db.fiscalYears, db.periods, { companyId });
  if (!placement.ok) {
    notify(currentOrgId() || "", "Saisie refusée", placement.message, "danger");
    return "";
  }
  const fy = placement.fiscalYear;
  const period = placement.period;
  const id = uid();
  const journal = db.journals.find((j) => j.id === data.journalId);
  const prefix = journal?.code || "OD";
  // P6 : le numéro reprend après le plus grand existant du journal (et non
  // « nombre d'écritures + 1 », qui recyclait les numéros après suppression).
  const existingNumbers = db.entries.filter((e) => e.companyId === companyId).map((e) => e.number);
  const nextNumber = nextEntryNumber(existingNumbers, prefix);
  const resolvedPeriodId = period?.id || "";
  mutate((s) => {
    // P9 : période mensuelle absente dans un exercice ouvert → on la crée
    // (tracée), au lieu de rattacher l'écriture à une autre période.
    let periodId = resolvedPeriodId;
    if (!periodId && fy) {
      const month = Number(data.date.slice(5, 7));
      const year = Number(data.date.slice(0, 4));
      const created: AccountingPeriod = {
        id: uid(),
        fiscalYearId: fy.id,
        companyId,
        label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1)),
        month,
        year,
        startDate: `${year}-${String(month).padStart(2, "0")}-01`,
        endDate: `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`,
        status: "open",
      };
      s.periods.push(created);
      periodId = created.id;
      audit(s, currentUserId() || "", currentOrgId() || "", "CREATE_PERIOD", "AccountingPeriod", created.id, `Période ${created.label} créée à la saisie`);
    }
    s.entries.push({
      id,
      companyId,
      fiscalYearId: fy?.id || "",
      periodId,
      journalId: data.journalId,
      number: nextNumber,
      date: data.date,
      reference: data.reference,
      label: data.label,
      sourceDocumentId: null,
    authorId: currentUserId() || "",
    validatorId: data.status === "validated" ? currentUserId() : null,
    status: data.status,
    attachmentDocIds: data.attachmentDocIds || [],
    lines: data.lines.map((l) => ({ id: uid(), accountId: l.accountId, label: l.label, debit: l.debit, credit: l.credit, taxCode: null, thirdPartyId: l.tierId || null, analytic: null })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    audit(s, currentUserId() || "", currentOrgId() || "", data.status === "validated" ? "VALIDATE_ENTRY" : "CREATE_ENTRY", "JournalEntry", id, `${nextNumber} : ${data.label}`);
  });
  return id;
}

export function setEntryStatus(entryId: string, status: "draft" | "in_review" | "validated" | "rejected" | "cancelled"): void {
  mutate((s) => {
    const e = s.entries.find((x) => x.id === entryId);
    if (!e) return;
    if (status === "validated") e.validatorId = currentUserId();
    e.status = status;
    e.updatedAt = new Date().toISOString();
    audit(s, currentUserId() || "", currentOrgId() || "", "ENTRY_STATUS", "JournalEntry", entryId, `${e.number} → ${status}`);
  });
}

export function counterEntry(entryId: string): void {
  const db = getDB();
  const e = db.entries.find((x) => x.id === entryId);
  if (!e) return;
  mutate((s) => {
    const src = s.entries.find((x) => x.id === entryId);
    if (!src) return;
    const id = uid();
    s.entries.push({
      ...src,
      id,
      number: src.number + "-C",
      reference: src.reference + " (CONTREPASSATION)",
      label: "Contrepassation : " + src.label,
      status: "validated",
      validatorId: currentUserId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: src.lines.map((l) => ({ ...l, id: uid(), debit: l.credit, credit: l.debit })),
    });
    audit(s, currentUserId() || "", currentOrgId() || "", "COUNTER_ENTRY", "JournalEntry", id, `Contrepassation de ${src.number}`);
  });
}

// ---------------- Modification d'écriture ----------------
/**
 * Modifie une écriture existante.
 * RÈGLE ABSOLUE : l'écriture résultante doit rester équilibrée (Σ débit = Σ crédit),
 * sauf si elle reste en brouillon. Chaque modification est consignée dans l'audit trail.
 *
 * Pour une écriture validée, la modification est tracée (before/after) — elle ne
 * remplace pas la contrepassation, qui reste la voie recommandée pour corriger
 * une écriture déjà publiée.
 */
export function updateEntry(
  entryId: string,
  data: {
    date: string;
    journalId: string;
    reference: string;
    label: string;
    status: "draft" | "in_review" | "validated";
    lines: { accountId: string; label: string; debit: number; credit: number; tierId?: string | null }[];
  },
): { ok: boolean; error?: string } {
  const db = getDB();
  const e = db.entries.find((x) => x.id === entryId);
  if (!e) return { ok: false, error: "Écriture introuvable." };

  // P9 : même résolution qu'à la création — exercice ET période qui contiennent
  // la date ; un exercice clos ne peut pas recevoir d'écriture, même en édition.
  const placement = resolveAccountingDate(data.date, db.fiscalYears, db.periods, { companyId: e.companyId });
  if (!placement.ok) {
    return { ok: false, error: placement.message };
  }

  // Équilibre
  const debit = data.lines.reduce((s, l) => s + Math.max(0, l.debit), 0);
  const credit = data.lines.reduce((s, l) => s + Math.max(0, l.credit), 0);
  if (debit !== credit) {
    return { ok: false, error: `Écriture déséquilibrée : écart de ${debit - credit} FCFA.` };
  }
  if (debit === 0) {
    return { ok: false, error: "Montant nul — renseignez au moins deux lignes." };
  }

  // Comptes imputables
  const byCode = new Map(db.accounts.map((a) => [a.code, a]));
  for (const l of data.lines) {
    const acc = byCode.get(l.accountId);
    if (!acc) return { ok: false, error: `Compte ${l.accountId} introuvable dans le plan.` };
    if (acc.postable === false) return { ok: false, error: `Le compte ${acc.code} (${acc.label}) n'est pas imputable.` };
  }

  const before = JSON.stringify({
    date: e.date, journalId: e.journalId, reference: e.reference,
    label: e.label, status: e.status,
    lines: e.lines.map((l) => `${l.accountId} D${l.debit} C${l.credit}`),
  });

  mutate((s) => {
    const entry = s.entries.find((x) => x.id === entryId);
    if (!entry) return;
    entry.date = data.date;
    entry.journalId = data.journalId;
    entry.reference = data.reference;
    entry.label = data.label;
    entry.status = data.status;
    if (data.status === "validated" && !entry.validatorId) entry.validatorId = currentUserId();
    entry.lines = data.lines.map((l) => ({
      id: uid(),
      accountId: l.accountId,
      label: l.label,
      debit: l.debit,
      credit: l.credit,
      taxCode: null,
      thirdPartyId: l.tierId || null,
      analytic: null,
    }));
    entry.updatedAt = new Date().toISOString();
    audit(
      s, currentUserId() || "", currentOrgId() || "", "UPDATE_ENTRY", "JournalEntry", entryId,
      `${entry.number} modifiée — ${before} → ${data.lines.length} ligne(s), ${debit} FCFA`,
    );
  });
  return { ok: true };
}

// ---------------- Documents / OCR ----------------
export function addDocument(companyId: string, file: { name: string; size: number; exercise?: string; month?: number; folder?: DocFolder; uploadSource?: "cabinet" | "client"; file?: File }): string {
  const id = uid();
  // Le contenu binaire vit en mémoire le temps de la session (aperçu + téléchargement)
  if (file.file) putDocumentFile(id, file.file);
  const now = new Date().toISOString();
  const u = getDB().users.find((x) => x.id === getDB().session.userId);
  const exercise = file.exercise || null;
  const month = file.month ?? null;
  const folder = file.folder || null;
  const docStatus: DocStatus = exercise && month != null && folder ? "a_traiter" : "non_classe";
  mutate((s) => {
    s.documents.push({
      id,
      companyId,
      name: file.name,
      category: "invoice",
      status: "processing",
      size: file.size,
      uploadedAt: now,
      uploadedById: currentUserId() || "",
      tags: [],
      extraction: null,
      exercise,
      month,
      folder,
      docStatus,
      uploadSource: file.uploadSource || (u?.userType === "client" ? "client" : "cabinet"),
      uploadedBy: u ? `${u.firstName} ${u.lastName}`.trim() : "Cabinet",
      tierId: null,
      linkedEntryId: null,
    });
    audit(s, currentUserId() || "", currentOrgId() || "", "UPLOAD_DOC", "Document", id, file.name);
  });
  return id;
}

// ---------------- Extraction de données des pièces (OCR) ----------------
/**
 * Extrait les données d'une pièce justificative.
 * ⚠️ RÈGLE ABSOLUE : ne rien inventer. Seules les zones réellement lisibles
 * sont renseignées ; les autres sont marquées « unreadable » ou « missing ».
 * Le champ `ocrSimulated` est conservé à `true` tant qu'aucun service OCR
 * externe n'est branché (backend/README.md §7 — job document.ocr).
 */
export async function runOcr(docId: string): Promise<{ readable: boolean; readCount: number; unreadableCount: number; warnings: string[] }> {
  const db = getDB();
  const d = db.documents.find((x) => x.id === docId);
  if (!d) return { readable: false, readCount: 0, unreadableCount: 0, warnings: ["Pièce introuvable."] };

  const file = getDocumentFile(docId);
  if (!file) {
    // Session rechargée : le contenu binaire n'est plus disponible.
    mutate((s) => {
      const doc = s.documents.find((x) => x.id === docId);
      if (!doc) return;
      doc.status = "extracted";
      doc.extraction = {
        confidence: 0,
        ocrSimulated: true,
        fields: {},
        readable: false,
        engine: "binary",
        warnings: ["Fichier source indisponible en mémoire (session rechargée). Re-téléversez la pièce pour l'analyser."],
        readability: Object.fromEntries(
          OCR_FIELD_DEFS.map((def) => [def.key, { status: "unreadable" as const, confidence: 0, note: "Fichier source indisponible" }]),
        ),
      };
      audit(s, currentUserId() || "", currentOrgId() || "", "OCR_DOC", "Document", docId, "Extraction impossible — fichier indisponible");
    });
    return { readable: false, readCount: 0, unreadableCount: OCR_FIELD_DEFS.length, warnings: ["Fichier source indisponible."] };
  }

  const result = await extractFromDocument(file);
  const read = result.fields.filter((f) => f.status === "read");
  const confidence = read.length
    ? Math.round(read.reduce((s, f) => s + f.confidence, 0) / read.length)
    : 0;

  mutate((s) => {
    const doc = s.documents.find((x) => x.id === docId);
    if (!doc) return;
    doc.status = "extracted";
    doc.extraction = {
      confidence,
      ocrSimulated: true,
      // Champ plat — uniquement les valeurs réellement lues (jamais de 0 par défaut)
      fields: Object.fromEntries(read.map((f) => [f.key, f.value as string])),
      readability: Object.fromEntries(
        result.fields.map((f) => [f.key, { status: f.status, confidence: f.confidence, note: f.note }]),
      ),
      engine: result.engine,
      readable: result.readable,
      warnings: result.warnings,
    };
    audit(
      s, currentUserId() || "", currentOrgId() || "", "OCR_DOC", "Document", docId,
      `${read.length} donnée(s) lue(s) · ${result.unreadableCount} zone(s) non lisible(s) — aucune valeur déduite`,
    );
  });
  return { readable: result.readable, readCount: read.length, unreadableCount: result.unreadableCount, warnings: result.warnings };
}

/**
 * Complétion manuelle d'un champ d'extraction par un humain.
 * Le champ passe en statut "manual" (confidence 100) — traçabilité conservée.
 */
export function setExtractionField(docId: string, key: string, value: string): void {
  mutate((s) => {
    const doc = s.documents.find((x) => x.id === docId);
    if (!doc) return;
    const base = doc.extraction ?? {
      confidence: 0, ocrSimulated: true, fields: {},
      readability: {}, readable: false, warnings: [] as string[],
    };
    doc.extraction = {
      ...base,
      fields: { ...base.fields, [key]: value },
      readability: {
        ...base.readability,
        [key]: { status: "manual", confidence: 100, note: "Saisi manuellement" },
      },
      readable: true,
    };
    audit(s, currentUserId() || "", currentOrgId() || "", "OCR_FIELD_MANUAL", "Document", docId, `${key} = ${value} (saisie manuelle)`);
  });
}

/**
 * Rattache une pièce justificative à une écriture (synchronise les deux sens).
 */
export function linkDocumentToEntry(docId: string, entryId: string): void {
  mutate((s) => {
    const doc = s.documents.find((x) => x.id === docId);
    const entry = s.entries.find((x) => x.id === entryId);
    if (!doc || !entry) return;
    doc.linkedEntryId = entryId;
    if (!entry.attachmentDocIds.includes(docId)) entry.attachmentDocIds.push(docId);
    entry.updatedAt = new Date().toISOString();
    audit(s, currentUserId() || "", currentOrgId() || "", "LINK_DOC", "JournalEntry", entryId, `Pièce jointe : ${doc.name}`);
  });
}

/** Détache une pièce justificative d'une écriture. */
export function unlinkDocumentFromEntry(docId: string): void {
  mutate((s) => {
    const doc = s.documents.find((x) => x.id === docId);
    if (!doc) return;
    const prev = doc.linkedEntryId;
    doc.linkedEntryId = null;
    if (prev) {
      const entry = s.entries.find((x) => x.id === prev);
      if (entry) entry.attachmentDocIds = entry.attachmentDocIds.filter((id) => id !== docId);
    }
    audit(s, currentUserId() || "", currentOrgId() || "", "UNLINK_DOC", "Document", docId, "Pièce détachée");
  });
}

/** Catégorie de pièce (union stricte du modèle DocumentItem). */
export function setDocCategory(docId: string, category: DocumentItem["category"]): void {
  mutate((s) => {
    const d = s.documents.find((x) => x.id === docId);
    if (d) d.category = category;
  });
}

// V0.6 — reclassement & statut documentaire
export function reclassifyDocument(docId: string, exercise: string, month: number, folder: DocFolder): void {
  mutate((s) => {
    const d = s.documents.find((x) => x.id === docId);
    if (!d) return;
    d.exercise = exercise;
    d.month = month;
    d.folder = folder;
    if (d.docStatus === "non_classe") d.docStatus = "a_traiter";
  });
}

export function setDocStatus(docId: string, status: DocStatus): void {
  mutate((s) => {
    const d = s.documents.find((x) => x.id === docId);
    if (d) d.docStatus = status;
  });
}

export function postFromDocument(docId: string, companyId: string): string | null {
  const db = getDB();
  const d = db.documents.find((x) => x.id === docId);
  if (!d?.extraction) return null;
  const ht = parseInt(d.extraction.fields.ht || "0", 10);
  const tva = parseInt(d.extraction.fields.tva || "0", 10);
  const journal = db.journals.find((j) => j.companyId === companyId && j.type === "purchases");
  const lines: { accountId: string; label: string; debit: number; credit: number }[] = [
    { accountId: "6021", label: d.extraction.fields.fournisseur, debit: ht, credit: 0 },
    { accountId: "4452", label: "TVA récupérable", debit: tva, credit: 0 },
    { accountId: "4011", label: d.extraction.fields.fournisseur, debit: 0, credit: ht + tva },
  ];
  const entryId = addEntry(companyId, {
    date: d.extraction.fields.date,
    journalId: journal?.id || "",
    reference: d.extraction.fields.numero || d.name,
    label: "Comptabilisation document : " + d.name,
    lines,
    status: "draft",
  });
  mutate((s) => {
    const doc = s.documents.find((x) => x.id === docId);
    // B4 — synchronisation bidirectionnelle complète, comme linkDocumentToEntry :
    // sans le push dans entry.attachmentDocIds, la pièce comptabilisée n'apparaît
    // pas comme pièce jointe de l'écriture (visionneuse + téléchargement cassés).
    const entry = s.entries.find((x) => x.id === entryId);
    if (!doc) return;
    doc.status = "validated";
    doc.docStatus = "comptabilise";
    doc.linkedEntryId = entryId;
    if (entry && !entry.attachmentDocIds.includes(docId)) entry.attachmentDocIds.push(docId);
  });
  return entryId;
}

// ---------------- Bank ----------------
export function addBankTransaction(bankAccountId: string, companyId: string, date: string, label: string, amount: number): void {
  mutate((s) => {
    s.bankTransactions.push({ id: uid(), bankAccountId, companyId, date, label, amount, reconciled: false, matchedEntryId: null });
    audit(s, currentUserId() || "", currentOrgId() || "", "BANK_TX", "BankTransaction", "", `Transaction ${label}`);
  });
}

export function toggleReconcile(txId: string): void {
  mutate((s) => {
    const t = s.bankTransactions.find((x) => x.id === txId);
    if (t) {
      t.reconciled = !t.reconciled;
      audit(s, currentUserId() || "", currentOrgId() || "", "RECONCILE", "BankTransaction", txId, t.reconciled ? "Rapproché" : "Annulé");
    }
  });
}

// ---------------- Fixed assets ----------------
export function addFixedAsset(companyId: string, data: { name: string; accountCode: string; cost: number; usefulLifeYears: number; residualValue: number; acquisitionDate: string }): void {
  mutate((s) => {
    s.fixedAssets.push({ id: uid(), companyId, name: data.name, category: "Immobilisation", accountCode: data.accountCode, acquisitionDate: data.acquisitionDate, cost: data.cost, residualValue: data.residualValue, usefulLifeYears: data.usefulLifeYears, method: "linear", status: "active" });
  });
}

export function depreciationSchedule(cost: number, residual: number, years: number): { year: number; annuity: number; cumulative: number; netBookValue: number }[] {
  const base = cost - residual;
  const annuity = base / years;
  const rows = [];
  let cumul = 0;
  for (let y = 1; y <= years; y++) {
    cumul += annuity;
    rows.push({ year: y, annuity, cumulative: cumul, netBookValue: cost - cumul });
  }
  return rows;
}

// ---------------- Tax ----------------
export function updateTaxRate(code: string, rate: number, verified: boolean): void {
  mutate((s) => {
    const r = s.taxRules.find((x) => x.code === code);
    if (r) {
      r.rate = rate;
      r.verified = verified;
      audit(s, currentUserId() || "", "org-platform", "TAX_RULE_EDIT", "TaxRule", code, `${code} → ${rate}% (vérifié=${verified})`);
    }
  });
}

export function generateTvaDeclaration(companyId: string): void {
  const db = getDB();
  const entries = db.entries.filter((e) => e.companyId === companyId);
  const rule = db.taxRules.find((r) => r.code === "TVA");
  if (!rule) return;
  const res = computeTax("TVA", entries, db.taxRules);
  if (!res) return;
  const resBase = res.base;
  const resMontant = res.montant;
  const resBreakdown = res.breakdown;
  mutate((s) => {
    s.taxDeclarations.push({
      id: uid(),
      companyId,
      taxCode: "TVA",
      periodLabel: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date()),
      base: resBase,
      amount: res.montant,
      breakdown: resBreakdown.map((b) => ({ label: b.label, amount: b.amount, rule: rule.code, source: rule.source })),
      status: "ready",
      dueDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 2).padStart(2, "0")}-15`,
      createdAt: new Date().toISOString(),
    });
    audit(s, currentUserId() || "", currentOrgId() || "", "GEN_TVA", "TaxDeclaration", companyId, `TVA générée : ${resMontant} FCFA`);
  });
}

export function setDeadlineStatus(id: string, status: DeclarationStatus): void {
  mutate((s) => {
    const d = s.taxDeadlines.find((x) => x.id === id);
    if (d) d.status = status;
  });
}

// ---------------- Missions / tasks ----------------
export function addMission(companyId: string, title: string, type: string, dueDate: string): void {
  const orgId = currentOrgId() || "";
  mutate((s) => {
    s.missions.push({ id: uid(), organizationId: orgId, companyId, title, type, status: "todo", assigneeId: currentUserId(), dueDate, progress: 0 });
  });
}

export function addTask(companyId: string | null, title: string, priority: "low" | "medium" | "high", dueDate: string): void {
  const orgId = currentOrgId() || "";
  mutate((s) => {
    s.tasks.push({ id: uid(), companyId, organizationId: orgId, missionId: null, title, status: "todo", priority, dueDate, assigneeId: currentUserId() });
  });
}

export function setTaskStatus(id: string, status: "todo" | "in_progress" | "done"): void {
  mutate((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (t) t.status = status;
  });
}

// ---------------- Notifications ----------------
export function markNotificationRead(id: string): void {
  mutate((s) => {
    const n = s.notifications.find((x) => x.id === id);
    if (n) n.read = true;
  });
}

export function markAllNotificationsRead(orgId: string): void {
  mutate((s) => {
    s.notifications.forEach((n) => {
      if (n.organizationId === orgId) n.read = true;
    });
  });
}

// ---------------- Compliance ----------------
export function resolveCompliance(id: string): void {
  mutate((s) => {
    const c = s.complianceIssues.find((x) => x.id === id);
    if (c) c.resolved = true;
  });
}

// ---------------- Client requests (centre de demandes) ----------------
function nextClientReqNumber(s: DBState): string {
  // Numéro unique : prend le max des numéros existants (+1) pour éviter tout doublon après suppressions
  let max = 0;
  for (const r of s.clientRequests) {
    const m = /DEM-(\d+)/.exec(r.number || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return "DEM-" + String(max + 1).padStart(4, "0");
}

/**
 * Crée une demande émise par l'entreprise vers SON cabinet.
 * Correction isolation : la notification et le `organizationId` de la demande
 * pointent désormais vers le CABINET rattaché (cabinetOrganizationId) — avant,
 * l'appel du portail passait l'org de l'entreprise elle-même, donc le cabinet
 * n'était jamais notifié et la demande lui était invisible.
 */
export function createClientRequest(companyId: string, _orgId: string, acte: { id: string; family: string; label: string }, fields: Record<string, string>, dueDate?: string): void {
  const now = new Date().toISOString();
  const db = getDB();
  const company = db.companies.find((c) => c.id === companyId);
  if (!company) return;
  const cabinetOrgId = company.cabinetOrganizationId;
  if (!cabinetOrgId) return; // pas de cabinet rattaché → pas de destinataire
  mutate((s) => {
    const number = nextClientReqNumber(s);
    s.clientRequests.push({
      id: uid(),
      number,
      organizationId: cabinetOrgId,
      companyId,
      direction: "client_to_cabinet",
      category: acte.family,
      acteType: acte.id,
      title: acte.label,
      status: "soumise",
      fields,
      dueDate: dueDate || null,
      attachments: [],
      messages: [],
      history: [{ id: uid(), at: now, label: "Demande soumise par le client", by: "client" }],
      createdAt: now,
      updatedAt: now,
    });
    // Notification au CABINET rattaché (lui seul traite les demandes)
    s.notifications.push({ id: uid(), userId: null, organizationId: cabinetOrgId, title: `Nouvelle demande client ${number}`, body: acte.label, type: "info", read: false, createdAt: now });
    audit(s, currentUserId() || "", cabinetOrgId, "CLIENT_REQUEST", "ClientRequest", number, `${acte.label}`);
  });
}

export function setClientRequestStatus(id: string, status: ClientRequestStatus, by: "client" | "cabinet"): void {
  const now = new Date().toISOString();
  const labels: Record<string, string> = { soumise: "Re-soumise", prise_en_charge: "Prise en charge", en_traitement: "En traitement", livree: "Livrée", archivee: "Archivée", rejetee: "Rejetée" };
  mutate((s) => {
    const r = s.clientRequests.find((x) => x.id === id);
    if (!r) return;
    r.status = status;
    r.updatedAt = now;
    r.history.push({ id: uid(), at: now, label: labels[status] || status, by });
    // Correction isolation : notifier l'AUTRE partie (celle qui n'a pas agi).
    // Le cabinet agit → notifier l'entreprise ; le client agit → notifier le cabinet.
    const company = s.companies.find((x) => x.id === r.companyId);
    const targetOrg = by === "cabinet" ? (company?.organizationId || r.organizationId) : (company?.cabinetOrganizationId || r.organizationId);
    s.notifications.push({ id: uid(), userId: null, organizationId: targetOrg, title: `Demande ${r.number} → ${labels[status] || status}`, body: r.title, type: status === "livree" ? "success" : status === "rejetee" ? "danger" : "info", read: false, createdAt: now });
    audit(s, currentUserId() || "", r.organizationId, "CLIENT_REQ_STATUS", "ClientRequest", r.number, labels[status] || status);
  });
}

export function addRequestMessage(id: string, text: string, by: "client" | "cabinet", authorId: string): void {
  const now = new Date().toISOString();
  mutate((s) => {
    const r = s.clientRequests.find((x) => x.id === id);
    if (!r) return;
    r.messages.push({ id: uid(), author: by, authorId, text, createdAt: now });
    r.updatedAt = now;
    s.notifications.push({ id: uid(), userId: null, organizationId: r.organizationId, title: `Message sur ${r.number}`, body: text.slice(0, 80), type: "info", read: false, createdAt: now });
  });
}

export function addRequestAttachment(id: string, name: string, by: "client" | "cabinet"): void {
  const now = new Date().toISOString();
  mutate((s) => {
    const r = s.clientRequests.find((x) => x.id === id);
    if (!r) return;
    r.attachments.push({ id: uid(), name, createdAt: now });
    r.updatedAt = now;
    r.history.push({ id: uid(), at: now, label: `Pièce ajoutée : ${name}`, by });
  });
}

// Upload d'une pièce répondant à une demande documentaire du cabinet (côté client)
export function respondToDocRequest(docRequestId: string, companyId: string, fileName: string): void {
  if (fileName && companyId) {
    const id = addDocument(companyId, { name: fileName, size: 0 });
    runOcrSim(id || getDocumentByName(companyId, fileName));
  }
  mutate((s) => {
    const r = s.documentRequests.find((x) => x.id === docRequestId);
    if (!r) return;
    r.status = "received";
    // Correction liaison : prévenir le CABINET que l'entreprise a répondu
    const company = s.companies.find((x) => x.id === r.companyId);
    const targetOrg = company?.cabinetOrganizationId || r.organizationId;
    if (targetOrg) {
      s.notifications.unshift({ id: uid(), userId: null, organizationId: targetOrg, title: `Pièce reçue — ${r.docType}`, body: `${fileName} · période ${r.periodLabel}`, type: "success", read: false, createdAt: new Date().toISOString() });
    }
    audit(s, currentUserId() || "", targetOrg || currentOrgId() || "", "DOC_RESPONDED", "DocumentRequest", docRequestId, `${r.docType} : ${fileName}`);
  });
}

function getDocumentByName(companyId: string, name: string): string {
  return getDB().documents.find((d) => d.companyId === companyId && d.name === name)?.id || "";
}

function runOcrSim(docId: string): void {
  if (!docId) return;
  setTimeout(() => {
    // m5 — promesse capturée : un échec (classeur corrompu) ne reste plus en
    // « unhandled promise rejection » silencieux.
    runOcr(docId).catch((err) => console.error("[FIMAAC] lecture de la pièce échouée :", err));
  }, 1500);
}

// Anciens helpers conservés pour compatibilité (redirigent)
export function addClientRequest(companyId: string, orgId: string, title: string, message: string): void {
  createClientRequest(companyId, orgId, { id: "message", family: "comptable", label: title }, { description: message });
}

export function createServiceRequest(companyId: string, orgId: string, serviceType: string, title: string, message: string): void {
  createClientRequest(companyId, orgId, { id: serviceType, family: "comptable", label: title }, { description: message });
}

export function setServiceRequestStatus(id: string, status: ClientRequestStatus): void {
  setClientRequestStatus(id, status, "cabinet");
}

// ---------------- Subscriptions / payments (SIMULATED) ----------------
const PLAN_PRICES: Record<string, number> = { trial: 0, starter: 35_000, pro: 75_000, enterprise: 250_000 };

export function changePlan(orgId: string, plan: "trial" | "starter" | "pro" | "enterprise"): void {
  mutate((s) => {
    const sub = s.subscriptions.find((x) => x.organizationId === orgId);
    const price = PLAN_PRICES[plan];
    if (sub) {
      sub.plan = plan;
      sub.monthlyAmount = price;
      sub.status = plan === "trial" ? "trialing" : "active";
      sub.renewsAt = new Date(Date.now() + 30 * 86400000).toISOString();
    } else {
      s.subscriptions.push({ id: uid(), organizationId: orgId, plan, status: plan === "trial" ? "trialing" : "active", seats: 5, startedAt: new Date().toISOString(), renewsAt: new Date(Date.now() + 30 * 86400000).toISOString(), monthlyAmount: price });
    }
    const org = s.organizations.find((o) => o.id === orgId);
    if (org) org.plan = plan;
    s.invoices.push({ id: uid(), organizationId: orgId, number: `FAC-${new Date().getFullYear()}-${String(s.invoices.length + 1).padStart(4, "0")}`, amount: price, status: plan === "trial" ? "draft" : "paid", issuedAt: new Date().toISOString(), dueAt: new Date().toISOString(), plan: `Plan ${plan}` });
    audit(s, currentUserId() || "", orgId, "PLAN_CHANGE", "Subscription", orgId, `Plan changé → ${plan} (${price} FCFA/mois). PAIEMENT SIMULÉ.`);
  });
}

export function payInvoice(invoiceId: string): void {
  mutate((s) => {
    const inv = s.invoices.find((x) => x.id === invoiceId);
    if (inv) inv.status = "paid";
    audit(s, currentUserId() || "", currentOrgId() || "", "PAY_INVOICE", "Invoice", invoiceId, "Paiement SIMULÉ effectué");
  });
}

// ---------------- Document requests (cabinet -> client) ----------------
export function createDocumentRequest(data: { companyId: string; category: string; docType: string; periodLabel: string; dueDate: string; recurring: string; message: string; journalId?: string | null; accountCode?: string | null }): void {
  const orgId = currentOrgId() || "";
  mutate((s) => {
    s.documentRequests.push({ id: uid(), organizationId: orgId, companyId: data.companyId, category: data.category, docType: data.docType, periodLabel: data.periodLabel, journalId: data.journalId || null, accountCode: data.accountCode || null, dueDate: data.dueDate, status: "sent", recurring: data.recurring as DocumentRequest["recurring"], message: data.message, createdAt: new Date().toISOString() });
    audit(s, currentUserId() || "", orgId, "DOC_REQUEST", "DocumentRequest", data.companyId, `Demande : ${data.docType} (${data.periodLabel})`);
  });
}

export function setDocumentRequestStatus(id: string, status: DocumentRequest["status"]): void {
  mutate((s) => {
    const r = s.documentRequests.find((x) => x.id === id);
    if (r) r.status = status;
  });
}

export function deleteDocumentRequest(id: string): void {
  mutate((s) => {
    s.documentRequests = s.documentRequests.filter((x) => x.id !== id);
  });
}

// ---------------- Tax payment requests (cabinet -> client) ----------------
export function createTaxPaymentRequest(data: { companyId: string; taxCode: string; label: string; base: number; amount: number; dueDate: string; method: string }): void {
  const orgId = currentOrgId() || "";
  mutate((s) => {
    s.taxPaymentRequests.push({ id: uid(), organizationId: orgId, companyId: data.companyId, taxCode: data.taxCode, label: data.label, base: data.base, amount: data.amount, dueDate: data.dueDate, method: data.method, declarationId: null, status: "to_pay", createdAt: new Date().toISOString() });
    audit(s, currentUserId() || "", orgId, "TAX_PAYMENT_REQ", "TaxPaymentRequest", data.companyId, `${data.label} : ${data.amount} FCFA`);
  });
}

export function markTaxPaymentPaid(id: string): void {
  mutate((s) => {
    const r = s.taxPaymentRequests.find((x) => x.id === id);
    if (r) r.status = "paid";
    audit(s, currentUserId() || "", currentOrgId() || "", "TAX_PAID", "TaxPaymentRequest", id, "Paiement fiscal confirmé");
  });
}

// ---------------- Entry templates & recurring ----------------
export function createEntryTemplate(data: { companyId: string | null; name: string; journalId: string | null; recurring: string; lines: { accountId: string; label: string; debit: number; credit: number }[] }): void {
  const orgId = currentOrgId() || "";
  mutate((s) => {
    s.entryTemplates.push({ id: uid(), organizationId: orgId, companyId: data.companyId, name: data.name, journalId: data.journalId, recurring: data.recurring as EntryTemplate["recurring"], lines: data.lines, lastRun: null, createdAt: new Date().toISOString() });
    audit(s, currentUserId() || "", orgId, "CREATE_TEMPLATE", "EntryTemplate", "", `Modèle : ${data.name}`);
  });
}

export function runEntryTemplate(templateId: string): void {
  const db = getDB();
  const t = db.entryTemplates.find((x) => x.id === templateId);
  if (!t || !t.companyId || !t.journalId) return;
  addEntry(t.companyId, { date: new Date().toISOString().slice(0, 10), journalId: t.journalId, reference: "MODELE-" + t.name, label: t.name + " (modèle)", status: "draft", lines: t.lines });
  mutate((s) => {
    const tt = s.entryTemplates.find((x) => x.id === templateId);
    if (tt) tt.lastRun = new Date().toISOString();
  });
}

export function deleteEntryTemplate(id: string): void {
  mutate((s) => {
    s.entryTemplates = s.entryTemplates.filter((x) => x.id !== id);
  });
}

// ---------------- Lettrage (tiers) ----------------
export function letterLines(targets: { entryId: string; lineId: string }[], letter: string): void {
  mutate((s) => {
    for (const t of targets) {
      const e = s.entries.find((x) => x.id === t.entryId);
      const l = e?.lines.find((x) => x.id === t.lineId);
      if (l) l.letter = letter;
    }
    audit(s, currentUserId() || "", currentOrgId() || "", "LETTER", "JournalEntryLine", letter, `${targets.length} ligne(s) lettrées : ${letter}`);
  });
}

export function unletterLines(targets: { entryId: string; lineId: string }[]): void {
  mutate((s) => {
    for (const t of targets) {
      const e = s.entries.find((x) => x.id === t.entryId);
      const l = e?.lines.find((x) => x.id === t.lineId);
      if (l) l.letter = null;
    }
  });
}

/** Lettrage automatique : apparie débit/crédit de même montant sur un compte de tiers.
 *  Chaque paire reçoit un code de lettrage UNIQUE (A, B, C… puis AA, AB…), évitant tout conflit. */
export function autoLetter(companyId: string, accountCode: string): { lettered: number } {
  const db = getDB();
  const debits: { entryId: string; lineId: string; amount: number }[] = [];
  const credits: { entryId: string; lineId: string; amount: number }[] = [];
  // codes de lettrage déjà utilisés sur ce compte (pour ne pas réutiliser)
  const used = new Set<string>();
  for (const e of db.entries) {
    if (e.companyId !== companyId || e.status !== "validated") continue;
    for (const l of e.lines) {
      if (l.accountId !== accountCode) continue;
      if (l.letter) used.add(l.letter);
      else if (l.debit > 0) debits.push({ entryId: e.id, lineId: l.id, amount: l.debit });
      else if (l.credit > 0) credits.push({ entryId: e.id, lineId: l.id, amount: l.credit });
    }
  }
  const gen = (n: number): string => {
    // 0->A, 25->Z, 26->AA, 27->AB ...
    let s = "";
    let x = n;
    do { s = String.fromCharCode(65 + (x % 26)) + s; x = Math.floor(x / 26) - 1; } while (x >= 0);
    return s;
  };
  let n = 0;
  const nextCode = (): string => { let c = gen(n++); while (used.has(c)) c = gen(n++); return c; };
  let lettered = 0;
  for (const d of debits) {
    const ci = credits.findIndex((c) => c.amount === d.amount);
    if (ci >= 0) {
      const c = credits.splice(ci, 1)[0];
      const code = nextCode();
      letterLines([{ entryId: d.entryId, lineId: d.lineId }, { entryId: c.entryId, lineId: c.lineId }], code);
      used.add(code);
      lettered += 2;
    }
  }
  return { lettered };
}

// ---------------- Payroll ----------------
export function updatePayrollConfig(patch: Partial<PayrollConfig>): void {
  mutate((s) => { s.payrollConfig = { ...s.payrollConfig, ...patch }; });
}

export function runPayroll(companyId: string, periodLabel: string): { ok: boolean; slips: number; entryCreated: boolean; error?: string; alertes?: string[] } {
  const db = getDB();
  // P0-3 : plus aucun calcul de paie ici — tout passe par lib/paie.ts.
  const params = paieParamsFromConfig(db.payrollConfig, db.taxBrackets);
  const emps = db.employees.filter((e) => e.companyId === companyId);
  if (!emps.length) return { ok: false, slips: 0, entryCreated: false, error: "Aucun employé pour cette entreprise." };
  const wagesJournal = db.journals.find((j) => j.companyId === companyId && j.type === "wages");

  const bulletins = emps.map((emp) => calculerBulletin(emp.grossSalary, params));
  const totaux = totaliserBulletins(bulletins);
  const alertes = [...new Set(bulletins.flatMap((b) => b.alertes))];

  const slipRows: Payslip[] = emps.map((emp, i) => {
    const b = bulletins[i];
    return {
      id: uid(), companyId, periodLabel, employeeId: emp.id,
      gross: b.gross,
      cnssEmployee: b.cnssEmployee,
      cnssEmployer: b.cnssEmployer,
      withholding: b.irpp,
      net: b.net,
      amuEmployee: b.amuEmployee,
      amuEmployer: b.amuEmployer,
      irpp: b.irpp,
      modeIRPP: b.modeIRPP,
      assietteIRPP: b.assietteIRPP,
      totalRetenues: b.totalRetenues,
      coutEmployeur: b.coutEmployeur,
      createdAt: new Date().toISOString(),
    };
  });

  mutate((s) => {
    s.payslips.push(...slipRows);
    audit(s, currentUserId() || "", currentOrgId() || "", "RUN_PAYROLL", "Payslip", companyId,
      `Paie ${periodLabel} : ${emps.length} bulletin(s), retenues ${totaux.retenues}, net ${totaux.net}`);
  });

  let entryCreated = false;
  if (wagesJournal) {
    const ecriture = ecrituresPaie(totaux);
    addEntry(companyId, {
      date: new Date().toISOString().slice(0, 10),
      journalId: wagesJournal.id,
      reference: "PAYE-" + periodLabel,
      label: `Paie ${periodLabel}`,
      status: "draft",
      lines: ecriture.lines.map((l) => ({ accountId: l.accountId, label: l.label, debit: l.debit, credit: l.credit })),
    });
    entryCreated = true;
  }
  return {
    ok: true,
    slips: emps.length,
    entryCreated,
    error: wagesJournal ? undefined : "Bulletins générés — aucun journal « Paie » : créez-en un pour générer l'écriture comptable.",
    alertes: alertes.length ? alertes : undefined,
  };
}

// ---------------- Stocks ----------------
export function addStockItem(companyId: string, data: { name: string; category: string; qty: number; unitPrice: number; warehouse: string }): void {
  mutate((s) => {
    s.stockItems.push({ id: uid(), companyId, name: data.name, category: data.category, qty: data.qty, unitPrice: data.unitPrice, warehouse: data.warehouse, updatedAt: new Date().toISOString() });
  });
}

export function adjustStock(id: string, delta: number): void {
  mutate((s) => { const it = s.stockItems.find((x) => x.id === id); if (it) { it.qty = Math.max(0, it.qty + delta); it.updatedAt = new Date().toISOString(); } });
}

export function deleteStockItem(id: string): void {
  mutate((s) => { s.stockItems = s.stockItems.filter((x) => x.id !== id); });
}

// ---------------- Fixed assets: auto depreciation entry ----------------
export function generateDepreciationEntry(companyId: string, assetId: string): void {
  const db = getDB();
  const asset = db.fixedAssets.find((a) => a.id === assetId);
  if (!asset) return;
  const annuity = Math.round((asset.cost - asset.residualValue) / asset.usefulLifeYears);
  // Amortissement : 281x incorporel, 283x bâtiments, 284x matériel ; dotation 6813 (corporel)
  const ac = asset.accountCode;
  const amortCode = ac.startsWith("21") ? "2813" : ac.startsWith("23") ? "2831" : "2844";
  const journal = db.journals.find((j) => j.companyId === companyId && j.type === "fixed_assets") || db.journals.find((j) => j.companyId === companyId && j.type === "misc");
  if (!journal) return;
  addEntry(companyId, { date: new Date().toISOString().slice(0, 10), journalId: journal.id, reference: "AMORT-" + asset.name, label: `Dotation aux amortissements — ${asset.name}`, status: "draft", lines: [{ accountId: "6813", label: "Dotation " + asset.name, debit: annuity, credit: 0 }, { accountId: amortCode, label: "Amortissement " + asset.name, debit: 0, credit: annuity }] });
}

// ---------------- Bank reconciliation rules + auto ----------------
export function addReconRule(data: { label: string; pattern: string; accountId: string }): void {
  const orgId = currentOrgId() || "";
  mutate((s) => { s.reconRules.push({ id: uid(), organizationId: orgId, label: data.label, pattern: data.pattern.toLowerCase(), accountId: data.accountId, amount: 0 }); });
}

export function deleteReconRule(id: string): void {
  mutate((s) => { s.reconRules = s.reconRules.filter((x) => x.id !== id); });
}

export function autoReconcile(companyId: string): { matched: number } {
  const db = getDB();
  const txs = db.bankTransactions.filter((t) => t.companyId === companyId && !t.reconciled);
  let matched = 0;
  const updates: { txId: string; entryId: string }[] = [];
  for (const t of txs) {
    const abs = Math.abs(t.amount);
    const e = db.entries.find((en) => en.companyId === companyId && en.status === "validated" && en.lines.some((l) => (t.amount > 0 ? l.credit : l.debit) === abs));
    if (e) { updates.push({ txId: t.id, entryId: e.id }); matched++; }
  }
  mutate((s) => {
    for (const u of updates) {
      const t = s.bankTransactions.find((x) => x.id === u.txId);
      if (t) { t.reconciled = true; t.matchedEntryId = u.entryId; }
    }
    if (matched) audit(s, currentUserId() || "", currentOrgId() || "", "AUTO_RECONCILE", "BankTransaction", companyId, `${matched} rapprochements automatiques`);
  });
  return { matched };
}

// ---------------- Dossier permanent ----------------
export function addPermanentDoc(companyId: string, data: { name: string; category: string; date: string; note: string }): void {
  mutate((s) => { s.permanentDocs.push({ id: uid(), companyId, name: data.name, category: data.category, date: data.date, note: data.note }); });
}

export function deletePermanentDoc(id: string): void {
  mutate((s) => { s.permanentDocs = s.permanentDocs.filter((x) => x.id !== id); });
}

// ---------------- TVA grid ----------------
export function tvaGrid(companyId: string, entries: JournalEntry[]): { rate: number; baseHT: number; tvaCollectee: number; tvaRecuperable: number; creditReporte: number } {
  // P0-2 : plus aucun calcul local — même source de vérité que la page Fiscalité.
  const validated = entries.filter((e) => e.companyId === companyId && e.status === "validated");
  const base = fiscalBaseFromMoves(movementsByAccount(validated));
  const rate = getDB().taxRules.find((r) => r.code === "TVA")?.rate ?? 18;
  const t = computeTvaFiscal(base, { rate });
  return { rate, baseHT: t.baseHT, tvaCollectee: t.collectee, tvaRecuperable: t.deductible, creditReporte: t.creditReporte };
}

// ---------------- Tiers (plan tiers : clients / fournisseurs) ----------------
export function addThirdParty(companyId: string, data: Partial<{ code: string; collective: string; type: "customer" | "supplier"; name: string; address: string; city: string; nif: string; contact: string; phone: string; paymentTerms: string; creditLimit: number }>): void {
  const orgId = currentOrgId() || "";
  mutate((s) => {
    s.tiers.push({ id: uid(), organizationId: orgId, companyId, code: data.code || "TIER", collective: data.collective || (data.type === "supplier" ? "4011" : "4111"), type: data.type || "customer", name: data.name || "Nouveau tiers", address: data.address, city: data.city, nif: data.nif, contact: data.contact, phone: data.phone, paymentTerms: data.paymentTerms, creditLimit: data.creditLimit, createdAt: new Date().toISOString() });
    audit(s, currentUserId() || "", orgId, "CREATE_TIER", "ThirdParty", data.name || "", `Création du tiers ${data.name}`);
  });
}

export function updateThirdParty(id: string, patch: Partial<{ code: string; collective: string; type: "customer" | "supplier"; name: string; address: string; city: string; nif: string; contact: string; phone: string; paymentTerms: string; creditLimit: number }>): void { mutate((s) => { const t = s.tiers.find((x) => x.id === id); if (t) Object.assign(t, patch); }); }
export function deleteThirdParty(id: string): void { mutate((s) => { s.tiers = s.tiers.filter((x) => x.id !== id); }); }

// ---------------- Atelier d'états financiers (sessions cabinet, découplées) ----------------
export function createFSSession(companyId: string, exercise: string, label: string): string {
  const orgId = currentOrgId() || "";
  const now = new Date().toISOString();
  const id = uid();
  mutate((s) => {
    s.fsSessions.push({ id, organizationId: orgId, companyId, exercise, label, status: "a_demarrer", balanceN: [], balanceN1: [], auditSummary: null, patchResult: null, coherenceScore: null, history: [{ id: uid(), at: now, label: "Session créée" }], createdAt: now, updatedAt: now });
    audit(s, currentUserId() || "", orgId, "FS_SESSION", "FSSession", id, `Session ${label}`);
  });
  return id;
}

export function updateFSSession(id: string, patch: Partial<DBState["fsSessions"][number]>, historyLabel?: string): void {
  const now = new Date().toISOString();
  mutate((s) => {
    const sess = s.fsSessions.find((x) => x.id === id);
    if (!sess) return;
    Object.assign(sess, patch);
    sess.updatedAt = now;
    if (historyLabel) sess.history.push({ id: uid(), at: now, label: historyLabel });
  });
}

export function setFSBalances(id: string, n: DBState["fsSessions"][number]["balanceN"], n1: DBState["fsSessions"][number]["balanceN1"]): void {
  updateFSSession(id, { balanceN: n, balanceN1: n1, status: "balances_importees", coherenceScore: null }, `Balances importées (N: ${n.length}, N-1: ${n1.length})`);
}

export function setFSAudit(id: string, auditSummary: { fileName: string; sheets: number; formulas: number; matchedKeySheets: string[] }): void {
  updateFSSession(id, { auditSummary, status: "modele_analyse" }, `Modèle analysé : ${auditSummary.fileName} (${auditSummary.sheets} feuilles)`);
}

export function setFSPatch(id: string, patch: { patched: number; preserved: number; errors: string[] }): void {
  updateFSSession(id, { patchResult: patch, status: "etat_edite" }, `État édité : ${patch.patched} entrée(s), ${patch.preserved} formule(s) préservée(s)`);
}

export function setFSCoherence(id: string, score: number): void {
  updateFSSession(id, { coherenceScore: score, status: "controle" }, `Contrôles de cohérence : ${score}%`);
}

export function setFSExported(id: string): void {
  updateFSSession(id, { status: "exporte" }, "État exporté");
}

export function deleteFSSession(id: string): void { mutate((s) => { s.fsSessions = s.fsSessions.filter((x) => x.id !== id); }); }

// ---------------- Saisie guidée de règlement (encaissement / règlement) ----------------
export function guidedSettlement(companyId: string, data: { kind: "receipt" | "payment"; tierId: string; amount: number; date: string; journalId: string; reference: string }): { ok: boolean; error?: string } {
  const db = getDB();
  const tier = db.tiers.find((t) => t.id === data.tierId);
  if (!tier) return { ok: false, error: "Tiers introuvable." };
  const collective = tier.collective;
  const bank = "5211";
  const lines: { accountId: string; label: string; debit: number; credit: number; tierId: string | null }[] = data.kind === "receipt"
    ? [{ accountId: bank, label: "Banque", debit: data.amount, credit: 0, tierId: null }, { accountId: collective, label: `Encaissement ${tier.name}`, debit: 0, credit: data.amount, tierId: tier.id }]
    : [{ accountId: collective, label: `Règlement ${tier.name}`, debit: data.amount, credit: 0, tierId: tier.id }, { accountId: bank, label: "Banque", debit: 0, credit: data.amount, tierId: null }];
  const id = addEntry(companyId, { date: data.date, journalId: data.journalId, reference: data.reference, label: data.kind === "receipt" ? `Encaissement client ${tier.name}` : `Règlement fournisseur ${tier.name}`, status: "draft", lines });
  if (!id) return { ok: false, error: "Période clôturée." };
  autoLetter(companyId, collective); // lettrage immédiat
  return { ok: true };
}

// ---------------- Clôture / réouverture de période ----------------
export function closePeriod(periodId: string): void { mutate((s) => { const p = s.periods.find((x) => x.id === periodId); if (p) p.status = "closed"; audit(s, currentUserId() || "", currentOrgId() || "", "CLOSE_PERIOD", "AccountingPeriod", periodId, "Période clôturée"); }); }
export function reopenPeriod(periodId: string): void { mutate((s) => { const p = s.periods.find((x) => x.id === periodId); if (p) p.status = "open"; audit(s, currentUserId() || "", currentOrgId() || "", "REOPEN_PERIOD", "AccountingPeriod", periodId, "Période rouverte"); }); }

// ---------------- Pointage bancaire par lot ----------------
export function pointAll(companyId: string): number {
  let n = 0;
  mutate((s) => { for (const t of s.bankTransactions) { if (t.companyId === companyId && !t.reconciled) { t.reconciled = true; n++; } } if (n) audit(s, currentUserId() || "", currentOrgId() || "", "POINT_ALL", "BankTransaction", companyId, `${n} transaction(s) pointées`); });
  return n;
}

// ---------------- Génération automatique d'écritures ----------------
export function runAllSubscriptions(companyId: string): number {
  const db = getDB();
  const tpls = db.entryTemplates.filter((t) => t.companyId === companyId && t.journalId);
  let n = 0;
  for (const t of tpls) { runEntryTemplate(t.id); n++; }
  return n;
}

export function postRegularisation(companyId: string, data: { type: "CCA" | "PCA" | "CAP" | "PAR"; account: string; amount: number; label: string; date: string }): { ok: boolean; error?: string } {
  const db = getDB();
  const journal = db.journals.find((j) => j.companyId === companyId && j.type === "misc") || db.journals.find((j) => j.companyId === companyId);
  if (!journal) return { ok: false, error: "Journal manquant." };
  let lines: { accountId: string; label: string; debit: number; credit: number }[];
  const lbl = data.label || "Régularisation";
  switch (data.type) {
    case "CCA": lines = [{ accountId: "476", label: lbl, debit: data.amount, credit: 0 }, { accountId: data.account, label: lbl, debit: 0, credit: data.amount }]; break;
    case "PCA": lines = [{ accountId: data.account, label: lbl, debit: data.amount, credit: 0 }, { accountId: "477", label: lbl, debit: 0, credit: data.amount }]; break;
    case "CAP": lines = [{ accountId: data.account, label: lbl, debit: data.amount, credit: 0 }, { accountId: "408", label: lbl, debit: 0, credit: data.amount }]; break;
    case "PAR": lines = [{ accountId: "418", label: lbl, debit: data.amount, credit: 0 }, { accountId: data.account, label: lbl, debit: 0, credit: data.amount }]; break;
    default: return { ok: false, error: "Type inconnu." };
  }
  const id = addEntry(companyId, { date: data.date, journalId: journal.id, reference: "REGUL", label: `Régularisation ${data.type} — ${lbl}`, status: "draft", lines });
  return { ok: !!id, error: id ? undefined : "Période clôturée." };
}

// ---------------- Retraitements fiscaux (réintégrations / déductions) ----------------
/**
 * P10 — Une réintégration ou une déduction fiscale se saisit, ne se devine pas.
 * Chaque ligne est attribuée, datée et scellée dans le journal d'audit : un
 * retraitement fiscal sans trace écrite est indéfendable en vérification.
 */
export function addTaxAdjustment(
  companyId: string,
  data: { exercise: string; type: "reintegration" | "deduction"; label: string; amount: number; reference?: string },
): { ok: boolean; error?: string; id?: string } {
  const label = (data.label || "").trim();
  if (!label) return { ok: false, error: "Libellé obligatoire : un retraitement doit pouvoir être justifié." };
  if (!Number.isFinite(data.amount) || data.amount <= 0) return { ok: false, error: "Montant strictement positif attendu." };
  if (!/^\d{4}$/.test(data.exercise)) return { ok: false, error: "Exercice attendu au format AAAA." };
  const id = uid();
  mutate((s) => {
    s.taxAdjustments.push({
      id,
      companyId,
      exercise: data.exercise,
      type: data.type,
      label,
      amount: Math.round(data.amount),
      reference: data.reference?.trim() || undefined,
      authorId: currentUserId() || "system",
      createdAt: new Date().toISOString(),
    });
    audit(s, currentUserId() || "", currentOrgId() || "", "TAX_ADJUSTMENT_CREATE", "TaxAdjustment", id,
      `${data.type === "reintegration" ? "Réintégration" : "Déduction"} ${data.exercise} — ${label} : ${Math.round(data.amount)}`);
  });
  return { ok: true, id };
}

export function deleteTaxAdjustment(id: string): void {
  mutate((s) => {
    const item = s.taxAdjustments.find((a) => a.id === id);
    s.taxAdjustments = s.taxAdjustments.filter((a) => a.id !== id);
    if (item) {
      audit(s, currentUserId() || "", currentOrgId() || "", "TAX_ADJUSTMENT_DELETE", "TaxAdjustment", id,
        `Suppression ${item.type} ${item.exercise} — ${item.label} : ${item.amount}`);
    }
  });
}

/** Retraitements d'un dossier pour un exercice, prêts pour `computeIsFiscal`. */
export function fiscalAdjustmentsFor(companyId: string, exercise: string): { reintegrations: number; deductions: number } {
  const list = getDB().taxAdjustments.filter((a) => a.companyId === companyId && a.exercise === exercise);
  return {
    reintegrations: totalAdjustments(list, "reintegration"),
    deductions: totalAdjustments(list, "deduction"),
  };
}

// ============================================================================
// LOT 2 — Création d'entreprise avec IDENTIFIANTS PORTAIL GÉNÉRÉS
// Le cabinet saisit l'e-mail de contact ; la plateforme génère un mot de passe
// temporaire (affiché UNE SEULE fois), crée l'organisation cliente, le compte
// utilisateur, l'exercice et les périodes. L'entreprise devra changer son mot de
// passe à la première connexion (mustChangePassword).
// Invariant I5 : le mot de passe en clair n'est JAMAIS stocké dans l'état —
// uniquement le hash (hashPassword). Il est renvoyé à l'appelant pour affichage.
// ============================================================================

/** Alphabet sans caractères ambigus (0/O, 1/l/I, guillemets). */
const PWD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*+-=?";
const PWD_LENGTH = 14;

/** Génère un mot de passe temporaire fort : longueur fixe + complexité garantie
 *  (au moins une majuscule, une minuscule, un chiffre et un symbole). */
function generateTemporaryPassword(): string {
  const bytes = new Uint32Array(PWD_LENGTH);
  crypto.getRandomValues(bytes);
  let pwd = Array.from(bytes, (b) => PWD_ALPHABET[b % PWD_ALPHABET.length]).join("");
  // Garantit la complexité : remplace les 4 premiers caractères si une classe manque.
  const has = (re: RegExp) => re.test(pwd);
  if (!has(/[A-Z]/)) pwd = "K" + pwd.slice(1);
  if (!has(/[a-z]/)) pwd = pwd.slice(0, 1) + "k" + pwd.slice(2);
  if (!has(/\d/)) pwd = pwd.slice(0, 2) + "7" + pwd.slice(3);
  if (!has(/[!@#$%&*+\-=?]/)) pwd = pwd.slice(0, 3) + "@" + pwd.slice(4);
  return pwd;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface CompanyAccessInput {
  name: string;
  tradeName?: string;
  legalForm?: string;
  nif?: string;
  sector?: string;
  activity?: string;
  city?: string;
  capital?: number;
  taxRegime?: TaxRegime;
  vatPayer?: boolean;
  riskLevel?: "low" | "medium" | "high";
  /** E-mail de contact de l'entreprise — devient son identifiant de connexion. */
  email: string;
  phone?: string;
  exercise?: string;
}

export interface CompanyAccessResult {
  ok: boolean;
  error?: string;
  companyId?: string;
  userId?: string;
  email?: string;
  /** Mot de passe temporaire en clair — affiché UNE SEULE fois par l'UI, jamais persisté. */
  tempPassword?: string;
}

/**
 * Crée une entreprise gérée par le cabinet courant + son accès portail.
 * Remplace `addCompany` (conservée pour compatibilité, cf. Q-Rattrapage LOT 3).
 */
export function addCompanyWithAccess(data: CompanyAccessInput): CompanyAccessResult {
  const orgId = currentOrgId();
  if (!orgId) return { ok: false, error: "Session cabinet introuvable." };
  const email = (data.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Adresse e-mail invalide — elle devient l'identifiant de connexion de l'entreprise." };
  const db = getDB();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return { ok: false, error: "Un compte utilise déjà cette adresse e-mail." };
  }
  const companyName = data.name?.trim();
  if (!companyName) return { ok: false, error: "La raison sociale est obligatoire." };

  const companyId = uid();
  const orgClientId = uid();
  const userId = uid();
  const tempPassword = generateTemporaryPassword();
  const passwordHash = hashPassword(tempPassword);
  const exercise = data.exercise || String(new Date().getFullYear());
  const now = new Date().toISOString();

  mutate((s) => {
    // Organisation cliente (proprio des données du point de vue du portail)
    s.organizations.push({
      id: orgClientId,
      name: companyName,
      type: "company_client",
      legalForm: data.legalForm || "SARL",
      nif: data.nif || "",
      email,
      phone: data.phone,
      city: data.city || "Lomé",
      country: "TG",
      logoColor: "#f59e0b",
      plan: "trial",
      createdAt: now,
    });
    // Entreprise — rattachée au cabinet courant
    s.companies.push({
      id: companyId,
      organizationId: orgClientId,
      name: companyName,
      tradeName: data.tradeName || data.name || "",
      legalForm: data.legalForm || "SARL",
      nif: data.nif || "",
      sector: data.sector || "",
      activity: data.activity || "",
      city: data.city || "Lomé",
      capital: data.capital || 0,
      taxRegime: data.taxRegime || "ri",
      vatPayer: data.vatPayer ?? true,
      currency: "XOF",
      fiscalYearStartMonth: 1,
      riskLevel: data.riskLevel || "low",
      cabinetOrganizationId: orgId,
      createdAt: now,
    });
    // Profil fiscal
    s.taxProfiles.push({ id: uid(), companyId, regime: data.taxRegime || "ri", vatPayer: data.vatPayer ?? true, tfeLiable: true, obligations: data.vatPayer ? ["TVA mensuelle"] : [] });
    // Exercice + 12 périodes (sinon l'onglet Clôture sera vide pour cette entreprise)
    const fyId = uid();
    s.fiscalYears.push({
      id: fyId,
      companyId,
      label: `Exercice ${exercise}`,
      startDate: `${exercise}-01-01`,
      endDate: `${exercise}-12-31`,
      status: "open",
    });
    const year = parseInt(exercise, 10) || new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
      s.periods.push({
        id: uid(),
        fiscalYearId: fyId,
        companyId,
        label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, m - 1, 1)),
        month: m,
        year,
        startDate: `${exercise}-${String(m).padStart(2, "0")}-01`,
        endDate: `${exercise}-${String(m).padStart(2, "0")}-28`,
        status: "open",
      });
    }
    // Compte utilisateur de l'entreprise — hash uniquement (invariant I5)
    s.users.push({
      id: userId,
      email,
      passwordHash,
      firstName: data.tradeName || companyName,
      lastName: "(Entreprise cliente)",
      role: "client_admin",
      userType: "client",
      organizationId: orgClientId,
      companyId,
      avatarColor: "#f59e0b",
      twoFactorEnabled: false,
      mustChangePassword: true,
      active: true,
      createdAt: now,
      lastLoginAt: null,
    });
    // Notification pour le cabinet (traçabilité visible)
    s.notifications.unshift({
      id: uid(),
      userId: null,
      organizationId: orgId,
      title: `Accès portail créé — ${companyName}`,
      body: `Identifiants générés pour ${email}. À transmettre de façon sécurisée.`,
      type: "success",
      read: false,
      createdAt: now,
    });
    audit(
      s, currentUserId() || "", orgId, "CREATE_COMPANY_WITH_ACCESS", "Company", companyId,
      `Entreprise ${companyName} créée · accès portail ${email} · mot de passe temporaire à changer à la première connexion`,
    );
  });

  return { ok: true, companyId, userId, email, tempPassword };
}

// ============================================================================
// LOT 3 — GESTION DES ACCÈS PORTAIL (côté cabinet)
// « Les coordonnées peuvent être changées par après » : régénération du mot de
// passe, modification de l'e-mail, création d'accès pour une entreprise qui
// n'en a pas encore. Invariant I5 : jamais de mot de passe en clair dans l'état.
// ============================================================================

/** Trouve le compte utilisateur lié à une entreprise cliente. */
function findCompanyUser(s: DBState, companyId: string) {
  return s.users.find((u) => u.companyId === companyId && u.userType === "client");
}

function notifyOrg(s: DBState, orgId: string, title: string, body: string, type: "info" | "success" | "warning" | "danger" = "info") {
  s.notifications.unshift({ id: uid(), userId: null, organizationId: orgId, title, body, type, read: false, createdAt: new Date().toISOString() });
}

export interface AccessResult { ok: boolean; error?: string; email?: string; tempPassword?: string }

/** Réinitialise l'accès : un nouveau mot de passe temporaire est généré
 *  (affiché une seule fois par l'UI) et le changement est exigé à la connexion. */
export function regenerateCompanyAccess(companyId: string): AccessResult {
  const db = getDB();
  const company = db.companies.find((c) => c.id === companyId);
  const target = db.users.find((u) => u.companyId === companyId && u.userType === "client");
  if (!company) return { ok: false, error: "Entreprise introuvable." };
  if (!target) return { ok: false, error: "Aucun accès portail n'existe pour cette entreprise." };
  const tempPassword = generateTemporaryPassword();
  const passwordHash = hashPassword(tempPassword);
  mutate((s) => {
    const u = s.users.find((x) => x.id === target.id);
    if (!u) return;
    u.passwordHash = passwordHash;
    u.mustChangePassword = true;
    notifyOrg(s, u.organizationId || "", `Mot de passe régénéré — ${company.name}`, "Nouveau mot de passe temporaire à transmettre de façon sécurisée.", "warning");
    audit(s, currentUserId() || "", currentOrgId() || "", "REGENERATE_ACCESS", "User", target.id, `Mot de passe temporaire régénéré pour ${u.email} — changement exigé à la prochaine connexion`);
  });
  return { ok: true, email: target.email, tempPassword };
}

/** Crée un accès portail pour une entreprise existante qui n'en a pas (rattrapage). */
export function createCompanyAccess(companyId: string, email: string): AccessResult {
  const db = getDB();
  const company = db.companies.find((c) => c.id === companyId);
  if (!company) return { ok: false, error: "Entreprise introuvable." };
  const mail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) return { ok: false, error: "Adresse e-mail invalide." };
  if (db.users.some((u) => u.email.toLowerCase() === mail)) return { ok: false, error: "Un compte utilise déjà cette adresse e-mail." };
  if (findCompanyUser(db, companyId)) return { ok: false, error: "Cette entreprise a déjà un accès portail." };
  const tempPassword = generateTemporaryPassword();
  const userId = uid();
  const now = new Date().toISOString();
  mutate((s) => {
    s.users.push({
      id: userId,
      email: mail,
      passwordHash: hashPassword(tempPassword),
      firstName: company.tradeName || company.name,
      lastName: "(Entreprise cliente)",
      role: "client_admin",
      userType: "client",
      organizationId: company.organizationId,
      companyId,
      avatarColor: "#f59e0b",
      twoFactorEnabled: false,
      mustChangePassword: true,
      active: true,
      createdAt: now,
      lastLoginAt: null,
    });
    notifyOrg(s, company.cabinetOrganizationId || currentOrgId() || "", `Accès portail créé — ${company.name}`, `Identifiants générés pour ${mail}.`, "success");
    audit(s, currentUserId() || "", currentOrgId() || "", "CREATE_ACCESS", "User", userId, `Accès portail créé pour ${company.name} (${mail})`);
  });
  return { ok: true, email: mail, tempPassword };
}

/** Change l'e-mail de connexion de l'entreprise (unicité vérifiée). */
export function updateCompanyEmail(companyId: string, newEmail: string): { ok: boolean; error?: string } {
  const db = getDB();
  const mail = newEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) return { ok: false, error: "Adresse e-mail invalide." };
  if (db.users.some((u) => u.email.toLowerCase() === mail && u.companyId !== companyId)) {
    return { ok: false, error: "Un autre compte utilise déjà cette adresse e-mail." };
  }
  const company = db.companies.find((c) => c.id === companyId);
  if (!company) return { ok: false, error: "Entreprise introuvable." };
  mutate((s) => {
    const u = findCompanyUser(s, companyId);
    if (u) u.email = mail;
    const org = s.organizations.find((o) => o.id === company.organizationId);
    if (org) org.email = mail;
    audit(s, currentUserId() || "", currentOrgId() || "", "UPDATE_ACCESS_EMAIL", "Company", companyId, `E-mail de connexion changé → ${mail}`);
  });
  return { ok: true };
}

/** LOT 5 — L'entreprise change son propre mot de passe (vérification de l'ancien). */
export function changeOwnPassword(oldPassword: string, newPassword: string): { ok: boolean; error?: string } {
  const db = getDB();
  const u = db.users.find((x) => x.id === db.session.userId);
  if (!u) return { ok: false, error: "Session introuvable." };
  if (!verifyPassword(oldPassword, u.passwordHash)) return { ok: false, error: "L'ancien mot de passe est incorrect." };
  if (newPassword.length < 8) return { ok: false, error: "Le nouveau mot de passe doit comporter au moins 8 caractères." };
  if (newPassword === oldPassword) return { ok: false, error: "Le nouveau mot de passe doit être différent de l'ancien." };
  mutate((s) => {
    const target = s.users.find((x) => x.id === u.id);
    if (!target) return;
    target.passwordHash = hashPassword(newPassword);
    target.mustChangePassword = false;
    audit(s, target.id, target.organizationId || "", "CHANGE_PASSWORD", "User", target.id, "Mot de passe modifié par l'utilisateur");
  });
  return { ok: true };
}

/** LOT 5 — L'entreprise change son propre e-mail de connexion. */
export function changeOwnEmail(newEmail: string, password: string): { ok: boolean; error?: string } {
  const db = getDB();
  const u = db.users.find((x) => x.id === db.session.userId);
  if (!u) return { ok: false, error: "Session introuvable." };
  if (!verifyPassword(password, u.passwordHash)) return { ok: false, error: "Mot de passe incorrect." };
  const mail = newEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(mail)) return { ok: false, error: "Adresse e-mail invalide." };
  if (db.users.some((x) => x.email.toLowerCase() === mail && x.id !== u.id)) return { ok: false, error: "Un autre compte utilise déjà cette adresse e-mail." };
  mutate((s) => {
    const target = s.users.find((x) => x.id === u.id);
    if (!target) return;
    target.email = mail;
    const org = s.organizations.find((o) => o.id === target.organizationId);
    if (org) org.email = mail;
    audit(s, target.id, target.organizationId || "", "CHANGE_EMAIL", "User", target.id, `E-mail de connexion changé → ${mail}`);
  });
  return { ok: true };
}

// ============================================================================
// LOT 11 — BIBLIOTHÈQUE DE MODÈLES D'ÉCRITURES
// Les 49 modèles du catalogue (entryTemplates.ts) sont seedés : 30 standards
// rattachés au premier cabinet, 19 en bibliothèque partagée (companyId: null).
// Ces actions les rendent utilisables par CHAQUE entreprise.
// ============================================================================

/** Active un modèle du catalogue pour une entreprise (copie liée à l'exercice). */
export function activateTemplate(templateId: string, companyId: string): { ok: boolean; error?: string } {
  const db = getDB();
  const t = db.entryTemplates.find((x) => x.id === templateId);
  const company = db.companies.find((c) => c.id === companyId);
  if (!t) return { ok: false, error: "Modèle introuvable." };
  if (!company) return { ok: false, error: "Entreprise introuvable." };
  const id = uid();
  mutate((s) => {
    s.entryTemplates.push({
      id,
      organizationId: company.cabinetOrganizationId || company.organizationId,
      companyId,
      name: t.name,
      journalId: t.journalId,
      recurring: t.recurring,
      lines: t.lines.map((l) => ({ accountId: l.accountId, label: l.label, debit: l.debit, credit: l.credit })),
      lastRun: null,
      createdAt: new Date().toISOString(),
    });
    audit(s, currentUserId() || "", currentOrgId() || "", "ACTIVATE_TEMPLATE", "EntryTemplate", id, `Modèle « ${t.name} » activé pour ${company.name}`);
  });
  return { ok: true };
}

/** Exécute un modèle avec un montant de base et une date (saisie guidée). */
export function runTemplateWithAmount(templateId: string, baseAmount: number, date: string, reference: string): { ok: boolean; error?: string } {
  const db = getDB();
  const t = db.entryTemplates.find((x) => x.id === templateId);
  if (!t) return { ok: false, error: "Modèle introuvable." };
  if (!t.companyId || !t.journalId) return { ok: false, error: "Modèle non lié à une entreprise ou un journal." };
  // Équilibre automatique : la dernière ligne reçoit l'écart.
  // Mise à l'échelle via TEMPLATE_BY_ID (qui connaît les lignes `variable`).
  const def = TEMPLATE_BY_ID.get(templateId);
  const scaled = def ? scaleTemplate(def, baseAmount) : t.lines.map((l) => ({ accountId: l.accountId, label: l.label, debit: l.debit, credit: l.credit }));
  const d = scaled.reduce((a, l) => a + l.debit, 0), c = scaled.reduce((a, l) => a + l.credit, 0);
  const diff = d - c;
  if (diff !== 0 && scaled.length) {
    const last = scaled[scaled.length - 1];
    if (last.debit > 0 || last.credit === 0) last.debit += -diff;
    else last.credit += diff;
  }
  const id = addEntry(t.companyId, { date, journalId: t.journalId, reference: reference || "MODELE-" + t.name, label: t.name, status: "draft", lines: scaled });
  if (!id) return { ok: false, error: "Période clôturée — écriture non générée." };
  mutate((s) => {
    const tt = s.entryTemplates.find((x) => x.id === templateId);
    if (tt) tt.lastRun = new Date().toISOString();
  });
  return { ok: true };
}

/** Modèles disponibles pour une entreprise : les siens + la bibliothèque partagée. */
export function availableTemplates(db: DBState, companyId: string) {
  return db.entryTemplates.filter((t) => t.companyId === companyId || t.companyId === null);
}


// ============================================================================
// LOT 12 — ADMINISTRATION PLATEFORME
// Séparation admin ↔ utilisateurs : les organisations de type "cabinet" ne sont
// plus des "utilisateurs" mais des clients de la plateforme (tenants).
// ============================================================================

/** Tarifs de la plateforme — modifiables par l'admin (source de vérité pour la facturation). */
export interface PlatformPlan {
  id: "trial" | "starter" | "pro" | "enterprise";
  name: string;
  monthlyPrice: number;
  maxCompanies: number | null;   // null = illimité
  maxUsers: number | null;
  features: string[];
  active: boolean;
}

export const DEFAULT_PLANS: PlatformPlan[] = [
  { id: "trial", name: "Essai", monthlyPrice: 0, maxCompanies: 3, maxUsers: 3, features: ["1 cabinet", "3 utilisateurs", "Tous les modules", "14 jours"], active: true },
  { id: "starter", name: "Starter", monthlyPrice: 35000, maxCompanies: 50, maxUsers: 5, features: ["50 entreprises clientes", "5 utilisateurs", "Comptabilité + Fiscalité", "Documents & OCR"], active: true },
  { id: "pro", name: "Pro", monthlyPrice: 75000, maxCompanies: null, maxUsers: 15, features: ["Entreprises illimitées", "15 utilisateurs", "États financiers + IA", "Conformité & rapports", "Portail client"], active: true },
  { id: "enterprise", name: "Enterprise", monthlyPrice: 250000, maxCompanies: null, maxUsers: null, features: ["Tout illimité", "Multi-pays OHADA", "API & intégrations", "Support dédié"], active: true },
];

/** Met à jour le tarif d'un plan. */
export function updatePlanPrice(planId: PlatformPlan["id"], monthlyPrice: number): void {
  mutate((s) => {
    const org = s.organizations.find((o) => o.id === "org-platform");
    if (org) {
      s.auditLogs.unshift({ id: uid(), userId: currentUserId() || "system", organizationId: org.id, action: "PLAN_PRICE_UPDATE", entity: "PlatformPlan", entityId: planId, before: null, after: `Tarif ${planId} → ${monthlyPrice} FCFA/mois`, ip: "127.0.0.1", createdAt: new Date().toISOString() });
    }
    const sub = s.subscriptions.find((x) => x.plan === planId);
    if (sub) sub.monthlyAmount = monthlyPrice;
  });
}

/** Active/désactive un plan (plus vendable aux nouveaux cabinets). */
export function togglePlanActive(planId: PlatformPlan["id"], active: boolean): void {
  mutate((s) => {
    s.auditLogs.unshift({ id: uid(), userId: currentUserId() || "system", organizationId: "org-platform", action: "PLAN_TOGGLE", entity: "PlatformPlan", entityId: planId, before: null, after: active ? "actif" : "désactivé", ip: "127.0.0.1", createdAt: new Date().toISOString() });
  });
}

/** Suspend ou réactive un cabinet. */
export function toggleCabinetSuspension(cabinetId: string): { ok: boolean; error?: string; suspended?: boolean } {
  const db = getDB();
  const org = db.organizations.find((o) => o.id === cabinetId);
  if (!org || org.type !== "cabinet") return { ok: false, error: "Cabinet introuvable." };
  const sub = db.subscriptions.find((x) => x.organizationId === cabinetId);
  const nowSuspended = sub?.status === "past_due";
  mutate((s) => {
    const target = s.subscriptions.find((x) => x.organizationId === cabinetId);
    if (target) target.status = nowSuspended ? "active" : "past_due";
    notifyOrg(s, cabinetId, nowSuspended ? "Compte réactivé" : "Compte suspendu", nowSuspended ? "Votre accès est restauré." : "Contactez la plateforme pour régulariser.", nowSuspended ? "success" : "danger");
    audit(s, currentUserId() || "", "org-platform", nowSuspended ? "CABINET_REACTIVATE" : "CABINET_SUSPEND", "Organization", cabinetId, `${org.name} → ${nowSuspended ? "réactivé" : "suspendu"}`);
  });
  return { ok: true, suspended: !nowSuspended };
}

/** Logo de la plateforme (data URL) — stocké dans l'organisation platform. */
export function setPlatformLogo(dataUrl: string): void {
  mutate((s) => {
    const org = s.organizations.find((o) => o.id === "org-platform");
    if (org) {
      (org as unknown as { logoDataUrl?: string }).logoDataUrl = dataUrl;
      audit(s, currentUserId() || "", org.id, "PLATFORM_LOGO", "Organization", org.id, "Logo de la plateforme mis à jour");
    }
  });
}

/** Logo du cabinet (data URL). */
export function setCabinetLogo(cabinetId: string, dataUrl: string): void {
  mutate((s) => {
    const org = s.organizations.find((o) => o.id === cabinetId);
    if (org) {
      (org as unknown as { logoDataUrl?: string }).logoDataUrl = dataUrl;
      audit(s, currentUserId() || "", cabinetId, "CABINET_LOGO", "Organization", cabinetId, `Logo mis à jour — ${org.name}`);
    }
  });
}

/** Crée/modifie une annonce affichée aux cabinets et entreprises. */
export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: "all" | "cabinets" | "clients";
  active: boolean;
  createdAt: string;
  createdBy: string;
}

export function publishAnnouncement(title: string, body: string, audience: "all" | "cabinets" | "clients"): void {
  const now = new Date().toISOString();
  mutate((s) => {
    // Stocke dans notifications ciblées
    const targets = s.organizations.filter((o) => audience === "all" ? o.type !== "platform" : audience === "cabinets" ? o.type === "cabinet" : o.type === "company_client");
    for (const o of targets) {
      s.notifications.unshift({ id: uid(), userId: null, organizationId: o.id, title, body, type: "info", read: false, createdAt: now });
    }
    audit(s, currentUserId() || "", "org-platform", "ANNOUNCEMENT", "PlatformAnnouncement", title, `Annonce publiée à ${targets.length} organisation(s) — audience : ${audience}`);
  });
}
