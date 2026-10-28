/* ============================================================
   CAROUSEL-DOTS.JS — Indicateurs de pagination unifiés (tirets)
   ------------------------------------------------------------
   Composant cloné du carrousel Expertise (js/expertise.js, PR#14)
   et mis à disposition de toutes les sections à défilement
   horizontal de l'accueil (harmonisation 2026-10-28) :
     - Projets à la une (#carousel-projets, cartes .p-card) ;
     - Articles (#carousel-articles, cartes .a-card).
   Décision utilisateur : carrousels seuls — les grilles statiques
   (/projets/, /articles/, /boutique/) ne défilent pas et restent
   sans indicateurs.

   Comportement (identique à l'Expertise) :
     - une zone .carousel-dots est créée dynamiquement SOUS le
       carrousel (sibling suivant) ;
     - un tiret .carousel-dot par carte ; l'état actif suit la
       carte la plus proche du scrollLeft (is-active + aria-current) ;
     - clic sur un tiret → défilement doux vers la carte
       (auto si prefers-reduced-motion) ;
     - flèches optionnelles : désactivées en butée (première /
       dernière carte), le défilement restant géré par main.js ;
     - moins de 2 cartes → zone masquée (rien à paginer) ;
     - ré-attachable après chaque re-rendu (CMS, kj:langue) : la
       zone est réutilisée, les listeners ne sont posés qu'une fois.

   Usage :
     window.Dots.attacher({
       conteneur: el,                   — élément scrollable
       items: ".p-card",                — sélecteur des slides
       cleAria: "accueil.projets.dot",  — clé i18n avec {n}
       secoursAria: "Aller au projet {n}",  — repli sans i18n.js
       prev / next                      — flèches (optionnelles)
     });
   ============================================================ */
(function () {
  "use strict";

  function T(cle, vars, secours) {
    if (window.I18n && typeof window.I18n.t === "function") {
      return window.I18n.t(cle, vars, secours);
    }
    return secours !== undefined ? secours : cle;
  }

  function cartes(cont, sel) {
    if (!cont || !cont.querySelectorAll) return [];
    return Array.prototype.slice.call(cont.querySelectorAll(sel));
  }

  function position(carte, premiere) {
    return premiere ? (carte.offsetLeft - premiere.offsetLeft) : 0;
  }

  /* Carte la plus proche du scroll courant (même algorithme que
     l'Expertise : écart minimal entre position et scrollLeft). */
  function indexCourant(cont, sel) {
    var liste = cartes(cont, sel);
    if (!liste.length) return 0;
    var objectif = cont.scrollLeft || 0;
    var meilleur = 0, ecartMin = Infinity;
    for (var i = 0; i < liste.length; i++) {
      var ecart = Math.abs(position(liste[i], liste[0]) - objectif);
      if (ecart < ecartMin) { ecartMin = ecart; meilleur = i; }
    }
    return meilleur;
  }

  function aller(cont, sel, index) {
    var liste = cartes(cont, sel);
    if (!liste.length || !cont.scrollTo) return;
    var i = Math.max(0, Math.min(index, liste.length - 1));
    var doux = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    cont.scrollTo({ left: position(liste[i], liste[0]), behavior: doux ? "smooth" : "auto" });
  }

  function construire(cont, etat, opts) {
    var zone = etat.zone;
    zone.innerHTML = "";
    var liste = cartes(cont, opts.items);
    /* 0 ou 1 carte : rien à paginer → zone vide et masquée */
    if (liste.length < 2) { zone.hidden = true; return; }
    zone.hidden = false;
    var actif = indexCourant(cont, opts.items);
    liste.forEach(function (carte, i) {
      var p = document.createElement("button");
      p.type = "button";
      p.className = "carousel-dot" + (i === actif ? " is-active" : "");
      if (i === actif) p.setAttribute("aria-current", "true");
      var secours = String(opts.secoursAria || "Aller à la carte {n}").replace("{n}", i + 1);
      p.setAttribute("aria-label", T(opts.cleAria, { n: i + 1 }, secours));
      p.addEventListener("click", function () { aller(cont, opts.items, i); });
      zone.appendChild(p);
    });
  }

  function majEtat(cont, etat, opts) {
    var liste = cartes(cont, opts.items);
    var i = indexCourant(cont, opts.items);
    Array.prototype.forEach.call(etat.zone.querySelectorAll(".carousel-dot"), function (p, k) {
      p.classList.toggle("is-active", k === i);
      if (k === i) p.setAttribute("aria-current", "true");
      else p.removeAttribute("aria-current");
    });
    /* Flèches en butée — le défilement reste piloté par main.js. */
    if (opts.prev) opts.prev.disabled = i <= 0;
    if (opts.next) opts.next.disabled = !!liste.length && i >= liste.length - 1;
  }

  function attacher(opts) {
    var cont = opts && opts.conteneur;
    if (!cont || !cont.querySelectorAll || !cont.parentElement) return null;
    var options = {
      conteneur: cont,
      items: opts.items || ".p-card, .r-card, .a-card",
      cleAria: opts.cleAria || "carousel.dot",
      secoursAria: opts.secoursAria,
      prev: opts.prev || null,
      next: opts.next || null
    };
    var etat = cont._carouselDots;
    if (!etat) {
      var zone = document.createElement("div");
      zone.className = "carousel-dots";
      cont.parentElement.insertBefore(zone, cont.nextSibling);
      etat = cont._carouselDots = { zone: zone, frame: 0 };
      var planifier = function () {
        if (etat.frame) return;
        var raf = window.requestAnimationFrame || function (f) { f(); };
        etat.frame = raf(function () { etat.frame = 0; majEtat(cont, etat, options); });
      };
      cont.addEventListener("scroll", planifier, { passive: true });
      window.addEventListener("resize", planifier, { passive: true });
    }
    construire(cont, etat, options);
    majEtat(cont, etat, options);
    return {
      rafraichir: function () {
        construire(cont, etat, options);
        majEtat(cont, etat, options);
      }
    };
  }

  window.Dots = { attacher: attacher };
})();
