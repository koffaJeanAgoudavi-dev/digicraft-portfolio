/* ============================================================
   SHEETS.JS — Couche CMS Google Sheets (blueprint §18-19)
   ------------------------------------------------------------
   - Charge chaque onglet via l'export CSV public du Sheet
   - Parser CSV léger intégré (aucune dépendance externe,
     conforme à l'objectif performance : zéro bibliothèque)
   - Si le Sheet n'est pas configuré / joignable → données
     locales de secours (js/data/*.json)
   - Expose : Sheets.loadSheet(nom) -> Promise<rows[]>
   ============================================================ */
(function () {
  "use strict";

  /* Parser CSV compatible Google Sheets (champs entre guillemets,
     virgules et retours à la ligne internes, BOM, CRLF) */
  function parseCSV(text) {
    var rows = [], row = [], field = "", inQ = false, i = 0;
    text = String(text).replace(/^\uFEFF/, "");
    while (i < text.length) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; }
          else { inQ = false; i++; }
        } else { field += ch; i++; }
      } else {
        if (ch === '"') { inQ = true; i++; }
        else if (ch === ",") { row.push(field); field = ""; i++; }
        else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; }
        else if (ch === "\r") { i++; }
        else { field += ch; i++; }
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); });
  }

  /* Ligne d'en-tête -> objets {colonne: valeur} */
  function rowsToObjects(rows) {
    if (!rows.length) return [];
    var keys = rows[0].map(function (k) { return String(k).trim(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      keys.forEach(function (k, idx) { o[k] = r[idx] !== undefined ? String(r[idx]).trim() : ""; });
      return o;
    });
  }

  /* Lecture tolérante d'un champ : accepte plusieurs noms de colonne
     (insensible à la casse, espaces ignorés), normalise &amp; -> &,
     et signale les colonnes manquantes avec console.error clair. */
  function champ(row, aliases, def) {
    if (!row) return def;
    for (var i = 0; i < aliases.length; i++) {
      var wanted = String(aliases[i]).toLowerCase().replace(/\s+/g, "");
      for (var k in row) {
        if (String(k).toLowerCase().replace(/\s+/g, "") === wanted) {
          return String(row[k] == null ? "" : row[k]).replace(/&amp;/g, "&").trim();
        }
      }
    }
    return def;
  }

  /* Vérifie qu'une liste de colonnes attendues existe ; logue une
     erreur claire si l'en-tête a changé (évite les échecs silencieux).
     Ne doit JAMAIS lever d'exception. */
  function verifierEnTete(rows, nomOnglet, colonnes) {
    try {
      if (!rows || !rows.length) { console.error("[Sheets] Onglet '" + nomOnglet + "' vide ou sans en-tête."); return; }
      var keys = Object.keys(rows[0]).map(function (k) { return String(k).toLowerCase().trim(); });
      var manquantes = (colonnes || []).filter(function (c) {
        return keys.indexOf(c.toLowerCase()) === -1;
      });
      if (manquantes.length) {
        console.error("[Sheets] Onglet '" + nomOnglet + "' : colonnes attendues absentes : " +
          manquantes.join(", ") + " | colonnes trouvées : " + (keys.join(", ") || "(aucune)"));
      }
    } catch (e) {
      console.error("[Sheets] verifierEnTete (" + nomOnglet + ") :", e);
    }
  }

  function sheetUrl(name) {
    // Priorité aux URLs officielles de publication fournies dans config.js
    if (window.CONFIG.sheetUrls && window.CONFIG.sheetUrls[name]) {
      return window.CONFIG.sheetUrls[name];
    }
    var gid = (window.CONFIG.sheetGids && window.CONFIG.sheetGids[name]) || 0;
    return "https://docs.google.com/spreadsheets/d/" + window.CONFIG.sheetId +
      "/export?format=csv&gid=" + gid;
  }

  function fetchText(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    });
  }

  /* Un onglet est une source stable pendant une page : plusieurs modules
     (Expertise, Projets, accueil) peuvent le demander en même temps.
     Une promesse partagée évite les appels réseau doublés sans créer de
     cache persistant ni empêcher un nouveau chargement après navigation. */
  var cacheOnglets = Object.create(null);

  /* Charge un onglet : Sheet d'abord, secours local ensuite.
     Le tableau retourné porte une propriété _source :
     "google-sheets" ou "local" (utilisée par l'indicateur visuel). */
  function loadSheet(name) {
    if (cacheOnglets[name]) return cacheOnglets[name];

    var useSheet = window.CONFIG.sheetId && !window.CONFIG.forceLocal;
    var optionalEmpty = name === "temoignages" &&
      !(window.CONFIG.sheetUrls && window.CONFIG.sheetUrls[name]) &&
      !(window.CONFIG.sheetGids && window.CONFIG.sheetGids[name]);
    var promise;
    if (optionalEmpty) {
      var absentes = [];
      absentes._source = "google-sheets";
      promise = Promise.resolve(absentes);
    } else if (useSheet) {
      promise = fetchText(sheetUrl(name)).then(function (text) {
        var rows = rowsToObjects(parseCSV(text));
        if (!rows.length) {
          /* Onglet Timeline joignable mais vide : ne PAS basculer sur les
             données locales — le journal d'activité ne doit afficher que
             de vraies données du Sheet (jamais un contenu figé). */
          if (name === "timeline") {
            var vides = [];
            vides._source = "google-sheets";
            return vides;
          }
          throw new Error("Onglet vide");
        }
        verifierEnTete(rows, name, window.CONFIG.colonnesAttendues[name] || []);
        rows._source = "google-sheets";
        return rows;
      }).catch(function (err) {
        console.error("[Sheets] Échec de chargement de l'onglet '" + name + "' :", err);
        console.error("[Sheets] Bascule sur les données locales (js/data/" + name + ".json).");
        return loadLocal(name).then(function (rows) {
          rows._source = "local";
          return rows;
        });
      });
    } else {
      promise = loadLocal(name).then(function (rows) {
        rows._source = "local";
        return rows;
      });
    }
    cacheOnglets[name] = promise;
    return promise;
  }

  function loadLocal(name) {
    var root = window.SITE_ROOT || "";
    return fetch(root + "js/data/" + name + ".json", { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("Données locales introuvables");
      return res.json();
    });
  }

  /* Parametres (cle/valeur) -> objet */
  function paramsToObject(rows) {
    var out = {};
    rows.forEach(function (r) {
      var k = (r.cle || "").trim(), v = (r.valeur !== undefined ? String(r.valeur).trim() : "");
      if (!k || /^Remplacer/i.test(k) || /^Remplacer/i.test(v)) return;
      if (k === "url_webhook_contact") return;
      out[k] = v;
    });
    Object.keys(window.CONFIG.defaults).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = window.CONFIG.defaults[k];
    });
    return out;
  }

  /* Valeurs de contrôle ou URLs factices : ne jamais les afficher comme lien.
     Les espaces sont également refusés dans une URL, car ils signalent presque
     toujours une cellule mal saisie. */
  function isInvalidResource(v) {
    var s = String(v == null ? "" : v).trim();
    return !s || /example\.com|remplacer|placeholder|your[-_ ]?(url|link)|à compléter|a compléter/i.test(s) || /\s/.test(s);
  }

  function safeExternalUrl(v) {
    var s = String(v == null ? "" : v).trim();
    if (isInvalidResource(s)) return "";
    if (/^(mailto:|tel:|#|\/)/i.test(s)) return s;
    if (/^\/\//.test(s)) return "https:" + s;
    return /^https?:\/\//i.test(s) ? s : "https://" + s;
  }

  function safeImageUrl(v) {
    var s = String(v == null ? "" : v).trim();
    if (isInvalidResource(s)) return "";
    if (/^(https?:)?\/\//i.test(s)) return s;
    return (window.SITE_ROOT || "") + s.replace(/^\/+/, "");
  }

  /* booléens : TRUE/FALSE, casse et espaces indifférents. */
  function toBool(v) {
    return /^(true|1|oui|vrai|yes)$/i.test(String(v == null ? "" : v).trim());
  }

  /* tri numérique : accepte 1, 1.1 et la virgule décimale. */
  function byOrder(a, b) {
    var na = parseFloat(String(a && a.ordre != null ? a.ordre : "").replace(",", "."));
    var nb = parseFloat(String(b && b.ordre != null ? b.ordre : "").replace(",", "."));
    na = isNaN(na) ? Number.POSITIVE_INFINITY : na;
    nb = isNaN(nb) ? Number.POSITIVE_INFINITY : nb;
    return na - nb;
  }

  /* Dates Sheet tolérantes, uniformisées en mois/année. */
  function formatDate(v, langue) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "";
    var t = s.toLowerCase();
    if (/^(present|présent|en cours)$/.test(t)) return (langue || (window.I18n && window.I18n.langue && window.I18n.langue()) || "fr") === "en" ? "Present" : "Présent";
    var m = s.match(/^(\d{1,2})[\/. -](\d{1,2})[\/. -](\d{4})$/) || s.match(/^(\d{1,2})[\/-](\d{4})$/);
    var year, month;
    if (m && m.length === 4 && s.match(/^\d{1,2}[\/. -]\d{1,2}[\/. -]\d{4}$/)) { month=+m[2]; year=+m[3]; }
    else if (m) { month=+m[1]; year=+m[2]; }
    else { m=s.match(/^(\d{4})[-\/.](\d{1,2})(?:[-\/.]\d{1,2})?$/); if (m) { year=+m[1]; month=+m[2]; } }
    if (!year || !month || month < 1 || month > 12) return s;
    var fr=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
    var en=["January","February","March","April","May","June","July","August","September","October","November","December"];
    var l=langue || (window.I18n && window.I18n.langue && window.I18n.langue()) || "fr";
    return (l === "en" ? en[month-1] : fr[month-1]) + " " + year;
  }

  /* temps de lecture -> "5 min" */
  function formatMinutes(v) {
    if (!v) return "";
    var n = parseInt(v, 10);
    if (!isNaN(n)) return n + " min";
    return String(v);
  }

  window.Sheets = {
    loadSheet: loadSheet,
    parseCSV: parseCSV,
    rowsToObjects: rowsToObjects,
    paramsToObject: paramsToObject,
    toBool: toBool,
    byOrder: byOrder,
    formatDate: formatDate,
    safeExternalUrl: safeExternalUrl,
    safeImageUrl: safeImageUrl,
    isInvalidResource: isInvalidResource,
    formatMinutes: formatMinutes,
    champ: champ,
    clearCache: function () { cacheOnglets = Object.create(null); }
  };
})();
