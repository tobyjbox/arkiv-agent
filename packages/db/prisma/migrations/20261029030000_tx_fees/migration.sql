-- CreateTable
CREATE TABLE "TxFee" (
    "tx" TEXT NOT NULL PRIMARY KEY,
    "block" BIGINT NOT NULL,
    "sender" TEXT NOT NULL,
    "creates" INTEGER NOT NULL,
    "updates" INTEGER NOT NULL,
    "calldataBytes" INTEGER NOT NULL,
    "payloadBytes" INTEGER NOT NULL,
    "lifetimeBlocks" BIGINT,
    "gasUsed" BIGINT NOT NULL,
    "gasPriceWei" TEXT NOT NULL,
    "feeWei" TEXT NOT NULL,
    "fetchedAtMs" BIGINT NOT NULL
);

-- CreateIndex
CREATE INDEX "TxFee_block_idx" ON "TxFee"("block");

-- CreateIndex
CREATE INDEX "TxFee_sender_idx" ON "TxFee"("sender");

