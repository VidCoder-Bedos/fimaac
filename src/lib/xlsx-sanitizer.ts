// ============================================================================
// FIMAAC — Nettoyeur de formules partagées ExcelJS
// ExcelJS crash avec "shared formula master must exist above and or left on
// clone for cell X" quand un classeur contient des formules partagées
// (t="shared" dans le XML). Les classeurs GUDEF officiels en utilisent massivement.
//
// Ce module ouvre le .xlsx comme un zip, supprime les attributs t="shared",
// si="..." et ref="..." des balises <f>, puis reconstruit un buffer propre.
// ============================================================================
import JSZip from "jszip";
import ExcelJS from "exceljs";

/** Échappe les entités XML (comparaison fiable des libellés). */
export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/**
 * Nettoie un buffer .xlsx en supprimant les références de formules partagées.
 *
 * - Master : <f t="shared" ref="E17:E25" si="0">SUM(E10:E16)</f> → <f>SUM(E10:E16)</f>
 * - Slave  : <f t="shared" si="0"/> → <f/> (formule vide, inoffensive)
 *
 * @param buf Buffer du fichier .xlsx
 * @returns Buffer nettoyé (sans shared formulas)
 */
export async function sanitizeSharedFormulas(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buf);
  // Trouver tous les fichiers XML de feuilles de calcul
  const sheetFiles = Object.keys(zip.files).filter((f) =>
    /^xl\/worksheets\/sheet\d+\.xml$/i.test(f),
  );

  for (const sheetFile of sheetFiles) {
    const entry = zip.file(sheetFile);
    if (!entry) continue;
    const xml = await entry.async("string");
    let modified = false;

    // Regex : capture chaque balise <f ...> (y compris auto-fermante <f .../>)
    // et supprime les attributs t="shared", si="...", ref="..."
    const cleanedXml = xml.replace(/<f\b([^>]*)>/g, (_match: string, attrs: string) => {
      const hasShared = /\bt="shared"/i.test(attrs);
      if (!hasShared) return _match; // pas une shared formula → intact
      modified = true;
      const cleanedAttrs = attrs
        .replace(/\s+t="shared"/gi, "")
        .replace(/\s+si="\d+"/gi, "")
        .replace(/\s+ref="[^"]*"/gi, "");
      return "<f" + cleanedAttrs + ">";
    });

    if (modified) {
      zip.file(sheetFile, cleanedXml);
    }
  }

  return zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/**
 * Charge un classeur Excel de manière sécurisée.
 *
 * 1. Tente un chargement direct (rapide pour les fichiers simples).
 * 2. Si ExcelJS crash (shared formulas, etc.), nettoie le fichier et réessaie.
 *
 * @param file Fichier .xlsx téléversé par l'utilisateur
 * @returns Workbook ExcelJS chargé et utilisable
 */
export async function loadXlsxSafe(file: File): Promise<ExcelJS.Workbook> {
  const rawBuf = await file.arrayBuffer();

  // Tentative 1 : chargement direct (fast path)
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(rawBuf);
    return wb;
  } catch (firstErr) {
    const msg = String((firstErr as Error)?.message ?? firstErr);
    // Si c'est l'erreur de shared formulas → nettoyer et réessayer
    if (msg.includes("shared formula") || msg.includes("must exist above")) {
      const cleanBuf = await sanitizeSharedFormulas(rawBuf);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(cleanBuf);
      return wb;
    }
    // Autre erreur → la remonter avec un message clair
    throw new Error(
      "ExcelJS n'a pas pu lire ce classeur : " + msg +
      "\n\nSolutions :\n" +
      "1. Ouvrez le fichier dans Excel → « Enregistrer sous » → .xlsx\n" +
      "2. Vérifiez que le fichier n'est pas corrompu ou protégé par mot de passe.",
    );
  }
}

// ============================================================================
// Helpers d'audit — utilisés par reports.ts (feuilles + décompte de formules)
// ============================================================================

/** Liste les noms de feuilles d'un classeur sans le charger complètement. */
export async function listSheetNames(file: File): Promise<string[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const wbXml = zip.file("xl/workbook.xml");
  if (!wbXml) return [];
  const xml = await wbXml.async("string");
  return [...xml.matchAll(/<sheet[^>]*name="([^"]+)"/g)].map((m) => decodeXmlEntities(m[1]));
}

/** Compte les formules d'un classeur (audit GUDEF). */
export async function countFormulas(file: File): Promise<number> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sheets = zip.file(/^xl\/worksheets\/sheet\d+\.xml$/);
  let total = 0;
  for (const f of sheets) {
    const xml = await f.async("string");
    total += (xml.match(/<f\b/g) || []).length;
  }
  return total;
}
