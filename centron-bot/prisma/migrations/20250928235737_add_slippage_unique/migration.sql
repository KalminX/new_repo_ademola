/*
  Warnings:

  - A unique constraint covering the columns `[userId,walletId,type]` on the table `Slippage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Slippage_userId_walletId_type_key" ON "Slippage"("userId", "walletId", "type");
