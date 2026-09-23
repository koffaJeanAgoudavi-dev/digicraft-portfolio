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

  /* Un onglet est "configuré" s'il a une URL publiée OU un gid non nul.
     QG (Étape 1) : les nouveaux onglets (Certifications, Timeline) ont
     gid = 0 et URL vide tant que le Sheet n'est pas prêt → on bascule
     DIRECTEMENT sur le fallback local au lieu de fetcher le mauvais
     onglet (gid 0 = premier onglet du classeur). */
  function ongletConfigure(name) {
    var urls = window.CONFIG.sheetUrls || {};
    var gids = window.CONFIG.sheetGids || {};
    if (urls[name]) return true;
    return !!gids[name];
  }

  /* ---------- Cache client (localStorage) ----------
     Objectif performance : le Sheet n'est sollicité qu'une fois par
     onglet et par fenêtre de fraîcheur, au lieu d'un appel réseau à
     chaque page vue.
     - Lecture : entrée fraîche → réponse immédiate (zéro requête)
     - Rechargement manuel (F5 / Ctrl+R) → cache ignoré (données fraîches)
     - Échec réseau → dernière copie connue (même expirée) avant le local
     - localStorage indisponible / quota → comportement d'origine
     - Transparence : _source = "cache" est affiché dans l'indicateur */
  var CACHE_PREFIX = "dgc.cms.v1.";
  var CACHE_TTL = 15 * 60 * 1000;        // onglets de contenu : 15 min
  var CACHE_TTL_PARAMS = 3 * 60 * 1000;  // Parametres : 3 min (réglages)

  function ttlPour(name) {
    return name === "parametres" ? CACHE_TTL_PARAMS : CACHE_TTL;
  }
  function rechargementManuel() {
    try {
      if (!window.performance || !performance.getEntriesByType) return false;
      var nav = performance.getEntriesByType("navigation")[0];
      return !!nav && nav.type === "reload";
    } catch (e) { return false; }
  }
  function cacheLire(name, ignorerTtl) {
    try {
      var raw = window.localStorage.getItem(CACHE_PREFIX + name);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.t || !o.rows || !o.rows.length) return null;
      if (!ignorerTtl && Date.now() - o.t > ttlPour(name)) return null;
      return o.rows;
    } catch (e) { return null; }
  }
  function cacheEcrire(name, rows) {
    try {
      window.localStorage.setItem(CACHE_PREFIX + name,
        JSON.stringify({ t: Date.now(), rows: rows }));
    } catch (e) { /* quota / navigation privée : ignoré sans bruit */ }
  }

  /* Charge un onglet : cache → Sheet → cache expiré → local.
     Le tableau retourné porte une propriété _source :
     "google-sheets", "cache" ou "local" (indicateur visuel). */
  function loadSheet(name) {
    var useSheet = window.CONFIG.sheetId && !window.CONFIG.forceLocal && ongletConfigure(name);
    if (window.CONFIG.sheetId && !window.CONFIG.forceLocal && !ongletConfigure(name)) {
      console.warn("[Sheets] Onglet '" + name + "' non configuré (gid/URL manquants) — fallback local.");
    }
    if (useSheet) {
      if (!rechargementManuel()) {
        var enCache = cacheLire(name, false);
        if (enCache) { enCache._source = "cache"; return Promise.resolve(enCache); }
      }
      return fetchText(sheetUrl(name)).then(function (text) {
        var rows = rowsToObjects(parseCSV(text));
        if (!rows.length) {
          /* Onglet joignable mais vide : ne PAS basculer sur les données
             locales — une section ne doit s'afficher que si le Sheet
             contient de vraies lignes (ex. Timeline, Certifications).
             Exception : `parametres` (clé/valeur) et les onglets de
             contenu dont le repli local est légitime. */
          if (name === "parametres") throw new Error("Onglet vide");
          var vides = [];
          vides._source = "google-sheets";
          return vides;
        }
        verifierEnTete(rows, name, window.CONFIG.colonnesAttendues[name] || []);
        cacheEcrire(name, rows);
        rows._source = "google-sheets";
        return rows;
      }).catch(function (err) {
        console.error("[Sheets] Échec de chargement de l'onglet '" + name + "' :", err);
        /* Résilience : dernière copie connue (même expirée) avant le local */
        var perime = cacheLire(name, true);
        if (perime) {
          console.warn("[Sheets] Dernière copie locale (cache) utilisée pour '" + name + "'.");
          perime._source = "cache";
          return perime;
        }
        console.error("[Sheets] Bascule sur les données locales (js/data/" + name + ".json).");
        return loadLocal(name).then(function (rows) {
          rows._source = "local";
          return rows;
        });
      });
    }
    return loadLocal(name).then(function (rows) {
      rows._source = "local";
      return rows;
    });
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
      out[k] = v;
    });
    Object.keys(window.CONFIG.defaults).forEach(function (k) {
      if (!out[k]) out[k] = window.CONFIG.defaults[k];
    });
    return out;
  }

  /* booléens du Sheet : TRUE/true/1/oui/vrai */
  function toBool(v) {
    return /^(true|1|oui|vrai|yes)$/i.test(String(v).trim());
  }

  /* tri par colonne `ordre` croissant */
  function byOrder(a, b) {
    var na = parseInt(a.ordre, 10) || 0, nb = parseInt(b.ordre, 10) || 0;
    return na - nb;
  }

  /* formatage date ISO -> "Juil. 2026" */
  function formatDate(v) {
    if (!v) return "";
    var s = String(v).trim();
    if (/^\d{4}-\d{2}$/.test(s)) s += "-15"; // année-mois seulement
    var d = new Date(s + "T00:00:00");
    if (isNaN(d.getTime())) return s;
    var m = d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
    return m.charAt(0).toUpperCase() + m.slice(1).replace(".", ".");
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
    formatMinutes: formatMinutes,
    champ: champ
  };
})();
