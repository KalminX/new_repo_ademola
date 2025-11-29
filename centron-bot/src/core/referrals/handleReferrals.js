import { prisma } from "../../config/prisma.js";
import { getUser } from "../../services/userService.js";
import { getReferralEarnings } from "./referralSystem.js";

export async function handleReferrals(ctx, userId) {
    try {
        const user = await getUser(userId.toString());

        if (!user) {
            return ctx.reply("User not found. Please start with /start.");
        }

        // Count referrals from the Referral table
        const referralCount = await prisma.referral.count({
            where: {
                userId: user.id // Use Prisma User ID, not Telegram ID
            }
        });

        // Get actual referral earnings using your existing function
        const earningsResult = await getReferralEarnings(user.id);
        const referralEarnings = earningsResult.success ? earningsResult.totalEarned : 0;


        // Get bot username
        const botUsername = ctx.botInfo?.username || ctx.me?.username || "CentronTradingBot";

        // Use Telegram username if available, otherwise fall back to user ID
        const referralCode = ctx.from?.username || userId;
        const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;

        let message = '';
        message += `Your Reflink: <code>${referralLink}</code>\n\n`;

        if (!ctx.from?.username) {
            message += `💡 <i>Tip: Set a Telegram username to get a custom referral link!</i>\n\n`;
        }

        message += `Referrals: <b>${referralCount}</b>\n\n`;
        message += `Lifetime SUI earned: <b>${referralEarnings.toFixed(6)}</b> SUI\n\n`;

        // // Optional: Show breakdown of credited vs pending
        // if (earningsResult.success) {
        //     message += `💰 Credited: <b>${earningsResult.credited.toFixed(6)}</b> SUI\n`;
        //     message += `⏳ Pending: <b>${earningsResult.pending.toFixed(6)}</b> SUI\n\n`;
        // }

        message += `Rewards are updated at least once every 24 hours and are automatically credited to your SUI balance.\n\n`;
        message += `Refer your friends and earn 20% of their fees in the first month, 10% in the second and 5% <b>forever!</b>\n`;

        await ctx.replyWithHTML(message, {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "QR Code", callback_data: "show_qr" },
                        { text: "← Back", callback_data: "close_msg" }
                    ]
                ]
            }
        });

    } catch (err) {
        console.error("❌ handleReferrals error:", err);
        await ctx.reply("❌ Failed to fetch referral information. Please try again.");
    }
}