import { decodeAbiParameters, decodeFunctionData, type Hex } from "viem";
import { EXECUTE_ABI, OP, OP_PARAMS } from "./abi.ts";
import type { WireAttribute } from "./attributes.ts";

/** One entity operation in a transaction. Only creates and patches carry attributes. */
export type DecodedOp =
  | { kind: "create"; minLifetime: bigint; flags: number; attributes: readonly WireAttribute[] }
  | { kind: "patch"; entityKey: Hex; mutations: readonly WireAttribute[] }
  | { kind: "other" };

/** Decodes an `execute` call's operations, in order; op i emitted the transaction's i-th entity log. */
export function decodeOps(input: Hex): DecodedOp[] {
  const { args } = decodeFunctionData({ abi: EXECUTE_ABI, data: input });
  return args[0].map(({ operation, operationData }): DecodedOp => {
    if (operation === OP.create) {
      const [c] = decodeAbiParameters(OP_PARAMS[OP.create], operationData);
      return { kind: "create", minLifetime: c.minLifetime, flags: c.creationFlags, attributes: c.attributes };
    }
    if (operation === OP.patch) {
      const [p] = decodeAbiParameters(OP_PARAMS[OP.patch], operationData);
      return { kind: "patch", entityKey: p.entityKey, mutations: p.mutations };
    }
    return { kind: "other" };
  });
}
