import { saveUserStep } from "../services/userService.js";

export async function handleWithdrawAddressInput(ctx, step) {
    const userId = ctx.from.id;
    const address = ctx.message.text.trim();

    console.log(`📨 [Withdraw Address Input] User ${userId} entered address: ${address}`);

    try {
        await saveUserStep(userId, {
            ...step,
            action: "awaiting_withdraw_amount",
            withdrawAddress: address,
        });
        console.log(`💾 Step updated for user ${userId}: awaiting amount input.`);
    } catch (err) {
        console.error(`❌ Failed to save user step for ${userId}:`, err);
        return ctx.reply("⚠️ An error occurred while saving your withdrawal data. Please try again.");
    }

    return ctx.reply("Please enter the amount of SUI you want to withdraw:", {
        reply_markup: { force_reply: true },
    });
}



export async function handleWithdrawAmountInput(ctx, step) {
    const userId = ctx.from.id;
    const amountText = ctx.message.text.trim();
    const amount = parseFloat(amountText);

    console.log(`💰 [Withdraw Amount Input] User ${userId} entered amount: ${amountText}`);

    if (isNaN(amount) || amount <= 0) {
        console.warn(`⚠️ Invalid amount entered by user ${userId}: ${amountText}`);
        return ctx.reply("⚠️ Please enter a valid amount greater than 0.");
    }

    try {
        await saveUserStep(userId, {
            ...step,
            action: "confirming_withdraw",
            amount,
        });
        console.log(`💾 Step updated for user ${userId}: confirming withdraw of ${amount} SUI.`);
    } catch (err) {
        console.error(`❌ Failed to save user step for ${userId}:`, err);
        return ctx.reply("⚠️ Could not save withdrawal data. Please try again.");
    }

    const confirmationMessage =
        `🧾 Confirm Withdrawal\n\n` +
        `📤 From: \`${step.address}\`\n\n` +
        `📥 To: \`${step.withdrawAddress}\`\n\n` +
        `💸 Amount: ${amount} SUI\n\n` +
        `Do you want to proceed?`;

    console.log(`🧾 Sending confirmation message to user ${userId}`);

    return ctx.reply(confirmationMessage, {
        parse_mode: "Markdown",
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "✅ Confirm", callback_data: "confirm_withdraw" },
                    { text: "❌ Cancel", callback_data: "cancel_withdraw" },
                ],
            ],
        },
    });
}




// import { saveUserStep } from "./db.js";

// export async function handleWithdrawAddressInput(ctx, step) {
//     const userId = ctx.from.id;
//     const address = ctx.message.text.trim();
//     await saveUserStep(userId, {
//         ...step,
//         action: "awaiting_withdraw_amount",
//         withdrawAddress: address
//         // address
//     });

//     return ctx.reply("Please enter the amount of SUI you want to withdraw:", {
//         reply_markup: { force_reply: true }
//     });
// }



// export async function handleWithdrawAmountInput(ctx, step) {
//     const userId = ctx.from.id;
//     const amount = parseFloat(ctx.message.text.trim());

//     if (isNaN(amount) || amount <= 0) {
//         return ctx.reply("⚠️ Please enter a valid amount greater than 0.");
//     }
//     await saveUserStep(userId, {
//         ...step,
//         action: "confirming_withdraw",
//         amount
//     });
//     return ctx.reply(
//         `🧾 Confirm Withdrawal\n\n` +
//         // `📤 From: \`${step.walletAddress}\`\n\n` +
//         `📤 From: \`${step.address}\`\n\n` +
//         `📥 To: \`${step.withdrawAddress}\`\n\n` +
//         // `📥 To: \`${step.address}\`\n\n` +
//         `💸 Amount: ${amount} SUI\n\n` +
//         `Do you want to proceed?`,
//         {
//             parse_mode: "Markdown",
//             reply_markup: {
//                 inline_keyboard: [
//                     [
//                         { text: "✅ Confirm", callback_data: "confirm_withdraw" },
//                         { text: "❌ Cancel", callback_data: "cancel_withdraw" }
//                     ]
//                 ]
//             }
//         }
//     );
// }