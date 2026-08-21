import { NextRequest, NextResponse } from "next/server";

// Per-request Content-Security-Policy with a nonce. A fresh nonce is minted for each
// request, placed on the request header (so the layout can read it and nonce its own
// inline scripts) and named in the CSP. Next reads the nonce from the CSP on the
// request and applies it to the framework scripts it injects, so the whole page can
// run under a strict policy with no 'unsafe-inline' for script.
//
// 'strict-dynamic' lets a nonced script load the chunks it needs without each chunk
// being listed, which is how Next's runtime loads. style-src keeps 'unsafe-inline'
// because inline style attributes (style={{...}}) cannot carry a nonce; a script
// nonce is present, so this is the effective posture, not the checkbox one. The
// browser calls only same-origin /api/council/* routes (the provider calls happen
// server-side), so connect-src stays 'self'.
//
// Deployed Report-Only first: browsers report violations to the console but block
// nothing, so a live page cannot break while the policy is validated. Flip the header
// name to Content-Security-Policy to enforce once the console is clean.
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  // Enforcing. Validated Report-Only first with zero console violations.
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Run on documents, not on static assets or image optimization, and skip the
  // prefetches Next marks so a nonce is not baked into a cached prefetch.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
