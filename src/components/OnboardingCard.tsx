import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight, ChevronDown, ChevronUp, Compass } from "lucide-react";
import { Card } from "./ui";
import type { OnboardingReport } from "../lib/onboarding";

/**
 * P23 — Parcours d'amorçage.
 * Il disparaît de lui-même quand les six étapes tiennent : une aide qui reste
 * après avoir servi devient du bruit. Il reste repliable, jamais fermable : on
 * peut ignorer une étape, pas effacer l'information qu'elle manque.
 */
export function OnboardingCard({ report }: { report: OnboardingReport }) {
  const [open, setOpen] = useState(true);
  if (report.complete) return null;

  const current = report.next;
  return (
    <Card className="mb-6 border-indigo-100 bg-indigo-50/40 p-0">
      <button
        className="flex w-full items-center gap-3 px-5 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"><Compass size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-900">Mise en route — {report.done}/{report.total} étapes</span>
          <span className="block truncate text-xs text-slate-600">{report.summary}</span>
        </span>
        {current ? (
          <span className="hidden shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white sm:block">{current.cta}</span>
        ) : null}
        {open ? <ChevronUp size={16} className="shrink-0 text-slate-500" /> : <ChevronDown size={16} className="shrink-0 text-slate-500" />}
      </button>

      {open && (
        <div className="border-t border-indigo-100 bg-white/60">
          <div className="h-1 w-full bg-indigo-100">
            <div className="h-1 bg-indigo-600 transition-all" style={{ width: `${(report.done / report.total) * 100}%` }} />
          </div>
          <ol className="divide-y divide-indigo-50">
            {report.steps.map((step) => {
              const isCurrent = step.status === "current";
              return (
                <li key={step.id} className="flex items-start gap-3 px-5 py-2.5">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      step.status === "done"
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200 text-slate-500"
                    }`}
                    aria-hidden
                  >
                    {step.status === "done" ? <Check size={12} /> : step.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${isCurrent ? "font-semibold text-slate-900" : step.status === "done" ? "text-slate-500 line-through" : "text-slate-600"}`}>
                      {step.title}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {step.status === "done" ? step.hint : <>{step.hint} · {step.why}</>}
                    </p>
                  </div>
                  {step.status !== "done" && (
                    <Link
                      to={step.href}
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                        isCurrent ? "bg-indigo-600 text-white hover:bg-indigo-700" : "text-indigo-700 hover:bg-indigo-50"
                      }`}
                    >
                      {step.cta} <ArrowRight size={11} className="ml-0.5 inline" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Card>
  );
}
