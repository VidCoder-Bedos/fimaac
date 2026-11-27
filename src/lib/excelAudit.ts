// FIMAAC — « excelAudit » : implémentation d'audit / patch de classeur GUDEF.
// Consumé par reconstitution.ts (entrée de la page Liasse, lot 8).
export {
  auditWorkbook,
  patchWorkbook,
  cloneWorkbook,
  downloadWorkbookWb,
  workbookCoherenceChecks,
  coherenceScore,
  loadXlsxSafe,
  type WorkbookAudit,
  type SheetAudit,
  type WorkbookPatch,
} from "./reports";
