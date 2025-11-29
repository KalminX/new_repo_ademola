import { clearUserStep, fetchUserStep } from "../../../services/userService.js";

export async function handleCancel(ctx, userId) {
    try {
        const step = await fetchUserStep(userId);

        if (step?.mainMessageId) {
            try {
                await ctx.deleteMessage(step.mainMessageId);
            } catch (err) {
                console.log("⚠️ Could not delete old message:", err.message);
            }
        }

        // clear the step so user is reset
        await clearUserStep(userId);
    } catch (err) {
        console.error(`❌ Failed to cancel for user ${userId}:`, err);
    }
}