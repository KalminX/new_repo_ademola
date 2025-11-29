// src/bot/handlers/slippageHandler.js
import { fetchUserWithSlippages } from "../../services/slippageService.js";
import { saveUserStep } from "../../services/userService.js";

export async function handleBuySlippage(ctx, userId, step = null) {
    const user = await fetchUserWithSlippages(userId);
    const wallets = user?.wallets || [];

    if (wallets.length === 0) {
        return ctx.reply("😕 No wallets found.");
    }

    const buttons = [
        [{
            text: `✅ All Wallets | ${user.buySlippage || "1.0"}%`,
            callback_data: "set_buy_slippage_all"
        }]
    ];

    wallets.forEach((wallet, index) => {
        if (!wallet.address) return;
        const short = `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`;
        const displayName = wallet.name || short;

        buttons.push([{
            text: `${displayName} | ${wallet.buySlippage || "1.0"}%`,
            callback_data: `set_buy_slippage_${index}`
        }]);
    });

    const returnTo = step?.returnTo || "main_menu";
    buttons.push([{ text: "← Back", callback_data: `back_to_${returnTo}` }]);

    const messageText = `Click on a wallet to set *buy slippage (%)*:\n\n📘 [How to Use?](https://example.com/help)`;
    await sendOrEditMessage(ctx, userId, step, messageText, buttons);
}

export async function handleSellSlippage(ctx, userId, step = null) {
    const user = await fetchUserWithSlippages(userId);
    const wallets = user?.wallets || [];

    if (wallets.length === 0) {
        return ctx.reply("😕 No wallets found.");
    }

    const buttons = [
        [{
            text: `✅ All Wallets | ${user.sellSlippage || "1.0"}%`,
            callback_data: "set_sell_slippage_all"
        }]
    ];

    wallets.forEach((wallet, index) => {
        if (!wallet.address) return;
        const short = `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`;
        const displayName = wallet.name || short;

        buttons.push([{
            text: `${displayName} | ${wallet.sellSlippage || "1.0"}%`,
            callback_data: `set_sell_slippage_${index}`
        }]);
    });

    const returnTo = step?.returnTo || "main_menu";
    buttons.push([{ text: "← Back", callback_data: `back_to_${returnTo}` }]);

    const messageText = `Click on a wallet to set *sell slippage (%)*:\n\n📘 [How to Use?](https://example.com/help)`;
    await sendOrEditMessage(ctx, userId, step, messageText, buttons);
}

/** Helper function to safely send or edit messages **/
async function sendOrEditMessage(ctx, userId, step, text, inline_keyboard) {
    const options = {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard }
    };

    try {
        if (ctx.callbackQuery?.message?.message_id) {
            await ctx.editMessageText(text, options);
            if (step) {
                step.mainMessageId = ctx.callbackQuery.message.message_id;
                await saveUserStep(userId, step);
            }
        } else if (step?.mainMessageId) {
            await ctx.telegram.editMessageText(ctx.chat.id, step.mainMessageId, undefined, text, options);
        } else {
            const sent = await ctx.reply(text, options);
            if (step) {
                step.mainMessageId = sent.message_id;
                await saveUserStep(userId, step);
            }
        }
    } catch (error) {
        console.error("Failed to send/edit slippage message:", error.message);
        const sent = await ctx.reply(text, options);
        if (step) {
            step.mainMessageId = sent.message_id;
            await saveUserStep(userId, step);
        }
    }
}