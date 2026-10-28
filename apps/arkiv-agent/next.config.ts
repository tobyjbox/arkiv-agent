import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@arkiv-agent/core", "@arkiv-agent/db", "@arkiv-agent/catalogue", "@arkiv-agent/ask"],
  // Native SQLite driver: load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default config;
