/* ============================================================
   CONFIGURATION CENTRALE — DIGICRAFT LABS
   ------------------------------------------------------------
   1) sheetId : ID du Google Sheet publié (voir README).
      Laissez "" tant que le Sheet n'est pas prêt : le site
      utilise alors les données locales (js/data/*.json).
      Une fois le Sheet publié, copiez son ID ici, ex :
      sheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz123456789",
   ============================================================ */
window.CONFIG = {
  sheetId: "1en1Bn2xMaax8EXPEZTHYmF9T-DY2XY-n",

  // Option : forcer le mode fallback local même si sheetId est défini
  forceLocal: false,

  // GID des onglets du classeur Portfolio_CMS_DIGICRAFT
  // COMMENT TROUVER UN GID : ouvrez le classeur → cliquez sur l'onglet
  // (Parametres, Projets, Articles, Ressources, Outils) → l'URL de votre navigateur
  // affiche ...#gid=XXXXXXX → copiez ce nombre ici.
  // Les GID publiés peuvent changer après une nouvelle publication : mettez à jour cette table, puis les URLs ci-dessous.
  sheetGids: {
    parametres: 2043920918,    // onglet Parametres
    projets: 992675999,      // onglet Projets
    articles: 353173161,     // onglet Articles
    ressources: 775775749,  // onglet Ressources
    timeline: 1732881613,      // onglet Timeline (journal d'activité)
    expertise: 686585981,    // onglet Expertise
    parcours: 1357681272,      // onglet Parcours (ex-Certifications)
    temoignages: 1989663815,  // onglet Témoignages
    outils: ""                // onglet Outils — renseigner le GID après publication
  },

  // URLs officielles de publication (Fichier → Publier sur le web → CSV).
  // Utilisées en priorité — plus fiables que l'export généré.
  sheetUrls: {
    parametres: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKUCRKKu2iTMXxxUT5Jx4Pgiypm1c18HcOcBCv7xKs95lP5BAi0ysDZL0RDdSDA/pub?gid=2043920918&single=true&output=csv",
    projets: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKUCRKKu2iTMXxxUT5Jx4Pgiypm1c18HcOcBCv7xKs95lP5BAi0ysDZL0RDdSDA/pub?gid=992675999&single=true&output=csv",
    articles: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKUCRKKu2iTMXxxUT5Jx4Pgiypm1c18HcOcBCv7xKs95lP5BAi0ysDZL0RDdSDA/pub?gid=353173161&single=true&output=csv",
    ressources: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKUCRKKu2iTMXxxUT5Jx4Pgiypm1c18HcOcBCv7xKs95lP5BAi0ysDZL0RDdSDA/pub?gid=775775749&single=true&output=csv",
    timeline: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKUCRKKu2iTMXxxUT5Jx4Pgiypm1c18HcOcBCv7xKs95lP5BAi0ysDZL0RDdSDA/pub?gid=1732881613&single=true&output=csv",
    expertise: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKUCRKKu2iTMXxxUT5Jx4Pgiypm1c18HcOcBCv7xKs95lP5BAi0ysDZL0RDdSDA/pub?gid=686585981&single=true&output=csv",
    parcours: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKUCRKKu2iTMXxxUT5Jx4Pgiypm1c18HcOcBCv7xKs95lP5BAi0ysDZL0RDdSDA/pub?gid=1357681272&single=true&output=csv",
    temoignages: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTBKUCRKKu2iTMXxxUT5Jx4Pgiypm1c18HcOcBCv7xKs95lP5BAi0ysDZL0RDdSDA/pub?gid=1989663815&single=true&output=csv",
    outils: ""
  },

  // Colonnes attendues par onglet — utilisées pour détecter un changement
  // d'en-tête dans le Sheet (erreur console explicite au lieu d'un échec
  // silencieux). Les modules lisent aussi ces colonnes de façon tolérante
  // (insensible à la casse / espaces, alias acceptés).
  colonnesAttendues: {
    parametres: ["cle", "valeur"],
    projets: ["titre", "slug", "categorie", "badge_statut", "description_courte", "image_url", "stack_tags", "statut", "date", "type_lien", "url_destination", "featured", "ordre", "probleme", "solution", "technologies_detail", "resultat"],
    articles: ["titre", "plateforme", "description", "temps_lecture", "url", "date", "featured", "ordre", "titre_en", "description_en"],
    ressources: ["type", "nom_produit", "description", "prix", "devise", "url_boutique", "badge", "featured", "ordre", "nom_produit_en", "description_en"],
    timeline: ["id", "titre", "description", "image_url", "statut", "date", "lien_optionnel", "featured", "ordre"],
    expertise: ["titre", "description_courte", "description_longue", "icone", "categorie", "exemples_projets", "ordre"],
    parcours: ["type", "titre", "organisation", "date_obtention", "date_fin", "description", "verification_url", "ordre"],
    temoignages: ["id", "nom", "role", "entreprise", "texte", "texte_en", "source_url", "featured", "ordre"],
    outils: ["id", "nom", "logo", "categorie", "categorie_en", "featured", "ordre"]
  },

  // Données par défaut (utilisées seulement si le Sheet ET le JSON local
  // sont injoignables). v2 : les clés hero_* du CMS v0.2 ont la priorité ;
  defaults: {
    /* --- Identité / Hero (blueprint v0.2 §4 et §7) --- */
    hero_titre: "Koffa Jean AGOUDAVI",
    hero_role: "Automatisation IA pour indépendants et petites équipes",
    hero_accroche: "DES SYSTEMES INTELLIGENTS  · VOTRE MEILLEUR ATOUT",
    hero_promesse: "Je crée des automatisations, des agents IA et des outils sur mesure qui trient vos messages, préparent vos réponses et relancent vos clients. Vous retrouvez du temps pour votre activité.",
    marque_lab: "DIGICRAFT Labs",
    photo_hero_url: "",           // vide → photo locale assets/images/koffa-agoudavi.jpg
    hero_cta_label: "Voir mes réalisations",
    hero_role_en: "AI Automation for Freelancers and Small Teams",
    hero_accroche_en: "INTELLIGENT SYSTEMS · YOUR GREATEST ASSET",
    hero_promesse_en: "I build custom automations, AI agents, and tools that sort through your messages, prepare your replies, and follow up with your clients—so you have more time for your business.",
    hero_cta_label_en: "View My Work",
    hero_cta_url: "/projets/",
    stat_projets_count: "",       // vide → la tuile correspondante est masquée
    stat_workflows_count: "",
    stat_certifs_count: "",
    google_note: "",
    google_nb_avis: "",
    langue_defaut: "fr",
    email_contact: "contact.agoudavi@gmail.com",
    url_linkedin: "https://www.linkedin.com/in/koffa-jean-agoudavi-514895423",
    url_telegram: "https://t.me/johnnyokabe",
    url_google_business: "https://share.google/ont9TyuWshpud74fL",
    url_boutique: "https://digicraft.mychariow.shop",
    statut_disponibilite: "Disponible pour de nouveaux projets"
  },

  // Domaine du site — À REMPLACER par votre domaine final
  siteUrl: "https://digicraft-labs-drf.pages.dev",

  // Nombre maximum de produits "featured" sur l'accueil
  featuredRessourcesLimit: 3,
  // Nombre maximum d'articles affichés sur l'accueil
  homeArticlesLimit: 3,
  // Nombre maximum d'expérimentations featured sur l'accueil
  featuredBuildLimit: 4,

  // Suivi analytics : IDs GA4 (G-XXXXXXXXXX) et Microsoft Clarity.
  // Peuvent aussi être définis dans le Sheet Parametres (clés
  // `ga4_id` / `clarity_id`) — le Sheet a la priorité. Laisser vide
  // tant que l'analytics n'est pas configurée (aucun script chargé).
  tracking: {
    ga4: "G-LH9R3H5XYX",
    clarity: "yaxx6uxxws"
  }
};
