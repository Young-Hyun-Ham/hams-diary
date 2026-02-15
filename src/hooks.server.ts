// src/hooks.server.ts
import type { Handle } from "@sveltejs/kit";

const ALLOW_ORIGINS = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
]);

function corsHeaders(origin: string | null) {
  // origin이 없으면 CORS 헤더를 굳이 붙일 필요가 없지만,
  // 앱(WebView)은 origin이 https://localhost 로 온다.
  const o = origin && ALLOW_ORIGINS.has(origin) ? origin : null;

  const h: Record<string, string> = {
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400",
  };

  if (o) {
    h["access-control-allow-origin"] = o;
    h["vary"] = "origin";
  }

  return h;
}

export const handle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get("origin");

  // API만 CORS 적용
  if (event.url.pathname.startsWith("/api/")) {
    // Preflight(OPTIONS) 먼저 처리
    if (event.request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const response = await resolve(event);

    // 응답에 CORS 헤더 덧붙이기
    const headers = new Headers(response.headers);
    const add = corsHeaders(origin);
    for (const [k, v] of Object.entries(add)) headers.set(k, v);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  return resolve(event);
};
