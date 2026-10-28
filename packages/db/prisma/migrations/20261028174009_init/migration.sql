-- CreateTable
CREATE TABLE "Entity" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "createdAtBlock" BIGINT NOT NULL,
    "createdTx" TEXT NOT NULL,
    "createdOp" INTEGER NOT NULL,
    "updatedAtBlock" BIGINT NOT NULL,
    "expiresAt" BIGINT NOT NULL,
    "status" TEXT NOT NULL,
    "deletedAtBlock" BIGINT,
    "creationFlags" INTEGER NOT NULL,
    "contentType" TEXT,
    "payloadBytes" INTEGER,
    "payloadPreview" TEXT,
    "schemaSig" TEXT,
    "decodedBlock" BIGINT
);

-- CreateTable
CREATE TABLE "Attribute" (
    "entityKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    PRIMARY KEY ("entityKey", "name"),
    CONSTRAINT "Attribute_entityKey_fkey" FOREIGN KEY ("entityKey") REFERENCES "Entity" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Patch" (
    "entityKey" TEXT NOT NULL,
    "block" BIGINT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "tx" TEXT NOT NULL,
    "op" INTEGER NOT NULL,

    PRIMARY KEY ("entityKey", "block", "logIndex"),
    CONSTRAINT "Patch_entityKey_fkey" FOREIGN KEY ("entityKey") REFERENCES "Entity" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Change" (
    "seq" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "block" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "owner" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "chainId" INTEGER NOT NULL,
    "genesisHash" TEXT NOT NULL,
    "indexedBlock" BIGINT NOT NULL,
    "chainHead" BIGINT NOT NULL,
    "syncedAtMs" BIGINT NOT NULL
);

-- CreateIndex
CREATE INDEX "Entity_status_expiresAt_idx" ON "Entity"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Entity_owner_idx" ON "Entity"("owner");

-- CreateIndex
CREATE INDEX "Entity_schemaSig_idx" ON "Entity"("schemaSig");

-- CreateIndex
CREATE INDEX "Entity_createdAtBlock_idx" ON "Entity"("createdAtBlock");

-- CreateIndex
CREATE INDEX "Attribute_name_type_idx" ON "Attribute"("name", "type");

-- CreateIndex
CREATE INDEX "Change_block_idx" ON "Change"("block");

-- CreateIndex
CREATE UNIQUE INDEX "Change_block_kind_entityKey_key" ON "Change"("block", "kind", "entityKey");
