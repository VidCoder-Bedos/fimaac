#!/usr/bin/env python3
# ============================================================================
# FIMAAC — Dump complet du classeur GUDEF de référence
# Extrait formules + valeurs calculées + cellules fusionnées (openpyxl).
# Usage: python scripts/dump_workbook_full.py
# Source : 1001184138_2025_Definitif(1).xlsx
# ============================================================================
from openpyxl import load_workbook
from pathlib import Path

path = Path("/mnt/data/1001184138_2025_Definitif(1).xlsx")
wb_formula = load_workbook(path, data_only=False)
wb_values = load_workbook(path, data_only=True)
out = Path("/mnt/data/dump_complet_classeur_1001184138_2025.txt")

total_nonempty = 0
total_formulas = 0

with out.open("w", encoding="utf-8") as f:
    f.write("DUMP COMPLET DU CLASSEUR\n")
    f.write("=" * 100 + "\n")
    f.write(f"Fichier source : {path.name}\n")
    f.write(f"Nombre de feuilles : {len(wb_formula.sheetnames)}\n")
    f.write("Feuilles :\n")
    for i, name in enumerate(wb_formula.sheetnames, 1):
        f.write(f"  {i:02d}. {name}\n")
    f.write("\n")

    for idx, name in enumerate(wb_formula.sheetnames, 1):
        ws = wb_formula[name]
        wsv = wb_values[name]

        nonempty = []
        formulas = 0
        for row in ws.iter_rows():
            for cell in row:
                if cell.value is not None:
                    nonempty.append(cell)
                    if isinstance(cell.value, str) and cell.value.startswith("="):
                        formulas += 1

        total_nonempty += len(nonempty)
        total_formulas += formulas

        f.write("\n" + "#" * 100 + "\n")
        f.write(f"FEUILLE {idx:02d} : {name}\n")
        f.write("#" * 100 + "\n")
        f.write(f"Dimensions : {ws.max_row} lignes x {ws.max_column} colonnes\n")
        f.write(f"Cellules non vides : {len(nonempty)}\n")
        f.write(f"Formules : {formulas}\n")

        if ws.merged_cells.ranges:
            f.write("Cellules fusionnées :\n")
            for rng in ws.merged_cells.ranges:
                f.write(f"  - {rng}\n")

        f.write("\nCONTENU DES CELLULES (coordonnée | formule/valeur | valeur calculée si disponible)\n")
        f.write("-" * 100 + "\n")

        for cell in nonempty:
            raw = cell.value
            calculated = wsv[cell.coordinate].value

            def fmt(v):
                if v is None:
                    return ""
                return repr(v)

            if isinstance(raw, str) and raw.startswith("="):
                f.write(
                    f"{cell.coordinate} | FORMULE: {fmt(raw)} | VALEUR_CALCULEE: {fmt(calculated)}\n"
                )
            else:
                f.write(f"{cell.coordinate} | VALEUR: {fmt(raw)}\n")

    f.write("\n" + "=" * 100 + "\n")
    f.write("STATISTIQUES GLOBALES\n")
    f.write("=" * 100 + "\n")
    f.write(f"Nombre de feuilles : {len(wb_formula.sheetnames)}\n")
    f.write(f"Nombre total de cellules non vides : {total_nonempty}\n")
    f.write(f"Nombre total de formules : {total_formulas}\n")

print(f"Dump créé : {out}")
print(f"Feuilles : {len(wb_formula.sheetnames)}")
print(f"Cellules non vides : {total_nonempty}")
print(f"Formules : {total_formulas}")
