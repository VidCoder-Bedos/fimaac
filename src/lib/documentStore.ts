// ============================================================================
// FIMAAC — Registre mémoire des fichiers téléversés (session)
// Le store persistant ne conserve que les métadonnées (name, size…). Les
// objets `File` ne peuvent pas être sérialisés en localStorage : ils vivent
// en mémoire le temps de la session.
// ⚠️ Après un rechargement de page, l'aperçu est indisponible — on le signale
//    explicitement à l'utilisateur, sans jamais en déduire le contenu.
// ============================================================================
const registry = new Map<string, File>();

/** Enregistre le fichier réel d'une pièce (session courante). */
export function putDocumentFile(docId: string, file: File): void {
  registry.set(docId, file);
}

/** Retrouve le fichier réel d'une pièce (null si session rechargée). */
export function getDocumentFile(docId: string): File | null {
  return registry.get(docId) ?? null;
}

/** Le fichier est-il encore disponible en mémoire ? */
export function hasDocumentFile(docId: string): boolean {
  return registry.has(docId);
}

/** Oublie une pièce (suppression du document). */
export function forgetDocumentFile(docId: string): void {
  registry.delete(docId);
}
