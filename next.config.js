const withPWAInit = require("@ducanh2912/next-pwa").default;
const { version: pkgVersion } = require("./package.json");

const isProd = process.env.NODE_ENV === "production";
// Unique per build so clients can tell when a new deployment is live.
const appVersion = `${pkgVersion}+${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;

const withPWA = withPWAInit({
  dest: "public",
  disable: !isProd,
  register: true,
  customWorkerSrc: "worker",
});

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        encoding: false,
      };
    }
    return config;
  },
turbopack: {},
  devIndicators: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: isProd
    ? {
        removeConsole: { exclude: ["error", "warn"] },
      }
    : undefined,
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.53.6",
    "192.168.53.9",
    "192.168.53.7",
    "app.jyotielectricals.co.in",
  ],
  async rewrites() {
    return [];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' blob: data:; img-src 'self' blob: data: https: http:",
          },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);