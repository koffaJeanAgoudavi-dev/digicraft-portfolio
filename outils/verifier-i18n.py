#!/usr/bin/env python3
"""Vérifie le contrat i18n avant publication.

Le générateur doit être exécuté juste avant ce script : js/i18n.js est alors
la sortie synchronisée des sources FR/EN et des modules.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def keys_in_runtime() -> tuple[set[str], set[str]]:
    text = (ROOT / "js/i18n.js").read_text(encoding="utf-8")
    fr_block = re.search(r"\bfr:\s*\{(.*?)\n\s*\},\n\s*en:\s*\{", text, re.S)
    en_block = re.search(r"\ben:\s*\{(.*?)\n\s*\}\n\s*};", text, re.S)
    if not fr_block or not en_block:
        raise SystemExit("[i18n] structure FR/EN introuvable dans js/i18n.js")
    pattern = re.compile(r'^\s+"([^"\n]+)":\s*', re.M)
    return set(pattern.findall(fr_block.group(1))), set(pattern.findall(en_block.group(1)))


def keys_used() -> set[str]:
    used: set[str] = set()
    for path in list(ROOT.rglob("*.html")) + list((ROOT / "js").glob("*.js")):
        if path.name == "i18n.js" or ".git" in path.parts:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for attr in ("data-i18n", "data-i18n-aria", "data-i18n-title", "data-i18n-placeholder", "data-i18n-content"):
            used.update(re.findall(rf'{re.escape(attr)}=["\']([^"\']+)', text))
        # Modules use T(...)/t(...) with a literal key as first argument.
        used.update(re.findall(r'\bT\(\s*["\']([^"\']+)', text))
        used.update(re.findall(r'(?<![.\w])t\(\s*["\']([^"\']+)', text))
    return used


def main() -> None:
    fr, en = keys_in_runtime()
    used = keys_used()
    errors: list[str] = []
    if fr != en:
        errors.append("FR/EN désynchronisés: " + ", ".join(sorted(fr ^ en)))
    for language, dictionary in (("FR", fr), ("EN", en)):
        missing = sorted(used - dictionary)
        if missing:
            errors.append(f"clés utilisées absentes en {language}: " + ", ".join(missing))
    html_key_text = []
    for path in ROOT.rglob("*.html"):
        text = path.read_text(encoding="utf-8", errors="ignore")
        for key in used:
            if re.search(rf">\s*{re.escape(key)}\s*<", text):
                html_key_text.append(f"{path.relative_to(ROOT)}: {key}")
    if html_key_text:
        errors.append("clés affichées comme texte brut: " + "; ".join(html_key_text))
    if errors:
        for error in errors:
            print("[i18n] ERREUR: " + error, file=sys.stderr)
        raise SystemExit(1)
    print(f"[i18n] OK: {len(used)} clés utilisées, {len(fr)} traductions FR et EN synchronisées")


if __name__ == "__main__":
    main()
