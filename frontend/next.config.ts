import path from "path";

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;

const nextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: replitDevDomain ? [replitDevDomain] : [],
};

export default nextConfig;