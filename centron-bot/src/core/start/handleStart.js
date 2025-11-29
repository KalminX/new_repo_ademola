import { createWalletFlow } from "./createWalletFlow.js";
import { handleReferralCode } from "./referralHandler.js";
import { getWalletBalances } from "./balanceHandler.js";
import { buildWelcomeMessage } from "./buildWelcomeMessage.js";
import { fetchUserStep, getUser, saveUserStep } from "../../services/userService.js";
import { prisma } from "../../config/prisma.js";
import redisClient from "../../config/redis.js";
import { mainMenu } from "../../bot/menus/mainMenu.js";
import { processReferral } from "../referrals/referralSystem.js";


const VERIFICATION_TIMEOUT = 10 * 60; // 10 minutes

export async function handleStart(ctx) {
    const userId = ctx.from.id.toString();
    const payload = ctx.startPayload;
    console.log(`🚀 handleStart - User: ${userId}, Payload: ${payload}`);

    try {
        // 1️⃣ Get or create user
        const user = await getUser(userId, payload, null, ctx);
        const step = await fetchUserStep(userId);

        if (step?.state === "confirming_seed_phrase") {
            return ctx.reply("⏳ You're already confirming your wallet. Please enter your seed phrase or private key first.");
        }

        // 2️⃣ If no wallet exists → start wallet creation flow
        if (!user.wallets || user.wallets.length === 0) {
            return await createWalletFlow(ctx, userId, payload);
        }

        // 3️⃣ If user already has wallet(s), process referral (if any)
        if (payload) {
            await handleReferralCode(ctx, userId, payload);
        }

        // 4️⃣ Fetch balances for all wallets
        const balances = await getWalletBalances(user.wallets);

        // 5️⃣ Build and send welcome message
        const message = buildWelcomeMessage(balances);
        await ctx.reply(message, {
            parse_mode: "MarkdownV2",
            ...mainMenu,
        });

    } catch (err) {
        console.error("❌ handleStart error:", err.message);
        console.error("❌ Stack:", err.stack);
        await ctx.reply("❌ Something went wrong. Please try again later.");
    }
}