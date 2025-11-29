import { prisma } from "../../config/prisma.js";
import redisClient from "../../config/redis.js";
import { decryptWallet } from "../../core/cryptoCore.js";
import { processReferral } from "../../core/referrals/referralSystem.js";
import { clearUserStep, fetchUser, fetchUserStep } from "../../services/userService.js";
// import { addWalletToUser } from "../../services/walletService.js";
import { normalize } from "../../utils/helper.js";
import { handleWallets } from "../handlers/wallets/walletHandler.js";

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;

export async function handleSeedPhraseVerification(ctx, userId, text) {
    const step = await fetchUserStep(userId);

    if (step?.state === "confirming_seed_phrase") {
        const cacheKey = `wallet_pending_${userId}`;

        // Retrieve wallet credentials from Redis
        let pendingWalletData;
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (!cachedData) {
                await ctx.reply("⏳ Your wallet verification session expired. Please run /start again.");
                await clearUserStep(userId);
                return;
            }
            pendingWalletData = JSON.parse(cachedData);
            // console.log(`✅ Retrieved wallet data from Redis:`, pendingWalletData);
        } catch (err) {
            console.error("❌ Error retrieving wallet from Redis:", err);
            await ctx.reply("⚠️ Error retrieving wallet data. Please try again.");
            return;
        }

        // Validate data exists
        if (!pendingWalletData.expectedSeed || !pendingWalletData.expectedPrivateKey) {
            console.error("❌ Missing wallet data in Redis:", pendingWalletData);
            await ctx.reply("⚠️ Wallet data is corrupted. Please run /start again.");
            await redisClient.del(cacheKey);
            return;
        }

        // Decrypt credentials
        let decryptedSeed, decryptedPK;
        try {
            decryptedSeed = decryptWallet(pendingWalletData.expectedSeed, ENCRYPTION_SECRET);
            decryptedPK = decryptWallet(pendingWalletData.expectedPrivateKey, ENCRYPTION_SECRET);
        } catch (err) {
            console.error("❌ Error decrypting wallet:", err.message);
            try {
                await ctx.deleteMessage(ctx.message.message_id);
            } catch (deleteErr) {
                console.error(`❌ Failed to delete user's message:`, deleteErr.message);
            }
            await ctx.reply("❌ The private key or mnemonic phrase entered is incorrect.\n\nPlease try again.");
            return;
        }

        // Verify credentials
        const seedMatch = normalize(text) === normalize(decryptedSeed);
        const pkMatch = text === decryptedPK;

        // Delete user's message immediately (contains sensitive data)
        try {
            await ctx.deleteMessage(ctx.message.message_id);
            // console.log(`✅ Deleted user's seed phrase/PK message for user ${userId}`);
        } catch (err) {
            console.error(`❌ Failed to delete user's message:`, err.message);
        }

        if (seedMatch || pkMatch) {
            // ✅ VERIFICATION SUCCESSFUL
            // console.log(`✅ Wallet verified for user ${userId}`);

            // Import here to avoid circular dependency
            const { addWalletToUser } = await import("../../services/walletService.js");

            // Save wallet to database
            try {
                await addWalletToUser(userId, {
                    address: pendingWalletData.address,
                    privateKey: pendingWalletData.expectedPrivateKey,
                    seedPhrase: pendingWalletData.expectedSeed,
                    balance: "0.0",
                });
                // console.log(`✅ Wallet saved to database for user ${userId}`);
            } catch (err) {
                console.error(`❌ Error saving wallet to database:`, err);
                await ctx.reply("⚠️ Error saving wallet. Please try again.");
                return;
            }

            // 🎉 PROCESS REFERRAL HERE (after wallet is saved)
            if (step?.referralCode) {
                // console.log(`🔗 Processing stored referral code: ${step.referralCode}`);

                try {
                    let referrerTelegramId = null;

                    // Check if it's a numeric user ID
                    if (/^\d+$/.test(step.referralCode)) {
                        referrerTelegramId = step.referralCode;
                        // console.log(`🔢 Referral code is numeric ID: ${referrerTelegramId}`);
                    } else {
                        // It's a username - find the user
                        // console.log(`👤 Looking up username: ${step.referralCode}`);
                        const referrerUser = await prisma.user.findFirst({
                            where: {
                                OR: [
                                    { username: step.referralCode.toLowerCase() },
                                    { referralCode: step.referralCode }
                                ]
                            }
                        });

                        if (referrerUser) {
                            referrerTelegramId = referrerUser.telegramId;
                            // console.log(`✅ Found referrer: ${referrerTelegramId}`);
                        } else {
                            // console.log(`❌ No user found with code: ${step.referralCode}`);
                        }
                    }

                    // Process the referral
                    if (referrerTelegramId && referrerTelegramId !== userId) {
                        const result = await processReferral(userId, referrerTelegramId);

                        if (result.success) {
                            // console.log(`✅ Referral processed successfully!`);
                            await ctx.reply(
                                `👋 Welcome! Start trading to earn rewards together with your referrer!`,
                                { parse_mode: 'HTML' }
                            );
                        } else if (result.error === 'User already has a referrer') {
                            // console.log(`ℹ️ User ${userId} already has a referrer`);
                        } else {
                            console.error(`❌ Referral processing failed:`, result.error);
                        }
                    } else {
                        console.log(`⚠️ Invalid referrer or self-referral attempt`);
                    }
                } catch (err) {
                    console.error("❌ Error processing stored referral:", err);
                    // Don't fail the whole flow if referral fails
                }
            }

            // Delete confirmation message
            if (step.confirmationMessageId) {
                try {
                    await ctx.deleteMessage(step.confirmationMessageId);
                    // console.log(`✅ Deleted confirmation message for user ${userId}`);
                } catch (err) {
                    console.error(`❌ Failed to delete confirmation message:`, err.message);
                }
            }

            // Delete wallet credentials message
            if (step.walletCredentialsMessageId) {
                try {
                    await ctx.deleteMessage(step.walletCredentialsMessageId);
                    // console.log(`✅ Deleted wallet credentials message for user ${userId}`);
                } catch (err) {
                    console.error(`❌ Failed to delete wallet credentials message:`, err.message);
                }
            }

            // Delete from Redis cache
            try {
                await redisClient.del(cacheKey);
                // console.log(`✅ Deleted wallet verification cache for user ${userId}`);
            } catch (err) {
                console.error(`❌ Failed to delete Redis cache:`, err.message);
            }

            await ctx.reply("✅ Wallet connected successfully!");
            await clearUserStep(userId);
            return await handleWallets(ctx, userId);

        } else {
            // ❌ VERIFICATION FAILED
            console.log(`❌ Wrong seed/PK attempt for user ${userId}`);
            await ctx.reply("❌ The private key or mnemonic phrase entered is incorrect.\n\nPlease try again.");
        }
    }
}
