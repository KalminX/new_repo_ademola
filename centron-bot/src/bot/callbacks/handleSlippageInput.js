import {
    fetchUserWithSlippages,
    setBuySlippage,
    setSellSlippage, updateAllBuyWalletsSlippage,
    updateAllSellWalletsSlippage, updateBuySlippage,
    updateSellSlippage
} from "../../services/slippageService.js";
import { saveUserStep } from "../../services/userService.js";
import { handleBuySlippage, handleSellSlippage } from "../handlers/slippageHandler.js";



export async function handleSlippageInput(ctx, step, userId, text) {
    const userToString = String(userId);
    const slippage = parseFloat(text);

    if (isNaN(slippage) || slippage <= 0 || slippage > 50) {
        return ctx.reply("❌ Invalid slippage. Please enter a number between 0.1 and 50.", {
            parse_mode: "Markdown",
            reply_markup: { force_reply: true },
        });
    }

    try {
        // Update slippage based on scope
        if (step.scope === "all") {
            if (step.type === "buy") {
                await updateAllBuyWalletsSlippage(userToString, slippage);
            } else if (step.type === "sell") {
                await updateAllSellWalletsSlippage(userToString, slippage);
            }
        } else if (step.scope === "wallet" && typeof step.slippageTarget === "number") {
            // Need to get the wallet ID first
            const user = await fetchUserWithSlippages(userToString);
            if (!user || !user.wallets || !user.wallets[step.slippageTarget]) {
                return ctx.reply("❌ Wallet not found. Try again.");
            }

            const walletId = user.wallets[step.slippageTarget].id;

            if (step.type === "buy") {
                await updateBuySlippage(userToString, step.slippageTarget, slippage, walletId);
            } else if (step.type === "sell") {
                await updateSellSlippage(userToString, step.slippageTarget, slippage, walletId);
            }
        } else {
            return ctx.reply("❌ Failed to apply slippage. Try again.");
        }

        // Clean up prompt and user input
        try {
            if (step.promptMessageId) {
                await ctx.telegram.deleteMessage(ctx.chat.id, step.promptMessageId);
            }
            if (ctx.message?.message_id) {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
            }
        } catch (deleteError) {
            console.warn("⚠️ Failed to delete messages:", deleteError.message);
        }

        // Set step and reload slippage menu
        const newStep = {
            state: `setting_${step.type}_slippage`,
            returnTo: step.returnTo || "config",
            mainMessageId: step.mainMessageId
        };
        await saveUserStep(userId, newStep);

        if (step.type === "buy") {
            await handleBuySlippage(ctx, userId, newStep);
        } else if (step.type === "sell") {
            await handleSellSlippage(ctx, userId, newStep);
        }
    } catch (err) {
        console.error("Slippage update error:", err);
        return ctx.reply("❌ Failed to update slippage.");
    }
}
