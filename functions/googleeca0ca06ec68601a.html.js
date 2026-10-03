/* Google Search Console — validation de propriété.
   Cette route dédiée évite la redirection Clean URLs de Cloudflare Pages
   qui transforme automatiquement les fichiers .html en URLs sans extension. */
export async function onRequest() {
  return new Response("google-site-verification: googleeca0ca06ec68601a.html\n", {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
