import { handleAction } from "../action/handleAction.js";

export function registerCallbackHandler(bot) {
    bot.on("callback_query", async (ctx) => {
        const data = ctx.callbackQuery.data;
        const userId = ctx.from.id;
        // 🔍 ADD THIS - See if callback is received
        const withTimeout = (promise, ms) =>
            Promise.race([
                promise,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout")), ms)
                )
            ]);

        try {
            await ctx.answerCbQuery();
        } catch (e) {
            console.warn("Failed to answer callback query:", e.message);
        }

        try {
            await withTimeout(handleAction(ctx, data, userId), 15000);
        } catch (err) {
            console.error("Error in handle action:", err);

            if (err.message === "Timeout") {
                await ctx.reply("⏳ The request took too long. Please try again.");
            } else {
                await ctx.reply("⚠️ Something went wrong. Please try again.");
            }
        }
    });
}