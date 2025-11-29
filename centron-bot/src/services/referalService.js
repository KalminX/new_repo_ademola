import { prisma } from "../config/prisma.js";
import { fetchUser } from "./userService.js";
/* ===================== REFERRALS ===================== */
export async function incrementReferrer(referrerCode, referredId) {
    try {
        // Validate inputs
        if (!referrerCode || !referredId) {
            return;
        }

        // Clean the referrer code (in case it still has "ref_" prefix)
        const refId = referrerCode.replace("ref_", "");

        // Fetch the referrer user
        const refUser = await fetchUser(refId);
        if (!refUser) {
            return;
        }

        // Prevent self-referral (double check)
        if (refUser.id === String(referredId)) {
            return;
        }

        // Fetch the referred user to get their Prisma User ID
        const referredUser = await fetchUser(String(referredId));
        if (!referredUser) {
            return;
        }

        // Check if this referral already exists
        const existingReferral = await prisma.referral.findFirst({
            where: {
                referredId: referredUser.id // Use Prisma User ID, not Telegram ID
            }
        });

        if (existingReferral) {
            return;
        }

        // Create the referral using Prisma User IDs
        const referral = await prisma.referral.create({
            data: {
                userId: refUser.id,        // Referrer's Prisma User ID
                referredId: referredUser.id, // Referred user's Prisma User ID
            },
        });
        return referral;

    } catch (err) {
        console.error("❌ incrementReferrer error:", err.message);
        console.error("❌ Error code:", err.code);
        console.error("❌ Error details:", {
            referrerCode,
            referredId,
            errorName: err.name
        });

        // If it's a unique constraint violation, log it specifically
        if (err.code === 'P2002') {
            console.error("❌ Duplicate referral attempt detected");
        }

        throw err; // Re-throw so caller can handle
    }
}