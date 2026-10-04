/* ============================================================
   ACTIVITE.JS — Journal chronologique (blueprint v0.2 §6)
   ------------------------------------------------------------
   Source unique : onglet « Timeline » du classeur (GID 1733530302).
   Colonnes lues :
   id, type, titre, description, image_url, statut, date,
   lien_optionnel, featured, ordre [, titre_en, description_en]

   Trois responsabilités :
   1) DATES — le Sheet contient des formats hétérogènes
      (« 2026-09-15 », « 2026-09 », « 18/09/2026 », coquille
      « 17/092026 »). Le parser est tolérant et n'INVENTE jamais :
      une date illisible est affichée telle quelle, dans son ordre
      d'origine. Les formats numériques sont rendus en clair
      (« 15 septembre 2026 »), jamais reconstruits.
   2) ORDRE — `ordre` accepte « 1 » et « 1,1 » (virgule décimale du
      classeur) ; tri du plus récent au plus ancien, `ordre` puis
      position dans la feuille en cas d'égalité.
   3) RENDU — timeline accessible (<ol>), type, statut, lien
      optionnel, image si fournie ; états vide / erreur explicites.
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

  /* ---------- 1) DATES ---------- */
  /* Renvoie { ts, precision } ou null. Aucune supposition sur l'année :
     une valeur trop courte/ambiguë reste non reconnue. */
  function analyserDate(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return null;
    var m;

    /* ISO : 2026-09-15, 2026/09/15, 2026.09.15 */
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
      return iso(+m[1], +m[2], +m[3], "jour");
    }
    /* ISO année-mois : 2026-09, 2026/09 */
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})$/))) {
      return iso(+m[1], +m[2], 1, "mois");
    }
    /* Français : 15/09/2026, 15-09-2026, 15.09.2026 */
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
      return iso(+m[3], +m[2], +m[1], "jour");
    }
    /* Coquille courante du classeur : 17/092026 (7 chiffres) —
       lecture « jour / mois+année » sans rien corriger dans le Sheet. */
    if ((m = s.match(/^(\d{1,2})[-/.](\d{2})(\d{4})$/))) {
      return iso(+m[3], +m[2], +m[1], "jour");
    }
    /* Texte libre (« Septembre 2026 ») : on tente le mois, sinon rien. */
    var t = s.toLowerCase();
    for (var i = 0; i < MOIS_FR.length; i++) {
      if (t.indexOf(MOIS_FR[i]) === 0) {
        var an = (s.match(/\d{4}/) || [])[0];
        if (an) return iso(+an, i + 1, 1, "mois");
      }
    }
    return null;
  }

  function iso(annee, mois, jour, precision) {
    if (!annee || !mois || mois < 1 || mois > 12) return null;
    if (precision === "jour" && (jour < 1 || jour > 31)) return null;
    var ts = Date.UTC(annee, mois - 1, precision === "jour" ? jour : 1);
    return { ts: ts, annee: annee, mois: mois, jour: precision === "jour" ? jour : null, precision: precision };
  }

  /* Affichage lisible, sans invention : « 15 septembre 2026 » / « Septembre 2026 » */
  function formaterDate(v, langue) {
    var d = (v && v.ts !== undefined) ? v : analyserDate(v);
    var brut = String(v && v.brut !== undefined ? v.brut : v == null ? "" : v).trim();
    if (!d) return brut;                       /* illisible → tel quel */
    var mois = (langue || "fr") === "en" ? MOIS_EN[d.mois - 1] : MOIS_FR[d.mois - 1];
    if (d.precision === "mois") {
      return mois.charAt(0).toUpperCase() + mois.slice(1) + " " + d.annee;
    }
    return d.jour + " " + mois + " " + d.annee;
  }

  /* ---------- 2) DONNÉES ---------- */
  function recuperer() {
    return window.Sheets.loadSheet("timeline").then(function (rows) {
      var out = [];
      rows.forEach(function (r, i) {
        try {
          var titre = window.Sheets.champ(r, ["titre", "title", "nom"], "");
          if (!titre) return;                  /* ligne vide / d'instruction */
          var date = window.Sheets.champ(r, ["date"], "");
          var d = analyserDate(date);
          out.push({
            id: window.Sheets.champ(r, ["id"], ""),
            position: i + 1,
            type: window.Sheets.champ(r, ["type", "categorie"], ""),
            titre: titre,
            titre_en: window.Sheets.champ(r, ["titre_en", "title_en"], ""),
            description: window.Sheets.champ(r, ["description"], ""),
            description_en: window.Sheets.champ(r, ["description_en"], ""),
            image_url: window.Sheets.champ(r, ["image_url", "image"], ""),
            statut: window.Sheets.champ(r, ["statut", "status"], ""),
            date: date,
            date_ts: d ? d.ts : null,
            date_info: d,
            lien_optionnel: window.Sheets.champ(r, ["lien_optionnel", "lien", "url"], ""),
            featured: window.Sheets.toBool(window.Sheets.champ(r, ["featured"], "")),
            ordre: window.Sheets.champ(r, ["ordre", "order"], "")
          });
        } catch (e) {
          console.error("[Activité] Ligne " + (i + 2) + " ignorée :", e);
        }
      });
      out._source = rows._source;
      return out;
    });
  }

  /* Tri : plus récent d'abord. Les entrées sans date lisible gardent
     leur position de feuille, à la fin (jamais de date inventée). */
  function trier(liste) {
    return (liste || []).slice().sort(function (a, b) {
      var da = a.date_ts, db = b.date_ts;
      if (da !== null && db === null) return -1;
      if (da === null && db !== null) return 1;
      if (da !== null && db !== null && da !== db) return db - da;      /* récent → ancien */
      var oa = nombre(a.ordre), ob = nombre(b.ordre);
      if (oa !== null && ob !== null && oa !== ob) return ob - oa;      /* ordre décroissant */
      if (oa !== null && ob === null) return -1;
      if (oa === null && ob !== null) return 1;
      return a.position - b.position;                                    /* position feuille */
    });
  }

  function choisir(valeur, valeurEn, langue) {
    if ((langue || "fr") === "en" && String(valeurEn || "").trim()) return valeurEn;
    return valeur;
  }

  /* ---------- 3) RENDU ---------- */
  function imgUrl(u) {
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    return (window.SITE_ROOT || "") + u;
  }
  function extUrl(u) {
    var v = String(u || "").trim();
    if (!v) return "";
    if (/^https?:\/\//i.test(v)) return v;
    if (v.charAt(0) === "/") return (window.SITE_ROOT || "") + v.replace(/^\//, "");
    return "https://" + v;
  }

  function item(e, index, langue) {
    var titre = choisir(e.titre, e.titre_en, langue);
    var desc = choisir(e.description, e.description_en, langue);
    var dateTxt = e.date_info ? formaterDate(e.date_info, langue) : (e.date || "");

    var meta = '<div class="tl-meta">' +
      (dateTxt ? '<time class="tl-date"' + (e.date_info ? ' datetime="' + esc(isoTexte(e.date_info)) + '"' : "") + '>' + esc(dateTxt) + '</time>' : "") +
      (e.type ? '<span class="tl-type">' + esc(e.type) + '</span>' : "") +
    '</div>';

    var lien = e.lien_optionnel
      ? '<a class="link-arrow tl-link" href="' + esc(extUrl(e.lien_optionnel)) + '" target="_blank" rel="noopener" aria-label="' + esc(T("actv.aria.voir", { t: titre })) + '">' + T("actv.voir") +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></a>'
      : "";
    var statut = e.statut ? '<span class="tl-statut">' + esc(e.statut) + '</span>' : "";
    var img = e.image_url
      ? '<img class="tl-img" src="' + esc(imgUrl(e.image_url)) + '" alt="" loading="lazy" decoding="async" fetchpriority="low" onerror="this.remove()">'
      : "";

    return '<li class="tl-item' + (index === 0 ? " is-first" : "") + '">' +
      meta +
      '<h3 class="tl-titre">' + esc(titre) + '</h3>' +
      (desc ? '<p class="tl-desc">' + esc(desc).replace(/\n/g, "<br>") + '</p>' : "") +
      ((statut || lien) ? '<div class="tl-foot">' + statut + lien + '</div>' : "") +
      img +
    '</li>';
  }

  function isoTexte(d) {
    var m = (d.mois < 10 ? "0" : "") + d.mois;
    if (d.precision === "mois") return d.annee + "-" + m;
    var j = (d.jour < 10 ? "0" : "") + d.jour;
    return d.annee + "-" + m + "-" + j;
  }

  function chargement(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += '<li class="tl-item"><span class="skel" style="display:block;height:72px;min-height:0"></span></li>';
    return s;
  }

  function etat(type, titre, texte, hint) {
    return '<li class="tl-item tl-state empty-state">' +
      '<div class="es-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        (type === "vide"
          ? '<path d="M12 3l2.2 5.4L20 10l-5.8 1.6L12 17l-2.2-5.4L4 10l5.8-1.6z"/>'
          : '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>') +
      '</svg></div>' +
      '<b>' + esc(titre) + '</b><p>' + esc(texte) + '</p>' +
      (hint ? '<span class="empty-hint">' + esc(hint) + '</span>' : "") +
    '</li>';
  }

  /* Indicateur de source (jamais d'échec silencieux) */
  function statutSource(el, source, n) {
    if (!el || !el.parentElement) return;
    var ancien = el.parentElement.querySelector(".dyn-source");
    if (ancien) ancien.remove();
    var div = document.createElement("p");
    div.className = "dyn-source" + (source === "local" ? " is-local" : "") + (source === "erreur" ? " is-erreur" : "");
    if (source === "google-sheets") {
      div.innerHTML = '<span class="dot"></span>' + T("etat.donnees") + n + ' ' + (n > 1 ? T("actv.compteur.plur") : T("actv.compteur.sing"));
    } else if (source === "local") {
      div.innerHTML = '<span class="dot"></span>' + T("etat.secours");
    } else {
      div.innerHTML = '<span class="dot"></span>' + T("etat.erreur");
    }
    el.parentElement.insertBefore(div, el.nextSibling);
  }

  function reveler(el) {
    if (!el) return;
    var cibles = el.querySelectorAll(".reveal:not(.is-visible)");
    if (!cibles.length) return;
    if (window.Prjs && window.Prjs.observeNew) { window.Prjs.observeNew(el); return; }
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

  var dernieres = [];   /* dernier jeu affiché (re-rendu au changement de langue) */

  function rendre(containerId, mode, limite) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var langue = (window.I18n && window.I18n.langue && window.I18n.langue()) || "fr";
    el.innerHTML = chargement(mode === "apercu" ? Math.min(limite || 3, 3) : 6);

    return recuperer().then(function (liste) {
      var src = liste._source || "google-sheets";
      dernieres = trier(liste);
      var visibles;
      if (mode === "apercu") {
        var limiteAccueil = Math.min(limite || 3, 3);
        var misesEnAvant = dernieres.filter(function (e) { return e.featured; });
        /* Le propriétaire contrôle l’accueil depuis le Sheet : dès qu’au
           moins une activité est marquée featured, seules ces activités
           sont affichées (maximum trois). Sans featured, repli propre sur
           les trois activités les plus récentes. */
        visibles = (misesEnAvant.length ? misesEnAvant : dernieres).slice(0, limiteAccueil);
      } else {
        visibles = dernieres;
      }

      if (!visibles.length) {
        el.innerHTML = etat("vide", T("actv.vide.titre"), T("actv.vide.desc"), T("etat.rien.invente"));
        statutSource(el, src, 0);
        return;
      }
      el.innerHTML = visibles.map(function (e, i) {
        try { return item(e, i, langue); }
        catch (err) { console.error("[Activité] Entrée non rendue :", e.titre, err); return ""; }
      }).join("");
      statutSource(el, src, visibles.length);
      reveler(el);
    }).catch(function (e) {
      console.error("[Activité] Erreur de chargement :", e);
      el.innerHTML = etat("erreur", T("actv.erreur.titre"),
        T("etat.sheet.onglet", { onglet: "Timeline" }));
      statutSource(el, "erreur", 0);
    });
  }

  function page(containerId) { return rendre(containerId, "page"); }
  function apercu(containerId, limite) { return rendre(containerId, "apercu", limite); }

  /* Changement de langue → re-rendu (colonnes `_en` si présentes) */
  document.addEventListener("kj:langue", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-actv-mode]"), function (el) {
      rendre(el.id, el.getAttribute("data-actv-mode"), parseInt(el.getAttribute("data-actv-limit"), 10) || undefined);
    });
  });

  window.Actv = {
    page: page,
    apercu: apercu,
    recuperer: recuperer,
    trier: trier,
    item: item,
    analyserDate: analyserDate,
    formaterDate: formaterDate
  };
})();
