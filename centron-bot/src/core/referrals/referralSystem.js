import { prisma } from "../../config/prisma.js";
import { sendSuiToWallet } from "../../transactions/sendSui/sendSuiToWallet.js";

/**
 * Calculate commission rate based on how long ago the referral was made
 * @param {Date} referralDate
 * @returns {number} Commission rate (0.20, 0.10, or 0.05)
 */

export function calculateCommissionRate(referralDate) {
    if (!(referralDate instanceof Date) || isNaN(referralDate)) {
        console.warn("⚠️ Invalid referralDate passed to calculateCommissionRate()");
        return 0.05; // default to lowest rate
    }

    const now = new Date();
    const daysSinceReferral = Math.floor((now - referralDate) / (1000 * 60 * 60 * 24));

    let rate;
    if (daysSinceReferral <= 30) rate = 0.20;
    else if (daysSinceReferral <= 60) rate = 0.10;
    else rate = 0.05;

    console.log(
        `📆 Referral Age: ${daysSinceReferral} days → Commission Rate: ${(rate * 100).toFixed(1)}%`
    );
    return rate;
}
/**
 * Record a referral earning when a referred user makes a trade
 */
// export async function recordReferralEarning({
//     referredUserPrismaId,
//     walletId,
//     tokenAddress,
//     feeAmount,
//     transactionDigest
// }) {
//     console.log(
//         `\n🪙 [ReferralEarning] Start recording referral for user ${referredUserPrismaId}\n` +
//         `   Wallet: ${walletId}\n   Token: ${tokenAddress}\n   Fee: ${feeAmount}\n   TX: ${transactionDigest}`
//     );

//     try {
//         // Validate inputs
//         if (!transactionDigest || typeof transactionDigest !== 'string') {
//             console.warn("⚠️ Invalid transaction digest.");
//             return { success: false, error: 'Invalid transaction digest' };
//         }

//         if (typeof feeAmount !== 'number' || feeAmount <= 0) {
//             console.warn("⚠️ Fee amount must be a positive number.");
//             return { success: false, error: 'Fee amount must be a positive number' };
//         }

//         const MAX_FEE_AMOUNT = 1000;
//         if (feeAmount > MAX_FEE_AMOUNT) {
//             console.warn(`⚠️ Fee ${feeAmount} exceeds cap ${MAX_FEE_AMOUNT}, capping.`);
//             feeAmount = MAX_FEE_AMOUNT;
//         }

//         const earning = await prisma.$transaction(async (tx) => {
//             // Check duplicate TX
//             const existingEarning = await tx.referralEarning.findUnique({
//                 where: { transactionDigest }
//             });
//             if (existingEarning) {
//                 console.log(`ℹ️ TX ${transactionDigest} already processed.`);
//                 return existingEarning;
//             }

//             // Find the referral relationship
//             const referral = await tx.referral.findFirst({
//                 where: { referredId: referredUserPrismaId },
//             });

//             if (!referral) {
//                 console.log("ℹ️ No referral found for this user (no referrer).");
//                 return null;
//             }

//             console.log(`👥 Found Referrer: ${referral.userId} → Referred User: ${referredUserPrismaId}`);

//             // Calculate commission
//             const commissionRate = calculateCommissionRate(referral.createdAt);
//             const commissionAmount = feeAmount * commissionRate;

//             console.log(
//                 `💰 Commission: ${commissionAmount.toFixed(6)} SUI = ${(
//                     commissionRate * 100
//                 ).toFixed(1)}% of ${feeAmount} SUI`
//             );

//             // Create earning record
//             const newEarning = await tx.referralEarning.create({
//                 data: {
//                     userId: referral.userId,
//                     referredUserId: referredUserPrismaId,
//                     walletId,
//                     tokenAddress,
//                     amount: commissionAmount,
//                     feeAmount,
//                     commissionRate,
//                     transactionDigest,
//                     credited: false,
//                 },
//             });

//             console.log(`✅ Referral earning recorded successfully for referrer ${referral.userId}`);
//             return newEarning;
//         });

//         if (!earning) {
//             console.log("⚠️ No earning recorded (no referral found).");
//             return { success: false, error: "No referral relationship found" };
//         }

//         return {
//             success: true,
//             earning,
//             wasAlreadyProcessed: earning && earning.createdAt < new Date(Date.now() - 1000),
//         };
//     } catch (error) {
//         console.error("❌ Error recording referral earning:", error);
//         return { success: false, error: error.message };
//     }
// }


export async function recordReferralEarning({
    referredUserPrismaId,
    walletId,
    tokenAddress,
    feeAmount,
    transactionDigest
}) {
    console.log(
        `\n🪙 [ReferralEarning] Start recording referral for user ${referredUserPrismaId}\n` +
        `   Wallet: ${walletId}\n   Token: ${tokenAddress}\n   Fee: ${feeAmount}\n   TX: ${transactionDigest}`
    );

    try {
        // Validate inputs
        if (!transactionDigest || typeof transactionDigest !== 'string') {
            console.warn("⚠️ Invalid transaction digest.");
            return { success: false, error: 'Invalid transaction digest' };
        }

        if (typeof feeAmount !== 'number' || feeAmount <= 0) {
            console.warn("⚠️ Fee amount must be a positive number.");
            return { success: false, error: 'Fee amount must be a positive number' };
        }

        const MAX_FEE_AMOUNT = 1000;
        if (feeAmount > MAX_FEE_AMOUNT) {
            console.warn(`⚠️ Fee ${feeAmount} exceeds cap ${MAX_FEE_AMOUNT}, capping.`);
            feeAmount = MAX_FEE_AMOUNT;
        }

        const earning = await prisma.$transaction(async (tx) => {
            // Check duplicate TX
            const existingEarning = await tx.referralEarning.findUnique({
                where: { transactionDigest }
            });
            if (existingEarning) {
                console.log(`ℹ️ TX ${transactionDigest} already processed.`);
                return existingEarning;
            }

            // Find the referral relationship and include referrer's wallets
            const referral = await tx.referral.findFirst({
                where: { referredId: referredUserPrismaId },
                include: {
                    user: {
                        include: {
                            wallets: {
                                orderBy: {
                                    createdAt: 'asc'
                                },
                                take: 1
                            }
                        }
                    }
                }
            });

            if (!referral) {
                console.log("ℹ️ No referral found for this user (no referrer).");
                return null;
            }

            console.log(`👥 Found Referrer: ${referral.userId} → Referred User: ${referredUserPrismaId}`);

            // Calculate commission
            const commissionRate = calculateCommissionRate(referral.createdAt);
            const commissionAmount = feeAmount * commissionRate;

            console.log(
                `💰 Commission: ${commissionAmount.toFixed(6)} SUI = ${(
                    commissionRate * 100
                ).toFixed(1)}% of ${feeAmount} SUI`
            );

            // Create earning record
            const newEarning = await tx.referralEarning.create({
                data: {
                    userId: referral.userId,
                    referredUserId: referredUserPrismaId,
                    walletId,
                    tokenAddress,
                    amount: commissionAmount,
                    feeAmount,
                    commissionRate,
                    transactionDigest,
                    credited: false,
                },
            });

            // 🎯 ATTEMPT TO SEND SUI TO REFERRER'S FIRST WALLET
            const referrerWallets = referral.user.wallets;
            if (referrerWallets && referrerWallets.length > 0) {
                const firstWallet = referrerWallets[0];

                try {
                    console.log(`💸 Attempting to send ${commissionAmount.toFixed(6)} SUI to ${firstWallet.address}...`);

                    const transferResult = await sendSuiToWallet(firstWallet.address, commissionAmount);

                    // Update earning record to mark as credited
                    await tx.referralEarning.update({
                        where: { id: newEarning.id },
                        data: {
                            credited: true,
                            creditedAt: new Date()
                        }
                    });

                    console.log(`✅ Successfully credited ${commissionAmount.toFixed(6)} SUI to referrer ${referral.userId}`);
                    console.log(`   Transfer TX: ${transferResult.digest}`);

                    return { ...newEarning, credited: true, creditedAt: new Date() };
                } catch (sendError) {
                    console.error(`❌ Failed to send SUI to referrer (will remain pending):`, sendError.message);
                    // Don't throw - let the earning record stay as "not credited"
                }
            } else {
                console.warn(`⚠️ Referrer ${referral.userId} has no wallets! Earning will remain pending.`);
            }

            console.log(`✅ Referral earning recorded for referrer ${referral.userId} (pending credit)`);
            return newEarning;
        });

        if (!earning) {
            console.log("⚠️ No earning recorded (no referral found).");
            return { success: false, error: "No referral relationship found" };
        }

        return {
            success: true,
            earning,
            wasAlreadyProcessed: earning && earning.createdAt < new Date(Date.now() - 1000),
        };
    } catch (error) {
        console.error("❌ Error recording referral earning:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get total referral earnings for a user
 */
export async function getReferralEarnings(userPrismaId) {
    console.log(`\n📊 [Referral Stats] Fetching earnings for user ${userPrismaId}`);
    try {
        const [credited, pending] = await Promise.all([
            prisma.referralEarning.aggregate({
                _sum: { amount: true },
                where: { userId: userPrismaId, credited: true },
            }),
            prisma.referralEarning.aggregate({
                _sum: { amount: true },
                where: { userId: userPrismaId, credited: false },
            }),
        ]);

        const totalEarned = (credited._sum.amount || 0) + (pending._sum.amount || 0);
        console.log(
            `💵 Total Earned: ${totalEarned.toFixed(6)} SUI | Credited: ${(credited._sum.amount || 0).toFixed(6)} | Pending: ${(pending._sum.amount || 0).toFixed(6)}`
        );

        return {
            success: true,
            totalEarned,
            credited: credited._sum.amount || 0,
            pending: pending._sum.amount || 0,
        };
    } catch (error) {
        console.error("❌ Error getting referral earnings:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Credit pending referral earnings to user's wallet (cron job)
 */
export async function creditReferralEarnings(userPrismaId, walletId) {
    console.log(`\n🏦 [Referral Credit] Crediting pending earnings to user ${userPrismaId}, wallet ${walletId}`);
    try {
        const result = await prisma.$transaction(async (tx) => {
            const pendingEarnings = await tx.referralEarning.findMany({
                where: { userId: userPrismaId, credited: false },
            });

            if (pendingEarnings.length === 0) {
                console.log("ℹ️ No pending referral earnings found.");
                return { success: true, amount: 0, count: 0 };
            }

            const totalAmount = pendingEarnings.reduce((sum, e) => sum + e.amount, 0);
            const earningIds = pendingEarnings.map(e => e.id);
            console.log(`🧾 Found ${earningIds.length} pending earnings totaling ${totalAmount.toFixed(6)} SUI`);

            await tx.referralEarning.updateMany({
                where: { id: { in: earningIds }, credited: false },
                data: { credited: true, creditedAt: new Date() },
            });

            console.log(
                `✅ Marked ${earningIds.length} earnings as credited for user ${userPrismaId}`
            );

            // 🪙 Log for when wallet transfer system is implemented
            console.log(`💸 [TODO] Send ${totalAmount.toFixed(6)} SUI to wallet ${walletId}`);

            return {
                success: true,
                amount: totalAmount,
                count: pendingEarnings.length,
            };
        });

        return result;
    } catch (error) {
        console.error("❌ Error crediting referral earnings:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Process a referral when new user joins via referral link
 */

export async function processReferral(newUserTelegramId, referrerTelegramId) {
    console.log(`\n🔗 [Referral Join] New user ${newUserTelegramId} via ${referrerTelegramId}`);
    try {
        // Convert to strings immediately (CRITICAL FIX)
        newUserTelegramId = String(newUserTelegramId);
        referrerTelegramId = String(referrerTelegramId);

        if (!newUserTelegramId || !referrerTelegramId)
            return { success: false, error: 'Missing telegram IDs' };

        if (newUserTelegramId === referrerTelegramId) {
            console.log("❌ Self-referral attempt detected");
            return { success: false, error: 'Self-referral not allowed' };
        }

        const [newUser, referrer] = await Promise.all([
            prisma.user.findUnique({ where: { telegramId: newUserTelegramId } }),
            prisma.user.findUnique({ where: { telegramId: referrerTelegramId } }),
        ]);

        if (!newUser || !referrer) {
            console.log("❌ One or both users not found for referral");
            return { success: false, error: 'User not found' };
        }

        const existingReferral = await prisma.referral.findFirst({
            where: { referredId: newUser.id },
        });

        if (existingReferral) {
            console.log("⚠️ User already has a referrer");
            return {
                success: false,
                error: 'User already has a referrer',
                existingReferral,
            };
        }

        const referral = await prisma.referral.create({
            data: { userId: referrer.id, referredId: newUser.id },
        });

        console.log(`✅ Referral Created → Referrer: ${referrerTelegramId} → Referred: ${newUserTelegramId}`);
        return { success: true, referral };
    } catch (error) {
        console.error("❌ Error processing referral:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Get referral statistics for a user
 */
export async function getReferralStats(userPrismaId) {
    console.log(`\n📈 [Referral Stats] Getting referral stats for user ${userPrismaId}`);
    try {
        const [referrals, earnings] = await Promise.all([
            prisma.referral.findMany({
                where: { userId: userPrismaId },
                include: { referred: { select: { telegramId: true, createdAt: true } } },
            }),
            getReferralEarnings(userPrismaId),
        ]);

        console.log(`👥 Found ${referrals.length} referrals for user ${userPrismaId}`);

        return {
            success: true,
            totalReferrals: referrals.length,
            referrals: referrals.map(r => ({
                telegramId: r.referred.telegramId,
                referredAt: r.createdAt,
                daysSinceReferral: Math.floor((new Date() - r.createdAt) / (1000 * 60 * 60 * 24)),
                currentCommissionRate: calculateCommissionRate(r.createdAt),
            })),
            earnings: earnings.success ? earnings : null,
        };
    } catch (error) {
        console.error("❌ Error getting referral stats:", error);
        return { success: false, error: error.message };
    }
}