#!/usr/bin/env node
// `pnpm live`: everything ArkivAgent needs, in one terminal. Starts the indexer in watch mode (it
// follows the chain, decodes records and re-stores the Insights, Financials and Arkiv-Decode results
// every 30 s) and the app. Ctrl-C stops both. Pass `--start` to serve the production build instead
// of the dev server.
import { spawn } from "node:child_process";

const app = process.argv.includes("--start") ? "start" : "dev";
const run = (name, args) => {
  const child = spawn("pnpm", args, { stdio: "inherit" });
  child.on("error", (error) => console.error(`live: could not start ${name}: ${error.message}`));
  return child;
};

const indexer = run("the indexer", ["index", "--watch"]);
const web = run("the app", [app]);

let isStopping = false;
const stop = (code) => {
  if (isStopping) return;
  isStopping = true;
  for (const child of [indexer, web]) if (child.exitCode === null) child.kill("SIGTERM");
  process.exitCode = code;
};
// The app is the point: when it ends, so does everything. The indexer stopping (say another one
// already holds the index lock) leaves the app up, reading the index as it is.
web.on("exit", (code) => stop(code ?? 0));
indexer.on("exit", (code) => { if (!isStopping) console.error(`live: the indexer stopped (code ${code}). The app keeps running on the index as it is.`); });
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => stop(0));
