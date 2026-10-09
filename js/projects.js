/* ============================================================
   PROJECTS.JS — Rendu des réalisations (carousel accueil / grille /projets)
   Colonnes attendues dans le Sheet "Projets" (blueprint §18 + v0.2) :
   id, titre, slug, categorie, badge_statut, description_courte,
   image_url, stack_tags, statut, date, type_lien,
   url_destination, featured, ordre [, probleme, solution,
   technologies_detail, resultat]

   Étape 4 (blueprint v0.2 §5) :
   - pilule de statut = colonne `badge_statut` (libellé du Sheet conservé,
     seule la classe CSS est normalisée) ;
   - ligne technologique en monospace (classe .stack-mono) ;
   - filtres de la page /projets/ construits depuis les données réelles
     (aucune catégorie inventée) ;
   - aucun lien fabriqué : une carte sans URL ni étude de cas n'est pas
     cliquable.
   ============================================================ */
(function () {
  "use strict";

  /* Libellés d'interface traduits (js/i18n.js). Repli : texte passé en
     second argument — le module reste lisible même si i18n.js manque. */
  function T(cle, vars, secours) {
    if (window.I18n && window.I18n.t) return window.I18n.t(cle, vars);
    return secours !== undefined ? secours : cle;
  }

  var ICONS = {
    "IA": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a2 2 0 0 1 0 4h-3.27A6 6 0 0 1 12 20a6 6 0 0 1-5.73-2H3a2 2 0 0 1 0-4h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/><path d="M12 12v4"/><path d="M9 13h6"/></svg>',
    "Automatisation": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="6" cy="10" r="2.5"/></svg>',
    "Bots": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><path d="M9.5 13.5h.01M14.5 13.5h.01"/><path d="M8 17c1.1 1 2.6 1.5 4 1.5s2.9-.5 4-1.5"/></svg>',
    "SaaS": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.5l9 5 9-5"/></svg>'
  };
  var FALLBACK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v14H4z"/><path d="M4 9h16"/><path d="M8 14h3"/></svg>';

  function icone(filtre) { return ICONS[filtre] || FALLBACK_ICON; }

  /* Les URLs d'images peuvent venir du Sheet (http…) ou être relatives
     (assets/…) : dans ce cas on les préfixe du chemin racine du site. */
  function imgUrl(u) { return window.Sheets.safeImageUrl(u); }
  /* URL externe : ajoute https:// si le protocole manque ; les liens
     internes (commençant par /) sont résolus via SITE_ROOT pour
     fonctionner à n'importe quelle profondeur de page. */
  function extUrl(u) { return window.Sheets.safeExternalUrl(u); }

  /* Libellé du bouton d'action directe : la valeur de la colonne
     type_lien (Bot, Demo, Jouer…). Les valeurs non-action (vides,
     "interne", "externe", "En savoir plus", "Voir le projet") sont
     remplacées par un libellé générique. */
  /* Texte bilingue d'un projet : `_en` si la langue est EN et la valeur
     non vide, sinon le français (jamais de case vide). */
  function txt(p, base, secours) {
    if (window.I18n && window.I18n.champ) return window.I18n.champ(p, base, secours);
    return p && p[base] !== undefined && p[base] !== null ? p[base] : (secours || "");
  }

  function libelleAction(p) {
    var t = (p.type_lien || "").trim();
    if (["", "interne", "externe", "En savoir plus", "Voir le projet"].indexOf(t) !== -1) return T("projets.action.generique", null, "Accéder au projet");
    return t;
  }

  /* ---- Filtres : familles déduites des données du Sheet ---- */

  /* Familles d'un projet : colonne `filtre` si renseignée (vocabulaire
     explicite du CMS), sinon découpage de `categorie` sur & , / + .
     Aucune catégorie n'est inventée : les puces affichées proviennent
     toujours d'une valeur réellement présente dans le Sheet. */
  function familles(p) {
    var src = String((p && (p.filtre || p.categorie)) || "");
    var out = [], vus = {};
    src.split(/[&,/+]/).forEach(function (f) {
      var v = f.replace(/\s+/g, " ").trim();
      if (!v) return;
      var k = v.toLowerCase();
      if (vus[k]) return;
      vus[k] = 1;
      out.push(v);
    });
    return out;
  }

  /* Union des familles, dans l'ordre d'apparition (ordre des projets) */
  function listeFamilles(projets) {
    var out = [], vus = {};
    (projets || []).forEach(function (p) {
      familles(p).forEach(function (f) {
        var k = f.toLowerCase();
        if (vus[k]) return;
        vus[k] = 1;
        out.push(f);
      });
    });
    return out;
  }

  function correspond(p, filtre) {
    if (!filtre || filtre === T("projets.filtre.tous", null, "Tous") || filtre === "Tous") return true;
    var cible = String(filtre).toLowerCase();
    return familles(p).some(function (f) { return f.toLowerCase() === cible; });
  }

  /* Rétro-compatibilité : même sémantique que l'ancien matcheFiltre */
  function matcheFiltre(p, f) { return correspond(p, f); }

  /* ---- Pilule de statut (colonne badge_statut) ----
     Le libellé affiché est EXACTEMENT celui du Sheet ; seule la classe
     CSS est normalisée pour piloter la couleur (public / beta / privé /
     nouveau / archivé / neutre). */
  function normaliser(v) {
    return String(v == null ? "" : v).toLowerCase()
      .replace(/[éèêë]/g, "e").replace(/[àâä]/g, "a").replace(/[îï]/g, "i")
      .replace(/[ôö]/g, "o").replace(/[ûü]/g, "u").replace(/\s+/g, " ").trim();
  }

  /* Vocabulaire de la colonne `statut` (texte libre) → classe de pilule.
     L'ordre compte : « Test privé » doit rester privé, « En production »
     doit ressortir en public. */
  var REGLES_PILULE = [
    [/priv/,                         "is-prive"],     /* Privée, Test privé, Interne */
    [/archiv|abandon|deprecat/,      "is-archive"],
    [/^nouveau|^new|nouveaute/,      "is-nouveau"],
    [/public|en ligne|^live|en prod|production|publi|^dispo/, "is-public"],
    [/beta|b.ta|^test|prototype|alpha|^dev|developpement/, "is-beta"]
  ];

  function classePilule(valeur) {
    var cle = normaliser(valeur);
    if (!cle) return "is-neutre";
    for (var i = 0; i < REGLES_PILULE.length; i++) {
      if (REGLES_PILULE[i][0].test(cle)) return REGLES_PILULE[i][1];
    }
    return "is-neutre";
  }

  function badgeStatut(p) {
    var libelle = String((p && p.badge_statut) || "").trim();
    return { libelle: libelle, classe: classePilule(libelle) };
  }

  /* Ligne technologique : texte brut monospace (v0.2 §2) */
  function stack(p) {
    return String((p && p.stack_tags) || "")
      .split(/[,·|;]/)
      .map(function (t) { return t.replace(/\s+/g, " ").trim(); })
      .filter(Boolean)
      .join(" · ");
  }

  /* Statut affiché sous la carte : `statut` puis `date` — uniquement
     les valeurs présentes (jamais de séparateur orphelin). */
  function ligneStatut(p) {
    return [String((p && p.statut) || "").trim(), window.Sheets.formatDate((p && p.date) || "")]
      .filter(Boolean).join(" · ");
  }

  /* Initiales du visuel de remplacement (aucune donnée inventée : juste
     les initiales du titre réel). */
  function initiales(titre) {
    var t = String(titre || "").split(/—|–|\||:/)[0];
    var mots = t.replace(/([a-zà-ÿ])([A-ZÀ-Ý])/g, "$1 $2").split(/[\s_\-]+/);
    var out = "";
    mots.forEach(function (m) {
      if (out.length >= 2 || !m) return;
      if (/^[A-Za-zÀ-ÿ0-9]/.test(m)) out += m.charAt(0).toUpperCase();
    });
    return out || "?";
  }

  /* ---- Cible principale d'une carte ----
     1. étude de cas interne (/projets/<slug>/) quand au moins une
        colonne d'étude de cas est remplie (ou type_lien=interne) ;
     2. sinon lien externe `url_destination` ;
     3. sinon AUCUN lien (la carte n'est pas cliquable — jamais de « # »). */
  function lienPrincipal(p) {
    if (aUneEtudeDeCas(p) && p.slug) {
      return {
        href: (window.SITE_ROOT || "") + "projets/" + p.slug + "/",
        externe: false,
        libelle: T("projets.etude", null, "Étude de cas")
      };
    }
    var brut = String((p && p.url_destination) || "").trim();
    if (brut) {
      return { href: extUrl(brut), externe: true, libelle: libelleAction(p) };
    }
    return null;
  }

  /* Icône par défaut selon la catégorie */
  function iconePour(p) {
    var keys = ["IA", "Automatisation", "Bots", "SaaS"];
    for (var i = 0; i < keys.length; i++) {
      if (correspond(p, keys[i])) return ICONS[keys[i]];
    }
    return FALLBACK_ICON;
  }

  /* Un projet a une page d'étude de cas dès qu'une des 4 colonnes
     dédiées est renseignée (le Sheet alimente la page interne). */
  function aUneEtudeDeCas(p) {
    return !!(p && (p.probleme || p.solution || p.technologies_detail || p.resultat));
  }

  var SVG_ARROW = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function carte(projet) {
    var l = lienPrincipal(projet);
    var href = l ? l.href : "";
    var cible = l && l.externe ? ' target="_blank" rel="noopener"' : "";
    var b = badgeStatut(projet);
    var ms = stack(projet);
    var statut = ligneStatut(projet);
    var cat = String(projet.categorie || "").trim();

    /* Visuel : image du Sheet si fournie, sinon visuel de remplacement
       (initiales réelles) — aucune image inventée. */
    var imageSrc = imgUrl(projet.image_url);
    var img = imageSrc
      ? '<img src="' + imageSrc + '" alt="' + esc(txt(projet, "titre")) + '" loading="lazy" decoding="async" fetchpriority="low" onerror="this.remove()">'
      : '<span class="p-ph" aria-hidden="true"><b>' + esc(initiales(txt(projet, "titre"))) + '</b><span>' + T("projets.visuel") + '</span></span>';

    var mediaInner = '<div class="p-media-inner">' + img + '</div>';
    var media = l
      ? '<a class="p-media" href="' + href + '"' + cible + ' aria-label="' + esc(l.libelle) + ' : ' + esc(txt(projet, "titre")) + '">' + mediaInner + '</a>'
      : '<div class="p-media">' + mediaInner + '</div>';

    var titre = l
      ? '<a href="' + href + '"' + cible + '>' + esc(txt(projet, "titre")) + '</a>'
      : esc(txt(projet, "titre"));

    /* Pied de carte : lien vers l'étude de cas interne (si elle existe)
       puis bouton d'action externe (type_lien → url_destination). */
    var lienInterne = l && !l.externe
      ? '<a class="link-arrow" href="' + href + '" aria-label="' + esc(T("projets.etude.aria", { t: txt(projet, "titre") })) + '">' + T("projets.etude") + SVG_ARROW + '</a>'
      : "";
    var urlAction = String(projet.url_destination || "").trim();
    var action = (l && l.externe)
      ? '<a class="btn btn-gold btn-xs" href="' + href + '" target="_blank" rel="noopener" aria-label="' + esc(l.libelle) + ' : ' + esc(txt(projet, "titre")) + '">' + esc(l.libelle) + '</a>'
      : (urlAction
        ? '<a class="btn btn-gold btn-xs" href="' + extUrl(urlAction) + '" target="_blank" rel="noopener" aria-label="' + esc(libelleAction(projet)) + ' : ' + esc(txt(projet, "titre")) + '">' + esc(libelleAction(projet)) + '</a>'
        : "");
    var pied = (lienInterne || action)
      ? '<div class="p-foot"><span class="p-status">' + esc(statut) + '</span><span class="p-actions">' + lienInterne + action + '</span></div>'
      : (statut ? '<div class="p-foot"><span class="p-status">' + esc(statut) + '</span></div>' : "");

    return '<article class="card card-hover p-card reveal">' +
      media +
      '<div class="p-body">' +
        ((b.libelle || cat)
          ? '<div class="p-top">' +
              (b.libelle ? '<span class="badge-statut ' + b.classe + '">' + esc(b.libelle) + '</span>' : "") +
              (cat ? '<span class="p-cat">' + esc(cat) + '</span>' : "") +
            '</div>'
          : "") +
        '<h3 class="p-title">' + titre + '</h3>' +
        (projet.description_courte ? '<p class="p-desc">' + esc(txt(projet, "description_courte")) + '</p>' : "") +
        (ms ? '<p class="stack-mono">' + esc(ms) + '</p>' : "") +
        pied +
      '</div>' +
    '</article>';
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function chargement(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += '<div class="skel" style="min-height:300px"></div>';
    return s;
  }

  function etat(type, titre, texte, lien, lienTexte) {
    var ico = type === "vide"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';
    return '<div class="dyn-state reveal is-visible">' +
      '<div class="ds-ico">' + ico + '</div>' +
      '<h3>' + esc(titre) + '</h3>' +
      '<p>' + esc(texte) + '</p>' +
      (lien ? '<a class="btn btn-gold btn-sm" href="' + lien + '">' + esc(lienTexte) + '</a>' : "") +
    '</div>';
  }

  /* État vide v2 (blueprint §5) : aucune donnée inventée, on explique
     simplement comment en ajouter depuis le Sheet. */
  function etatVide(titre, texte, hint) {
    return '<div class="empty-state reveal is-visible">' +
      '<div class="es-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></div>' +
      '<b>' + esc(titre) + '</b>' +
      '<p>' + esc(texte) + '</p>' +
      (hint ? '<span class="empty-hint">' + esc(hint) + '</span>' : "") +
    '</div>';
  }

  /* Indicateur visible de source de données (jamais d'échec silencieux) */
  function statutSource(containerId, source, n) {
    var el = document.getElementById(containerId);
    if (!el || !el.parentElement) return;
    var ancien = el.parentElement.querySelector(".dyn-source");
    if (ancien) ancien.remove();
    var div = document.createElement("p");
    div.className = "dyn-source" + (source === "local" ? " is-local" : "");
    if (source === "google-sheets") {
      div.innerHTML = '<span class="dot"></span>' + T("etat.donnees") + n + ' ' + (n > 1 ? T("projets.compteur.plur") : T("projets.compteur.sing"));
    } else if (source === "local") {
      div.innerHTML = '<span class="dot"></span>' + T("etat.secours");
    } else {
      div.innerHTML = '<span class="dot"></span>' + T("etat.erreur");
      div.classList.add("is-erreur");
    }
    el.parentElement.insertBefore(div, el.nextSibling);
  }

  /* Construit des objets propres, champ par champ (alias + casse tolérées),
     en isolant chaque ligne : une ligne problématique est ignorée et
     loguée, jamais l'ensemble du rendu. */
  function recuperer() {
    return window.Sheets.loadSheet("projets").then(function (rows) {
      var out = [];
      rows.forEach(function (r, i) {
        try {
          var titre = window.Sheets.champ(r, ["titre", "title", "nom"], "");
          if (!titre) return; // ligne vide ou ligne d'instruction
          out.push({
            id: window.Sheets.champ(r, ["id"], "P" + i),
            titre: titre,
            slug: window.Sheets.champ(r, ["slug"], ""),
            categorie: window.Sheets.champ(r, ["categorie", "category"], ""),
            badge_statut: window.Sheets.champ(r, ["badge_statut", "badge"], ""),
            filtre: window.Sheets.champ(r, ["filtre", "filter"], ""),
            description_courte: window.Sheets.champ(r, ["description_courte", "description"], ""),
            /* É10 — variantes anglaises : conservées telles quelles, le choix
               se fait au rendu (window.I18n.champ) pour que la bascule de
               langue reste instantanée même sans recharger les données. */
            titre_en: window.Sheets.champ(r, ["titre_en", "title_en"], ""),
            description_courte_en: window.Sheets.champ(r, ["description_courte_en"], ""),
            image_url: window.Sheets.champ(r, ["image_url", "image"], ""),
            stack_tags: window.Sheets.champ(r, ["stack_tags", "tags"], ""),
            statut: window.Sheets.champ(r, ["statut", "status"], ""),
            date: window.Sheets.champ(r, ["date"], ""),
            type_lien: window.Sheets.champ(r, ["type_lien", "cta"], ""),
            url_destination: window.Sheets.champ(r, ["url_destination", "url"], ""),
            /* V1.1 — colonnes de l'étude de cas (peuvent rester vides) */
            probleme: window.Sheets.champ(r, ["probleme", "problème"], ""),
            solution: window.Sheets.champ(r, ["solution"], ""),
            technologies_detail: window.Sheets.champ(r, ["technologies_detail", "technologies"], ""),
            resultat: window.Sheets.champ(r, ["resultat", "résultat"], ""),
            probleme_en: window.Sheets.champ(r, ["probleme_en", "problème_en"], ""),
            solution_en: window.Sheets.champ(r, ["solution_en"], ""),
            technologies_detail_en: window.Sheets.champ(r, ["technologies_detail_en"], ""),
            resultat_en: window.Sheets.champ(r, ["resultat_en"], ""),
            featured: window.Sheets.toBool(window.Sheets.champ(r, ["featured"], "")),
            ordre: window.Sheets.champ(r, ["ordre", "order"], "0")
          });
        } catch (e) {
          console.error("[Projets] Ligne " + (i + 2) + " ignorée :", e);
        }
      });
      out._source = rows._source;
      return out.sort(window.Sheets.byOrder);
    });
  }

  /* ---- Carousel accueil : featured=true uniquement ---- */
  function carouselAccueil(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = chargement(3);
    recuperer().then(function (projets) {
      var src = projets._source || "google-sheets";
      var featured = projets.filter(function (p) { return p.featured; });
      if (!featured.length) {
        statutSource(containerId, src, 0);
        el.innerHTML = etatVide("Aucun projet à la une",
          "Les projets marqués featured=TRUE dans le Sheet apparaîtront ici.",
          "Aucune modification de code nécessaire : ajoutez la ligne dans l'onglet Projets.");
        return;
      }
      el.innerHTML = featured.slice(0, 6).map(function (p) {
        try { return carte(p); } catch (e) { console.error("[Projets] Carte non rendue :", p.titre, e); return ""; }
      }).join("") || etatVide("Aucun projet à la une",
        "Les projets marqués featured=TRUE dans le Sheet apparaîtront ici.");
      statutSource(containerId, src, featured.length);
      window.Prjs.observeNew(el);
    }).catch(function (e) {
      console.error("[Projets] Erreur de chargement :", e);
      statutSource(containerId, "erreur", 0);
      el.innerHTML = etat("erreur", T("projets.erreur.titre"), T("etat.sheet"), "#", T("commun.reessayer"));
    });
  }

  /* ---- Grille page /projets : filtres construits depuis le Sheet ----
     Les puces proviennent des familles réellement présentes dans les
     données (colonne `categorie`, ou `filtre` si un vocabulaire dédié
     est renseigné). Ajouter une catégorie = ajouter une ligne dans le
     Sheet : aucune intervention dans le code. */
  function grilleProjets(containerId, filterId, resumeId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var actif = T("projets.filtre.tous", null, "Tous");
    var tous = [];
    var bar = document.getElementById(filterId);
    var resume = document.getElementById(resumeId || "");

    function peindreFiltres() {
      var famillesListe = listeFamilles(tous);
      if (bar) {
        bar.innerHTML = [T("projets.filtre.tous", null, "Tous")].concat(famillesListe).map(function (f) {
          var on = f === actif;
          return '<button class="f-btn' + (on ? " is-active" : "") + '" data-filtre="' + esc(f) + '"' +
            ' aria-pressed="' + (on ? "true" : "false") + '">' + esc(f) + '</button>';
        }).join("");
      }
      /* Rappel de contexte sous le titre de la page : compte réel +
         familles réellement présentes (remplace les puces figées). */
      if (resume) {
        var n = tous.length;
        resume.innerHTML = '<span class="chip chip-gold">' +
          n + " " + (n > 1 ? T("projets.n.plur") : T("projets.n.sing")) + '</span>' +
          famillesListe.map(function (f) { return '<span class="chip">' + esc(f) + '</span>'; }).join("");
      }
    }

    function render() {
      var list = tous.filter(function (p) { return correspond(p, actif); });
      if (!list.length) {
        statutSource(containerId, srcActuel, 0);
        el.innerHTML = etatVide(
          tous.length ? T("projets.vide.filtre.titre") : T("projets.vide.titre"),
          tous.length
            ? T("projets.vide.filtre.desc", { cat: actif })
            : T("projets.vide.desc"));
        return;
      }
      el.innerHTML = list.map(function (p) {
        try { return carte(p); } catch (e) { console.error("[Projets] Carte non rendue :", p.titre, e); return ""; }
      }).join("");
      statutSource(containerId, srcActuel, list.length);
      window.Prjs.observeNew(el);
    }

    var srcActuel = "google-sheets";
    el.innerHTML = chargement(6);
    recuperer().then(function (projets) {
      srcActuel = projets._source || "google-sheets";
      tous = projets;
      if (actif !== T("projets.filtre.tous", null, "Tous") && !listeFamilles(tous).some(function (f) { return f.toLowerCase() === actif.toLowerCase(); })) {
        actif = T("projets.filtre.tous", null, "Tous");
      }
      peindreFiltres();
      render();
    }).catch(function (e) {
      console.error("[Projets] Erreur de chargement :", e);
      statutSource(containerId, "erreur", 0);
      el.innerHTML = etat("erreur", T("projets.erreur.titre"), T("etat.sheet"), "", "");
    });

    if (bar) bar.addEventListener("click", function (e) {
      var btn = e.target.closest(".f-btn");
      if (!btn) return;
      actif = btn.getAttribute("data-filtre") || T("projets.filtre.tous", null, "Tous");
      Array.prototype.forEach.call(bar.querySelectorAll(".f-btn"), function (b) {
        var on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      render();
    });
  }

  /* ---- Helpers fiche projet générique (V1.3, mode dynamique) ----
     Utilisés UNIQUEMENT par projets/fiche.html (data-cs-dynamic).
     Les fiches statiques existantes (data-cs-page="<slug>" en dur)
     suivent exactement le même chemin de code qu'avant. */

  function normaliserSlug(v) {
    return String(v == null ? "" : v).trim().toLowerCase();
  }

  /* Extrait le slug du CHEMIN de l'URL : /projets/<slug>/ (avec ou
     sans slash final). Jamais depuis un query parameter (?slug=…). */
  function slugDepuisChemin() {
    var m = window.location.pathname.match(/\/projets\/([^\/?#]+)\/?$/i);
    if (!m) return "";
    try { return normaliserSlug(decodeURIComponent(m[1])); }
    catch (e) { return normaliserSlug(m[1]); }
  }

  function origineSite() {
    var s = window.CONFIG && window.CONFIG.siteUrl
      ? String(window.CONFIG.siteUrl).replace(/\/+$/, "")
      : "";
    return s || window.location.origin;
  }

  function setMetaAttr(selecteur, attr, valeur) {
    var el = document.querySelector(selecteur);
    if (el && valeur) el.setAttribute(attr, valeur);
  }

  /* SEO client de la fiche générique : title, meta description,
     canonical (toujours /projets/<slug>/ — URL propre, jamais ?slug=),
     Open Graph. Complète l'injection côté serveur faite par la Pages
     Function (functions/projets/[slug].js) : garantit des métadonnées
     correctes même si le HTML a été servi sans injection (dev local,
     Sheet injoignable côté edge). */
  function injecterMetaFiche(p, slug) {
    try {
      var urlPropre = origineSite() + "/projets/" + slug + "/";
      var titre = String(txt(p, "titre") || "").trim() || "Projet";
      var desc = String(txt(p, "description_courte") || "")
        .replace(/\s+/g, " ").trim();
      if (desc.length > 160) desc = desc.slice(0, 157).replace(/\s+\S*$/, "") + "…";
      if (!desc) desc = T("projets.fiche.desc", { t: titre });
      document.title = T("projets.fiche.titre", { t: titre });
      setMetaAttr('meta[name="description"]', "content", desc);
      setMetaAttr('link[rel="canonical"]', "href", urlPropre);
      setMetaAttr('meta[property="og:title"]', "content", titre + " | Étude de cas");
      setMetaAttr('meta[property="og:description"]', "content", desc);
      setMetaAttr('meta[property="og:url"]', "content", urlPropre);
      var img = String(p.image_url || "").trim();
      if (img) {
        var imgAbs = /^(https?:)?\/\//i.test(img)
          ? (img.charAt(0) === "/" ? "https:" + img : img)
          : origineSite() + "/" + img.replace(/^(\.\/|\/)+/, "");
        setMetaAttr('meta[property="og:image"]', "content", imgAbs);
      }
      /* Lève un éventuel noindex posé avant résolution des données. */
      var robots = document.querySelector('meta[name="robots"]');
      if (robots && /noindex/i.test(robots.getAttribute("content") || "")) {
        robots.parentNode.removeChild(robots);
      }
    } catch (e) { console.error("[Projets] Meta fiche générique :", e); }
  }

  /* Slug inconnu en mode dynamique → état « introuvable » propre +
     noindex (au lieu d'une page vide). Jamais déclenché pour les
     fiches statiques existantes (return silencieux conservé). */
  function projetIntrouvable(page, slug) {
    try {
      document.title = T("projets.introuvable.meta", null, "Projet introuvable | DIGICRAFT Labs");
      if (!document.querySelector('meta[name="robots"]')) {
        var m = document.createElement("meta");
        m.setAttribute("name", "robots");
        m.setAttribute("content", "noindex, nofollow");
        document.head.appendChild(m);
      }
      var canon = document.querySelector('link[rel="canonical"]');
      if (canon && canon.parentNode) canon.parentNode.removeChild(canon);
      var lien = (window.SITE_ROOT || "") + "projets/";
      page.innerHTML = '<section class="page-hero"><div class="container">' +
        etat("vide", T("projets.introuvable.titre"),
          slug ? T("projets.introuvable.desc.slug", { slug: slug }) : T("projets.introuvable.desc"),
          lien, T("projets.voir.tous")) +
        '</div></section>';
    } catch (e) { console.error("[Projets] État introuvable :", e); }
  }

  /* ---- Étude de cas (V1.1+) : page générique projets/<slug>/ ----
     Template unique pour n'importe quel projet du Sheet ayant un slug.
     Le Sheet alimente : titre, description, visuel (image_url), statut,
     tags et les 4 sections (probleme, solution, technologies_detail,
     resultat). Champ vide du Sheet + texte statique absent -> section
     masquée.
     V1.3 : si la page porte data-cs-dynamic et un data-cs-page vide
     (projets/fiche.html servi sur /projets/<slug>/ par la Function),
     le slug est extrait du chemin de l'URL. */
  function caseStudy() {
    var page = document.querySelector("[data-cs-page]");
    if (!page) return;
    var dynamique = page.hasAttribute("data-cs-dynamic");
    var slugCible = (page.getAttribute("data-cs-page") || "").trim();
    if (dynamique && !slugCible) slugCible = slugDepuisChemin();
    var elStatut = page.querySelector("[data-cs-statut]");
    var elTags = page.querySelector("[data-cs-tags]");
    var elTitre = page.querySelector("[data-cs-titre]");
    var elDesc = page.querySelector("[data-cs-desc]");
    var elMedia = page.querySelector("[data-cs-media]");

    /* Retire les fragments de description de colonnes que Google Sheets
       laisse parfois dans les cellules (ex: "État actuel, honnête…" + texte). */
    function nettoyerContenu(v) {
      if (!v) return "";
      var s = String(v);
      var fragments = [
        "Le problème que le projet résout, 2-3 phrases",
        "Comment le système fonctionne concrètement, 2-4 phrases",
        "Description un peu plus riche que stack_tags",
        "État actuel, honnête",
        "peut inclure le rôle de chaque outil"
      ];
      for (var i = 0; i < fragments.length; i++) {
        var idx = s.indexOf(fragments[i]);
        if (idx !== -1) s = s.slice(0, idx) + s.slice(idx + fragments[i].length);
      }
      return s.replace(/^[\s\t\-–—:;,]+/, "").trim();
    }

    recuperer().then(function (projets) {
      var p = null;
      for (var i = 0; i < projets.length; i++) {
        if (normaliserSlug(projets[i].slug) === normaliserSlug(slugCible)) { p = projets[i]; break; }
      }
      if (!p) {
        /* V1.3 : fiche générique → état « introuvable » propre + noindex.
           Fiches statiques existantes → comportement inchangé (return). */
        if (dynamique) projetIntrouvable(page, slugCible);
        return;
      }

      if (elTitre && txt(p, "titre")) elTitre.textContent = txt(p, "titre");
      if (elDesc && txt(p, "description_courte")) elDesc.textContent = txt(p, "description_courte");
      if (txt(p, "titre")) document.title = T("projets.fiche.titre", { t: txt(p, "titre") });
      if (elStatut && p.statut) {
        elStatut.textContent = p.statut;
        /* Pilule v2 (blueprint §5) : même barème que les cartes de /projets/,
           appliqué au libellé libre de la colonne `statut`. */
        var pilule = elStatut.closest ? elStatut.closest(".badge-statut") : null;
        if (pilule) {
          pilule.className = "badge-statut " + classePilule(p.statut);
          pilule.style.display = "";
        }
        /* V1.3 : la fiche générique pré-masque la puce de statut. */
        if (dynamique) {
          var chipStatut = elStatut.closest ? elStatut.closest(".chip") : null;
          if (chipStatut && chipStatut !== pilule) chipStatut.style.display = "";
        }
      }
      if (elTags) {
        var texteStack = stack(p);
        /* v2 : ligne technologique monospace (pages projets restylées) ;
           repli en puces `.tag` pour tout autre gabarit. */
        if (elTags.classList && elTags.classList.contains("stack-mono")) {
          elTags.textContent = texteStack;
          elTags.style.display = texteStack ? "" : "none";
        } else if (texteStack) {
          elTags.innerHTML = texteStack.split(" · ").map(function (t) {
            return '<span class="tag">' + esc(t) + '</span>';
          }).join("");
        }
      }
      if (elMedia) {
        var visualCard = elMedia.closest ? elMedia.closest("[data-cs-visual-card]") : null;
        if (p.image_url) {
          elMedia.innerHTML = '<img src="' + imgUrl(p.image_url) + '" alt="' + esc(txt(p, "titre")) + '" loading="lazy" decoding="async" fetchpriority="low" onerror="this.remove()">';
          elMedia.style.display = ""; /* V1.3 : fiche générique pré-masquée */
          if (visualCard) visualCard.style.display = "";
        } else {
          var im = elMedia.querySelector("img");
          if (!im || !im.getAttribute("src")) {
            elMedia.style.display = "none";
            if (visualCard) visualCard.style.display = "none";
          }
        }
      }

      /* Bouton d'action directe (type_lien → url_destination) */
      var elAction = page.querySelector("[data-cs-action]");
      if (elAction) {
        var libA = libelleAction(p);
        var urlA = extUrl(p.url_destination);
        elAction.textContent = libA;
        if (urlA !== "#") elAction.setAttribute("href", urlA);
        elAction.setAttribute("aria-label", libA + " : " + txt(p, "titre"));
      }

      var map = {
        "probleme": "probleme",
        "solution": "solution",
        "technologies_detail": "technologies_detail",
        "resultat": "resultat"
      };
      Object.keys(map).forEach(function (key) {
        var section = page.querySelector('[data-cs-section="' + key + '"]');
        if (!section) return;
        var txtEl = section.querySelector("[data-cs-txt]");
        var val = nettoyerContenu(txt(p, key));
        if (val) {
          if (txtEl) {
            txtEl.textContent = val;
            /* trace : ce texte vient du rendu JS (et non du HTML figé) */
            txtEl.setAttribute("data-cs-rempli", "1");
          }
          section.style.display = ""; /* V1.3 : fiche générique pré-masquée */
        } else if (txtEl) {
          /* Champ vide dans la langue courante : on n'affiche jamais un
             texte resté d'une autre langue (bascule EN → FR), mais on
             préserve un éventuel paragraphe statique de la page. */
          if (txtEl.getAttribute("data-cs-rempli") === "1") txtEl.textContent = "";
          if (!txtEl.textContent.trim()) section.style.display = "none";
        }
      });

      /* Sections/visuel remplis APRÈS l'init de l'observateur : leur
         apparition est garantie (une section rendue visible au chargement
         ne doit jamais rester en opacité 0 — même correctif que sur la
         page Expertise). Les blocs restés vides restent masqués. */
      Array.prototype.forEach.call(
        page.querySelectorAll("[data-cs-section], [data-cs-media]"),
        function (el) {
          if (getComputedStyle(el).display !== "none") el.classList.add("is-visible");
        });

      /* V1.3 : métadonnées SEO de la fiche générique (title, description,
         canonical propre /projets/<slug>/, Open Graph). */
      if (dynamique) injecterMetaFiche(p, slugCible);
    }).catch(function (e) {
      console.error("[Projets] Étude de cas :", e);
      /* V1.3 : fiche générique → état d'erreur explicite (jamais de
         squelette infini). Fiches statiques → comportement inchangé. */
      if (dynamique) {
        try {
          page.innerHTML = '<section class="page-hero"><div class="container">' +
            etat("erreur", T("projets.erreur.fiche"),
              "Vérifiez la publication du Google Sheet puis rechargez la page.",
              "", "") +
            '</div></section>';
        } catch (e2) { console.error("[Projets] État erreur :", e2); }
      }
    });
  }

  /* IntersectionObserver partagé pour la révélation */
  window.revealObserver = null;
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (typeof window.IntersectionObserver !== "function") {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); obs.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { obs.observe(el); });
    window.revealObserver = obs;
    /* Rattrapage : cartes dynamiques insérées avant l'init de l'observateur */
    document.querySelectorAll(".reveal:not(.is-visible)").forEach(function (el) { obs.observe(el); });
  }

  /* Observe les cartes dynamiques fraîchement insérées. Si l'observateur
     n'existe pas encore (rendu plus rapide que l'init), rend visible
     immédiatement — jamais de carte invisible par accident. */
  function observeNew(root) {
    if (!root) return;
    var items = root.querySelectorAll(".reveal:not(.is-visible)");
    if (!items.length) return;
    if (window.revealObserver) {
      items.forEach(function (el) { window.revealObserver.observe(el); });
    } else {
      items.forEach(function (el) { el.classList.add("is-visible"); });
    }
  }
  /* Changement de langue → nouveau rendu (les cartes, filtres et libellés
     sont reconstruits depuis les colonnes `_en` du Sheet, repli FR). */
  document.addEventListener("kj:langue", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-prj-vue]"), function (el) {
      var vue = el.getAttribute("data-prj-vue");
      try {
        if (vue === "carousel") carouselAccueil(el.id);
        else if (vue === "grille") {
          grilleProjets(el.id, el.getAttribute("data-prj-filtres"), el.getAttribute("data-prj-puces"));
        } else if (vue === "fiche") caseStudy();
        initReveal();
      } catch (e) { console.error("[Projets] Re-rendu langue :", e); }
    });
  });

  window.Prjs = {
    carouselAccueil: carouselAccueil,
    grilleProjets: grilleProjets,
    caseStudy: caseStudy,
    initReveal: initReveal,
    observeNew: observeNew,
    esc: esc,
    /* helpers exposés (tests + réutilisation par d'autres modules) */
    carte: carte,
    familles: familles,
    listeFamilles: listeFamilles,
    badgeStatut: badgeStatut,
    stack: stack,
    lienPrincipal: lienPrincipal
  };
})();
