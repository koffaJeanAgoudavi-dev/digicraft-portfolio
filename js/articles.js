/* ============================================================
   ARTICLES.JS — Articles & publications (v0.2 §9)
   ------------------------------------------------------------
   Onglet « Articles » du classeur (GID 982421678) — source unique.
   Colonnes lues : id, titre, plateforme, description, temps_lecture,
   url, image_url, date, featured, ordre [, titre_en, description_en]

   Principes :
   - les données sont affichées TELLES QUELLES (aucune reformulation,
     aucun article inventé) ; un champ vide disparaît proprement ;
   - le site n'héberge pas les articles : `url` pointe vers la
     plateforme d'origine (LinkedIn, Medium…) et reste en `_blank` ;
   - `featured=TRUE` (règle documentée dans le Sheet) = affiché sur
     l'accueil ; sans `featured`, l'accueil affiche un état vide —
     jamais un article « promu » d'office ;
   - dates : « 2026-08 » → Août 2026, « 15/08/2026 » → 15 août 2026,
     valeur illisible → affichée telle quelle ;
   - filtres de la page /articles/ construits depuis les plateformes
     réellement présentes dans le Sheet (aucune catégorie vide) ;
   - bilingue : `titre_en` / `description_en` si la langue est EN,
     repli FR sinon (étape 10 pour les libellés d'interface).
   ============================================================ */
(function () {
  "use strict";

  /* Libellés d'interface traduits (js/i18n.js). Repli : texte passé en
     second argument — le module reste lisible même si i18n.js manque. */
  function T(cle, vars, secours) {
    if (window.I18n && window.I18n.t) return window.I18n.t(cle, vars);
    return secours !== undefined ? secours : cle;
  }

  var MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin",
                 "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var MOIS_EN = ["January", "February", "March", "April", "May", "June",
                 "July", "August", "September", "October", "November", "December"];

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

  /* `titre_en` / `description_en` si EN et renseigné, sinon FR */
  function choisir(obj, base, langueCourante) {
    var l = langueCourante || langue();
    if (l === "en") {
      var en = obj[base + "_en"];
      if (en !== undefined && en !== null && String(en).trim()) return String(en);
    }
    return obj[base] === undefined || obj[base] === null ? "" : String(obj[base]);
  }

  /* ---------- Dates : lecture tolérante, zéro invention ---------- */
  function analyserDate(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return null;
    var m;
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return iso(+m[1], +m[2], +m[3], "jour");
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})$/))) return iso(+m[1], +m[2], null, "mois");
    if ((m = s.match(/^(\d{1,2})[-/.](\d{4})$/))) return iso(+m[2], +m[1], null, "mois");
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) return iso(+m[3], +m[2], +m[1], "jour");
    var t = s.toLowerCase();
    for (var i = 0; i < MOIS_FR.length; i++) {
      if (t.indexOf(MOIS_FR[i]) !== -1 || t.indexOf(MOIS_EN[i].toLowerCase()) !== -1) {
        var an = (s.match(/\d{4}/) || [])[0];
        if (an) return iso(+an, i + 1, null, "mois");
      }
    }
    return null;
  }
  function iso(annee, mois, jour, precision) {
    if (!annee || !mois || mois < 1 || mois > 12) return null;
    if (precision === "jour" && (jour < 1 || jour > 31)) return null;
    return { ts: Date.UTC(annee, mois - 1, jour || 1), annee: annee, mois: mois, jour: jour || null, precision: precision };
  }
  function moisTexte(d, l) {
    var m = (l || "fr") === "en" ? MOIS_EN[d.mois - 1] : MOIS_FR[d.mois - 1];
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  function formaterDate(v, l) {
    var brut = String(v == null ? "" : v).trim();
    var d = analyserDate(brut);
    if (!d) return brut;                        /* valeur illisible : telle quelle */
    return d.precision === "jour"
      ? d.jour + " " + moisTexte(d, l).toLowerCase() + " " + d.annee
      : moisTexte(d, l) + " " + d.annee;
  }

  /* « 3 min » reste « 3 min » ; « 3 » devient « 3 min » ; vide → vide */
  function dureeTexte(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "";
    if (/^\d+([.,]\d+)?$/.test(s)) return s.replace(".", ",") + " min";
    return s;
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

  /* ---------- Données ---------- */
  function recuperer() {
    return window.Sheets.loadSheet("articles").then(function (rows) {
      var out = [];
      rows.forEach(function (r, i) {
        try {
          var titre = window.Sheets.champ(r, ["titre", "title"], "");
          if (!titre) return;               /* ligne vide ou ligne d'instruction */
          out.push({
            position: i + 1,
            id: window.Sheets.champ(r, ["id"], ""),
            titre: titre,
            titre_en: window.Sheets.champ(r, ["titre_en", "title_en"], ""),
            plateforme: window.Sheets.champ(r, ["plateforme", "platform", "source"], ""),
            description: window.Sheets.champ(r, ["description", "resume"], ""),
            description_en: window.Sheets.champ(r, ["description_en"], ""),
            temps_lecture: window.Sheets.champ(r, ["temps_lecture", "temps", "duree"], ""),
            url: window.Sheets.champ(r, ["url", "lien", "link"], ""),
            image_url: window.Sheets.champ(r, ["image_url", "image"], ""),
            date: window.Sheets.champ(r, ["date", "date_publication"], ""),
            featured: window.Sheets.toBool(window.Sheets.champ(r, ["featured", "a_la_une"], "")),
            ordre: window.Sheets.champ(r, ["ordre", "order"], "")
          });
        } catch (e) {
          console.error("[Articles] Ligne " + (i + 2) + " ignorée :", e);
        }
      });
      out._source = rows._source;
      return out;
    });
  }

  /* Tri : `ordre` croissant quand il est renseigné ; sinon date la plus
     récente d'abord ; à égalité, position au Sheet. */
  function trier(liste) {
    return (liste || []).slice().sort(function (a, b) {
      var oa = nombre(a.ordre), ob = nombre(b.ordre);
      if (oa !== null && ob !== null && oa !== ob) return oa - ob;
      if (oa !== null && ob === null) return -1;
      if (oa === null && ob !== null) return 1;
      var da = analyserDate(a.date), db = analyserDate(b.date);
      if (da && db && da.ts !== db.ts) return db.ts - da.ts;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return a.position - b.position;
    });
  }

  /* Plateformes réellement présentes (valeur vide → « Autres ») */
  var AUTRES = "Autres";
  function plateformeDe(a) {
    return String(a.plateforme || "").trim() || AUTRES;
  }
  function plateformes(liste) {
    var vues = {}, ordre = [];
    (liste || []).forEach(function (a) {
      var p = plateformeDe(a);
      if (vues[p] === undefined) { vues[p] = 0; ordre.push(p); }
      vues[p]++;
    });
    return ordre.map(function (p) { return { nom: p, n: vues[p] }; })
      .sort(function (a, b) { return b.n - a.n || a.nom.localeCompare(b.nom); });
  }
  function filtrerParPlateforme(liste, plateforme) {
    if (!plateforme || plateforme === T("art.filtre.tous", null, "Tous") || plateforme === "Tous") return (liste || []).slice();
    return (liste || []).filter(function (a) { return plateformeDe(a) === plateforme; });
  }

  /* ---------- Rendu ---------- */
  function carte(a, l) {
    var titre = choisir(a, "titre", l);
    var desc = choisir(a, "description", l);
    var plat = plateformeDe(a);
    var lien = extUrl(a.url);
    var meta = [];
    var d = dureeTexte(a.temps_lecture);
    if (d) meta.push(d);
    var date = formaterDate(a.date, l);
    if (date) meta.push(date);

    var media = "";
    if (a.image_url) {
      media = '<a class="a-media" href="' + esc(lien || "#") + '"' + (lien ? ' target="_blank" rel="noopener"' : "") +
        ' aria-label="' + esc(titre) + '">' +
        '<img src="' + esc(imgUrl(a.image_url)) + '" alt="" loading="lazy" decoding="async" fetchpriority="low" onerror="this.closest(\'.a-media\').remove()">' +
      '</a>';
    }

    return '<article class="card a-card reveal">' +
      media +
      '<div class="a-top">' +
        '<span class="a-plat">' + esc(plat) + '</span>' +
        (meta.length ? '<span class="a-meta">' + esc(meta.join(" · ")) + '</span>' : "") +
      '</div>' +
      '<h3>' + (lien
        ? '<a href="' + esc(lien) + '" target="_blank" rel="noopener">' + esc(titre) + '</a>'
        : esc(titre)) + '</h3>' +
      (desc ? '<p>' + esc(desc) + '</p>' : "") +
      (lien
        ? '<div class="a-foot"><a class="link-arrow" href="' + esc(lien) + '" target="_blank" rel="noopener"' +
          ' aria-label="' + esc(T("art.aria.lire", { t: titre, p: plat })) + '">' + T("art.lire") +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></a>' +
          '<span class="a-ext">↗ ' + esc(plat) + '</span></div>'
        : "") +
    '</article>';
  }

  function chargement(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += '<div class="skel" style="min-height:190px"></div>';
    return s;
  }

  function etatVide(titre, texte, hint) {
    return '<div class="empty-state reveal is-visible">' +
      '<div class="es-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h5"/></svg></div>' +
      '<b>' + esc(titre) + '</b><p>' + esc(texte) + '</p>' +
      (hint ? '<span class="empty-hint">' + esc(hint) + '</span>' : "") +
    '</div>';
  }

  function statutSource(el, source, n, mot) {
    if (!el || !el.parentElement) return;
    var ancien = el.parentElement.querySelector(".dyn-source");
    if (ancien) ancien.remove();
    var div = document.createElement("p");
    div.className = "dyn-source" + (source === "local" ? " is-local" : "") + (source === "erreur" ? " is-erreur" : "");
    if (source === "google-sheets") div.innerHTML = '<span class="dot"></span>' + T("etat.donnees") + n + " " + (n > 1 ? T("art.compteur.plur") : T("art.compteur.sing"));
    else if (source === "local") div.innerHTML = '<span class="dot"></span>' + T("etat.secours");
    else div.innerHTML = '<span class="dot"></span>' + T("etat.erreur");
    el.parentElement.insertBefore(div, el.nextSibling);
  }

  /* Révélation des cartes injectées (les pages /articles/ et /boutique/
     ne dépendent pas de projects.js pour cela). */
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

  /* Filtres de la page /articles/ : construits depuis les données */
  function construireFiltres(bar, liste, actif, surClic) {
    if (!bar) return;
    var items = [{ nom: T("art.filtre.tous", null, "Tous"), n: liste.length }].concat(plateformes(liste));
    bar.innerHTML = items.map(function (p) {
      return '<button type="button" class="f-btn' + (p.nom === actif ? " is-active" : "") + '" data-filtre="' + esc(p.nom) + '">' +
        esc(p.nom) + ' <span class="f-n">' + p.n + "</span></button>";
    }).join("");
    if (!bar._lie) {
      bar._lie = true;
      bar.addEventListener("click", function (e) {
        var btn = e.target.closest(".f-btn");
        if (!btn) return;
        bar.querySelectorAll(".f-btn").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        surClic(btn.getAttribute("data-filtre"));
      });
    }
  }

  function rendre(containerId, mode, limite, filtreId) {
    var el = document.getElementById(containerId);
    if (!el) return Promise.resolve();
    var l = langue();
    el.innerHTML = chargement(mode === "apercu" ? 3 : 6);

    return recuperer().then(function (liste) {
      var src = liste._source || "google-sheets";
      var tous = trier(liste);
      var bar = filtreId ? document.getElementById(filtreId) : null;

      if (!tous.length) {
        if (bar) bar.innerHTML = "";
        el.innerHTML = etatVide(T("art.vide.titre"), T("art.vide.desc"), T("etat.rien.invente"));
        statutSource(el, src, 0, "article");
        return;
      }

      if (mode === "apercu") {
        var featured = tous.filter(function (a) { return a.featured; }).slice(0, limite || 3);
        if (!featured.length) {
          el.innerHTML = etatVide(T("art.accueil.vide.titre"), T("art.accueil.vide.desc"), T("art.accueil.vide.hint"));
          statutSource(el, src, 0, "article");
          return;
        }
        el.innerHTML = featured.map(function (a) {
          try { return carte(a, l); } catch (err) { console.error("[Articles] Carte non rendue :", a.titre, err); return ""; }
        }).join("");
        statutSource(el, src, featured.length, "article");
        reveler(el);
        return;
      }

      /* page /articles/ : filtres par plateforme réellement présente */
      function afficher(filtre) {
        var list = filtrerParPlateforme(tous, filtre);
        if (!list.length) {
          el.innerHTML = etatVide(T("art.vide.filtre.titre"),
            T("art.vide.filtre.desc", { f: filtre }),
            "");
          statutSource(el, src, 0, "article");
          return;
        }
        el.innerHTML = list.map(function (a) {
          try { return carte(a, l); } catch (err) { console.error("[Articles] Carte non rendue :", a.titre, err); return ""; }
        }).join("");
        statutSource(el, src, list.length, "article");
        reveler(el);
      }
      construireFiltres(bar, tous, T("art.filtre.tous", null, "Tous"), afficher);
      afficher(T("art.filtre.tous", null, "Tous"));
    }).catch(function (e) {
      console.error("[Articles] Erreur de chargement :", e);
      el.innerHTML = etatVide(T("art.erreur.titre"),
        T("etat.sheet.onglet", { onglet: "Articles" }));
      statutSource(el, "erreur", 0, "article");
    });
  }

  function page(containerId, filterId) { return rendre(containerId, "page", null, filterId); }
  function apercu(containerId, limite) { return rendre(containerId, "apercu", limite); }

  document.addEventListener("kj:langue", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-art-mode]"), function (el) {
      var filtre = el.getAttribute("data-art-filter") || undefined;
      rendre(el.id, el.getAttribute("data-art-mode"), parseInt(el.getAttribute("data-art-limit"), 10) || undefined, filtre);
    });
  });

  window.Arts = {
    page: page,
    apercu: apercu,
    accueil: apercu,               /* nom historique utilisé par l'accueil */
    recuperer: recuperer,
    trier: trier,
    plateformes: plateformes,
    filtrerParPlateforme: filtrerParPlateforme,
    analyserDate: analyserDate,
    formaterDate: formaterDate,
    dureeTexte: dureeTexte,
    carte: carte
  };
})();
