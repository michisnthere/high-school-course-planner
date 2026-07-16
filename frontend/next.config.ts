import path from "path";

const backendUrl = process.env.NEXT_PUBLIC_API_URL;

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;

if (!backendUrl) {
  console.warn(
    "[NEXT] NEXT_PUBLIC_API_URL is not set. API proxy rewrites will not be configured. " +
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
      { source: "/auth/:path*", destination: `${backendUrl}/auth/:path*` },
      { source: "/courses/:path*", destination: `${backendUrl}/courses/:path*` },
      { source: "/saved-courses/:path*", destination: `${backendUrl}/saved-courses/:path*` },
      { source: "/api/completed-courses/:path*", destination: `${backendUrl}/api/completed-courses/:path*` },
    ];
  },
};

export default nextConfig;
