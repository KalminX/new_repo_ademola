import crypto from "crypto";
import { generatePnlCard } from "../../cards/pnlcard/sellPnl.js";
import { prisma } from "../../config/prisma.js";
import { decryptWallet } from "../../core/cryptoCore.js";
import { recordReferralEarning } from "../../core/referrals/referralSystem.js";
import {
    saveUserStep,
    updateUserStep
} from "../../services/userService.js";
import { formatDurationPretty } from "../../utils/helper.js";
import { shortAddress } from "../../utils/shortAddress.js";
import { toSmallestUnit } from "../../utils/suiAmount.js";
import {
    getPrismaUserAndWallet,
    saveOrUpdatePosition
} from "../../services/positionService.js";
import { buyTokenWithAftermath } from "../../transactions/aftermath/buyToken.js";
import { sellTokenWithAftermath } from "../../transactions/aftermath/sellToken.js";
import { savePendingLimitOrder } from "../../services/orderService.js";
import { formatMarketCapValue } from "../../core/mcap/utils/formatMarketCap.js";
import { formatNumber, removeUndefined } from "../action/handleAction.js";


export async function handleCustomAmountInput(ctx, step, userId) {
    const userReferralCode = ctx.from?.username || String(userId);
    const amount = parseFloat(ctx.message.text);
    const address = step.currentWallet;
    const handlerType = step.handlerType || 'original';

    if (isNaN(amount) || amount <= 0) {
        return ctx.reply("❌ Please enter a valid amount greater than 0.");
    }

    // Limit Order Handler
    if (step.orderMode === "limit") {
        const mode = step.state === 'awaiting_custom_buy_amount' ? 'buy' : 'sell';
        const tokenAddress = step.tokenAddress;
        const triggerValue = step.limitTriggerValue;

        if (!tokenAddress || !triggerValue) {
            return ctx.reply("❌ Missing token or trigger value for limit order.");
        }

        const suiAmount = mode === 'buy' ? toSmallestUnit(amount) : null;
        const suiPercentage = mode === 'sell' ? parseInt(amount, 10) : null;

        await savePendingLimitOrder({
            userId,
            address,
            tokenAddress,
            mode,
            suiAmount,
            suiPercentage,
            triggerMcap: triggerValue,
            slippage: mode === "buy" ? step.buySlippage : step.sellSlippage,
        });

        await saveUserStep(userId, {
            ...step,
            state: null,
            currentFlow: null,
            orderMode: null,
            limitTriggerValue: null,
        });

        return ctx.reply(`✅ Limit ${mode} order saved for <b>${amount}${mode === "buy" ? " SUI" : "%"}</b> and will trigger at <b>$${formatMarketCapValue(triggerValue)}</b> market cap.`, {
            parse_mode: "HTML"
        });
    }

    if (step.orderMode === "dca") {
        const mode = step.state === "awaiting_custom_buy_amount" ? "buy" : "sell";
        const tokenAddress = step.tokenAddress;

        const suiAmount = mode === "buy" ? toSmallestUnit(amount) : null;
        const suiPercentage = mode === "sell" ? Math.floor(amount, 10) : null;

        const amountReadable = suiAmount
            ? `${suiAmount / 1e9} SUI`
            : `${step.dcaAmount}%`;

        const selectedWallets = (step.selectedWallets || []).map(k => {
            const wallet = step.walletMap?.[k];

            if (wallet && typeof wallet === "object") return wallet;

            if (typeof wallet === "string") {
                return {
                    address: wallet,
                    name: wallet.slice(0, 6) + "..." + wallet.slice(-4),
                    key: k,
                };
            }

            return null;
        }).filter(Boolean);

        const walletList = selectedWallets
            .map(w => {
                const label = w.name || shortAddress(w.address);
                return `💳 <a href="https://suiexplorer.com/address/${w.address || w.walletAddress}?network=mainnet" target="_blank">${label}</a>`;
            })
            .join("\n");

        const confirmationMessage =
            `You are about to submit a DCA order with following configuration:\n\n` +
            `<b>${mode.toUpperCase()} a total of ${amountReadable}</b> ` +
            `worth of $${step.tokenInfo?.symbol ?? "??"} through multiple payments ` +
            `with <b>interval ${formatDurationPretty(step.dcaInterval)}</b> for a <b>period of ${formatDurationPretty(step.dcaDuration)}</b>\n\n` +
            `Selected wallets:\n${walletList}`;

        const confirmId = crypto.randomBytes(6).toString("hex");
        const confirmKey = `confirm_dca_${confirmId}`;

        const confirmationData = {
            mode,
            tokenAddress,
            suiAmount,
            suiPercentage,
            intervalMinutes: step.dcaIntervalMinutes,
            durationMinutes: step.dcaDurationMinutes,
            times: step.times ?? 0,
            slippage: mode === "buy" ? step.buySlippage : step.sellSlippage,
            addresses: selectedWallets.map(w => w.address),
        };

        await saveUserStep(userId, {
            ...step,
            dcaConfirmations: {
                ...(step.dcaConfirmations || {}),
                [confirmId]: confirmationData,
            },
        });

        const confirmationKeyboard = {
            inline_keyboard: [
                [
                    { text: "← Back", callback_data: "nool" },
                    { text: "✅ Confirm", callback_data: confirmKey },
                ]
            ]
        };

        return ctx.reply(confirmationMessage, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: confirmationKeyboard
        });
    }

    // Market Order Handler
    if (handlerType === 'original') {
        const mode = step.state === 'awaiting_custom_buy_amount' ? 'buy' : 'sell';
        const tokenAddress = step.tokenAddress;
        const suiAmount = mode === 'buy' ? toSmallestUnit(amount) : null;
        const suiPercentage = mode === 'sell' ? Math.floor(amount, 10) : null;

        const selectedWallets = (step.selectedWallets || []).map(k => step.walletMap?.[k]).filter(Boolean);
        if (!selectedWallets.length) return ctx.reply("❌ No wallet selected.");

        await ctx.reply(`⏳ Executing ${mode} order for ${selectedWallets.length} wallet(s)...`);
        const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
        const results = [];

        for (const wallet of selectedWallets) {
            const address = wallet.address || wallet.walletAddress;
            let phrase;
            try {
                const encrypted = wallet.seedPhrase || wallet.privateKey;
                const decrypted = decryptWallet(encrypted, ENCRYPTION_SECRET);
                if (typeof decrypted === "string") {
                    phrase = decrypted;
                } else if (decrypted && typeof decrypted === "object") {
                    phrase = decrypted.privateKey || decrypted.seedPhrase;
                }
                if (!phrase) throw new Error("Missing decrypted phrase or key.");
            } catch (err) {
                results.push(`❌ ${wallet.name || shortAddress(wallet.address)}: Failed to decrypt wallet.`);
                continue;
            }

            try {
                const result = mode === 'buy'
                    ? await buyTokenWithAftermath({ tokenAddress, phrase, suiAmount, slippage: step.buySlippage })
                    : await sellTokenWithAftermath({ tokenAddress, phrase, suiPercentage, slippage: step.sellSlippage });

                if (!result) throw new Error("No result returned");

                const decimals = result.decimals ?? 9;

                // 🟢 BUY handling (NO REFERRAL TRACKING)
                if (mode === 'buy') {
                    const rawAmount = result.tokenAmountReceived;
                    const humanAmount = rawAmount / (10 ** decimals);

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
                    const tokenAmountReadable = Number(result.tokenAmountSold) / 1e9;

                    results.push(
                        `<a href="${walletLink}">${wallet.name || shortAddress(address)}</a> ✅ Swapped ${formatNumber(result.spentSUI)} SUI ↔ ${formatNumber(result.tokenAmountReadable)} $${result.tokenSymbol}\n🔗 <a href="${txLink}">View Transaction Record on Explorer</a>`
                    );
                }
                // 🔴 SELL handling (WITH REFERRAL TRACKING & PNL CARD)
                else {
                    const tokenAmountReadable = Number(result.tokenAmountSold) / (10 ** decimals);
                    const txLink = `https://suiscan.xyz/mainnet/tx/${result.transactionDigest}`;
                    const walletLink = `https://suiscan.xyz/mainnet/account/${address}`;

                    // 🎯 Referral Tracking (ONLY ON SELL)
                    try {
                        // const PLATFORM_FEE_PERCENT = 0.01; // 1%
                        // const platformFee = (result.actualSuiReceived ?? 0) * PLATFORM_FEE_PERCENT;
                        const platformFee = result.feeAmount || result.feePaid || 0;

                        const { user: prismaUser, wallet: prismaWallet } = await getPrismaUserAndWallet(userId, address);

                        await recordReferralEarning({
                            referredUserPrismaId: prismaUser.id,
                            walletId: prismaWallet.id,
                            tokenAddress: step.tokenAddress,
                            feeAmount: platformFee,
                            transactionDigest: result.transactionDigest,
                        });

                        // console.log(`✅ Referral earning recorded (custom sell): ${platformFee.toFixed(6)} SUI from user ${userId}`);
                    } catch (referralError) {
                        console.error("⚠️ Failed to record referral earning:", referralError);
                    }

                    // 📊 PNL Record & Card Generation
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
                                    // referralCode,
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
                        `<a href="${walletLink}">${wallet.name || shortAddress(address)}</a> ✅ Swapped ${formatNumber(tokenAmountReadable)} $${result.tokenSymbol ?? "??"} ↔ ${formatNumber(result.actualSuiReceived ?? 0)} SUI\n🔗 <a href="${txLink}">View Transaction Record on Explorer</a>`
                    );
                }
            } catch (error) {
                results.push(`❌ ${wallet.name || shortAddress(address)}: ${error.message || error}`);
            }
        }

        await saveUserStep(userId, {
            ...step,
            state: null,
            currentFlow: null,
            orderMode: null,
            handlerType: null,
        });

        return ctx.reply(results.join("\n\n"), { parse_mode: "HTML" });
    }

    // Position-based Confirm Flow
    else if (handlerType === 'position') {
        const index = step.currentIndex;
        const mode = step.mode;
        const tokenAddress = step.tokenAddress;

        const positions = step.positions || [];
        const pos = positions[index];

        const tokenSymbol =
            pos?.symbol ||
            step.tokenInfo?.symbol ||
            (tokenAddress ? tokenAddress.split("::").pop() : "Unknown");

        const updatedStep = {
            ...step,
            state: null,
            currentIndex: null,
            mode: null,
            handlerType: null
        };
        await updateUserStep(userId, updatedStep);

        let amountLine = "";
        if (mode === "buy") {
            amountLine = `${amount} SUI\n`;
        } else {
            amountLine = `Percentage: ${amount}%\n`;
        }

        const confirmationMessage =
            `${mode === 'buy' ? '💰' : '💸'} Confirm ${mode.toUpperCase()}\n\n` +
            `Token: $${tokenSymbol}\n` +
            amountLine +
            `Action: ${mode.toUpperCase()}\n\n` +
            `Do you want to proceed?`;

        const confirmKey = `confirm_${mode}_${index}`;
        await saveUserStep(userId, {
            ...updatedStep,
            buySlippage: step.buySlippage ?? 1,
            sellSlippage: step.sellSlippage ?? 1,
            [confirmKey]: {
                amount,
                tokenAddress
            }
        });

        const confirmationKeyboard = {
            inline_keyboard: [
                [
                    {
                        text: `✅ Confirm`,
                        callback_data: confirmKey
                    },
                    {
                        text: "❌ Cancel",
                        callback_data: `view_pos_idx_${index}`
                    }
                ]
            ]
        };

        return ctx.reply(confirmationMessage, {
            parse_mode: "HTML",
            reply_markup: confirmationKeyboard
        });
    }
}
