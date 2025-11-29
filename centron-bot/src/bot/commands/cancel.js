import { handleCancel } from "../action/cancel/handleCancel.js";
import { checkWalletConfirmed } from "../handlers/shared/checkWalletConfirmed.js";

export function registerCancelCommand(bot) {
    bot.command("cancel", async (ctx) => {
        const userId = ctx.from.id.toString();
        if (!await checkWalletConfirmed(ctx, userId)) {
            return;
        }
        await handleCancel(ctx, userId);
    });
}