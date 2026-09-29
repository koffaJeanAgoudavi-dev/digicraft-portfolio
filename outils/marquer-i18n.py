#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
outils/marquer-i18n.py — Étape 10 (bilingue FR/EN)
Marque les textes FR statiques des pages avec data-i18n="cle" et collecte le
texte FR EXACT (extrait du HTML, jamais recopié) dans outils/_fr.json.

Usage : python3 outils/marquer-i18n.py
"""
import html as _html
import json, os, re, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FR = {}
REGLES = []          # (fichiers, motif, cle, groupe, mode)
MANQUANTS = []


def r(fichiers, motif, cle, groupe=2, mode="attr", requis=True):
    """mode 'attr' : pose data-i18n sur la balise du groupe 1.
       mode 'span' : enveloppe le texte du groupe `groupe` dans un <span data-i18n>."""
    if isinstance(fichiers, str):
        fichiers = [fichiers]
    REGLES.append((fichiers, re.compile(motif, re.S), cle, groupe, mode, requis))


def appliquer(ecrire=True):
    for fichier in sorted({f for fs, _, _, _, _, _ in REGLES for f in fs}):
        chemin = os.path.join(RACINE, fichier)
        src = open(chemin, encoding="utf-8").read()
        out = src
        for fs, motif, cle, groupe, mode, requis in REGLES:
            if fichier not in fs:
                continue

            def repl(m):
                texte = m.group(groupe)
                FR[cle] = _html.unescape(texte)
                if mode == "meta":
                    return m.group(1) + m.group(2) + '" data-i18n-content="%s">' % cle
                if mode == "placeholder":
                    val = re.match(r'placeholder="([^"]*)"', m.group(2)).group(1)
                    FR[cle] = _html.unescape(val)
                    return m.group(1) + m.group(2) + ' data-i18n-placeholder="%s"' % cle + m.group(3)
                if mode == "aria":
                    return m.group(1) + m.group(2) + '" data-i18n-aria="%s"' % cle + (m.group(3) or "")
                if mode == "span_texte":
                    return m.group(0).replace(
                        m.group(2),
                        '<span data-i18n="%s">%s</span>' % (cle, m.group(2)), 1)
                if mode == "span":
                    return m.group(0).replace(
                        m.group(groupe),
                        '<span data-i18n="%s">%s</span>' % (cle, m.group(groupe)), 1)
                balise = m.group(1)
                if "data-i18n=" in balise:
                    return m.group(0)
                return balise[:-1] + ' data-i18n="%s">' % cle + m.group(groupe) + m.group(3)
            out, n = motif.subn(repl, out)
            if n == 0 and requis:
                MANQUANTS.append("%s → %s" % (fichier, cle))
        if ecrire and out != src:
            open(chemin, "w", encoding="utf-8").write(out)
    if MANQUANTS:
        print("⚠ motifs non trouvés (%d) :" % len(MANQUANTS))
        for x in MANQUANTS:
            print("   -", x)
    print("Clés FR collectées :", len(FR))
    return not MANQUANTS


# ============================================================
# 1. COMMUN
# ============================================================
TOUTES = ["index.html", "expertise/index.html", "projets/index.html", "projets/fiche.html",
          "activite/index.html", "parcours/index.html", "articles/index.html",
          "boutique/index.html", "a-propos/index.html", "contact/index.html",
          "projets/mysterybot/index.html", "projets/scriboai-bot/index.html",
          "projets/smartreply-agent/index.html"]
r(TOUTES, r'(<a class="skip-link" href="#contenu">)([^<]+)(</a>)', "commun.skip")
r(TOUTES, r'(<h4>)(Navigation)(</h4>)', "commun.footer.nav")
r(TOUTES, r'(<h4>)(Me retrouver)(</h4>)', "commun.footer.find")
r(TOUTES, r'(<small>)(Portfolio personnel · DIGICRAFT Labs)(</small>)', "commun.footer.sub")
r(TOUTES, r'(<p>)(Je transforme les idées complexes en systèmes digitaux intelligents [^<]*)(</p>)',
  "commun.footer.tagline")
r(TOUTES, r'(<a href="(?:\.\./)*articles/">)(Articles)(</a>)', "commun.footer.articles")

# ============================================================
# 2. ACCUEIL
# ============================================================
A = "index.html"
r(A, r'(<p class="section-intro">)(.*?)(</p>)', "accueil.xp.intro")
r(A, r'(<h2>)(Ce que je construis)(</h2>)', "accueil.xp.titre")
r(A, r"(<p>)(De l'idée au prototype[^<]*)(</p>)", "accueil.xp.desc")
r(A, r'(>)(Voir toute l\'expertise)( <span class="arr")', "accueil.xp.btn", mode="span")
r(A, r'(<h2>)(Mes projets)(</h2>)', "accueil.projets.titre")
r(A, r"(<p>)(Une sélection de systèmes[^<]*)(</p>)", "accueil.projets.desc")
r(A, r'(>)(Tous mes projets)( <span class="arr")', "accueil.projets.btn", mode="span")
r(A, r"(<h2>)(Activité — journal d'ingénieur)(</h2>)", "accueil.actv.titre")
r(A, r'(<p>)(Ce que je construis, teste et apprends en ce moment[^<]*)(</p>)', "accueil.actv.desc")
r(A, r"(>)(Toute l'activité)( <span class=\"arr\")", "accueil.actv.btn", mode="span")
r(A, r'(<h2>)(Articles &amp; publications)(</h2>)', "accueil.art.titre")
r(A, r"(<p>)(Je partage mes expériences, méthodes et découvertes[^<]*)(</p>)", "accueil.art.desc")
r(A, r'(>)(Tous les articles)( <span class="arr")', "accueil.art.btn", mode="span")
r(A, r'(<h2>)(Mes ressources)(</h2>)', "accueil.ress.titre")
r(A, r"(<p>)(Des guides et produits digitaux[^<]*)(</p>)", "accueil.ress.desc")
r(A, r'(</svg>)([^<]+)(</p>)', "accueil.ress.note", groupe=2, mode="span")
r(A, r'(>)(Voir toute la boutique)( <span class="arr")', "accueil.ress.btn", mode="span")
r(A, r'(<h2>)(Parcours)(</h2>)', "accueil.parc.titre")
r(A, r"(<p>)(Formations, expériences et certifications[^<]*)(</p>)", "accueil.parc.desc")
r(A, r'(>)(Tout mon parcours)( <span class="arr")', "accueil.parc.btn", mode="span")
r(A, r'(<h2 class="reveal">)(Derrière les systèmes, il y a une personne\.)(</h2>)', "accueil.apropos.titre")
r(A, r"(<p class=\"reveal\">)(Je m'intéresse à l'intersection[^<]*)(</p>)", "accueil.apropos.p1")
r(A, r"(<p class=\"reveal\">)(DIGICRAFT Labs est l'espace[^<]*)(</p>)", "accueil.apropos.p2")
r(A, r'(>)(En savoir plus)( <span class="arr")', "accueil.apropos.btn", mode="span")
r(A, r'(>)(Voir mon profil LinkedIn)(</a>)', "accueil.apropos.linkedin")
r(A, r'(<h2>)(Vous avez une idée à automatiser \?)(</h2>)', "accueil.cta.titre")
r(A, r"(<p>)(Parlons de votre projet et voyons comment l'IA[^<]*)(</p>)", "accueil.cta.desc")
r(A, r'(>)(Me contacter)( <span class="arr")', "accueil.cta.btn1", mode="span")
r(A, r'(<a class="btn btn-ghost" href="projets/">)(Voir mes projets)(</a>)', "accueil.cta.btn2")
r(A, r'(<span class="about-photo-cap">)(Koffa Jean Agoudavi · Fondateur)(</span>)', "portrait.legende")

# ============================================================
# 3. PAGES INTÉRIEURES : eyebrow / h1 / lead / note
# ============================================================
def page(fichier, prefixe):
    r(fichier, r'(<p class="eyebrow[^"]*">)(.*?)(</p>)', prefixe + ".eyebrow")
    r(fichier, r'(<h1[^>]*>)(.*?)(</h1>)', prefixe + ".titre")
    r(fichier, r'(<p class="lead[^"]*">)(.*?)(</p>)', prefixe + ".lead")

page("expertise/index.html", "xp")
page("projets/index.html", "projets")
page("activite/index.html", "activite")
page("parcours/index.html", "parcours")
page("articles/index.html", "articles")
r("boutique/index.html", r'(<p class="eyebrow[^"]*">)(.*?)(</p>)', "boutique.eyebrow")
r("boutique/index.html", r'(<h1[^>]*>)(.*?)(</h1>)', "boutique.titre")
r("boutique/index.html", r'(<p class="lead[^"]*">)(.*?)( <span class="mono">)', "boutique.lead1", mode="span")
r("boutique/index.html", r'(<span class="mono">)([^<]+)(</span>)', "boutique.lead.type")
r("boutique/index.html", r'(</span>)([^<]+)(</p>)', "boutique.lead2", mode="span")
page("a-propos/index.html", "apropos")
page("contact/index.html", "contact")
r("boutique/index.html", r'(<p>)(Le paiement et la livraison[^<]*)(</p>)', "boutique.note")
r("a-propos/index.html", r'(<span class="about-photo-cap">)(Koffa Jean Agoudavi · Fondateur)(</span>)', "portrait.legende")
r("404.html", r'(<h1[^>]*>)(.*?)(</h1>)', "e404.titre")
r("404.html", r'(<p>)(.*?)(</p>)', "e404.desc")
r("404.html", r'(<a class="btn btn-gold" href="/">)(.*?)(</a>)', "e404.btn")


# ============================================================
# 4. À PROPOS — les 7 sections (contenu existant, traduit)
# ============================================================
AP = "a-propos/index.html"
for n, cle in [(1, "s1"), (2, "s2"), (3, "s3"), (4, "s4"), (5, "s5"), (6, "s6"), (7, "s7")]:
    r(AP, r'(<span class="ap-num">)(0%d — [^<]*)(</span>)' % n, "apropos.%s.num" % cle)
for n, motif, cle in [
    (1, r"Koffa Jean Agoudavi", "s1.titre"),
    (2, r"Un laboratoire, pas une agence", "s2.titre"),
    (3, r"Des systèmes qui tiennent leurs promesses", "s3.titre"),
    (4, r"L'outil au service du résultat", "s4.titre"),
    (5, r"Ma boîte à outils", "s5.titre"),
    (6, r"De l'expérimentation à la production", "s6.titre"),
    (7, r"Où je partage mon travail", "s7.titre"),
]:
    r(AP, r'(<h2>)(%s)(</h2>)' % motif, "apropos." + cle)
for motif, cle in [
    (r"Je m'intéresse à l'intersection[^<]*", "s1.p1"),
    (r"Je ne construis pas « pour montrer »[^<]*", "s1.p2"),
    (r"DIGICRAFT Labs est l'espace où cette démarche[^<]*", "s2.p1"),
    (r"Automatisations, agents IA, bots Telegram[^<]*", "s2.p2"),
    (r"Des assistants qui traitent les emails[^<]*", "s3.p1"),
    (r"Je ne cherche pas la technologie la plus impressionnante[^<]*", "s4.p1"),
    (r"Je publie régulièrement mes expériences[^<]*", "s7.p1"),
]:
    r(AP, r'(<p>)(%s)(</p>)' % motif, "apropos." + cle)
# méthode : 3 étapes
for n, nom, desc in [
    (1, "Comprendre", r"Identifier le problème réel[^<]*"),
    (2, "Prototyper", r"Assembler les briques[^<]*"),
    (3, "Prouver", r"Tester en conditions réelles[^<]*"),
]:
    r(AP, r'(<span class="m-num">%d</span>)(%s)(</b>)' % (n, nom), "apropos.methode%d.nom" % n, groupe=2, mode="span")
    r(AP, r'(<p>)(%s)(</p>)' % desc, "apropos.methode%d.desc" % n)
# phrase « simple / utile / évolutif » (contenu avec <strong>)
r(AP, r'(<p>)(Chaque système doit être : )(<strong>)', "apropos.s4.p2a")
r(AP, r'(<strong>)(simple)(</strong>)', "apropos.s4.p2b")
r(AP, r'(</strong>)( à comprendre, )(<strong>)', "apropos.s4.p2c", mode="span")
r(AP, r'(<strong>)(utile)(</strong>)', "apropos.s4.p2d")
r(AP, r'(</strong>)( au quotidien et )(<strong>)', "apropos.s4.p2e", mode="span")
r(AP, r'(<strong>)(évolutif)(</strong>)', "apropos.s4.p2f")
r(AP, r'(</strong>)( pour grandir avec le besoin\.)(</p>)', "apropos.s4.p2g", mode="span")
# technologies (12 étiquettes)
for i, tag in enumerate(["Make", "Groq", "Gemini", "LLM / IA", "Telegram Bots", "Google Sheets",
                         "Webhooks", "APIs", "OCR", "No-Code", "HTML / CSS / JS", "Cloudflare Pages"], 1):
    r(AP, r'(<li>)(%s)(</li>)' % tag.replace("/", r"\/"), "apropos.s5.tag%d" % i)
# repères de parcours
for an, nom, desc, cle in [
    ("2026", r"DIGICRAFT Labs", r"Fondation du laboratoire[^<]*", "r1"),
    ("2026", r"SmartReply Agent &amp; ScriboAI", r"Conception et mise en production[^<]*", "r2"),
    ("2025", r"Exploration IA &amp; automatisation", r"Apprentissage intensif[^<]*", "r3"),
]:
    r(AP, r'(<b>)(%s)(</b>)' % nom, "apropos.repere.%s.titre" % cle)
    r(AP, r'(</b><p>)(%s)(</p>)' % desc, "apropos.repere.%s.desc" % cle, mode="span")
# CTA
r(AP, r'(<h2>)(Envie de construire un système, vous aussi \?)(</h2>)', "apropos.cta.titre")
r(AP, r'(<p>)(Parlons de votre idée et voyons[^<]*)(</p>)', "apropos.cta.desc")
r(AP, r'(>)(Me contacter)( <span class="arr")', "apropos.cta.btn1", mode="span")
r(AP, r'(<a class="btn btn-ghost" href="\.\./projets/">)(Voir mes projets)(</a>)', "apropos.cta.btn2")
r(AP, r"(>)(Voir mon profil LinkedIn)( <span class=\"arr\")", "apropos.linkedin", mode="span")
r(AP, r"(>)(Voir ma chaîne YouTube)( <span class=\"arr\")", "apropos.youtube", mode="span")

# ============================================================
# 5. CONTACT — formulaire + canaux
# ============================================================
C = "contact/index.html"
r(C, r'(<h3 style="margin-bottom:1\.3rem">)([^<]+)(</h3>)', "contact.form.titre")
r(C, r'(<b>)(Message envoyé, merci !)(</b>)', "contact.form.ok.titre")
r(C, r'(<b[^>]*>Message envoyé, merci !</b><p>)([^<]+)(</p>)', "contact.form.ok.desc", mode="span")
r(C, r'(<b>)(Une erreur est survenue\.)(</b>)', "contact.form.err.titre")
r(C, r'(<b[^>]*>Une erreur est survenue\.</b><p>)([^<]+)( <a )', "contact.form.err.p1", mode="span")
r(C, r'(<label for="nom">)(Nom)(</label>)', "contact.form.nom")
r(C, r'(<label for="email">)(Email)(</label>)', "contact.form.email")
r(C, r'(<label for="sujet">)(Sujet)(</label>)', "contact.form.sujet")
r(C, r'(<label for="message">)(Message)(</label>)', "contact.form.message")
r(C, r'(<input id="nom"[^>]*?)(placeholder="Votre nom")([^>]*>)', "contact.ph.nom", mode="placeholder", groupe=2)
r(C, r'(<input id="email"[^>]*?)(placeholder="vous@exemple\.com")([^>]*>)', "contact.ph.email", mode="placeholder", groupe=2)
r(C, r'(<textarea id="message"[^>]*?)(placeholder="Décrivez votre besoin[^"]*")([^>]*>)', "contact.ph.message", mode="placeholder", groupe=2)
r(C, r'(<option value="" selected disabled>)([^<]+)(</option>)', "contact.opt.invite")
r(C, r'(<option value="Automatisation">)(Automatisation)(</option>)', "contact.opt.1")
r(C, r'(<option value="Intelligence artificielle">)(Intelligence artificielle)(</option>)', "contact.opt.2")
r(C, r'(<option value="Bot Telegram">)(Bot Telegram)(</option>)', "contact.opt.3")
r(C, r'(<option value="Produit digital">)(Produit digital)(</option>)', "contact.opt.4")
r(C, r'(<option value="Collaboration">)(Collaboration)(</option>)', "contact.opt.5")
r(C, r'(<option value="Autre">)(Autre)(</option>)', "contact.opt.6")
r(C, r'(<button class="btn btn-gold btn-block" type="submit">)([^<]+)(</button>)', "contact.form.envoyer")
r(C, r'(</svg>)([^<]+)(</p>)', "contact.form.note", mode="span")
r(C, r'(<h3 style="margin-bottom:1\.2rem">)([^<]+)(</h3>)', "contact.canaux.titre")
r(C, r'(<b>)(Email)(</b>)', "contact.canal.email.titre")
for cle, motif in [
    ("whatsapp", r"Chat direct — réponse rapide"),
    ("telegram", r"Réponse rapide — @johnnyokabe"),
    ("linkedin", r"Profil professionnel &amp; publications"),
    ("youtube", r"Chaîne — démos &amp; tutoriels"),
    ("google", r"Fiche établissement DIGICRAFT Labs"),
]:
    r(C, r'(<b>[^<]+</b><span>)(%s)(</span>)' % motif, "contact.canal.%s.desc" % cle, mode="span")

# ============================================================
# 6. TITRES DE PAGE + META DESCRIPTIONS
# ============================================================
for f, cle in [
    ("index.html", "doc.accueil"), ("expertise/index.html", "doc.xp"),
    ("projets/index.html", "doc.projets"), ("activite/index.html", "doc.activite"),
    ("parcours/index.html", "doc.parcours"), ("articles/index.html", "doc.articles"),
    ("boutique/index.html", "doc.boutique"), ("a-propos/index.html", "doc.apropos"),
    ("contact/index.html", "doc.contact"), ("404.html", "doc.e404"),
]:
    r(f, r'(<title>)([^<]+)(</title>)', cle + ".titre")
    if f != "404.html":
        r(f, r'(<meta name="description" content=")([^"]+)(">)', cle + ".desc", mode="meta")


# ============================================================
# 7. FICHES PROJETS (générique + 3 fiches statiques)
# ============================================================
FICHES = ["projets/fiche.html", "projets/mysterybot/index.html",
          "projets/scriboai-bot/index.html", "projets/smartreply-agent/index.html"]
r(FICHES, r'(href="\.\./index\.html">)(</a>)?()', "fiche.noop", mode="span") if False else None
# « Tous mes projets » (retour en haut de fiche, après le chevron SVG)
r(FICHES, r'(</svg>)([^<]+)(</a>)', "fiche.retour", mode="span", groupe=2)
# « Étude de cas » (eyebrow)
r(FICHES, r'(<p class="eyebrow[^"]*">)(Étude de cas)(</p>)', "fiche.eyebrow")
# numéros de section
r(FICHES, r'(<span class="cs-num">)(01 — Contexte)(</span>)', "fiche.s1.num")
r(FICHES, r'(<span class="cs-num">)(02 — La réponse)(</span>)', "fiche.s2.num")
r(FICHES, r'(<span class="cs-num">)(03 — Outillage)(</span>)', "fiche.s3.num")
r(FICHES, r'(<span class="cs-num">)(04 — État actuel)(</span>)', "fiche.s4.num", requis=False)
r("projets/smartreply-agent/index.html", r'(<span class="cs-num">)(04 — Versions)(</span>)', "fiche.ver.num")
r("projets/smartreply-agent/index.html", r'(<span class="cs-num">)(05 — État actuel)(</span>)', "fiche.s5.num")
# titres de section
r(FICHES, r'(<h2>)(Le problème)(</h2>)', "fiche.s1.titre")
r(FICHES, r'(<h2>)(La solution)(</h2>)', "fiche.s2.titre")
r(FICHES, r'(<h2>)(Technologies)(</h2>)', "fiche.s3.titre")
r(FICHES, r"(<h2>)(Résultat aujourd'hui)(</h2>)", "fiche.s4.titre")
r("projets/smartreply-agent/index.html", r'(<h2>)(Évolution du projet)(</h2>)', "fiche.ver.titre")
# CTA de bas de fiche
r(FICHES, r'(<h2>)(Un flux à automatiser, vous aussi \?)(</h2>)', "fiche.cta.titre")
r(FICHES, r"(<p>)(Parlons de votre processus et voyons comment l'IA peut le rendre[^<]*)(</p>)", "fiche.cta.desc")
r(FICHES, r'(>)(Me contacter)( <span class="arr")', "fiche.cta.btn1", mode="span")
r(FICHES, r'(<a class="btn btn-ghost" href="\.\./index\.html">)(Tous mes projets)(</a>)', "fiche.cta.btn2")
# bouton d'action de la fiche générique (texte remplacé ensuite par le Sheet)
r("projets/fiche.html", r'(<a class="btn btn-gold" data-cs-action href="#" target="_blank" rel="noopener" aria-label="Accéder au projet">)([^<]+)(</a>)',
  "fiche.action")

# ============================================================
# 8. FICHES STATIQUES — titres de page + descriptions meta
#    (le texte de fond est injecté par le CMS : seul le head est figé)
# ============================================================
STATIQUES = {
    "projets/mysterybot/index.html": "mysterybot",
    "projets/scriboai-bot/index.html": "scriboai",
    "projets/smartreply-agent/index.html": "smartreply",
}
for fichier, court in STATIQUES.items():
    r(fichier, r'(<title>)([^<]+)(</title>)', "doc.fiche.%s.titre" % court)
    r(fichier, r'(<meta name="description" content=")([^"]+)(">)', "doc.fiche.%s.desc" % court, mode="meta")

# Eyebrows de l'accueil + flèches du carrousel (textes non couverts par les
# règles génériques : ils n'ont ni <span> ni structure répétée).
r("index.html", r'(<p class="eyebrow">)(Expertise)(</p>)', "accueil.eyebrow.xp")
r("index.html", r'(<p class="eyebrow">)(Preuves concrètes)(</p>)', "accueil.eyebrow.projets")
r("index.html", r'(<p class="eyebrow">)(Coulisses)(</p>)', "accueil.eyebrow.actv")
r("index.html", r'(<p class="eyebrow">)(Publications)(</p>)', "accueil.eyebrow.art")
r("index.html", r'(<p class="eyebrow">)(Boutique)(</p>)', "accueil.eyebrow.ress")
r("index.html", r'(<p class="eyebrow">)(Profil)(</p>)', "accueil.eyebrow.parc")
r("index.html", r'(<p class="eyebrow reveal">)(À propos)(</p>)', "accueil.eyebrow.apropos")
r("index.html", r'(<button class="c-arrow" data-carousel-prev aria-label=")(Projets précédents)(")', "accueil.projets.prev", mode="aria")
r("index.html", r'(<button class="c-arrow" data-carousel-next aria-label=")(Projets suivants)(")', "accueil.projets.next", mode="aria")

# ============================================================
# 9. DERNIERS TEXTES STATIQUES (É10)
#    — fiches de projet : schéma de workflow + journal des versions
#    — accueil : encarts « faits » de la section À propos
#    — pages listes : filtres écrits en dur (repli sans JavaScript)
# ============================================================
SR = "projets/smartreply-agent/index.html"
r(SR, r'(<span class="wf-title">)([^<]+)(</span>)', "fiche.wf.titre")
r(SR, r'(<span class="dot"></span>)(En direct)(</span>)', "fiche.wf.direct", mode="span")
r(SR, r'(<span class="wf-sub" style="display:block">)(Nouveau message)(</span>)', "fiche.wf.gmail.sub")
r(SR, r'(<span class="wf-sub" style="display:block">)(Scénario automatisé)(</span>)', "fiche.wf.make.sub")
r(SR, r'(<span class="wf-sub" style="display:block">)(Analyse &amp; classification)(</span>)', "fiche.wf.groq.sub")
r(SR, r'(<span class="wf-sub" style="display:block">)(Données structurées)(</span>)', "fiche.wf.sheets.sub")
r(SR, r'(<span class="wf-sub" style="display:block">)(Validation &amp; notifications)(</span>)', "fiche.wf.telegram.sub")
r(SR, r'(De l\'idée au système fonctionnel\.)', "fiche.wf.pied", groupe=1, mode="span")
# NB : les descriptions passent AVANT les pastilles de statut. Le motif qui
# ancre sur <b>V1.0…</b> englobe la pastille : si elle est déjà marquée, le
# garde-fou « data-i18n déjà présent » annule silencieusement la règle.
r(SR, r'(<b>V1\.0[\s\S]*?<p>)([^<]+)(</p>)', "fiche.ver.v10.desc")
r(SR, r'(<b>V1\.5[\s\S]*?<p>)([^<]+)(</p>)', "fiche.ver.v15.desc")
r(SR, r'(<b>V2\.0[\s\S]*?<p>)([^<]+)(</p>)', "fiche.ver.v20.desc")
r(SR, r'(<span class="chip chip-gold">)(En production)(</span>)', "fiche.ver.statut.production")
r(SR, r'(<span class="chip">)(En pause)(</span>)', "fiche.ver.statut.pause")

# NB : les règles « valeur » passent AVANT les règles « libellé », sinon la
# pose de data-i18n sur le <b> casse le motif qui ancre sur <b>Fondateur</b>.
r("index.html", r'(<div class="fact"><b>Fondateur</b><span>)([^<]+)(</span>)', "accueil.facts.f1.v")
r("index.html", r'(<div class="fact"><b>)(Fondateur)(</b>)', "accueil.facts.f1.k")
r("index.html", r'(<div class="fact"><b>Focus</b><span>)([^<]+)(</span>)', "accueil.facts.f2.v")
r("index.html", r'(<div class="fact"><b>)(Focus)(</b>)', "accueil.facts.f2.k")
r("index.html", r'(<div class="fact"><b>Systèmes</b><span>)([^<]+)(</span>)', "accueil.facts.f3.v")
r("index.html", r'(<div class="fact"><b>)(Systèmes)(</b>)', "accueil.facts.f3.k")

r("articles/index.html", r'(<button class="f-btn is-active" data-filtre="Tous">)(Tous)(</button>)', "art.filtre.tous")
r("articles/index.html", r'(<button class="f-btn" data-filtre="Autres">)(Autres)(</button>)', "art.filtre.autres")
r("articles/index.html", r'(aria-label=")(Filtrer les articles)(")', "articles.filtre.ariane", mode="aria")
r("projets/index.html", r'(<button class="f-btn is-active" data-filtre="Tous" aria-pressed="true">)(Tous)(</button>)', "projets.filtre.tous")
r("projets/index.html", r'(aria-label=")(Filtrer les projets)(")', "projets.filtre.ariane", mode="aria")

if __name__ == "__main__":
    ok = appliquer(ecrire=("--dry" not in sys.argv))
    json.dump(FR, open(os.path.join(RACINE, "outils/_fr.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2, sort_keys=True)
    print("→ outils/_fr.json écrit")
    sys.exit(0 if ok else 1)
