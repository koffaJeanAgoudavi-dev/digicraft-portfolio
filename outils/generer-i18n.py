#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
outils/generer-i18n.py — Étape 10
Assemble js/i18n.js à partir de :
  - outils/_fr.json          (textes FR extraits des pages, source de vérité)
  - outils/i18n-en.json      (traductions EN des textes de page)
  - outils/i18n-modules.json (libellés d'interface injectés par les modules JS)
  - le socle dock/hero/nav (conservé tel quel)

Usage : python3 outils/generer-i18n.py
"""
import json, os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Socle posé à l'étape 2 (dock, navigation, hero) — inchangé
SOCLE_FR = {
    "nav.accueil": "Accueil", "nav.expertise": "Expertise", "nav.realisations": "Réalisations",
    "nav.activite": "Activité", "nav.parcours": "Parcours", "nav.apropos": "À propos",
    "nav.contact": "Contact",
    "dock.portfolio": "Portfolio", "dock.more": "Plus", "dock.nav": "Navigation",
    "dock.ressources": "Ressources", "dock.cookies": "Gérer mes cookies", "dock.close": "Fermer",
    "lang.label": "Langue du site",
    "hero.portfolio": "Automatisation IA", "hero.badge": "Fondateur",
    "hero.contact": "Me contacter",
    "hero.stat.projets": "Projets", "hero.stat.workflows": "Workflows",
    "hero.stat.certifs": "Certifications",
}
SOCLE_EN = {
    "nav.accueil": "Home", "nav.expertise": "Expertise", "nav.realisations": "Work",
    "nav.activite": "Activity", "nav.parcours": "Journey", "nav.apropos": "About",
    "nav.contact": "Contact",
    "dock.portfolio": "Portfolio", "dock.more": "More", "dock.nav": "Navigation",
    "dock.ressources": "Resources", "dock.cookies": "Manage cookies", "dock.close": "Close",
    "lang.label": "Site language",
    "hero.portfolio": "Personal portfolio", "hero.badge": "Founder",
    "hero.contact": "Get in touch",
    "hero.stat.projets": "Projects", "hero.stat.workflows": "Workflows",
    "hero.stat.certifs": "Certifications",
}

fr = dict(SOCLE_FR)
fr.update(json.load(open(os.path.join(RACINE, "outils/_fr.json"), encoding="utf-8")))
en = dict(SOCLE_EN)
en.update(json.load(open(os.path.join(RACINE, "outils/i18n-en.json"), encoding="utf-8")))
mods = json.load(open(os.path.join(RACINE, "outils/i18n-modules.json"), encoding="utf-8"))
fr.update(mods["fr"])
en.update(mods["en"])

manquants = sorted(set(fr) - set(en))
if manquants:
    raise SystemExit("Traductions EN manquantes : " + ", ".join(manquants))
superflus = sorted(set(en) - set(fr))
for k in superflus:
    del en[k]

def bloc(d):
    lignes = []
    for cle in sorted(d):
        lignes.append('      %s: %s' % (json.dumps(cle, ensure_ascii=False),
                                        json.dumps(d[cle], ensure_ascii=False)))
    return ",\n".join(lignes)

contenu = '''/* ============================================================
   I18N.JS — bilinguisme FR/EN complet (blueprint v0.2 §8, étape 10)
   Français par défaut · bascule client sans rechargement ni changement
   d'URL · colonnes `_en` du CMS avec repli FR · aucun contenu inventé.

   Comment ça marche :
   — <html lang> suit la langue ; les éléments [data-i18n] reçoivent le
     texte traduit, [data-i18n-aria/-title/-placeholder/-content] les
     attributs correspondants.
   — Les textes français vivent dans les pages elles-mêmes : le site
     reste lisible en FR même sans JavaScript. Le dictionnaire ci-dessous
     n'est appliqué qu'au changement de langue.
   — Les contenus du Google Sheet suivent la langue via `champ()` :
     `titre_en` vide ⇒ titre FR (jamais de case vide).
   — Ajouter un texte : l'écrire en FR dans la page avec data-i18n="cle",
     puis renseigner la clé ici (fr + en).

   Fichier généré par `outils/generer-i18n.py` (à partir des textes des
   pages), puis maintenable à la main.
   ============================================================ */
(function () {
  "use strict";

  var CLE_STOCKAGE = "kj_langue";
  var LANGUES = ["fr", "en"];
  var DEFAUT = "fr";

  var DICT = {
    fr: {
%s
    },
    en: {
%s
    }
  };

  function stockageLire() {
    try { return window.localStorage.getItem(CLE_STOCKAGE); } catch (e) { return null; }
  }
  function stockageEcrire(l) {
    try { window.localStorage.setItem(CLE_STOCKAGE, l); } catch (e) { /* mode privé : sans effet */ }
  }

  /* Langue effective : choix du visiteur → clé CMS `langue_defaut` → fr */
  function langue() {
    var l = stockageLire();
    if (!l) {
      var p = window.PARAMS || {};
      var d = String(p.langue_defaut || "").toLowerCase().slice(0, 2);
      if (LANGUES.indexOf(d) !== -1) l = d;
    }
    return LANGUES.indexOf(l) === -1 ? DEFAUT : l;
  }

  /* Libellé traduit. `vars` remplit les {jetons} : t("art.aria.lire", {t: "…", p: "…"}) */
  function t(cle, vars) {
    var v = DICT[langue()][cle];
    if (v === undefined) v = DICT.fr[cle];
    if (v === undefined) return cle;
    if (vars) {
      v = String(v).replace(/\\{(\\w+)\\}/g, function (m, nom) {
        return vars[nom] === undefined ? m : vars[nom];
      });
    }
    return v;
  }

  /* Valeur CMS bilingue : `base_en` si la langue est EN et la valeur non
     vide, sinon la valeur française. */
  function champ(obj, base, secours) {
    if (!obj) return secours || "";
    if (langue() === "en") {
      var en = obj[base + "_en"];
      if (en !== undefined && en !== null && String(en).trim() !== "") return en;
    }
    var fr = obj[base];
    if (fr !== undefined && fr !== null && String(fr).trim() !== "") return fr;
    return secours || "";
  }

  /* Applique la langue au document */
  function appliquer() {
    var l = langue();
    document.documentElement.setAttribute("lang", l);
    function chaque(sel, fn) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), fn);
    }
    chaque("[data-i18n]", function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    chaque("[data-i18n-aria]", function (el) { el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))); });
    chaque("[data-i18n-title]", function (el) { el.setAttribute("title", t(el.getAttribute("data-i18n-title"))); });
    chaque("[data-i18n-placeholder]", function (el) { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder"))); });
    chaque("[data-i18n-content]", function (el) { el.setAttribute("content", t(el.getAttribute("data-i18n-content"))); });
    /* Une page peut porter son titre traduit dans <title data-i18n="…"> */
    chaque("[data-lang]", function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === l));
    });
  }

  function setLangue(l) {
    if (LANGUES.indexOf(l) === -1) return;
    stockageEcrire(l);
    appliquer();
    /* Les modules de contenu ré-injectent leurs textes avec les variantes `_en`.
       Événement émis sur `document` : il atteint les écouteurs posés sur
       document ET sur window (un événement émis sur window ne redescend pas). */
    document.dispatchEvent(new CustomEvent("kj:langue", { detail: { langue: l } }));
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-lang]") : null;
    if (b) setLangue(b.getAttribute("data-lang"));
  });

  document.addEventListener("DOMContentLoaded", appliquer);

  window.I18n = {
    langue: langue,
    setLangue: setLangue,
    t: t,
    champ: champ,
    appliquer: appliquer
  };
})();
''' % (bloc(fr), bloc(en))

open(os.path.join(RACINE, "js/i18n.js"), "w", encoding="utf-8").write(contenu)
print("js/i18n.js généré :", len(fr), "clés FR ·", len(en), "clés EN")
