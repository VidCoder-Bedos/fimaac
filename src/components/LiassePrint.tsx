// ============================================================================
// FIMAAC — Liasse fiscale imprimable (modèle GUDEF, P1)
//
// Le classeur XLSX existait déjà ; il manquait le document qu'un cabinet
// remet signé à son client. Ce composant produit la liasse sur papier :
// page de garde, bilan actif/passif, compte de résultat, contrôles de
// cohérence. Tous les montants viennent de `buildStatements` (source unique).
// ============================================================================
import { Fragment } from "react";
import { fcfa, formatDate } from "../lib/format";
import { PrintLine } from "./StatementsPrint";
import type { CoherenceCheck, LiasseStatements } from "../lib/liasse";
import type { Tafire } from "../lib/tafire";
<<<<<<< HEAD
import type { NotesAnnex } from "../lib/notesAnnex";
=======
>>>>>>> origin/main
import type { Company } from "../lib/types";

interface Props {
  company: Company;
  stmt: LiasseStatements;
  checks: CoherenceCheck[];
  exercise: string;
  /** TAFIRE calculé depuis les balances N-1 et N (null = non calculé). */
  tafire?: Tafire | null;
<<<<<<< HEAD
  /** Notes annexes calculées depuis la balance (null = non calculé). */
  annex?: NotesAnnex | null;
=======
>>>>>>> origin/main
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

<<<<<<< HEAD
export default function LiassePrint({ company, stmt, checks, exercise, tafire, annex }: Props) {
=======
export default function LiassePrint({ company, stmt, checks, exercise, tafire }: Props) {
>>>>>>> origin/main
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

      {/* ---------- TAFIRE ---------- */}
      {tafire && (
        <Section title="Tableau des flux de trésorerie (TAFIRE)">
          {!tafire.available ? (
            <div className="border border-black p-3">
              <p className="font-bold">TAFIRE non calculable</p>
              <p className="mt-1 text-[10.5px]">{tafire.reason}</p>
              <p className="mt-2">Trésorerie de clôture constatée : <strong>{fcfa(tafire.tresorerieCloture)}</strong></p>
            </div>
          ) : (
            <>
              <table className="w-full text-[10.5px]">
                <tbody>
                  <PrintLine label="Trésorerie d'ouverture" value={tafire.tresorerieOuverture} bold />
                  {tafire.zones.map((z) => (
                    <Fragment key={z.id}>
                      <tr key={z.id} className="border-b border-black">
                        <td colSpan={2} className="pt-2 pb-0.5 font-black uppercase tracking-wide">{z.label}</td>
                      </tr>
                      {z.fluxes.map((f) => (
                        <tr key={f.label}>
                          <td className="pl-3 pr-2 py-[2px]">{f.label}</td>
                          <td className="py-[2px] text-right tabular-nums">{fcfa(f.amount)}</td>
                        </tr>
                      ))}
                      <tr key={`${z.id}-total`} className="border-t border-slate-400">
                        <td className="pl-3 pr-2 py-[2px] font-bold">Total de la zone</td>
                        <td className="py-[2px] text-right font-bold tabular-nums">{fcfa(z.total)}</td>
                      </tr>
                    </Fragment>
                  ))}
                  <PrintLine label="Trésorerie de clôture (calculée)" value={tafire.tresorerieCalculee} bold />
                  <PrintLine label="Trésorerie de clôture (balance)" value={tafire.tresorerieCloture} />
                  {tafire.ecart !== 0 && <PrintLine label="Écart de bouclage" value={tafire.ecart} bold />}
                </tbody>
              </table>
              <p className="mt-2 text-[9.5px] text-slate-700">
                {tafire.ecart === 0
                  ? "Bouclage vérifié : trésorerie d'ouverture + flux = trésorerie de clôture."
                  : `Bouclage rompu (écart ${fcfa(tafire.ecart)}) : tableau à corriger avant dépôt.`}
                {" "}CAFG {fcfa(tafire.cafg)} · variation du BFR {fcfa(tafire.variationBfr)}. Investissements présentés nets des cessions faute de prix de cession dans la balance.
              </p>
            </>
          )}
        </Section>
      )}

<<<<<<< HEAD
      {/* ---------- Notes annexes ---------- */}
      {annex && (
        <Section title="Notes annexes">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1 pr-1">Réf.</th>
                <th className="py-1 pr-1">Intitulé</th>
                <th className="py-1 pr-1 text-right">N</th>
                <th className="py-1 pr-1 text-right">N-1</th>
                <th className="py-1 pr-1 text-right">Variation</th>
                <th className="py-1">Statut</th>
              </tr>
            </thead>
            <tbody>
              {annex.notes.map((n) => (
                <tr key={n.code} className="border-b border-slate-200">
                  <td className="py-[2px] pr-1 font-mono">{n.code.replace("NOTE_", "")}</td>
                  <td className="py-[2px] pr-1">{n.title}</td>
                  <td className="py-[2px] pr-1 text-right tabular-nums">{n.totalN === null ? "—" : fcfa(n.totalN)}</td>
                  <td className="py-[2px] pr-1 text-right tabular-nums">{n.totalN1 === null ? "—" : fcfa(n.totalN1)}</td>
                  <td className="py-[2px] pr-1 text-right tabular-nums">{n.variation === null ? "—" : fcfa(n.variation)}</td>
                  <td className="py-[2px]">{n.status === "calculated" ? "Calculée" : "À confirmer"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {annex.manualNotes.length > 0 && (
            <p className="mt-2 text-[9.5px]">
              <strong>{annex.manualNotes.length} note(s) à compléter à la main :</strong>{" "}
              {annex.manualNotes.map((n) => n.code.replace("NOTE_", "")).join(", ")}. Aucune valeur n'est remplacée par 0 :
              une donnée absente s'imprime « — ».
            </p>
          )}
          <p className="mt-1 text-[9.5px] text-slate-700">
            {annex.computedCount} note(s) calculée(s) sur {annex.registryCount} au référentiel · {annex.undeterminedCells} valeur(s) indéterminée(s).
            Un total de note est la somme de ses lignes, pas un poste du bilan.
          </p>
        </Section>
      )}

=======
>>>>>>> origin/main
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
