import { saveUserStep } from "../../services/userService.js";
import { createChangeNowBridge } from "../../transactions/bridge/bridgeService.js";


export async function handleBridgeAmountInput(ctx, step, userId, input, currency) {
    const amount = parseFloat(input);

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
        return ctx.reply("❌ Please enter a valid positive number.", {
            parse_mode: "HTML",
            reply_markup: {
                force_reply: true,
                selective: true
            }
        });
    }

    // Delete the question message and user's answer
    try {
        if (step.questionMessageId) {
            await ctx.deleteMessage(step.questionMessageId); // Delete "How much SOL..."
        }
        await ctx.deleteMessage(ctx.message.message_id); // Delete user's "2"
    } catch (error) {
        console.log("Could not delete messages:", error.message);
    }

    // Edit the original bridge menu message to show processing
    try {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            step.menuMessageId, // 👈 Edit the original menu
            undefined,
            "⏳ Creating bridge transaction...",
            { parse_mode: "HTML" }
        );
    } catch (error) {
        console.log("Could not edit menu message:", error.message);
    }

    try {
        // Create ChangeNOW transaction
        const transaction = await createChangeNowBridge(currency, 'SUI', amount, step.userSuiAddress);

        const successMessage =
            `<b>Bridge Transaction Created</b>\n\n` +
            `<b>Deposit Address:</b>\n<code>${transaction.payinAddress}</code>\n\n` +
            `<b>Status: ${getStatusEmoji(transaction.status)} ${transaction.status}<b>\n` +
            `<b>Send: ${amount} ${currency}<b>\n` +
            `<b>Receive: ~${transaction.amountTo} SUI<b>\n` +
            `<b>TX ID: <code>${transaction.id}</code><b>\n\n` +
            `⚠️ Send exactly <b>${amount} ${currency}</b> to the address above.`;

        // Edit the menu message with success and add buttons
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            step.menuMessageId,
            undefined,
            successMessage,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "❌ Close", callback_data: "bridge_close" },
                            { text: "Refresh", callback_data: `bridge_refresh:${transaction.id}` },
                        ]
                    ]
                }
            }
        );

        // Reset user state
        await saveUserStep(userId, { state: "idle" });

    } catch (error) {
        console.error("Error creating bridge transaction:", error);

        const errorMessage =
            `❌ <b>Bridge Failed</b>\n\n` +
            `${error.message}\n\n` +
            `Please try again or contact support.`;

        try {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                step.menuMessageId,
                undefined,
                errorMessage,
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "❌ Close", callback_data: "bridge_close" }
                            ]
                        ]
                    }
                }
            );
        } catch (editError) {
            await ctx.reply(errorMessage, { parse_mode: "HTML" });
        }

        await saveUserStep(userId, { state: "idle" });
    }
}

/**
 * Get emoji for transaction status
 */
export function getStatusEmoji(status) {
    const statusMap = {
        'new': '🆕',
        'waiting': '🟡',
        'confirming': '🟠',
        'exchanging': '🔵',
        'sending': '🟣',
        'finished': '🟢',
        'failed': '🔴',
        'refunded': '🟤',
        'expired': '⚫'
    };
    return statusMap[status.toLowerCase()] || '🟡';
}