import { checkWalletConfirmed } from "../handlers/shared/checkWalletConfirmed.js";
import { handleWallets } from "../handlers/wallets/walletHandler.js";

export function registerWalletCommand(bot) {
    bot.command("wallets", async (ctx) => {
        const userId = ctx.from.id.toString();
        if (!await checkWalletConfirmed(ctx, userId)) {
            return;
        }
        return await handleWallets(ctx, userId);
    });
}