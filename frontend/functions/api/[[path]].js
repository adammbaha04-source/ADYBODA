// Forwards every /api request (GET, POST, PATCH, DELETE...) to the Render backend.
// Cloudflare Pages _redirects cannot proxy POST requests, so this function does it instead.
const BACKEND = "https://adybajaj-api.onrender.com";

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const target = BACKEND + url.pathname + url.search;

  // Copy headers, but drop Host so Render routes the request by its own hostname.
  const headers = new Headers(request.headers);
  headers.delete("host");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual",
  });
}

