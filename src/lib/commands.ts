// ============================================================================
// FIMAAC — Palette de commandes (⌘K / Ctrl+K)
//
// La recherche existait mais était cachée derrière la touche « / » : personne ne
// la trouvait, et elle ne servait qu'à chercher des pièces. Une palette doit
// d'abord permettre d'**aller quelque part** et d'**agir** — la recherche de
// pièces vient après. Toute la logique de classement est pure et testable ici.
// ============================================================================

export type CommandGroup = "Aller à" | "Entreprises" | "Actions" | "Écritures" | "Documents";

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  /** Précision affichée à droite (route, montant, référence). */
  hint?: string;
  /** Destination interne (react-router). */
  to?: string;
  /** Mots supplémentaires indexés, jamais affichés (synonymes). */
  keywords?: string;
  /** Action exécutée au lieu d'une navigation. */
  run?: () => void;
}

/** Minuscules sans accents : « fiscalité » se trouve en tapant « fiscalite ». */
export function normalize(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Score d'un besoin de recherche : 0 ou moins = non retenu. */
function scoreOne(needle: string, haystack: string): number {
  const h = normalize(haystack);
  if (!h) return 0;
  if (h === needle) return 100;
  if (h.startsWith(needle)) return 80;
  // Début de mot : « fsc » doit trouver « Fiscalité » via « fis ».
  if (h.split(/[\s·—-]+/).some((w) => w.startsWith(needle))) return 60;
  if (h.includes(needle)) return 40;
  // Sous-séquence : « lsse » trouve « Liasse ».
  let i = 0;
  for (const ch of h) if (ch === needle[i]) i++;
  return i === needle.length ? 20 : 0;
}

/**
 * Classe les commandes pour une requête. Tous les mots saisis doivent être
 * trouvés (ET), chacun peut l'être dans le libellé, l'indice ou les mots-clés.
 */
export function scoreCommand(query: string, command: Command): number {
  const q = normalize(query);
  if (!q) return 1;
  const needles = q.split(/\s+/).filter(Boolean);
  let total = 0;
  for (const needle of needles) {
    const best = Math.max(
      scoreOne(needle, command.label) * 2,
      scoreOne(needle, command.hint ?? ""),
      scoreOne(needle, command.keywords ?? ""),
    );
    if (best <= 0) return 0;
    total += best;
  }
  return total;
}

/** Commandes retenues, les meilleures d'abord, plafonnées par section. */
export function rankCommands(query: string, commands: Command[], limitPerGroup = 5): Command[] {
  const scored = commands
    .map((c) => ({ c, s: scoreCommand(query, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const perGroup = new Map<CommandGroup, number>();
  const out: Command[] = [];
  for (const { c } of scored) {
    const used = perGroup.get(c.group) ?? 0;
    if (used >= limitPerGroup) continue;
    perGroup.set(c.group, used + 1);
    out.push(c);
  }
  return out;
}

/** Regroupe pour l'affichage, dans l'ordre de première apparition. */
export function groupCommands(commands: Command[]): { group: CommandGroup; items: Command[] }[] {
  const out: { group: CommandGroup; items: Command[] }[] = [];
  for (const c of commands) {
    let bucket = out.find((b) => b.group === c.group);
    if (!bucket) {
      bucket = { group: c.group, items: [] };
      out.push(bucket);
    }
    bucket.items.push(c);
  }
  return out;
}

/** Navigation du produit — le socle de la palette quand rien n'est saisi. */
export const NAV_COMMANDS: Command[] = [
  { id: "nav-dashboard", label: "Tableau de bord", group: "Aller à", to: "/app", keywords: "accueil home" },
  { id: "nav-companies", label: "Entreprises", group: "Aller à", to: "/app/entreprises", keywords: "clients portefeuille dossier" },
  { id: "nav-accounting", label: "Comptabilité", group: "Aller à", to: "/app/comptabilite", keywords: "ecritures journaux balance grand livre tiers" },
  { id: "nav-tax", label: "Fiscalité", group: "Aller à", to: "/app/fiscalite", keywords: "tva is declarations retraitements" },
  { id: "nav-liasse", label: "Liasse fiscale", group: "Aller à", to: "/app/liasse", keywords: "notes annexes bilan resultat tafire" },
  { id: "nav-obligations", label: "Obligations et échéances", group: "Aller à", to: "/app/obligations", keywords: "calendrier legal feries prorogation" },
  { id: "nav-payroll", label: "Paie", group: "Aller à", to: "/app/paie", keywords: "bulletins salaires cnss amu irpp" },
  { id: "nav-financials", label: "États financiers", group: "Aller à", to: "/app/etats-financiers", keywords: "bilan compte de resultat tft" },
  { id: "nav-bank", label: "Banque", group: "Aller à", to: "/app/banque", keywords: "rapprochement releve" },
  { id: "nav-documents", label: "Documents", group: "Aller à", to: "/app/documents", keywords: "pieces justificatives" },
  { id: "nav-compliance", label: "Conformité", group: "Aller à", to: "/app/conformite", keywords: "controles croises anomalies" },
  { id: "nav-workshop", label: "Atelier des états", group: "Aller à", to: "/app/atelier-etats", keywords: "reconstitution excel" },
  { id: "nav-reports", label: "Éditions et exports", group: "Aller à", to: "/app/rapports", keywords: "fec csv auxiliaire balance agee" },
  { id: "nav-settings", label: "Paramètres", group: "Aller à", to: "/app/parametres", keywords: "reglages profil abonnement" },
];

/** Actions transverses proposées sans quitter la page courante. */
export const ACTION_COMMANDS: Command[] = [
  { id: "act-new-entry", label: "Nouvelle écriture", group: "Actions", to: "/app/comptabilite", hint: "Comptabilité › Écritures", keywords: "saisir creer" },
  { id: "act-import-balance", label: "Importer une balance", group: "Actions", to: "/app/liasse", hint: "Liasse", keywords: "excel balance n n-1" },
  { id: "act-declare-holiday", label: "Déclarer un jour férié", group: "Actions", to: "/app/obligations", hint: "Calendrier légal", keywords: "aid prorogation echeance" },
  { id: "act-generate-is", label: "Générer la déclaration IS", group: "Actions", to: "/app/fiscalite", hint: "Fiscalité", keywords: "impot benefices" },
];

/** Toutes les commandes fixes du produit. */
export const STATIC_COMMANDS: Command[] = [...NAV_COMMANDS, ...ACTION_COMMANDS];
