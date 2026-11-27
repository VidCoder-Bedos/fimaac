// FIMAAC — « importer » : shim de réconciliation.
// universalImport.ts importe depuis "./importer" ; l'implémentation d'import universel
// (parseAmount, readAny, normalize, …) vit dans ./importers. On la ré-exporte ici.
export * from "./importers";
