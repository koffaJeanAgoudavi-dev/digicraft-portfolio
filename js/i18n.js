/* ============================================================
   I18N.JS — base bilingue FR/EN (blueprint v0.2 §8)
   Étape 2 : socle posé — état de langue, sélecteur, dictionnaire
   des libellés d'interface du dock et du hero, helper `champ()`
   pour lire les colonnes `_en` du CMS.

   Règles appliquées :
   — Français par défaut (surchargé par la clé CMS `langue_defaut`).
   — Une valeur `_en` vide ⇒ repli sur le français (jamais de vide).
   — Choix mémorisé en localStorage ; AUCUNE URL modifiée.
   — L'étape 10 étendra le dictionnaire à toutes les pages.
   ============================================================ */
(function () {
  "use strict";

  var CLE_STOCKAGE = "kj_langue";
  var LANGUES = ["fr", "en"];
  var DEFaut = "fr";

  /* ---------- Dictionnaire des libellés d'interface ----------
     (les contenus éditoriaux, eux, viennent du CMS via les clés `_en`) */
  var DICT = {
    fr: {
      "nav.accueil": "Accueil",
      "nav.expertise": "Expertise",
      "nav.realisations": "Réalisations",
      "nav.activite": "Activité",
      "nav.parcours": "Parcours",
      "nav.apropos": "À propos",
      "nav.contact": "Contact",
      "dock.portfolio": "Portfolio",
      "dock.more": "Plus",
      "dock.nav": "Navigation",
      "dock.ressources": "Ressources",
      "dock.cookies": "Gérer mes cookies",
      "dock.close": "Fermer",
      "lang.label": "Langue du site",
      "hero.portfolio": "Portfolio personnel",
      "hero.badge": "Fondateur",
      "hero.contact": "Me contacter",
      "hero.stat.projets": "Projets",
      "hero.stat.workflows": "Workflows",
      "hero.stat.certifs": "Certifications"
    },
    en: {
      "nav.accueil": "Home",
      "nav.expertise": "Expertise",
      "nav.realisations": "Work",
      "nav.activite": "Activity",
      "nav.parcours": "Journey",
      "nav.apropos": "About",
      "nav.contact": "Contact",
      "dock.portfolio": "Portfolio",
      "dock.more": "More",
      "dock.nav": "Navigation",
      "dock.ressources": "Resources",
      "dock.cookies": "Manage cookies",
      "dock.close": "Close",
      "lang.label": "Site language",
      "hero.portfolio": "Personal portfolio",
      "hero.badge": "Founder",
      "hero.contact": "Get in touch",
      "hero.stat.projets": "Projects",
      "hero.stat.workflows": "Workflows",
      "hero.stat.certifs": "Certifications"
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
    return LANGUES.indexOf(l) === -1 ? DEFaut : l;
  }

  /* Libellé d'interface traduit (repli : français → secours → clé) */
  function t(cle, secours) {
    var l = langue();
    if (DICT[l] && DICT[l][cle] !== undefined) return DICT[l][cle];
    if (DICT.fr[cle] !== undefined) return DICT.fr[cle];
    return secours !== undefined ? secours : cle;
  }

  /* Valeur CMS bilingue : `base_en` si langue = en et valeur non vide,
     sinon valeur française. Utilisé par main.js (hero) puis par les
     modules de contenu à l'étape 10. */
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

  /* Applique la langue au document : <html lang>, libellés data-i18n,
     état des boutons FR/EN. */
  function appliquer() {
    var l = langue();
    document.documentElement.setAttribute("lang", l);
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n]"), function (el) {
      el.textContent = t(el.getAttribute("data-i18n"), el.textContent);
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-aria]"), function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-i18n-title]"), function (el) {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-lang]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === l));
    });
  }

  function setLangue(l) {
    if (LANGUES.indexOf(l) === -1) return;
    stockageEcrire(l);
    appliquer();
    /* Les modules de contenu (main.js aujourd'hui, les autres à l'étape 10)
       ré-injectent leurs textes avec les variantes `_en`. */
    window.dispatchEvent(new CustomEvent("kj:langue", { detail: { langue: l } }));
  }

  /* Délégation : tout élément [data-lang] bascule la langue */
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
