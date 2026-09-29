/* ============================================================
   CONSENT.JS — Gestion du consentement cookies / confidentialité
   ------------------------------------------------------------
   - Bannière de consentement (1re visite) + panneau de préférences
     (« Gérer mes cookies ») + panneau d'information cookies.
   - Google Consent Mode v2 : les états par défaut (denied) sont
     poussés AVANT tout chargement de GA4 ; `ad_storage`,
     `ad_user_data`, `ad_personalization` restent toujours denied
     (le site n'utilise pas de publicité).
   - Microsoft Clarity n'est chargé qu'après acceptation des
     statistiques ; l'API officielle `clarity("consent", …)` est
     aussi appelée pour respecter la configuration Clarity.
   - Stockage : localStorage, clé `digicraft_consent`
     { analytics: bool, version: "1.0", timestamp: ISO }.
     Aucune donnée personnelle stockée.
   - Événement `digicraft:consent` émis à chaque changement →
     consommé par js/analytics.js (chargement GA4/Clarity).
   - Expose window.Consent : get(), accept(), refuse(), save(),
     ouvrirPreferences(), ouvrirInfos().
   ============================================================ */
(function () {
  "use strict";

  var CLE = "digicraft_consent";
  var VERSION = "1.0";

  /* ---------- Stockage ---------- */
  function lire() {
    try {
      var raw = localStorage.getItem(CLE);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.analytics !== "boolean" || o.version !== VERSION) return null;
      return o;
    } catch (e) { return null; }
  }
  function ecrire(analytics) {
    var o = { analytics: !!analytics, version: VERSION, timestamp: new Date().toISOString() };
    try { localStorage.setItem(CLE, JSON.stringify(o)); } catch (e) {}
    return o;
  }

  var enregistre = lire(); // null si aucun choix valide
  var statsOK = !!(enregistre && enregistre.analytics);

  /* ---------- Google Consent Mode v2 — AVANT tout script GA4 ---------- */
  window.dataLayer = window.dataLayer || [];
  var gtag = function () { window.dataLayer.push(arguments); };
  window.gtag = window.gtag || gtag;
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: statsOK ? "granted" : "denied"
  });

  /* ---------- Application d'un choix ---------- */
  function appliquer(granted) {
    statsOK = !!granted;
    window.gtag("consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: statsOK ? "granted" : "denied"
    });
    /* API officielle Clarity (sans effet si non configurée côté projet) */
    try { if (window.clarity) window.clarity("consent", statsOK ? "granted" : "denied"); } catch (e) {}
    document.dispatchEvent(new CustomEvent("digicraft:consent", { detail: { analytics: statsOK } }));
  }

  /* ---------- UI : bannière + panneaux ---------- */
  var banner = null, modal = null, info = null;
  var dernierFocus = null;

  /* Libellés traduits (js/i18n.js) — repli sur le texte passé en secours. */
  function T(cle, secours) {
    if (window.I18n && window.I18n.t) return window.I18n.t(cle);
    return secours !== undefined ? secours : cle;
  }

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function creerEl(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function markupBanniere() {
    return '<div class="dl-banner" id="dl-banner" role="region" aria-label="' + T("ck.banniere.aria") + '">' +
      '<div class="dl-banner-inner">' +
        '<div class="dl-banner-text">' +
          '<strong class="dl-banner-title">' + T("ck.banniere.titre") + '</strong>' +
          '<p>' + T("ck.banniere.texte") + '</p>' +
          '<button type="button" class="dl-text-btn" data-dl-infos>' + T("ck.banniere.infos") + '</button>' +
        '</div>' +
        '<div class="dl-banner-actions">' +
          '<button type="button" class="btn btn-gold btn-sm" data-dl-accept>' + T("ck.accepter") + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-dl-refuse>' + T("ck.refuser") + '</button>' +
          '<button type="button" class="dl-text-btn" data-dl-custom>' + T("ck.personnaliser") + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function markupPreferences() {
    return '<div class="dl-modal" id="dl-modal" role="dialog" aria-modal="true" aria-labelledby="dl-modal-title" hidden>' +
      '<div class="dl-backdrop" data-dl-close></div>' +
      '<div class="dl-box" role="document">' +
        '<h3 id="dl-modal-title">' + T("ck.pref.titre") + '</h3>' +
        '<div class="dl-cat">' +
          '<div class="dl-cat-txt"><strong>' + T("ck.cat.necessaires.titre") + '</strong><p>' + T("ck.cat.necessaires.desc") + '</p></div>' +
          '<span class="dl-pill">' + T("ck.cat.necessaires.pill") + '</span>' +
        '</div>' +
        '<div class="dl-cat">' +
          '<div class="dl-cat-txt"><strong>' + T("ck.cat.stats.titre") + '</strong><p>' + T("ck.cat.stats.desc") + '</p></div>' +
          '<label class="dl-switch"><input type="checkbox" id="dl-stats-cb" aria-label="' + T("ck.cat.stats.aria") + '"><span class="dl-slider"></span></label>' +
        '</div>' +
        '<div class="dl-modal-actions">' +
          '<button type="button" class="btn btn-gold btn-sm" data-dl-save>' + T("ck.enregistrer") + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function markupInfos() {
    return '<div class="dl-modal" id="dl-info" role="dialog" aria-modal="true" aria-labelledby="dl-info-title" hidden>' +
      '<div class="dl-backdrop" data-dl-close></div>' +
      '<div class="dl-box" role="document">' +
        '<h3 id="dl-info-title">' + T("ck.infos.titre") + '</h3>' +
        '<div class="dl-info-body">' +
          '<p>' + T("ck.infos.p1") + '</p>' +
          '<ul>' +
            '<li>' + T("ck.infos.li1") + '</li>' +
            '<li>' + T("ck.infos.li2") + '</li>' +
          '</ul>' +
          '<p>' + T("ck.infos.p2") + '</p>' +
        '</div>' +
        '<div class="dl-modal-actions">' +
          '<button type="button" class="btn btn-gold btn-sm" data-dl-close>' + T("ck.fermer") + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function montrer(el) {
    if (!el) return;
    el.hidden = false;
    dernierFocus = document.activeElement;
    var focusable = el.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    if (focusable) focusable.focus();
  }
  function cacher(el) {
    if (!el || el.hidden) return;
    el.hidden = true;
    if (dernierFocus && dernierFocus.focus) dernierFocus.focus();
  }

  function fermerBanniere() { if (banner) banner.classList.remove("is-visible"); }
  function ouvrirPreferences() { if (modal) { var cb = $("#dl-stats-cb", modal); if (cb) cb.checked = statsOK; montrer(modal); } }
  function ouvrirInfos() { if (info) montrer(info); }

  /* Piège de focus dans les panneaux (Tab) + fermeture Échap */
  function gererClavier(e) {
    if (e.key === "Escape") {
      cacher(modal); cacher(info);
      return;
    }
    if (e.key !== "Tab") return;
    var ouvert = (!modal.hidden && modal) ? modal : (info && !info.hidden ? info : null);
    if (!ouvert) return;
    var items = Array.prototype.slice.call(ouvert.querySelectorAll("button, [href], input, [tabindex]:not([tabindex='-1'])")).filter(function (el) { return !el.disabled; });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function initUI() {
    if (document.getElementById("dl-banner")) return;

    banner = creerEl(markupBanniere());
    modal = creerEl(markupPreferences());
    info = creerEl(markupInfos());
    document.body.appendChild(banner);
    document.body.appendChild(modal);
    document.body.appendChild(info);

    /* Boutons de la bannière */
    banner.addEventListener("click", function (e) {
      var t = e.target;
      if (t.closest("[data-dl-accept]")) { window.Consent.accept(); }
      else if (t.closest("[data-dl-refuse]")) { window.Consent.refuse(); }
      else if (t.closest("[data-dl-custom]")) { ouvrirPreferences(); }
      else if (t.closest("[data-dl-infos]")) { ouvrirInfos(); }
    });

    /* Panneaux : fermeture, sauvegarde */
    [modal, info].forEach(function (pan) {
      pan.addEventListener("click", function (e) {
        var t = e.target;
        if (t.closest("[data-dl-close]")) { cacher(pan); }
        if (t.closest("[data-dl-save]")) {
          var cb = $("#dl-stats-cb", modal);
          window.Consent.save(cb ? cb.checked : false);
        }
      });
    });

    document.addEventListener("keydown", gererClavier);

    /* Lien « Gérer mes cookies » (footer, toutes les pages) */
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-consent-manage]");
      if (b) { e.preventDefault(); ouvrirPreferences(); }
    });

    /* Affichage bannière : uniquement si aucun choix valide enregistré */
    if (!enregistre) {
      setTimeout(function () { banner.classList.add("is-visible"); }, 600);
    }
  }

  /* Changement de langue : reconstruction du contenu des panneaux sans
     recréer les conteneurs (les écouteurs délégués restent en place) et
     sans toucher à la visibilité ni au consentement déjà enregistré. */
  function rafraichirTextes() {
    if (!banner) return;
    [[banner, markupBanniere()], [modal, markupPreferences()], [info, markupInfos()]].forEach(function (x) {
      var el = x[0], html = x[1];
      if (!el) return;
      var neuf = creerEl(html);
      if (neuf) el.innerHTML = neuf.innerHTML;
    });
  }
  document.addEventListener("kj:langue", rafraichirTextes);

  /* ---------- API publique ---------- */
  window.Consent = {
    get: function () { return { analytics: statsOK }; },
    version: VERSION,
    aChoix: function () { return enregistre !== null; },
    accept: function () { appliquer(true); ecrire(true); fermerBanniere(); },
    refuse: function () { appliquer(false); ecrire(false); fermerBanniere(); },
    save: function (granted) { appliquer(!!granted); ecrire(!!granted); cacher(modal); fermerBanniere(); },
    ouvrirPreferences: ouvrirPreferences,
    ouvrirInfos: ouvrirInfos
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUI);
  } else {
    initUI();
  }
})();
