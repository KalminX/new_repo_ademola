import { prisma } from "../../config/prisma.js";
import { getAllPendingDcaOrders, markDcaOrderAsCompleted, updateDcaOrderExecution } from "../../services/orderService.js";
import { getUser } from "../../services/userService.js";
import { buyTokenWithAftermath } from "../../transactions/aftermath/buyToken.js";
import { sellTokenWithAftermath } from "../../transactions/aftermath/sellToken.js";
import { decryptWallet } from "../cryptoCore.js";
import { bot } from "../telegraf.js";


let checking = false;

export async function checkPendingDcaOrders() {
    if (checking) return;
    checking = true;

    try {
        const orders = await getAllPendingDcaOrders();
        for (const order of orders) {
            try {
                const wallet = await prisma.wallet.findUnique({
                    where: { id: order.walletId }
                });

                if (!wallet) {
                    console.warn(`⚠️ Wallet not found for order ${order.id}`);
                    continue;
                }

                const address = wallet.address;
                const now = Date.now();
                const lastTime = order.lastExecuted || 0;
                const intervalMs = order.intervalMinutes * 60 * 1000;

                // Check if it's time to execute
                if (now - lastTime < intervalMs) continue;

                const user = await getUser(order.userId);
                if (!user) {
                    console.warn(`⚠️ User not found for order ${order.id}`);
                    continue;
                }

                // Decrypt wallet
                const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
                let phrase;
                try {
                    const encrypted = wallet?.seedPhrase || wallet?.privateKey;
                    const decrypted = decryptWallet(encrypted, ENCRYPTION_SECRET);
                    phrase = typeof decrypted === "string"
                        ? decrypted
                        : decrypted.privateKey || decrypted.seedPhrase;
                } catch (err) {
                    console.error(`❌ Failed to decrypt wallet for order ${order.id}`, err);
                    continue;
                }

                if (!phrase) {
                    console.warn(`⚠️ Missing phrase for wallet ${address}`);
                    continue;
                }

                // Perform the DCA order
                let tx;
                if (order.mode === "buy") {
                    tx = await buyTokenWithAftermath({
                        tokenAddress: order.tokenAddress,
                        phrase,
                        suiAmount: order.suiAmount,
                        slippage: order.slippage
                    });
                } else {
                    tx = await sellTokenWithAftermath({
                        tokenAddress: order.tokenAddress,
                        phrase,
                        suiPercentage: order.suiPercentage,
                        slippage: order.slippage
                    });
                }

                // Update execution count
                const newExecutedCount = (order.executedCount || 0) + 1;
                await updateDcaOrderExecution(order.id, {
                    lastExecuted: now,
                    executedCount: newExecutedCount
                });

                // Format TX message
                const shortWallet = `${tx.address.slice(0, 6)}...${tx.address.slice(-4)}`;
                const explorerUrl = `https://suiscan.xyz/mainnet/tx/${tx.transactionDigest}`;
                const formatNum = (num) => (typeof num === "number" ? num.toFixed(5) : "0");

                let messageText;
                if (order.mode === "buy") {
                    messageText =
                        `${shortWallet} [DCA] ✅ Swapped ${formatNum(tx.spentSUI)} SUI ↔ ${formatNum(tx.tokenAmountReadable)} $${tx.tokenSymbol}\n` +
                        `🔗 <a href="${explorerUrl}">View Transaction Record on Explorer</a>`;
                } else {
                    messageText =
                        `${shortWallet} [DCA] ✅ Swapped ${formatNum(tx.tokenAmountSold)} $${tx.tokenSymbol} ↔ ${formatNum(tx.suiAfterFee)} SUI\n` +
                        `🔗 <a href="${explorerUrl}">View Transaction Record on Explorer</a>`;
                }

                await bot.telegram.sendMessage(order.userId, messageText, {
                    parse_mode: "HTML"
                });

                // If there's a max execution count, stop when reached
                if (order.maxExecutions && newExecutedCount >= order.maxExecutions) {
                    await markDcaOrderAsCompleted(order.id);
                    await bot.telegram.sendMessage(
                        order.userId,
                        `✅ DCA order completed (executed ${order.maxExecutions} times)`
                    );
                }
            } catch (err) {
                console.error(`❌ Error processing DCA order ${order.id}:`, err);
            }
        }
    } catch (error) {
        console.error("❌ Error in checkPendingDcaOrders:", error);
    } finally {
        checking = false;
    }
}