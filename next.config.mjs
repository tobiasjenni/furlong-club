const isProd = process.env.NODE_ENV === "production";
const isHttps = (process.env.APP_URL ?? "").startsWith("https://");

// Next.js injects inline bootstrap scripts, so script-src needs 'unsafe-inline' unless we move to nonces.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "media-src 'self' https:",
  "frame-src https://iframe.mediadelivery.net https://player.vimeo.com https://www.youtube-nocookie.com https://www.youtube.com",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/:path*", has: [{ type: "host", value: "www.furlong.club" }], destination: "https://furlong.club/:path*", permanent: true },
      { source: "/:path*", has: [{ type: "host", value: "furlong.club" }, { type: "header", key: "x-forwarded-proto", value: "http" }], destination: "https://furlong.club/:path*", permanent: true },
      { source: "/about-rob", destination: "/meet-harry", permanent: true },
      { source: "/v2", destination: "/dashboard", permanent: true },
      { source: "/v2/plans", destination: "/membership", permanent: true },
      { source: "/v2/trading/:path*", destination: "/allocations/:path*", permanent: true },
      { source: "/v2/:path*", destination: "/:path*", permanent: true },
    ];
  },
  // Lets the Cloudflare build resolve Prisma to its WebAssembly (workerd) build.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  async headers() {
    return [
      {
        source: "/:section(admin|admin-unlock|account|dashboard|wallet|allocations|performance|activity|planner|membership|deposits|support|checkout|videos|api|login|signup|forgot-password|reset-password|verify-email|v2)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }, { key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "same-origin" }],
      },
      {
        source: "/(.*)",
        headers: [
          ...(process.env.APP_ENV === "staging" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] : []),
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
    ];
  },
};
export default nextConfig;
