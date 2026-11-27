// FIMAAC — Barrel de types partagés (ré-export).
// Portal.tsx importe FieldDef & ClientRequest depuis "./clientCatalogTypes".
// NB : le lot original contenait un doublon de `export type { ClientRequest ... }` ; dédupliqué ici.
export type { ClientRequest, ClientRequestStatus, RequestMessage } from "./types";
export type { FieldDef, FieldType, ActeDef } from "./clientCatalog";
