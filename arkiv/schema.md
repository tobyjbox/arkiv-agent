# What ArkivAgent reads and writes on Arkiv

ArkivAgent is read-only. It writes nothing to Arkiv and holds no wallet.

| Source | Call | Used for |
|---|---|---|
| Entity events on `0x4400…0044` | `eth_getLogs` (≤5,000-block spans) | Lifecycle of every entity: created, patched, extended, transferred, deleted; owner and `expiresAt`. Backfill and incremental sync. |
| Entity calldata | `eth_getTransactionByHash` | Attributes, `$contentType`, payload size and a ≤256-byte preview, `minLifetime`, decoded with the SDK 0.8.1 `execute` ABI. |
| Receipts | `eth_getTransactionReceipt` | Gas used and price per operation (cost view); `rentFee` when nodes start reporting it. |
| Live state | `arkiv_query` | Ask Arkiv's live queries and spot checks only. It has a separate, small anonymous budget (`arkiv/friction.md` item 2). |
| Totals | `arkiv_getEntityCount`, `eth_blockNumber` | Header counters and "synced N s ago". |

Network: Tiramisu testnet, chain `7738577`, `https://rpc.tiramisu.db-chain.testnet.arkiv.network`
(`ARKIV_RPC_URL` in `.env`). An optional Arkiv Hub access key raises limits.
