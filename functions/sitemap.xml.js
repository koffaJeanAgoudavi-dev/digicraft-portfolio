const ORIGIN = "https://digicraft-labs-drf.pages.dev";
const PROJECTS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKUCRKKu2iTMXxxUT5Jx4Pgiypm1c18HcOcBCv7xKs95lP5BAi0ysDZL0RDdSDA/pub?gid=992675999&single=true&output=csv";
const STATIC_ROUTES = [
  ["/", "weekly", "1.0"], ["/projets/", "weekly", "0.9"], ["/expertise/", "monthly", "0.8"],
  ["/activite/", "weekly", "0.8"], ["/articles/", "weekly", "0.8"], ["/boutique/", "monthly", "0.7"],
  ["/parcours/", "monthly", "0.7"], ["/a-propos/", "monthly", "0.7"], ["/contact/", "monthly", "0.7"],
  ["/mentions-legales/", "yearly", "0.4"], ["/confidentialite/", "yearly", "0.4"],
  ["/projets/smartreply-agent/", "monthly", "0.8"], ["/projets/scriboai-bot/", "monthly", "0.8"],
  ["/projets/mysterybot/", "monthly", "0.8"], ["/projets/signaldesk/", "monthly", "0.8"]
];

function csvRows(text) {
  const rows = [], row = [], cells = [];
  let field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(field.trim()); field = ""; }
    else if (ch === '\n') { cells.push(field.trim()); rows.push(cells.splice(0)); field = ""; }
    else if (ch !== '\r') field += ch;
  }
  if (field || cells.length) { cells.push(field.trim()); rows.push(cells); }
  if (!rows.length) return [];
  const headers = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] || ""])));
}

function xml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;"}[ch]));
}
function entry(path, freq, priority, lastmod) {
  return `  <url><loc>${xml(ORIGIN + path)}</loc><lastmod>${lastmod}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`;
}

export async function onRequest(context) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const paths = [...STATIC_ROUTES];
  try {
    const res = await fetch(PROJECTS_CSV, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (res.ok) {
      const rows = csvRows(await res.text());
      const known = new Set(paths.map(([path]) => path));
      for (const row of rows) {
        const slug = String(row.slug || '').trim().replace(/^\/+|\/+$/g, '');
        if (!slug) continue;
        const path = `/projets/${encodeURIComponent(slug)}/`;
        if (!known.has(path)) { paths.push([path, 'monthly', '0.8']); known.add(path); }
      }
    }
  } catch (_) {
    // Static routes remain available when the public Sheet is unreachable.
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(([path, freq, priority]) => entry(path, freq, priority, lastmod)).join('\n')}\n</urlset>\n`;
  return new Response(body, { status: 200, headers: {
    "content-type": "application/xml; charset=UTF-8",
    "cache-control": "public, max-age=300, s-maxage=300",
    "x-content-type-options": "nosniff"
  }});
}
