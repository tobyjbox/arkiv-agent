import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSqlite } from "@arkiv-agent/db";
import { encodeAbiParameters, encodeFunctionData, type Hex, stringToHex, toHex } from "viem";
import { EXECUTE_ABI, OP, OP_PARAMS } from "../src/abi.ts";
import { parse } from "../src/fixtures/format.ts";

const MIGRATIONS = join(import.meta.dirname, "../../db/prisma/migrations");

/** A fresh SQLite file with the Prisma migrations applied. */
export function tempDb() {
  const path = join(mkdtempSync(join(tmpdir(), "arkiv-agent-test-")), "arkiv-agent.db");
  const db = openSqlite(path);
  for (const dir of readdirSync(MIGRATIONS).filter((d) => !d.endsWith(".toml")).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, dir, "migration.sql"), "utf8"));
  }
  return { db, path };
}

export const fixture = () => parse(readFileSync(join(import.meta.dirname, "fixtures/tiramisu-window.json"), "utf8"));

type Cell = { name: string; typeId: number; value: Hex };
export const name32 = (name: string) => toHex(name, { size: 32 });
export const str = (name: string, value: string): Cell => ({ name, typeId: 8, value: stringToHex(value) });
export const u64 = (name: string, value: bigint): Cell => ({ name, typeId: 3, value: toHex(value, { size: 32 }) });
export const unset = (name: string): Cell => ({ name, typeId: 0, value: "0x" });
const wire = (cells: Cell[]) => cells.map((c) => ({ ...c, name: name32(c.name) }));

/** Synthetic `execute` calldata, encoded with the same ABIs the decoder reads. */
export function executeInput(ops: ({ create: Cell[]; minLifetime?: bigint } | { patch: Hex; cells: Cell[] } | { other: number })[]): Hex {
  return encodeFunctionData({
    abi: EXECUTE_ABI, functionName: "execute",
    args: [ops.map((op) => {
      if ("create" in op) {
        return { operation: OP.create, operationData: encodeAbiParameters(OP_PARAMS[OP.create], [{ salt: 1n, expiresAt: 0n, minLifetime: op.minLifetime ?? 100n, creationFlags: 0, attributes: wire(op.create) }]) };
      }
      if ("patch" in op) return { operation: OP.patch, operationData: encodeAbiParameters(OP_PARAMS[OP.patch], [{ entityKey: op.patch, mutations: wire(op.cells) }]) };
      return { operation: op.other, operationData: "0x" as Hex };
    })],
  });
}
