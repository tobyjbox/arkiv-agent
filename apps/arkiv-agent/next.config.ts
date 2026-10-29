import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@arkiv-agent/core", "@arkiv-agent/db", "@arkiv-agent/catalogue", "@arkiv-agent/ask", "@arkiv-agent/projects", "@arkiv-agent/pulse", "@arkiv-agent/cost"],
  // Native SQLite driver: load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  // Pulse was renamed Insights and Cost Financials; old links keep working.
  redirects: async () => [
    { source: "/pulse", destination: "/insights", permanent: true },
    { source: "/cost", destination: "/financials", permanent: true },
  ],
};

export default config;
