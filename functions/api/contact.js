const MAX = {
  nom: 120,
  email: 254,
  sujet: 160,
  message: 5000
};
const MIN_DELAY_MS = 2500;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export async function onRequestPost(context) {
  const request = context.request;
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("Origin");

  if (!origin || origin !== requestUrl.origin) {
    return json({ ok: false, error: "origin" }, 403);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ ok: false, error: "content_type" }, 415);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ ok: false, error: "json" }, 400);
  }

  const nom = clean(body.nom);
  const email = clean(body.email);
  const sujet = clean(body.sujet);
  const message = clean(body.message);
  const website = clean(body.website);
  const startedAt = Number(body.form_started_at);

  // Champ invisible rempli par les robots : répondre sans relayer vers Make.
  if (website) return json({ ok: false, error: "spam" }, 400);

  const lengthsOk = nom.length > 0 && nom.length <= MAX.nom &&
    email.length > 0 && email.length <= MAX.email &&
    sujet.length > 0 && sujet.length <= MAX.sujet &&
    message.length > 0 && message.length <= MAX.message;
  if (!lengthsOk || !validEmail(email)) {
    return json({ ok: false, error: "validation" }, 422);
  }

  const now = Date.now();
  if (!Number.isFinite(startedAt) || now - startedAt < MIN_DELAY_MS || now - startedAt > MAX_AGE_MS) {
    return json({ ok: false, error: "timing" }, 400);
  }

  const webhook = context.env.MAKE_CONTACT_WEBHOOK;
  if (!webhook) {
    console.error("[contact] MAKE_CONTACT_WEBHOOK est absent");
    return json({ ok: false, error: "configuration" }, 503);
  }

  try {
    const upstream = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ nom, email, sujet, message })
    });

    if (!upstream.ok) {
      console.error("[contact] Make a répondu HTTP " + upstream.status);
      return json({ ok: false, error: "upstream" }, 502);
    }
  } catch (error) {
    console.error("[contact] Échec de relais Make", error);
    return json({ ok: false, error: "upstream" }, 502);
  }

  return json({ ok: true }, 200);
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, error: "method" }, 405);
}
