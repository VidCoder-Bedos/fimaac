/**
 * P15 — Le sens du solde décide du côté du bilan.
 *
 * Un compte 44 « État » débiteur (impôt payé d'avance, crédit de TVA, avance au
 * personnel) était présenté **en diminution des dettes fiscales et sociales** :
 * il ne figurait donc ni à l'actif, ni vraiment au passif. Le bilan restait
 * équilibré, mais deux postes mentaient — et 520 000 FCFA d'actif disparaissaient
 * du dossier de démonstration.
 */
import { describe, it, expect } from "vitest";
import { computePostes, classify } from "../etatsMapping";
import { buildStatements } from "../liasse";
import { runEngine } from "../engine";
import { seedDatabase } from "../seed";
import { CHART_OF_ACCOUNTS } from "../chartOfAccounts";
import { movementsByAccount } from "../accounting";

const rows = (list: [string, number, number][]) => list.map(([code, debit, credit]) => ({ code, label: "", debit, credit }));

describe("Bilan — éclatement par sens du solde", () => {
  it("place un compte 44 débiteur à l'actif, pas en moins des dettes", () => {
    const st = buildStatements(rows([
      ["4311", 0, 300_000], // cotisations sociales dues (créditeur)
      ["4441", 120_000, 0], // impôt payé d'avance (débiteur)
      ["421", 50_000, 0],   // avance au personnel (débiteur)
      ["5211", 130_000, 0], // banque, pour équilibrer
    ]));
    expect(st.bilan.dettesFiscalesSociales).toBe(300_000);
    expect(st.bilan.creancesFiscalesSociales).toBe(170_000);
    expect(st.bilan.creances).toBe(170_000);
    expect(st.bilan.actifTotal).toBe(st.bilan.passifTotal);
    expect(st.bilan.actifTotal).toBe(300_000);
  });

  it("ne laisse aucun compte 42/43/44 non classé, quel que soit son sens", () => {
    for (const [code, solde] of [["4311", -1000], ["4311", 1000], ["421", 500], ["4472", -700], ["4441", 0]] as [string, number][]) {
      if (solde === 0) continue;
      const poste = classify(code, solde)?.poste;
      expect(solde > 0 ? ["creancesFiscalesSociales"] : ["dettesFiscalesSociales", "autresDettes"]).toContain(poste);
    }
  });
});

describe("Bilan — dossier de démonstration", () => {
  const db = seedDatabase();
  const cid = db.companies[0].id;
  const table = [...movementsByAccount(db.entries.filter((e) => e.companyId === cid))]
    .map(([code, m]) => ({ code, label: "", debit: m.debit, credit: m.credit }));
  const st = buildStatements(table);

  it("fait apparaître les 520 000 du compte 441 débiteur à l'actif", () => {
    expect(st.bilan.creancesFiscalesSociales).toBe(520_000);
    expect(st.bilan.dettesFiscalesSociales).toBe(16_889_734);
    expect(st.bilan.actifTotal).toBe(27_960_921);
    expect(st.bilan.passifTotal).toBe(27_960_921);
  });

  it("ne double pas le montant : l'actif progresse exactement de la créance", () => {
    const postes = computePostes(table).postes;
    expect(postes.creancesFiscalesSociales).toBe(520_000);
    // Les dettes fiscales et sociales ne contiennent plus ce solde débiteur.
    const creditOnly = postes.dettesFiscalesSociales;
    expect(creditOnly).toBeGreaterThan(0);
    expect(creditOnly).toBe(16_889_734);
  });

  it("les deux moteurs d'états restent d'accord", () => {
    const engine = runEngine(table, [], CHART_OF_ACCOUNTS as never, {}).bilan["N"];
    expect(engine.totalActif).toBe(st.bilan.actifTotal);
    expect(engine.totalPassif).toBe(st.bilan.passifTotal);
    expect(engine.dettesFiscalesSociales).toBe(st.bilan.dettesFiscalesSociales);
  });
});
