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

  function typeKey(row) {
    return String(row && row.type || "").trim();
  }

  function renderFilters(filter, offers, active) {
    if (!filter) return;
    var types = [];
    offers.forEach(function (row) {
      var type = typeKey(row);
      if (type && types.indexOf(type) === -1) types.push(type);
    });
    filter.innerHTML = ['<button type="button" class="offers-filter-btn' + (!active ? ' is-active' : '') +
      '" data-offres-filter="" aria-pressed="' + (!active ? 'true' : 'false') + '">' +
      esc(window.I18n && window.I18n.t ? window.I18n.t("offres.filtre.tous", null, "Tous") : "Tous") + '</button>']
      .concat(types.map(function (type) {
        var selected = type === active;
        return '<button type="button" class="offers-filter-btn' + (selected ? ' is-active' : '') +
          '" data-offres-filter="' + esc(type) + '" aria-pressed="' + (selected ? 'true' : 'false') + '">' +
          esc(type) + '</button>';
      })).join("");
  }

  function paint(container, filter, offers, active) {
    renderFilters(filter, offers, active);
    var visible = active ? offers.filter(function (row) { return typeKey(row) === active; }) : offers;
    container.innerHTML = visible.map(card).join("");
    container.setAttribute("aria-busy", "false");
  }

  function render(container, filter, activeType) {
    return window.Sheets.loadSheet("offres").then(function (rows) {
      var section = container.closest("[data-offres-section]");
      var offers = (rows || []).filter(published).sort(window.Sheets.byOrder);
      if (!offers.length) {
        container.innerHTML = "";
        if (filter) filter.innerHTML = "";
        if (section) section.hidden = true;
        return;
      }
      var active = activeType && offers.some(function (row) { return typeKey(row) === activeType; }) ? activeType : "";
      paint(container, filter, offers, active);
      if (section) section.hidden = false;
      if (window.I18n && typeof window.I18n.appliquer === "function") window.I18n.appliquer();
      container._offresRows = offers;
      container._offresFilter = filter;
      container._offresActive = active;
    }).catch(function (error) {
      console.error("[Offres] Échec de chargement :", error);
      container.innerHTML = "";
      if (filter) filter.innerHTML = "";
      var section = container.closest("[data-offres-section]");
      if (section) section.hidden = true;
    });
  }

  function init() {
    var container = document.getElementById("grille-offres");
    if (!container) return;
    var filter = document.getElementById("filtres-offres");
    render(container, filter, "");
    if (filter) filter.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("[data-offres-filter]") : null;
      if (!button || !container._offresRows) return;
      var active = button.getAttribute("data-offres-filter") || "";
      container._offresActive = active;
      paint(container, filter, container._offresRows, active);
    });
    document.addEventListener("kj:langue", function () { render(container, filter, container._offresActive || ""); });
  }

  window.Offres = { init: init, render: render };
})();
