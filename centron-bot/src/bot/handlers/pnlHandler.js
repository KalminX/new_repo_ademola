import { handleViewPnL } from "../action/handlePnl.js";

// Close handler
bot.action(/pnl_close_(\d+)/, async (ctx) => {
    try {
        await ctx.answerCbQuery(); // clear loading spinner
        await ctx.deleteMessage(); // remove the card message
    } catch (err) {
        console.error("Error in close handler:", err);
        await ctx.answerCbQuery("⚠ Failed to close message", { show_alert: true });
    }
});

// 🔄 Regenerate handler
bot.action(/pnl_regen_(\d+)/, async (ctx) => {
    try {
        const index = ctx.match[1]; // extract index from callback_data

        // optional: acknowledge the button click (avoids "loading" spinner forever)
        await ctx.answerCbQuery("Refreshing PnL card...");
        // re-run the main function
        await handleViewPnL(ctx, index);
    } catch (err) {
        console.error("Error in regenerate handler:", err);
        await ctx.answerCbQuery("⚠ Failed to regenerate PnL card", { show_alert: true });
    }
});