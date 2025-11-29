/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referralCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- CreateTable
CREATE TABLE "ReferralEarning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "walletId" TEXT,
    "tokenAddress" TEXT,
    "amount" REAL NOT NULL,
    "feeAmount" REAL NOT NULL,
    "commissionRate" REAL NOT NULL,
    "transactionDigest" TEXT NOT NULL,
    "credited" BOOLEAN NOT NULL DEFAULT false,
    "creditedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralEarning_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReferralEarning_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReferralEarning_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PNLRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "totalInvested" REAL NOT NULL,
    "totalReceived" REAL NOT NULL,
    "profitLoss" REAL NOT NULL,
    "profitLossPercent" REAL NOT NULL,
    "amountSold" REAL NOT NULL,
    "percentageSold" INTEGER,
    "isFullSell" BOOLEAN NOT NULL DEFAULT false,
    "transactionDigest" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PNLRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PNLRecord_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Referral_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Referral_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Referral" ("id", "referredId", "userId") SELECT "id", "referredId", "userId" FROM "Referral";
DROP TABLE "Referral";
ALTER TABLE "new_Referral" RENAME TO "Referral";
CREATE INDEX "Referral_userId_idx" ON "Referral"("userId");
CREATE INDEX "Referral_referredId_idx" ON "Referral"("referredId");
CREATE UNIQUE INDEX "Referral_userId_referredId_key" ON "Referral"("userId", "referredId");
CREATE TABLE "new_Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "name" TEXT,
    "seedPhrase" TEXT,
    "privateKey" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Wallet" ("address", "id", "name", "privateKey", "seedPhrase", "userId") SELECT "address", "id", "name", "privateKey", "seedPhrase", "userId" FROM "Wallet";
DROP TABLE "Wallet";
ALTER TABLE "new_Wallet" RENAME TO "Wallet";
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ReferralEarning_transactionDigest_key" ON "ReferralEarning"("transactionDigest");

-- CreateIndex
CREATE INDEX "ReferralEarning_userId_idx" ON "ReferralEarning"("userId");

-- CreateIndex
CREATE INDEX "ReferralEarning_referredUserId_idx" ON "ReferralEarning"("referredUserId");

-- CreateIndex
CREATE INDEX "ReferralEarning_credited_idx" ON "ReferralEarning"("credited");

-- CreateIndex
CREATE INDEX "PNLRecord_userId_idx" ON "PNLRecord"("userId");

-- CreateIndex
CREATE INDEX "PNLRecord_walletId_idx" ON "PNLRecord"("walletId");

-- CreateIndex
CREATE INDEX "PNLRecord_tokenAddress_idx" ON "PNLRecord"("tokenAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
