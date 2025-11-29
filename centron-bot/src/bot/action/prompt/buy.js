import { generatePnlCard } from "../../../cards/pnlcard/sellPnl.js";
import { prisma } from "../../../config/prisma.js";
import { decryptWallet } from "../../../core/cryptoCore.js";
import { showDcaConfirmation } from "../../../core/dca/dcaOrder.js";
import { formatMarketCapValue } from "../../../core/mcap/utils/formatMarketCap.js";
import { recordReferralEarning } from "../../../core/referrals/referralSystem.js";
import { getFallbackTokenDetails } from "../../../core/utils/getTokenDetails.js";
import { savePendingLimitOrder } from "../../../services/orderService.js";
import {
    getPositionForToken,
    getPrismaUserAndWallet, saveOrUpdatePosition,
    savePNLRecord
} from "../../../services/positionService.js";
import { fetchUserStep, getUser, saveUserStep } from "../../../services/userService.js";
import { buyTokenWithAftermath } from "../../../transactions/aftermath/buyToken.js";
import { sellTokenWithAftermath } from "../../../transactions/aftermath/sellToken.js";
import { shortAddress } from "../../../utils/shortAddress.js";
import { toSmallestUnit } from "../../../utils/suiAmount.js";
import { formatNumber } from "../handleAction.js";

export async function handleBuySellOrder(ctx, action) {
    const userId = ctx.from.id;
    const userReferralCode = ctx.from?.username || String(userId);
    // Prevent Telegram "query too old" error
    try {
        await ctx.answerCbQuery(); // Immediately acknowledge the callback to avoid expiration
    } catch (err) {
        console.warn("⚠️ Early answerCbQuery failed:", err.message);
    }

    const [baseAction, contextType] = action.split(":");
    const [mode, amountStr] = baseAction.split("_");

    const isLimitOrder = contextType === "limit";
    const isMarketOrder = contextType === "market";
    const isDcaOrder = contextType === "dca";

    const step = await fetchUserStep(userId);
    if (!step) {
        console.warn("❌ No step found for user.");
        return ctx.reply("❌ Session expired. Please start again.");
    }

    const user = await getUser(userId);
    const wallets = user.wallets || [];

    if (!step.tokenAddress) {
        console.warn("❌ No token selected.");
        return ctx.reply("❌ No token selected. Please enter a token address first.");
    }

    const selectedWallets = (step.selectedWallets || []).map(k => step.walletMap?.[k]).filter(Boolean);
    if (selectedWallets.length === 0) {
        console.warn("❌ No wallet selected.");
        return ctx.reply("❌ No wallet selected.");
    }

    // Handle custom amount input
    if (amountStr === "x") {
        const newState = mode === "buy" ? "awaiting_custom_buy_amount" : "awaiting_custom_sell_amount";
        const orderMode = isLimitOrder ? "limit" : isDcaOrder ? "dca" : "market";

        await saveUserStep(userId, { ...step, state: newState, orderMode });
        return ctx.reply(
            mode === "buy"
                ? `How much SUI would you like to use for the token purchase?\n\nPlease reply with the amount.`
                : `How much of your tokens would you like to sell?\n\nPlease reply with the percentage.`,
            { parse_mode: "Markdown", reply_markup: { force_reply: true } }
        );
    }

    const parsedAmount = parseFloat(amountStr);
    const suiAmount = !isNaN(parsedAmount) && parsedAmount > 0 ? toSmallestUnit(parsedAmount) : null;
    const suiPercentage = parseInt(amountStr, 10);
    const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
    const results = [];

    await ctx.reply(`⏳ Executing ${mode} order for ${selectedWallets.length} wallet(s)...`);

    for (const wallet of selectedWallets) {
        const address = wallet.address || wallet.walletAddress;

        let phrase;
        try {
            const encrypted = wallet.seedPhrase || wallet.privateKey;
            const decrypted = decryptWallet(encrypted, ENCRYPTION_SECRET);
            phrase = typeof decrypted === "string"
                ? decrypted
                : decrypted?.privateKey || decrypted?.seedPhrase;
            if (!phrase) throw new Error("Missing decrypted phrase/key.");
        } catch (err) {
            console.error("❌ Wallet decryption failed:", err.message);
            results.push(`❌ ${wallet.name || shortAddress(address)}: Failed to decrypt wallet.`);
            continue;
        }

        try {
            if (isLimitOrder) {
                if (!step.limitTriggerValue) {
                    results.push(`❌ ${wallet.name || shortAddress(address)}: Missing trigger value.`);
                    continue;
                }

                await savePendingLimitOrder({
                    userId,
                    address,
                    tokenAddress: step.tokenAddress,
                    mode,
                    suiAmount,
                    suiPercentage,
                    triggerMcap: step.limitTriggerValue,
                    slippage: mode === "buy" ? step.buySlippage : step.sellSlippage,
                });

                const formattedTrigger = formatMarketCapValue(step.limitTriggerValue);
                results.push(`✅ Limit ${mode} order saved for <b>${amountStr}${mode === "buy" ? " SUI" : "%"}</b> and will trigger at <b>$${formattedTrigger}</b> market cap.`);
                continue;
            }

            if (isDcaOrder) {
                if (!step.dcaDuration || !step.dcaInterval) {
                    results.push(`❌ ${wallet.name || shortAddress(address)}: Missing DCA duration or interval.`);
                    continue;
                }
                const updatedStep = {
                    ...step,
                    pendingOrder: { mode, suiAmount, suiPercentage, type: "dca" },
                    state: "awaiting_dca_confirmation",
                };
                await saveUserStep(userId, updatedStep);
                return showDcaConfirmation(ctx, userId, updatedStep, { mode, suiAmount });
            }

            // 🎯 Market order handling
            const result = mode === "buy"
                ? await buyTokenWithAftermath({ tokenAddress: step.tokenAddress, phrase, suiAmount, slippage: step.buySlippage })
                : await sellTokenWithAftermath({ tokenAddress: step.tokenAddress, phrase, suiPercentage, slippage: step.sellSlippage });

            if (!result) throw new Error("No result returned.");

            const decimals = result.decimals ?? 9;

            // 🟢 BUY handling (NO REFERRAL TRACKING)
            if (mode === "buy") {
                const humanAmount = result.tokenAmountReceived / (10 ** decimals);

                const tokenInfo = await getFallbackTokenDetails(result.tokenAddress, address);
                await saveOrUpdatePosition(userId, address, {
                    tokenAddress: result.tokenAddress,
                    symbol: result.tokenSymbol,
                    tokenName: result.tokenName ?? result.tokenSymbol,
                    decimals,
                    amountBought: humanAmount,
                    humanAmount,
                    balance: humanAmount,
                    averageEntry: result.spentSUI / humanAmount,
                    marketCap: result.marketCap ?? 0,
                    amountInSUI: result.spentSUI,
                    spentSUI: result.spentSUI,
                    lastBuySUI: result.spentSUI,
                    lastBuyAmount: humanAmount,
                });

                const txLink = `https://suiscan.xyz/mainnet/tx/${result.transactionDigest}`;
                const walletLink = `https://suiscan.xyz/mainnet/account/${address}`;

                results.push(
                    `<a href="${walletLink}">${wallet.name || shortAddress(address)}</a> ✅ Swapped ${formatNumber(result.spentSUI)} SUI ↔ ${formatNumber(result.tokenAmountReadable)} $${result.tokenSymbol}\n🔗 <a href="${txLink}">View Transaction</a>`
                );
            }

            // 🔴 SELL handling (WITH REFERRAL TRACKING)
            else {
                const tokenAmountReadable = Number(result.tokenAmountSold) / (10 ** decimals);

                const txLink = `https://suiscan.xyz/mainnet/tx/${result.transactionDigest}`;
                const walletLink = `https://suiscan.xyz/mainnet/account/${address}`;

                // 🎯 Referral Tracking (ONLY ON SELL)
                try {
                    const platformFee = result.feeAmount || result.feePaid || 0;

                    const { user: prismaUser, wallet: prismaWallet } = await getPrismaUserAndWallet(userId, address);

                    await recordReferralEarning({
                        referredUserPrismaId: prismaUser.id,
                        walletId: prismaWallet.id,
                        tokenAddress: step.tokenAddress,
                        feeAmount: platformFee,
                        transactionDigest: result.transactionDigest,
                    });

                } catch (referralError) {
                    console.error("⚠️ Failed to record referral earning:", referralError);
                }

                // PNL Record
                try {
                    const { user: prismaUser, wallet: prismaWallet } = await getPrismaUserAndWallet(userId, address);
                    const position = await prisma.position.findFirst({
                        where: { userId: prismaUser.id, walletId: prismaWallet.id, tokenAddress: step.tokenAddress }
                    });

                    if (position) {
                        const totalInvested = position.spentSUI || 0;
                        const totalHeld = position.balance || 0;
                        const amountSold = tokenAmountReadable;

                        // Proportional investment based on sold amount
                        const investedPortion = totalHeld > 0 ? (amountSold / totalHeld) * totalInvested : totalInvested;

                        const totalReceived = result.actualSuiReceived ?? 0;
                        const profitLoss = totalReceived - investedPortion;
                        const profitLossPercent = investedPortion > 0 ? (profitLoss / investedPortion) * 100 : 0;

                        // Calculate remaining position after sell
                        const remainingBalance = totalHeld - amountSold;
                        const remainingInvestment = totalInvested - investedPortion;

                        // Save PnL Record
                        try {
                            const record = await prisma.pNLRecord.create({
                                data: {
                                    userId: prismaUser.id,
                                    walletId: prismaWallet.id,
                                    tokenAddress: step.tokenAddress,
                                    tokenSymbol: result.tokenSymbol,
                                    tokenName: result.tokenSymbol || "Unknown Token",
                                    totalInvested: investedPortion, // This should be investedPortion, not totalInvested
                                    totalReceived,
                                    profitLoss,
                                    profitLossPercent,
                                    amountSold: tokenAmountReadable,
                                    transactionDigest: result.transactionDigest,
                                },
                            });
                        } catch (err) {
                            console.error("❌ Failed to create PnL record:", err);
                        }

                        // Update or delete position
                        try {
                            if (remainingBalance <= 0.000001) { // Account for floating point errors
                                await prisma.position.delete({
                                    where: { id: position.id }
                                });
                            } else {
                                await prisma.position.update({
                                    where: { id: position.id },
                                    data: {
                                        balance: remainingBalance,
                                        spentSUI: remainingInvestment,
                                    }
                                });
                            }
                        } catch (err) {
                            console.error("❌ Failed to update position:", err);
                        }

                        // Generate PnL Card
                        try {
                            let referralCode = "CENTRON";

                            try {
                                const { user: pnlUser } = await getPrismaUserAndWallet(userId, address);

                                if (pnlUser?.referralCode) {
                                    referralCode = pnlUser.referralCode;
                                } else {
                                    console.log("⚠️ No referral code found in database. Using default:", referralCode);
                                }

                            } catch (err) {
                                console.warn("⚠️ Could not fetch referral code, using default. Error:", err.message);
                            }

                            const pnlImageBuffer = await generatePnlCard({
                                walletName: wallet.name || shortAddress(address),
                                walletAddress: address,
                                tokenSymbol: result.tokenSymbol,
                                totalInvested: investedPortion, // Use investedPortion here too
                                totalReceived,
                                profitLoss,
                                profitLossPercent,
                                amountSold: tokenAmountReadable,
                                txLink,
                                referralCode: userReferralCode,
                            });

                            await ctx.replyWithPhoto({ source: pnlImageBuffer }, {
                                caption: `💰 Sell Summary for ${result.tokenSymbol}`,
                            });

                        } catch (err) {
                            console.error("❌ Failed to generate or send PnL image:", err);
                        }
                    }

                } catch (pnlError) {
                    console.error("⚠️ Failed to process PNL:", pnlError);
                }

                results.push(
                    `<a href="${walletLink}">${wallet.name || shortAddress(address)}</a> ✅ Swapped ${formatNumber(tokenAmountReadable)} ${result.tokenSymbol} ↔ ${formatNumber(result.actualSuiReceived ?? 0)} SUI\n🔗 <a href="${txLink}">View Transaction</a>`
                );
            }
        } catch (err) {
            console.error(`❌ Error for wallet ${wallet.name || shortAddress(address)}:`, err);
            results.push(`❌ ${wallet.name || shortAddress(address)}: ${err.message || "Unknown error"}`);
        }
    }

    await saveUserStep(userId, { ...step, state: null, orderMode: null });
    await ctx.reply(results.join("\n\n"), { parse_mode: "HTML" });
}