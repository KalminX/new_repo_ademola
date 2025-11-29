import { bot } from "../core/telegraf.js";
import { registerCancelCommand } from "./commands/cancel.js";
import { registerConfigCommand } from "./commands/config.js";
import { registerOrderCommand } from "./commands/orders.js";
import { registerPositionsCommand } from "./commands/positions.js";
import { registerReferalCommand } from "./commands/referal.js";
import { registerStartCommand } from "./commands/start.js";
import { registerWalletCommand } from "./commands/wallets.js";
import { registerCallbackHandler } from "./handlers/callbackHandler.js";
import { registerMessageHandler } from "./handlers/messageHandler.js";

// Register all commands
registerStartCommand(bot);
registerWalletCommand(bot);
registerCancelCommand(bot);
registerPositionsCommand(bot);
registerConfigCommand(bot);
registerOrderCommand(bot);
registerReferalCommand(bot);


// Register all handlers
registerMessageHandler(bot);
registerCallbackHandler(bot);

// Export for use
export default {
    bot,
    webhookCallback: bot.webhookCallback('/'),
};