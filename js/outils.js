/* ============================================================
   OUTILS.JS — Boîte à outils pilotée par Google Sheets
   Onglet attendu : id, nom, logo, categorie, categorie_en, featured, ordre
   ============================================================ */
(function () {
  "use strict";

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c];
    });
  }

  function text(row, key) {
    return window.Sheets.champ(row, [key], "") || "";
  }

  function category(row) {
    var fr = text(row, "categorie") || "Autres";
    var en = text(row, "categorie_en") || fr;
    var language = window.I18n && window.I18n.langue ? window.I18n.langue() : "fr";
    return { fr: fr, en: en, label: language === "en" ? en : fr };
  }

  function genericLogo() {
    return (window.SITE_ROOT || "") + "assets/brands/outils/generic.svg";
  }

  function logoUrl(row) {
    var raw = text(row, "logo");
    return raw ? window.Sheets.safeImageUrl(raw) : "";
  }

  function order(row, index) {
    var value = parseFloat(String(text(row, "ordre")).replace(",", "."));
    return isNaN(value) ? [Number.POSITIVE_INFINITY, index] : [value, index];
  }

  function render(rows) {
    var mount = document.querySelector("[data-outils-list]");
    if (!mount) return;
    var grouped = Object.create(null);
    (rows || []).forEach(function (row, index) {
      var name = text(row, "nom");
      if (!name) return;
      var cat = category(row);
      var key = cat.fr + "\u0000" + cat.en;
      if (!grouped[key]) grouped[key] = { cat: cat, rows: [] };
      grouped[key].rows.push({ row: row, index: index });
    });

    var groups = Object.keys(grouped).map(function (key) { return grouped[key]; });
    groups.forEach(function (group) {
      group.rows.sort(function (a, b) {
        var oa = order(a.row, a.index), ob = order(b.row, b.index);
        return oa[0] - ob[0] || oa[1] - ob[1];
      });
    });

    mount.innerHTML = groups.map(function (group) {
      var items = group.rows.map(function (entry) {
        var row = entry.row;
        var name = text(row, "nom");
        var url = logoUrl(row);
        var image = url
          ? '<img class="outils-logo" src="' + esc(url) + '" alt="' + esc(name) + '" width="22" height="22" loading="lazy" decoding="async" data-outils-logo>'
          : '<img class="outils-logo" src="' + esc(genericLogo()) + '" alt="' + esc(name) + '" width="22" height="22" loading="lazy" decoding="async">';
        return '<li class="outils-pill"><span class="outils-logo-wrap">' + image + '</span><span>' + esc(name) + '</span></li>';
      }).join("");
      return '<div class="outils-group"><h3 class="outils-category">' + esc(group.cat.label) + '</h3><ul class="outils-list">' + items + '</ul></div>';
    }).join("");

    if (!groups.length) {
      mount.innerHTML = '<p class="outils-empty">' + esc((window.I18n && window.I18n.t && window.I18n.t("outils.vide", null, "Aucun outil à afficher.")) || "Aucun outil à afficher.") + '</p>';
    }

    Array.prototype.forEach.call(mount.querySelectorAll("[data-outils-logo]"), function (img) {
      img.addEventListener("error", function () {
        img.onerror = null;
        img.src = genericLogo();
      }, { once: true });
    });
  }

  function init() {
    if (!window.Sheets || !document.querySelector("[data-outils-list]")) return;
    window.Sheets.loadSheet("outils").then(render).catch(function () {
      render([]);
    });
  }

  window.Outils = { init: init, render: render };
  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("kj:langue", init);
})();
