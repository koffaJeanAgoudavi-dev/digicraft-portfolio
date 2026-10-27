/* ============================================================
   EXPERTISE.JS — Section Expertise (v2, blueprint v0.2 §8)
   Source : onglet `Expertise` du Google Sheets.
   Colonnes : titre · titre_en · description_courte ·
              description_courte_en · description_longue ·
              description_longue_en · icone · categorie ·
              exemples_projets · ordre

   Principes :
   — Aucune donnée inventée : un champ vide n'est pas remplacé.
   — `ordre` pilote l'affichage ; une ligne sans ordre conserve sa
     position dans le classeur (après les lignes numérotées).
   — `exemples_projets` : chaque entrée devient un lien vers la fiche
     projet UNIQUEMENT si elle correspond à un projet réel du Sheet ;
     sinon elle reste du texte (jamais de lien fabriqué).
   — `icone` : emoji tel quel ; sinon jeton connu → SVG ; sinon SVG
     par défaut. (Aucun fichier image externe requis.)
   — Bilingue : colonnes `_en` via window.I18n.champ (repli FR).
   ============================================================ */
(function () {
  "use strict";

  /* Libellés d'interface traduits (js/i18n.js). Repli : texte passé en
     second argument — le module reste lisible même si i18n.js manque. */
  function T(cle, vars, secours) {
    if (window.I18n && window.I18n.t) return window.I18n.t(cle, vars, secours);
    return secours !== undefined ? secours : cle;
  }

  /* ---------- Icônes SVG (jetons de repli) ---------- */
  var SVG = {
    automatisation: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.03 4.14l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/>',
    ia: '<path d="M12 3l2.2 5.4L20 10l-5.8 1.6L12 17l-2.2-5.4L4 10l5.8-1.6z"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/><path d="M9.5 13.5h.01M14.5 13.5h.01"/><path d="M8 17c1.1 1 2.6 1.5 4 1.5s2.9-.5 4-1.5"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
    produit: '<path d="M4 7h16v12H4z"/><path d="M4 11h16"/><path d="M8 15h3"/>',
    integration: '<path d="M9 3v4M15 3v4"/><path d="M6 7h12v6a6 6 0 0 1-12 0z"/><path d="M12 19v2"/>',
    data: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>'
  };

  function sansAccents(s) {
    return String(s || "").normalize ? String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "") : String(s || "");
  }
  function norm(s) {
    return sansAccents(String(s || "").toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function svg(cle) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (SVG[cle] || SVG.ia) + '</svg>';
  }

  /* ---------- Résolution d'icône ----------
     emoji/texte court → tel quel · jeton connu → SVG · défaut → SVG */
  function icone(cle) {
    var v = String(cle || "").trim();
    if (!v) return svg("ia");
    if (/^(https?:)?\/\//i.test(v)) {
      return '<img src="' + esc(v) + '" alt="" loading="lazy" decoding="async" fetchpriority="low" onerror="this.remove()">';
    }
    /* emoji / pictogramme = caractère non ASCII ; un mot ASCII (« saas »)
       est traité comme un jeton et reçoit une icône SVG. */
    if (v.length <= 4 && /[^\x00-\x7F]/.test(v)) {
      return '<span class="xp-emoji" aria-hidden="true">' + esc(v) + '</span>';
    }
    var n = norm(v);
    if (/saas|produit|product/.test(n)) return svg("produit");
    if (/chat|conversation|messag/.test(n)) return svg("chat");
    if (/bot|assistant|agent/.test(n)) return svg("bot");
    if (/automat|workflow|process/.test(n)) return svg("automatisation");
    if (/integr|api|connect|webhook/.test(n)) return svg("integration");
    if (/data|donnee|analys/.test(n)) return svg("data");
    return svg("ia");
  }

  /* ---------- Exemples de projets → liens vers les fiches réelles ----------
     Index construit depuis l'onglet Projets (slug + titre). Une entrée
     n'est liée que si elle correspond réellement à un projet publié. */
  function construireIndex(projets) {
    var parCle = {};
    (projets || []).forEach(function (p) {
      if (!p.slug) return;
      [p.slug, p.titre].forEach(function (v) {
        var k = norm(v);
        if (k && !parCle[k]) parCle[k] = p.slug;
      });
    });
    return parCle;
  }
  function resoudreExemple(nom, index) {
    var k = norm(nom);
    if (!k) return null;
    if (index[k]) return index[k];
    /* tolérance : titre du projet plus long que l'exemple (« ScriboAI ») */
    if (k.length >= 3) {
      for (var cle in index) {
        if (cle.indexOf(k) === 0) return index[cle];
      }
    }
    return null;
  }
  function listeExemples(v) {
    return String(v || "").split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /* ---------- Chargement ---------- */
  function recuperer() {
    return window.Sheets.loadSheet("expertise").then(function (rows) {
      var out = [];
      rows.forEach(function (r, i) {
        try {
          var C = window.Sheets.champ;
          var titre = window.I18n ? window.I18n.champ(r, "titre") : C(r, ["titre", "title"], "");
          if (!titre) return;   // ligne vide / ligne d'instruction
          out.push({
            titre: titre,
            description_courte: window.I18n ? window.I18n.champ(r, "description_courte") : C(r, ["description_courte"], ""),
            description_longue: window.I18n ? window.I18n.champ(r, "description_longue") : C(r, ["description_longue"], ""),
            icone: C(r, ["icone", "icône", "icon"], ""),
            categorie: window.I18n ? window.I18n.champ(r, "categorie") : C(r, ["categorie", "catégorie"], ""),
            exemples: listeExemples(C(r, ["exemples_projets", "exemples", "projets"], "")),
            ordre: C(r, ["ordre", "order"], ""),
            _i: i
          });
        } catch (e) {
          console.error("[Expertise] Ligne " + (i + 2) + " ignorée :", e);
        }
      });
      out._source = rows._source;
      return trier(out);
    });
  }

  /* Tri : `ordre` numérique quand il est renseigné, sinon la position de
     la ligne dans le classeur (1-based). Une ligne non numérotée reste
     donc à sa place naturelle, et `ordre` reste respecté à toute valeur. */
  function trier(list) {
    return list.slice().sort(function (a, b) {
      var na = parseFloat(String(a.ordre).replace(",", "."));
      var nb = parseFloat(String(b.ordre).replace(",", "."));
      var va = isFinite(na) ? na : a._i + 1;
      var vb = isFinite(nb) ? nb : b._i + 1;
      if (va === vb) return a._i - b._i;   // stable
      return va - vb;
    });
  }

  /* ---------- Rendu ---------- */
  function blocExemples(liste, index) {
    if (!liste.length) return "";
    var items = liste.map(function (nom) {
      var slug = resoudreExemple(nom, index || {});
      if (slug) {
        var href = (window.SITE_ROOT || "") + "projets/" + slug + "/";
        return '<a class="xp-tag" href="' + esc(href) + '">' + esc(nom) + '</a>';
      }
      /* Pas de projet correspondant dans le Sheet → texte simple,
         jamais de lien fabriqué. */
      return '<span class="xp-tag is-text">' + esc(nom) + '</span>';
    }).join("");
    return '<div class="xp-projects"><span class="xp-projects-label">' + T("xp.exemples") + '</span>' + items + '</div>';
  }

  function carteComplete(x, index) {
    var desc = x.description_longue || x.description_courte || "";
    return '<article class="card xp-card reveal">' +
      '<span class="xp-ico">' + icone(x.icone) + '</span>' +
      (x.categorie ? '<span class="chip chip-gold xp-cat">' + esc(x.categorie) + '</span>' : '') +
      '<h2 class="xp-title">' + esc(x.titre) + '</h2>' +
      (desc ? '<p class="xp-desc">' + esc(desc) + '</p>' : '') +
      blocExemples(x.exemples, index) +
      '</article>';
  }

  /* Carte horizontale 2 blocs (accueil) — alignée sur le style de la
     section Parcours : BLOC 1 gauche ~30% (badge catégorie + visuel
     d'ancrage cadré), BLOC 2 droite ~70% (titre, description concise,
     projets preuves). Décisions utilisateur : cartes STATIQUES (liens
     internes + CTA de section, pas de clic carte) ; 1 ou 2 projets
     preuves maximum ; jamais de lien fabriqué (exemple non résolu =
     texte simple). */
  function carteHorizontale(x, index) {
    var exemples = (x.exemples || []).slice(0, 2);
    var liens = exemples.map(function (nom) {
      var slug = resoudreExemple(nom, index || {});
      if (slug) {
        var href = (window.SITE_ROOT || "") + "projets/" + slug + "/";
        return '<a class="xp-h-lien" href="' + esc(href) + '">' + esc(nom) +
          '<span aria-hidden="true">➔</span></a>';
      }
      return '<span class="xp-h-lien is-text">' + esc(nom) + '</span>';
    }).join("");
    return '<article class="expertise-card-horizontal reveal">' +
      '<div class="xp-h-visuel">' +
        (x.categorie ? '<span class="xp-h-cat">' + esc(x.categorie) + '</span>' : '') +
        '<span class="xp-h-ico">' + icone(x.icone) + '</span>' +
      '</div>' +
      '<div class="xp-h-contenu">' +
        '<h3 class="xp-h-titre">' + esc(x.titre) + '</h3>' +
        (x.description_courte ? '<p class="xp-h-desc">' + esc(x.description_courte) + '</p>' : '') +
        (liens ? '<div class="xp-h-projets"><span class="xp-h-projets-label">' +
          T("xp.projets", null, "Projets associés") + '</span>' + liens + '</div>' : '') +
      '</div>' +
    '</article>';
  }

  function etat(type, titre, texte) {
    var icones = {
      vide: '<path d="M12 3l2.2 5.4L20 10l-5.8 1.6L12 17l-2.2-5.4L4 10l5.8-1.6z"/>',
      erreur: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>'
    };
    return '<div class="dyn-state">' +
      '<span class="ds-ico">' + svg('ia') + '</span>' +
      '<h3>' + esc(titre) + '</h3><p>' + esc(texte) + '</p>' +
      (type === "erreur" ? '<p class="dyn-state-hint">' + esc(T("etat.sheet.onglet", { onglet: "Expertise" })) + '</p>' : '') +
      '</div>';
  }

  function chargement(n) {
    var out = "";
    for (var i = 0; i < n; i++) out += '<div class="skel" aria-hidden="true"></div>';
    return out;
  }

  function statutSource(el, source, n) {
    if (!el || !el.parentElement) return;
    var prec = el.parentElement.querySelector(".dyn-source");
    if (prec) prec.remove();
    var p = document.createElement("p");
    p.className = "dyn-source" + (source === "local" ? " is-local" : "") + (source === "erreur" ? " is-erreur" : "");
    p.innerHTML = '<span class="dot"></span>' +
      (source === "google-sheets" ? T("etat.donnees") + n + " " + (n > 1 ? T("xp.compteur.plur") : T("xp.compteur.sing"))
        : source === "local" ? T("etat.secours")
        : T("etat.erreur"));
    el.parentElement.appendChild(p);
  }

  function rendre(containerId, mode, limite) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = chargement(mode === "page" ? 6 : 3);

    var pIndex = window.Sheets.loadSheet("projets").then(function (projets) {
      return construireIndex(projets.map(function (r) {
        return {
          slug: window.Sheets.champ(r, ["slug"], ""),
          titre: window.Sheets.champ(r, ["titre", "title"], "")
        };
      }));
    }).catch(function () { return {}; });

    Promise.all([recuperer(), pIndex]).then(function (res) {
      var items = res[0], index = res[1];
      var src = items._source || "google-sheets";
      if (!items.length) {
        statutSource(el, src, 0);
        el.innerHTML = etat("vide", T("xp.vide.titre"),
          T("xp.vide.desc"));
        initialiserCarrousel(el);
        return;
      }
      var liste = mode === "page" ? items : items.slice(0, limite || items.length);

      if (mode === "page") {
        /* Page dédiée : une carte par expertise, toutes les colonnes.
           Les cartes de même catégorie restent dans l'ordre du Sheet
           (l'ordre prime sur le regroupement). */
        el.innerHTML = liste.map(function (x) { return carteComplete(x, index); }).join("");
      } else {
        /* Aperçu accueil : cartes horizontales 2 blocs, statiques — les
           projets preuves sont liés directement (➔), le bouton de section
           « Voir toute l'expertise » porte la navigation globale. */
        el.innerHTML = liste.map(function (x) { return carteHorizontale(x, index); }).join("");
      }
      statutSource(el, src, items.length);
      reveler(el);
      initialiserCarrousel(el);
    }).catch(function (e) {
      console.error("[Expertise] Erreur de chargement :", e);
      statutSource(el, "erreur", 0);
      el.innerHTML = etat("erreur", T("xp.erreur.titre"), T("etat.sheet"));
      initialiserCarrousel(el);
    });
  }

  /* ---- Apparition des cartes injectées ----
     Les cartes portent la classe `.reveal` (opacité 0 → 1 à l'entrée
     dans le viewport). L'observateur global vit dans js/projects.js,
     qui n'est PAS chargé sur /expertise/ : sans observateur local, les
     cartes restaient invisibles (opacité 0) sur cette page.
     Ce repli rend le module autonome : observateur global s'il existe,
     sinon observateur local, sinon affichage immédiat. */
  var observateurLocal = null;

  function reveler(el) {
    if (!el || !el.querySelectorAll) return;
    var cibles = el.querySelectorAll(".reveal:not(.is-visible)");
    if (!cibles.length) return;

    if (window.Prjs && window.Prjs.observeNew) {
      window.Prjs.observeNew(el);
      /* Sécurité : si l'observateur global n'a rien marqué (élément hors
         viewport, observateur indisponible), on n'y touche pas — le
         défilement déclenchera l'apparition normalement. */
      return;
    }
    if (typeof window.IntersectionObserver !== "function") {
      Array.prototype.forEach.call(cibles, function (c) { c.classList.add("is-visible"); });
      return;
    }
    if (!observateurLocal) {
      observateurLocal = new window.IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            observateurLocal.unobserve(e.target);
          }
        });
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
    }
    Array.prototype.forEach.call(cibles, function (c) { observateurLocal.observe(c); });
  }

  /* ---- Carrousel horizontal de l'accueil (.expertise-carousel-container)
     Décisions utilisateur : défilement PAR CARTE (flèches = 1 carte,
     points = 1 par carte) ; hauteur plafonnée (description raccourcie
     à 2 lignes en CSS). Le câblage (flèches, scroll, resize) est posé
     UNE seule fois : au changement de langue, rendre() réinjecte les
     cartes et seul l'habillage (points, états) est rafraîchi — aucun
     listener dupliqué. Le conteneur n'utilise pas la classe .carousel
     pour ne pas être pris en charge par le câblage générique de
     js/main.js (pas de double commande). ---- */
  var carrousel = { pret: false, cont: null, zone: null, prev: null, next: null, frame: 0 };

  function cartesCarrousel() {
    if (!carrousel.cont || !carrousel.cont.querySelectorAll) return [];
    return Array.prototype.slice.call(carrousel.cont.querySelectorAll(".expertise-card-horizontal"));
  }

  function positionCarte(carte) {
    var cartes = cartesCarrousel();
    return cartes.length ? carte.offsetLeft - cartes[0].offsetLeft : 0;
  }

  function indexCarteCourante() {
    var cartes = cartesCarrousel();
    if (!cartes.length) return 0;
    var objectif = carrousel.cont.scrollLeft || 0;
    var meilleur = 0, ecartMin = Infinity;
    for (var i = 0; i < cartes.length; i++) {
      var ecart = Math.abs(positionCarte(cartes[i]) - objectif);
      if (ecart < ecartMin) { ecartMin = ecart; meilleur = i; }
    }
    return meilleur;
  }

  function allerCarte(index) {
    var cartes = cartesCarrousel();
    if (!cartes.length || !carrousel.cont.scrollTo) return;
    var i = Math.max(0, Math.min(index, cartes.length - 1));
    var doux = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    carrousel.cont.scrollTo({ left: positionCarte(cartes[i]), behavior: doux ? "smooth" : "auto" });
  }

  function construirePoints() {
    if (!carrousel.zone) return;
    var cartes = cartesCarrousel();
    carrousel.zone.innerHTML = "";
    /* 0 ou 1 carte : rien à paginer → zone vide et masquée */
    if (cartes.length < 2) { carrousel.zone.hidden = true; return; }
    carrousel.zone.hidden = false;
    var actif = indexCarteCourante();
    cartes.forEach(function (carte, i) {
      var p = document.createElement("button");
      p.type = "button";
      p.className = "xp-dot" + (i === actif ? " is-active" : "");
      if (i === actif) p.setAttribute("aria-current", "true");
      p.setAttribute("aria-label", T("accueil.xp.dot", { n: i + 1 }, "Aller à l'expertise " + (i + 1)));
      p.addEventListener("click", function () { allerCarte(i); });
      carrousel.zone.appendChild(p);
    });
  }

  function majEtatCarrousel() {
    var i = indexCarteCourante(), n = cartesCarrousel().length;
    if (carrousel.zone) {
      Array.prototype.forEach.call(carrousel.zone.querySelectorAll(".xp-dot"), function (p, k) {
        p.classList.toggle("is-active", k === i);
        if (k === i) p.setAttribute("aria-current", "true");
        else p.removeAttribute("aria-current");
      });
    }
    if (carrousel.prev) carrousel.prev.disabled = i <= 0;
    if (carrousel.next) carrousel.next.disabled = i >= n - 1;
  }

  function planifierEtat() {
    if (carrousel.frame) return;
    var raf = window.requestAnimationFrame || function (f) { f(); };
    carrousel.frame = raf(function () { carrousel.frame = 0; majEtatCarrousel(); });
  }

  function initialiserCarrousel(cont) {
    if (!cont || !cont.classList || !cont.classList.contains("expertise-carousel-container")) return;
    carrousel.cont = cont;
    var wrap = cont.closest ? cont.closest(".expertise-carousel-wrap") : null;
    if (!wrap) wrap = cont.parentElement;
    carrousel.zone = wrap ? wrap.querySelector("[data-xp-dots]") : null;
    carrousel.prev = wrap ? wrap.querySelector("[data-xp-carousel-prev]") : null;
    carrousel.next = wrap ? wrap.querySelector("[data-xp-carousel-next]") : null;
    if (carrousel.pret) { construirePoints(); majEtatCarrousel(); return; }
    carrousel.pret = true;
    if (carrousel.prev) carrousel.prev.addEventListener("click", function () { allerCarte(indexCarteCourante() - 1); });
    if (carrousel.next) carrousel.next.addEventListener("click", function () { allerCarte(indexCarteCourante() + 1); });
    cont.addEventListener("scroll", planifierEtat, { passive: true });
    window.addEventListener("resize", planifierEtat, { passive: true });
    construirePoints();
    majEtatCarrousel();
  }

  function apercu(containerId, limite) { rendre(containerId, "apercu", limite); }
  function page(containerId) { rendre(containerId, "page"); }

  /* Changement de langue → re-rendu avec les variantes `_en` */
  document.addEventListener("kj:langue", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-xp-mode]"), function (el) {
      rendre(el.id, el.getAttribute("data-xp-mode"), parseInt(el.getAttribute("data-xp-limit"), 10) || undefined);
    });
  });

  window.Xpr = { page: page, apercu: apercu, recuperer: recuperer, icone: icone, listeExemples: listeExemples };
})();
