import redisClient from "../../config/redis.js";
import { saveUserStep } from "../../services/userService.js";
import { encryptWallet } from "../cryptoCore.js";
import { generateWallet } from "../walletCore.js";

const VERIFICATION_TIMEOUT = 10 * 60; // 10 minutes in seconds
const MESSAGE_DELETE_DELAY = 5 * 60 * 1000; // 5 minutes

export async function createWalletFlow(ctx, userId, referralCode) {
    try {
        const wallet = await generateWallet();
        const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;

        const encryptedPrivateKey = encryptWallet(wallet.privateKey, ENCRYPTION_SECRET);
        const encryptedSeedPhrase = encryptWallet(wallet.seedPhrase, ENCRYPTION_SECRET);

        await redisClient.setEx(
            `wallet_pending_${userId}`,
            VERIFICATION_TIMEOUT,
            JSON.stringify({
                address: wallet.walletAddress,
                expectedSeed: encryptedSeedPhrase,
                expectedPrivateKey: encryptedPrivateKey,
                balance: "0.0",
                createdAt: Date.now(),
            })
        );

        await saveUserStep(userId, { state: "confirming_seed_phrase" });

        const message = `
✅ Generated new wallet\n\n
Address:\n<code>${wallet.walletAddress}</code>\n\n
Private key:\n<code>${wallet.privateKey}</code>\n\n
Seed phrase:\n<code>${wallet.seedPhrase}</code>\n\n
⚠️ Save these securely. The bot will not show them again.
    `;
        const sentMessage = await ctx.replyWithHTML(message);

        // auto-delete after 5 min
        setTimeout(async () => {
            try {
                await ctx.deleteMessage(sentMessage.message_id);
            } catch { }
        }, MESSAGE_DELETE_DELAY);

        const confirmationMessage = await ctx.reply("What is the mnemonic phrase or private key for this wallet?");
        await saveUserStep(userId, {
            state: "confirming_seed_phrase",
            confirmationMessageId: confirmationMessage.message_id,
            walletCredentialsMessageId: sentMessage.message_id,
            referralCode: referralCode || null,
        });
    } catch (err) {
        console.error("❌ createWalletFlow error:", err);
        await ctx.reply("❌ Failed to set up wallet. Please try again.");
    }
}