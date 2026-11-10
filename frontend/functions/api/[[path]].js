const BACKEND = "https://adybajaj-api.onrender.com";

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
  try {
    return await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ detail: "Proxy error: " + String(err && err.message ? err.message : err), target }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    );
  }
}
