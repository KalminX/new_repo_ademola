// src/bot/handlers/walletHandler.js
import { fetchUser } from "../../../services/userService.js";
import { getCachedBalance } from "../../../services/walletBalanceService.js";

export async function handleWallets(ctx, userId) {
    const user = await fetchUser(userId);
    const userWallets = user?.wallets || [];

    if (userWallets.length === 0) {
        return ctx.reply("😕 No wallets found. Use the buttons below to add or connect one.", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "➕ New Wallet", callback_data: "new_wallet" }],
                    [{ text: "🔗 Connect Wallet", callback_data: "connect_wallet" }],
                    [{ text: "← Main Menu", callback_data: "back_to_menu" }]
                ]
            }
        });
    }

    // Fetch balances for all wallets in parallel
    const balancesResults = await Promise.all(
        userWallets.map(async (wallet) => {
            const address = wallet?.address;
            if (!address) return { balance: { sui: "0", usd: "0" }, address: null };
            const balance = await getCachedBalance(userId, address);
            return { balance, address };
        })
    );

    // Build keyboard buttons
    const walletButtons = userWallets
        .map((wallet, index) => {
            const { balance } = balancesResults[index];
            const address = wallet?.address;
            if (!address) return null;

            const shortAddr = `${address.slice(0, 4)}...${address.slice(-4)}`;
            const name = wallet.name?.trim() || shortAddr;

            return [{
                text: `💳 ${name} | ${balance.sui} SUI ($${balance.usd})`,
                callback_data: `wallet_${index}`
            }];
        })
        .filter(Boolean);

    const messageText = `💳 Wallets [${userWallets.length}]`;
    const inline_keyboard = [
        [
            { text: "➕ New Wallet", callback_data: "new_wallet" },
            { text: "➕ X New Wallets", callback_data: "x_new_wallets" }
        ],
        [{ text: "🔗 Connect Wallet", callback_data: "connect_wallet" }],
        ...walletButtons,
        [{ text: "← Main Menu", callback_data: "back_to_menu" }]
    ];

    try {
        await ctx.editMessageText(messageText, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard }
        });
    } catch (error) {
        if (!error.description?.includes('message is not modified')) {
            console.error("Failed to edit message:", error.message);
            try {
                await ctx.reply(messageText, {
                    parse_mode: "Markdown",
                    reply_markup: { inline_keyboard }
                });
            } catch (replyErr) {
                console.error("Failed to send wallet message:", replyErr.message);
            }
        }
    }
}