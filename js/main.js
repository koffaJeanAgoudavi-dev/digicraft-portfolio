/* ============================================================
   MAIN.JS — Comportement global
   Header sticky · menu mobile plein écran · injection des
   Parametres (Google Sheets) · carousel · formulaire de contact
   ============================================================ */
(function () {
  "use strict";

  /* Libellés d'interface traduits (js/i18n.js) — repli sur le texte fourni. */
  function T(cle, vars, secours) {
    if (window.I18n && window.I18n.t) return window.I18n.t(cle, vars);
    return secours !== undefined ? secours : cle;
  }

  /* Adresse de secours affichée en cas d'échec du webhook (CMS d'abord). */
  function emailSecours() {
    return (window.PARAMS && window.PARAMS.email_contact) || "contact.agoudavi@gmail.com";
  }

  function qs(s, c) { return (c || document).querySelector(s); }
  function qsa(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  /* ---------- Carousel : flèches desktop ---------- */
  function initCarousel() {
    qsa(".carousel").forEach(function (track) {
      var prev = qs("[data-carousel-prev]", track.closest(".carousel-wrap"));
      var next = qs("[data-carousel-next]", track.closest(".carousel-wrap"));
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      /* Fondu lié au scroll : la carte la plus proche du centre du viewport
         reste pleine, les cartes qui sortent s'effacent doucement. Le calcul
         reste délégué au track pour fonctionner avec les cartes injectées
         plus tard depuis Google Sheets. */
      if (!reduce) {
        var fadeFrame = 0;
        var updateFade = function () {
          fadeFrame = 0;
          var trackBox = track.getBoundingClientRect();
          var center = trackBox.left + trackBox.width / 2;
          qsa(".p-card, .r-card, .a-card, .skel", track).forEach(function (card) {
            var box = card.getBoundingClientRect();
            var distance = Math.abs((box.left + box.width / 2) - center);
            var intensity = Math.min(distance / Math.max(trackBox.width * .62, 1), 1);
            card.style.opacity = (1 - intensity * .72).toFixed(3);
          });
        };
        var scheduleFade = function () {
          if (!fadeFrame) fadeFrame = window.requestAnimationFrame(updateFade);
        };
        track.addEventListener("scroll", scheduleFade, { passive: true });
        window.addEventListener("resize", scheduleFade, { passive: true });
        scheduleFade();
      }

      if (!prev || !next) return;
      var step = function (dir) {
        var w = track.clientWidth;
        var target = track.scrollLeft + dir * Math.max(w * 0.86, 320);
        track.scrollTo({ left: target, behavior: "smooth" });
      };
      prev.addEventListener("click", function () { step(-1); });
      next.addEventListener("click", function () { step(1); });
    });
  }

  /* ---------- Injection des Parametres (Sheets ou local) ---------- */
  /* Normalisation d'URL : protocole manquant → https:// ; les chemins
     racine (/projets/, #ancre, mailto:) sont conservés tels quels (v2,
     nécessaire pour hero_cta_url administrable dans le CMS). */
  function normUrl(u) {
    if (!u) return u;
    if (/^(https?:|mailto:|tel:|\/|#)/i.test(u)) return u;
    return "https://" + u;
  }

  /* Valeur CMS : clé v2 d'abord (+ variante _en si langue = anglais et
     valeur non vide), puis ancien nommage, sinon chaîne vide (le HTML ou
     les defaults de config.js font office de secours). */
  function valeur(P, base, alias) {
    var en = window.I18n && window.I18n.langue() === "en";
    if (en && P[base + "_en"]) return P[base + "_en"];
    if (en && alias && P[alias + "_en"]) return P[alias + "_en"];
    if (P[base]) return P[base];
    if (alias && P[alias]) return P[alias];
    return "";
  }

  /* Page d'accueil ? (la meta description n'est mise à jour que là) */
  function estAccueil() {
    var p = window.location.pathname;
    return p === "/" || p === "/index.html";
  }

  function initParametres() {
    window.Sheets.loadSheet("parametres").then(function (rows) {
      var P = window.Sheets.paramsToObject(rows);
      /* Valeurs BRUTES du Sheet : permet de distinguer « clé absente »
         (on garde le lien écrit dans le HTML) de « clé présente mais
         vide » (le propriétaire du CMS a voulu retirer l'élément → on le
         masque proprement plutôt que d'afficher un lien mort). */
      var BRUT = {};
      rows.forEach(function (r) {
        var k = String(r.cle || "").trim();
        if (k) BRUT[k] = String(r.valeur == null ? "" : r.valeur).trim();
      });
      window.PARAMS_BRUT = BRUT;

      /* Textes — clés v2 (CMS v0.2) avec repli sur l'ancien nommage */
      var textMap = {
        "[data-p-nom]": valeur(P, "hero_titre", "nom_complet"),
        "[data-p-titre]": valeur(P, "hero_role", "titre_professionnel"),
        "[data-p-slogan]": valeur(P, "hero_accroche", "slogan_hero"),
        "[data-p-desc-hero]": valeur(P, "hero_promesse", "description_hero"),
        "[data-p-statut]": valeur(P, "statut_disponibilite", ""),
        "[data-p-marque]": valeur(P, "marque_lab", ""),
        "[data-p-cta-label]": valeur(P, "hero_cta_label", ""),
        "[data-p-stat1]": valeur(P, "stat_projets_count", ""),
        "[data-p-stat2]": valeur(P, "stat_workflows_count", ""),
        "[data-p-stat3]": valeur(P, "stat_certifs_count", "")
      };
      Object.keys(textMap).forEach(function (sel) {
        qsa(sel).forEach(function (el) {
          if (textMap[sel]) el.textContent = textMap[sel];
        });
      });

      /* Chiffres clés : une valeur absente masque sa tuile (jamais de
         chiffre inventé ni de place vide). */
      qsa(".figures .figure").forEach(function (fig) {
        var b = fig.querySelector("[data-p-stat1],[data-p-stat2],[data-p-stat3]");
        fig.hidden = !(b && (b.textContent || "").trim());
      });

      /* Photo du hero : URL administrable ; si l'ancien visuel est encore
         présent dans le Sheet, on bascule vers le nouveau visuel local.
         Toute nouvelle URL renseignée dans le CMS reste prioritaire. */
      var photo = valeur(P, "photo_hero_url", "");
      qsa("[data-p-photo]").forEach(function (img) {
        var secours = img.getAttribute("data-photo-fallback");
        var legacy = img.getAttribute("data-photo-legacy-url");
        if (photo && legacy && photo === legacy && secours) photo = secours;
        if (!photo) return;
        img.addEventListener("error", function () {
          if (secours && img.getAttribute("src") !== secours) img.setAttribute("src", secours);
        });
        img.setAttribute("src", photo);
      });

      /* CTA du hero : libellé + destination administrables ; un libellé
         vide masque le bouton plutôt que d'afficher un bouton muet. */
      var ctaUrl = valeur(P, "hero_cta_url", "");
      qsa("[data-p-cta]").forEach(function (a) {
        if (ctaUrl) a.setAttribute("href", normUrl(ctaUrl));
        var lab = a.querySelector("[data-p-cta-label]");
        if (lab && !(lab.textContent || "").trim()) a.hidden = true;
      });

      /* Liens (normalisation : ajoute https:// si le protocole manque) */
      var linkMap = {
        "[data-p-linkedin]": normUrl(P.url_linkedin),
        "[data-p-telegram]": normUrl(P.url_telegram),
        "[data-p-google]": normUrl(P.url_google_business),
        "[data-p-boutique]": normUrl(P.url_boutique),
        "[data-p-youtube]": normUrl(P.url_youtube),
        "[data-p-whatsapp]": normUrl(P.url_whatsapp)
      };
      Object.keys(linkMap).forEach(function (sel) {
        qsa(sel).forEach(function (el) {
          if (linkMap[sel]) el.setAttribute("href", linkMap[sel]);
        });
      });

      /* Canaux de contact (Etape 9) : chaque carte porte data-canal.
         - clé absente du Sheet  → on conserve le lien du HTML (repli) ;
         - clé présente et vide  → la carte est masquée (choix explicite
           de retrait côté CMS, aucun lien mort, aucun texte vide). */
      var CANAUX = {
        email: "email_contact",
        linkedin: "url_linkedin",
        telegram: "url_telegram",
        whatsapp: "url_whatsapp",
        youtube: "url_youtube",
        google: "url_google_business"
      };
      qsa("[data-canal]").forEach(function (el) {
        var cle = CANAUX[el.getAttribute("data-canal")];
        if (!cle) return;
        var vientDuSheet = Object.prototype.hasOwnProperty.call(BRUT, cle);
        if (vientDuSheet && !BRUT[cle]) el.hidden = true;
        else el.hidden = false;
      });

      /* Email : liens mailto + valeur */
      qsa("[data-p-email]").forEach(function (el) {
        if (P.email_contact) el.setAttribute("href", "mailto:" + P.email_contact);
      });
      qsa("[data-p-email-txt]").forEach(function (el) {
        if (P.email_contact) el.textContent = P.email_contact;
      });

      /* Meta description : uniquement sur la page d'accueil (v2).
         Les pages internes gardent leur description propre, et la fiche
         projet générique V1.3 (data-cs-dynamic) garde la sienne. */
      var meta = qs('meta[name="description"]');
      var desc = textMap["[data-p-desc-hero]"] || "";
      if (meta && desc && estAccueil() && !qs("[data-cs-dynamic]")) {
        meta.setAttribute("content", desc.replace(/\s+/g, " ").trim());
      }

      window.PARAMS = P;
    }).catch(function () {
      console.warn("Parametres indisponibles — valeurs par défaut utilisées.");
    });
  }

  /* ---------- Formulaire de contact : Make → Telegram ---------- */
  /* V2 : la soumission envoie une notification Telegram via le webhook
     Make. L'URL est lue depuis le Google Sheet (onglet Parametres →
     clé `url_webhook_contact`) pour pouvoir la changer (ex. nouveau
     compte Make) sans toucher au code. En secours, la valeur locale
     de config.js est utilisée. Si aucune URL n'est disponible, le
     formulaire affiche l'erreur avec l'email de secours au lieu
     d'échouer silencieusement. */

  function initContact() {
    var form = qs("[data-contact-form]");
    if (!form) return;
    var btn = qs("[type=submit]", form);
    var okBox = qs("[data-form-ok]");
    var errBox = qs("[data-form-error]");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (errBox) errBox.classList.remove("is-visible");

      var nom = qs("#nom", form).value.trim();
      var email = qs("#email", form).value.trim();
      var sujet = qs("#sujet", form).value.trim();
      var message = qs("#message", form).value.trim();

      /* Validation 1 : aucun champ vide */
      if (!nom || !email || !sujet || !message) {
        var premierVide = [nom, email, sujet, message].findIndex(function (v) { return !v; });
        var champ = qsa(".field", form)[premierVide];
        if (champ) champ.querySelector("input,textarea,select").focus();
        return;
      }
      /* Validation 2 : format email basique */
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        qs("#email", form).focus();
        if (errBox) {
          errBox.querySelector("b").textContent = T("contact.form.err.email.titre", null, "Adresse email invalide.");
          errBox.querySelector("p").textContent = T("contact.form.err.email.desc", null, "Vérifiez le format, par exemple : vous@exemple.com");
          errBox.classList.add("is-visible");
        }
        return;
      }

      /* URL du webhook : Sheet d'abord (url_webhook_contact), sinon la
         valeur locale de secours (config.js defaults). Aucune URL
         disponible (Sheet injoignable + pas de fallback) → erreur
         explicite avec l'email de secours, jamais d'échec silencieux. */
      var webhook = (window.PARAMS && window.PARAMS.url_webhook_contact) ||
                    (window.CONFIG && window.CONFIG.defaults && window.CONFIG.defaults.url_webhook_contact);
      if (!webhook) {
        if (errBox) {
          errBox.querySelector("b").textContent = T("contact.form.err.indispo", null, "Envoi momentanément indisponible.");
          errBox.querySelector("p").textContent = T("contact.form.err.ecrire", { email: emailSecours() });
          errBox.classList.add("is-visible");
        }
        return;
      }

      /* Envoi JSON vers le webhook Make ; abandon après 15 s pour ne
         jamais laisser le visiteur sans réponse (scénario coupé…). */
      btn.disabled = true;
      btn.textContent = T("contact.form.envoi.cours", null, "Envoi en cours…");
      var abort = "AbortController" in window ? new AbortController() : null;
      var timer = abort ? setTimeout(function () { abort.abort(); }, 15000) : null;

      fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nom, email: email, sujet: sujet, message: message }),
        signal: abort ? abort.signal : undefined
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        if (timer) clearTimeout(timer);
        form.style.display = "none";
        if (okBox) okBox.classList.add("is-visible");
        if (window.Track) window.Track.event("contact_envoye", { statut: "succes", sujet: sujet });
      }).catch(function () {
        if (timer) clearTimeout(timer);
        btn.disabled = false;
        btn.textContent = T("contact.form.envoyer", null, "Envoyer le message");
        if (errBox) {
          errBox.querySelector("b").textContent = T("contact.form.err.titre", null, "Une erreur est survenue.");
          errBox.querySelector("p").textContent = T("contact.form.err.ecrire", { email: emailSecours() });
          errBox.classList.add("is-visible");
        }
        if (window.Track) window.Track.event("contact_envoye", { statut: "erreur" });
      });
    });
  }

  /* ---------- Révélation des blocs `.reveal` (toutes les pages) ----------
     L'observateur global vit dans js/projects.js, absent de plusieurs
     pages (activite/, expertise/…). Sans repli, les blocs `.reveal`
     statiques de ces pages restaient en opacité 0. Ici : on délègue si
     l'observateur global existe (les pages concernées l'initialisent dans
     leur script inline), sinon on en crée un localement. */
  function initRevealGlobal() {
    if (window.Prjs && window.Prjs.initReveal) return;   /* déjà géré par la page */
    var els = qsa(".reveal:not(.is-visible)");
    if (!els.length) return;
    /* typeof (et non "in window") : certains environnements définissent la
       propriété à undefined — la garde doit rester fiable. */
    if (typeof window.IntersectionObserver !== "function") {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); obs.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });
    els.forEach(function (el) { obs.observe(el); });
    window.revealObserver = obs;
  }

  /* ---------- Divers ---------- */
  function initMisc() {
    /* Année du copyright */
    qsa("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
    /* Mise en évidence du lien actif du header */
    var norm = function (u) { return String(u || "").replace(/\.html$/, "").replace(/\/+$/, ""); };
    var here = window.location.pathname;
    if (here.charAt(here.length - 1) === "/") here += "index.html";
    qsa(".dock-nav a").forEach(function (a) {
      var href = new URL(a.getAttribute("href") || "", window.location.href).pathname;
      if (norm(href) === norm(here)) a.setAttribute("aria-current", "page");
    });
  }

  /* ---------- Micro-interactions : présence visuelle sans surcharge ---------- */
  function initInteractiveLayer() {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var finePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;

    /* Barre de progression : un repère discret qui donne de la profondeur à la page. */
    if (!document.querySelector(".scroll-progress")) {
      var progress = document.createElement("div");
      progress.className = "scroll-progress";
      progress.setAttribute("aria-hidden", "true");
      document.body.appendChild(progress);
      var updateProgress = function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
      };
      window.addEventListener("scroll", updateProgress, { passive: true });
      window.addEventListener("resize", updateProgress, { passive: true });
      updateProgress();
    }

    if (reduce) return;

    document.body.classList.add("motion-ready");
    qsa(".section-head.reveal, .about-body .reveal, .cta-box.reveal").forEach(function (el, i) {
      el.style.setProperty("--d", Math.min(i * 70, 280) + "ms");
    });

    if (!finePointer) return;

    /* Spotlight très léger sur desktop : il suit le regard sans déplacer le contenu. */
    var spotlight = document.createElement("div");
    spotlight.className = "cursor-spotlight";
    spotlight.setAttribute("aria-hidden", "true");
    document.body.appendChild(spotlight);
    window.addEventListener("pointermove", function (e) {
      document.documentElement.style.setProperty("--pointer-x", e.clientX + "px");
      document.documentElement.style.setProperty("--pointer-y", e.clientY + "px");
      spotlight.style.opacity = "1";
    }, { passive: true });
    window.addEventListener("pointerleave", function () { spotlight.style.opacity = "0"; });

    /* Inclinaison imperceptible des cartes : délégation pour couvrir les
       cartes injectées après le chargement par le Google Sheet. */
    document.addEventListener("pointermove", function (e) {
      var card = e.target.closest ? e.target.closest(".card-hover, .hero-photo") : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - .5;
      var y = (e.clientY - r.top) / r.height - .5;
      card.style.setProperty("--rx", (-y * 2.2).toFixed(2) + "deg");
      card.style.setProperty("--ry", (x * 2.2).toFixed(2) + "deg");
      card.classList.add("is-tilting");
    }, { passive: true });
    document.addEventListener("pointerout", function (e) {
      var card = e.target.closest ? e.target.closest(".card-hover, .hero-photo") : null;
      if (card && (!e.relatedTarget || !card.contains(e.relatedTarget))) card.classList.remove("is-tilting");
    }, { passive: true });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initCarousel();
    initParametres();
    initContact();
    initRevealGlobal();
    initMisc();
    initInteractiveLayer();

    /* Changement de langue (js/i18n.js) : ré-injection des textes CMS
       avec les variantes `_en` (repli FR si la variante est vide).
       Les modules de contenu (projets, articles…) suivront à l'étape 10. */
    document.addEventListener("kj:langue", function () {
      initParametres();
    });
  });
})();
