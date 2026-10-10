/* ============================================================
   PARCOURS.JS — Expériences, formations, certifications (v0.2 §7)
   ------------------------------------------------------------
   Onglet « Parcours » du classeur = onglet EXISTANT « Certifications »
   (GID 834951448, aucune structure créée). Colonnes lues :
   type, titre, organisation, date_obtention, date_fin, description,
   verification_url, badge_image_url, ordre [, titre_en, description_en]

   Principes :
   - les données sont affichées TELLES QUELLES (aucune reformulation,
     aucun complément inventé) ; un champ vide disparaît proprement ;
   - `type` regroupe les entrées ; les groupes ne s'affichent que s'ils
     contiennent au moins une ligne réellement saisie ;
   - dates : « 2025-10 » → Octobre 2025, « 01-2026 » → Janvier 2026
     (année-mois), « 2026-08 » → Août 2026, « 2026-08-15 » → jour précis ;
     une valeur textuelle (« En cours », « Présent ») est affichée telle
     quelle ; une valeur illisible aussi. Aucune date n'est inventée ;
   - « Vérifier ↗ » n'apparaît que si `verification_url` est renseignée.
   ============================================================ */
(function () {
  "use strict";

  /* Libellés d'interface traduits (js/i18n.js). Repli : texte passé en
     second argument — le module reste lisible même si i18n.js manque. */
  function T(cle, vars, secours) {
    if (window.I18n && window.I18n.t) return window.I18n.t(cle, vars, secours);
    return secours !== undefined ? secours : cle;
  }

  var MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin",
                 "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var MOIS_EN = ["January", "February", "March", "April", "May", "June",
                 "July", "August", "September", "October", "November", "December"];

  /* Ordre d'affichage des groupes connus (les autres passent ensuite,
     dans leur ordre d'apparition au Sheet). */
  var ORDRE_TYPES = {
    experience: 1, experiences: 1, expérience: 1, experiences_pro: 1,
    formation: 2, formations: 2, licence: 3, diplome: 3, diplôme: 3,
    certification: 4, certifications: 4,
    projet: 5, projets: 5
  };
  /* Libellé de groupe : traduit (étape 10). Un type inconnu garde le
     texte du Sheet tel quel — aucune traduction inventée. */
  var CLE_GROUPE = {
    experience: "parc.type.experience", experiences: "parc.type.experience", "expérience": "parc.type.experience",
    formation: "parc.type.formation", formations: "parc.type.formation",
    licence: "parc.type.licence", diplome: "parc.type.licence", "diplôme": "parc.type.licence",
    certification: "parc.type.certification", certifications: "parc.type.certification",
    projet: "parc.type.projet", projets: "parc.type.projet"
  };
  function libelleGroupe(type) {
    var brute = LIBELLE_GROUPE[type];
    var cle = CLE_GROUPE[type];
    return cle ? T(cle, null, brute) : brute;
  }
  var LIBELLE_GROUPE = {
    experience: "Expériences", experiences: "Expériences", "expérience": "Expériences",
    formation: "Formations", formations: "Formations",
    licence: "Formations & licences", diplome: "Formations & licences", "diplôme": "Formations & licences",
    certification: "Certifications", certifications: "Certifications",
    projet: "Projets", projets: "Projets"
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

  /* ---------- Dates : lecture tolérante, zéro invention ---------- */
  /* Renvoie { ts, annee, mois, jour, precision } ou null.            */
  function analyserDate(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return null;
    var m;

    /* ISO complet 2026-08-15 */
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
      return iso(+m[1], +m[2], +m[3], "jour");
    }
    /* ISO année-mois 2026-08 */
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})$/))) {
      return iso(+m[1], +m[2], null, "mois");
    }
    /* Mois-année (format du classeur : 01-2026, 8/2026) */
    if ((m = s.match(/^(\d{1,2})[-/.](\d{4})$/))) {
      return iso(+m[2], +m[1], null, "mois");
    }
    /* Français jour/mois/année 15/08/2026 */
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
      return iso(+m[3], +m[2], +m[1], "jour");
    }
    /* Coquille courante 17/092026 (7 chiffres) : jour / mois+année */
    if ((m = s.match(/^(\d{1,2})[-/.](\d{2})(\d{4})$/))) {
      return iso(+m[3], +m[2], +m[1], "jour");
    }
    /* Texte « Octobre 2025 » */
    var t = s.toLowerCase();
    for (var i = 0; i < MOIS_FR.length; i++) {
      if (t.indexOf(MOIS_FR[i]) !== -1) {
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

  function moisTexte(d, langue) {
    var m = (langue || "fr") === "en" ? MOIS_EN[d.mois - 1] : MOIS_FR[d.mois - 1];
    return m.charAt(0).toUpperCase() + m.slice(1);
  }

  /* Une date seule : « Octobre 2025 » ou « 15 août 2026 » */
  function formaterDate(v, langue) { return window.Sheets.formatDate(v, langue); }

  /* Période : début → fin, en évitant les répétitions inutiles.
     Aucun mot n'est ajouté si la donnée est absente. */
  /* Fin de période textuelle (« Présent », « En cours ») : vocabulaire
     contrôlé traduit ; toute autre valeur du Sheet est affichée telle quelle. */
  var FIN_TEXTE = { "présent": "parc.periode.present", "present": "parc.periode.present",
                    "en cours": "parc.periode.en_cours" };
  function finTexte(v, langue) {
    var cle = FIN_TEXTE[String(v || "").trim().toLowerCase()];
    return cle && langue === "en" ? T(cle, null, v) : v;
  }

  function formaterPeriode(debut, fin, langue) {
    var d1 = analyserDate(debut), d2 = analyserDate(fin);
    var b1 = String(debut == null ? "" : debut).trim();
    var b2 = String(fin == null ? "" : fin).trim();
    if (/^(present|présent|en cours)$/i.test(b2)) return (b1 ? window.Sheets.formatDate(b1, langue) + " → " : "") + window.Sheets.formatDate(b2, langue);

    if (!d1 && !d2) {
      return b1 && b2 ? b1 + " → " + b2 : (b1 || b2);
    }
    if (d1 && !b2) return formaterDate(b1, langue);
    if (!b1 && d2) return formaterDate(b2, langue);
    if (d1 && d2) {
      if (d1.ts === d2.ts) return formaterDate(b1, langue);        /* même date → une fois */
      /* même mois : « Août 2026 → 2026-09 » devient lisible sans répéter le mois */
      if (d1.precision === "mois" && d2.precision === "mois" && d1.annee === d2.annee) {
        return moisTexte(d1, langue) + " – " + moisTexte(d2, langue).toLowerCase() + " " + d1.annee;
      }
      return formaterDate(b1, langue) + " → " + formaterDate(b2, langue);
    }
    return formaterDate(b1, langue) + " → " + finTexte(b2, langue);  /* fin textuelle : « → En cours » */
  }

  /* ---------- Données ---------- */
  function recuperer() {
    return window.Sheets.loadSheet("parcours").then(function (rows) {
      var out = [];
      rows.forEach(function (r, i) {
        try {
          var titre = window.Sheets.champ(r, ["titre", "title", "nom"], "");
          if (!titre) return;                  /* ligne vide / d'instruction */
          out.push({
            position: i + 1,
            type: window.Sheets.champ(r, ["type", "categorie", "category"], ""),
            titre: titre,
            titre_en: window.Sheets.champ(r, ["titre_en", "title_en"], ""),
            organisation: window.Sheets.champ(r, ["organisation", "organization", "etablissement"], ""),
            date_obtention: window.Sheets.champ(r, ["date_obtention", "date_debut", "date"], ""),
            date_fin: window.Sheets.champ(r, ["date_fin", "date_fin_prevue"], ""),
            description: window.Sheets.champ(r, ["description"], ""),
            description_en: window.Sheets.champ(r, ["description_en"], ""),
            verification_url: window.Sheets.champ(r, ["verification_url", "url_verification", "url"], ""),
            badge_image_url: window.Sheets.champ(r, ["badge_image_url", "badge"], ""),
            featured: window.Sheets.toBool(window.Sheets.champ(r, ["featured", "a_la_une", "mis_en_avant"], "")),
            ordre: window.Sheets.champ(r, ["ordre", "order"], "")
          });
        } catch (e) {
          console.error("[Parcours] Ligne " + (i + 2) + " ignorée :", e);
        }
      });
      out._source = rows._source;
      return out;
    });
  }

  /* Tri : `ordre` numérique quand il est renseigné, sinon position au Sheet */
  function trier(liste) {
    return (liste || []).slice().sort(function (a, b) {
      var oa = nombre(a.ordre), ob = nombre(b.ordre);
      if (oa !== null && ob !== null && oa !== ob) return oa - ob;
      if (oa !== null && ob === null) return -1;
      if (oa === null && ob !== null) return 1;
      return a.position - b.position;
    });
  }

  /* Groupes par `type` (uniquement ceux réellement présents) */
  function grouper(liste) {
    var ordre = [], map = {};
    liste.forEach(function (e) {
      var cle = String(e.type || "").trim() || "__sans_type__";
      var norm = cle.toLowerCase();
      if (!map[cle]) { map[cle] = { cle: cle, norm: norm, items: [] }; ordre.push(cle); }
      map[cle].items.push(e);
    });
    ordre.sort(function (a, b) {
      var na = ORDRE_TYPES[String(a).toLowerCase()] || 99;
      var nb = ORDRE_TYPES[String(b).toLowerCase()] || 99;
      if (na !== nb) return na - nb;
      return ordre.indexOf(a) - ordre.indexOf(b);
    });
    return ordre.map(function (c) {
      var g = map[c];
      g.libelle = libelleGroupe(g.norm) || (c === "__sans_type__" ? "" : c);
      return g;
    });
  }

  function choisir(valeur, valeurEn, langue) {
    if ((langue || "fr") === "en" && String(valeurEn || "").trim()) return valeurEn;
    return valeur;
  }

  /* ---------- Rendu ---------- */
  function extUrl(u) { return window.Sheets.safeExternalUrl(u); }
  function imgUrl(u) { return window.Sheets.safeImageUrl(u); }

  function carte(e, langue) {
    var titre = choisir(e.titre, e.titre_en, langue);
    var desc = choisir(e.description, e.description_en, langue);
    var periode = formaterPeriode(e.date_obtention, e.date_fin, langue);
    var badgeImageSrc = imgUrl(e.badge_image_url);
    var badge = badgeImageSrc
      ? '<img class="parc-badge" src="' + esc(badgeImageSrc) + '" alt="" loading="lazy" decoding="async" fetchpriority="low" onerror="this.remove()">'
      : "";
    var verificationUrl = extUrl(e.verification_url);
    var verif = verificationUrl
      ? '<a class="link-arrow parc-verif" href="' + esc(verificationUrl) + '" target="_blank" rel="noopener" aria-label="' + esc(T("parc.aria.verifier", { t: titre })) + '">' + T("parc.verifier") +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></a>'
      : "";

    return '<article class="card parc-card reveal">' +
      badge +
      '<h3 class="parc-titre">' + esc(titre) + '</h3>' +
      (e.organisation ? '<p class="parc-org">' + esc(e.organisation) + '</p>' : "") +
      (periode ? '<p class="parc-periode"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg><span>' + esc(periode) + '</span></p>' : "") +
      (desc ? '<p class="parc-desc">' + esc(desc) + '</p>' : "") +
      (verif ? '<div class="parc-foot">' + verif + '</div>' : "") +
    '</article>';
  }

  function chargement(n) {
    var s = "";
    for (var i = 0; i < n; i++) s += '<div class="skel" style="min-height:180px"></div>';
    return s;
  }

  function etatVide(titre, texte, hint) {
    return '<div class="empty-state reveal is-visible">' +
      '<div class="es-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 3 2 3H5"/></svg></div>' +
      '<b>' + esc(titre) + '</b><p>' + esc(texte) + '</p>' +
      (hint ? '<span class="empty-hint">' + esc(hint) + '</span>' : "") +
    '</div>';
  }

  function statutSource(el, source, n) {
    if (!el || !el.parentElement) return;
    var ancien = el.parentElement.querySelector(".dyn-source");
    if (ancien) ancien.remove();
    var div = document.createElement("p");
    div.className = "dyn-source" + (source === "local" ? " is-local" : "") + (source === "erreur" ? " is-erreur" : "");
    if (source === "google-sheets") div.innerHTML = '<span class="dot"></span>' + T("etat.donnees") + n + ' ' + (n > 1 ? T("parc.compteur.plur") : T("parc.compteur.sing"));
    else if (source === "local") div.innerHTML = '<span class="dot"></span>' + T("etat.secours");
    else div.innerHTML = '<span class="dot"></span>' + T("etat.erreur");
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

  function rendre(containerId, mode, limite) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var langue = (window.I18n && window.I18n.langue && window.I18n.langue()) || "fr";
    el.innerHTML = chargement(mode === "apercu" ? 3 : 6);

    return recuperer().then(function (liste) {
      var src = liste._source || "google-sheets";
      var tous = trier(liste);

      if (!tous.length) {
        el.innerHTML = etatVide(T("parc.vide.titre"), T("parc.vide.desc"), T("etat.rien.invente"));
        statutSource(el, src, 0);
        return;
      }

      if (mode === "apercu") {
        var sel = tous.filter(function (e) { return e.featured; }).slice(0, limite || 3);
        if (!sel.length) {
          el.innerHTML = etatVide(T("parc.accueil.vide.titre"), T("parc.accueil.vide.desc"), T("parc.accueil.vide.hint"));
          statutSource(el, src, 0);
          return;
        }
        el.innerHTML = '<div class="parc-grid">' + sel.map(function (e) {
          try { return carte(e, langue); } catch (err) { console.error("[Parcours] Entrée non rendue :", e.titre, err); return ""; }
        }).join("") + '</div>';
      } else {
        /* page dédiée : regroupement par `type` réellement présent */
        var groupes = grouper(tous);
        el.innerHTML = groupes.map(function (g) {
          var cartes = g.items.map(function (e) {
            try { return carte(e, langue); } catch (err) { console.error("[Parcours] Entrée non rendue :", e.titre, err); return ""; }
          }).join("");
          return '<section class="parc-groupe">' +
            (g.libelle ? '<h2 class="parc-groupe-titre reveal"><span>' + esc(g.libelle) + '</span><em class="parc-count">' + g.items.length + '</em></h2>' : "") +
            '<div class="parc-grid">' + cartes + '</div>' +
          '</section>';
        }).join("");
      }
      statutSource(el, src, mode === "apercu" ? sel.length : tous.length);
      reveler(el);
    }).catch(function (e) {
      console.error("[Parcours] Erreur de chargement :", e);
      el.innerHTML = etatVide(T("parc.erreur.titre"),
        T("etat.sheet.onglet", { onglet: "Parcours" }));
      statutSource(el, "erreur", 0);
    });
  }

  function page(containerId) { return rendre(containerId, "page"); }
  function apercu(containerId, limite) { return rendre(containerId, "apercu", limite); }

  document.addEventListener("kj:langue", function () {
    Array.prototype.forEach.call(document.querySelectorAll("[data-parc-mode]"), function (el) {
      rendre(el.id, el.getAttribute("data-parc-mode"), parseInt(el.getAttribute("data-parc-limit"), 10) || undefined);
    });
  });

  window.Parcs = {
    page: page,
    apercu: apercu,
    recuperer: recuperer,
    trier: trier,
    grouper: grouper,
    analyserDate: analyserDate,
    formaterDate: formaterDate,
    formaterPeriode: formaterPeriode,
    carte: carte
  };
})();
