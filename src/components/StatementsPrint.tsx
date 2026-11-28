// ============================================================================
// FIMAAC — Document imprimable des états financiers (P1)
//
// Montants issus EXCLUSIVEMENT de `buildStatements` (source unique P0-1) :
// ce que le client reçoit sur papier est exactement ce que le moteur calcule,
// poste par poste, avec le contrôle d'équilibre affiché.
// ============================================================================
import { fcfa, formatDate } from "../lib/format";
import type { LiasseStatements } from "../lib/liasse";
import type { Company } from "../lib/types";

interface Props {
  company: Company;
  stmt: LiasseStatements;
  checks?: { ok: boolean; label: string }[];
}

export function PrintLine({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  if (!value && !bold) return null;
  return (
    <tr className={bold ? "font-bold" : undefined}>
      <td className="border-b border-slate-200 py-1 pr-3">{label}</td>
      <td className="border-b border-slate-200 py-1 text-right tabular-nums">
        {value < 0 ? `(${fcfa(Math.abs(value))})` : fcfa(value)}
      </td>
    </tr>
  );
}

export default function StatementsPrint({ company, stmt, checks = [] }: Props) {
  const b = stmt.bilan;
  const ecart = b.actifTotal - b.passifTotal;
  const exercice = new Date().getFullYear();

  return (
    <div className="mx-auto max-w-[820px] bg-white p-8 text-[12px] leading-snug text-black">
      {/* En-tête du document */}
      <div className="mb-4 border-b-2 border-black pb-3">
        <h1 className="text-[18px] font-black uppercase">États financiers — exercice {exercice}</h1>
        <p className="mt-1 text-[13px] font-semibold">{company.tradeName || company.name}</p>
        <p className="text-[11px] text-slate-700">
          {company.legalForm} · NIF {company.nif || "—"} · RCCM {company.rccm || "—"} · {company.city || "—"}
        </p>
        <p className="text-[11px] text-slate-700">Montants en francs CFA (XOF) · référentiel SYSCOHADA révisé</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* ACTIF */}
        <div>
          <h2 className="mb-2 border-b border-black pb-1 text-[13px] font-black uppercase">Actif</h2>
          <table className="w-full">
            <tbody>
              <PrintLine label="Immobilisations brutes" value={b.immoBrut} />
              <PrintLine label="Amortissements" value={-b.amort} />
              <PrintLine label="Immobilisations nettes" value={b.immoNet} bold />
              <PrintLine label="Stocks bruts" value={b.stocksBrut} />
              <PrintLine label="Dépréciations des stocks" value={-b.deprecStocks} />
              <PrintLine label="Créances clients" value={b.creancesClients} />
              <PrintLine label="Créances sur l'État" value={b.creancesEtat} />
              <PrintLine label="Créances sociales et fiscales" value={b.creancesFiscalesSociales} />
              <PrintLine label="Dépréciations des créances" value={-b.deprecTiers} />
              <PrintLine label="Trésorerie" value={b.tresorerie} />
              <PrintLine label="TOTAL ACTIF" value={b.actifTotal} bold />
            </tbody>
          </table>
        </div>

        {/* PASSIF */}
        <div>
          <h2 className="mb-2 border-b border-black pb-1 text-[13px] font-black uppercase">Passif</h2>
          <table className="w-full">
            <tbody>
              <PrintLine label="Capitaux propres (hors report)" value={b.capitauxHorsReport} />
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
        </div>
      </div>

      {/* Compte de résultat */}
      <div className="mt-6">
        <h2 className="mb-2 border-b border-black pb-1 text-[13px] font-black uppercase">Compte de résultat</h2>
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
      </div>

      {/* Contrôles et mentions */}
      <div className="mt-6 border-t border-slate-300 pt-3 text-[10px] text-slate-700">
        <p>
          <strong>Contrôle d'équilibre :</strong>{" "}
          {ecart === 0 ? "actif = passif (écart nul)." : `écart de ${fcfa(ecart)} entre l'actif et le passif — document non publiable en l'état.`}
        </p>
        <p>
          <strong>Total balance :</strong> Σ débits {fcfa(stmt.totals.debit)} = Σ crédits {fcfa(stmt.totals.credit)}
          {stmt.nonMappes.length === 0 ? " · tous les comptes sont rattachés à un poste." : ` · ${stmt.nonMappes.length} compte(s) non rattaché(s).`}
        </p>
        {checks.length > 0 && (
          <p>
            <strong>Contrôles :</strong> {checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.label}`).join(" · ")}
          </p>
        )}
        <p className="mt-2">
          Édité le {formatDate(new Date().toISOString())} par FIMAAC · document de travail, à faire valider par un professionnel avant dépôt.
        </p>
      </div>
    </div>
  );
}
