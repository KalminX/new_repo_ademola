import { generatePnlCard } from "../../cards/pnlcard/pnlCard.js";
import { getSuiUsdPrice } from "../../core/utils/getTokenDetails.js";
import { fetchUser } from "../../services/userService.js";


export const handleViewPnL = async (ctx, index) => {
    const userId = ctx.from.id.toString();
    const userReferralCode = ctx.from?.username || String(userId);
    const user = await fetchUser(userId);
    const step = user?.step || {};
    const walletKey = `wallet_${index}`;
    const walletAddress = step.walletMap?.[walletKey];

    if (!walletAddress) {
        return ctx.reply("⚠ Wallet not found.");
    }

    const cached = step[`cachedPositions_${index}`];
    if (!Array.isArray(cached) || cached.length === 0) {
        return ctx.reply("⚠ No cached token data. Please /positions first.");
    }

    const suiUsdPrice = await getSuiUsdPrice(walletAddress).then(p => p || 0);

    const usePlaceholder = true;

    let totalPnlUsd = 0;
    let bestToken;

    // 🟩 placeholder check mode

    // if (usePlaceholder) {
    //     // fake token data
    //     bestToken = {
    //         token: "CULT",
    //         pnlPercent: 42.5,
    //         pnlUsd: 123.45,
    //         invested: 290,
    //         sold: 413.45,
    //     };
    //     totalPnlUsd = bestToken.pnlUsd;
    // } else {
    //     // your existing logic here (real positions, wallets, etc.)
    // }

    for (const pos of cached) {
        const { tokenInfo, readableBalance, valueUSD = 0, avgEntryUsd } = pos;

        // Log the raw position
        // console.log("🔎 Raw Position:", pos);

        if (!avgEntryUsd || !tokenInfo || !readableBalance) {
            // console.log("⏭️ Skipped due to missing data:", {
            //     avgEntryUsd,
            //     tokenInfo,
            //     readableBalance,
            // });
            continue;
        }

        const currentValue = Number(valueUSD);
        const entryValue = Number(avgEntryUsd) * Number(readableBalance);
        const pnl = currentValue - entryValue;
        const pnlPercent = entryValue > 0 ? (pnl / entryValue) * 100 : 0;

        // console.log("📊 Calculated Values:", {
        //     symbol: tokenInfo?.symbol,
        //     readableBalance,
        //     avgEntryUsd,
        //     valueUSD,
        //     currentValue,
        //     entryValue,
        //     pnl,
        //     pnlPercent,
        // });

        totalPnlUsd += pnl;

        if (!bestToken) {
            bestToken = {
                token: tokenInfo.symbol,
                pnlPercent,
                pnlUsd: pnl,
                invested: entryValue,
                sold: currentValue,
            };
        }
    }


    if (!bestToken) {
        return ctx.reply("⚠ No valid PnL data.");
    }

    const dataForCard = {
        tokenSymbol: bestToken.token || "TOKEN",
        profitLoss: bestToken.pnlUsd || 0,
        profitLossPercent: bestToken.pnlPercent || 0,
        totalInvested: bestToken.invested || 0,
        totalReceived: bestToken.sold || 0,
        referralCode: userReferralCode || user?.referralCode || "CENTRON",
        // referralCode: user?.referralCode || "CENTRON",
        txLink: bestToken?.txLink || `https://centron.io/ref/${userId}`, // optional
    };

    const buffer = await generatePnlCard(dataForCard);
    return ctx.replyWithPhoto(
        { source: buffer },
        {
            caption: `<b>${bestToken.token} PnL Card</b>\n\nTotal PnL: ${totalPnlUsd >= 0 ? "🟩" : "🟥"
                } $${totalPnlUsd.toFixed(2)}`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "⏱ Duration", callback_data: `pnl_duration_${index}` },
                        { text: "🔄 Regenerate", callback_data: `pnl_regen_${index}` },
                    ],
                    [
                        { text: "❌ Close", callback_data: `pnl_close_${index}` }
                    ]
                ]
            }
        }
    );
};

// [{ text: "← Back to positions", callback_data: `view_pos_idx_${index}` }]