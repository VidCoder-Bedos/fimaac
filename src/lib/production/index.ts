// ============================================================================
// FIMAAC — Production Engine : barrel public (P0 fondation)
// Point d'entrée unique du moteur de production des états financiers.
// ============================================================================

// Domaine & types
export * from "./types";

// Registre des zones (matrice source → calcul → note → contrôle)
export * from "./zones";

// Graphe de dépendances (propagation d'impact réactive — bonus 1)
export * from "./dependencyGraph";

// Contexte de production immuable
export * from "./context";

// Score de complétude (§19)
export * from "./scoring";
