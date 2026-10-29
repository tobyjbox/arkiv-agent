import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join(import.meta.dirname, "../../../../data/spike");

/** Writes a spike result to data/spike (gitignored: it can hold third-party chain data). */
export async function writeReport(name: string, body: unknown): Promise<string> {
  await mkdir(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, `${name}.json`);
  const json = JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  await writeFile(path, json);
  return path;
}

export const tally = <K>(map: Map<K, number>, key: K) => map.set(key, (map.get(key) ?? 0) + 1);

export const top = <K>(map: Map<K, number>, n = 10) =>
  [...map].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));

export const seconds = (since: number) => Math.round((performance.now() - since) / 10) / 100;
