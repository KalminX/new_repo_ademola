import { decryptWallet } from "../core/cryptoCore.js";
import { createWithdrawWalletKeyboard, sendSui } from "../transactions/withdrawSui.js";
import { fetchUser, fetchUserStep, saveUserStep } from "./userService.js";


export const handleWithdrawSui = async (ctx, action) => {
    const index = Number(action.split("_").pop());
    const userId = ctx.from.id.toString();

    console.log(`🟦 [Withdraw Start] User ${userId} selected wallet index: ${index}`);

    const user = await fetchUser(userId);
    const selectedWallet = user.wallets?.[index];

    if (!selectedWallet) {
        console.error(`❌ Wallet not found for index ${index}`);
        await ctx.answerCbQuery("❌ Wallet not found.", { show_alert: true });
        return;
    }

    const step = {
        action: "awaiting_withdraw_sui_address",
        selectedWalletIndex: index,
        address: selectedWallet.address,
        tokenType: "SUI",
    };

    await saveUserStep(userId, step);
    console.log(`💾 Step saved for user ${userId}:`, step);

    await ctx.answerCbQuery("✅ Wallet selected");

    await ctx.editMessageReplyMarkup(createWithdrawWalletKeyboard(userId));

    const displayText =
        `Please enter the withdrawal address below.\n\n` +
        `Note: To send SUI to multiple wallets simultaneously, enter the addresses as a comma-separated list (e.g., wallet1,wallet2,wallet3)`;

    await ctx.reply(displayText, {
        parse_mode: "HTML",
        reply_markup: { force_reply: true },
    });

    console.log(`📩 Prompted user ${userId} for withdrawal address.`);
};


export const handleConfirmWithdraw = async (ctx) => {
    const userId = ctx.from.id.toString();
    console.log(`\n🚀 [Withdraw Confirmation] Starting for user ${userId}`);

    let step;
    try {
        step = await fetchUserStep(userId);
        console.log(`📦 Loaded user step:`, step);
    } catch (err) {
        console.error("❌ Error fetching user step:", err);
        return ctx.reply("⚠️ Something went wrong loading your withdrawal data.");
    }

    if (!step?.address || !step?.amount || step.selectedWalletIndex === undefined) {
        console.error("❌ Missing withdrawal data:", step);
        return ctx.answerCbQuery("❌ Missing withdrawal data", { show_alert: true });
    }

    let key;
    try {
        const user = await fetchUser(userId);
        const selectedWallet = user.wallets?.[step.selectedWalletIndex];
        if (!selectedWallet) {
            console.error("❌ Selected wallet not found:", step.selectedWalletIndex);
            await ctx.editMessageText("❌ Wallet not found.");
            return;
        }

        console.log(`🔐 Decrypting wallet for address: ${selectedWallet.address}`);

        const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
        const encrypted = selectedWallet.seedPhrase || selectedWallet.privateKey;
        const decrypted = decryptWallet(encrypted, ENCRYPTION_SECRET);

        if (typeof decrypted === "string") {
            key = decrypted;
        } else if (decrypted && typeof decrypted === "object") {
            key = decrypted.privateKey || decrypted.seedPhrase;
        }

        if (!key) {
            console.error("❌ Failed to decrypt wallet key for user:", userId);
            await ctx.answerCbQuery("❌ Failed to decrypt wallet.", { show_alert: true });
            return;
        }

        // Mask key in logs for safety
        console.log("✅ Wallet decrypted successfully!");
        console.log("🔑 Key preview:", key.slice(0, 6) + "..." + key.slice(-4));
        console.log("📬 Withdraw FROM address:", step.address);
        console.log("📬 Withdraw TO address:", step.withdrawAddress);
        console.log("💰 Withdraw amount:", step.amount);

    } catch (err) {
        console.error("❌ Error decrypting wallet:", err);
        await ctx.answerCbQuery("❌ Failed to decrypt wallet.", { show_alert: true });
        return;
    }

    try {
        await ctx.editMessageText("⏳ Sending SUI... Please wait.");
    } catch (err) {
        console.warn("⚠️ Could not edit message (maybe deleted):", err.message);
    }

    try {
        console.log("📤 Sending transaction via sendSui...");
        const txDigest = await sendSui(key, step.withdrawAddress, step.amount);

        if (!txDigest) {
            console.error("❌ sendSui returned no digest or failed silently.");
            await ctx.editMessageText("❌ Failed to send SUI. No coins or unknown error.");
        } else {
            console.log("✅ Transaction successful!");
            console.log("🔗 Explorer link:", `https://suiscan.xyz/mainnet/tx/${txDigest.digest}`);

            await ctx.editMessageText(
                `✅ SUI Sent Successfully!\n\n` +
                `🔗 [View Transaction Record on Explorer](https://suiscan.xyz/mainnet/tx/${txDigest.digest})`,
                {
                    parse_mode: "Markdown",
                    disable_web_page_preview: true,
                }
            );
        }
    } catch (err) {
        console.error("❌ Failed to send SUI:", err);
        try {
            await ctx.editMessageText("❌ Transaction failed. Please try again later.");
        } catch {
            console.warn("⚠️ Could not edit message after failed transaction.");
        }
    }

    try {
        await saveUserStep(userId, null);
        console.log(`🧹 Cleared user step for ${userId}`);
    } catch (err) {
        console.warn("⚠️ Failed to clear user step:", err);
    }

    console.log(`✅ [Withdraw Complete] Process finished successfully for user ${userId}\n`);
};



// import { fetchUser, saveUserStep, fetchUserStep } from "./db.js";
// import { createWithdrawWalletKeyboard, sendSui } from "./withdrawSui.js";
// import { decryptWallet } from "./generateWallet.js";

// export const handleWithdrawSui = async (ctx, action) => {
//     const index = Number(action.split("_").pop());
//     const userId = ctx.from.id.toString();

//     const user = await fetchUser(userId);
//     const selectedWallet = user.wallets?.[index];

//     if (!selectedWallet) {
//         await ctx.answerCbQuery("❌ Wallet not found.", { show_alert: true });
//         return;
//     }

//     const step = {
//         action: "awaiting_withdraw_sui_address",
//         selectedWalletIndex: index,
//         // walletAddress: selectedWallet.walletAddress,
//         // walletAddress: selectedWallet.address,
//         address: selectedWallet.address,
//         tokenType: "SUI",
//     };

//     await saveUserStep(userId, step);

//     await ctx.answerCbQuery("✅ Wallet selected");

//     // Update keyboard
//     await ctx.editMessageReplyMarkup(createWithdrawWalletKeyboard(userId));

//     // Prompt user for address
//     const displayText = `Please enter the withdrawal address below.\n\n` +
//         `Note: To send SUI to multiple wallets simultaneously, enter the addresses as a comma-separated list (e.g., wallet1,wallet2,wallet3)`;

//     await ctx.reply(displayText, {
//         parse_mode: "HTML",
//         reply_markup: { force_reply: true },
//     });
// };


// export const handleConfirmWithdraw = async (ctx) => {
//     const userId = ctx.from.id.toString();
//     let step;

//     try {
//         step = await fetchUserStep(userId);
//     } catch (err) {
//         console.error("❌ Error fetching user step:", err);
//         return ctx.reply("⚠️ Something went wrong loading your withdrawal data.");
//     }

//     if (!step?.address || !step?.amount || step.selectedWalletIndex === undefined) {
//         return ctx.answerCbQuery("❌ Missing withdrawal data", { show_alert: true });
//     }

//     let key;
//     try {
//         const user = await fetchUser(userId);
//         const selectedWallet = user.wallets?.[step.selectedWalletIndex];
//         if (!selectedWallet) {
//             await ctx.editMessageText("❌ Wallet not found.");
//             return;
//         }

//         const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
//         const encrypted = selectedWallet.seedPhrase || selectedWallet.privateKey;
//         const decrypted = decryptWallet(encrypted, ENCRYPTION_SECRET);

//         if (typeof decrypted === "string") {
//             key = decrypted;
//         } else if (decrypted && typeof decrypted === "object") {
//             key = decrypted.privateKey || decrypted.seedPhrase;
//         }

//         if (!key) {
//             await ctx.answerCbQuery("❌ Failed to decrypt wallet.", { show_alert: true });
//             return;
//         }

//         // ✅ Log info safely (mask key for security)
//         console.log("🔑 Decrypted key:", key.slice(0, 6) + "..." + key.slice(-4));
//         console.log("📬 Withdraw address:", step.address);
//         console.log("💰 Withdraw amount:", step.amount);

//     } catch (err) {
//         console.error("❌ Error decrypting wallet:", err);
//         await ctx.answerCbQuery("❌ Failed to decrypt wallet.", { show_alert: true });
//         return;
//     }

//     try {
//         await ctx.editMessageText("⏳ Sending SUI... Please wait.");
//     } catch (err) {
//         console.warn("⚠️ Could not edit message (likely deleted):", err.message);
//     }

//     try {
//         const txDigest = await sendSui(key, step.address, step.amount);
//         if (!txDigest) {
//             await ctx.editMessageText("❌ Failed to send SUI. No coins or unknown error.");
//         } else {
//             await ctx.editMessageText(
//                 `✅ SUI Sent Successfully!\n\n` +
//                 `🔗 [View Transaction Record on Explorer](https://suiscan.xyz/mainnet/tx/${txDigest.digest})`,
//                 {
//                     parse_mode: "Markdown",
//                     disable_web_page_preview: true,
//                 }
//             );
//         }
//     } catch (err) {
//         // ✅ Handle send errors without killing bot
//         console.error("❌ Failed to send SUI:", err);
//         try {
//             await ctx.editMessageText("❌ Transaction failed. Please try again later.");
//         } catch {
//             console.warn("⚠️ Could not edit message after failed transaction.");
//         }
//     }

//     try {
//         await saveUserStep(userId, null);
//     } catch (err) {
//         console.warn("⚠️ Failed to clear user step:", err);
//     }

//     console.log(`✅ Withdraw process completed for user ${userId}`);
// };




// // export const handleConfirmWithdraw = async (ctx) => {
// //     // const userId = ctx.from.id;
// //     const userId = ctx.from.id.toString();
// //     const step = await fetchUserStep(userId);

// //     // if (
// //     //     !step?.withdrawAddress ||
// //     //     !step?.amount ||
// //     //     !step?.walletAddress ||
// //     //     (!step?.seedPhrase && !step?.privateKey)
// //     // ) {
// //     //     return ctx.answerCbQuery("❌ Missing withdrawal data", { show_alert: true });
// //     // }
// //     if (
// //         // !step?.withdrawAddress ||
// //         !step?.address ||
// //         !step?.amount ||
// //         step.selectedWalletIndex === undefined
// //     ) {
// //         return ctx.answerCbQuery("❌ Missing withdrawal data", { show_alert: true });
// //     }

// //     let key;
// //     try {
// //         // fetch wallet again
// //         const user = await fetchUser(userId);
// //         const selectedWallet = user.wallets?.[step.selectedWalletIndex];
// //         if (!selectedWallet) {
// //             await ctx.editMessageText("❌ Wallet not found.");
// //             return;
// //         }
// //         const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
// //         const encrypted = selectedWallet.seedPhrase || selectedWallet.privateKey;
// //         const decrypted = decryptWallet(encrypted, ENCRYPTION_SECRET);
// //         if (typeof decrypted === "string") {
// //             key = decrypted;
// //         } else if (decrypted && typeof decrypted === "object") {
// //             key = decrypted.privateKey || decrypted.seedPhrase;
// //         }

// //         if (!key) {
// //             await ctx.answerCbQuery("❌ Failed to decrypt wallet.", { show_alert: true });
// //             return;
// //         }
// //     } catch (err) {
// //         await ctx.answerCbQuery("❌ Failed to decrypt wallet.", { show_alert: true });
// //         return;
// //     }

// //     await ctx.editMessageText("⏳Sending SUI...Please wait.");
// //     // const key = step.seedPhrase || step.privateKey;
// //     try {
// //         // const txDigest = await sendSui(key, step.withdrawAddress, step.amount);
// //         const txDigest = await sendSui(key, step.address, step.amount);
// //         if (!txDigest) {
// //             await ctx.editMessageText("❌ Failed to send SUI. No coins or unknown error.");
// //         } else {
// //             await ctx.editMessageText(
// //                 `✅ SUI Sent Successfully!\n\n` +
// //                 `🔗 [View Transaction Record on Explorer](https://suiscan.xyz/mainnet/tx${txDigest.digest})`,
// //                 {
// //                     parse_mode: "Markdown",
// //                     disable_web_page_preview: true,
// //                 }
// //             );
// //         }
// //     } catch (err) {
// //         await ctx.editMessageText("❌ Failed to send SUI. Please try again later.");
// //     }
// //     await saveUserStep(userId, null);
// // };