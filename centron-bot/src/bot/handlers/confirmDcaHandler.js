import { savePendingDcaOrder } from "../../services/orderService.js";
import { fetchUserStep, saveUserStep } from "../../services/userService.js";
import { formatDurationPrettyNew } from "../../utils/helper.js";
import { shortAddress } from "../../utils/shortAddress.js";

bot.action("confirm_dca", async (ctx) => {
    const userId = ctx.from.id;
    const step = await fetchUserStep(userId);

    if (!step || step.state !== "awaiting_dca_confirmation" || !step.pendingOrder) {
        return ctx.answerCbQuery("❌ No DCA order to confirm.");
    }

    const { mode, suiAmount, suiPercentage } = step.pendingOrder;
    const wallets = (step.selectedWallets || []).map(k => step.walletMap?.[k]).filter(Boolean);
    const results = [];

    for (const wallet of wallets) {
        await savePendingDcaOrder({
            userId,
            // walletAddress: wallet.address,
            address: wallet.address,
            tokenAddress: step.tokenAddress,
            mode,
            suiAmount,
            suiPercentage,
            intervalMinutes: step.dcaIntervalMinutes,
            intervalDuration: step.dcaDurationMinutes,
            times: step.times,
            duration: step.dcaDuration,
            interval: step.dcaInterval,
            slippage: mode === "buy" ? step.buySlippage : step.sellSlippage,
        });

        const amountText = suiAmount
            ? (suiAmount / 1e9) + " SUI"
            : suiPercentage + "%";

        results.push(
            `✅ DCA ${mode} order saved for <b>${amountText}</b> into $${step.tokenInfo?.symbol ?? "??"} ` +
            `with payments every <b>${formatDurationPrettyNew(step.dcaIntervalMinutes)}</b> ` +
            `for <b>${formatDurationPrettyNew(step.dcaDurationMinutes)}</b>`
        );
    }

    await ctx.editMessageText(results.join("\n"), { parse_mode: "HTML" });

    await saveUserStep(userId, { ...step, state: null, pendingOrder: null });
});


bot.action(/^confirm_dca_(.+)$/, async (ctx) => {
    try {
        const userId = ctx.from.id;
        const confirmId = ctx.match[1];

        const step = await fetchUserStep(userId);
        const pending = step?.dcaConfirmations?.[confirmId];

        if (!pending) {
            return ctx.reply("❌ No pending DCA order found or it expired.");
        }

        const { mode, tokenAddress, suiAmount, suiPercentage, intervalMinutes, durationMinutes, times, duration, interval, slippage, addresses } = pending;

        // 🔹 Save one order per wallet
        for (const address of addresses) {
            await savePendingDcaOrder({
                userId,
                // walletAddress,
                address: address,
                tokenAddress,
                mode,
                suiAmount,
                suiPercentage,
                intervalMinutes,
                durationMinutes,
                times,
                duration,
                interval,
                slippage,
            });
        }

        // cleanup just this confirmId
        delete step.dcaConfirmations[confirmId];
        await saveUserStep(userId, step);

        // 🔹 Build wallet list string
        const walletList = (step.selectedWallets || [])
            .map(w => `💳 ${w.name || shortAddress(w.address)}`)
            .join("\n");

        await ctx.editMessageText(
            `✅ DCA ${mode} order saved for <b>${suiAmount ? (suiAmount / 1e9) + " SUI" : suiPercentage + "%"}</b>
      into $${step.tokenInfo?.symbol ?? "??"} ` +
            `with payments every <b>${formatDurationPrettyNew(intervalMinutes)}</b> ` +
            `for <b>${formatDurationPrettyNew(durationMinutes)}</b>`,
            { parse_mode: "HTML" }
        );
    } catch (err) {
        console.error("❌ Failed to confirm DCA order:", err);
        return ctx.reply("❌ Something went wrong while saving your DCA order.");
    }
});