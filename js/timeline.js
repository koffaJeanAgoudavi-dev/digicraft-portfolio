/* ============================================================
   TIMELINE.JS — Journal d'ingénieur / Build in Public (QG)
   (accueil : featured en liste verticale ; page /timeline/ : tout)
   Colonnes attendues dans le Sheet "Timeline" :
   date, titre, description, type, lien_optionnel, featured, ordre
   Fusionne et remplace l'ancien onglet BuildInPublic.
   ============================================================ */
(function () {
  "use strict";

  /* Couleur du pastille selon le type d'entrée */
  function typeClasse(type) {
    var t = String(type || "").toLowerCase();
    if (/saas|produit|app/.test(t)) return "is-saas";
    if (/agent|ia|intelligence/.test(t)) return "is-ia";
    if (/bot|telegram|jeu/.test(t)) return "is-bot";
    if (/jalon|fondation|lancement|prix|award/.test(t)) return "is-jalon";
    if (/apprentissage|formation|cours|certif/.test(t)) return "is-learn";
    return "";
  }

  function imgUrl(u) {
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    return (window.SITE_ROOT || "") + u;
  }
  /* URL : externe (https:// auto), interne absolue (/…) ou relative
     (projets/…, sans protocole et contenant un /) via SITE_ROOT. */
  function extUrl(u) {
    if (!u) return "#";
    var v = String(u).trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (v.charAt(0) === "/") return (window.SITE_ROOT || "") + v.replace(/^\//, "");
    if (v.indexOf("/") !== -1 && v.indexOf(".") === -1 || /^(projets|articles|boutique|contact|a-propos|timeline)\//i.test(v)) {
      return (window.SITE_ROOT || "") + v;
    }
    return "https://" + v;
  }
  function estExterne(u) {
    var v = String(u || "").trim();
    return /^(https?:)?\/\//i.test(v) && v.indexOf("projets/") !== 0;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function item(p) {
    var dateFmt = p.date ? window.Sheets.formatDate(p.date) : "";
    var lien = "";
    if (p.lien_optionnel) {
      var href = extUrl(p.lien_optionnel);
      var ext = /^(https?:)?\/\//i.test(String(p.lien_optionnel).trim());
      lien = '<a class="tl-link" href="' + esc(href) + '"' +
        (ext ? ' target="_blank" rel="noopener"' : "") +
        ' aria-label="Voir : ' + esc(p.titre) + '">Voir <span class="arr">→</span></a>';
    }
    return '<article class="tl-item reveal">' +
      '<span class="tl-dot' + (typeClasse(p.type) ? " " + typeClasse(p.type) : "") + '" aria-hidden="true"></span>' +
      '<div class="tl-card">' +
        '<div class="tl-top">' +
          (dateFmt ? '<span class="tl-date">' + esc(dateFmt) + '</span>' : "") +
          (p.type ? '<span class="tl-type' + (typeClasse(p.type) ? " " + typeClasse(p.type) : "") + '">' + esc(p.type) + '</span>' : "") +
        '</div>' +
        '<h3>' + esc(p.titre) + '</h3>' +
        (p.description ? '<p>' + esc(p.description) + '</p>' : "") +
        (lien ? '<div class="tl-foot">' + lien + '</div>' : "") +
      '</div>' +
    '</article>';
  }

  function recuperer() {
    return window.Sheets.loadSheet("timeline").then(function (rows) {
      var out = [];
      rows.forEach(function (r, i) {
        try {
          var titre = window.Sheets.champ(r, ["titre", "title", "nom"], "");
          if (!titre) return; // ligne vide ou ligne d'instruction
          out.push({
            id: window.Sheets.champ(r, ["id"], "T" + (i + 1)),
            date: window.Sheets.champ(r, ["date"], ""),
            titre: titre,
            description: window.Sheets.champ(r, ["description"], ""),
            type: window.Sheets.champ(r, ["type", "categorie", "statut"], ""),
            image_url: window.Sheets.champ(r, ["image_url", "image"], ""),
            lien_optionnel: window.Sheets.champ(r, ["lien_optionnel", "lien", "url"], ""),
            featured: window.Sheets.toBool(window.Sheets.champ(r, ["featured"], "")),
            ordre: window.Sheets.champ(r, ["ordre", "order"], "0")
          });
        } catch (e) {
          console.error("[Timeline] Ligne " + (i + 2) + " ignorée :", e);
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
      div.innerHTML = '<span class="dot"></span>Données : Google Sheets · ' + n + ' entrée(s)';
    } else if (source === "local") {
      div.innerHTML = '<span class="dot"></span>Données de secours (Google Sheets injoignable)';
    } else {
      div.innerHTML = '<span class="dot"></span>Erreur de chargement — ouvrez la console (F12) pour le détail';
      div.classList.add("is-erreur");
    }
    el.parentElement.insertBefore(div, el.nextSibling);
  }

  /* ---- Accueil : featured (max 5, journal vertical) ----
     Aucune entrée → section masquée silencieusement (même logique
     que l'ancien Build in public : rien de vide visible en public). */
  function accueil(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="skel" style="min-height:120px"></div>'.repeat(2);
    recuperer().then(function (items) {
      var src = items._source || "google-sheets";
      var sel = items.filter(function (p) { return p.featured; }).slice(0, 5);
      if (!sel.length) {
        var section = el.closest("section");
        if (section) section.style.display = "none";
        return;
      }
      el.innerHTML = sel.map(function (p) {
        try { return item(p); } catch (e) { console.error("[Timeline] Entrée non rendue :", p.titre, e); return ""; }
      }).join("");
      statutSource(containerId, src, sel.length);
      window.Prjs.observeNew(el);
    }).catch(function (e) {
      console.error("[Timeline] Erreur de chargement :", e);
      statutSource(containerId, "erreur", 0);
      el.innerHTML = '<div class="dyn-state"><div class="ds-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></div><h3>Impossible de charger le journal</h3><p>Vérifiez la publication du Google Sheet puis rechargez la page.</p></div>';
    });
  }

  /* ---- Page /timeline/ : toutes les entrées (Étape 3) ---- */
  function page(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="skel" style="min-height:120px"></div>'.repeat(4);
    recuperer().then(function (items) {
      var src = items._source || "google-sheets";
      if (!items.length) {
        var section = el.closest("section");
        if (section) section.style.display = "none";
        return;
      }
      el.innerHTML = items.map(function (p) {
        try { return item(p); } catch (e) { console.error("[Timeline] Entrée non rendue :", p.titre, e); return ""; }
      }).join("");
      statutSource(containerId, src, items.length);
      window.Prjs.observeNew(el);
    }).catch(function (e) {
      console.error("[Timeline] Erreur de chargement :", e);
      statutSource(containerId, "erreur", 0);
      el.innerHTML = '<div class="dyn-state"><div class="ds-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg></div><h3>Impossible de charger le journal</h3><p>Vérifiez la publication du Google Sheet puis rechargez la page.</p></div>';
    });
  }

  window.Tml = { accueil: accueil, page: page, item: item, recuperer: recuperer };
})();
