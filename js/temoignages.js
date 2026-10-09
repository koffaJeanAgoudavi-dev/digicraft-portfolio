/* ============================================================
   TEMOIGNAGES.JS — retours clients optionnels du Sheet
   ------------------------------------------------------------
   La section reste entièrement absente si l'onglet n'est pas configuré,
   vide ou sans ligne featured=TRUE.
   ============================================================ */
(function () {
  "use strict";
  function qs(s, c) { return (c || document).querySelector(s); }
  function qsa(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function text(el, value) { if (el) el.textContent = value || ""; }
  function init() {
    var section = qs("[data-gr-testimonials]");
    var list = qs("[data-gr-testimonials-list]");
    if (!section || !list || !window.Sheets) return;
    window.Sheets.loadSheet("temoignages").then(function (rows) {
      var featured = (rows || []).filter(function (r) { return window.Sheets.toBool(r.featured); })
        .sort(window.Sheets.byOrder).slice(0, 3);
      if (!featured.length) return;
      var en = window.I18n && window.I18n.langue && window.I18n.langue() === "en";
      var frag = document.createDocumentFragment();
      featured.forEach(function (r) {
        var card = document.createElement("article"); card.className = "gr-testimonial-card";
        var quote = document.createElement("p"); quote.className = "gr-testimonial-text";
        text(quote, en ? (r.texte_en || r.texte) : r.texte); card.appendChild(quote);
        var meta = document.createElement("div"); meta.className = "gr-testimonial-meta";
        var name = document.createElement("strong"); text(name, r.nom); meta.appendChild(name);
        var identity = [r.role, r.entreprise].filter(Boolean).join(" · ");
        if (identity) { var id = document.createElement("span"); text(id, identity); meta.appendChild(id); }
        var source = window.Sheets.safeExternalUrl(r.source_url);
        if (source) { var link = document.createElement("a"); link.className = "gr-testimonial-source"; link.href = source; link.target = "_blank"; link.rel = "noopener"; text(link, window.I18n && window.I18n.t ? window.I18n.t("accueil.temoignages.source") : "Voir la source"); meta.appendChild(link); }
        card.appendChild(meta); frag.appendChild(card);
      });
      list.appendChild(frag); section.hidden = false;
    }).catch(function () { /* Onglet optionnel : aucun bruit ni contenu d'exemple. */ });
  }
  window.Temoignages = { init: init };
})();
