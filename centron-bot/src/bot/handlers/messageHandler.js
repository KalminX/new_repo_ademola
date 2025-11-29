import {
    saveCopyTradeWallet,
    updateCopyTradeAutoBuyAmount,
    updateCopyTradeAutoSellPercentage,
    updateCopyTradeWalletLabel,
    updateCopyTradeWalletSlippage
} from "../../services/copytradeService.js";
import { fetchUserStep, getUser, saveUserStep } from "../../services/userService.js";
import {
    handleExecuteTokenWithdraw,
    handleWithdrawTokenAddress
} from "../../transactions/tokens/withdrawToken.js";
import { handleBridgeAmountInput } from "../action/handleBridgeAmountInput.js";
import { handleBuyTokenAddressFlow } from "../action/handleBuyTokenAddress.js";
import { handleCopyTradeInput } from "../action/handleCopyTradeInput.js";
import { showCopyTradeWalletSettings } from "../action/handleCopyTradeWalletSelect.js";
import { handleSellTokenAddressFlow } from "../action/handleSellTokenAddress.js";
import { handleCustomAmountInput } from "../callbacks/handleCustomAmountInput.js";
import {
    handleDcaInput,
    handleLimitTriggerValueInput
} from "../callbacks/handleLimitTriggerValue.js";
import { handleRenameWallet } from "../callbacks/handleRenameWallet.js";
import { handleSlippageInput } from "../callbacks/handleSlippageInput.js";
import { handleSeedPhraseVerification } from "../callbacks/handleVerification.js";
import { handleWalletGenerationRequest } from "../callbacks/handleWalletGenRequest.js";
import { handleWalletImport } from "../callbacks/handleWalletImport.js";
import {
    handleWithdrawAddressInput,
    handleWithdrawAmountInput
} from "../callbacks/handleWithdrawAddressInput.js";


export function registerMessageHandler(bot) {
    bot.on("message", async (ctx) => {
        const userId = ctx.from.id;
        const chatId = ctx.chat.id;
        const text = ctx.message.text?.trim();
        const replyTo = ctx.message?.reply_to_message?.text;
        if (!text) return;

        const step = await fetchUserStep(userId);
        const input = text.trim();

        // 1️⃣ Handle active step first (takes precedence over everything else)
        if (step) {
            // NAME handlers - withdraw tokens
            if (step?.name === "withdraw_token_amount") {
                return await handleWithdrawTokenAddress(ctx, step, text);
            }

            if (step?.name === "withdraw_token_address") {
                await handleExecuteTokenWithdraw(ctx, step, text);
                step.name = null;
                return await saveUserStep(userId, step);
            }

            // STATE handlers - check by state property
            if (step?.state) {
                // Wallet operations
                if (step.state === "awaiting_wallet_input") {
                    return await handleWalletImport(ctx, userId);
                }

                if (step.state === "awaiting_wallet_generation_count" && step?.flow === "generate_wallets") {
                    return await handleWalletGenerationRequest(ctx, userId);
                }

                if (step.state === "awaiting_slippage_input") {
                    return await handleSlippageInput(ctx, step, userId, text);
                }

                if (step.state === "confirming_seed_phrase") {
                    return await handleSeedPhraseVerification(ctx, userId, text);
                }

                // Trading operations
                if (step.state === "awaiting_limit_trigger_value") {
                    return await handleLimitTriggerValueInput(ctx, step);
                }

                if (step.state === "awaiting_dca_duration" || step.state === "awaiting_dca_interval") {
                    return await handleDcaInput(ctx, step);
                }

                if (step.state === "awaiting_buy_token_address") {
                    return await handleBuyTokenAddressFlow(ctx, step);
                }

                if (step.state === "awaiting_sell_token_address") {
                    return await handleSellTokenAddressFlow(ctx, step);
                }

                if (step.state === "awaiting_custom_buy_amount" || step.state === "awaiting_custom_sell_amount") {
                    return await handleCustomAmountInput(ctx, step, userId);
                }

                // Copy trade wallet address
                if (step.state === "awaiting_copytrade_wallet_address") {
                    const walletAddress = ctx.message.text.trim();

                    if (!/^0x[a-fA-F0-9]{40,64}$/.test(walletAddress)) {
                        return ctx.reply("⚠️ Invalid wallet address format. Please try again.");
                    }

                    try {
                        await saveCopyTradeWallet(userId, walletAddress);
                        await saveUserStep(userId, { state: "idle" });
                        await showCopyTradeWalletSettings(ctx, ctx.from.id, walletAddress);
                        return;
                    } catch (error) {
                        if (error.code === "P2002") {
                            return ctx.reply("⚠️ You've already added this wallet for copy trading.");
                        } else {
                            console.error(error);
                            return ctx.reply("❌ Failed to save wallet. Please try again later.");
                        }
                    }
                }

                // Copy trade inputs - using DRY pattern
                const copyTradeInputMap = {
                    'awaiting_copytrade_label': 'label',
                    'awaiting_copytrade_slippage': 'slippage',
                    'awaiting_copytrade_autobuy_amount': 'autobuy',
                    'awaiting_copytrade_autosell_percentage': 'autosell'
                };

                if (copyTradeInputMap[step.state]) {
                    return await handleCopyTradeInput(ctx, step, userId, text, copyTradeInputMap[step.state]);
                }

                // Bridge operations - using DRY pattern
                const bridgeCurrencyMap = {
                    'awaiting_bridge_sol_amount': 'SOL',
                    'awaiting_bridge_eth_amount': 'ETH',
                    'awaiting_bridge_btc_amount': 'BTC',
                    'awaiting_bridge_sui_amount': 'SUI'
                };


                if (bridgeCurrencyMap[step.state]) {
                    return await handleBridgeAmountInput(ctx, step, userId, input, bridgeCurrencyMap[step.state]);
                }
            }

            // ACTION handlers - check by action property
            if (step?.action) {
                if (step.action === "renaming_wallet") {
                    return await handleRenameWallet(ctx);
                }

                if (step.action === "awaiting_withdraw_sui_address") {
                    return await handleWithdrawAddressInput(ctx, step);
                }

                if (step.action === "awaiting_withdraw_amount") {
                    return await handleWithdrawAmountInput(ctx, step);
                }
            }
        }

        // 2️⃣ Only if no active step, check if input is a token CA
        const tokenTypePattern = /^0x[a-fA-F0-9]{1,64}::[a-zA-Z0-9_]+::[a-zA-Z0-9_]+$/;

        if (tokenTypePattern.test(input)) {
            const user = await getUser(userId);
            const wallets = user.wallets || [];
            const validWallets = wallets.filter(w => typeof w === "object" && (w.address || w.walletAddress));

            if (validWallets.length === 0) {
                return ctx.reply("❌ You need to import or generate a wallet first.");
            }

            const firstWallet = validWallets[0]?.address || validWallets[0]?.walletAddress;
            const steps = {
                state: "awaiting_buy_token_address",
                currentWallet: firstWallet,
                currentFlow: "standard",
                selectedWallets: firstWallet ? [firstWallet] : [],
                wallets: validWallets.map(w => w.address || w.walletAddress),
                showAllWallets: false,
                buySlippage: Number.isFinite(validWallets[0]?.buySlippage) ? validWallets[0].buySlippage : 1,
                sellSlippage: validWallets[0]?.sellSlippage ?? 1,
                mode: "buy",
                mainMessageId: ctx.message.message_id,
            };

            await saveUserStep(userId, steps);
            return await handleBuyTokenAddressFlow(ctx, steps);
        }

        // 3️⃣ Fallback: generic action or error
        return ctx.reply("🤖 I didn't understand that. Please use the menu or type /start.");
    });
}
// import { saveCopyTradeWallet, updateCopyTradeAutoBuyAmount, updateCopyTradeAutoSellPercentage, updateCopyTradeWalletLabel, updateCopyTradeWalletSlippage } from "../../services/copytradeService.js";
// import { fetchUserStep, getUser, saveUserStep } from "../../services/userService.js";
// import {
//     handleExecuteTokenWithdraw,
//     handleWithdrawTokenAddress
// } from "../../transactions/tokens/withdrawToken.js";
// import { handleBridgeAmountInput } from "../action/handleBridgeAmountInput.js";
// import { handleBuyTokenAddressFlow } from "../action/handleBuyTokenAddress.js";
// import { showCopyTradeWalletSettings } from "../action/handleCopyTradeWalletSelect.js";
// import { handleSellTokenAddressFlow } from "../action/handleSellTokenAddress.js";
// import { handleCustomAmountInput } from "../callbacks/handleCustomAmountInput.js";
// import {
//     handleDcaInput,
//     handleLimitTriggerValueInput
// } from "../callbacks/handleLimitTriggerValue.js";
// import { handleRenameWallet } from "../callbacks/handleRenameWallet.js";
// import { handleSlippageInput } from "../callbacks/handleSlippageInput.js";
// import { handleSeedPhraseVerification } from "../callbacks/handleVerification.js";
// import { handleWalletGenerationRequest } from "../callbacks/handleWalletGenRequest.js";
// import { handleWalletImport } from "../callbacks/handleWalletImport.js";
// import {
//     handleWithdrawAddressInput,
//     handleWithdrawAmountInput
// } from "../callbacks/handleWithdrawAddressInput.js";


// export function registerMessageHandler(bot) {
//     bot.on("message", async (ctx) => {
//         const userId = ctx.from.id;
//         const chatId = ctx.chat.id;
//         const text = ctx.message.text?.trim();
//         const replyTo = ctx.message?.reply_to_message?.text;
//         if (!text) return;

//         const step = await fetchUserStep(userId);
//         const input = text.trim();

//         // 1️⃣ Handle active step first (takes precedence over everything else)
//         if (step) {
//             // dispatch step based on state/action/name
//             // withdraw tokens: step 1
//             if (step?.name === "withdraw_token_amount") {
//                 return await handleWithdrawTokenAddress(ctx, step, text);
//             }

//             //withdraw tokens: step 2
//             if (step?.name === "withdraw_token_address") {
//                 await handleExecuteTokenWithdraw(ctx, step, text);
//                 step.name = null;
//                 return await saveUserStep(userId, step);
//             }

//             // Connecting Wallet
//             if (step?.state === "awaiting_wallet_input") {
//                 return await handleWalletImport(ctx, userId);
//             }

//             // Multiple Wallet generation
//             if (step?.state === "awaiting_wallet_generation_count" && step?.flow === "generate_wallets") {
//                 return await handleWalletGenerationRequest(ctx, userId);
//             }

//             // renaming of wallet
//             if (step?.action === "renaming_wallet") {
//                 return await handleRenameWallet(ctx);
//             }

//             // slippage
//             if (step?.state === "awaiting_slippage_input") {
//                 return await handleSlippageInput(ctx, step, userId, text);
//             }

//             // Withdraw SUI: step 1 (recipient)
//             if (step?.action === "awaiting_withdraw_sui_address") {
//                 return await handleWithdrawAddressInput(ctx, step);
//             }

//             // Withdraw SUI: step 2 (amount)
//             if (step?.action === "awaiting_withdraw_amount") {
//                 return await handleWithdrawAmountInput(ctx, step);
//             }

//             // Limit order trigger value
//             if (step?.state === "awaiting_limit_trigger_value") {
//                 return await handleLimitTriggerValueInput(ctx, step);
//             }

//             // Dca Order
//             if (step?.state === "awaiting_dca_duration" || step?.state === "awaiting_dca_interval") {
//                 return await handleDcaInput(ctx, step);
//             }

//             // Buy token flow    
//             if (step?.state === "awaiting_buy_token_address") {
//                 return await handleBuyTokenAddressFlow(ctx, step);
//             }

//             // Sell token flow
//             if (step?.state === "awaiting_sell_token_address") {
//                 return await handleSellTokenAddressFlow(ctx, step);
//             }

//             // Buy or Sell with custom input amount
//             if (step?.state === "awaiting_custom_buy_amount" || step?.state === "awaiting_custom_sell_amount") {
//                 return await handleCustomAmountInput(ctx, step, userId);
//             }

//             // for copy trading of wallet
//             if (step?.state === "awaiting_copytrade_wallet_address") {
//                 const walletAddress = ctx.message.text.trim();

//                 if (!/^0x[a-fA-F0-9]{40,64}$/.test(walletAddress)) {
//                     return ctx.reply("⚠️ Invalid wallet address format. Please try again.");
//                 }

//                 try {
//                     await saveCopyTradeWallet(userId, walletAddress);
//                     await saveUserStep(userId, { state: "idle" });
//                     await showCopyTradeWalletSettings(ctx, ctx.from.id, walletAddress);

//                     return;

//                 } catch (error) {
//                     if (error.code === "P2002") {
//                         return ctx.reply("⚠️ You've already added this wallet for copy trading.");
//                     } else {
//                         console.error(error);
//                         return ctx.reply("❌ Failed to save wallet. Please try again later.");
//                     }
//                 }
//             }

//             // Handle copytrade label input
//             if (step?.state === "awaiting_copytrade_label") {
//                 const label = ctx.message.text.trim();
//                 const walletAddress = step.walletAddress;

//                 if (!walletAddress) {
//                     return ctx.reply("❌ Error: Session expired. Please start over.");
//                 }

//                 if (label.length === 0) {
//                     return ctx.reply("⚠️ Label cannot be empty. Please try again:");
//                 }

//                 if (label.length > 50) {
//                     return ctx.reply("⚠️ Label too long. Max 50 characters. Please try again:");
//                 }

//                 try {
//                     // Update the label in your database
//                     await updateCopyTradeWalletLabel(userId, walletAddress, label);

//                     // Delete both the bot's question and user's answer
//                     try {
//                         await ctx.deleteMessage(step.botMessageId); // Delete "Enter a new label" message
//                         await ctx.deleteMessage(ctx.message.message_id); // Delete user's label message
//                     } catch (deleteError) {
//                         console.log("Could not delete messages:", deleteError.message);
//                     }

//                     // Reset user state
//                     await saveUserStep(userId, { state: "idle" });

//                     // Edit the original copytrade UI with updated info (not sending new message)
//                     await showCopyTradeWalletSettings(ctx, userId, walletAddress, step.originalMessageId);

//                     return; // Important: prevent fallthrough

//                 } catch (error) {
//                     console.error("Error updating copytrade label:", error);
//                     return ctx.reply("❌ Failed to update label. Please try again later.");
//                 }
//             }

//             if (step?.state === "awaiting_copytrade_slippage") {
//                 const slippageInput = ctx.message.text.trim();
//                 const walletAddress = step.walletAddress;

//                 if (!walletAddress) {
//                     return ctx.reply("❌ Error: Session expired. Please start over.");
//                 }

//                 // Validate slippage (must be a number between 0.1 and 100)
//                 const slippage = parseFloat(slippageInput);

//                 if (isNaN(slippage)) {
//                     return ctx.reply("⚠️ Invalid input. Please enter a number (e.g., 5, 10, 15):");
//                 }

//                 if (slippage < 0.1 || slippage > 100) {
//                     return ctx.reply("⚠️ Slippage must be between 0.1% and 100%. Please try again:");
//                 }

//                 try {
//                     // Update the slippage in database
//                     await updateCopyTradeWalletSlippage(userId, walletAddress, slippage);

//                     // Delete both the bot's question and user's answer
//                     try {
//                         await ctx.deleteMessage(step.botMessageId);
//                         await ctx.deleteMessage(ctx.message.message_id);
//                     } catch (deleteError) {
//                         console.log("Could not delete messages:", deleteError.message);
//                     }

//                     // Reset user state
//                     await saveUserStep(userId, { state: "idle" });

//                     // Edit the original copytrade UI with updated slippage
//                     await showCopyTradeWalletSettings(ctx, userId, walletAddress, step.originalMessageId);

//                     return;

//                 } catch (error) {
//                     console.error("Error updating copytrade slippage:", error);
//                     return ctx.reply("❌ Failed to update slippage. Please try again later.");
//                 }
//             }

//             if (step?.state === "awaiting_copytrade_autobuy_amount") {
//                 const amountInput = ctx.message.text.trim();
//                 const walletAddress = step.walletAddress;

//                 if (!walletAddress) {
//                     return ctx.reply("❌ Error: Session expired. Please start over.");
//                 }

//                 // Validate amount (must be a positive number)
//                 const amount = parseFloat(amountInput);

//                 if (isNaN(amount)) {
//                     return ctx.reply("⚠️ Invalid input. Please enter a valid number (e.g., 1, 5, 10):");
//                 }

//                 if (amount <= 0) {
//                     return ctx.reply("⚠️ Amount must be greater than 0. Please try again:");
//                 }

//                 if (amount > 1000) {
//                     return ctx.reply("⚠️ Amount too high. Maximum is 1000 SUI. Please try again:");
//                 }

//                 try {
//                     // Update the auto-buy amount in database
//                     await updateCopyTradeAutoBuyAmount(userId, walletAddress, amount);

//                     // Delete both the bot's question and user's answer
//                     try {
//                         await ctx.deleteMessage(step.botMessageId);
//                         await ctx.deleteMessage(ctx.message.message_id);
//                     } catch (deleteError) {
//                         console.log("Could not delete messages:", deleteError.message);
//                     }

//                     // Reset user state
//                     await saveUserStep(userId, { state: "idle" });

//                     // Edit the original copytrade UI with updated amount
//                     await showCopyTradeWalletSettings(ctx, userId, walletAddress, step.originalMessageId);

//                     return;

//                 } catch (error) {
//                     console.error("Error updating auto-buy amount:", error);
//                     return ctx.reply("❌ Failed to update amount. Please try again later.");
//                 }
//             }

//             if (step?.state === "awaiting_copytrade_autosell_percentage") {
//                 const percentageInput = ctx.message.text.trim();
//                 const walletAddress = step.walletAddress;

//                 if (!walletAddress) {
//                     return ctx.reply("❌ Error: Session expired. Please start over.");
//                 }

//                 // Validate percentage (must be between 0 and 100)
//                 const percentage = parseFloat(percentageInput);

//                 if (isNaN(percentage)) {
//                     return ctx.reply("⚠️ Invalid input. Please enter a number (e.g., 25, 50, 100):");
//                 }

//                 if (percentage < 0 || percentage > 100) {
//                     return ctx.reply("⚠️ Percentage must be between 0 and 100. Please try again:");
//                 }

//                 try {
//                     // Update the auto-sell percentage in database
//                     await updateCopyTradeAutoSellPercentage(userId, walletAddress, percentage);

//                     // Delete both the bot's question and user's answer
//                     try {
//                         await ctx.deleteMessage(step.botMessageId);
//                         await ctx.deleteMessage(ctx.message.message_id);
//                     } catch (deleteError) {
//                         console.log("Could not delete messages:", deleteError.message);
//                     }

//                     // Reset user state
//                     await saveUserStep(userId, { state: "idle" });

//                     // Edit the original copytrade UI with updated percentage
//                     await showCopyTradeWalletSettings(ctx, userId, walletAddress, step.originalMessageId);

//                     return;

//                 } catch (error) {
//                     console.error("Error updating auto-sell percentage:", error);
//                     return ctx.reply("❌ Failed to update percentage. Please try again later.");
//                 }
//             }

//             // Handle bridge amount inputs (SOL, ETH, BTC, SUI) - DRY pattern
//             const BRIDGE_CURRENCIES = {
//                 'awaiting_bridge_sol_amount': 'SOL',
//                 'awaiting_bridge_eth_amount': 'ETH',
//                 'awaiting_bridge_btc_amount': 'BTC',
//                 'awaiting_bridge_sui_amount': 'SUI'
//             };

//             const currency = BRIDGE_CURRENCIES[step?.state];
//             if (currency) {
//                 return await handleBridgeAmountInput(ctx, step, userId, input, currency);
//             }

//             if (step?.state === "confirming_seed_phrase") {
//                 return await handleSeedPhraseVerification(ctx, userId, text);
//             }

//         }
//         // 2 Only if no active step, check if input is a token CA
//         const tokenTypePattern = /^0x[a-fA-F0-9]{1,64}::[a-zA-Z0-9_]+::[a-zA-Z0-9_]+$/;

//         if (tokenTypePattern.test(input)) {
//             const user = await getUser(userId);
//             const wallets = user.wallets || [];
//             const validWallets = wallets.filter(w => typeof w === "object" && (w.address || w.walletAddress));

//             if (validWallets.length === 0) {
//                 return ctx.reply("❌ You need to import or generate a wallet first.");
//             }

//             const firstWallet = validWallets[0]?.address || validWallets[0]?.walletAddress;
//             const steps = {
//                 state: "awaiting_buy_token_address",
//                 currentWallet: firstWallet,
//                 currentFlow: "standard",
//                 selectedWallets: firstWallet ? [firstWallet] : [],
//                 wallets: validWallets.map(w => w.address || w.walletAddress),
//                 showAllWallets: false,
//                 buySlippage: Number.isFinite(validWallets[0]?.buySlippage) ? validWallets[0].buySlippage : 1,
//                 sellSlippage: validWallets[0]?.sellSlippage ?? 1,
//                 mode: "buy",
//                 mainMessageId: ctx.message.message_id,
//             };

//             await saveUserStep(userId, steps);
//             return await handleBuyTokenAddressFlow(ctx, steps);
//         }

//         // 3 Fallback: generic action or error
//         return ctx.reply("🤖 I didn’t understand that. Please use the menu or type /start.");
//     });
// }