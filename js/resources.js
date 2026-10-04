/* ============================================================
   RESOURCES.JS — Ressources & produits digitaux (v0.2 §9)
   ------------------------------------------------------------
   Onglet « Ressources » du classeur (GID 1306651993) — source unique.
   Colonnes lues : id, type, nom_produit, description, prix, devise,
   image_cover, url_boutique, badge, featured, ordre
   [, nom_produit_en, description_en]

   Principes :
   - les données sont affichées TELLES QUELLES (aucun prix, aucun
     produit, aucune promesse inventés) ; un champ vide disparaît ;
   - `type` (colonne existante du Sheet) pilote le regroupement de la
     page /boutique/ et s'affiche comme étiquette sur chaque carte ;
   - `featured=TRUE` = affiché sur l'accueil (règle documentée dans le
     Sheet), maximum `CONFIG.featuredRessourcesLimit` ;
   - le paiement n'est PAS traité ici : `url_boutique` renvoie vers la
     boutique externe, toujours en `_blank` ;
   - bilingue : `nom_produit_en` / `description_en` si EN, repli FR.
   ============================================================ */
(function () {
  "use strict";

  /* Libellés d'interface traduits (js/i18n.js). Repli : texte passé en
     second argument — le module reste lisible même si i18n.js manque. */
  function T(cle, vars, secours) {
    if (window.I18n && window.I18n.t) return window.I18n.t(cle, vars);
    return secours !== undefined ? secours : cle;
  }

  var COVER_COLORS = ["#8A6A08", "#3E5C50", "#5B4A8A", "#8A4A3E", "#2F5D7E", "#6B6A63"];

  /* Libellés FR des types connus (les autres passent tels quels) */
  var ORDRE_TYPES = {
    ebook: 1, ebooks: 1, livre: 1, livre_numerique: 1, guide: 1,
    formation: 2, formations: 2, cours: 2, masterclass: 2,
    template: 3, templates: 3, modele: 3, "modèle": 3,
    kit: 4, kits: 4, pack: 4,
    outil: 5, outils: 5, logiciel: 5, logiciels: 5, app: 5,
    service: 6, services: 6, prestation: 6
  };
  var LIBELLE_TYPE = {
    ebook: "Ebooks", ebooks: "Ebooks", livre: "Ebooks", livre_numerique: "Ebooks", guide: "Guides",
    formation: "Formations", formations: "Formations", cours: "Formations", masterclass: "Formations",
    template: "Templates", templates: "Templates", modele: "Templates", "modèle": "Templates",
    kit: "Kits", kits: "Kits", pack: "Packs",
    outil: "Outils", outils: "Outils", logiciel: "Logiciels", logiciels: "Logiciels", app: "Applications",
    service: "Services", services: "Services", prestation: "Services"
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function nombre(v) {
    var n = parseFloat(String(v == null ? "" : v).replace(",", "."));
    return isNaN(n) ? null : n;
  }
  function langue() {
    return (window.I18n && window.I18n.langue && window.I18n.langue()) || "fr";
  }
  function choisir(obj, base, l) {
    var lg = l || langue();
    if (lg === "en") {
      var en = obj[base + "_en"];
      if (en !== undefined && en !== null && String(en).trim()) return String(en);
    }
    return obj[base] === undefined || obj[base] === null ? "" : String(obj[base]);
  }

  function extUrl(u) {
    var v = String(u || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (/^\/\//.test(v)) return "https:" + v;
    if (v.charAt(0) === "/") return (window.SITE_ROOT || "") + v.replace(/^\/+/, "");
    return "https://" + v;
  }
  function imgUrl(u) {
    var v = String(u || "").trim();
    if (!v) return "";
    if (/^(https?:)?\/\//i.test(v)) return v;
    return (window.SITE_ROOT || "") + v.replace(/^\/+/, "");
  }

  /* Badge du Sheet → pilule v2. Aucun libellé n'est réécrit : le texte
     affiché est celui du Sheet, seule la couleur dépend du mot-clé.
     (Référence : maquette v0.2 — Bestseller → or plein, New → or clair,
     Gratuit → neutre.) */
  function classeBadge(v) {
    var s = String(v || "").toLowerCase();
    if (!s.trim()) return "is-neutre";
    if (/bestseller|best-seller|best seller|populaire|top vente/.test(s)) return "is-nouveau";
    if (/nouveau|nouveaut|new|récent|recent/.test(s)) return "is-public";
    if (/gratuit|free|offert|0\s*(€|\$|usd|eur)/.test(s)) return "is-beta";
    if (/promo|soldes?|réduction|reduction|-?\d+\s*%/.test(s)) return "is-archive";
    return "is-neutre";
  }
  function piluleBadge(v) {
    var t = String(v == null ? "" : v).trim();
    if (!t) return "";
    return '<span class="badge-statut r-badge ' + classeBadge(t) + '">' + esc(t) + "</span>";
  }

  /* Prix : « 6,28 » + « USD » → « 6,28 USD ». Aucun prix n'est arrondi,
     converti ni inventé ; sans `prix`, la ligne disparaît. */
  function prixTexte(prix, devise) {
    var p = String(prix == null ? "" : prix).trim();
    var d = String(devise == null ? "" : devise).trim();
    if (!p) return { montant: "", devise: "" };
    if (nombre(p) !== null) {
      var n = nombre(p);
      p = String(p).replace(".", ",").replace(/^-?\d+([,]\d+)?$/, function () {
        return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
      });
    }
    return { montant: p, devise: d };
  }

  function libelleType(t) {
    var cle = String(t || "").trim().toLowerCase();
    if (!cle) return "";
    return LIBELLE_TYPE[cle] || String(t).trim();
  }
  function etiquetteType(t) {
    var v = String(t == null ? "" : t).trim();
    if (!v) return "";
    return v.charAt(0).toUpperCase() + v.slice(1);
  }

  /* Couverture de secours : initiales du produit (aucune image inventée,
     aucun logo emprunté) — masquée dès que `image_cover` est fournie. */
  function couverture(p) {
    var mots = String(p || "D").split(/\s+/).filter(Boolean);
    var initials = mots.slice(0, 2).map(function (m) { return m.charAt(0).toUpperCase(); }).join("");
    var hash = 0;
    for (var i = 0; i < initials.length; i++) hash = (hash * 31 + initials.charCodeAt(i)) % 997;
    var bg = COVER_COLORS[hash % COVER_COLORS.length];
    return '<div class="r-cover" aria-hidden="true" style="--cov-bg:' + bg + '">' +
      '<span class="r-cover-brand">DIGICRAFT</span>' +
      '<span class="r-cover-letters">' + esc(initials) + "</span>" +
      '<span class="r-cover-line"></span>' +
    "</div>";
  }

  /* ---------- Données ---------- */
  function recuperer() {
    return window.Sheets.loadSheet("ressources").then(function (rows) {
      var out = [];
      rows.forEach(function (r, i) {
        try {
          var nom = window.Sheets.champ(r, ["nom_produit", "nom", "titre", "produit"], "");
          if (!nom) return;                  /* ligne vide ou ligne d'instruction */
          out.push({
            position: i + 1,
            id: window.Sheets.champ(r, ["id"], ""),
            type: window.Sheets.champ(r, ["type", "categorie", "category"], ""),
            nom_produit: nom,
            nom_produit_en: window.Sheets.champ(r, ["nom_produit_en", "nom_en", "titre_en"], ""),
            description: window.Sheets.champ(r, ["description"], ""),
            description_en: window.Sheets.champ(r, ["description_en"], ""),
            prix: window.Sheets.champ(r, ["prix", "price"], ""),
            devise: window.Sheets.champ(r, ["devise", "currency"], ""),
            image_cover: window.Sheets.champ(r, ["image_cover", "image_url", "image"], ""),
            url_boutique: window.Sheets.champ(r, ["url_boutique", "url", "lien"], ""),
            badge: window.Sheets.champ(r, ["badge", "etiquette"], ""),
            featured: window.Sheets.toBool(window.Sheets.champ(r, ["featured", "a_la_une"], "")),
            ordre: window.Sheets.champ(r, ["ordre", "order"], "")
          });
        } catch (e) {
          console.error("[Ressources] Ligne " + (i + 2) + " ignorée :", e);
        }
      });
      out._source = rows._source;
      return out;
    });
  }

  /* Tri : `ordre` croissant, sinon position au Sheet */
  function trier(liste) {
    return (liste || []).slice().sort(function (a, b) {
      var oa = nombre(a.ordre), ob = nombre(b.ordre);
      if (oa !== null && ob !== null && oa !== ob) return oa - ob;
      if (oa !== null && ob === null) return -1;
      if (oa === null && ob !== null) return 1;
      return a.position - b.position;
    });
  }

  /* Groupes par `type` réellement présent (aucun groupe vide) */
  function grouper(liste) {
    var ordre = [], map = {};
    (liste || []).forEach(function (p) {
      var cle = String(p.type || "").trim() || "__sans_type__";
      if (!map[cle]) { map[cle] = { cle: cle, items: [] }; ordre.push(cle); }
      map[cle].items.push(p);
    });
    ordre.sort(function (a, b) {
      var na = ORDRE_TYPES[String(a).toLowerCase()] || 99;
      var nb = ORDRE_TYPES[String(b).toLowerCase()] || 99;
      if (na !== nb) return na - nb;
      return ordre.indexOf(a) - ordre.indexOf(b);
    });
    return ordre.map(function (c) {
      var g = map[c];
      g.libelle = c === "__sans_type__" ? "" : libelleType(c);
      return g;
    });
  }

  /* ---------- Rendu ---------- */
  function carte(p, l) {
    var nom = choisir(p, "nom_produit", l);
    var desc = choisir(p, "description", l);
    var lien = extUrl(p.url_boutique);
    var badge = piluleBadge(p.badge);
    var type = etiquetteType(p.type);
    var pr = prixTexte(p.prix, p.devise);
    var img = p.image_cover
      ? '<img src="' + esc(imgUrl(p.image_cover)) + '" alt="" loading="lazy" decoding="async" fetchpriority="low" onerror="this.remove()">'
      : "";

    return '<article class="card r-card reveal"' + (p.type ? ' data-ress-type="' + esc(p.type) + '"' : "") + ">" +
      "<a class=\"r-media\" href=\"" + esc(lien || "#") + "\"" + (lien ? ' target="_blank" rel="noopener"' : "") +
        ' aria-label="' + esc(nom) + (lien ? esc(T("ress.externe")) : "") + '">' +
        '<div class="r-media-inner">' + badge + couverture(nom) + img + '</div>' +
      "</a>" +
      '<div class="r-body">' +
        (type ? '<p class="r-type"><span>' + esc(type) + "</span></p>" : "") +
        "<h3>" + esc(nom) + "</h3>" +
        (desc ? '<p class="r-desc">' + esc(desc) + "</p>" : "") +
        '<div class="r-foot">' +
          (pr.montant
            ? '<span class="r-price">' + esc(pr.montant) + (pr.devise ? " <small>" + esc(pr.devise) + "</small>" : "") + "</span>"
            : "<span></span>") +
          (lien
            ? '<a class="link-arrow r-link" href="' + esc(lien) + '" target="_blank" rel="noopener"' +
              ' aria-label="' + esc(T("ress.aria.voir", { n: nom })) + '">' + T("ress.voir") +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></a>'
            : "") +
        "</div>" +
      "</div>" +
    "</article>";
  }

  function chargement(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += '<div class="skel" style="min-height:260px"></div>';
    return s;
  }

  function etatVide(titre, texte, hint) {
    return '<div class="empty-state reveal is-visible">' +
      '<div class="es-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1 13H5z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg></div>' +
      '<b>' + esc(titre) + '</b><p>' + esc(texte) + '</p>' +
      (hint ? '<span class="empty-hint">' + esc(hint) + "</span>" : "") +
    "</div>";
  }

  function statutSource(el, source, n) {
    if (!el || !el.parentElement) return;
    var ancien = el.parentElement.querySelector(".dyn-source");
    if (ancien) ancien.remove();
    var div = document.createElement("p");
    div.className = "dyn-source" + (source === "local" ? " is-local" : "") + (source === "erreur" ? " is-erreur" : "");
    if (source === "google-sheets") div.innerHTML = '<span class="dot"></span>' + T("etat.donnees") + n + " " + (n > 1 ? T("ress.compteur.plur") : T("ress.compteur.sing"));
    else if (source === "local") div.innerHTML = '<span class="dot"></span>' + T("etat.secours");
    else div.innerHTML = '<span class="dot"></span>' + T("etat.erreur");
    el.parentElement.insertBefore(div, el.nextSibling);
  }

  function reveler(el) {
    if (!el) return;
    var cibles = el.querySelectorAll(".reveal:not(.is-visible)");
    if (!cibles.length) return;
    if (typeof window.IntersectionObserver !== "function") {
      Array.prototype.forEach.call(cibles, function (c) { c.classList.add("is-visible"); });
      return;
    }
    var obs = new window.IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
    Array.prototype.forEach.call(cibles, function (c) { obs.observe(c); });
  }

  function rendre(containerId, mode, limite) {
    var el = document.getElementById(containerId);
    if (!el) return Promise.resolve();
    var l = langue();
    el.innerHTML = chargement(mode === "apercu" ? 3 : 6);

    return recuperer().then(function (liste) {
      var src = liste._source || "google-sheets";
      var tous = trier(liste);

      if (!tous.length) {
        el.innerHTML = etatVide(T("ress.vide.titre"), T("ress.vide.desc"), T("etat.rien.invente"));
        statutSource(el, src, 0);
        return;
      }

      if (mode === "apercu") {
        var max = limite || (window.CONFIG && window.CONFIG.featuredRessourcesLimit) || 3;
        var featured = tous.filter(function (p) { return p.featured; }).slice(0, max);
        if (!featured.length) {
          el.innerHTML = etatVide(T("ress.accueil.vide.titre"), T("ress.accueil.vide.desc"), T("ress.accueil.vide.hint"));
          statutSource(el, src, 0);
          return;
        }
        el.innerHTML = featured.map(function (p) {
          try { return carte(p, l); } catch (err) { console.error("[Ressources] Carte non rendue :", p.nom_produit, err); return ""; }
        }).join("");
        statutSource(el, src, featured.length);
        reveler(el);
        return;
      }

      /* page /boutique/ : regroupement par `type` réellement présent */
      el.innerHTML = grouper(tous).map(function (g) {
        var cartes = g.items.map(function (p) {
          try { return carte(p, l); } catch (err) { console.error("[Ressources] Carte non rendue :", p.nom_produit, err); return ""; }
        }).join("");
        return '<section class="ress-groupe">' +
          (g.libelle ? '<h2 class="ress-groupe-titre reveal"><span>' + esc(g.libelle) + '</span><em class="ress-count">' + g.items.length + "</em></h2>" : "") +
          '<div class="ress-grid">' + cartes + "</div>" +
        "</section>";
      }).join("");
      statutSource(el, src, tous.length);
      reveler(el);
    }).catch(function (e) {
      console.error("[Ressources] Erreur de chargement :", e);
      el.innerHTML = etatVide(T("ress.erreur.titre"), T("etat.sheet.onglet", { onglet: "Ressources" }));
      statutSource(el, "erreur", 0);
    });
  }

  function page(containerId) { return rendre(containerId, "page"); }
  function accueil(containerId) { return rendre(containerId, "apercu"); }

  document.addEventListener("kj:langue", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-ress-mode]"), function (el) {
      rendre(el.id, el.getAttribute("data-ress-mode"), parseInt(el.getAttribute("data-ress-limit"), 10) || undefined);
    });
  });

  window.Ress = {
    page: page,
    accueil: accueil,
    apercu: accueil,
    recuperer: recuperer,
    trier: trier,
    grouper: grouper,
    libelleType: libelleType,
    prixTexte: prixTexte,
    classeBadge: classeBadge,
    carte: carte
  };
})();
