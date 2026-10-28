/* ============================================================
   OFFRES.JS — Services & offres depuis l'onglet Offres
   ------------------------------------------------------------
   Phase 1 (refonte 2026-10-27) — nouveaux en-têtes du Sheet :
     id, ordre, publie, titre, type, description,
     livrables   (items séparés par des « ; »),
     stack       (outils séparés par des « , »),
     prix_display, cta_texte, cta_lien,
     mode_achat  (DISCUSSION ou DIRECT),
     mise_en_avant (TRUE ou FALSE).

   Décisions utilisateur (2026-10-27) :
     - mode_achat VIDE/absent → l'offre est EXCLUE des deux lots ;
     - séparateurs STRICTS : « ; » pour livrables, « , » pour stack ;
     - prix_display est LU et normalisé mais AFFICHÉ en Phase 2 ;
     - pas de variante prix_display_en (prix identique FR/EN).
   Variantes facultatives : titre_en, description_en, livrables_en,
   cta_texte_en. Sans GID publié, la section reste masquée.

   Badges de stack : le TOOLS_REGISTRY unifié (onglet « outils »,
   même source que la boîte à outils de /a-propos/) fournit les
   logos officiels dès que projects.js est chargé ; sans lui, repli
   sur les puces textuelles d'origine.
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

  /* Livrables : séparateur STRICT « ; » (décision utilisateur) — la
     virgule et le retour à la ligne ne découpent PAS. Le préfixe de
     puce (✓, -) éventuel est nettoyé, le rendu ajoute son propre ✓. */
  function listeLivrables(value) {
    return String(value || "")
      .split(";")
      .map(function (item) { return item.trim().replace(/^[-–—✓✔]\s*/, ""); })
      .filter(Boolean);
  }

  /* Stack : séparateur STRICT « , » (décision utilisateur) — le « ; »
     ne découpe PAS. Doublons ignorés (première occurrence). */
  function listeStack(value) {
    var vus = Object.create(null);
    return String(value || "")
      .split(",")
      .map(function (item) { return item.trim(); })
      .filter(function (item) {
        if (!item) return false;
        var cle = item.toLowerCase();
        if (vus[cle]) return false;
        vus[cle] = true;
        return true;
      });
  }

  function published(row) {
    return window.Sheets.toBool(window.Sheets.champ(row, ["publie", "published"], ""));
  }

  /* ---------- normaliser() — objet propre par offre (Phase 1) ----------
     Lit les 13 champs des nouveaux en-têtes. mode_achat est mis en
     MAJUSCULES et ramené à "" s'il n'est ni DISCUSSION ni DIRECT :
     une telle offre n'apparaît dans AUCUN lot de parModeAchat(). */
  function normaliser(row) {
    var mode = String(window.Sheets.champ(row, ["mode_achat", "mode"], "") || "").trim().toUpperCase();
    return {
      id: window.Sheets.champ(row, ["id"], ""),
      ordre: window.Sheets.champ(row, ["ordre", "order"], ""),
      publie: published(row),
      titre: texte(row, "titre"),
      type: texte(row, "type"),
      description: texte(row, "description"),
      livrables: listeLivrables(texte(row, "livrables")),
      stack: listeStack(texte(row, "stack")),
      /* Lu mais non affiché : le rendu du prix arrive en Phase 2.
         Champ direct (sans variante _en — décision utilisateur). */
      prix_display: window.Sheets.champ(row, ["prix_display", "prix"], ""),
      cta_texte: texte(row, "cta_texte"),
      cta_lien: window.Sheets.safeExternalUrl(window.Sheets.champ(row, ["cta_lien", "cta_url"], "")),
      mode_achat: (mode === "DISCUSSION" || mode === "DIRECT") ? mode : "",
      mise_en_avant: window.Sheets.toBool(window.Sheets.champ(row, ["mise_en_avant", "mis_en_avant", "featured"], ""))
    };
  }

  /* ---------- recuperer() — offres publiées, triées ----------
     Le registre unifié des outils est chargé en parallèle quand
     projects.js est présent : les badges de stack rendent alors les
     logos officiels dès le premier rendu. */
  function attendreRegistre() {
    return (window.Prjs && typeof window.Prjs.chargerOutils === "function")
      ? window.Prjs.chargerOutils()
      : Promise.resolve();
  }

  function recuperer() {
    return Promise.all([window.Sheets.loadSheet("offres"), attendreRegistre()]).then(function (res) {
      var rows = res[0] || [];
      return rows
        .map(normaliser)
        .filter(function (o) { return o.publie && o.titre; })
        .sort(window.Sheets.byOrder);
    });
  }

  /* ---------- parModeAchat() — moteur de filtrage (Phase 1) ----------
     Renvoie le lot d'offres dont mode_achat === mode (casse et
     espaces indifférents). Les offres sans mode d'achat valide sont
     exclues des DEUX lots (décision utilisateur). */
  function parModeAchat(offres, mode) {
    var cible = String(mode == null ? "" : mode).trim().toUpperCase();
    return (offres || []).filter(function (o) {
      return o.mode_achat === cible && (cible === "DISCUSSION" || cible === "DIRECT");
    });
  }

  /* ---------- Rendu ---------- */
  function stackHtml(o) {
    if (!o.stack.length) return "";
    if (window.Prjs && typeof window.Prjs.badgeOutil === "function") {
      return '<div class="stack-badges" aria-label="Stack technique">' +
        o.stack.map(function (jeton) { return window.Prjs.badgeOutil(jeton); }).join("") +
        "</div>";
    }
    /* Repli (projects.js absent) : puces textuelles d'origine. */
    return '<ul class="offer-stack" aria-label="Stack technique">' +
      o.stack.map(function (jeton) { return "<li>" + esc(jeton) + "</li>"; }).join("") +
      "</ul>";
  }

  function card(o) {
    var deliverablesHtml = o.livrables.length
      ? '<div class="offer-deliverables"><p class="offer-label" data-i18n="offres.livrables">Ce qui est inclus</p><ul>' + o.livrables.map(function (item) {
          return '<li><span class="offer-check" aria-hidden="true">✓</span><span>' + esc(item) + '</span></li>';
        }).join("") + '</ul></div>'
      : "";
    var ctaHtml = o.cta_lien
      ? '<a class="btn btn-gold offer-cta" href="' + esc(o.cta_lien) + '"' + (/^https?:\/\//i.test(o.cta_lien) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(o.cta_texte || "Découvrir l’offre") + ' <span class="arr" aria-hidden="true">→</span></a>'
      : "";
    return '<article class="offer-card card-hover">' +
      (o.type ? '<span class="offer-type">' + esc(o.type) + '</span>' : '') +
      "<h3>" + esc(o.titre) + "</h3>" +
      (o.description ? '<p class="offer-description">' + esc(o.description) + "</p>" : "") +
      deliverablesHtml +
      '<div class="offer-bottom">' + stackHtml(o) + ctaHtml + "</div>" +
      "</article>";
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
          esc(type) + "</button>";
      })).join("");
  }

  function paint(container, filter, offers, active, animate) {
    renderFilters(filter, offers, active);
    var visible = active ? offers.filter(function (row) { return typeKey(row) === active; }) : offers;
    var html = visible.map(card).join("");
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduceMotion || !container.children.length) {
      container.innerHTML = html;
      container.setAttribute("aria-busy", "false");
      return;
    }
    var token = (container._offresAnimationToken || 0) + 1;
    container._offresAnimationToken = token;
    container.classList.remove("is-entering", "is-leaving");
    void container.offsetWidth;
    container.classList.add("is-leaving");
    window.setTimeout(function () {
      if (container._offresAnimationToken !== token) return;
      container.innerHTML = html;
      container.setAttribute("aria-busy", "false");
      container.classList.remove("is-leaving");
      container.classList.add("is-entering");
      window.requestAnimationFrame(function () {
        if (container._offresAnimationToken === token) container.classList.remove("is-entering");
      });
    }, 180);
  }

  function render(container, filter, activeType) {
    return recuperer().then(function (offers) {
      var section = container.closest("[data-offres-section]");
      var cta = document.querySelector("[data-offres-cta]");
      if (!offers.length) {
        container.innerHTML = "";
        if (filter) filter.innerHTML = "";
        if (section) section.hidden = true;
        if (cta) cta.hidden = true;
        return;
      }
      var active = activeType && offers.some(function (row) { return typeKey(row) === activeType; }) ? activeType : "";
      paint(container, filter, offers, active, false);
      if (section) section.hidden = false;
      if (cta) cta.hidden = false;
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
      var cta = document.querySelector("[data-offres-cta]");
      if (cta) cta.hidden = true;
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
      paint(container, filter, container._offresRows, active, true);
    });
    document.addEventListener("kj:langue", function () { render(container, filter, container._offresActive || ""); });
  }

  window.Offres = {
    init: init,
    render: render,
    /* Phase 1 : parsing et moteur de filtrage exposés (tests + Phase 2). */
    recuperer: recuperer,
    normaliser: normaliser,
    parModeAchat: parModeAchat
  };
})();
