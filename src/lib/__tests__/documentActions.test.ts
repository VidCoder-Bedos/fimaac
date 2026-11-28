/**
 * P29 — Dernières actions sans appelant : brancher ce qui manquait, supprimer ce
 * qui mentait.
 *
 * Quatre constats, tous vérifiés :
 *  · `setDocStatus` et `setDocCategory` mutant sans aucune trace d'audit ;
 *  · `setDocumentRequestStatus` n'était appelée par personne — le cabinet ne
 *    pouvait donc pas dire qu'une pièce était reçue ;
 *  · `runAllSubscriptions` ne touchait **pas** aux abonnements : elle exécutait
 *    tous les modèles d'écriture, et son nom trompeur la rendait introuvable ;
 *  · `togglePlanActive` n'écrivait qu'une ligne d'audit, **sans modifier aucun
 *    état** : un journal annonçant un changement qui n'a pas eu lieu.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { setDocStatus, setDocCategory, setDocumentRequestStatus, runAllEntryTemplates, createDocumentRequest } from "../actions";
import { getDB, resetDB, mutate } from "../store";

const sleep = (ms = 150) => new Promise((r) => setTimeout(r, ms));

function seedDocument(companyId: string): string {
  const id = "doc-test";
  mutate((s) => {
    s.documents.push({
      id, companyId, name: "facture.pdf", category: "invoice", status: "uploaded",
      size: 1200, uploadedAt: new Date().toISOString(), uploadedById: "u", tags: [],
      extraction: null, folder: "achat", exercise: "2026", month: 3, docStatus: "a_traiter",
      linkedEntryId: null,
    } as never);
  });
  return id;
}

describe("Pièces — statut et nature tracés", () => {
  beforeEach(() => resetDB());

  it("changer le statut documentaire écrit une trace lisible", async () => {
    const companyId = getDB().companies[0].id;
    const docId = seedDocument(companyId);
    await sleep();

    setDocStatus(docId, "archive");
    await sleep();
    const db = getDB();
    expect(db.documents.find((d) => d.id === docId)!.docStatus).toBe("archive");
    const log = db.auditLogs[0];
    expect(log.action).toBe("DOC_STATUS");
    expect(log.after).toContain("a_traiter → archive");
  });

  it("un statut identique n'écrit rien", async () => {
    const companyId = getDB().companies[0].id;
    const docId = seedDocument(companyId);
    await sleep();
    const before = getDB().auditLogs.length;
    setDocStatus(docId, "a_traiter");
    await sleep();
    expect(getDB().auditLogs.length).toBe(before);
  });

  it("la nature de la pièce est tracée, sans doublon", async () => {
    const companyId = getDB().companies[0].id;
    const docId = seedDocument(companyId);
    await sleep();

    setDocCategory(docId, "bank");
    await sleep();
    expect(getDB().documents.find((d) => d.id === docId)!.category).toBe("bank");
    expect(getDB().auditLogs[0].after).toContain("invoice → bank");

    const count = getDB().auditLogs.length;
    setDocCategory(docId, "bank");
    await sleep();
    expect(getDB().auditLogs.length).toBe(count);
  });

  it("une pièce inconnue ne provoque ni erreur ni audit", async () => {
    await sleep();
    const before = getDB().auditLogs.length;
    setDocStatus("inconnu", "archive");
    setDocCategory("inconnu", "other");
    await sleep();
    expect(getDB().auditLogs.length).toBe(before);
  });
});

describe("Demandes de pièces — le cabinet peut statuer", () => {
  beforeEach(() => resetDB());

  it("passer une demande en « reçue » est enregistré et tracé", async () => {
    const companyId = getDB().companies[0].id;
    createDocumentRequest({
      companyId, category: "accounting", docType: "Balance", periodLabel: "03/2026",
      dueDate: "2026-04-10", recurring: "none", message: "Merci",
    });
    await sleep();
    const req = getDB().documentRequests[0];
    expect(req.status).toBe("sent");

    setDocumentRequestStatus(req.id, "received");
    await sleep();
    const after = getDB();
    expect(after.documentRequests[0].status).toBe("received");
    expect(after.auditLogs[0].action).toBe("DOC_REQUEST_STATUS");
    expect(after.auditLogs[0].after).toContain("sent → received");
  });

  it("une demande inconnue est ignorée proprement", async () => {
    await sleep();
    const before = getDB().auditLogs.length;
    setDocumentRequestStatus("inconnue", "received");
    await sleep();
    expect(getDB().auditLogs.length).toBe(before);
  });
});

describe("Modèles d'écriture — nom honnête, exécution en lot", () => {
  beforeEach(() => resetDB());

  it("exécute les modèles du dossier et renvoie le compte", async () => {
    const db = getDB();
    const companyId = db.companies[0].id;
    const journalId = db.journals.find((j) => j.companyId === companyId)!.id;
    mutate((s) => {
      s.entryTemplates.push({
        id: "tpl-1", companyId, name: "Loyer", journalId, recurring: "monthly", category: "general",
        lines: [
          { accountId: "622", label: "Loyer", debit: 150_000, credit: 0 },
          { accountId: "4011", label: "Loyer", debit: 0, credit: 150_000 },
        ],
      } as never);
    });
    await sleep();
    const expected = getDB().entryTemplates.filter((t) => t.companyId === companyId && t.journalId).length;
    const entriesBefore = getDB().entries.length;
    const n = runAllEntryTemplates(companyId);
    await sleep();
    expect(expected).toBeGreaterThanOrEqual(1);
    expect(n).toBe(expected);
    expect(getDB().entries.length).toBe(entriesBefore + n);
  });

  it("ne trouve rien pour un dossier sans modèle", () => {
    expect(runAllEntryTemplates("dossier-vide")).toBe(0);
  });

  it("l'ancien nom trompeur n'existe plus", async () => {
    const actions = await import("../actions");
    expect((actions as Record<string, unknown>).runAllSubscriptions).toBeUndefined();
    expect((actions as Record<string, unknown>).togglePlanActive).toBeUndefined();
  });
});
