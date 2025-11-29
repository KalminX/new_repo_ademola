import { fetchUserStep } from "../../../services/userService.js";

export async function checkWalletConfirmed(ctx, userId) {
    const step = await fetchUserStep(userId);

    // If user is still in confirming_seed_phrase state, they haven't confirmed yet
    if (step?.state === "confirming_seed_phrase") {
        await ctx.reply("❌ You must confirm your wallet first. Please enter your seed phrase or private key.");
        return false;
    }
    return true;
}