import { getBalance } from "../../services/balanceService.js";
import { fetchUser, fetchUserStep, saveUser, saveUserStep } from "../../services/userService.js";
import { deleteWallet, renameWallet } from "../../services/walletService.js";
import { escapeMarkdownV2 } from "../../utils/escape.js";
import { getWalletInlineKeyboard } from "../keyboards/getWalletInlineKeyboard.js";

export async function handleRenameWallet(ctx) {
    const userId = ctx.from.id;
    const step = await fetchUserStep(userId);
    const newName = ctx.message.text.trim();
    const index = step.index;
    const messageId = step.messageId;

    if (!newName || newName.length > 30) {
        return ctx.reply("⚠️ Please enter a valid name under 30 characters.");
    }

    const user = await fetchUser(userId);
    const wallet = user.wallets?.[index];

    if (!wallet) {
        await saveUserStep(userId, null);
        return ctx.reply("❌ Wallet not found.");
    }

    // ✅ use centralized DB helper
    await renameWallet(userId, wallet.address, newName);

    // Clear step
    await saveUserStep(userId, null);

    // Fetch fresh balance
    let balance = "0";
    try {
        const balanceResult = await getBalance(wallet.address);
        balance = balanceResult?.sui || "0";
    } catch (e) {
        console.error("Balance fetch failed after rename:", e);
    }

    const displayText =
        `💰 *Balance:* ${escapeMarkdownV2(String(balance))} SUI\n\n` +
        `🏷️ *Name:* ${escapeMarkdownV2(newName)}\n\n` +
        `💳 *Wallet:*\n\`${escapeMarkdownV2(wallet.address)}\` \\(tap to copy\\)`;

    try {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            messageId,
            null,
            displayText,
            {
                parse_mode: "MarkdownV2",
                disable_web_page_preview: true,
                reply_markup: getWalletInlineKeyboard(
                    { ...wallet, name: newName },
                    index
                ),
            }
        );

        // cleanup messages
        await ctx.deleteMessage(ctx.message.message_id);
        if (step.promptMessageId) {
            await ctx.telegram.deleteMessage(ctx.chat.id, step.promptMessageId);
        }
    } catch (error) {
        console.error("Edit message failed after rename:", error);
        await ctx.reply(
            `✅ Wallet renamed to *${escapeMarkdownV2(newName)}*`,
            { parse_mode: "MarkdownV2" }
        );
    }
}