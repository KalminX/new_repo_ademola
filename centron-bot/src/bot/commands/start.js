import { handleStart } from "../../core/start/handleStart.js";
import { bot } from "../../core/telegraf.js";

export function registerStartCommand(bot) {
    bot.start(handleStart);
}