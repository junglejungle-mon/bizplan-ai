import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-inline' is required for Next.js internal inline scripts (hydration bootstrap, __NEXT_DATA__ etc.).
      // strict-dynamic/nonce cannot be used until Next.js provides first-class nonce support without patching.
      "script-src 'self' 'unsafe-inline' https://cdn.portone.io https://*.google-analytics.com https://*.googletagmanager.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.portone.io https://*.google-analytics.com https://*.sentry.io https://*.ingest.sentry.io",
      "frame-src 'self' https://cdn.portone.io https://*.portone.io",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "undici"],
  outputFileTracingIncludes: {
    "/api/**": ["./src/lib/fonts/**/*"],
  },
  outputFileTracingExcludes: {
    // data/ 디렉토리는 런타임에만 접근 (빌드 번들링 제외 → Turbopack 광범위 패턴 경고 해소)
    "/**": ["./data/**/*"],
  },
  async redirects() {
    return [
      {
        source: "/(.*)",
        has: [{ type: "host", value: "www.bizplanai.co.kr" }],
        destination: "https://bizplanai.co.kr/$1",
        permanent: true,
      },
      {
        source: "/business-plan",
        destination: "/plans",
        permanent: true,
      },
      {
        source: "/business-plan/:path*",
        destination: "/plans/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // 정적 자산 캐싱 (JS, CSS, 폰트, 이미지)
        source: "/:path*.(js|css|woff|woff2|ttf|otf|ico|png|jpg|jpeg|svg|webp)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  tunnelRoute: "/monitoring",
});
