import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Libellé du périmètre, affiché dans le panneau d'erreur. */
  label?: string;
}
interface State {
  error: Error | null;
}

/**
 * M3 — Error Boundary global.
 * Tout échec de rendu (état persistant partiel, donnée inattendue) affiche un
 * panneau explicatif avec un moyen de récupération, au lieu d'un écran blanc.
 * Installé autour de chaque espace (cabinet / admin / portail) dans App.tsx.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Traçabilité minimale côté console (pas d'envoi réseau en démo).
    console.error("[FIMAAC] Erreur de rendu :", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  private resetData = () => {
    // Dernier recours : l'état persistant est suspect — on régénère le seed.
    try {
      localStorage.removeItem("fimaac_db_v1");
    } catch {
      /* stockage indisponible */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-lg font-black text-slate-900">Une erreur est survenue</h1>
          <p className="mt-2 text-sm text-slate-500">
            {this.props.label ? `Périmètre : ${this.props.label}. ` : ""}
            L'affichage n'a pas pu être complété. Vos données n'ont pas été modifiées.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-xl bg-slate-900 p-3 text-left font-mono text-[11px] text-slate-300">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <RotateCcw size={15} /> Réessayer
            </button>
            <button
              onClick={this.resetData}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Réinitialiser les données de démonstration
            </button>
          </div>
          <p className="mt-4 text-[11px] text-slate-400">
            Si le problème persiste après réinitialisation, signaler l'erreur avec le message ci-dessus.
          </p>
        </div>
      </div>
    );
  }
}
