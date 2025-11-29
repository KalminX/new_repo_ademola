import { handleReferrals } from "../../core/referrals/handleReferrals.js";
import { checkWalletConfirmed } from "../handlers/shared/checkWalletConfirmed.js";

export function registerReferalCommand(bot) {
    bot.command("referral", async (ctx) => {
        const userId = ctx.from.id.toString();
        if (!await checkWalletConfirmed(ctx, userId)) {
            return;
        }
        await handleReferrals(ctx, userId);
    });
}