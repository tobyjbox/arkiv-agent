-- CreateTable
CREATE TABLE "DatasetDescription" (
    "datasetId" TEXT NOT NULL PRIMARY KEY,
    "schemaHash" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "likelyUse" TEXT NOT NULL,
    "suggestedName" TEXT,
    "model" TEXT NOT NULL,
    "inputs" TEXT NOT NULL,
    "createdAtMs" BIGINT NOT NULL
);
