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
            /* Phase 3 (2026-10-27) : outils/compétences OPTIONNELS — colonne
               stack_tags (alias competences / compétences / outils / tags,
               variantes espace et casse tolérées via la normalisation
               Sheets.champ), même format que l'onglet Projets (séparateurs
               , · | ;). Absente ou vide du Sheet → rien ne s'affiche
               (aucune donnée inventée). */
            stack_tags: window.Sheets.champ(r, ["stack_tags", "stack tags", "stacktags", "competences", "compétences", "compétence", "outils", "tags"], ""),
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

  /* Phase 1 (2026-10-27) — Split Timeline & Detail Preview : tri
     chronologique de la liste de gauche. Date d'obtention (début de
     période) DÉCROISSANTE : l'entrée la plus récente ouvre la timeline
     (et porte .is-active). Les entrées sans date lisible restent en fin
     de liste, dans l'ordre du Sheet. Aucune date inventée. */
  function trierChrono(liste) {
    return (liste || []).slice().sort(function (a, b) {
      var da = analyserDate(a.date_obtention), db = analyserDate(b.date_obtention);
      if (da && db && da.ts !== db.ts) return db.ts - da.ts;
      if (da && !db) return -1;
      if (!da && db) return 1;
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
    var badgeImageSrc = window.Sheets.optimizedImageUrl(e.badge_image_url, 400);
    var badgeSrcset = window.Sheets.responsiveImageSrcset(e.badge_image_url, [200, 400, 800]);
    var badge = badgeImageSrc
      ? '<img class="parc-badge" src="' + esc(badgeImageSrc) + '"' + (badgeSrcset ? ' srcset="' + esc(badgeSrcset) + '" sizes="96px"' : '') + ' alt="" loading="lazy" decoding="async" fetchpriority="low" onerror="this.remove()">'
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

  /* ---------- Phase 1 (2026-10-27) : Split Timeline & Detail Preview ----------
     Item compact de la liste chronologique (colonne gauche) : pastille
     (badge du Sheet ou icône du type), micro-libellé du type, titre,
     organisation, période en badge. Les items sont des <button> : la
     sélection (bascule du panneau de détail) arrive en Phase 2 — la
     structure et la sémantique sont posées dès maintenant. */
  var ICONES_TYPE = {
    experience: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/></svg>',
    formation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></svg>',
    certification: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/></svg>',
    projet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></svg>'
  };
  var ICONE_DEFAUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.6H22l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4L2 9.6h7.6z"/></svg>';
  function cleTypeIcone(norm) {
    if (/^(experience|experiences|exp[ée]rience)/.test(norm)) return "experience";
    if (/^(formation|formations|licence|diplome|diplôme)/.test(norm)) return "formation";
    if (/^(certification|certifications)/.test(norm)) return "certification";
    if (/^(projet|projets)/.test(norm)) return "projet";
    return "defaut";
  }

  function itemTimeline(e, langue, actif) {
    var titre = choisir(e.titre, e.titre_en, langue);
    var periode = formaterPeriode(e.date_obtention, e.date_fin, langue);
    var norm = String(e.type || "").trim().toLowerCase();
    var typeLibelle = libelleGroupe(norm) || "";
    /* Pastille : badge du Sheet si présent, sinon icône du type. */
    var badgeImageSrc = window.Sheets.optimizedImageUrl(e.badge_image_url, 96);
    var ico = badgeImageSrc
      ? '<img src="' + esc(badgeImageSrc) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">'
      : (ICONES_TYPE[cleTypeIcone(norm)] || ICONE_DEFAUT);
    var aria = [titre, typeLibelle, e.organisation, periode].filter(Boolean).join(", ");
    return '<button type="button" class="career-item reveal' + (actif ? " is-active" : "") + '"' +
      ' data-parc-entry="' + esc(e.position) + '"' +
      (actif ? ' aria-current="true"' : "") +
      ' aria-label="' + esc(aria) + '">' +
      '<span class="career-item-ico" aria-hidden="true">' + ico + "</span>" +
      '<span class="career-item-body">' +
        (typeLibelle ? '<span class="career-item-type">' + esc(typeLibelle) + "</span>" : "") +
        '<span class="career-item-titre">' + esc(titre) + "</span>" +
        (e.organisation ? '<span class="career-item-org">' + esc(e.organisation) + "</span>" : "") +
      "</span>" +
      (periode ? '<span class="career-item-periode">' + esc(periode) + "</span>" : "") +
    "</button>";
  }

  /* ---------- Phase 2 (2026-10-27) : carte Focus dynamique (droite) ----------
     Carte de détail enrichie : grand titre + logo/organisme, badges
     (période, type, « En cours » si date_fin = présent/en cours),
     description détaillée, bouton d'action au libellé adapté au type
     (certification → « Vérifier la certification », projet → « Voir le
     projet », sinon « Voir le détail »). Aucune donnée inventée : un
     champ vide du Sheet disparaît proprement. */
  function estEnCours(e) {
    return /^(present|présent|en cours)$/i.test(String((e && e.date_fin) || "").trim());
  }

  function libelleAction(e) {
    var norm = String(e.type || "").trim().toLowerCase();
    if (/^(certification|certifications)/.test(norm)) return T("parc.action.certification", null, "Vérifier la certification");
    if (/^(projet|projets)/.test(norm)) return T("parc.action.projet", null, "Voir le projet");
    return T("parc.action.generique", null, "Voir le détail");
  }

  function carteFocus(e, langue) {
    var titre = choisir(e.titre, e.titre_en, langue);
    var desc = choisir(e.description, e.description_en, langue);
    var periode = formaterPeriode(e.date_obtention, e.date_fin, langue);
    var norm = String(e.type || "").trim().toLowerCase();
    var typeLibelle = libelleGroupe(norm) || "";
    var badgeImageSrc = window.Sheets.optimizedImageUrl(e.badge_image_url, 200);
    var ico = badgeImageSrc
      ? '<img src="' + esc(badgeImageSrc) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">'
      : (ICONES_TYPE[cleTypeIcone(norm)] || ICONE_DEFAUT);
    var verificationUrl = extUrl(e.verification_url);
    var libelle = libelleAction(e);
    /* Phase 3 : badges d'outils/compétences (colonne optionnelle stack_tags).
       Moteur TOOLS_REGISTRY de projects.js (icônes) quand il est chargé,
       repli pilules textuelles sinon — même langage visuel .stack-badges. */
    var outils = "";
    var jetons = String(e.stack_tags || "").split(/[,·|;]/)
      .map(function (t) { return t.replace(/\s+/g, " ").trim(); })
      .filter(Boolean);
    if (jetons.length) {
      var htmlBadges = (window.Prjs && typeof window.Prjs.stackBadges === "function")
        ? window.Prjs.stackBadges(e)
        : jetons.map(function (t) { return '<span class="stack-badge">' + esc(t) + "</span>"; }).join("");
      outils = '<div class="career-focus-tools">' + htmlBadges + "</div>";
    }
    var action = verificationUrl
      ? '<a class="career-focus-btn" href="' + esc(verificationUrl) + '" target="_blank" rel="noopener"' +
        ' aria-label="' + esc(libelle + " : " + titre) + '">' + esc(libelle) +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>'
      : "";
    return '<article class="career-focus-card reveal is-visible" data-parc-entry="' + esc(e.position) + '">' +
      '<header class="career-focus-head">' +
        '<span class="career-focus-ico" aria-hidden="true">' + ico + "</span>" +
        '<div class="career-focus-headtxt">' +
          (typeLibelle ? '<span class="career-focus-type">' + esc(typeLibelle) + "</span>" : "") +
          '<h2 class="career-focus-titre">' + esc(titre) + "</h2>" +
          (e.organisation ? '<p class="career-focus-org">' + esc(e.organisation) + "</p>" : "") +
        "</div>" +
      "</header>" +
      ((periode || typeLibelle || estEnCours(e))
        ? '<div class="career-focus-badges">' +
          (periode ? '<span class="career-focus-periode"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg><span>' + esc(periode) + "</span></span>" : "") +
          (typeLibelle ? '<span class="career-focus-statut">' + esc(typeLibelle) + "</span>" : "") +
          (estEnCours(e) ? '<span class="career-focus-live"><span class="career-live-dot" aria-hidden="true"></span>' + esc(T("parc.periode.en_cours", null, "En cours")) + "</span>" : "") +
        "</div>"
        : "") +
      (desc ? '<p class="career-focus-desc">' + esc(desc) + "</p>" : "") +
      outils +
      (action ? '<div class="career-focus-foot">' + action + "</div>" : "") +
    "</article>";
  }

  /* Bascule de la sélection : un seul item actif (classe + aria-current),
     permutation de la carte Focus avec la même source de données que la
     liste (closure) — aucune donnée n'est perdue au clic. */
  function selectionner(item, entrees, panel, langue, conteneur) {
    var pos = parseInt(item.getAttribute("data-parc-entry"), 10);
    var e = null;
    for (var i = 0; i < entrees.length; i++) {
      if (entrees[i].position === pos) { e = entrees[i]; break; }
    }
    if (!e) return;
    Array.prototype.forEach.call(conteneur.querySelectorAll(".career-item"), function (b) {
      var actif = b === item;
      b.classList.toggle("is-active", actif);
      if (actif) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    });
    panel.innerHTML = carteFocus(e, langue);
    var carte = panel.firstElementChild;
    if (carte) {
      carte.classList.add("is-swapping");   /* transition CSS (fondu + micro-glissement) */
      carte.addEventListener("animationend", function () {
        carte.classList.remove("is-swapping");
      }, { once: true });
    }
    /* Empilement mobile : si le panneau sort du champ, l'amener en douceur. */
    try {
      var rect = panel.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > (window.innerHeight || 0)) {
        var reduit = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        panel.scrollIntoView({ behavior: reduit ? "auto" : "smooth", block: "nearest" });
      }
    } catch (err) { /* scrollIntoView non critique */ }
  }

  /* Écouteur délégué sur la liste : un seul listener pour tous les items,
     re-créé à chaque rendu (changement de langue inclus). Clic (et clavier
     via les <button>) uniquement — pas de bascule au survol. */
  function brancherInteractions(el, entrees, langue) {
    var liste = el.querySelector(".career-timeline-list");
    var panel = el.querySelector(".career-focus-panel");
    if (!liste || !panel || !entrees.length) return;
    liste.addEventListener("click", function (ev) {
      var item = ev.target && ev.target.closest ? ev.target.closest(".career-item") : null;
      if (!item || !liste.contains(item)) return;
      selectionner(item, entrees, panel, langue, el);
    });
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
        /* Page dédiée — Phase 1 (2026-10-27), Split Timeline & Detail
           Preview : liste chronologique compacte à gauche, carte de détail
           de l'entrée active (la plus récente) à droite. Timeline unifiée :
           les en-têtes de groupes disparaissent, le type reste visible via
           la pastille et le micro-libellé de chaque item. La bascule au
           clic (panneau de détail) arrive en Phase 2. */
        var entrees = trierChrono(tous);
        var rendues = [];
        var items = entrees.map(function (e) {
          try {
            rendues.push(e);
            return itemTimeline(e, langue, rendues.length === 1);
          } catch (err) {
            rendues.pop();
            console.error("[Parcours] Entrée non rendue :", e.titre, err);
            return "";
          }
        }).join("");
        var detail = rendues.length ? carteFocus(rendues[0], langue) : "";
        el.innerHTML =
          '<div class="career-split-container">' +
            '<div class="career-timeline-list">' + items + "</div>" +
            '<div class="career-focus-panel">' + detail + "</div>" +
          "</div>";
        /* Phase 2 : moteur d'interaction — clic sur un item → bascule
           .is-active + permutation de la carte Focus à droite. */
        brancherInteractions(el, rendues, langue);
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
    trierChrono: trierChrono,
    grouper: grouper,
    analyserDate: analyserDate,
    formaterDate: formaterDate,
    formaterPeriode: formaterPeriode,
    carte: carte,
    carteFocus: carteFocus,
    estEnCours: estEnCours,
    libelleAction: libelleAction
  };
})();
