#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
outils/verif-textes-fr.py — Étape 10 (contrôle)
Liste les nœuds de texte STATIQUES des pages qui ne sont couverts par aucun
attribut data-i18n / -aria / -title / -placeholder / -content.

Sert de filet de sécurité avant commit : tout texte affiché doit pouvoir
basculer en anglais (les valeurs issues du CMS, elles, arrivent par JS et ne
sont pas concernées).

Usage : python3 outils/verif-textes-fr.py
"""
import glob, os, re, sys
from html.parser import HTMLParser

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATTRS_I18N = ("data-i18n", "data-i18n-aria", "data-i18n-title",
              "data-i18n-placeholder", "data-i18n-content")

INDICE_FR = re.compile(r"[àâäéèêëîïôöùûüçœ]|\b(le|la|les|des|du|une|et|pour|avec|dans|sur|qui|que|"
                       r"votre|vous|nous|je|mon|ma|mes|tous|toutes|aucun|aucune|voir|plus|sans|est|"
                       r"sont|cette|ce|cet|vos|son|sa|ses|au|aux|par|en|aujourd|depuis|jusqu)\b", re.I)
IGNORE = re.compile(r"^\s*$")


class Analyseur(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pile = []        # (balise, couvert_par_i18n, dans_script)
        self.restes = []

    def handle_starttag(self, tag, attrs):
        noms = dict(attrs)
        couvert = any(a in noms for a in ATTRS_I18N)
        parent_couvert = self.pile[-1][1] if self.pile else False
        parent_script = self.pile[-1][2] if self.pile else False
        self.pile.append((tag, couvert or parent_couvert, parent_script or tag in ("script", "style", "svg")))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        # remonte jusqu'à la balise correspondante (tolérant aux fermetures implicites)
        for i in range(len(self.pile) - 1, -1, -1):
            if self.pile[i][0] == tag:
                del self.pile[i:]
                return

    def handle_data(self, data):
        if IGNORE.match(data):
            return
        if self.pile and (self.pile[-1][1] or self.pile[-1][2]):
            return
        texte = re.sub(r"\s+", " ", data).strip()
        if len(texte) < 3:
            return
        if INDICE_FR.search(texte):
            self.restes.append((self.getpos()[0], texte[:120]))


if __name__ == "__main__":
    fichiers = sorted(glob.glob(os.path.join(RACINE, "*.html")) +
                      glob.glob(os.path.join(RACINE, "*/*.html")) +
                      glob.glob(os.path.join(RACINE, "*/*/*.html")))
    total = 0
    for chemin in fichiers:
        rel = os.path.relpath(chemin, RACINE)
        a = Analyseur()
        a.feed(open(chemin, encoding="utf-8").read())
        a.close()
        if a.restes:
            print("\n%s — %d texte(s) non couvert(s)" % (rel, len(a.restes)))
            for ligne, texte in a.restes:
                print("   l.%-4d %s" % (ligne, texte))
        total += len(a.restes)
    print("\nTOTAL textes statiques non couverts :", total)
    sys.exit(0 if total == 0 else 1)
