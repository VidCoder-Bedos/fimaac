import type { JournalEntry, TaxRuleRef } from "./types";
import { financialSummary } from "./accounting";
import { fcfa } from "./format";

export interface AIResponse {
  content: string;
  sources: string[];
  verified: boolean;
  agent: string;
}

export interface AIContext {
  entries: JournalEntry[];
  companyName: string;
  overdueDeadlines: number;
  unreconciledTx: number;
  openIssues: number;
  taxRules: TaxRuleRef[];
}

export const AGENTS = [
  { id: "assistant", name: "Assistant FIMAAC", icon: "🤖", desc: "Aide générale du cabinet" },
  { id: "accountant", name: "AI Accountant", icon: "📊", desc: "Analyse les opérations comptables" },
  { id: "tax", name: "AI Tax", icon: "🧾", desc: "Explique les règles fiscales" },
  { id: "auditor", name: "AI Auditor", icon: "🔍", desc: "Détecte les anomalies" },
  { id: "reporting", name: "AI Reporting", icon: "📈", desc: "Analyse les états financiers" },
  { id: "document", name: "AI Document", icon: "📄", desc: "Analyse les pièces" },
];

export function aiRespond(agent: string, message: string, ctx: AIContext): AIResponse {
  const m = message.toLowerCase();
  const sum = financialSummary(ctx.entries);

  // Regulatory questions → ALWAYS flag unverifiable
  if (/(taux|article|loi|code|imp[oô]t|ohada|syscohada|r[eé]glement|r[eé]gime|cnss|bar[eè]me)/i.test(m)) {
    const matching = ctx.taxRules.find((r) => m.includes(r.code.toLowerCase()));
    if (matching) {
      return {
        agent,
        verified: false,
        sources: [matching.source, "Office Togolais des Recettes (OTR)", "Textes OHADA / AUDCIF"],
        content:
          `Règle « ${matching.name} » — taux paramétré à ${matching.rate} %.\n\n` +
          `⚠️ Information non vérifiée. Ce taux est une valeur indicative et paramétrable. ` +
          `Avant toute utilisation officielle, il doit être validé contre le texte en vigueur (${matching.source}) ` +
          `dans le Regulatory Engine de FIMAAC (source → version → date d'effet → validation humaine).\n\n` +
          `Le moteur n'applique jamais une règle non vérifiée sans avertissement explicite.`,
      };
    }
    return {
      agent,
      verified: false,
      sources: ["Office Togolais des Recettes (OTR)", "Code général des impôts", "Textes OHADA / AUDCIF"],
      content:
        "Je ne peux pas publier une règle fiscale sans source vérifiée. " +
        "Règle de sécurité FIMAAC : l'IA n'invente jamais un taux, un article ou une obligation.\n\n" +
        "Procédure : SOURCE → EXTRACTION → ANALYSE → STRUCTURATION → TESTS → VALIDATION HUMAINE → PUBLICATION. " +
        "Souhaitez-vous que je prépare une fiche à valider dans le Regulatory Engine ?",
    };
  }

  // Anomalies / audit
  if (/(anomal|audit|r[io]que|incoh[eé]rent|v[eé]rifie|rapproche)/i.test(m) || agent === "auditor") {
    const items: string[] = [];
    if (ctx.overdueDeadlines > 0) items.push(`• ${ctx.overdueDeadlines} échéance(s) fiscale(s) en retard`);
    if (ctx.unreconciledTx > 0) items.push(`• ${ctx.unreconciledTx} transaction(s) bancaire(s) non rapprochée(s)`);
    if (ctx.openIssues > 0) items.push(`• ${ctx.openIssues} anomalie(s) de conformité ouverte(s)`);
    if (items.length === 0) items.push("• Aucune anomalie critique détectée sur les données actuelles.");
    return {
      agent,
      verified: true,
      sources: ["Grand livre", "Balance", "Échéancier fiscal", "Module banque"],
      content:
        `Audit de ${ctx.companyName} :\n\n${items.join("\n")}\n\n` +
        `Pour chaque anomalie, FIMAAC fournit : ANOMALIE → EXPLICATION → NIVEAU DE RISQUE → DONNÉES À L'ORIGINE → ACTION RECOMMANDÉE.`,
    };
  }

  // Reporting / result
  if (/(r[eé]sultat|chiffre|produit|charge|b[eé]n[eé]fice|perte|tr[eé]sorerie|bilan|reporting)/i.test(m) || agent === "reporting") {
    return {
      agent,
      verified: true,
      sources: ["Balance générale", "Comptes de classe 6 & 7"],
      content:
        `Synthèse financière de ${ctx.companyName} :\n\n` +
        `• Produits (classe 7) : ${fcfa(sum.produits)}\n` +
        `• Charges (classe 6) : ${fcfa(sum.charges)}\n` +
        `• Résultat de l'exercice : ${fcfa(sum.resultat)}\n` +
        `• Trésorerie (classe 5) : ${fcfa(sum.tresorerie)}\n` +
        `• Créances clients (411) : ${fcfa(sum.creances)}\n` +
        `• Dettes fournisseurs (401) : ${fcfa(sum.dettes)}\n\n` +
        `Tout montant est traçable jusqu'aux écritures sources (« Voir la source »).`,
    };
  }

  // Tax computation
  if (/(tva|is |imp[oô]t|d[eé]clar|fiscal)/i.test(m) || agent === "tax") {
    const tva = ctx.taxRules.find((r) => r.code === "TVA");
    return {
      agent,
      verified: tva?.verified ?? false,
      sources: ["Mouvements comptes 443 / 445", tva?.source || "OTR"],
      content:
        `Calcul de la TVA pour ${ctx.companyName} :\n\n` +
        `TVA nette = TVA collectée (compte 443) − TVA récupérable (compte 445).\n\n` +
        `Chaque calcul répond : montant ? base ? règle ? version ? source ? période ? conditions ?\n\n` +
        `⚠️ Les taux sont paramétrables et doivent être vérifiés dans le Regulatory Engine avant tout dépôt officiel (procédure GUDEF/OTR).`,
    };
  }

  // Accounting general
  if (agent === "accountant" || /(compta|[eé]criture|balance|journal|d[eé]bit|cr[eé]dit|compte)/i.test(m)) {
    return {
      agent,
      verified: true,
      sources: ["Référentiel SYSCOHADA révisé", "Journal des écritures"],
      content:
        `Analyse comptable de ${ctx.companyName} :\n\n` +
        `• Règle absolue : total débit = total crédit. Aucune écriture déséquilibrée ne peut être validée.\n` +
        `• Workflow : Brouillon → En revue → Validée / Rejetée / Annulée.\n` +
        `• Une écriture validée se corrige par contrepassation avec audit trail (jamais de suppression silencieuse).\n\n` +
        `Référentiel : SYSCOHADA révisé (OHADA).`,
    };
  }

  // Default
  return {
    agent,
    verified: true,
    sources: ["Base FIMAAC"],
    content:
      `Bonjour — Je suis l'assistant FIMAAC pour ${ctx.companyName}.\n\n` +
      `Je peux vous aider à : analyser un résultat, expliquer la TVA, détecter des anomalies, ou préparer une information réglementaire (toujours signalée « à vérifier »).\n\n` +
      `Astuce : sélectionnez un agent spécialisé (AI Accountant, AI Tax, AI Auditor…) pour une analyse ciblée.`,
  };
}
