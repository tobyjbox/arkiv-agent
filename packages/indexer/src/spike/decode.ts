// Spike check 1c: attributes without `arkiv_query`. Entity calldata is plain ABI, so a create's
// attributes, payload and lifetime decode from the transaction alone (SDK 0.8.1 ABIs, not exported).
import { ENTITY_EVENTS_ABI } from "@arkiv-network/sdk";
import { ARKIV_ADDRESS, createArkivClient } from "@arkiv-agent/core";
import { decodeAbiParameters, decodeFunctionData, type Hex, hexToString, parseAbi, parseAbiParameters } from "viem";
import { writeReport } from "./report.ts";

const EXECUTE_ABI = parseAbi(["function execute((uint8 operation, bytes operationData)[] ops) external returns (bytes32[] keys)"]);
const CREATE_PARAMS = parseAbiParameters(
  "(uint128 salt, uint64 expiresAt, uint64 minLifetime, uint8 creationFlags, (bytes32 name, uint8 typeId, bytes value)[] attributes)",
);
const CREATE_OP = 1;

const client = createArkivClient();
const head = await client.getBlockNumber();
const logs = await client.getLogs({ address: ARKIV_ADDRESS, events: ENTITY_EVENTS_ABI, fromBlock: head - 600n, toBlock: head });
const firstTxByOwner = new Map<string, Hex>();
for (const l of logs) if (l.eventName === "EntityCreated" && l.args.owner && !firstTxByOwner.has(l.args.owner)) firstTxByOwner.set(l.args.owner, l.transactionHash);

const decoded = [];
for (const [owner, hash] of firstTxByOwner) {
  const tx = await client.getTransaction({ hash });
  const { args } = decodeFunctionData({ abi: EXECUTE_ABI, data: tx.input });
  for (const op of args[0].filter((o) => o.operation === CREATE_OP)) {
    const [create] = decodeAbiParameters(CREATE_PARAMS, op.operationData);
    decoded.push({
      owner, tx: hash, minLifetime: create.minLifetime, expiresAtInCalldata: create.expiresAt, flags: create.creationFlags,
      attributes: create.attributes.map((a) => ({ name: hexToString(a.name, { size: 32 }).replace(/\0+$/, ""), typeId: a.typeId, bytes: (a.value.length - 2) / 2 })),
    });
  }
}
for (const d of decoded) console.log(d.owner.slice(0, 10), `minLifetime ${d.minLifetime}`, d.attributes.map((a) => `${a.name}:t${a.typeId}`).join(" "));
console.log("wrote", await writeReport("decode", { head, owners: firstTxByOwner.size, decoded }));
