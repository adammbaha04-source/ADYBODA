const BACKEND = "https://adybajaj-api.onrender.com";
const UPSTREAM_TIMEOUT_MS = 45000;

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (url.pathname === "/api/_ping") {
    try {
      const upstream = await fetch(BACKEND + "/api/health/", { method: "GET" });
      return Response.json({ upstream_status: upstream.status });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 502 });
    }
  }

  const target = BACKEND + url.pathname + url.search;
  const headers = new Headers(request.headers);
  headers.delete("host");

  // Usisome body kama ni OPTIONS (CORS preflight)
  const hasBody = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  const bodyData = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const response = await fetch(target, {
      method: request.method,
      headers: headers,
      body: bodyData,
      redirect: "manual",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    const isAborted = err?.name === "AbortError";
    return Response.json(
      { detail: (isAborted ? "Upstream timeout" : "Proxy error") + ": " + String(err?.message || err) },
      { status: isAborted ? 504 : 502 }
    );
  }
}
