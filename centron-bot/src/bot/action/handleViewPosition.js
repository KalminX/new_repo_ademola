import { formatPositionSummary } from "../../core/formatters/positionFormatter.js";
import { getSuiUsdPrice } from "../../core/utils/getTokenDetails.js";
import { getBalance } from "../../services/balanceService.js";
import { fetchUser, saveUserStep } from "../../services/userService.js";
import { getTokenPositions } from "../handlers/positions/showWalletsForPositions.js";
import { buildActionRows, buildTokenInlineRows } from "../ui/inlineKeyboards.js";


function escapeHtml(unsafe) {
    if (typeof unsafe !== "string") return "";
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


export const handleViewPosition = async (ctx, action) => {
    const userId = ctx.from.id.toString();
    const index = action.replace("view_pos_idx_", "");
    const walletKey = `wallet_${index}`;

    try {
        // Show loading message immediately
        await ctx.editMessageText("⏳ Loading positions...", {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: [] }
        });

        const user = await fetchUser(userId);
        const step = user?.step || {};
        const walletMap = step.walletMap || {};
        const address = walletMap[walletKey];

        if (!address) {
            console.warn(`[handleViewPosition] Wallet address not found for key`);
            return showWalletsForPositions(ctx, userId);
        }

        const wallets = user.wallets || [];
        const walletObj = wallets.find(
            (w) => (w.address || w.walletAddress) === address
        );

        const [suiUsdPriceRaw, suiBalanceResult] = await Promise.all([
            getSuiUsdPrice(address),
            getBalance(address)
        ]);

        const suiUsdPrice = suiUsdPriceRaw || 0;
        const suiBalance = suiBalanceResult?.sui || 0;
        const suiBalanceUssd = suiBalanceResult?.usd || 0;

        const tokenPositions = await getTokenPositions(userId, address, suiUsdPrice);
        if (!Array.isArray(tokenPositions)) {
            console.error("[handleViewPosition] getTokenPositions returned non-array");
            return ctx.reply("⚠️ Failed to load token positions.");
        }

        const positions = tokenPositions.filter(t => t.symbol !== "SUI");
        if (!positions.length) {
            const displayAddress = address.slice(0, 6) + "..." + address.slice(-4);
            const label = walletObj?.name || displayAddress;
            const labelSafe = escapeHtml(label);
            const explorerUrl = `https://suivision.xyz/account/${address}`;
            const labelLink = `<a href="${explorerUrl}">${labelSafe}</a>`;

            return ctx.editMessageText(`${labelLink} You do not have any token positions.`, {
                parse_mode: "HTML",
                disable_web_page_preview: true,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "← Choose another wallet", callback_data: "back_to_positions_wallets" }]
                    ]
                }
            });
        }

        const shortTokenMap = {};
        const orderedTokenAddrs = [];

        let message = `💳 Wallet balance: <b>${suiBalance.toFixed(3)} SUI ($${suiBalanceUssd.toFixed(2)})</b>\n\n`;

        for (let i = 0; i < positions.length; i++) {
            const p = positions[i];
            const tokenAddr = p.tokenAddress || p.coinType;
            shortTokenMap[`token_${i}`] = tokenAddr;
            orderedTokenAddrs.push(tokenAddr);

            // Build position summary + PnL
            message += await formatPositionSummary(
                p,
                p.tokenInfo,
                p.readableBalance,
                suiUsdPrice
            );

            // Add separator except after last token
            if (i < positions.length - 1) {
                message += "\n";
            }

        }
        const totalSUI = positions.reduce((sum, p) => sum + (p.valueSUI || 0), 0);
        const totalUSD = positions.reduce((sum, p) => sum + (p.valueUSD || 0), 0);
        message = `📈 Positions: <b>${totalSUI.toFixed(2)} SUI ($${totalUSD.toFixed(2)})</b>\n\n` + message;

        // Fallback token selection
        let selectedTokenAddress = step[`selectedToken_${index}`];
        if (!positions.some(p => (p.tokenAddress || p.coinType) === selectedTokenAddress)) {
            selectedTokenAddress = orderedTokenAddrs[0];
        }

        // Cache step update
        const updatedStep = {
            ...step,
            walletMap,
            [`tokenMap_${index}`]: shortTokenMap,
            [`selectedToken_${index}`]: selectedTokenAddress,
            [`orderedTokens_${index}`]: orderedTokenAddrs,
            [`cachedPositions_${index}`]: positions,
        };
        await saveUserStep(userId, updatedStep);

        // Build keyboard
        const currentMode = step[`tradeMode_${index}`] || "buy";
        const tokenRows = buildTokenInlineRows(positions, selectedTokenAddress, index);
        const actionButtons = buildActionRows(currentMode, index);
        const footer = [
            [
                { text: "← Back", callback_data: "back_to_positions_wallets" },
                { text: "🔄 Refresh", callback_data: `refresh_position_idx_${index}` },
            ]
        ];

        try {
            return await ctx.editMessageText(message, {
                parse_mode: "HTML",
                disable_web_page_preview: true,
                reply_markup: { inline_keyboard: [...tokenRows, ...actionButtons, ...footer] }
            });
        } catch (error) {
            // Ignore "message not modified" errors
            if (error.description?.includes('message is not modified')) {
                return;
            }
            throw error; // Re-throw other errors
        }
    } catch (error) {
        console.error(`[handleViewPosition] Unexpected error:`, error);
        return ctx.reply("⚠️ Failed to load wallet positions. Please try again.");
    }
};