#!/bin/bash

cd "$(dirname "$0")"

echo "Compilation 1/2..."
pdflatex -interaction=nonstopmode CodeRapport.tex > /dev/null 2>&1

echo "Compilation 2/2 (table des matières)..."
pdflatex -interaction=nonstopmode CodeRapport.tex > /dev/null 2>&1

echo "Nettoyage des fichiers temporaires..."
rm -f CodeRapport.aux \
       CodeRapport.log \
       CodeRapport.out \
       CodeRapport.toc \
       CodeRapport.lof \
       CodeRapport.lot \
       CodeRapport.bbl \
       CodeRapport.blg \
       CodeRapport.fls \
       CodeRapport.fdb_latexmk \
       CodeRapport.synctex.gz

echo "Fait : CodeRapport.pdf"
