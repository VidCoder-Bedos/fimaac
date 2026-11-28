import { useState, useCallback } from "react";
import { loadXlsxSafe } from "../lib/xlsx-sanitizer";
import { UploadCloud, Copy, CheckCircle2, FileSpreadsheet, AlertTriangle, ChevronDown, ChevronRight, Database } from "lucide-react";

type CellType = "FORMULE" | "NOMBRE" | "TEXTE" | "BOOLEEN" | "AUTRE" | "VIDE";

interface CellInfo {
  addr: string;
  type: CellType;
  raw: string;
  result?: string;
}

interface SheetSummary {
  index: number;
  name: string;
  rows: number;
  cols: number;
  formulaCount: number;
  inputCount: number;
  labelCount: number;
  merges: string[];
}

const TYPE_COLORS: Record<CellType, string> = {
  FORMULE: "text-violet-600",
  NOMBRE: "text-emerald-700",
  TEXTE: "text-slate-500",
  BOOLEEN: "text-amber-700",
  AUTRE: "text-rose-700",
  VIDE: "text-slate-500",
};

interface CellVal { formula?: string; sharedFormula?: string; result?: unknown; richText?: { text: string }[]; text?: string; hyperlink?: string }

function classifyCell(val: unknown): { type: CellType; raw: string; result?: string } {
  if (val === null || val === undefined) return { type: "VIDE", raw: "" };
  if (typeof val === "object" && !Array.isArray(val)) {
    const v = val as CellVal;
    // Formule
    if (v.formula) return { type: "FORMULE", raw: `=${v.formula}`, result: v.result !== undefined ? String(v.result) : undefined };
    if (v.sharedFormula) return { type: "FORMULE", raw: `=${v.sharedFormula}`, result: v.result !== undefined ? String(v.result) : undefined };
    // Texte riche
    if (v.richText) return { type: "TEXTE", raw: v.richText.map((r) => r.text).join("") };
    // Lien hypertexte
    if ("text" in v && "hyperlink" in v) return { type: "TEXTE", raw: String(v.text) };
    // Résultat de formule sans formule lisible
    if ("result" in v && v.result !== undefined) return { type: "FORMULE", raw: `=?`, result: String(v.result) };
    // Objet inconnu
    return { type: "AUTRE", raw: JSON.stringify(val).slice(0, 100) };
  }
  if (typeof val === "string") {
    if (val.startsWith("=")) return { type: "FORMULE", raw: val };
    return { type: "TEXTE", raw: val };
  }
  if (typeof val === "number") return { type: "NOMBRE", raw: String(val) };
  if (typeof val === "boolean") return { type: "BOOLEEN", raw: String(val) };
  return { type: "AUTRE", raw: String(val) };
}

async function extractWorkbook(file: File): Promise<{ summaries: SheetSummary[]; sheets: Record<string, CellInfo[]> }> {
  const wb = await loadXlsxSafe(file);
  const summaries: SheetSummary[] = [];
  const sheets: Record<string, CellInfo[]> = {};
  wb.eachSheet((ws, idx) => {
    const cells: CellInfo[] = [];
    let formulaCount = 0;
    let inputCount = 0;
    let labelCount = 0;
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const info = classifyCell(cell.value);
        if (info.type === "VIDE") return;
        cells.push({ addr: cell.address, type: info.type, raw: info.raw, result: info.result });
        if (info.type === "FORMULE") formulaCount++;
        else if (info.type === "NOMBRE") inputCount++;
        else if (info.type === "TEXTE") labelCount++;
      });
    });
    const merges = (ws.model?.merges || []) as string[];
    summaries.push({
      index: idx,
      name: ws.name,
      rows: ws.rowCount,
      cols: ws.columnCount,
      formulaCount,
      inputCount,
      labelCount,
      merges,
    });
    sheets[ws.name] = cells;
  });
  return { summaries, sheets };
}

function generateDump(fileName: string, summaries: SheetSummary[], sheets: Record<string, CellInfo[]>, selectedSheet: string | null): string {
  const lines: string[] = [];
  lines.push(`# Extraction du classeur: ${fileName}`);
  lines.push(`Feuilles: ${summaries.length}`);
  lines.push("");
  if (selectedSheet) {
    // Dump d'une seule feuille
    const s = summaries.find((x) => x.name === selectedSheet)!;
    lines.push(`=== FEUILLE: ${s.name} ===`);
    lines.push(`Dimensions: ${s.rows} lignes × ${s.cols} colonnes`);
    lines.push(`Formules: ${s.formulaCount} | Saisies: ${s.inputCount} | Libellés: ${s.labelCount}`);
    if (s.merges.length > 0) lines.push(`Fusions: ${s.merges.join(", ")}`);
    lines.push("");
    lines.push("| Cellule | Type | Contenu | Résultat |");
    lines.push("|---|---|---|---|");
    for (const c of sheets[selectedSheet] || []) {
      const content = c.raw.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 200);
      const result = c.result ? c.result.replace(/\|/g, "\\|").slice(0, 60) : "—";
      lines.push(`| ${c.addr} | ${c.type} | ${content} | ${result} |`);
    }
  } else {
    // Vue d'ensemble de toutes les feuilles
    lines.push("## Vue d'ensemble des feuilles");
    lines.push("");
    lines.push("| # | Feuille | Lignes | Cols | Formules | Saisies | Libellés | Fusions |");
    lines.push("|---|---|---|---|---|---|---|---|");
    for (const s of summaries) {
      lines.push(`| ${s.index} | ${s.name} | ${s.rows} | ${s.cols} | ${s.formulaCount} | ${s.inputCount} | ${s.labelCount} | ${s.merges.length} |`);
    }
    lines.push("");
    lines.push("## Cellules de saisie (INPUT) par feuille");
    lines.push("");
    for (const s of summaries) {
      const inputs = (sheets[s.name] || []).filter((c) => c.type === "NOMBRE");
      if (inputs.length === 0) continue;
      lines.push(`### ${s.name} (${inputs.length} cellules de saisie)`);
      for (const c of inputs) {
        lines.push(`- ${c.addr}: ${c.raw}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

export default function WorkbookExtractor() {
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<SheetSummary[] | null>(null);
  const [sheets, setSheets] = useState<Record<string, CellInfo[]> | null>(null);
  const [fileName, setFileName] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setError("");
    setFileName(file.name);
    try {
      const result = await extractWorkbook(file);
      setSummaries(result.summaries);
      setSheets(result.sheets);
    } catch {
      setError("Impossible de lire le fichier. Assure-toi que c'est un .xlsx valide.");
      setSummaries(null);
      setSheets(null);
    }
    setLoading(false);
  }, []);

  const dump = summaries && sheets ? generateDump(fileName, summaries, sheets, selectedSheet) : "";
  const charCount = dump.length;
  const copy = () => {
    navigator.clipboard.writeText(dump);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const totalFormulas = summaries?.reduce((s, x) => s + x.formulaCount, 0) || 0;
  const totalInputs = summaries?.reduce((s, x) => s + x.inputCount, 0) || 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <Database size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900">Extracteur de Classeur GUDEF</h1>
            <p className="text-xs text-slate-500">Analyse structurelle d'un modèle Excel → dump texte copiable</p>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* Zone d'upload */}
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
          <input
            type="file"
            accept=".xlsx,.xls"
            id="file-upload"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] || null)}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
                <p className="text-sm font-semibold text-slate-600">Analyse en cours…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6">
                <UploadCloud size={36} className="text-indigo-600" />
                <p className="font-bold text-slate-700">
                  {fileName || "Cliquez pour téléverser le classeur .xlsx"}
                </p>
                <p className="text-xs text-slate-500">Le fichier reste dans votre navigateur — rien n'est envoyé sur un serveur</p>
              </div>
            )}
          </label>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            <AlertTriangle size={16} /> {error}
          </div>
        )}
        {/* Stats globales */}
        {summaries && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-black text-indigo-600">{summaries.length}</p>
              <p className="text-xs text-slate-500">Feuilles</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-black text-violet-600">{totalFormulas}</p>
              <p className="text-xs text-slate-500">Formules</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-black text-emerald-700">{totalInputs}</p>
              <p className="text-xs text-slate-500">Cellules saisies</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-black text-amber-700">{summaries.reduce((s, x) => s + x.merges.length, 0)}</p>
              <p className="text-xs text-slate-500">Fusions</p>
            </div>
          </div>
        )}
        {/* Sélecteur de mode */}
        {summaries && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className="text-sm font-semibold text-slate-600">Mode d'extraction :</span>
            <button
              onClick={() => setSelectedSheet(null)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${!selectedSheet ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              Vue d'ensemble (toutes les feuilles)
            </button>
            <div className="relative">
              <select
                value={selectedSheet || ""}
                onChange={(e) => setSelectedSheet(e.target.value || null)}
                className="h-9 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400"
              >
                <option value="">— Feuille spécifique —</option>
                {summaries.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        )}
        {/* Aperçu des feuilles (mode vue d'ensemble) */}
        {summaries && !selectedSheet && (
          <div className="space-y-2">
            {summaries.map((s) => (
              <div key={s.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button
                  onClick={() => setExpandedSheet(expandedSheet === s.name ? null : s.name)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-slate-50"
                >
                  {expandedSheet === s.name ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                  <FileSpreadsheet size={15} className="text-indigo-600" />
                  <span className="flex-1 font-semibold text-slate-800">{s.name}</span>
                  <span className="text-xs text-violet-600">{s.formulaCount} formules</span>
                  <span className="text-xs text-emerald-700">{s.inputCount} saisies</span>
                  <span className="text-xs text-slate-500">{s.rows}×{s.cols}</span>
                </button>
                {expandedSheet === s.name && sheets && (
                  <div className="max-h-80 overflow-auto border-t border-slate-100 px-4 py-2">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white text-slate-500">
                        <tr><th className="px-2 py-1 text-left">Cellule</th><th className="px-2 py-1 text-left">Type</th><th className="px-2 py-1 text-left">Contenu</th><th className="px-2 py-1 text-left">Résultat</th></tr>
                      </thead>
                      <tbody>
                        {(sheets[s.name] || []).slice(0, 200).map((c, i) => (
                          <tr key={i} className="border-t border-slate-50">
                            <td className="px-2 py-1 font-mono font-semibold text-slate-600">{c.addr}</td>
                            <td className={`px-2 py-1 font-semibold ${TYPE_COLORS[c.type]}`}>{c.type}</td>
                            <td className="px-2 py-1 text-slate-600">{c.raw.slice(0, 80)}</td>
                            <td className="px-2 py-1 text-slate-500">{c.result?.slice(0, 40) || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(sheets[s.name] || []).length > 200 && <p className="py-2 text-center text-xs text-slate-500">… {(sheets[s.name] || []).length - 200} cellules de plus (voir le dump complet)</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Aperçu détaillé (mode feuille spécifique) */}
        {summaries && selectedSheet && sheets && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-bold text-slate-800">{selectedSheet}</h3>
              <p className="text-xs text-slate-500">{(sheets[selectedSheet] || []).length} cellules non vides</p>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500">
                  <tr><th className="px-3 py-2 text-left">Cellule</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Contenu</th><th className="px-3 py-2 text-left">Résultat</th></tr>
                </thead>
                <tbody>
                  {(sheets[selectedSheet] || []).map((c, i) => (
                    <tr key={i} className="border-t border-slate-50 hover:bg-indigo-50/30">
                      <td className="px-3 py-1.5 font-mono font-semibold text-slate-600">{c.addr}</td>
                      <td className={`px-3 py-1.5 font-semibold ${TYPE_COLORS[c.type]}`}>{c.type}</td>
                      <td className="px-3 py-1.5 text-slate-600">{c.raw.slice(0, 120)}</td>
                      <td className="px-3 py-1.5 text-slate-500">{c.result?.slice(0, 50) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Zone de dump + copier */}
        {summaries && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">
                  {selectedSheet ? `Dump: ${selectedSheet}` : "Dump: Vue d'ensemble + cellules saisies"}
                </span>
                <span className="text-xs text-slate-500">{charCount.toLocaleString("fr-FR")} caractères</span>
                {charCount > 50000 && <span className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle size={11} /> Dump volumineux</span>}
              </div>
              <button onClick={copy} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                {copied ? <><CheckCircle2 size={15} /> Copié !</> : <><Copy size={15} /> Copier le dump</>}
              </button>
            </div>
            <textarea
              readOnly
              value={dump}
              className="h-64 w-full resize-y rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-slate-500 outline-none"
              placeholder="Le dump apparaîtra ici…"
            />
            <p className="text-center text-xs text-slate-500">
              Copie ce texte et colle-le dans notre conversation pour que je puisse construire le renderer fidèle au modèle.
            </p>
          </div>
        )}
        {!summaries && !loading && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <FileSpreadsheet size={32} className="mx-auto mb-3 text-slate-500" />
            <p className="text-sm text-slate-500">Téléverse un classeur .xlsx pour commencer l'analyse</p>
          </div>
        )}
      </div>
    </div>
  );
}
