import { Telegraf, session } from "telegraf";
import { BOT_TOKEN } from "../config/env.js";

export const bot = new Telegraf(BOT_TOKEN);
bot.use(session());