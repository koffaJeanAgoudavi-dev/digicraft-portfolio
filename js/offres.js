/* ============================================================
   OFFRES.JS — Services & offres depuis l'onglet Offres
   ------------------------------------------------------------
   Phase 1 (2026-10-27) — parsing des nouveaux en-têtes :
     id, ordre, publie, titre, type, description,
     livrables (« ; »), stack (« , »), prix_display,
     cta_texte, cta_lien, mode_achat (DISCUSSION|DIRECT),
     mise_en_avant (TRUE|FALSE).

   Phase 2 (2026-10-28) — commutateur d'onglets + cartes :
     - commutateur 2 positions en haut de section :
       « Prestations Sur-Mesure » (mode_achat=DISCUSSION) /
       « Kits & Templates » (mode_achat=DIRECT) — bascule fluide
       sans rechargement (role=tablist/tab, flèches clavier) ;
     - filtres par TYPE conservés SOUS le commutateur (décision
       utilisateur) : filtrage combiné mode d'achat PUIS type ;
     - cartes .pricing-card : en-tête (badge type + titre +
       description), zone prix (prix_display), corps livrables ✓,
       stack (badges officiels du TOOLS_REGISTRY unifié), pied CTA ;
       mise_en_avant=TRUE → .pricing-card--highlight ;
     - STRICT (décision utilisateur) : une offre sans mode_achat
       valide n'apparaît dans AUCUN lot ; les deux lots vides →
       section masquée ;
     - lot vide → message d'état vide dans l'onglet (cliquable).

   Phase 3 (2026-10-28) — style « SaaS Pricing Table » :
     - prix sous le titre, avant la description (décision
       utilisateur) ;
     - carte phare : fond teinté lavande/violet (dégradé), ombre
       portée marquée, badge supérieur « LE PLUS DEMANDÉ »
       (offres.phare / MOST POPULAR en EN) ;
     - CTA hiérarchisés : contour violet sur les cartes standard,
       plein dégradé sur la carte phare ;
     - responsive : 3 colonnes ≥ 1024px, 1 colonne en dessous.

   Phase 4 (2026-10-28) — composant « Problème résolu » :
     colonne probleme_resolu (variante probleme_resolu_en) rendue
     juste sous la description en blockquote discret
     (.problem-solved-block / -label / -text).

   Variantes facultatives : titre_en, description_en, livrables_en,
   probleme_resolu_en, cta_texte_en. Sans GID publié, la section
   reste masquée.
   ============================================================ */
(function () {
  "use strict";

  /* État du commutateur (mode d'achat actif + filtre type actif). */
  var etat = { mode: "DISCUSSION", type: "" };

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

  /* Livrables : séparateur STRICT « ; » (décision utilisateur). */
  function listeLivrables(value) {
    return String(value || "")
      .split(";")
      .map(function (item) { return item.trim().replace(/^[-–—✓✔]\s*/, ""); })
      .filter(Boolean);
  }

  /* Stack : séparateur STRICT « , » — doublons ignorés. */
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

  /* ---------- normaliser() — objet propre par offre (Phase 1) ---------- */
  function normaliser(row) {
    var mode = String(window.Sheets.champ(row, ["mode_achat", "mode"], "") || "").trim().toUpperCase();
    return {
      id: window.Sheets.champ(row, ["id"], ""),
      slug: window.Sheets.champ(row, ["slug"], ""),
      ordre: window.Sheets.champ(row, ["ordre", "order"], ""),
      publie: published(row),
      titre: texte(row, "titre"),
      type: texte(row, "type"),
      description: texte(row, "description"),
      probleme_resolu: texte(row, "probleme_resolu"),
      livrables: listeLivrables(texte(row, "livrables")),
      stack: listeStack(texte(row, "stack")),
      prix_display: window.Sheets.champ(row, ["prix_display", "prix"], ""),
      cta_texte: texte(row, "cta_texte"),
      cta_lien: window.Sheets.safeExternalUrl(window.Sheets.champ(row, ["cta_lien", "cta_url"], "")),
      mode_achat: (mode === "DISCUSSION" || mode === "DIRECT") ? mode : "",
      mise_en_avant: window.Sheets.toBool(window.Sheets.champ(row, ["mise_en_avant", "mis_en_avant", "featured"], ""))
    };
  }

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

  /* ---------- parModeAchat() — moteur de filtrage (Phase 1) ---------- */
  function parModeAchat(offres, mode) {
    var cible = String(mode == null ? "" : mode).trim().toUpperCase();
    return (offres || []).filter(function (o) {
      return o.mode_achat === cible && (cible === "DISCUSSION" || cible === "DIRECT");
    });
  }

  /* ---------- Rendu (Phase 2) ---------- */
  function stackHtml(o) {
    if (!o.stack.length) return "";
    if (window.Prjs && typeof window.Prjs.badgeOutil === "function") {
      return '<div class="pricing-card-stack" aria-label="Stack technique">' +
        o.stack.map(function (jeton) { return window.Prjs.badgeOutil(jeton); }).join("") +
        "</div>";
    }
    /* Repli (projects.js absent) : puces textuelles. */
    return '<ul class="pricing-card-stack pricing-card-stack--text" aria-label="Stack technique">' +
      o.stack.map(function (jeton) { return "<li>" + esc(jeton) + "</li>"; }).join("") +
      "</ul>";
  }

  function card(o) {
    var corps = o.livrables.length
      ? '<div class="pricing-card-body"><p class="pricing-card-label" data-i18n="offres.livrables">Ce qui est inclus</p><ul>' + o.livrables.map(function (item) {
          return '<li><span class="pricing-check" aria-hidden="true">✓</span><span>' + esc(item) + "</span></li>";
        }).join("") + "</ul></div>"
      : "";
    var ctaHtml = o.cta_lien
      ? '<a class="btn pricing-card-cta" href="' + esc(o.cta_lien) + '"' + (/^https?:\/\//i.test(o.cta_lien) ? ' target="_blank" rel="noopener"' : "") + ">" + esc(o.cta_texte || "Découvrir l’offre") + ' <span class="arr" aria-hidden="true">→</span></a>'
      : "";
    /* Phase 4 : « Problème résolu » (probleme_resolu) juste sous la
       description principale — style blockquote discret. */
    var probleme = o.probleme_resolu
      ? '<div class="problem-solved-block"><span class="problem-solved-label" data-i18n="offres.probleme">PROBLÈME RÉSOLU</span><p class="problem-solved-text">' + esc(o.probleme_resolu) + "</p></div>"
      : "";
    /* Phase 3 : badge « LE PLUS DEMANDÉ » sur la carte phare, prix
       sous le titre (avant la description) — décision utilisateur. */
    return '<article class="pricing-card' + (o.mise_en_avant ? " pricing-card--highlight" : "") + '">' +
      (o.mise_en_avant ? '<span class="pricing-card-flag" data-i18n="offres.phare">LE PLUS DEMANDÉ</span>' : "") +
      '<header class="pricing-card-head">' +
        (o.type ? '<span class="pricing-card-type">' + esc(o.type) + "</span>" : "") +
        '<h3 class="pricing-card-titre">' + esc(o.titre) + "</h3>" +
        (o.prix_display ? '<p class="pricing-card-prix">' + esc(o.prix_display) + "</p>" : "") +
        (o.description ? '<p class="pricing-card-desc">' + esc(o.description) + "</p>" : "") +
      "</header>" +
      probleme +
      corps +
      '<div class="pricing-card-bottom">' + stackHtml(o) + ctaHtml + "</div>" +
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
    filter.hidden = types.length === 0;
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

  function paint(container, offers, animate) {
    var html = offers.map(card).join("");
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

  /* Synchronise le commutateur avec le mode actif : état visuel,
     aria-selected, tabindex (parcours clavier) et aria-labelledby de
     la grille. */
  function syncTabs(container) {
    var tabs = document.getElementById("tabs-offres");
    if (!tabs) return;
    var boutons = tabs.querySelectorAll("[data-offres-mode]");
    Array.prototype.forEach.call(boutons, function (b) {
      var actif = b.getAttribute("data-offres-mode") === etat.mode;
      b.classList.toggle("is-active", actif);
      b.setAttribute("aria-selected", actif ? "true" : "false");
      b.setAttribute("tabindex", actif ? "0" : "-1");
      if (actif && b.id) container.setAttribute("aria-labelledby", b.id);
    });
  }

  function render(container, filter) {
    return recuperer().then(function (offers) {
      var section = container.closest("[data-offres-section]");
      var cta = document.querySelector("[data-offres-cta]");
      var discussion = parModeAchat(offers, "DISCUSSION");
      var direct = parModeAchat(offers, "DIRECT");

      /* Aucune offre, ou aucune avec un mode d'achat valide (strict) :
         la section entière disparaît, comme le CTA du hero. */
      if (!offers.length || (!discussion.length && !direct.length)) {
        container.innerHTML = "";
        if (filter) { filter.innerHTML = ""; filter.hidden = true; }
        if (section) section.hidden = true;
        if (cta) cta.hidden = true;
        return;
      }

      /* Atterrissage (premier rendu uniquement) : si le lot du mode
         actif est vide, basculer sur l'autre lot. Ensuite, un clic
         utilisateur sur un onglet vide affiche le message d'état
         vide — l'onglet reste cliquable (décision utilisateur). */
      var lot = parModeAchat(offers, etat.mode);
      if (!lot.length && !etat.amarre) {
        etat.mode = discussion.length ? "DISCUSSION" : "DIRECT";
        etat.type = "";
        lot = parModeAchat(offers, etat.mode);
      }
      etat.amarre = true;

      if (section) section.hidden = false;
      if (cta) cta.hidden = false;
      syncTabs(container);

      /* Lot vide (l'autre est rempli) : message d'état vide propre,
         onglet cliquable — décision utilisateur. */
      if (!lot.length) {
        renderFilters(filter, lot, "");
        container.innerHTML = '<p class="offers-empty">' +
          esc(window.I18n && window.I18n.t ? window.I18n.t("offres.vide.lot", null, "Aucune offre dans cette catégorie pour le moment.") : "Aucune offre dans cette catégorie pour le moment.") +
          "</p>";
        container.setAttribute("aria-busy", "false");
        return;
      }

      /* Filtre type : conservé seulement s'il existe dans le lot actif. */
      if (etat.type && !lot.some(function (o) { return typeKey(o) === etat.type; })) etat.type = "";
      renderFilters(filter, lot, etat.type);
      var visibles = etat.type ? lot.filter(function (o) { return typeKey(o) === etat.type; }) : lot;
      paint(container, visibles, false);
      if (window.I18n && typeof window.I18n.appliquer === "function") window.I18n.appliquer();
      container._offresRows = offers;
      container._offresFilter = filter;
    }).catch(function (error) {
      console.error("[Offres] Échec de chargement :", error);
      container.innerHTML = "";
      if (filter) { filter.innerHTML = ""; filter.hidden = true; }
      var section = container.closest("[data-offres-section]");
      if (section) section.hidden = true;
      var cta = document.querySelector("[data-offres-cta]");
      if (cta) cta.hidden = true;
    });
  }

  function basculerMode(container, filter, mode) {
    var cible = String(mode || "").trim().toUpperCase();
    if (cible !== "DISCUSSION" && cible !== "DIRECT") return;
    if (cible === etat.mode) return;
    etat.mode = cible;
    etat.type = "";   /* les types diffèrent d'un lot à l'autre */
    render(container, filter);
  }

  function init() {
    var container = document.getElementById("grille-offres");
    if (!container) return;
    var filter = document.getElementById("filtres-offres");
    var tabs = document.getElementById("tabs-offres");

    render(container, filter);

    /* Commutateur : clic + navigation clavier (flèches). */
    if (tabs) {
      tabs.addEventListener("click", function (event) {
        var button = event.target.closest ? event.target.closest("[data-offres-mode]") : null;
        if (button) basculerMode(container, filter, button.getAttribute("data-offres-mode"));
      });
      tabs.addEventListener("keydown", function (event) {
        var pas = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!pas) return;
        var boutons = Array.prototype.slice.call(tabs.querySelectorAll("[data-offres-mode]"));
        var i = boutons.indexOf(event.target);
        if (i === -1) return;
        event.preventDefault();
        var suivant = boutons[(i + pas + boutons.length) % boutons.length];
        if (suivant) {
          suivant.focus();
          basculerMode(container, filter, suivant.getAttribute("data-offres-mode"));
        }
      });
    }

    /* Filtres par type : filtrage À L'INTÉRIEUR du lot actif. */
    if (filter) filter.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("[data-offres-filter]") : null;
      if (!button || !container._offresRows) return;
      etat.type = button.getAttribute("data-offres-filter") || "";
      var lot = parModeAchat(container._offresRows, etat.mode);
      renderFilters(filter, lot, etat.type);
      var visibles = etat.type ? lot.filter(function (o) { return typeKey(o) === etat.type; }) : lot;
      paint(container, visibles, true);
    });

    document.addEventListener("kj:langue", function () { render(container, filter); });
  }

  window.Offres = {
    init: init,
    render: render,
    recuperer: recuperer,
    normaliser: normaliser,
    parModeAchat: parModeAchat
  };
})();
