#!/usr/bin/env bash
# ============================================================
# verification.sh — Contrôle post-déploiement V1.3
# ------------------------------------------------------------
# Usage :
#   bash verification.sh                                  → production
#   bash verification.sh https://<preview>.pages.dev      → preview de branche
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
PASS=0; FAIL=0
TMP=$(mktemp -d)

check() { # $1 = code retour (0 = succès), $2 = libellé
  if [ "$1" -eq 0 ]; then PASS=$((PASS+1)); echo "  ✅ $2"
  else FAIL=$((FAIL+1)); echo "  ❌ $2"; fi
}

echo "Vérification V1.3 sur : $BASE"
echo

echo "1) Ancien projet — page statique intacte"
CODE=$(curl -s -o "$TMP/a.html" -w "%{http_code}" "$BASE/projets/smartreply-agent/")
[ "$CODE" = "200" ]; check $? "GET /projets/smartreply-agent/ → 200 (obtenu : $CODE)"
grep -q 'data-cs-page="smartreply-agent"' "$TMP/a.html"; check $? "page statique servie (data-cs-page figé)"
grep -q 'Le workflow' "$TMP/a.html"; check $? "contenu spécifique SmartReply présent"

echo "2) MarketPulse AI — fiche générique dynamique"
CODE=$(curl -s -o "$TMP/b.html" -w "%{http_code}" "$BASE/projets/marketpulse-ai/")
[ "$CODE" = "200" ]; check $? "GET /projets/marketpulse-ai/ → 200 (obtenu : $CODE)"
grep -q '<title>MarketPulse AI | Étude de cas — DIGICRAFT Labs</title>' "$TMP/b.html"; check $? "title injecté côté serveur (Function)"
CANON=$(grep -o '<link rel="canonical" href="[^"]*"' "$TMP/b.html" | head -1 | sed 's/.*href="//;s/"$//')
[ "$CANON" = "$BASE/projets/marketpulse-ai/" ]; check $? "canonical = URL propre (obtenu : ${CANON:-aucun})"
OG=$(grep -o '<meta property="og:title" content="[^"]*"' "$TMP/b.html" | head -1)
echo "$OG" | grep -q 'MarketPulse AI'; check $? "og:title injecté (aperçus sociaux)"
! grep -q '?slug=' "$TMP/b.html"; check $? "aucun ?slug= dans le HTML"
grep -q 'data-cs-dynamic' "$TMP/b.html"; check $? "template générique servi (data-cs-dynamic)"

echo "3) Projet inexistant — vrai HTTP 404"
CODE=$(curl -s -o "$TMP/c.html" -w "%{http_code}" "$BASE/projets/projet-inexistant/")
[ "$CODE" = "404" ]; check $? "GET /projets/projet-inexistant/ → 404 (obtenu : $CODE)"
grep -q "Cette page n'existe pas" "$TMP/c.html"; check $? "contenu = 404.html du site"

echo "4) Redirections — sans slash, aucune boucle"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projets/marketpulse-ai")
[ "$CODE" = "308" ]; check $? "sans slash → 308 (obtenu : $CODE)"
OUT=$(curl -s -o /dev/null -L --max-redirs 3 -w "%{http_code} %{num_redirects}" "$BASE/projets/marketpulse-ai")
CODE=$(echo "$OUT" | cut -d' ' -f1); N=$(echo "$OUT" | cut -d' ' -f2)
[ "$CODE" = "200" ] && [ "$N" = "1" ]; check $? "suivi → 200 en 1 seul saut (obtenu : $CODE, $N saut)"

echo "5) Intégrité du site"
CODE=$(curl -s -o "$TMP/d.html" -w "%{http_code}" "$BASE/projets/")
[ "$CODE" = "200" ]; check $? "GET /projets/ (listing) → 200"
grep -q 'grille-projets' "$TMP/d.html"; check $? "listing intact"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/css/style.css")
[ "$CODE" = "200" ]; check $? "GET /css/style.css → 200"

echo
rm -rf "$TMP"
echo "════════ Résultat : $PASS réussis, $FAIL échoués ════════"
if [ "$FAIL" -eq 0 ]; then echo "V1.3 conforme ✅ — fusion dans main possible"; exit 0
else echo "Non conforme ❌ — ne pas fusionner, inspecter les échecs ci-dessus"; exit 1; fi
