import { useEffect, useState } from "react";
import { Plus, Scale, Trash2 } from "lucide-react";
import { Modal, Button, Badge, Field, Input, Select } from "./ui";
import { addEntry, updateEntry } from "../lib/actions";
import { isEntryValidatable } from "../lib/accounting";
import { fcfa, parseFcfa } from "../lib/format";
import type { Account, Journal, JournalEntry, ThirdParty } from "../lib/types";

interface EditorLine { accountId: string; label: string; debit: string; credit: string; tierId: string }
const blankLine = (): EditorLine => ({ accountId: "", label: "", debit: "", credit: "", tierId: "" });
const STATUSES: { id: JournalEntry["status"]; label: string }[] = [
  { id: "draft", label: "Brouillon" },
  { id: "in_review", label: "En revue" },
  { id: "validated", label: "Validée" },
];

/**
 * Éditeur d'écriture comptable — création ET modification.
 * En mode modification, l'écriture existante est pré-chargée et le numéro
 * affiché (non modifiable) ; la validation contrôle l'équilibre et les
 * comptes imputables. La modification est tracée dans l'audit trail.
 */
export function EntryEditor({
  open, onClose, companyId, journals, accounts, tiers, entry,
}: {
  open: boolean;
  onClose: () => void;
  companyId: string;
  journals: Journal[];
  accounts: Account[];
  tiers: ThirdParty[];
  /** Présent = mode modification. */
  entry?: JournalEntry | null;
}) {
  const editing = Boolean(entry);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [journalId, setJournalId] = useState("");
  const [reference, setReference] = useState("");
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<JournalEntry["status"]>("draft");
  const [lines, setLines] = useState<EditorLine[]>([blankLine(), blankLine()]);
  const [error, setError] = useState<string | null>(null);

  // Pré-chargement en mode modification
  useEffect(() => {
    if (!open) return;
    if (entry) {
      setDate(entry.date);
      setJournalId(entry.journalId);
      setReference(entry.reference);
      setLabel(entry.label);
      setStatus(entry.status === "validated" || entry.status === "in_review" ? entry.status : "draft");
      setLines(entry.lines.map((l) => ({
        accountId: l.accountId,
        label: l.label,
        debit: l.debit ? String(l.debit) : "",
        credit: l.credit ? String(l.credit) : "",
        tierId: l.thirdPartyId || "",
      })));
    } else {
      setDate(today);
      setJournalId(journals[0]?.id || "");
      setReference("");
      setLabel("");
      setStatus("draft");
      setLines([blankLine(), blankLine()]);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  const totals = lines.reduce(
    (s, l) => ({ debit: s.debit + parseFcfa(l.debit), credit: s.credit + parseFcfa(l.credit) }),
    { debit: 0, credit: 0 },
  );
  const diff = totals.debit - totals.credit;
  const balanced = diff === 0 && totals.debit > 0;

  const setLine = (i: number, patch: Partial<EditorLine>) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const onAccount = (i: number, code: string) => {
    const a = accounts.find((x) => x.code === code);
    setLine(i, {
      accountId: code,
      label: a && !lines[i].label ? a.label : lines[i].label,
      tierId: code === "411" || code === "401" ? lines[i].tierId : "",
    });
  };

  /** Équilibre automatiquement la dernière ligne. */
  const equilibrate = () =>
    setLines((prev) => {
      if (prev.length < 2) return prev;
      const without = prev.slice(0, -1);
      const d = without.reduce((s, l) => s + parseFcfa(l.debit), 0);
      const c = without.reduce((s, l) => s + parseFcfa(l.credit), 0);
      const last = { ...prev[prev.length - 1] };
      if (d > c) { last.debit = String(d - c); last.credit = ""; }
      else if (c > d) { last.credit = String(c - d); last.debit = ""; }
      return [...prev.slice(0, -1), last];
    });

  /** Validation côté client (mêmes règles que le backend). */
  const validate = (): { ok: boolean; error?: string } => {
    if (!journalId) return { ok: false, error: "Sélectionnez un journal." };
    if (!label.trim()) return { ok: false, error: "Saisissez un libellé." };
    const clean = lines.filter((l) => l.accountId && (parseFcfa(l.debit) > 0 || parseFcfa(l.credit) > 0));
    if (clean.length < 2) return { ok: false, error: "Au moins deux lignes avec un compte et un montant." };
    const temp = {
      lines: clean.map((l) => ({
        id: "x", accountId: l.accountId, label: l.label || "—",
        debit: parseFcfa(l.debit), credit: parseFcfa(l.credit),
        taxCode: null, thirdPartyId: l.tierId || null, analytic: null,
      })),
    } as JournalEntry;
    const v = isEntryValidatable(temp, accounts);
    return { ok: v.ok, error: v.reason };
  };

  const save = () => {
    setError(null);
    // Validation stricte si l'écriture est validée (mêmes règles que le backend)
    if (status === "validated") {
      const v = validate();
      if (!v.ok) { setError(v.error || "Erreur"); return; }
    }
    const clean = lines.filter((l) => l.accountId && (parseFcfa(l.debit) > 0 || parseFcfa(l.credit) > 0));
    const payload = {
      date, journalId, reference, label,
      status: status as "draft" | "in_review" | "validated",
      lines: clean.map((l) => ({
        accountId: l.accountId, label: l.label || "—",
        debit: parseFcfa(l.debit), credit: parseFcfa(l.credit), tierId: l.tierId || null,
      })),
    };
    if (editing && entry) {
      const res = updateEntry(entry.id, payload);
      if (!res.ok) { setError(res.error || "Erreur"); return; }
    } else {
      // En création, une écriture non équilibrée ne peut être enregistrée qu'en brouillon
      const effective = balanced ? status : "draft";
      addEntry(companyId, { ...payload, status: effective as "draft" | "validated", attachmentDocIds: [] });
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={editing ? `Modifier l'écriture ${entry?.number}` : "Saisie d'écriture comptable"}
    >
      <div className="space-y-4">
        {editing && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <Scale size={14} className="mt-0.5 shrink-0" />
            <span>
              Modification tracée dans l'audit trail. Pour corriger une écriture déjà publiée,
              la contrepassation reste la voie recommandée (une écriture d'annulation est générée).
            </span>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Journal">
            <Select value={journalId} onChange={(e) => setJournalId(e.target.value)}>
              <option value="">—</option>
              {journals.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.name}</option>)}
            </Select>
          </Field>
          <Field label="Référence"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="FAC-001" /></Field>
          <Field label="Statut">
            <Select value={status} onChange={(e) => setStatus(e.target.value as JournalEntry["status"])}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Libellé"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé de l'écriture" /></Field>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold uppercase text-slate-400">
                <th className="px-2 py-2 text-left">Compte / Tiers</th>
                <th className="px-2 py-2 text-left">Libellé ligne</th>
                <th className="px-2 py-2 text-right min-w-[150px]">Débit</th>
                <th className="px-2 py-2 text-right min-w-[150px]">Crédit</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const isTier = l.accountId === "411" || l.accountId === "401";
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <Select value={l.accountId} onChange={(e) => onAccount(i, e.target.value)} className="h-9">
                        <option value="">—</option>
                        {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.label}</option>)}
                      </Select>
                      {isTier && (
                        <Select value={l.tierId} onChange={(e) => setLine(i, { tierId: e.target.value })} className="mt-1 h-8 text-xs">
                          <option value="">— Tiers —</option>
                          {tiers.filter((t) => t.collective === l.accountId).map((t) => (
                            <option key={t.id} value={t.id}>{t.code} · {t.name}</option>
                          ))}
                        </Select>
                      )}
                    </td>
                    <td className="px-2 py-1.5"><Input value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder="—" className="h-9" /></td>
                    <td className="px-2 py-1.5"><Input value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: "" })} inputMode="numeric" className="h-9 text-right" /></td>
                    <td className="px-2 py-1.5"><Input value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: "" })} inputMode="numeric" className="h-9 text-right" /></td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td colSpan={2} className="px-2 py-2 text-right text-slate-600">TOTAUX</td>
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-slate-800">{fcfa(totals.debit)}</td>
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap text-slate-800">{fcfa(totals.credit)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        {error && <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge tone={balanced ? "emerald" : diff === 0 ? "slate" : "rose"}>
              {balanced ? "✓ Équilibrée" : diff === 0 ? "Saisir des montants" : `Écart : ${fcfa(Math.abs(diff))}`}
            </Badge>
            <button onClick={() => setLines((p) => [...p, blankLine()])} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"><Plus size={15} /> Ligne</button>
            <button onClick={equilibrate} className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-700"><Scale size={15} /> Équilibrer</button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button variant={balanced ? "success" : "primary"} onClick={save}>
              {editing ? "Enregistrer les modifications" : "Enregistrer"}
            </Button>
          </div>
        </div>
        {!balanced && diff !== 0 && !editing && (
          <p className="text-xs font-medium text-amber-600">
            Écriture déséquilibrée : elle ne pourra être enregistrée qu'en brouillon.
          </p>
        )}
      </div>
    </Modal>
  );
}
