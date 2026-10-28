import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@arkiv-agent/core", "@arkiv-agent/db"],
  // Native SQLite driver: load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default config;
