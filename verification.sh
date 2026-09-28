#!/usr/bin/env bash
# ============================================================
# verification.sh — Contrôle post-déploiement (v0.2)
# ------------------------------------------------------------
# Usage :
#   bash verification.sh                                  → production
#   bash verification.sh https://<preview>.pages.dev      → preview de branche
#   bash verification.sh <base> <slug-dynamique>          → slug d'une fiche
#                                                           servie par le Sheet
#                                                           (défaut : signaldesk)
#
# La preview de branche se trouve dans :
#   dashboard Cloudflare → Pages → digicraft-labs-drf →
#   Deployments → déploiement de la branche → lien unique
#   (les Functions y fonctionnent ; Pages y ajoute X-Robots-Tag
#   noindex automatiquement → aucun risque SEO pendant les tests).
# ============================================================
set -u
BASE="${1:-https://digicraft-labs-drf.pages.dev}"
BASE="${BASE%/}"
SLUG="${2:-signaldesk}"
PASS=0; FAIL=0
TMP=$(mktemp -d)

check() { # $1 = code retour (0 = succès), $2 = libellé
  if [ "$1" -eq 0 ]; then PASS=$((PASS+1)); echo "  ✅ $2"
  else FAIL=$((FAIL+1)); echo "  ❌ $2"; fi
}

echo "Vérification v0.2 sur : $BASE"
echo

echo "1) Accueil et pages principales (toutes doivent répondre 200)"
for CHEMIN in "/" "/expertise/" "/projets/" "/activite/" "/parcours/" \
              "/articles/" "/boutique/" "/a-propos/" "/contact/"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$CHEMIN")
  [ "$CODE" = "200" ]; check $? "GET $CHEMIN → 200 (obtenu : $CODE)"
done

echo
echo "2) Étude de cas statique — contenu et gabarit v2"
CODE=$(curl -s -o "$TMP/a.html" -w "%{http_code}" "$BASE/projets/smartreply-agent/")
[ "$CODE" = "200" ]; check $? "GET /projets/smartreply-agent/ → 200 (obtenu : $CODE)"
grep -q 'data-cs-page="smartreply-agent"' "$TMP/a.html"; check $? "page statique servie (data-cs-page figé)"
grep -q 'Le workflow' "$TMP/a.html"; check $? "contenu spécifique SmartReply présent"

echo
echo "3) Fiche générique dynamique (slug publié dans le Sheet : $SLUG)"
CODE=$(curl -s -o "$TMP/b.html" -w "%{http_code}" "$BASE/projets/$SLUG/")
[ "$CODE" = "200" ]; check $? "GET /projets/$SLUG/ → 200 (obtenu : $CODE)"
CANON=$(grep -o '<link rel="canonical" href="[^"]*"' "$TMP/b.html" | head -1 | sed 's/.*href="//;s/"$//')
[ "$CANON" = "$BASE/projets/$SLUG/" ]; check $? "canonical = URL propre (obtenu : ${CANON:-aucun})"
grep -q 'data-cs-dynamic' "$TMP/b.html"; check $? "template générique servi (data-cs-dynamic)"
! grep -q '?slug=' "$TMP/b.html"; check $? "aucun ?slug= dans le HTML"

echo
echo "4) Projet inexistant — vrai HTTP 404"
CODE=$(curl -s -o "$TMP/c.html" -w "%{http_code}" "$BASE/projets/projet-inexistant/")
[ "$CODE" = "404" ]; check $? "GET /projets/projet-inexistant/ → 404 (obtenu : $CODE)"
grep -q "Cette page n'existe pas" "$TMP/c.html"; check $? "contenu = 404.html du site"

echo
echo "5) Redirections — sans slash (308) et ancienne page retirée (301)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projets/$SLUG")
[ "$CODE" = "308" ]; check $? "/projets/$SLUG sans slash → 308 (obtenu : $CODE)"
OUT=$(curl -s -o /dev/null -L --max-redirs 3 -w "%{http_code} %{num_redirects}" "$BASE/projets/$SLUG")
CODE=$(echo "$OUT" | cut -d' ' -f1); N=$(echo "$OUT" | cut -d' ' -f2)
[ "$CODE" = "200" ] && [ "$N" = "1" ]; check $? "suivi → 200 en 1 seul saut (obtenu : $CODE, $N saut)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/build-in-public/")
[ "$CODE" = "301" ]; check $? "/build-in-public/ → 301 (obtenu : $CODE)"
OUT=$(curl -s -o /dev/null -L --max-redirs 3 -w "%{http_code} %{num_redirects} %{url_effective}" "$BASE/build-in-public/")
CODE=$(echo "$OUT" | cut -d' ' -f1); N=$(echo "$OUT" | cut -d' ' -f2); FIN=$(echo "$OUT" | cut -d' ' -f3)
[ "$CODE" = "200" ] && [ "$N" = "1" ]; check $? "suivi → 200 en 1 saut vers /activite/ (obtenu : $CODE, $N saut, $FIN)"

echo
echo "6) Bilinguisme FR/EN"
CODE=$(curl -s -o "$TMP/d.html" -w "%{http_code}" "$BASE/")
[ "$CODE" = "200" ]; check $? "GET / → 200"
grep -q '<html lang="fr">' "$TMP/d.html"; check $? "lang=\"fr\" par défaut"
grep -q 'data-i18n=' "$TMP/d.html"; check $? "textes marqués data-i18n présents"
grep -q 'data-lang="en"' "$TMP/d.html"; check $? "bouton de bascule EN présent"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/js/i18n.js")
[ "$CODE" = "200" ]; check $? "GET /js/i18n.js → 200"

echo
echo "7) Sitemap et robots — routes réelles, aucune URL morte connue"
CODE=$(curl -s -o "$TMP/s.xml" -w "%{http_code}" "$BASE/sitemap.xml")
[ "$CODE" = "200" ]; check $? "GET /sitemap.xml → 200"
! grep -q 'marketpulse' "$TMP/s.xml"; check $? "aucune référence à un projet retiré"
! grep -q 'build-in-public' "$TMP/s.xml"; check $? "aucune référence à Build in Public"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/robots.txt")
[ "$CODE" = "200" ]; check $? "GET /robots.txt → 200"

echo
echo "8) Ressources statiques"
for F in "/css/style.css" "/js/main.js" "/js/projects.js" "/js/activite.js" "/favicon.png"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$F")
  [ "$CODE" = "200" ]; check $? "GET $F → 200"
done

echo
rm -rf "$TMP"
echo "════════ Résultat : $PASS réussis, $FAIL échoués ════════"
if [ "$FAIL" -eq 0 ]; then echo "v0.2 conforme ✅ — fusion dans main possible"; exit 0
else echo "Non conforme ❌ — ne pas fusionner, inspecter les échecs ci-dessus"; exit 1; fi
