const BACKEND = "https://adybajaj-api.onrender.com";
const UPSTREAM_TIMEOUT_MS = 25000;

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (url.pathname === "/api/_ping") {
    return new Response(JSON.stringify({ function: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const target = BACKEND + url.pathname + url.search;
  const headers = new Headers(request.headers);
  headers.delete("host");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const isSafe = !hasBody;

  try {
    return await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
      // Timeout for GET only. Aborting a POST can leave a payment saved on Render
      // while the app shows an error, so POST requests are not cut off here.
      signal: isSafe ? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) : undefined,
    });
  } catch (err) {
    const timedOut = err && err.name === "TimeoutError";
    const message = String(err && err.message ? err.message : err);
    console.error("[proxy]", { method: request.method, path: url.pathname, timedOut, message });
    return new Response(
      JSON.stringify({
        detail: (timedOut ? "Upstream timeout: " : "Proxy error: ") + message,
        target,
      }),
      {
        status: timedOut ? 504 : 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
