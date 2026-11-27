// ============================================================================
// FIMAAC — Extracteur de données de pièces justificatives
// RÈGLE ABSOLUE : ne rien inventer.
//   • On lit ce qui est techniquement lisible dans le navigateur
//     (CSV/TXT, XLSX via ExcelJS, PDF texte non compressé).
//   • Les images scannées ne sont PAS lisibles sans service OCR externe :
//     tous les champs passent en "unreadable" — jamais de valeur déduite.
//   • Un champ non déterminé vaut null (jamais 0) — cf. §24 du moteur.
// ============================================================================
import { loadXlsxSafe } from "./xlsx-sanitizer";

/** Statut de lecture d'un champ. */
export type OcrFieldStatus =
  | "read"       // valeur lue avec un motif clair
  | "manual"     // complété par un humain
  | "unreadable" // zone présente mais non lisible (image scannée, PDF compressé…)
  | "missing";   // aucune zone correspondante trouvée dans le document

export interface OcrField {
  /** Clé canonique — compatible avec DocumentItem.extraction.fields. */
  key: string;
  label: string;
  /** null = non déterminé. Jamais 0 par défaut. */
  value: string | null;
  status: OcrFieldStatus;
  /** 0-100. 0 si non lu. */
  confidence: number;
  /** Explication affichable (pourquoi illisible, quel motif a matché…). */
  note?: string;
}

export interface ExtractionResult {
  fields: OcrField[];
  /** Moteur effectivement utilisé. */
  engine: "xlsx" | "csv" | "txt" | "pdf-text" | "image" | "binary";
  /** Le document contient-il au moins une donnée lisible ? */
  readable: boolean;
  /** Nb de champs attendus non lisibles. */
  unreadableCount: number;
  /** Nb de champs lus. */
  readCount: number;
  /** Avertissements affichables. */
  warnings: string[];
  /** Longueur de texte brut extrait (diagnostic). */
  textLength: number;
}

/** Catalogue des champs extraits (ordre d'affichage). */
export const OCR_FIELD_DEFS: { key: string; label: string }[] = [
  { key: "numero", label: "N° de pièce / facture" },
  { key: "date", label: "Date de la pièce" },
  { key: "fournisseur", label: "Fournisseur (émetteur)" },
  { key: "client", label: "Client (destinataire)" },
  { key: "designation", label: "Article / désignation" },
  { key: "ht", label: "Montant HT" },
  { key: "tva", label: "TVA" },
  { key: "taux_tva", label: "Taux de TVA" },
  { key: "ttc", label: "Montant TTC" },
  { key: "devise", label: "Devise" },
];

const KEYS = OCR_FIELD_DEFS.map((d) => d.key);

/** Crée un champ. */
function field(key: string, value: string | null, status: OcrFieldStatus, confidence = 0, note?: string): OcrField {
  return { key, label: OCR_FIELD_DEFS.find((d) => d.key === key)?.label || key, value, status, confidence, note };
}

/** Tous les champs attendus, marqués selon un même statut. */
function allFields(status: OcrFieldStatus, note: string): OcrField[] {
  return KEYS.map((k) => field(k, null, status, 0, note));
}

/** Nettoie un montant : "1 250 000,00" → "1250000" (format canonique entier). */
function normalizeAmount(raw: string): string | null {
  const s = raw.replace(/[^\d.,-]/g, "").trim();
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let cleaned = s;
  if (hasComma && hasDot) {
    // Le séparateur décimal est le dernier rencontré
    cleaned = s.lastIndexOf(",") > s.lastIndexOf(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (hasComma) {
    // virgule = milliers si groupes de 3, sinon décimale
    cleaned = /,\d{3}(\s|$)/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return String(Math.round(n));
}

/**
 * Motifs de détection par clé (appliqués au texte extrait).
 * Les captures de texte libre n'incluent PAS les sauts de ligne — un libellé
 * ne doit jamais avaler l'étiquette du champ suivant.
 */
const PATTERNS: { key: string; re: RegExp; amount?: boolean; conf: number }[] = [
  { key: "numero",   re: /(?:facture|fac\.?|pièce|piece|doc\.?|invoice)\s*(?:n[o°.]?|num(?:éro|ero)?)?\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{2,20})/i, conf: 80 },
  { key: "numero",   re: /\bn[o°.]\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]{2,20})/i, conf: 65 },
  { key: "date",     re: /\bdate\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i, conf: 85 },
  { key: "date",     re: /\b(\d{1,2}[\/\-.](?:0?[1-9]|1[0-2])[\/\-.](?:20\d{2}|\d{2}))\b/, conf: 55 },
  { key: "fournisseur", re: /(?:fournisseur|émetteur|emetteur|vendor)\s*[:\-]?\s*([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 &'.\-]{2,48})/i, conf: 70 },
  { key: "client",   re: /(?:client|destinataire|bill\s*to|à\s*l'attention\s*de)\s*[:\-]?\s*([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 &'.\-]{2,48})/i, conf: 70 },
  { key: "designation", re: /(?:désignation|designation|désign\.|objet|libellé|libelle|description|prestation|article)\s*[:\-]?\s*([A-ZÀ-ÖØ-Þ0-9][^\n]{3,80})/i, conf: 60 },
  { key: "ht",       re: /(?:total\s*)?(?:ht|hors\s*taxes?|montant\s*ht)\s*[:\-]?\s*(\d[\d\s\u00a0.,]*\d|\d)(?!\s*%)/i, amount: true, conf: 80 },
  // TVA montant : « TVA 18% : 90 000 » (taux puis montant) ou « TVA : 90 000 ».
  // La lookahead négative exclut le taux lui-même.
  { key: "tva",      re: /(?:tva|vat)\s*\d{1,2}(?:[.,]\d+)?\s*%\s*[:\-]?\s*(\d[\d\s\u00a0.,]*\d|\d)/i, amount: true, conf: 85 },
  { key: "tva",      re: /(?:tva|vat|taxe\s*sur\s*la\s*valeur\s*ajoutée)\s*[:\-]?\s*(\d[\d\s\u00a0.,]*\d|\d)(?!\s*%)/i, amount: true, conf: 70 },
  { key: "taux_tva", re: /(?:tva|vat)\s*(?:au\s*taux\s*de)?\s*[:\-]?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i, conf: 85 },
  { key: "ttc",      re: /(?:ttc|toutes?\s*taxes?\s*comprises|montant\s*ttc|net\s*à\s*payer|net\s*a\s*payer|total\s*général)\s*[:\-]?\s*(\d[\d\s\u00a0.,]*\d|\d)(?!\s*%)/i, amount: true, conf: 80 },
  { key: "ttc",      re: /\btotal\s*[:\-]?\s*(\d[\d\s\u00a0.,]*\d|\d)(?!\s*%)/i, amount: true, conf: 60 },
  { key: "devise",   re: /\b(XOF|FCFA|XAF|CFA|EUR|USD|€)\b/i, conf: 90 },
];

/** Applique les motifs sur un texte, sans jamais écraser une valeur déjà lue avec une meilleure confiance. */
function extractFromText(text: string, existing: OcrField[] = []): OcrField[] {
  const out = new Map<string, OcrField>(existing.map((f) => [f.key, f]));
  for (const p of PATTERNS) {
    const prev = out.get(p.key);
    // Un champ déjà lu avec une confiance >= n'est pas réévalué
    if (prev && (prev.status === "read" || prev.status === "manual") && prev.confidence >= p.conf) continue;
    const m = p.re.exec(text);
    if (!m) continue;
    const raw = (m[1] ?? "").trim();
    if (!raw) continue;
    const value = p.amount ? normalizeAmount(raw) : raw.slice(0, 80);
    if (!value) continue;
    out.set(p.key, field(p.key, value, "read", p.conf, `Motif « ${p.re.source.slice(0, 40)}… »`));
  }
  return KEYS.map((k) => out.get(k) || field(k, null, "missing", 0));
}

// ---------------------------------------------------------------------------
// Extracteurs par format
// ---------------------------------------------------------------------------

/** PDF : extraction du texte des flux littéraux non compressés. */
function extractPdfText(buf: ArrayBuffer): { text: string; readable: boolean } {
  const bytes = new Uint8Array(buf);
  let latin = "";
  for (let i = 0; i < bytes.length; i++) latin += String.fromCharCode(bytes[i]);
  // Filtre les opérateurs de contenu textuel PDF (Tj / TJ)
  const chunks: string[] = [];
  const re = /\((?:\\.|[^\\()])*\)\s*(?:Tj|TJ)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin)) !== null) {
    const inner = m[0].slice(1, m[0].lastIndexOf(")"));
    chunks.push(inner.replace(/\\([()\\])/g, "$1").replace(/\\n/g, " "));
  }
  const text = chunks.join(" ").trim();
  // Un PDF compressé (FlateDecode) ne livre rien : on ne devine pas.
  return { text, readable: text.length >= 20 };
}

/** XLSX : lecture des cellules, extraction ligne à ligne puis motifs. */
async function extractXlsx(file: File): Promise<{ fields: OcrField[]; textLength: number; warnings: string[] }> {
  const warnings: string[] = [];
  const wb = await loadXlsxSafe(file);
  const lines: string[] = [];
  for (const ws of wb.worksheets) {
    const cap = Math.min(ws.rowCount || 0, 300);
    for (let r = 1; r <= cap; r++) {
      const row = ws.getRow(r);
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cells.length > 40) return;
        const v = cell.value;
        if (v == null) return;
        if (typeof v === "object") {
          const o = v as { text?: unknown; result?: unknown; formula?: unknown };
          if (typeof o.text === "string") cells.push(o.text);
          else if (o.result !== undefined) cells.push(String(o.result));
          else if (typeof o.formula === "string") cells.push(o.formula);
        } else {
          cells.push(String(v));
        }
      });
      if (cells.length) lines.push(cells.join(" | "));
    }
    if ((ws.rowCount || 0) > 300) warnings.push(`Feuille « ${ws.name} » tronquée à 300 lignes.`);
  }
  const text = lines.join("\n");
  return { fields: extractFromText(text), textLength: text.length, warnings };
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------
const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i;

/**
 * Extrait les données d'une pièce justificative.
 * Ne renvoie JAMAIS de valeur déduite : les zones non lisibles sont signalées.
 */
export async function extractFromDocument(file: File): Promise<ExtractionResult> {
  const name = file.name.toLowerCase();
  const warnings: string[] = [];

  // ---- Image scannée : aucune lecture possible sans OCR externe ----
  if (IMG_RE.test(name) || file.type.startsWith("image/")) {
    return {
      fields: allFields(
        "unreadable",
        "Image scannée — lecture automatique indisponible dans le navigateur. Complétez manuellement ou connectez un service OCR.",
      ),
      engine: "image",
      readable: false,
      unreadableCount: KEYS.length,
      readCount: 0,
      warnings: [
        "Les images scannées nécessitent un service OCR externe (backend/README.md §7 — job document.ocr).",
        "Aucune valeur n'a été déduite : complétez les champs manuellement.",
      ],
      textLength: 0,
    };
  }

  // ---- XLSX ----
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    try {
      const { fields, textLength, warnings: w } = await extractXlsx(file);
      warnings.push(...w);
      const readCount = fields.filter((f) => f.status === "read").length;
      const unreadableCount = fields.filter((f) => f.status !== "read").length;
      if (readCount === 0) {
        warnings.push("Classeur lisible mais aucun motif de pièce reconnu (n°, date, TVA, TTC…).");
      }
      return { fields, engine: "xlsx", readable: readCount > 0, unreadableCount, readCount, warnings, textLength };
    } catch (e) {
      warnings.push(`Classeur illisible : ${(e as Error).message.split("\n")[0]}`);
      return {
        fields: allFields("unreadable", "Classeur illisible (formules partagées ou fichier protégé)."),
        engine: "binary", readable: false,
        unreadableCount: KEYS.length, readCount: 0, warnings, textLength: 0,
      };
    }
  }

  // ---- PDF ----
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const { text, readable } = extractPdfText(await file.arrayBuffer());
    if (!readable) {
      return {
        fields: allFields(
          "unreadable",
          "PDF sans couche texte lisible (scan ou flux compressé). Aucune valeur déduite.",
        ),
        engine: "binary", readable: false,
        unreadableCount: KEYS.length, readCount: 0,
        warnings: ["PDF compressé ou scanné — l'extraction de texte a échoué. Complétez manuellement."],
        textLength: text.length,
      };
    }
    const fields = extractFromText(text);
    const readCount = fields.filter((f) => f.status === "read").length;
    if (readCount === 0) warnings.push("Texte extrait mais aucun motif de pièce reconnu.");
    return {
      fields, engine: "pdf-text", readable: readCount > 0,
      unreadableCount: fields.filter((f) => f.status !== "read").length,
      readCount, warnings, textLength: text.length,
    };
  }

  // ---- CSV / TXT ----
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type.startsWith("text/")) {
    const text = await file.text();
    const fields = extractFromText(text);
    const readCount = fields.filter((f) => f.status === "read").length;
    if (readCount === 0) warnings.push("Fichier texte lisible mais aucun motif de pièce reconnu.");
    return {
      fields, engine: name.endsWith(".csv") ? "csv" : "txt", readable: readCount > 0,
      unreadableCount: fields.filter((f) => f.status !== "read").length,
      readCount, warnings, textLength: text.length,
    };
  }

  // ---- Autre binaire : illisible ----
  return {
    fields: allFields("unreadable", "Format binaire non exploitable dans le navigateur."),
    engine: "binary",
    readable: false,
    unreadableCount: KEYS.length,
    readCount: 0,
    warnings: [`Format « ${file.type || name.split(".").pop() || "inconnu"} » non lu. Complétez manuellement.`],
    textLength: 0,
  };
}

/** Résumé court pour listes / badges. */
export function extractionSummary(r: ExtractionResult): string {
  if (!r.readable) return `${r.unreadableCount} zone(s) illisible(s) — aucune valeur déduite`;
  return `${r.readCount} donnée(s) lue(s) · ${r.unreadableCount} à compléter`;
}
