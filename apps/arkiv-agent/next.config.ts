import type { NextConfig } from "next";

// The host settings' pre-rename names still work for one release (package.json scripts, lib/guard.ts).
for (const [legacy, name] of [["ARKIV_AGENT_HOST", "ARKIV_AGENT_HOST"], ["ARKIV_AGENT_ALLOWED_HOSTS", "ARKIV_AGENT_ALLOWED_HOSTS"]] as const) {
  if (process.env[legacy] !== undefined && process.env[name] === undefined) console.warn(`${legacy} is now ${name}. The old name still works, but not after the next release.`);
}

const config: NextConfig = {
  transpilePackages: ["@arkiv-agent/core", "@arkiv-agent/db", "@arkiv-agent/catalogue", "@arkiv-agent/ask", "@arkiv-agent/pulse", "@arkiv-agent/cost"],
  // Native SQLite driver: load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  // Pulse was renamed Insights and Cost Financials; old links keep working.
  redirects: async () => [
    { source: "/pulse", destination: "/insights", permanent: true },
    { source: "/cost", destination: "/financials", permanent: true },
  ],
};

export default config;
