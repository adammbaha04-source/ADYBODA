
const BACKEND = "https://adybajaj-api.onrender.com";
const UPSTREAM_TIMEOUT_MS = 25000;

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Test Cloudflare-to-Render connectivity
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

  // Forward normal API requests to Render
  const target = BACKEND + url.pathname + url.search;
  const headers = new Headers(request.headers);
  headers.delete("host");

  const hasBody =
    request.method !== "GET" &&
    request.method !== "HEAD";

  try {
    return await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
      signal: !hasBody
        ? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
        : undefined,
    });
  } catch (err) {
    const timedOut = err?.name === "TimeoutError";
    const message = String(err?.message || err);

    console.error("[proxy]", {
      method: request.method,
      path: url.pathname,
      timedOut,
      message,
    });

    return Response.json(
      {
        detail:
          (timedOut ? "Upstream timeout: " : "Proxy error: ") +
          message,
      },
      { status: timedOut ? 504 : 502 }
    );
  }
}
