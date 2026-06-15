#!/bin/bash

cd "$(dirname "$0")"

# ── Rapport ──────────────────────────────────────────────────
echo "[Rapport] Compilation 1/2..."
pdflatex -interaction=nonstopmode CodeRapport.tex > /dev/null 2>&1

echo "[Rapport] Compilation 2/2 (table des matières)..."
pdflatex -interaction=nonstopmode CodeRapport.tex > /dev/null 2>&1

echo "[Rapport] Nettoyage..."
rm -f CodeRapport.aux CodeRapport.log CodeRapport.out CodeRapport.toc \
       CodeRapport.lof CodeRapport.lot CodeRapport.bbl CodeRapport.blg \
       CodeRapport.fls CodeRapport.fdb_latexmk CodeRapport.synctex.gz

echo "Fait : CodeRapport.pdf"

# ── Présentation Beamer ───────────────────────────────────────
echo ""
echo "[Présentation] Compilation 1/2..."
pdflatex -interaction=nonstopmode presentation.tex > /dev/null 2>&1

echo "[Présentation] Compilation 2/2 (sommaire)..."
pdflatex -interaction=nonstopmode presentation.tex > /dev/null 2>&1

echo "[Présentation] Nettoyage..."
rm -f presentation.aux presentation.log presentation.out presentation.toc \
       presentation.nav presentation.snm presentation.vrb \
       presentation.fls presentation.fdb_latexmk presentation.synctex.gz

echo "Fait : presentation.pdf"
