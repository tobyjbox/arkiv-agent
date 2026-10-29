// Records a short real window for tests. Keeps only transactions from the window's two busiest
// writers (Arkiv's load generators: random data), so no third-party records land in the repo.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk";
import { ARKIV_ADDRESS, createArkivClient } from "@arkiv-agent/core";
import type { Hex } from "viem";
import { stringify } from "./format.ts";

const BLOCKS = 40n;
const client = createArkivClient();
const toBlock = (await client.getBlockNumber()) - 10n;
const fromBlock = toBlock - BLOCKS + 1n;
const logs = await client.getLogs({ address: ARKIV_ADDRESS, events: ENTITY_EVENTS_ABI, fromBlock, toBlock, strict: true });

const creates = new Map<Hex, number>();
for (const l of logs) if (l.eventName === "EntityCreated") creates.set(l.args.owner, (creates.get(l.args.owner) ?? 0) + 1);
const owners = [...creates].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([o]) => o);

const byTx = Map.groupBy(logs, (l) => l.transactionHash);
const kept = [...byTx].filter(([, ls]) => ls.every((l) => "owner" in l.args && owners.includes(l.args.owner as Hex)));
const inputs: Record<Hex, Hex> = {};
for (const [tx] of kept) inputs[tx] = (await client.getTransaction({ hash: tx })).input;

const out = join(import.meta.dirname, "../../test/fixtures/tiramisu-window.json");
const keptLogs = kept.flatMap(([, ls]) => ls).map(({ blockNumber, logIndex, transactionHash, eventName, args }) => ({ blockNumber, logIndex, transactionHash, eventName, args }));
await writeFile(out, stringify({ chainId: await client.getChainId(), fromBlock, toBlock, owners, logs: keptLogs as never, inputs }));
console.log(`recorded ${keptLogs.length} logs, ${kept.length} txs from ${owners.join(", ")} (blocks ${fromBlock}..${toBlock}) -> ${out}`);
