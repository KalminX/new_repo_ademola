// handlers/copytradeHandler.js
import { saveUserStep } from "../../services/userService.js";
import { getUsersWallets } from "../../services/walletService.js";


export async function handleCopyTrade(ctx, userId) {
    try {
        const wallets = await getUsersWallets(userId);

        if (!wallets || wallets.length === 0) {
            return ctx.reply("⚠️ You don't have any wallets yet. Please create or import one first.");
        }

        const walletMap = {};
        const walletButtons = [];

        // Create wallet buttons
        for (let i = 0; i < wallets.length; i++) {
            const wallet = wallets[i];
            const shortAddr = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
            const displayText = wallet.name || shortAddr;
            walletMap[`w${i}`] = wallet.address;

            const button = {
                text: `💳 ${displayText}`,
                callback_data: `copytrade_wallet_w${i}`
            };

            // Add button to current row or create new row
            if (i % 2 === 0) {
                // Start a new row
                walletButtons.push([button]);
            } else {
                // Add to current row
                walletButtons[walletButtons.length - 1].push(button);
            }
        }

        // Add back button on its own row
        walletButtons.push([{ text: "← Main Menu", callback_data: "back_to_menu" }]);

        await saveUserStep(userId, {
            state: "copytrade_select_wallet",
            walletMap
        });

        let messageText = "";
        messageText += "<b>Wallet Copytrading</b>\n\n";
        messageText += "In this menu, you can <b>add wallets that you would want to copy trades from.</b>\n\n";
        messageText += "The bot will notify you each time a new swap is done by one of the wallets you selected. You can also set the bot to <b>auto-buy and auto-sell</b> for you by copying these wallets too.\n\n";
        messageText += "<b>Please select a wallet that you would like to edit wallet copytrading configurations for:</b>\n\n";
        messageText += "📚 <a href='https://www.centronbot.com/'>How to Use?</a>";

        await ctx.answerCbQuery();

        await ctx.editMessageText(messageText, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: walletButtons }
        }).catch(() =>
            ctx.reply(messageText, {
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: walletButtons }
            })
        );

        // await ctx.answerCbQuery();

    } catch (error) {
        console.error("Error in handleCopyTrade:", error);

        try {
            await ctx.answerCbQuery("⚠️ Error loading copytrade menu");
        } catch { }

        try {
            await ctx.reply("⚠️ Failed to load copytrade menu. Please try again.");
        } catch { }
    }
}