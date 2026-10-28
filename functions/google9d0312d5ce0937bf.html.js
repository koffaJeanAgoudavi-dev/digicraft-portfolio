/* Google Search Console — validation de propriété (méthode fichier).
   Cette route dédiée évite la redirection Clean URLs de Cloudflare Pages
   qui transforme automatiquement les fichiers .html en URLs sans extension.
   Contenu identique au fichier statique google9d0312d5ce0937bf.html
   (53 octets, sans fin de ligne). */
export async function onRequest() {
  return new Response("google-site-verification: google9d0312d5ce0937bf.html", {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
