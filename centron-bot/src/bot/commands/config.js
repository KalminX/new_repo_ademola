import { checkWalletConfirmed } from "../handlers/shared/checkWalletConfirmed.js";
import { handleConfig } from "../menus/configMenu.js";

export function registerConfigCommand(bot) {
    bot.command("config", async (ctx) => {
        const userId = ctx.from.id.toString();
        if (!await checkWalletConfirmed(ctx, userId)) {
            return;
        }
        return await handleConfig(ctx, userId);
    });
}