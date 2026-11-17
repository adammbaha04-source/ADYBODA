const BACKEND = "https://adybajaj-api.onrender.com";
const UPSTREAM_TIMEOUT_MS = 25000;

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 1. Test Cloudflare-to-Render connectivity (Kwa ajili ya kupima tu)
  if (url.pathname === "/api/_ping") {
    try {
      const upstream = await fetch(
        BACKEND + "/api/auth/token/", // Inagusa endpoint ya auth
        {
          method: "GET",
          headers: { Accept: "application/json" },
          redirect: "manual",
          signal: AbortSignal.timeout(20000),
        }
      );

      // Kama inarudisha 405 (Method Not Allowed) au 2xx, inamaanisha Render ipo hai
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
  
  // Ni muhimu kuondoa host header ya Cloudflare ili Render itumie yake
  headers.delete("host");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  
  // Marekebisho: Kusoma body kama ArrayBuffer ili kuepuka matatizo ya streaming
  const bodyData = hasBody ? await request.arrayBuffer() : undefined;

  try {
    const response = await fetch(target, {
      method: request.method,
      headers: headers,
      body: bodyData, 
      redirect: "manual",
      // Marekebisho: Timeout inatumika kwa kila ombi (GET na POST)
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
