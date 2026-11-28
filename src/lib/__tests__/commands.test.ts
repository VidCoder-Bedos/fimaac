/**
 * P19 — Palette de commandes (⌘K).
 *
 * La recherche existait, cachée derrière « / » : personne ne la trouvait, et
 * elle ne servait qu'à chercher des pièces. Le classement est désormais une
 * fonction pure, testable, qui privilégie ce que l'utilisateur veut faire.
 */
import { describe, it, expect } from "vitest";
import {
  normalize, scoreCommand, rankCommands, groupCommands,
  STATIC_COMMANDS, NAV_COMMANDS, ACTION_COMMANDS, type Command,
} from "../commands";

const cmd = (o: Partial<Command>): Command => ({ id: o.id || "x", label: o.label || "", group: o.group || "Aller à", ...o });

describe("Palette — normalisation", () => {
  it("ignore accents, casse et espaces superflus", () => {
    expect(normalize("  Fiscalité  ")).toBe("fiscalite");
    expect(normalize("ÉCHÉANCES")).toBe("echeances");
    expect(normalize(undefined as unknown as string)).toBe("");
  });
});

describe("Palette — score et classement", () => {
  it("préfère le libellé exact, puis le préfixe, puis l'inclusion", () => {
    const exact = scoreCommand("liasse", cmd({ label: "Liasse" }));
    const exact2 = scoreCommand("liasse", cmd({ label: "Liasse fiscale" }));
    const inside = scoreCommand("liasse", cmd({ label: "Préparer la liasse" }));
    expect(exact).toBeGreaterThan(exact2);
    expect(exact2).toBeGreaterThan(inside);
  });

  it("trouve sans accent et par sous-séquence", () => {
    expect(scoreCommand("fiscalite", cmd({ label: "Fiscalité" }))).toBeGreaterThan(0);
    expect(scoreCommand("lsse", cmd({ label: "Liasse fiscale" }))).toBeGreaterThan(0);
    expect(scoreCommand("zzz", cmd({ label: "Liasse" }))).toBe(0);
  });

  it("exige tous les mots saisis (ET, pas OU)", () => {
    expect(scoreCommand("liasse notes", cmd({ label: "Liasse fiscale", keywords: "notes annexes" }))).toBeGreaterThan(0);
    expect(scoreCommand("liasse paie", cmd({ label: "Liasse fiscale" }))).toBe(0);
  });

  it("interroge aussi les mots-clés et l'indice", () => {
    expect(scoreCommand("cnss", cmd({ label: "Paie", keywords: "cnss amu irpp" }))).toBeGreaterThan(0);
    expect(scoreCommand("comptabilité", cmd({ label: "Nouvelle écriture", hint: "Comptabilité › Écritures" }))).toBeGreaterThan(0);
  });

  it("plafonne par section pour ne pas noyer la navigation", () => {
    const many: Command[] = Array.from({ length: 20 }, (_, i) => cmd({ id: `e${i}`, label: `Écriture ${i}`, group: "Écritures" }));
    const ranked = rankCommands("ecriture", many, 3);
    expect(ranked).toHaveLength(3);
  });

  it("rend tout quand la requête est vide, et rien pour l'absurde", () => {
    expect(rankCommands("", STATIC_COMMANDS).length).toBeGreaterThan(0);
    expect(rankCommands("qqqqzzz", STATIC_COMMANDS)).toEqual([]);
  });
});

describe("Palette — regroupement", () => {
  it("groupe dans l'ordre d'apparition", () => {
    const grouped = groupCommands([
      cmd({ id: "a", label: "Paie", group: "Aller à" }),
      cmd({ id: "b", label: "Acme", group: "Entreprises" }),
      cmd({ id: "c", label: "Fiscalité", group: "Aller à" }),
    ]);
    expect(grouped.map((g) => g.group)).toEqual(["Aller à", "Entreprises"]);
    expect(grouped[0].items.map((i) => i.id)).toEqual(["a", "c"]);
  });
});

describe("Palette — contenu du produit", () => {
  it("couvre les modules principaux et propose des actions", () => {
    const ids = STATIC_COMMANDS.map((c) => c.id);
    for (const id of ["nav-accounting", "nav-tax", "nav-liasse", "nav-obligations", "nav-payroll"]) {
      expect(ids).toContain(id);
    }
    expect(ACTION_COMMANDS.length).toBeGreaterThanOrEqual(3);
    expect(ACTION_COMMANDS.every((c) => Boolean(c.to))).toBe(true);
  });

  it("chaque navigation mène à une route interne et sait se retrouver par un mot-clé", () => {
    for (const nav of NAV_COMMANDS) {
      expect(nav.to?.startsWith("/app")).toBe(true);
      expect(scoreCommand(nav.label, nav)).toBeGreaterThan(0);
    }
  });

  it("permet d'atteindre la liasse en trois lettres", () => {
    const best = rankCommands("lia", STATIC_COMMANDS)[0];
    expect(best.id).toBe("nav-liasse");
  });
});
