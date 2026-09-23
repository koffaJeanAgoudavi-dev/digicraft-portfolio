/* ============================================================
   CERTIFICATIONS.JS — Grille des badges / licences (QG)
   (accueil : featured, max 6 ; section masquée si aucune donnée)
   Colonnes attendues dans le Sheet "Certifications" :
   titre, organisme, date_obtention, date_expiration,
   url_verification, image_badge, badge, featured, ordre
   ============================================================ */
(function () {
  "use strict";

  /* Monogramme de secours (fond ambre/or — couleur certifications) */
  function monogramme(c) {
    var mots = String(c.titre || "C").split(/\s+/).filter(Boolean);
    var initials = mots.slice(0, 2).map(function (m) { return m.charAt(0).toUpperCase(); }).join("");
    return '<span class="c-badge" aria-hidden="true">' + esc(initials) + '</span>';
  }

  function imgUrl(u) {
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    return (window.SITE_ROOT || "") + u;
  }
  function extUrl(u) {
    if (!u) return "#";
    var v = String(u).trim();
    return /^https?:\/\//i.test(v) ? v : "https://" + v;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function carte(c) {
    var visuel = c.image_badge
      ? '<img class="c-img" src="' + imgUrl(c.image_badge) + '" alt="Badge ' + esc(c.titre) + '" loading="lazy" decoding="async" onerror="this.remove()">'
      : monogramme(c);
    var dates = [];
    if (c.date_obtention) dates.push(window.Sheets.formatDate(c.date_obtention));
    if (c.date_expiration) dates.push("→ " + window.Sheets.formatDate(c.date_expiration));
    var lien = c.url_verification
      ? '<a class="c-link" href="' + esc(extUrl(c.url_verification)) + '" target="_blank" rel="noopener" aria-label="Vérifier : ' + esc(c.titre) + '">Vérifier <span class="arr">↗</span></a>'
      : "";
    return '<article class="card card-hover c-card reveal">' +
      '<div class="c-top">' + visuel +
        (c.badge ? '<span class="c-pill">' + esc(c.badge) + '</span>' : "") +
      '</div>' +
      '<div class="c-body">' +
        '<h3>' + esc(c.titre) + '</h3>' +
        (c.organisme ? '<p class="c-org">' + esc(c.organisme) + '</p>' : "") +
        (dates.length ? '<p class="c-dates">' + esc(dates.join(" · ")) + '</p>' : "") +
        (lien ? '<div class="c-foot">' + lien + '</div>' : "") +
      '</div>' +
    '</article>';
  }

  function recuperer() {
    return window.Sheets.loadSheet("certifications").then(function (rows) {
      var out = [];
      rows.forEach(function (r, i) {
        try {
          var titre = window.Sheets.champ(r, ["titre", "title", "nom"], "");
          if (!titre) return; // ligne vide ou ligne d'instruction
          out.push({
            id: window.Sheets.champ(r, ["id"], "C" + (i + 1)),
            titre: titre,
            organisme: window.Sheets.champ(r, ["organisme", "emetteur", "issuer"], ""),
            date_obtention: window.Sheets.champ(r, ["date_obtention", "date", "obtenue"], ""),
            date_expiration: window.Sheets.champ(r, ["date_expiration", "expiration", "expire"], ""),
            url_verification: window.Sheets.champ(r, ["url_verification", "url", "lien"], ""),
            image_badge: window.Sheets.champ(r, ["image_badge", "image", "badge_url"], ""),
            badge: window.Sheets.champ(r, ["badge"], ""),
            featured: window.Sheets.toBool(window.Sheets.champ(r, ["featured"], "")),
            ordre: window.Sheets.champ(r, ["ordre", "order"], "0")
          });
        } catch (e) {
          console.error("[Certifications] Ligne " + (i + 2) + " ignorée :", e);
        }
      });
      out._source = rows._source;
      return out.sort(window.Sheets.byOrder);
    });
  }

  /* Indicateur visible de source de données (jamais d'échec silencieux) */
  function statutSource(containerId, source, n) {
    var el = document.getElementById(containerId);
    if (!el || !el.parentElement) return;
    if (el.parentElement.querySelector(".dyn-source")) return;
    var div = document.createElement("p");
    div.className = "dyn-source" + (source === "local" ? " is-local" : "");
    if (source === "google-sheets") {
      div.innerHTML = '<span class="dot"></span>Données : Google Sheets · ' + n + ' certification(s)';
    } else if (source === "local") {
      div.innerHTML = '<span class="dot"></span>Données de secours (Google Sheets injoignable)';
    } else {
      div.innerHTML = '<span class="dot"></span>Erreur de chargement — ouvrez la console (F12) pour le détail';
      div.classList.add("is-erreur");
    }
    el.parentElement.insertBefore(div, el.nextSibling);
  }

  /* ---- Accueil : featured (max 6) ----
     Aucune donnée → section masquée silencieusement : aucune
     fausse certification ne doit jamais être visible en public. */
  function accueil(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="skel" style="min-height:220px"></div>'.repeat(3);
    recuperer().then(function (items) {
      var src = items._source || "google-sheets";
      var sel = items.filter(function (c) { return c.featured; }).slice(0, 6);
      if (!sel.length) {
        var section = el.closest("section");
        if (section) section.style.display = "none";
        return;
      }
      el.innerHTML = sel.map(function (c) {
        try { return carte(c); } catch (e) { console.error("[Certifications] Carte non rendue :", c.titre, e); return ""; }
      }).join("");
      statutSource(containerId, src, sel.length);
      window.Prjs.observeNew(el);
    }).catch(function (e) {
      console.error("[Certifications] Erreur de chargement :", e);
      statutSource(containerId, "erreur", 0);
      el.innerHTML = '<div class="dyn-state"><div class="ds-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></div><h3>Impossible de charger les certifications</h3><p>Vérifiez la publication du Google Sheet puis rechargez la page.</p></div>';
    });
  }

  window.Cert = { accueil: accueil, carte: carte, recuperer: recuperer };
})();
