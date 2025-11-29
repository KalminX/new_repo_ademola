import { checkUserOrders, showWalletsForOrders } from "../../jobs/manageOrders/limitAndDca.js";
import { checkWalletConfirmed } from "../handlers/shared/checkWalletConfirmed.js";

export function registerOrderCommand(bot) {
    bot.command("orders", async (ctx) => {
        const userId = ctx.from.id.toString();
        if (!await checkWalletConfirmed(ctx, userId)) {
            return;
        }
        const { hasOrders } = await checkUserOrders(userId);
        if (!hasOrders) {
            return ctx.reply("❌ You do not have any limit or DCA orders yet.");
        }
        await showWalletsForOrders(ctx, userId);
    });
}