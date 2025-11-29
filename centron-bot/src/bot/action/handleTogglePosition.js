import { generatePnlCard } from "../../cards/pnlcard/sellPnl.js";
import { prisma } from "../../config/prisma.js";
import { decryptWallet } from "../../core/cryptoCore.js";
import { recordReferralEarning } from "../../core/referrals/referralSystem.js";
import { getPrismaUserAndWallet, saveOrUpdatePosition } from "../../services/positionService.js";
import { fetchUser, getUser, saveUserStep } from "../../services/userService.js";
import { buyTokenWithAftermath } from "../../transactions/aftermath/buyToken.js";
import { sellTokenWithAftermath } from "../../transactions/aftermath/sellToken.js";
import { shortAddress } from "../../utils/shortAddress.js";
import { toSmallestUnit } from "../../utils/suiAmount.js";
import { buildActionRows, buildFooterRows, buildTokenInlineRows } from "../ui/inlineKeyboards.js";
import { formatNumber } from "./handleAction.js";
import { handleViewPosition } from "./handleViewPosition.js";


export function removeUndefined(obj) {
    if (Array.isArray(obj)) return obj.map(removeUndefined);
    if (obj !== null && typeof obj === "object") {
        return Object.entries(obj).reduce((acc, [key, val]) => {
            if (val !== undefined) acc[key] = removeUndefined(val);
            return acc;
        }, {});
    }
    return obj;
}


async function safeEditMessage(ctx, text, options = {}) {
    try {
        await ctx.editMessageText(text, options);
    } catch (err) {
        if (err?.description?.includes("message is not modified")) {
            // ignore harmless Telegram error
            return;
        }
        throw err;
    }
}

export const handleToggleBuySell = async (ctx, action) => {
    const userId = ctx.from.id.toString();
    const index = action.replace("toggle_buy_sell_idx_", "");

    try {
        const user = await fetchUser(userId);
        const prevStep = user?.step || {};
        const walletKey = `wallet_${index}`;
        const walletMap = prevStep.walletMap || {};
        // const walletAddress = walletMap[walletKey];
        const address = walletMap[walletKey];

        // if (!walletAddress) return ctx.answerCbQuery("⚠️ Wallet address not found");
        if (!address) return ctx.answerCbQuery("⚠️ Wallet address not found");

        const currentMode = prevStep[`tradeMode_${index}`] || "buy";
        const newMode = currentMode === "buy" ? "sell" : "buy";

        // Reuse cached token data if available
        const positions = prevStep[`cachedPositions_${index}`] || [];

        if (!positions.length) return ctx.answerCbQuery("⚠ No cached tokens found. Please reload /positions.");

        // Validate or fallback selected token
        let selectedToken = prevStep[`selectedToken_${index}`];
        if (!selectedToken || !positions.some(p => (p.tokenAddress || p.coinType) === selectedToken)) {
            selectedToken = positions[0]?.tokenAddress || positions[0]?.coinType;
        }

        // Build keyboard
        const tokenMap = {};
        positions.forEach((pos, i) => {
            if (pos.tokenAddress || pos.coinType) {
                tokenMap[`token_${i}`] = pos.tokenAddress || pos.coinType;
            }
        });

        const updatedStep = {
            ...prevStep,
            [`tradeMode_${index}`]: newMode,
            [`selectedToken_${index}`]: selectedToken,
            [`tokenMap_${index}`]: tokenMap,
        };

        // Answer immediately
        ctx.answerCbQuery(`Switched to ${newMode.toUpperCase()} mode`);

        // Build UI fast using cached data
        const tokenRows = buildTokenInlineRows(positions, selectedToken, index);
        const actionButtons = buildActionRows(newMode, index);
        const footer = buildFooterRows(index);
        const inline_keyboard = [...tokenRows, ...actionButtons, ...footer];
        // Only update keyboard for speed
        await ctx.editMessageReplyMarkup({ inline_keyboard });

        // Save step async in background
        saveUserStep(userId, removeUndefined(updatedStep)).catch(console.error);

    } catch (error) {
        console.error("❌ Error in handleToggleBuySell:", error);
        return ctx.answerCbQuery("❌ Error switching mode");
    }
};


export const handleSelectToken = async (ctx, action) => {
    const userId = ctx.from.id.toString();
    const match = action.match(/^select_token_idx_(\d+)_(token_\d+)$/);

    if (!match) return ctx.answerCbQuery("⚠ Invalid token selection");

    const index = match[1];
    const tokenKey = match[2];

    try {
        const user = await fetchUser(userId);
        const step = user?.step || {};
        const tokenMap = step?.[`tokenMap_${index}`] || {};
        const walletKey = `wallet_${index}`;
        // const walletAddress = step.walletMap?.[walletKey];
        const address = step.walletMap?.[walletKey];

        // if (!walletAddress) return ctx.reply("⚠ Wallet address not found");
        if (!address) return ctx.reply("⚠ Wallet address not found");

        const tokenAddress = tokenMap[tokenKey];
        if (!tokenAddress) return ctx.answerCbQuery("⚠ Token address not found");

        const currentMode = step[`tradeMode_${index}`] || "buy";
        const positions = step[`cachedPositions_${index}`] || [];

        if (!positions.length) return ctx.answerCbQuery("⚠ No cached tokens found. Reload with /positions");

        // Reorder positions by saved order
        const orderedTokenAddrs = step?.[`orderedTokens_${index}`] || [];
        const orderedPositions = orderedTokenAddrs
            .map(addr => positions.find(p => (p.tokenAddress || p.coinType) === addr))
            .filter(Boolean);

        // Rebuild token map
        const newTokenMap = {};
        orderedPositions.forEach((pos, i) => {
            newTokenMap[`token_${i}`] = pos.tokenAddress || pos.coinType;
        });
        const updatedStep = {
            ...step,
            [`selectedToken_${index}`]: tokenAddress,
            buySlippage: step.buySlippage ?? 1,
            sellSlippage: step.sellSlippage ?? 1,
        };
        saveUserStep(userId, removeUndefined(updatedStep)).catch(console.error);
        const tokenRows = buildTokenInlineRows(orderedPositions, tokenAddress, index);
        const actionButtons = buildActionRows(currentMode, index);
        const footer = buildFooterRows(index);
        const inline_keyboard = [...tokenRows, ...actionButtons, ...footer];

        await ctx.editMessageReplyMarkup({ inline_keyboard });
        return ctx.answerCbQuery("✅ Token selected");

    } catch (error) {
        console.error("❌ Error in handleSelectToken:", error);
        return ctx.answerCbQuery("❌ Failed to select token");
    }
};


export const handleBuySellAmount = async (ctx, action) => {
    const userId = ctx.from.id.toString();
    const isBuy = action.startsWith("buy_amount_");
    const actionType = isBuy ? "buy" : "sell";
    const match = action.match(/(buy|sell)_amount_(\d+|custom)_idx_(\d+)/);
    if (!match) {
        console.warn("⚠ Invalid action format:", action);
        return ctx.answerCbQuery("Invalid action");
    }

    const amount = match[2];
    const index = match[3];

    const user = await fetchUser(userId);
    const step = user?.step || {};

    const selectedTokenKey = `selectedToken_${index}`;
    const selectedTokenAddress = step[selectedTokenKey];

    if (!selectedTokenAddress) {
        console.warn("⚠ No selected token found in step data");
        return ctx.answerCbQuery("⚠ Please select a token first");
    }

    const tokenMap = step[`tokenMap_${index}`] || {};

    const tokenKey = Object.entries(tokenMap).find(([_, val]) => val === selectedTokenAddress)?.[0];

    if (!tokenKey) {
        console.warn("⚠ Token key not found for selected address");
        return ctx.answerCbQuery("⚠ Token key not found");
    }

    const walletKey = `wallet_${index}`;
    // const walletAddress = step.walletMap?.[walletKey];
    const address = step.walletMap?.[walletKey];

    // if (!walletAddress) {
    if (!address) {
        console.warn("⚠ Wallet address not found in step data");
        return ctx.answerCbQuery("⚠ Wallet not found");
    }

    const positions = (step[`cachedPositions_${index}`] || []).map(p => ({
        ...p,
        tokenAddress: p.tokenAddress || p.coinType,
    }));

    const selectedToken = positions.find(
        pos =>
            pos.tokenAddress === selectedTokenAddress ||
            pos.coinType === selectedTokenAddress
    );

    // For sell, token must exist
    if (!selectedToken && !isBuy) {
        console.warn("⚠ Token not found in wallet positions during sell");
        return ctx.answerCbQuery("⚠ Selected token not found in wallet");
    }

    // Handle custom input
    if (amount === "custom") {
        let newState;
        let prompt;

        if (actionType === "buy") {
            newState = "awaiting_custom_buy_amount";
            prompt = "✍️ Enter the amount of SUI you want to use to BUY this token:";
        } else if (actionType === "sell") {
            newState = "awaiting_custom_sell_amount";
            prompt = "How much of your tokens would you like to sell?\n\nPlease reply with the percentage.";
        }

        const updatedStep = {
            ...step,
            state: newState,
            tokenAddress: selectedTokenAddress,
            currentIndex: index,
            mode: actionType,
            handlerType: "position"
        };
        await saveUserStep(userId, updatedStep);

        return ctx.reply(prompt, {
            reply_markup: { force_reply: true },
        });
    }

    const tokenSymbol =
        selectedToken?.symbol ||
        selectedToken?.metadata?.symbol ||
        selectedToken?.coinSymbol ||
        selectedToken?.coinType?.split("::")?.[2] ||
        "Unknown";

    let amountLine = "";
    if (isBuy) {
        amountLine = `${amount} SUI\n`;
    } else {
        amountLine = `${amount} %\n`;
    }

    const confirmationMessage =
        `${isBuy ? "💰" : "💸"} Confirm ${actionType.toUpperCase()}\n\n` +
        `Token: $${tokenSymbol}\n` +
        amountLine +
        `Action: ${actionType === "buy" ? "BUY" : "SELL"}\n\n` +
        `Do you want to proceed?`;

    const confirmKey = `confirm_${actionType}_${index}`;

    await saveUserStep(userId, {
        ...step,
        [confirmKey]: {
            tokenAddress: selectedTokenAddress, // full address
            amount,                              // string, e.g. "25"
        },
    });

    const confirmationKeyboard = {
        inline_keyboard: [
            [
                {
                    text: `✅ Confirm ${actionType.toUpperCase()}`,
                    // Use the short key as callback_data
                    callback_data: confirmKey,
                },
            ],
            [{ text: "❌ Cancel", callback_data: `view_pos_idx_${index}` }],
        ],
    };

    return safeEditMessage(ctx, confirmationMessage, {
        parse_mode: "HTML",
        reply_markup: confirmationKeyboard,
    });

};


// export const handleConfirmBuySell = async (ctx, action) => {
//     const userId = ctx.from.id;
//     const isBuy = action.startsWith("confirm_buy_");
//     const actionType = isBuy ? "buy" : "sell";

//     // Extract wallet index from action string
//     const parts = action.split("_");
//     const index = parts[2];

//     try {
//         // Fetch user data
//         const user = await getUser(userId);
//         const step = user?.step || {};

//         // Validate confirmation data exists
//         const confirmData = step[action];
//         if (!confirmData) {
//             return ctx.answerCbQuery("❌ Confirmation data missing or expired.");
//         }

//         const { tokenAddress, amount } = confirmData;

//         await ctx.answerCbQuery(`🔄 Executing ${actionType} order...`);

//         // Retrieve and validate wallet
//         const wallets = user.wallets || [];
//         const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
//         const walletKey = `wallet_${index}`;
//         const address = step.walletMap?.[walletKey];

//         const currentWallet = wallets.find(
//             w => (w.address || w.walletAddress)?.toLowerCase() === address?.toLowerCase()
//         );

//         if (!currentWallet) {
//             throw new Error("Wallet not found");
//         }

//         // Decrypt wallet credentials
//         let userPhrase;
//         try {
//             const encrypted = currentWallet.seedPhrase || currentWallet.privateKey;
//             if (!encrypted) {
//                 throw new Error("No encrypted credentials found");
//             }

//             const decrypted = decryptWallet(encrypted, ENCRYPTION_SECRET);

//             if (typeof decrypted === "string") {
//                 userPhrase = decrypted;
//             } else if (decrypted && typeof decrypted === "object") {
//                 userPhrase = decrypted.privateKey || decrypted.seedPhrase;
//             }

//             if (!userPhrase) {
//                 throw new Error("Failed to decrypt wallet credentials");
//             }
//         } catch (err) {
//             console.error("Wallet decryption error:", err);
//             throw new Error("Failed to access wallet credentials");
//         }

//         if (!userPhrase || !address) {
//             throw new Error("Wallet or recovery phrase is not set.");
//         }

//         // Get slippage settings with defaults
//         const buySlippage = step.buySlippage ?? 10;
//         const sellSlippage = step.sellSlippage ?? 10;

//         // Show processing message
//         await safeEditMessage(
//             ctx,
//             `⏳ Executing ${actionType} order for 1 wallet(s)...`
//         );

//         // Execute transaction with detailed parameter logging
//         let result;
//         if (isBuy) {
//             const suiAmount = toSmallestUnit(parseFloat(amount));
//             const buyParams = {
//                 tokenAddress,
//                 phrase: userPhrase,
//                 suiAmount,
//                 slippage: buySlippage
//             };

//             // console.log('Buy Parameters:', {
//             //     tokenAddress,
//             //     suiAmount,
//             //     slippage: buySlippage,
//             //     phraseLength: userPhrase?.length
//             // });

//             result = await buyTokenWithAftermath(buyParams);
//         } else {
//             const suiPercentage = parseInt(amount, 10);

//             // Get current position to determine token balance            
//             const sellParams = {
//                 tokenAddress,
//                 phrase: userPhrase,
//                 suiPercentage,
//                 slippage: sellSlippage,
//                 // Include any additional required parameters
//                 // walletAddress: address,
//             };

//             result = await sellTokenWithAftermath(sellParams);
//         }

//         if (!result) {
//             throw new Error(`No result returned from ${actionType} call`);
//         }

//         // Process successful transaction
//         if (isBuy) {
//             await handleBuySuccess(ctx, result, userId, address, currentWallet, index);
//         } else {
//             await handleSellSuccess(ctx, result, address, currentWallet, index);
//         }

//         // Auto-refresh positions after 3 seconds
//         setTimeout(() => {
//             ctx.callbackQuery.data = `view_pos_idx_${index}`;
//             handleViewPosition(ctx, ctx.callbackQuery.data);
//         }, 3000);

//     } catch (error) {
//         console.error(`${actionType} order failed:`, error);
//         console.error('Error stack:', error.stack);

//         await safeEditMessage(
//             ctx,
//             `❌ ${actionType.toUpperCase()} ORDER FAILED\n\n${error.message || error}\n\nPlease try again.`,
//             {
//                 reply_markup: {
//                     inline_keyboard: [
//                         [{ text: "🔄 Try Again", callback_data: `view_pos_idx_${index}` }],
//                         [{ text: "← Main Menu", callback_data: "back_to_menu" }],
//                     ],
//                 },
//             }
//         );
//     }
// };

// Handle successful buy transaction

export const handleConfirmBuySell = async (ctx, action) => {
    const userId = ctx.from.id;
    const isBuy = action.startsWith("confirm_buy_");
    const actionType = isBuy ? "buy" : "sell";

    // Extract wallet index
    const parts = action.split("_");
    const index = parts[2];

    try {
        const user = await getUser(userId);
        const step = user?.step || {};
        const confirmData = step[action];
        if (!confirmData) return ctx.answerCbQuery("❌ Confirmation data missing or expired.");

        const { tokenAddress, amount } = confirmData;
        await ctx.answerCbQuery(`🔄 Executing ${actionType} order...`);

        const wallets = user.wallets || [];
        const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
        const walletKey = `wallet_${index}`;
        const address = step.walletMap?.[walletKey];

        const currentWallet = wallets.find(
            w => (w.address || w.walletAddress)?.toLowerCase() === address?.toLowerCase()
        );

        if (!currentWallet) throw new Error("Wallet not found");

        // 🔐 Decrypt wallet
        let userPhrase;
        try {
            const encrypted = currentWallet.seedPhrase || currentWallet.privateKey;
            const decrypted = decryptWallet(encrypted, ENCRYPTION_SECRET);
            userPhrase = typeof decrypted === "string"
                ? decrypted
                : decrypted?.privateKey || decrypted?.seedPhrase;
            if (!userPhrase) throw new Error("Failed to decrypt wallet credentials");
        } catch (err) {
            console.error("Wallet decryption error:", err);
            throw new Error("Failed to access wallet credentials");
        }

        if (!userPhrase || !address) throw new Error("Wallet or recovery phrase missing.");

        const buySlippage = step.buySlippage ?? 10;
        const sellSlippage = step.sellSlippage ?? 10;

        await safeEditMessage(ctx, `⏳ Executing ${actionType} order for 1 wallet(s)...`);

        let result;
        if (isBuy) {
            const suiAmount = toSmallestUnit(parseFloat(amount));
            result = await buyTokenWithAftermath({
                tokenAddress,
                phrase: userPhrase,
                suiAmount,
                slippage: buySlippage,
            });
        } else {
            const suiPercentage = parseInt(amount, 10);
            result = await sellTokenWithAftermath({
                tokenAddress,
                phrase: userPhrase,
                suiPercentage,
                slippage: sellSlippage,
            });
        }

        if (!result) throw new Error(`No result returned from ${actionType} call`);

        if (isBuy) {
            await handleBuySuccess(ctx, result, userId, address, currentWallet, index);
        } else {
            await handleSellSuccess(ctx, result, userId, address, currentWallet, index, tokenAddress);
        }

        // Auto-refresh positions after 3 seconds
        setTimeout(() => {
            ctx.callbackQuery.data = `view_pos_idx_${index}`;
            handleViewPosition(ctx, ctx.callbackQuery.data);
        }, 3000);

    } catch (error) {
        console.error(`${actionType} order failed:`, error);
        await safeEditMessage(
            ctx,
            `❌ ${actionType.toUpperCase()} ORDER FAILED\n\n${error.message || error}\n\nPlease try again.`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🔄 Try Again", callback_data: `view_pos_idx_${index}` }],
                        [{ text: "← Main Menu", callback_data: "back_to_menu" }],
                    ],
                },
            }
        );
    }
};


async function handleBuySuccess(ctx, result, userId, address, wallet, index) {
    const decimals = result.decimals ?? 9;
    const humanAmount = result.tokenAmountReceived / (10 ** decimals);

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

    const walletLink = `https://suiscan.xyz/mainnet/account/${address}`;
    const txLink = `https://suiscan.xyz/mainnet/tx/${result.transactionDigest}`;
    const tokenAmountReadable = result.tokenAmountReceived / (10 ** decimals);

    const message =
        `<a href="${walletLink}">${wallet.name || shortAddress(address)}</a> ✅ ` +
        `Swapped ${formatNumber(result.spentSUI)} SUI ↔ ${formatNumber(tokenAmountReadable)} $${result.tokenSymbol}\n` +
        `🔗 <a href="${txLink}">View Transaction Record on Explorer</a>`;

    await safeEditMessage(ctx, message, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔄 Refresh Positions", callback_data: `view_pos_idx_${index}` }],
                [{ text: "← Main Menu", callback_data: "back_to_menu" }],
            ],
        },
    });
}

// Handle successful sell transaction
// async function handleSellSuccess(ctx, result, address, wallet, index) {
//     const decimals = result.decimals ?? 9;
//     const tokenAmountReadable = result.tokenAmountSold / (10 ** decimals);

//     const txLink = `https://suiscan.xyz/mainnet/tx/${result.transactionDigest}`;
//     const walletLink = `https://suiscan.xyz/mainnet/account/${address}`;

//     const message =
//         `<a href="${walletLink}">${wallet.name || shortAddress(address)}</a> ✅ ` +
//         `Swapped ${formatNumber(tokenAmountReadable)} $${result.tokenSymbol ?? "??"} ↔ ${formatNumber(result.actualSuiReceived ?? 0)} SUI\n` +
//         `🔗 <a href="${txLink}">View Transaction Record on Explorer</a>`;

//     await safeEditMessage(ctx, message, {
//         parse_mode: "HTML",
//         reply_markup: {
//             inline_keyboard: [
//                 [{ text: "🔄 Refresh Positions", callback_data: `view_pos_idx_${index}` }],
//                 [{ text: "← Main Menu", callback_data: "back_to_menu" }],
//             ],
//         },
//     });
// }

async function handleSellSuccess(ctx, result, userId, address, wallet, index, tokenAddress) {
    const userReferralCode = ctx.from?.username || String(userId);
    const decimals = result.decimals ?? 9;
    const tokenAmountReadable = result.tokenAmountSold / (10 ** decimals);
    const txLink = `https://suiscan.xyz/mainnet/tx/${result.transactionDigest}`;
    const walletLink = `https://suiscan.xyz/mainnet/account/${address}`;

    try {
        // 🧩 REFERRAL TRACKING (Same as handleBuySellOrder)
        try {
            const platformFee = result.feeAmount || result.feePaid || 0;
            const { user: prismaUser, wallet: prismaWallet } = await getPrismaUserAndWallet(userId, address);

            await recordReferralEarning({
                referredUserPrismaId: prismaUser.id,
                walletId: prismaWallet.id,
                tokenAddress,
                feeAmount: platformFee,
                transactionDigest: result.transactionDigest,
            });
        } catch (referralError) {
            console.error("⚠️ Failed to record referral earning:", referralError);
        }

        // 📈 PNL RECORD CREATION + IMAGE GENERATION
        try {
            const { user: prismaUser, wallet: prismaWallet } = await getPrismaUserAndWallet(userId, address);
            const position = await prisma.position.findFirst({
                where: { userId: prismaUser.id, walletId: prismaWallet.id, tokenAddress },
            });

            if (position) {
                const totalInvested = position.spentSUI || 0;
                const totalReceived = result.actualSuiReceived ?? 0;
                const profitLoss = totalReceived - totalInvested;
                const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

                await prisma.pNLRecord.create({
                    data: {
                        userId: prismaUser.id,
                        walletId: prismaWallet.id,
                        tokenAddress,
                        tokenSymbol: result.tokenSymbol,
                        tokenName: result.tokenSymbol || 'Unknown Token',
                        totalInvested,
                        totalReceived,
                        profitLoss,
                        profitLossPercent,
                        amountSold: tokenAmountReadable,
                        transactionDigest: result.transactionDigest,
                    },
                });

                const pnlImageBuffer = await generatePnlCard({
                    walletName: wallet.name || shortAddress(address),
                    walletAddress: address,
                    tokenSymbol: result.tokenSymbol,
                    totalInvested,
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
            }
        } catch (pnlError) {
            console.error("⚠️ Failed to process PNL:", pnlError);
        }
    } catch (error) {
        console.error("⚠️ Error during referral/PNL section:", error);
    }

    // ✅ Final confirmation message
    const message =
        `<a href="${walletLink}">${wallet.name || shortAddress(address)}</a> ✅ ` +
        `Swapped ${formatNumber(tokenAmountReadable)} ${result.tokenSymbol ?? "??"} ↔ ${formatNumber(result.actualSuiReceived ?? 0)} SUI\n` +
        `🔗 <a href="${txLink}">View Transaction Record on Explorer</a>`;

    await safeEditMessage(ctx, message, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "🔄 Refresh Positions", callback_data: `view_pos_idx_${index}` }],
                [{ text: "← Main Menu", callback_data: "back_to_menu" }],
            ],
        },
    });
}