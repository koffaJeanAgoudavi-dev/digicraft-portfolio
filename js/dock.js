/* ============================================================
   DOCK.JS — Side Dock Bar (v2, blueprint v0.2 §3)
   — Feuille mobile « Plus » (barre basse → panneau)
   — Affichage de la pastille de disponibilité quand la clé
     `statut_disponibilite` du CMS est renseignée (sinon masquée)
   Aucune dépendance à main.js : si le dock est absent de la page,
   le script ne fait rien.
   ============================================================ */
(function () {
  "use strict";

  function qs(s, c) { return (c || document).querySelector(s); }
  function qsa(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  /* ---------- Feuille « Plus » (mobile) ---------- */
  function initSheet() {
    var sheet = qs(".dock-sheet");
    var more = qs(".dock-more");
    if (!sheet || !more) return;
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      sheet.hidden = false;
      more.setAttribute("aria-expanded", "true");
      document.body.classList.add("dock-sheet-open");
      var first = qs(".dock-sheet-close", sheet);
      if (first) first.focus();
    }
    function close() {
      sheet.hidden = true;
      more.setAttribute("aria-expanded", "false");
      document.body.classList.remove("dock-sheet-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    more.addEventListener("click", function () {
      if (sheet.hidden) { open(); } else { close(); }
    });
    qsa("[data-dock-close]", sheet).forEach(function (el) {
      el.addEventListener("click", close);
    });
    sheet.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !sheet.hidden) close();
    });
  }

  /* ---------- Pastille de disponibilité (clé statut_disponibilite) ----------
     main.js injecte le texte de [data-p-statut] de façon asynchrone
     (lecture du Google Sheet). Ici, on ne fait qu'afficher/masquer le
     conteneur selon que le CMS a fourni une valeur : vide → masqué. */
  function initAvailability() {
    var span = qs("[data-p-statut]");
    var wrap = qs(".dock-avail");
    if (!span || !wrap) return;

    function sync() {
      var txt = (span.textContent || "").trim();
      wrap.hidden = !txt;
    }
    sync();
    if ("MutationObserver" in window) {
      new MutationObserver(sync).observe(span, { childList: true, characterData: true, subtree: true });
    }
    /* filet de sécurité si l'injection CMS arrive après le premier rendu */
    window.setTimeout(sync, 2500);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSheet();
    initAvailability();
  });
})();
