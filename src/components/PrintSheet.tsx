// ============================================================================
// FIMAAC — Feuille imprimable (P1)
//
// Un cabinet doit pouvoir remettre un bilan à son client. Le navigateur sait
// produire un PDF de qualité depuis « Imprimer » ; il suffit de lui donner un
// document propre. Aucune bibliothèque PDF n'est ajoutée : ce composant monte
// le document dans un conteneur dédié au moment de l'impression, masque
// l'interface par CSS, imprime, puis nettoie.
// ============================================================================
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function PrintSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [host] = useState(() => {
    const el = document.createElement("div");
    el.id = "fimaac-print";
    return el;
  });

  useEffect(() => {
    document.body.appendChild(host);
    return () => { host.remove(); };
  }, [host]);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add("printing");
    // Laisse le temps au portail de se peindre avant d'ouvrir la boîte d'impression.
    const timer = window.setTimeout(() => window.print(), 80);
    const done = () => { document.body.classList.remove("printing"); onClose(); };
    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("printing");
    };
  }, [open, onClose]);

  return createPortal(open ? children : null, host);
}

export default PrintSheet;
