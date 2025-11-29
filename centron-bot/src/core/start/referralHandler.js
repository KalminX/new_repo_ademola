import { prisma } from "../../config/prisma.js";
import { processReferral } from "../referrals/referralSystem.js";

export async function handleReferralCode(ctx, userId, payload) {
    try {
        let referralCode = payload.startsWith("ref_") ? payload.replace("ref_", "") : payload;
        let referrerTelegramId = null;

        if (/^\d+$/.test(referralCode)) {
            referrerTelegramId = referralCode;
        } else {
            const referrerUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { username: referralCode.toLowerCase() },
                        { referralCode: referralCode }
                    ]
                }
            });
            if (referrerUser) referrerTelegramId = referrerUser.telegramId;
        }

        if (referrerTelegramId && referrerTelegramId !== userId) {
            const result = await processReferral(userId, referrerTelegramId);
            if (result.success) {
                await ctx.reply("🎉 Welcome! You've been referred!\n\nYou and your referrer will earn rewards from your trades.");
            }
        }
    } catch (err) {
        console.error("❌ Referral handler error:", err);
    }
}