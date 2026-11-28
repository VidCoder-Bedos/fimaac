import { useEffect, useState } from "react";
import { Download, Printer, Building2, ArrowLeftRight } from "lucide-react";
import { Modal, Button, Badge, Select } from "./ui";
import { accountSituation } from "../lib/accounting";
import { fcfa, formatDate } from "../lib/format";
import type { Account, JournalEntry, ThirdParty } from "../lib/types";

function downloadCSV(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function AccountInquiry({
  open, onClose, accountCode: initialCode, tierId: initialTier,
  entries, accounts, journals, tiers, companyName,
}: {
  open: boolean;
  onClose: () => void;
  accountCode?: string;
  tierId?: string;
  entries: JournalEntry[];
  accounts: Account[];
  journals: { id: string; code: string }[];
  tiers: ThirdParty[];
  companyName: string;
}) {
  const [code, setCode] = useState(initialCode || "");
  const [tierId, setTierId] = useState(initialTier || "");
  useEffect(() => { setCode(initialCode || ""); setTierId(initialTier || ""); }, [initialCode, initialTier, open]);
  const acc = accounts.find((a) => a.code === code);
  const tierList = tiers.filter((t) => t.collective === code);
  const sit = accountSituation(entries, code, journals, tierId || undefined);

  const exportCsv = () => downloadCSV(`compte_${code}_${companyName}.csv`, [
    ["Date", "Journal", "Pièce", "Libellé", "Débit", "Crédit", "Solde"],
    ...sit.lines.map((l) => [formatDate(l.date), l.journalCode, l.number, l.label, l.debit, l.credit, l.solde]),
    ["", "", "", "TOTAUX", sit.totalDebit, sit.totalCredit, sit.solde],
  ]);

  return (
    <Modal open={open} onClose={onClose} title={`Consultation du compte ${code} — ${acc?.label || ""}`} size="xl">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={acc?.normalBalance === "debit" ? "sky" : "emerald"}>{acc?.normalBalance === "debit" ? "Solde débiteur" : "Solde créditeur"}</Badge>
        {tierList.length > 0 && (
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={14} className="text-slate-500" />
            <Select value={tierId} onChange={(e) => setTierId(e.target.value)} className="h-8 w-56 text-xs">
              <option value="">Tous les tiers ({tierList.length})</option>
              {tierList.map((t) => <option key={t.id} value={t.id}>{t.code} · {t.name}</option>)}
            </Select>
          </div>
        )}
        <span className="ml-auto text-xs text-slate-500">{companyName}</span>
        <Button size="sm" variant="outline" onClick={exportCsv}><Download size={14} /> Exporter</Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer size={14} /> Imprimer</Button>
      </div>

      {/* Situation card */}
      <div className="mb-3 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><p className="text-xs text-slate-500">Total débit</p><p className="font-display text-lg font-bold text-slate-800">{fcfa(sit.totalDebit)}</p></div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><p className="text-xs text-slate-500">Total crédit</p><p className="font-display text-lg font-bold text-slate-800">{fcfa(sit.totalCredit)}</p></div>
        <div className="rounded-xl border border-slate-100 bg-indigo-50/60 p-3"><p className="text-xs text-slate-500">Solde ({acc?.normalBalance === "debit" ? "débiteur" : "créditeur"})</p><p className="font-display text-lg font-bold text-indigo-600">{fcfa(sit.solde)}</p></div>
      </div>

      {/* Table */}
      <div className="max-h-[48vh] overflow-auto rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Jnl</th><th className="px-3 py-2 text-left">Pièce</th><th className="px-3 py-2 text-left">Libellé</th>
              <th className="px-3 py-2 text-right">Débit</th><th className="px-3 py-2 text-right">Crédit</th><th className="px-3 py-2 text-right">Solde</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 bg-amber-50/40 text-xs italic text-slate-500"><td colSpan={4} className="px-3 py-1.5">Solde à nouveau (ouverture)</td><td className="px-3 py-1.5 text-right">{fcfa(sit.openingDebit)}</td><td className="px-3 py-1.5 text-right">{fcfa(sit.openingCredit)}</td><td className="px-3 py-1.5 text-right">{fcfa(sit.openingDebit - sit.openingCredit)}</td></tr>
            {sit.lines.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500"><Building2 className="mx-auto mb-2 text-slate-500" size={24} /> Aucun mouvement sur ce compte</td></tr>}
            {sit.lines.map((l) => (
              <tr key={l.entryId + l.number + l.label} className="border-b border-slate-50 hover:bg-indigo-50/40">
                <td className="px-3 py-1.5 text-slate-500">{formatDate(l.date)}</td>
                <td className="px-2 py-1.5"><Badge tone="slate">{l.journalCode}</Badge></td>
                <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{l.number}</td>
                <td className="px-3 py-1.5 text-slate-700">{l.label}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{l.debit ? fcfa(l.debit) : "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{l.credit ? fcfa(l.credit) : "—"}</td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums text-slate-700">{fcfa(l.solde)}</td>
              </tr>
            ))}
            <tr className="sticky bottom-0 bg-slate-800 font-bold text-white">
              <td colSpan={4} className="px-3 py-2.5">TOTAUX — {sit.lines.length} mouvement(s)</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fcfa(sit.totalDebit)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{fcfa(sit.totalCredit)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-amber-300">{fcfa(sit.solde)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">Double-cliquez un compte dans la balance ou le plan pour ouvrir cette fenêtre. Solde à nouveau = 0 (ouvertures non gérées dans cette démo).</p>
    </Modal>
  );
}
