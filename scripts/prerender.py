#!/usr/bin/env python3
"""Pré-rendu statique du contenu public du Sheet pour Cloudflare Pages.

Le script est volontairement strict : une erreur réseau, un en-tête invalide ou
une donnée obligatoire absente fait échouer le build avant publication. Aucun
fichier HTML n'est écrit tant que toutes les sources n'ont pas été validées.
Le JavaScript du site reste actif et rafraîchit les mêmes conteneurs au chargement.
"""
from __future__ import annotations

import csv
import html
import re
import sys
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "parametres": ["cle", "valeur"],
    "projets": ["titre", "slug", "categorie", "badge_statut", "description_courte", "image_url", "stack_tags", "statut", "date", "type_lien", "url_destination", "featured", "ordre", "probleme", "solution", "technologies_detail", "resultat"],
    "articles": ["titre", "plateforme", "description", "temps_lecture", "url", "date", "featured", "ordre", "titre_en", "description_en"],
    "ressources": ["type", "nom_produit", "description", "prix", "devise", "url_boutique", "badge", "featured", "ordre", "nom_produit_en", "description_en"],
    "timeline": ["id", "titre", "description", "image_url", "statut", "date", "lien_optionnel", "featured", "ordre"],
    "expertise": ["titre", "description_courte", "description_longue", "icone", "categorie", "exemples_projets", "ordre"],
    "parcours": ["type", "titre", "organisation", "date_obtention", "date_fin", "description", "verification_url", "ordre"],
}


def fail(message: str) -> None:
    raise RuntimeError("[prerender] " + message)


def config_urls() -> dict[str, str]:
    text = (ROOT / "js/config.js").read_text(encoding="utf-8")
    block = re.search(r"sheetUrls\s*:\s*\{(.*?)\n\s*\},", text, re.S)
    if not block:
        fail("bloc sheetUrls introuvable dans js/config.js")
    found = dict(re.findall(r"^\s*(\w+)\s*:\s*\"([^\"]+)\"", block.group(1), re.M))
    missing = sorted(set(EXPECTED) - set(found))
    if missing:
        fail("URL CSV manquante pour " + ", ".join(missing))
    return found


def fetch_rows(name: str, url: str) -> list[dict[str, str]]:
    request = Request(url, headers={"User-Agent": "DIGICRAFT-prerender/1.0"})
    try:
        raw = urlopen(request, timeout=30).read().decode("utf-8-sig")
    except Exception as exc:
        fail(f"CSV {name} injoignable: {exc}")
    rows = list(csv.DictReader(raw.splitlines()))
    headers = list(rows[0].keys()) if rows else []
    missing_headers = [key for key in EXPECTED[name] if key not in headers]
    if missing_headers:
        fail(f"en-têtes invalides pour {name}, colonnes absentes: {missing_headers!r}; reçues: {headers!r}")
    if name != "parametres" and not rows:
        fail(f"CSV {name} vide")
    for number, row in enumerate(rows, 2):
        if any(key not in row for key in EXPECTED[name]):
            fail(f"ligne {number} invalide dans {name}")
    return [{k: (v or "").strip() for k, v in row.items()} for row in rows]


def truth(value: str) -> bool:
    return str(value).strip().lower() in {"true", "vrai", "1", "oui", "yes", "y"}


def order(row: dict[str, str]) -> tuple[int, str]:
    try:
        return (int(row.get("ordre", "999999") or "999999"), row.get("titre", ""))
    except ValueError:
        return (999999, row.get("titre", ""))


def e(value: str) -> str:
    return html.escape(str(value or ""), quote=True)


def link(value: str) -> str:
    value = (value or "").strip()
    if not value:
        return ""
    if value.startswith("/"):
        return value
    if not re.match(r"^https?://", value, re.I):
        value = "https://" + value
    return value if re.match(r"^https://[^\s<>\"']+$", value, re.I) else ""


def card(title: str, description: str, meta: str = "", href: str = "") -> str:
    title_html = f"<h3>{e(title)}</h3>" if title else ""
    meta_html = f"<p class=\"prerender-meta\">{e(meta)}</p>" if meta else ""
    link_html = f"<p><a href=\"{e(href)}\">Voir le détail →</a></p>" if href else ""
    return f"<article class=\"card prerender-card\">{meta_html}{title_html}<p>{e(description)}</p>{link_html}</article>"


def noscript(label: str, cards: list[str]) -> str:
    if not cards:
        return ""
    return f"\n<noscript data-prerender=\"true\" class=\"prerender-content\"><div class=\"section-head\"><p class=\"eyebrow\">{e(label)}</p></div><div class=\"grid-3 prerender-grid\">{''.join(cards)}</div></noscript>\n"


def clean_existing(text: str) -> str:
    return re.sub(r"\n?<noscript data-prerender=\"true\".*?</noscript>\n?", "\n", text, flags=re.S)


def insert_after_mount(text: str, mount_id: str, content: str) -> str:
    if not content:
        return text
    pattern = re.compile(rf"(<(?:div|ol)\b[^>]*\bid=\"{re.escape(mount_id)}\"[^>]*>.*?</(?:div|ol)>)", re.S)
    match = pattern.search(text)
    if not match:
        fail(f"conteneur HTML introuvable: {mount_id}")
    return text[:match.end()] + content + text[match.end():]


def main() -> None:
    urls = config_urls()
    data = {name: fetch_rows(name, urls[name]) for name in EXPECTED}
    params = {row["cle"]: row["valeur"] for row in data["parametres"] if row.get("cle")}
    required_params = ["hero_titre", "hero_role", "hero_accroche", "hero_promesse"]
    missing = [key for key in required_params if not params.get(key)]
    if missing:
        fail("Parametres obligatoires absents: " + ", ".join(missing))

    # Prepare every fragment first; no HTML is written until all validation passes.
    projects = sorted([r for r in data["projets"] if r["titre"]], key=order)
    expertise = sorted([r for r in data["expertise"] if r["titre"]], key=order)
    articles = sorted([r for r in data["articles"] if r["titre"]], key=order)
    resources = sorted([r for r in data["ressources"] if r["nom_produit"]], key=order)
    timeline = sorted([r for r in data["timeline"] if r["titre"]], key=order)
    parcours = sorted([r for r in data["parcours"] if r["titre"]], key=order)

    fragments = {
        "expertise": noscript("Expertise", [card(r["titre"], r["description_courte"], r["categorie"]) for r in expertise]),
        "projets": noscript("Projets", [card(r["titre"], r["description_courte"], r["categorie"] + (" · " + r["badge_statut"] if r["badge_statut"] else ""), link(r["url_destination"])) for r in projects]),
        "articles": noscript("Articles", [card(r["titre"], r["description"], r["plateforme"] + (" · " + r["date"] if r["date"] else ""), link(r["url"])) for r in articles]),
        "ressources": noscript("Ressources", [card(r["nom_produit"], r["description"], r["type"] + (" · " + r["prix"] + " " + r["devise"] if r["prix"] else ""), link(r["url_boutique"])) for r in resources]),
        "timeline": noscript("Activité", [card(r["titre"], r["description"], r["date"] + (" · " + r["statut"] if r["statut"] else ""), link(r["lien_optionnel"])) for r in timeline]),
        "parcours": noscript("Parcours", [card(r["titre"], r["description"], r["type"] + (" · " + r["organisation"] if r["organisation"] else ""), link(r["verification_url"])) for r in parcours]),
    }
    home_rows = []
    for name, rows, label, field in [("expertise", expertise, "Expertise", "titre"), ("projets", projects, "Projets", "titre"), ("articles", articles, "Articles", "titre"), ("timeline", timeline, "Activité", "titre"), ("parcours", parcours, "Parcours", "titre")]:
        chosen = [r for r in rows if truth(r.get("featured", ""))] or rows
        for row in chosen[:4]:
            desc = row.get("description_courte") or row.get("description") or row.get("description_longue") or ""
            home_rows.append(card(row.get(field, ""), desc, label))
    fragments["home"] = noscript("Contenu du Sheet", home_rows)

    files = {
        "expertise/index.html": [("grille-expertise", fragments["expertise"])],
        "projets/index.html": [("grille-projets", fragments["projets"])],
        "activite/index.html": [("timeline-activite", fragments["timeline"])],
        "articles/index.html": [("grille-articles", fragments["articles"])],
        "parcours/index.html": [("parcours-liste", fragments["parcours"])],
        "boutique/index.html": [("grille-ressources", fragments["ressources"])],
    }
    prepared: dict[Path, str] = {}
    for filename, mounts in files.items():
        path = ROOT / filename
        text = clean_existing(path.read_text(encoding="utf-8"))
        for mount_id, fragment in mounts:
            text = insert_after_mount(text, mount_id, fragment)
        prepared[path] = text

    home = ROOT / "index.html"
    home_text = clean_existing(home.read_text(encoding="utf-8"))
    home_text = re.sub(r'(<h1\b[^>]*data-p-nom[^>]*>).*?(</h1>)', r'\1' + e(params["hero_titre"]) + r'\2', home_text, count=1)
    home_text = re.sub(r'(<p\b[^>]*data-p-titre[^>]*>).*?(</p>)', r'\1' + e(params["hero_role"]) + r'\2', home_text, count=1)
    home_text = re.sub(r'(<p\b[^>]*data-p-slogan[^>]*>).*?(</p>)', r'\1' + e(params["hero_accroche"]) + r'\2', home_text, count=1)
    home_text = re.sub(r'(<p\b[^>]*data-p-desc-hero[^>]*>).*?(</p>)', r'\1' + e(params["hero_promesse"]) + r'\2', home_text, count=1)
    marker = "    <!-- ============ CTA FINAL ============ -->"
    if marker not in home_text:
        fail("point d'insertion homepage introuvable")
    home_text = home_text.replace(marker, fragments["home"] + "\n" + marker, 1)
    prepared[home] = home_text

    # Atomic writes: an exception before this point leaves the previous deploy source intact.
    for path, text in prepared.items():
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, delete=False) as tmp:
            tmp.write(text)
            temporary = Path(tmp.name)
        temporary.replace(path)
    print("[prerender] OK: " + ", ".join(str(p.relative_to(ROOT)) for p in prepared))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
