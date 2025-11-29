/*
  Warnings:

  - You are about to drop the column `tokenSymbol` on the `Position` table. All the data in the column will be lost.
  - Added the required column `amountBought` to the `Position` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amountInSUI` to the `Position` table without a default value. This is not possible if the table is not empty.
  - Added the required column `humanAmount` to the `Position` table without a default value. This is not possible if the table is not empty.
  - Added the required column `symbol` to the `Position` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "tokenName" TEXT,
    "decimals" INTEGER NOT NULL,
    "amountBought" REAL NOT NULL,
    "humanAmount" REAL NOT NULL,
    "balance" REAL NOT NULL,
    "averageEntry" REAL NOT NULL,
    "amountInSUI" REAL NOT NULL,
    "marketCap" REAL,
    "spentSUI" REAL,
    "lastBuySUI" REAL,
    "lastBuyAmount" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Position" ("averageEntry", "balance", "createdAt", "decimals", "id", "tokenAddress", "tokenName", "updatedAt", "userId", "walletId") SELECT "averageEntry", "balance", "createdAt", "decimals", "id", "tokenAddress", "tokenName", "updatedAt", "userId", "walletId" FROM "Position";
DROP TABLE "Position";
ALTER TABLE "new_Position" RENAME TO "Position";
CREATE UNIQUE INDEX "Position_userId_walletId_tokenAddress_key" ON "Position"("userId", "walletId", "tokenAddress");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
