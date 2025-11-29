import { prisma } from "../../config/prisma.js";
import { getAllPendingLimitOrders, markOrderAsCompleted } from "../../services/orderService.js";
import { getUser } from "../../services/userService.js";
import { buyTokenWithAftermath } from "../../transactions/aftermath/buyToken.js";
import { sellTokenWithAftermath } from "../../transactions/aftermath/sellToken.js";
import { decryptWallet } from "../cryptoCore.js";
import { bot } from "../telegraf.js";
import { formatPrice, getFallbackTokenDetails } from "../utils/getTokenDetails.js";



let checking = false;

export async function checkPendingMcapOrders() {
    
    if (checking) return;
    checking = true;

    const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET
    try {
        const orders = await getAllPendingLimitOrders();
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
                // const { tokenInfo } = await getFallbackTokenDetails(order.tokenAddress, order.walletAddress);
                const { tokenInfo } = await getFallbackTokenDetails(order.tokenAddress, address);
                if (!tokenInfo || typeof tokenInfo.marketCap !== "number") {
                    console.warn(`⚠️ MarketCap missing for token ${order.tokenAddress}`);
                    continue;
                }

                const currentMcap = tokenInfo.marketCap;
                // const triggered =
                //     (order.mode === "buy" && currentMcap <= order.triggerValue) ||
                //     (order.mode === "sell" && currentMcap >= order.triggerValue);
                const triggered =
                    (order.mode === "buy" && currentMcap <= order.triggerMcap) ||
                    (order.mode === "sell" && currentMcap >= order.triggerMcap);

                if (!triggered) {
                    continue;
                }

                const user = await getUser(order.userId);
                // const wallet = user.wallets?.find(w => w.address?.toLowerCase() === order.walletAddress?.toLowerCase());
                // const wallet = user.wallets?.find(w => w.address?.toLowerCase() === order.address?.toLowerCase());
                let phrase;
                try {
                    const encrypted = wallet?.seedPhrase || wallet?.privateKey;
                    if (!encrypted) {
                        // console.warn(`⚠️ No encrypted value for wallet ${order.walletAddress}`);
                        // console.warn(`⚠️ No encrypted value for wallet ${address}`);
                        console.warn(`⚠️ No encrypted value for wallet ${address}, order: ${order.id}`);
                        continue;
                    }
                    const decrypted = decryptWallet(encrypted, ENCRYPTION_SECRET);
                    phrase = typeof decrypted === "string" ? decrypted : decrypted.privateKey || decrypted.seedPhrase;
                } catch (err) {
                    console.error('failed to decrypt wallet', err);
                }
                if (!phrase) {
                    // console.warn(`⚠️ Missing phrase for wallet ${order.walletAddress}`);
                    console.warn(`⚠️ Missing phrase for wallet ${address}`);
                    continue;
                }

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

                await markOrderAsCompleted(order.id);
                // const mcapFormatted = formatPrice(currentMcap);

                const shortWallet = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
                const txUrl = `https://suiscan.xyz/mainnet/tx/${tx.transactionDigest}`;
                const formatNum = (num) => (typeof num === "number" ? num.toFixed(5) : "0");

                let messageText;
                if (order.mode === "buy") {
                    messageText =
                        `${shortWallet} [Limit] ✅ Swapped ${formatNum(tx.spentSUI)} SUI ↔ ${formatNum(tx.tokenAmountReadable)} $${tx.tokenSymbol}\n` +
                        `🔗 <a href="${txUrl}">View Transaction Record on Explore</a>`;
                } else {
                    messageText =
                        `${shortWallet} [Limit] ✅ Swapped ${formatNum(tx.tokenAmountSold)} $${tx.tokenSymbol} ↔ ${formatNum(tx.suiAfterFee)} SUI\n` +
                        `🔗 <a href="${txUrl}">View Transaction Record on Explore</a>`;
                }

                await bot.telegram.sendMessage(order.userId, messageText, {
                    parse_mode: "HTML",
                    disable_web_page_preview: true
                });

            } catch (err) {
                console.error(`❌ Error processing order ${order.id}:`, err);
            }
        }
    } catch (error) {
        console.error("error in checking limit orders")
    } finally {
        checking = false;
    }
}