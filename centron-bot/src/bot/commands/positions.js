import { showWalletsForPositions } from "../handlers/positions/showWalletsForPositions.js";
import { checkWalletConfirmed } from "../handlers/shared/checkWalletConfirmed.js";

export function registerPositionsCommand(bot) {
    bot.command("positions", async (ctx) => {
        const userId = ctx.from.id.toString();
        if (!await checkWalletConfirmed(ctx, userId)) {
            return;
        }
        await showWalletsForPositions(ctx, userId);
    });
}