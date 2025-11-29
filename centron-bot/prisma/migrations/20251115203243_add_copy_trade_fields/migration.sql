-- CreateTable
CREATE TABLE "CopytradeWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "nickname" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "copyBuys" BOOLEAN NOT NULL DEFAULT true,
    "copySells" BOOLEAN NOT NULL DEFAULT true,
    "copyAmount" REAL NOT NULL DEFAULT 0,
    "autoBuyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoSellEnabled" BOOLEAN NOT NULL DEFAULT false,
    "slippage" REAL NOT NULL DEFAULT 10,
    "autoBuyNotifications" BOOLEAN NOT NULL DEFAULT false,
    "autoSellNotifications" BOOLEAN NOT NULL DEFAULT false,
    "sellPercentage" REAL NOT NULL DEFAULT 0,
    "totalCopied" INTEGER NOT NULL DEFAULT 0,
    "successfulCopies" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CopytradeWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CopytradeWallet_userId_walletAddress_key" ON "CopytradeWallet"("userId", "walletAddress");
