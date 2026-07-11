import path from "path";

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;

const nextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: replitDevDomain ? [replitDevDomain] : [],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://localhost:4000/api/:path*" },
      { source: "/auth/:path*", destination: "http://localhost:4000/auth/:path*" },
      // /planner routes are handled by the Next.js app; /api/planner is proxied to the backend.
      { source: "/courses/:path*", destination: "http://localhost:4000/courses/:path*" },
      { source: "/saved-courses/:path*", destination: "http://localhost:4000/saved-courses/:path*" },
      { source: "/completed-courses/:path*", destination: "http://localhost:4000/completed-courses/:path*" },
    ];
  },
};

export default nextConfig;