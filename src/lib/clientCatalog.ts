// FIMAAC — Catalogue des demandes client (formalités, actes, services)
// Chaque acte définit un schéma de champs dynamiques (formulaire adaptatif).
export type FieldType = "text" | "number" | "year" | "date" | "select" | "textarea" | "amount";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  half?: boolean; // moitié de largeur
}

export interface ActeDef {
  id: string;
  family: string;
  label: string;
  icon: string;
  desc: string;
  fields: FieldDef[];
}

/** Tonalités de badge disponibles dans le design system (évite un import croisé UI). */
export type BadgeToneName = "indigo" | "emerald" | "amber" | "rose" | "sky" | "slate" | "violet";

export const FAMILIES: { id: string; label: string; icon: string }[] = [
  { id: "cartes", label: "Cartes & Immatriculation", icon: "🪪" },
  { id: "attestations", label: "Attestations fiscales", icon: "📜" },
  { id: "quitus", label: "Quitus & Visa", icon: "✅" },
  { id: "marches", label: "Marchés publics & Appels d'offres", icon: "🏛️" },
  { id: "transfert", label: "Transfert de fonds", icon: "🏦" },
  { id: "formalites", label: "Autres formalités administratives", icon: "🗂️" },
  { id: "comptable", label: "Services comptables & fiscaux", icon: "📊" },
  { id: "documents", label: "Documents & Rendez-vous", icon: "📅" },
];

const Y = (n: number): FieldDef[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `annee${i + 1}`,
    label: `Année ${i + 1}`,
    type: "year" as FieldType,
    required: true,
    half: true,
    placeholder: "2026",
  }));

const BANKS: FieldDef[] = [
  { key: "banque1", label: "Banque 1", type: "text", required: true, half: true, placeholder: "Ecobank" },
  { key: "compte1", label: "N° de compte 1", type: "text", required: true, half: true },
  { key: "banque2", label: "Banque 2", type: "text", half: true, placeholder: "Orabank" },
  { key: "compte2", label: "N° de compte 2", type: "text", half: true },
  { key: "banque3", label: "Banque 3", type: "text", half: true, placeholder: "UTB" },
  { key: "compte3", label: "N° de compte 3", type: "text", half: true },
  { key: "montant", label: "Montant (FCFA)", type: "amount", required: true, half: true, placeholder: "5000000" },
  { key: "objet", label: "Objet du transfert", type: "text", required: true, half: true },
];

export const ACTES: ActeDef[] = [
  // A — Cartes & immatriculation
  { id: "cif", family: "cartes", label: "Carte d'immatriculation fiscale (CIF)", icon: "🪪", desc: "Carte CIF — précisez les années", fields: Y(2) },
  { id: "cfe", family: "cartes", label: "Renouvellement carte CFE", icon: "🏷️", desc: "Cotisation foncière des entreprises", fields: [{ key: "annee", label: "Année", type: "year", required: true, half: true, placeholder: "2026" }] },
  // B — Attestations fiscales
  { id: "domiciliation", family: "attestations", label: "Attestation de domiciliation fiscale", icon: "🏠", desc: "Justificatif de domiciliation fiscale", fields: [{ key: "annee", label: "Année", type: "year", required: true, half: true, placeholder: "2026" }] },
  { id: "regularite", family: "attestations", label: "Attestation de régularité fiscale", icon: "📜", desc: "Usage : appel d'offres, transfert de fonds, autres", fields: [{ key: "usage", label: "Usage", type: "select", required: true, options: ["Appel d'offres", "Transfert de fonds", "Commandes publiques", "Autres"] }, { key: "annee", label: "Année", type: "year", required: true, half: true, placeholder: "2026" }] },
  { id: "non_imposition", family: "attestations", label: "Attestation de non-imposition", icon: "📃", desc: "Atteste l'absence d'imposition", fields: [{ key: "annee", label: "Année", type: "year", required: true, half: true, placeholder: "2026" }] },
  { id: "certificat_imposition", family: "attestations", label: "Certificat d'imposition", icon: "🧾", desc: "Précisez jusqu'à 3 années", fields: Y(3) },
  // C — Quitus & visa
  { id: "quitus", family: "quitus", label: "Quitus fiscal", icon: "✅", desc: "Précisez les années", fields: Y(2) },
  { id: "visa", family: "quitus", label: "Visa (commandes publiques / appel d'offres)", icon: "🔖", desc: "Visa administratif", fields: [{ key: "usage", label: "Usage", type: "select", required: true, options: ["Commandes publiques", "Appel d'offres", "Autres"] }, { key: "reference", label: "Référence du document", type: "text", placeholder: "N° marché" }] },
  // D — Marchés publics & appels d'offres
  { id: "appel_offres", family: "marches", label: "Appel d'offres", icon: "📣", desc: "Participation à un appel d'offres", fields: [{ key: "objet", label: "Objet du marché", type: "text", required: true }, { key: "usage", label: "Type de document requis", type: "select", options: ["Visa", "Attestation de régularité fiscale", "Quitus fiscal", "Autres"] }] },
  { id: "commandes_publiques", family: "marches", label: "Commandes publiques", icon: "🏛️", desc: "Marché / commande publique", fields: [{ key: "objet", label: "Objet", type: "text", required: true }, { key: "visa", label: "Visa requis ?", type: "select", options: ["Oui", "Non"], half: true }] },
  // E — Transfert de fonds
  { id: "transfert_fonds", family: "transfert", label: "Transfert de fonds", icon: "🏦", desc: "Transfert — banques et comptes", fields: BANKS },
  // F — Autres formalités
  { id: "autres_formalites", family: "formalites", label: "Autres formalités administratives", icon: "🗂️", desc: "Décrivez la formalité souhaitée", fields: [{ key: "description", label: "Description de la formalité", type: "textarea", required: true }] },
  // G — Services comptables & fiscaux
  { id: "rapport_comptable", family: "comptable", label: "Rapport comptable", icon: "📊", desc: "Rapport comptable périodique", fields: [{ key: "type", label: "Type de rapport", type: "select", required: true, options: ["Balance", "Grand livre", "Compte de résultat", "Bilan"] }, { key: "periode", label: "Période / exercice", type: "text", required: true, placeholder: "2026" }] },
  { id: "rapport_fiscal", family: "comptable", label: "Rapport fiscal", icon: "🧾", desc: "TVA, IS, etc.", fields: [{ key: "type", label: "Type", type: "select", required: true, options: ["TVA", "IS / Acompte", "Retenues (TPA/TSPP)", "Autres"] }, { key: "exercice", label: "Exercice", type: "year", required: true, half: true, placeholder: "2026" }] },
  { id: "situation_fiscale", family: "comptable", label: "Situation fiscale", icon: "📈", desc: "Situation fiscale à jour", fields: [{ key: "exercice", label: "Exercice", type: "year", required: true, half: true, placeholder: "2026" }] },
  { id: "releve_echeances", family: "comptable", label: "Relevé / état des échéances", icon: "📅", desc: "Échéances à venir", fields: [{ key: "periode", label: "Période", type: "text", placeholder: "Trimestre 1" }] },
  { id: "diagnostic", family: "comptable", label: "Diagnostic / audit express", icon: "🔍", desc: "Revue comptable rapide", fields: [{ key: "objet", label: "Objet", type: "textarea", placeholder: "Précisez le périmètre" }] },
  // H — Documents & rendez-vous
  { id: "duplicata", family: "documents", label: "Duplicata de document(s)", icon: "📄", desc: "Copie de document", fields: [{ key: "type_doc", label: "Type de document", type: "select", required: true, options: ["Bulletin de paie", "Déclaration TVA", "Déclaration IS", "Facture", "Liasse fiscale", "Autres"] }, { key: "annee", label: "Année", type: "year", half: true, placeholder: "2026" }] },
  { id: "rdv", family: "documents", label: "Consultation / Rendez-vous", icon: "📅", desc: "Demander un rendez-vous", fields: [{ key: "date", label: "Date souhaitée", type: "date", required: true, half: true }, { key: "format", label: "Format", type: "select", options: ["Présentiel", "Visioconférence", "Téléphone"], half: true }, { key: "motif", label: "Motif", type: "textarea", required: true }] },
  { id: "conseil", family: "documents", label: "Conseil fiscal", icon: "💡", desc: "Accompagnement / conseil", fields: [{ key: "objet", label: "Objet", type: "textarea", required: true }] },
];

export function acteById(id: string): ActeDef | undefined {
  return ACTES.find((a) => a.id === id);
}

export const STATUS_LABELS: Record<string, { tone: BadgeToneName; label: string }> = {
  soumise: { tone: "amber", label: "Soumise" },
  prise_en_charge: { tone: "sky", label: "Prise en charge" },
  en_traitement: { tone: "violet", label: "En traitement" },
  livree: { tone: "emerald", label: "Livrée" },
  archivee: { tone: "slate", label: "Archivée" },
  rejetee: { tone: "rose", label: "Rejetée" },
};
