import path from "path";

// Server-only env var for the Next.js API proxy. Set this on Render (not NEXT_PUBLIC_*)
// so it is never exposed to client code. Falls back to NEXT_PUBLIC_API_URL for
// backward compatibility with existing deployments.
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;

if (backendUrl) {
  console.log(`[NEXT] API proxy configured: ${backendUrl}`);
} else {
  console.warn(
    "[NEXT] BACKEND_URL is not set. API proxy rewrites will not be configured. " +
    "Set this environment variable in production to point to your Render backend URL."
  );
}

const nextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: replitDevDomain ? [replitDevDomain] : [],
  async rewrites() {
    if (!backendUrl) return [];
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/api/:path*/", destination: `${backendUrl}/api/:path*` },
      { source: "/auth/:path*", destination: `${backendUrl}/auth/:path*` },
      { source: "/auth/:path*/", destination: `${backendUrl}/auth/:path*` },
      { source: "/courses/:path*", destination: `${backendUrl}/courses/:path*` },
      { source: "/saved-courses/:path*", destination: `${backendUrl}/saved-courses/:path*` },
      { source: "/api/completed-courses/:path*", destination: `${backendUrl}/api/completed-courses/:path*` },
    ];
  },
};

export default nextConfig;
