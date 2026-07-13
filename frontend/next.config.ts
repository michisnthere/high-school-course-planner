import path from "path";

const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;

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
