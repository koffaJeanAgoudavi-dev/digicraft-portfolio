#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
outils/patchs-post-marquage.py — Étape 10
Petites retouches appliquées APRÈS `outils/marquer-i18n.py` (qui n'est pas
idempotent) :

  1. attributs de vue `data-prj-vue` : permettent à js/projects.js de
     reconstruire les cartes, filtres et fiches au changement de langue ;
  2. aria-label du carrousel de projets de l'accueil.

Usage : python3 outils/patchs-post-marquage.py
"""
import os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PATCHS = [
    ("index.html",
     '<div class="carousel" id="carousel-projets" aria-label="Projets à la une, défilement horizontal">',
     '<div class="carousel" id="carousel-projets" data-prj-vue="carousel"'
     ' aria-label="Projets à la une, défilement horizontal" data-i18n-aria="accueil.projets.aria">'),
    ("projets/index.html",
     '<div class="grid-3" id="grille-projets">',
     '<div class="grid-3" id="grille-projets" data-prj-vue="grille"'
     ' data-prj-filtres="filtres-projets" data-prj-puces="puces-projets">'),
    ("projets/fiche.html",
     '<main id="contenu" data-cs-page="" data-cs-dynamic>',
     '<main id="contenu" data-cs-page="" data-cs-dynamic data-prj-vue="fiche">'),
]

if __name__ == "__main__":
    for fichier, avant, apres in PATCHS:
        chemin = os.path.join(RACINE, fichier)
        s = open(chemin, encoding="utf-8").read()
        if apres in s:
            print("  = déjà appliqué :", fichier)
            continue
        if avant not in s:
            print("  ⚠ motif introuvable :", fichier)
            continue
        open(chemin, "w", encoding="utf-8").write(s.replace(avant, apres, 1))
        print("  ✓", fichier)
