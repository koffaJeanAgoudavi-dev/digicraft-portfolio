/* ============================================================
   SEO.JS — Canonique & Open Graph centralisés (QG, Étape 3)
   ------------------------------------------------------------
   Décision n°6 : aucune URL absolue codée en dur hors de
   `CONFIG.siteUrl`. Ce script aligne <link rel="canonical">,
   og:url, og:image et twitter:image sur l'origine réellement
   servie :
     - production (koffajeanagoudavi.com) → domaine canonique
     - previews Cloudflare / local        → origine courante
   Les métadonnées STATIQUES du HTML restent le repli pour les
   crawlers sans JavaScript. Les fiches projet dynamiques gardent
   leur canonique propre (/projets/<slug>/) : la valeur calculée
   ici est identique (origine + chemin courant).
   ============================================================ */
(function () {
  "use strict";

  function appliquer() {
    try {
      var C = window.CONFIG;
      if (!C || typeof C.siteOrigin !== "function") return;
      var origine = String(C.siteOrigin() || "").replace(/\/+$/, "");
      if (!origine) return;

      /* Chemin courant normalisé (index.html retiré, slash final ajouté) */
      var p = window.location.pathname.replace(/index\.html$/i, "");
      if (p.charAt(p.length - 1) !== "/") p += "/";
      var url = origine + p;

      var canon = document.querySelector('link[rel="canonical"]');
      if (canon) canon.setAttribute("href", url);

      var og = document.querySelector('meta[property="og:url"]');
      if (og) og.setAttribute("content", url);

      /* Images sociales : mêmes chemins, origine réellement servie */
      ["meta[property='og:image']", "meta[name='twitter:image']"].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        var m = String(el.getAttribute("content") || "").match(/(\/assets\/[^?#]*)$/);
        if (m) el.setAttribute("content", origine + m[1]);
      });
    } catch (e) { /* les métadonnées statiques du HTML restent en place */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", appliquer);
  } else {
    appliquer();
  }
  /* Les Parametres du Sheet peuvent préciser l'origine : on réapplique. */
  document.addEventListener("digicraft:params", appliquer);
})();
