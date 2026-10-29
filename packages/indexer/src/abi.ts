// Arkiv entity-registry ABIs as of @arkiv-network/sdk 0.8.1 (src/entity/operations.ts). The SDK
// does not export them (arkiv/friction.md item 6), so they are copied here; keep in step on upgrade.
import { parseAbi, parseAbiParameters } from "viem";

export const EXECUTE_ABI = parseAbi([
  "function execute((uint8 operation, bytes operationData)[] ops) external returns (bytes32[] keys)",
]);

const ATTRS = "(bytes32 name, uint8 typeId, bytes value)[]";

export const OP = { create: 1, patch: 2, extend: 3, transfer: 4, delete: 5 } as const;

export const OP_PARAMS = {
  [OP.create]: parseAbiParameters(`(uint128 salt, uint64 expiresAt, uint64 minLifetime, uint8 creationFlags, ${ATTRS} attributes)`),
  [OP.patch]: parseAbiParameters(`(bytes32 entityKey, ${ATTRS} mutations)`),
} as const;

/** Wire typeIds (sdk src/attr/types.ts). 0 is a tombstone (unset); 7 backs `$payload` only. */
export const TYPE_TAGS = {
  1: "bool", 2: "i32", 3: "u64", 4: "u256", 5: "dec", 6: "bytes32", 7: "bytes", 8: "str", 9: "addr", 10: "key",
} as const;

export type TypeTag = (typeof TYPE_TAGS)[keyof typeof TYPE_TAGS];
