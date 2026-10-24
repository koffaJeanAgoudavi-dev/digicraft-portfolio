/* ============================================================
   OFFRES.JS — Services & offres depuis l'onglet Offres
   ------------------------------------------------------------
   Colonnes attendues : id, type, titre, description, livrables,
   stack, cta_texte, cta_lien, ordre, publie.
   Variantes facultatives : titre_en, description_en, livrables_en,
   cta_texte_en. Sans GID publié, la section reste masquée.
   ============================================================ */
(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  function texte(row, base) {
    if (window.I18n && typeof window.I18n.champ === "function") {
      return window.I18n.champ(row, base, "");
    }
    return String(row && row[base] || "").trim();
  }

  function liste(value) {
    return String(value || "")
      .split(/[|;\n•]+/)
      .map(function (item) { return item.trim().replace(/^[-–—✓✔]\s*/, ""); })
      .filter(Boolean);
  }

  function published(row) {
    return window.Sheets.toBool(window.Sheets.champ(row, ["publie", "published"], ""));
  }

  function card(row) {
    var type = texte(row, "type");
    var title = texte(row, "titre");
    var description = texte(row, "description");
    var deliverables = liste(texte(row, "livrables") || row.livrables);
    var stack = liste(texte(row, "stack") || row.stack);
    var ctaText = texte(row, "cta_texte") || "Découvrir l’offre";
    var ctaLink = window.Sheets.safeExternalUrl(window.Sheets.champ(row, ["cta_lien", "cta_url"], ""));
    var deliverablesHtml = deliverables.length
      ? '<div class="offer-deliverables"><p class="offer-label" data-i18n="offres.livrables">Ce qui est inclus</p><ul>' + deliverables.map(function (item) {
          return '<li><span class="offer-check" aria-hidden="true">✓</span><span>' + esc(item) + '</span></li>';
        }).join("") + '</ul></div>'
      : "";
    var stackHtml = stack.length
      ? '<ul class="offer-stack" aria-label="Stack technique">' + stack.map(function (item) {
          return '<li>' + esc(item) + '</li>';
        }).join("") + '</ul>'
      : "";
    var ctaHtml = ctaLink
      ? '<a class="btn btn-gold offer-cta" href="' + esc(ctaLink) + '"' + (/^https?:\/\//i.test(ctaLink) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(ctaText) + ' <span class="arr" aria-hidden="true">→</span></a>'
      : "";
    return '<article class="offer-card card-hover">' +
      (type ? '<span class="offer-type">' + esc(type) + '</span>' : '') +
      '<h3>' + esc(title) + '</h3>' +
      (description ? '<p class="offer-description">' + esc(description) + '</p>' : '') +
      deliverablesHtml +
      '<div class="offer-bottom">' + stackHtml + ctaHtml + '</div>' +
      '</article>';
  }

  function render(container) {
    return window.Sheets.loadSheet("offres").then(function (rows) {
      var section = container.closest("[data-offres-section]");
      var offers = (rows || []).filter(published).sort(window.Sheets.byOrder);
      if (!offers.length) {
        container.innerHTML = "";
        if (section) section.hidden = true;
        return;
      }
      container.innerHTML = offers.map(card).join("");
      if (section) section.hidden = false;
      if (window.I18n && typeof window.I18n.appliquer === "function") window.I18n.appliquer();
    }).catch(function (error) {
      console.error("[Offres] Échec de chargement :", error);
      container.innerHTML = "";
      var section = container.closest("[data-offres-section]");
      if (section) section.hidden = true;
    });
  }

  function init() {
    var container = document.getElementById("grille-offres");
    if (!container) return;
    render(container);
    document.addEventListener("kj:langue", function () { render(container); });
  }

  window.Offres = { init: init, render: render };
})();
