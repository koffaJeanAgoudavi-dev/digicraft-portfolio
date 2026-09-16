/* ============================================================
   FICHE PROJET GÉNÉRIQUE — Pages Function (Cloudflare Pages)
   ------------------------------------------------------------
   Route : /projets/<slug>  (avec ou sans slash final)

   Ordre de résolution (fallback propre, sans boucle) :
   1. Un asset statique existe (ex. projets/<slug>/index.html,
      ancienne fiche projet) → renvoyé TEL QUEL, jamais modifié.
      (Les anciens slugs sont en plus exclus de cette Function
      via _routes.json : zéro invocation pour eux.)
   2. URL sans slash final → 308 vers la version avec slash
      (imité du comportement natif de Cloudflare Pages).
   3. Le slug est cherché dans l'onglet Projets du Google Sheet
      (CSV publié, même URL que js/config.js → sheetUrls.projets,
      mis en cache edge ~5 min via caches.default).
      - Trouvé   → projets/fiche.html servi (200) sur l'URL propre
                   /projets/<slug>/ avec title / meta description /
                   canonical / og:* injectés CÔTÉ SERVEUR depuis la
                   ligne du Sheet. Aucun query parameter, aucune
                   redirection : l'URL du navigateur ne change pas.
      - Introuvable → VRAI HTTP 404 avec le contenu de 404.html.
      - Sheet injoignable → « fail open » : fiche.html servi (200)
                   sans injection ; le JS client réessaie de son
                   côté (comportement identique au reste du site).

   ⚠️ Ne jamais introduire de ?slug= ici : le slug vient du chemin
   (params.slug) et le canonical est reconstruit proprement.
   ============================================================ */

/* URL du CSV publié — onglet Projets du Sheet Portfolio_CMS_DIGICRAFT.
   Identique à js/config.js → sheetUrls.projets (source de vérité :
   config.js ; à garder synchronisée si le Sheet est republié). */
const SHEET_PROJETS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKUCRKKu2iTMXxxUT5Jx4Pgiypm1c18HcOcBCv7xKs95lP5BAi0ysDZL0RDdSDA/pub?gid=690207518&single=true&output=csv";

const CACHE_TTL_SECONDS = 300;

/* ---- Parser CSV minimal, porté depuis js/sheets.js (identique) ---- */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  let i = 0;
  text = String(text).replace(/^\uFEFF/, "");
  while (i < text.length) {
    const ch = text[i];
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
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const keys = rows[0].map((k) => String(k).trim());
  return rows.slice(1).map((r) => {
    const o = {};
    keys.forEach((k, idx) => { o[k] = r[idx] !== undefined ? String(r[idx]).trim() : ""; });
    return o;
  });
}

/* Lecture tolérante d'une colonne (insensible à la casse/espaces),
   comme Sheets.champ() côté client. */
function lireChamp(ligne, nom) {
  if (!ligne) return "";
  const voulu = String(nom).toLowerCase().replace(/\s+/g, "");
  for (const k of Object.keys(ligne)) {
    if (String(k).toLowerCase().replace(/\s+/g, "") === voulu) {
      return String(ligne[k] == null ? "" : ligne[k]).replace(/&amp;/g, "&").trim();
    }
  }
  return "";
}

function normaliserSlug(v) {
  return String(v == null ? "" : v).trim().toLowerCase();
}

function echapper(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Remplacement sûr (les valeurs contenant $ ne cassent pas String.replace) */
function remplacer(html, regex, valeur) {
  return html.replace(regex, function (_m, avant, apres) {
    return (avant || "") + valeur + (apres || "");
  });
}

/* ---- CSV du Sheet avec cache edge (caches.default, ~5 min) ---- */
async function chargerLignes(context) {
  try {
    const cache = caches.default;
    const enCache = await cache.match(SHEET_PROJETS_CSV);
    if (enCache) {
      return rowsToObjects(parseCSV(await enCache.text()));
    }
    const res = await fetch(SHEET_PROJETS_CSV, { redirect: "follow" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    const aCacher = new Response(text, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, s-maxage=" + CACHE_TTL_SECONDS,
      },
    });
    if (context && typeof context.waitUntil === "function") {
      context.waitUntil(cache.put(SHEET_PROJETS_CSV, aCacher.clone()));
    } else {
      cache.put(SHEET_PROJETS_CSV, aCacher.clone()).catch(() => {});
    }
    return rowsToObjects(parseCSV(text));
  } catch (e) {
    console.error("[fiche-projet] Google Sheets injoignable :", e);
    return null;
  }
}

/* ---- Récupération d'un asset HTML interne (pretty URL, suit les 308) ---- */
async function recupererAssetHtml(context, chemin) {
  const origine = new URL(context.request.url).origin;
  let res = await context.env.ASSETS.fetch(new Request(origine + chemin));
  if (res.status === 301 || res.status === 302 || res.status === 308) {
    const loc = res.headers.get("Location");
    if (loc) res = await context.env.ASSETS.fetch(new Request(new URL(loc, origine + chemin).href));
  }
  if (!res.ok) return null;
  return res.text();
}

/* ---- Injection SEO serveur : title / description / canonical / OG ---- */
function injecterMeta(html, projet, urlCanonique, origine) {
  const titre = lireChamp(projet, "titre") || "Projet";
  let desc = (lireChamp(projet, "description_courte") || lireChamp(projet, "description_longue"))
    .replace(/\s+/g, " ").trim();
  if (desc.length > 160) desc = desc.slice(0, 157).replace(/\s+\S*$/, "") + "…";
  if (!desc) desc = "Étude de cas " + titre + " — DIGICRAFT Labs.";

  const image = lireChamp(projet, "image_url");
  const imageAbsolue = image
    ? (/^(https?:)?\/\//i.test(image)
        ? (image.charAt(0) === "/" ? "https:" + image : image)
        : origine + "/" + image.replace(/^(\.\/|\/)+/, ""))
    : "";

  html = remplacer(html, /(<title>)[\s\S]*?(<\/title>)/i,
    echapper(titre + " | Étude de cas — DIGICRAFT Labs"));
  html = remplacer(html, /(<meta name="description" content=")[^"]*(")/i, echapper(desc));
  html = remplacer(html, /(<link rel="canonical" href=")[^"]*(")/i, echapper(urlCanonique));
  html = remplacer(html, /(<meta property="og:title" content=")[^"]*(")/i,
    echapper(titre + " | Étude de cas"));
  html = remplacer(html, /(<meta property="og:description" content=")[^"]*(")/i, echapper(desc));
  html = remplacer(html, /(<meta property="og:url" content=")[^"]*(")/i, echapper(urlCanonique));
  if (imageAbsolue) {
    html = remplacer(html, /(<meta property="og:image" content=")[^"]*(")/i, echapper(imageAbsolue));
  }
  return html;
}

async function reponse404(context) {
  const html = await recupererAssetHtml(context, "/404");
  if (html) {
    return new Response(html, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  }
  return new Response("404 — Page introuvable", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function servirFiche(context, projet, slugPropre) {
  const url = new URL(context.request.url);
  let html = await recupererAssetHtml(context, "/projets/fiche");
  if (html === null) html = await recupererAssetHtml(context, "/projets/fiche.html");
  if (html === null) {
    /* Template introuvable (ne devrait jamais arriver) : 404 propre. */
    return reponse404(context);
  }
  const urlCanonique = url.origin + "/projets/" + slugPropre + "/";
  if (projet) html = injecterMeta(html, projet, urlCanonique, url.origin);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  /* 1) Priorité absolue aux assets statiques : les anciennes fiches
        projets (projets/<slug>/index.html) sont renvoyées telles
        quelles, sans aucune modification. */
  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404) return asset;

  /* 2) Normalisation : /projets/<slug> → 308 → /projets/<slug>/
        (même comportement que Pages pour les pages existantes).
        Aucune boucle possible : après redirection, le chemin se
        termine par « / ». */
  if (!url.pathname.endsWith("/")) {
    return Response.redirect(url.origin + url.pathname + "/" + url.search, 308);
  }

  /* 3) Slug extrait du CHEMIN (params.slug) — jamais de query parameter. */
  let slug = "";
  try {
    slug = normaliserSlug(decodeURIComponent(params.slug || ""));
  } catch (e) {
    slug = normaliserSlug(params.slug);
  }
  if (!slug) return reponse404(context);

  /* 4) Recherche du projet dans le Google Sheet (cache edge 5 min). */
  const lignes = await chargerLignes(context);
  let projet = null;
  if (lignes) {
    for (const ligne of lignes) {
      if (normaliserSlug(lireChamp(ligne, "slug")) === slug && lireChamp(ligne, "titre")) {
        projet = ligne;
        break;
      }
    }
  }

  /* 5) Sheet joignable mais slug inconnu → vrai HTTP 404 (page propre). */
  if (lignes && !projet) return reponse404(context);

  /* 6) Projet trouvé (ou Sheet injoignable → fail open : la fiche est
        servie et le JS client réessaiera) → fiche générique sur l'URL
        propre, avec injection SEO serveur si les données sont là. */
  const slugPropre = projet ? normaliserSlug(lireChamp(projet, "slug")) || slug : slug;
  return servirFiche(context, projet, slugPropre);
}
