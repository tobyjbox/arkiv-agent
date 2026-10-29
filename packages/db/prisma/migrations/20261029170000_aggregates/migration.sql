-- CreateTable
CREATE TABLE "Aggregate" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "indexedBlock" BIGINT NOT NULL,
    "computedAtMs" BIGINT NOT NULL
);
