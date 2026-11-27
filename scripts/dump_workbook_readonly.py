#!/usr/bin/env python3
# ============================================================================
# FIMAAC — Dump complet du classeur GUDEF (mode read-only, économe en mémoire)
# Lecture en mode read_only pour éviter de charger tout le classeur en mémoire.
# Usage: python scripts/dump_workbook_readonly.py
# Source : 1001184138_2025_Definitif(1).xlsx
# ============================================================================
from openpyxl import load_workbook
from pathlib import Path

src = Path("/mnt/data/1001184138_2025_Definitif(1).xlsx")
out = Path("/mnt/data/dump_complet_classeur_1001184138_2025.txt")

# Lecture en mode read-only pour éviter de charger tout le classeur en mémoire.
wb = load_workbook(src, read_only=True, data_only=False)

total_nonempty = 0
total_formulas = 0

with out.open("w", encoding="utf-8") as f:
    f.write("DUMP COMPLET DU CLASSEUR\n")
    f.write("=" * 100 + "\n")
    f.write(f"Fichier : {src.name}\n")
    f.write(f"Nombre de feuilles : {len(wb.sheetnames)}\n\n")
    for i, name in enumerate(wb.sheetnames, 1):
        f.write(f"{i:02d}. {name}\n")

    for idx, name in enumerate(wb.sheetnames, 1):
        ws = wb[name]
        f.write("\n" + "#" * 100 + "\n")
        f.write(f"FEUILLE {idx:02d} : {name}\n")
        f.write("#" * 100 + "\n")
        f.write(f"Dimensions déclarées : {ws.max_row} lignes x {ws.max_column} colonnes\n")
        f.write("Format : COORDONNEE | VALEUR (ou FORMULE)\n")
        f.write("-" * 100 + "\n")

        sheet_nonempty = 0
        sheet_formulas = 0
        for row in ws.iter_rows():
            for cell in row:
                value = cell.value
                if value is not None:
                    sheet_nonempty += 1
                    total_nonempty += 1
                    if isinstance(value, str) and value.startswith("="):
                        sheet_formulas += 1
                        total_formulas += 1
                        f.write(f"{cell.coordinate} | FORMULE: {value!r}\n")
                    else:
                        f.write(f"{cell.coordinate} | VALEUR: {value!r}\n")

        f.write(f"\n[STATISTIQUES FEUILLE] cellules non vides={sheet_nonempty}, formules={sheet_formulas}\n")

    f.write("\n" + "=" * 100 + "\n")
    f.write("STATISTIQUES GLOBALES\n")
    f.write("=" * 100 + "\n")
    f.write(f"Feuilles : {len(wb.sheetnames)}\n")
    f.write(f"Cellules non vides : {total_nonempty}\n")
    f.write(f"Formules : {total_formulas}\n")

wb.close()
print(f"Fichier créé : {out}")
print(f"Feuilles : {len(wb.sheetnames)}")
print(f"Cellules non vides : {total_nonempty}")
print(f"Formules : {total_formulas}")
