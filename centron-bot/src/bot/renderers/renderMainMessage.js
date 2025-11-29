import { formatWalletBalanceRow } from "../../core/formatters/walletFormatter.js";
import { formatTinyPrice, formatBigNumber, 
    getCoinBalance, withTimeout } from "../../core/utils/getTokenDetails.js";
import { getBalance } from "../../services/balanceService.js";
import { fetchUserStep, saveUserStep } from "../../services/userService.js";
import { buildWalletMap, normalizeWallets } from "../../services/wallets/walletUtils.js";
import { buildFullKeyboard } from "../keyboards/fullKeyboard.js";

export async function renderMainMessage(ctx, userId) {
    let step = await fetchUserStep(userId);
    if (!step) return;

    step.selectedWallets = (step.selectedWallets || []).filter(k => typeof k === "string" && k.startsWith("w"));
    const { selectedWallets = [], wallets = [], tokenInfo } = step;
    if (!tokenInfo) return;

    const normalizedWallets = normalizeWallets(wallets);
    const walletMap = buildWalletMap(normalizedWallets);

    const balances = await Promise.all(
        selectedWallets.map(async (key) => {
            const address = walletMap?.[key]?.address;
            if (!address) return null;

            try {
                const [tokenBalance, suiBalance] = await Promise.all([
                    withTimeout(getCoinBalance(address, tokenInfo.address), 5000),
                    withTimeout(getBalance(address), 5000),
                ]);
                return { wallet: address, suiBalance, tokenBalance };
            } catch {
                return {
                    wallet: address,
                    suiBalance: { sui: 0, usd: 0 },
                    tokenBalance: { balance: 0, balanceUsd: 0 }
                };
            }
        })
    ).then(results => results.filter(Boolean));

    const explorerLink = `https://suiscan.xyz/mainnet/coin/${tokenInfo.address}/txs`;
    const chartLink = `https://dexscreener.com/sui/${tokenInfo.address}`;

    let formattedMessage = `<b>${tokenInfo.symbol}</b> | <b>${tokenInfo.name}</b>\n\n`;
    formattedMessage += `<a href="${explorerLink}">Explorer</a> | <a href="${chartLink}">Chart</a>\n\n`;
    formattedMessage += `CA: <code>${tokenInfo.address}</code>\n\n`;
    formattedMessage += `Price: <b>${formatTinyPrice(tokenInfo.price || 0)}</b>\n`;
    formattedMessage += `Market Cap: <b>${formatBigNumber(Number(tokenInfo.marketCap))}</b>\n`;
    formattedMessage += `Liquidity: <b>${formatBigNumber(Number(tokenInfo.date))}</b>\n\n`;
    formattedMessage += `<b>Selected Wallets:</b>\n`;

    for (const { wallet, suiBalance, tokenBalance } of balances) {
        const fullWallet = normalizedWallets.find(w => w.address?.toLowerCase() === wallet.toLowerCase());
        formattedMessage += formatWalletBalanceRow(fullWallet, suiBalance, tokenBalance, tokenInfo);
    }

    const keyboard = {
        inline_keyboard: buildFullKeyboard(selectedWallets, normalizedWallets, step.showAllWallets ?? false, step.mode)
    };

    step.wallets = normalizedWallets;
    step.walletMap = walletMap;
    step.balances = balances;

    try {
        if (step.mainMessageId) {
            await ctx.telegram.editMessageText(ctx.chat.id, step.mainMessageId, undefined, formattedMessage, {
                parse_mode: "HTML",
                disable_web_page_preview: true,
                reply_markup: keyboard
            });
        } else {
            const sent = await ctx.reply(formattedMessage, {
                parse_mode: "HTML",
                disable_web_page_preview: true,
                reply_markup: keyboard
            });
            step.mainMessageId = sent.message_id;
        }
    } catch {
        const sent = await ctx.reply(formattedMessage, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: keyboard
        });
        step.mainMessageId = sent.message_id;
    }

    await saveUserStep(userId, step);
}