// ============================================================================
// FIMAAC — Liasse fiscale imprimable (modèle GUDEF, P1)
//
// Le classeur XLSX existait déjà ; il manquait le document qu'un cabinet
// remet signé à son client. Ce composant produit la liasse sur papier :
// page de garde, bilan actif/passif, compte de résultat, contrôles de
// cohérence. Tous les montants viennent de `buildStatements` (source unique).
// ============================================================================
import { fcfa, formatDate } from "../lib/format";
import { PrintLine } from "./StatementsPrint";
import type { CoherenceCheck, LiasseStatements } from "../lib/liasse";
import type { Company } from "../lib/types";

interface Props {
  company: Company;
  stmt: LiasseStatements;
  checks: CoherenceCheck[];
  exercise: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 break-inside-avoid">
      <h2 className="mb-2 border-b-2 border-black pb-1 text-[12.5px] font-black uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function CheckBadge({ status }: { status: CoherenceCheck["status"] }) {
  const label = status === "ok" ? "Conforme" : status === "warning" ? "Avertissement" : "BLOQUANT";
  return <span className="border border-black px-1.5 py-[1px] text-[9px] font-bold uppercase">{label}</span>;
}

export default function LiassePrint({ company, stmt, checks, exercise }: Props) {
  const b = stmt.bilan;
  const blocking = checks.filter((c) => c.status === "blocking").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  const ecart = b.actifTotal - b.passifTotal;

  return (
    <div className="mx-auto max-w-[820px] bg-white p-8 text-[11.5px] leading-snug text-black">
      {/* ---------- Page de garde ---------- */}
      <div className="mb-6 border-2 border-black p-5">
        <p className="text-[10px] uppercase tracking-widest">République togolaise · Office togolais des recettes</p>
        <h1 className="mt-2 text-[19px] font-black uppercase leading-tight">
          Liasse fiscale — exercice {exercise}
        </h1>
        <p className="mt-1 text-[12px] font-semibold">Modèle GUDEF · référentiel SYSCOHADA révisé</p>

        <table className="mt-4 w-full text-[11px]">
          <tbody>
            <tr><td className="w-1/3 py-0.5 font-semibold">Raison sociale</td><td className="py-0.5">{company.name}</td></tr>
            <tr><td className="py-0.5 font-semibold">Nom commercial</td><td className="py-0.5">{company.tradeName || "—"}</td></tr>
            <tr><td className="py-0.5 font-semibold">Forme juridique</td><td className="py-0.5">{company.legalForm}</td></tr>
            <tr><td className="py-0.5 font-semibold">NIF</td><td className="py-0.5">{company.nif || "—"}</td></tr>
            <tr><td className="py-0.5 font-semibold">RCCM</td><td className="py-0.5">{company.rccm || "—"}</td></tr>
            <tr><td className="py-0.5 font-semibold">Siège</td><td className="py-0.5">{company.address || "—"}{company.city ? ` · ${company.city}` : ""}</td></tr>
            <tr><td className="py-0.5 font-semibold">Régime fiscal</td><td className="py-0.5">{company.taxRegime} · TVA {company.vatPayer ? "assujetti" : "non assujetti"}</td></tr>
            <tr><td className="py-0.5 font-semibold">Devise</td><td className="py-0.5">Franc CFA (XOF)</td></tr>
          </tbody>
        </table>
      </div>

      {/* ---------- Bilan ---------- */}
      <Section title="Bilan — actif">
        <table className="w-full">
          <tbody>
            <PrintLine label="Immobilisations brutes" value={b.immoBrut} />
            <PrintLine label="Amortissements" value={-b.amort} />
            <PrintLine label="Immobilisations nettes" value={b.immoNet} bold />
            <PrintLine label="Stocks bruts" value={b.stocksBrut} />
            <PrintLine label="Dépréciations des stocks" value={-b.deprecStocks} />
            <PrintLine label="Créances clients" value={b.creancesClients} />
            <PrintLine label="Créances sur l'État" value={b.creancesEtat} />
            <PrintLine label="Dépréciations des créances" value={-b.deprecTiers} />
            <PrintLine label="Trésorerie" value={b.tresorerie} />
            <PrintLine label="TOTAL ACTIF" value={b.actifTotal} bold />
          </tbody>
        </table>
      </Section>

      <Section title="Bilan — passif">
        <table className="w-full">
          <tbody>
            <PrintLine label="Capitaux propres (hors report à nouveau)" value={b.capitauxHorsReport} />
            <PrintLine label="Report à nouveau" value={b.reportANouveau} />
            <PrintLine label="Résultat de l'exercice" value={b.resultat} />
            <PrintLine label="Dettes financières" value={b.dettesFin} />
            <PrintLine label="Dettes fournisseurs" value={b.dettesFourn} />
            <PrintLine label="Dettes fiscales et sociales" value={b.dettesFiscalesSociales} />
            <PrintLine label="Autres dettes" value={b.autresDettes} />
            <PrintLine label="Trésorerie passif" value={b.tresoPassif} />
            <PrintLine label="TOTAL PASSIF" value={b.passifTotal} bold />
          </tbody>
        </table>
      </Section>

      {/* ---------- Compte de résultat ---------- */}
      <Section title="Compte de résultat">
        <table className="w-full">
          <tbody>
            <PrintLine label="Produits d'exploitation" value={stmt.result.produits - stmt.result.produitsHAO} />
            <PrintLine label="Produits hors activités ordinaires" value={stmt.result.produitsHAO} />
            <PrintLine label="Total des produits (classe 7)" value={stmt.result.produits} bold />
            <PrintLine label="Charges d'exploitation" value={-(stmt.result.charges - stmt.result.chargesHAO)} />
            <PrintLine label="Charges hors activités ordinaires" value={-stmt.result.chargesHAO} />
            <PrintLine label="Total des charges (classe 6)" value={-stmt.result.charges} bold />
            <PrintLine label="RÉSULTAT DE L'EXERCICE" value={stmt.result.resultat} bold />
          </tbody>
        </table>
      </Section>

      {/* ---------- Contrôles ---------- */}
      <Section title="Contrôles de cohérence">
        <table className="w-full text-[10.5px]">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1 pr-2">Contrôle</th>
              <th className="py-1 pr-2">Feuille</th>
              <th className="py-1 pr-2 text-right">Attendu</th>
              <th className="py-1 pr-2 text-right">Constaté</th>
              <th className="py-1 pr-2 text-right">Écart</th>
              <th className="py-1">Statut</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id} className="border-b border-slate-200 align-top">
                <td className="py-1 pr-2">
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-[9.5px] text-slate-600">{c.detail}</p>
                </td>
                <td className="py-1 pr-2">{c.sheet}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{fcfa(c.expected)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{fcfa(c.actual)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{fcfa(c.diff)}</td>
                <td className="py-1"><CheckBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ---------- Mentions ---------- */}
      <div className="mt-6 border-t border-slate-400 pt-3 text-[10px] text-slate-700">
        <p>
          <strong>Équilibre du bilan :</strong>{" "}
          {ecart === 0
            ? `actif = passif = ${fcfa(b.actifTotal)}.`
            : `écart de ${fcfa(ecart)} — liasse NON déposable en l'état.`}
        </p>
        <p>
          <strong>Contrôles :</strong> {checks.length} contrôle(s) · {blocking} bloquant(s) · {warnings} avertissement(s) ·{" "}
          {stmt.nonMappes.length === 0 ? "tous les comptes sont rattachés à un poste." : `${stmt.nonMappes.length} compte(s) non rattaché(s) : ${stmt.nonMappes.map((n) => n.code).join(", ")}.`}
        </p>
        <p>
          <strong>Balance :</strong> Σ débits {fcfa(stmt.totals.debit)} · Σ crédits {fcfa(stmt.totals.credit)}.
        </p>
        <p className="mt-2">
          Édité le {formatDate(new Date().toISOString())} par FIMAAC. Document de travail : à faire viser par un
          professionnel habilité avant tout dépôt auprès de l'administration fiscale.
        </p>
      </div>
    </div>
  );
}
