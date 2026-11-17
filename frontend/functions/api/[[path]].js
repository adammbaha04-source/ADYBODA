const BACKEND = "https://adybajaj-api.onrender.com";
const UPSTREAM_TIMEOUT_MS = 45000; // Tumeongeza muda hapa

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 1. Test Cloudflare-to-Render connectivity
  if (url.pathname === "/api/_ping") {
    try {
      const upstream = await fetch(
        BACKEND + "/api/auth/token/",
        {
          method: "GET",
          headers: { Accept: "application/json" },
          redirect: "manual",
          signal: AbortSignal.timeout(20000),
        }
      );

      const reachable =
        upstream.status === 405 ||
        (upstream.status >= 200 && upstream.status < 500);

      return Response.json(
        {
          function: "ok",
          upstream: reachable ? "reachable" : "error",
          upstream_status: upstream.status,
        },
        { status: reachable ? 200 : 502 }
      );
    } catch (err) {
      const timedOut = err?.name === "TimeoutError";
      return Response.json(
        {
          function: "ok",
          upstream: "unreachable",
          error: String(err?.message || err),
          timed_out: timedOut,
        },
        { status: timedOut ? 504 : 502 }
      );
    }
  }

  // 2. Forward normal API requests to Render
  const target = BACKEND + url.pathname + url.search;
  const headers = new Headers(request.headers);
  headers.delete("host");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const bodyData = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: headers,
      body: bodyData,
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    return response;

  } catch (err) {
    const timedOut = err?.name === "TimeoutError";
    const message = String(err?.message || err);

    console.error("[Cloudflare Proxy Error]", {
      method: request.method,
      path: url.pathname,
      timedOut,
      message,
    });

    return Response.json(
      {
        detail: (timedOut ? "Upstream timeout: " : "Proxy error: ") + message,
      },
      { status: timedOut ? 504 : 502 }
    );
  }
}
