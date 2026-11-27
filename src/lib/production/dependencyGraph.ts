// ============================================================================
// FIMAAC — Production Engine : graphe de dépendances (P0, bonus 1)
// Construit un DAG depuis ZoneDef.deps + gère la propagation d'impact réactive.
// Quand une donnée change, on sait exactement quelles zones/notes recalculer.
// ============================================================================
import type { ZoneDef } from "./types";
import { ZONE_REGISTRY, getZone } from "./zones";

/** Arc du graphe : dependant → dependency (dependant a besoin de dependency). */
export interface DependencyGraph {
  /** Pour chaque zone, la liste de ses dépendances directes (ce dont elle a besoin). */
  dependencies: Map<string, Set<string>>;
  /** Pour chaque zone, la liste de ses dépendants (qui ont besoin d'elle). */
  dependents: Map<string, Set<string>>;
  /** Ordre topologique (les feuilles d'abord). */
  order: string[];
}

/**
 * Construit le graphe de dépendances à partir du registre des zones.
 * @param zones registre (défaut ZONE_REGISTRY)
 * @throws si un cycle est détecté (sécurité : un état financier ne peut pas être cyclique)
 */
export function buildDependencyGraph(zones: ZoneDef[] = ZONE_REGISTRY): DependencyGraph {
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const z of zones) {
    dependencies.set(z.id, new Set());
    dependents.set(z.id, new Set());
  }

  // Arcs : dependant.deps → dependant
  for (const z of zones) {
    for (const dep of z.deps || []) {
      if (!getZone(dep)) continue; // dépendance inconnue : ignorée (forward-compat)
      dependencies.get(z.id)!.add(dep);
      dependents.get(dep)?.add(z.id);
    }
  }

  const order = topologicalSort(zones, dependencies);
  return { dependencies, dependents, order };
}

/** Tri topologique (Kahn) — ordre de calcul des zones (feuilles d'abord). */
export function topologicalSort(zones: ZoneDef[], dependencies: Map<string, Set<string>>): string[] {
  const inDegree = new Map<string, number>();
  for (const z of zones) inDegree.set(z.id, dependencies.get(z.id)!.size);

  const queue = zones.filter((z) => inDegree.get(z.id) === 0).map((z) => z.id);
  const order: string[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const z of zones) {
      if (!dependencies.get(z.id)!.has(id)) continue;
      const deg = (inDegree.get(z.id) || 0) - 1;
      inDegree.set(z.id, deg);
      if (deg === 0) queue.push(z.id);
    }
  }

  if (order.length !== zones.length) {
    const cyclic = zones.filter((z) => !order.includes(z.id)).map((z) => z.id);
    throw new Error(`Cycle de dépendances détecté dans le registre des zones : ${cyclic.join(", ")}`);
  }

  return order;
}

/** Dépendances directes d'une zone (ce dont elle a besoin pour être calculée). */
export function dependenciesOf(graph: DependencyGraph, zoneId: string): string[] {
  return [...(graph.dependencies.get(zoneId) || [])];
}

/** Dépendants directs d'une zone (qui ont besoin d'elle). */
export function dependentsOf(graph: DependencyGraph, zoneId: string): string[] {
  return [...(graph.dependents.get(zoneId) || [])];
}

/**
 * Propagation d'impact : étant donné un ensemble de zones modifiées,
 * renvoie TOUS les zoneIds à recalculer (chaîne complète, ordre topologique).
 *
 * Exemple : si "resultat.RESULTAT_NET" change → "bilan_passif.CJ" → "bilan_passif.CAPITAUX"
 *           → "bilan_passif.TOTAL" → "controle.ACTIF_PASSIF" → "note.NOTE_34"…
 */
export function propagateImpact(graph: DependencyGraph, changed: string[]): string[] {
  const impacted = new Set<string>();
  const queue = [...changed];

  while (queue.length) {
    const id = queue.shift()!;
    if (impacted.has(id)) continue;
    impacted.add(id);
    for (const dep of graph.dependents.get(id) || []) {
      if (!impacted.has(dep)) queue.push(dep);
    }
  }

  // Réordonner selon l'ordre topologique (recalcul dans le bon sens)
  return graph.order.filter((id) => impacted.has(id));
}

/** Instance partagée (construite une fois au chargement). */
let _graph: DependencyGraph | null = null;
export function getDependencyGraph(): DependencyGraph {
  if (!_graph) _graph = buildDependencyGraph();
  return _graph;
}

/** Diagnostic : profondeur max, feuilles, nœuds les plus dépendants (utile debug). */
export function graphStats(graph: DependencyGraph = getDependencyGraph()) {
  let maxFanOut = 0;
  let maxFanIn = 0;
  let hub = "";
  for (const deps of graph.dependencies.values()) if (deps.size > maxFanOut) maxFanOut = deps.size;
  for (const [id, deps] of graph.dependents) {
    if (deps.size > maxFanIn) {
      maxFanIn = deps.size;
      hub = id;
    }
  }
  return {
    nodes: graph.order.length,
    edges: [...graph.dependencies.values()].reduce((s, d) => s + d.size, 0),
    maxFanOut,
    maxFanIn,
    mostDependedUpon: hub,
  };
}
