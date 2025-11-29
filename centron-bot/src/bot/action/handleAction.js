import { handleStart }
    from "../../core/start/handleStart.js";
import { fetchUserStep, getUser, saveUserStep }
    from "../../services/userService.js";
import {
    handleWithdrawTokenAmount,
    handleWithdrawTokens
}
    from "../../transactions/tokens/withdrawToken.js";
import { closeMessage } from "../../core/qrcode/closeQrcodeMessage.js";
import { showReferralQRCode } from "../../core/qrcode/showReferralQrCode.js";
import { handleWallets } from "../handlers/wallets/walletHandler.js";
import {
    handleToggleAllWallets,
    handleToggleMode, handleToggleWallet
}
    from "../handlers/wallets/walletToggle.js";
import {
    handleConfirmDeleteWallet,
    handleDeleteWalletPrompt,
    handleRenameWalletPrompt, handleWalletInfo
}
    from "../handlers/wallets/walletName.js";
import { handleReferrals } from "../../core/referrals/handleReferrals.js";
import {
    handleConfirmWithdraw,
    handleWithdrawSui
} from "../../services/walletWithdrawService.js";
import {
    promptBuySlippageAll,
    promptBuySlippageForWallet,
    promptSellSlippageAll, promptSellSlippageForWallet,
    startBuySlippageFlow, startSellSlippageFlow
}
    from "./prompt/promptSlippage.js";
import { handleConfig } from "../menus/configMenu.js";
import { handleBuySellOrder } from "./prompt/buy.js";
import { createNewWallet, promptNewWalletsCount } from "./prompt/wallets.js";
import { handleBackAction } from "./prompt/back.js";
import { handleEnterMcap, handleLimitOrder } from "../../core/mcap/limitOrder.js";
import {
    handleDcaOrder,
    handleDcaSetDuration, handleDcaSetInterval
}
    from "../../core/dca/dcaOrder.js";
import { handleSell } from "./handleSell.js";
import {
    handleBuySellAmount,
    handleConfirmBuySell,
    handleSelectToken, handleToggleBuySell
}
    from "./handleTogglePosition.js";
import { handleViewPosition } from "./handleViewPosition.js";
import { handleBuy } from "./handleBuy.js";
import { handleCancelToMain } from "./cancel/cancelToMain.js";
import { handleConnectWallet } from "../handlers/wallets/walletConnect.js";
import { handleBackToMenu, handleRefreshInfo } from "./refresh/refresh.js";
import {
    handlePositionsWalletList,
    showWalletsForPositions
} from "../handlers/positions/showWalletsForPositions.js";
import { userSteps } from "../../state/userState.js";
import { showWalletsForOrders } from "../../jobs/manageOrders/limitAndDca.js";
import { handleViewPnL } from "./handlePnl.js";
import {
    handleCopyTradeAddWallet,
    handleCopyTradeWalletSelect,
    showCopyTradeWalletSettings
} from "./handleCopyTradeWalletSelect.js";
import { handleCopyTrade } from "./handleCopyTrade.js";
import { prisma } from "../../config/prisma.js";
import { getPrismaUserId } from "../../services/copytradeService.js";
import { bridgeMenu } from "../menus/bridgeMenu.js";
import { mainMenu } from "../menus/mainMenu.js";
import { getBridgeTransactionStatus } from "../../transactions/bridge/bridgeService.js";
import { getStatusEmoji } from "./handleBridgeAmountInput.js";

export function removeUndefined(obj) {
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
    );
}

export function formatNumber(num) {
    return Number(num).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export async function handleAction(ctx, action, userId) {
    const step = await fetchUserStep(userId);
    switch (true) {

        case action === "start": {
            const userId = ctx.from.id;
            return await handleStart(ctx);
        }

        case action === "wallets": {
            const userId = ctx.from.id;
            return await handleWallets(ctx, userId);
        }

        case action === "buy": {
            return await handleBuy(ctx, userId);
        }

        case action === "sell": {
            return await handleSell(ctx, userId);
        }

        case action === "positions": {
            const userId = ctx.from.id.toString();
            return await showWalletsForPositions(ctx, userId);
        }

        case action.startsWith("view_pos_idx_"): {
            return handleViewPosition(ctx, action);
        }

        case action.startsWith("toggle_buy_sell_idx_"): {
            return handleToggleBuySell(ctx, action);
        }

        case action.startsWith("select_token_idx_"): {
            return handleSelectToken(ctx, action);
        }

        case action.startsWith("buy_amount_"):
        case action.startsWith("sell_amount_"): {
            return handleBuySellAmount(ctx, action);
        }

        case action.startsWith("buy_custom_idx_"):
        case action.startsWith("sell_custom_idx_"): {
            return handleBuySellAmount(ctx, action.replace("custom", "amount_custom"));
        }

        case action.startsWith("confirm_buy_"):
        case action.startsWith("confirm_sell_"): {
            return handleConfirmBuySell(ctx, action);
        }

        case action === "back_to_positions_wallets": {
            const userId = ctx.from.id;
            return await handlePositionsWalletList(ctx, userId);
        }

        case /^refresh_position_idx_(\d+)$/.test(action): {
            const match = action.match(/^refresh_position_idx_(\d+)$/);
            if (!match) return ctx.answerCbQuery("⚠️ Invalid refresh action");

            const index = match[1];
            await ctx.answerCbQuery("🔄 Refreshing tokens...");
            return await handleViewPosition(ctx, `view_pos_idx_${index}`);
        }

        case /^view_pnl_card_idx_(\d+)$/.test(action): {
            const index = action.match(/^view_pnl_card_idx_(\d+)$/)[1];
            await ctx.answerCbQuery("Loading PnL...");
            return await handleViewPnL(ctx, index);
        }

        case action === "referral": {
            return await handleReferrals(ctx, userId);
        }

        case (action === 'show_qr'): {
            return await showReferralQRCode(ctx);
        }

        case (action === 'close_msg'): {
            return await closeMessage(ctx);
        }

        case action === "config": {
            return await handleConfig(ctx, userId);
        }

        case action === "new_wallet": {
            return await createNewWallet(ctx);
        }

        case action === "x_new_wallets": {
            try {
                return await promptNewWalletsCount(ctx);
            } catch (error) {
                console.error('Error in generating multiple wallets', error);
                return await ctx.reply("⚠️ Error generating wallets");
            }
        }

        case action === "back_to_menu": {
            return handleBackToMenu(ctx);
        }

        case action === "connect_wallet": {
            const userId = ctx.from.id;
            return await handleConnectWallet(ctx, userId);
        }

        case action === "buy_slippage": {
            return await startBuySlippageFlow(ctx);
        }

        case action === "set_buy_slippage_all": {
            return await promptBuySlippageAll(ctx);
        }

        case typeof action === "string" && action.startsWith("set_buy_slippage_"): {
            const index = parseInt(action.replace("set_buy_slippage_", ""));
            return await promptBuySlippageForWallet(ctx, index);
        }

        case action === "sell_slippage": {
            return await startSellSlippageFlow(ctx);
        }

        case action === "set_sell_slippage_all": {
            return await promptSellSlippageAll(ctx);
        }

        case typeof action === "string" && action.startsWith("set_sell_slippage_"): {
            const index = parseInt(action.replace("set_sell_slippage_", ""));
            return await promptSellSlippageForWallet(ctx, index);
        }

        case action === "back_to_config": {
            const userId = ctx.from.id.toString();
            return await handleConfig(ctx, userId);
        }

        case /^wallet_\d+$/.test(action): {
            return handleWalletInfo(ctx, action);
        }

        case /^delete_wallet_\d+$/.test(action): {
            return handleDeleteWalletPrompt(ctx, action);
        }

        case /^confirm_delete_wallet_\d+$/.test(action): {
            return handleConfirmDeleteWallet(ctx, action);
        }

        case /^rename_wallet_\d+$/.test(action): {
            return handleRenameWalletPrompt(ctx, action);
        }

        case action === "refresh_info": {
            return handleRefreshInfo(ctx);
        }

        case /^buy_\d*\.?\d+(:limit|:market|:dca)?$/.test(action):
        case /^buy_x(:limit|:market|:dca)?$/.test(action):
        case /^sell_\d*\.?\d+(:limit|:market|:dca)?$/.test(action):
        case /^sell_x(:limit|:market|:dca)?$/.test(action): {
            try {
                return await handleBuySellOrder(ctx, action);
            } catch (error) {
                console.error("Error handling in the action of DCA", error);
                return await ctx.reply("⚠️ Error processing order");
            }
        }

        case action.startsWith("withdraw_sui_"): {
            return handleWithdrawSui(ctx, action);
        }

        case action === "confirm_withdraw": {
            return handleConfirmWithdraw(ctx);
        }

        case action === "cancel_withdraw": {
            const userId = ctx.from.id;
            await saveUserStep(userId, null);
            return await ctx.editMessageText("❌ Withdrawal cancelled.");
        }

        case action.startsWith("withdraw_tokens_"): {
            return handleWithdrawTokens(ctx, action);
        }

        case action.startsWith("withdraw_token_"): {
            return handleWithdrawTokenAmount(ctx, action);
        }

        case action === "limit_order": {
            return handleLimitOrder(ctx);
        }

        case action === "enter_mcap": {
            return handleEnterMcap(ctx);
        }

        case action === "dca_order": {
            return handleDcaOrder(ctx);
        }

        case action === "dca_set_duration": {
            return handleDcaSetDuration(ctx);
        }

        case action === "dca_set_interval": {
            return handleDcaSetInterval(ctx);
        }

        case action === "manage_orders": {
            return await showWalletsForOrders(ctx, userId);
        }

        case action === "back": {
            return await handleBackAction(ctx);
        }

        case action.startsWith("toggle_wallet:"): {
            return handleToggleWallet(ctx, action);
        }

        case action === "toggle_mode": {
            return handleToggleMode(ctx);
        }

        case action === "toggle_all_wallets": {
            return handleToggleAllWallets(ctx);
        }

        case action === "cancel": {
            delete userSteps[userId];
            await ctx.answerCbQuery("❌ Cancelled");
            return await ctx.reply("Action cancelled.");
        }

        case action === "cancel_to_main": {
            return handleCancelToMain(ctx);
        }

        case action === "copytrade": {
            const userId = ctx.from.id.toString();
            return handleCopyTrade(ctx, userId);
        }

        case action.startsWith("copytrade_wallet_"): {
            const userId = ctx.from.id.toString();
            return handleCopyTradeWalletSelect(ctx, userId, action, step);
        }

        case action.startsWith("copytrade_add_"): {
            const userId = ctx.from.id.toString();
            return handleCopyTradeAddWallet(ctx, userId, action, step);
        }

        case action === "copytrade_change_label": {
            const walletAddress = step?.walletAddress || step?.data?.walletAddress;

            if (!walletAddress) {
                await ctx.answerCbQuery("❌ Error: Wallet address not found");
                return;
            }

            // Send the prompt with force_reply for auto-reply UI
            const botMessage = await ctx.reply(
                "✏️ Enter a new label for this wallet (max 50 characters):",
                {
                    reply_markup: {
                        force_reply: true,
                        // input_field_placeholder: "Enter label..."
                    }
                }
            );

            // Set user state to await label input
            await saveUserStep(userId, {
                state: "awaiting_copytrade_label",
                walletAddress: walletAddress,
                botMessageId: botMessage.message_id,
                originalMessageId: ctx.callbackQuery.message.message_id // The copytrade UI
            });

            await ctx.answerCbQuery();
            break;
        }

        case action === "copytrade_change_slippage": {
            const walletAddress = step?.walletAddress || step?.data?.walletAddress;

            if (!walletAddress) {
                await ctx.answerCbQuery("❌ Error: Wallet address not found");
                return;
            }

            // Send the prompt with force_reply for auto-reply UI
            const botMessage = await ctx.reply(
                "📊 Enter slippage percentage (e.g., 5, 10, 15):",
                {
                    reply_markup: {
                        force_reply: true,
                        // input_field_placeholder: "Enter label..."
                    }
                }
            );

            // Set user state to await slippage input
            await saveUserStep(userId, {
                state: "awaiting_copytrade_slippage",
                walletAddress: walletAddress,
                botMessageId: botMessage.message_id,
                originalMessageId: ctx.callbackQuery.message.message_id
            });

            await ctx.answerCbQuery();
            break;
        }

        case action === "copytrade_toggle_autobuy": {
            const walletAddress = step?.walletAddress || step?.data?.walletAddress;

            if (!walletAddress) {
                await ctx.answerCbQuery("❌ Error: Wallet address not found");
                return;
            }

            try {
                const userId = await getPrismaUserId(ctx.from.id);

                // Get current wallet settings
                const wallet = await prisma.copytradeWallet.findUnique({
                    where: {
                        userId_walletAddress: {
                            userId: userId,
                            walletAddress: walletAddress
                        }
                    }
                });

                // Cycle through the 3 states
                let newNotifications, newAutoTrade, newCopyAmount;

                if (!wallet?.autoBuyNotifications && !wallet?.autoBuyEnabled) {
                    // ☑️ → ✅ (both OFF → both ON)
                    newNotifications = true;
                    newAutoTrade = true;
                    newCopyAmount = 5; // Default to 5 SUI
                } else if (wallet?.autoBuyNotifications && wallet?.autoBuyEnabled) {
                    // ✅ → 🔔 (both ON → notifications ON, trades OFF)
                    newNotifications = true;
                    newAutoTrade = false;
                    newCopyAmount = 0;
                } else {
                    // 🔔 → ☑️ (notifications ON, trades OFF → both OFF)
                    newNotifications = false;
                    newAutoTrade = false;
                    newCopyAmount = 0;
                }

                // Update in database
                await prisma.copytradeWallet.update({
                    where: {
                        userId_walletAddress: {
                            userId: userId,
                            walletAddress: walletAddress
                        }
                    },
                    data: {
                        autoBuyNotifications: newNotifications,
                        autoBuyEnabled: newAutoTrade,
                        copyAmount: newCopyAmount
                    }
                });

                await ctx.answerCbQuery();
                // Edit the message with updated settings
                await showCopyTradeWalletSettings(ctx, ctx.from.id, walletAddress, ctx.callbackQuery.message.message_id);

            } catch (error) {
                console.error("Error toggling auto-buy:", error);
                await ctx.answerCbQuery("❌ Failed to update settings");
            }
            break;
        }

        case action === "copytrade_toggle_autosell": {
            const walletAddress = step?.walletAddress || step?.data?.walletAddress;

            if (!walletAddress) {
                await ctx.answerCbQuery("❌ Error: Wallet address not found");
                return;
            }

            try {
                const userId = await getPrismaUserId(ctx.from.id);

                // Get current wallet settings
                const wallet = await prisma.copytradeWallet.findUnique({
                    where: {
                        userId_walletAddress: {
                            userId: userId,
                            walletAddress: walletAddress
                        }
                    }
                });

                // Cycle through the 3 states
                let newNotifications, newAutoTrade, newSellPercentage;

                if (!wallet?.autoSellNotifications && !wallet?.autoSellEnabled) {
                    // ☑️ → ✅ (both OFF → both ON)
                    newNotifications = true;
                    newAutoTrade = true;
                    newSellPercentage = 100; // Default to 100% (sell all)
                } else if (wallet?.autoSellNotifications && wallet?.autoSellEnabled) {
                    // ✅ → 🔔 (both ON → notifications ON, trades OFF)
                    newNotifications = true;
                    newAutoTrade = false;
                    newSellPercentage = 0;
                } else {
                    // 🔔 → ☑️ (notifications ON, trades OFF → both OFF)
                    newNotifications = false;
                    newAutoTrade = false;
                    newSellPercentage = 0;
                }

                // Update in database
                await prisma.copytradeWallet.update({
                    where: {
                        userId_walletAddress: {
                            userId: userId,
                            walletAddress: walletAddress
                        }
                    },
                    data: {
                        autoSellNotifications: newNotifications,
                        autoSellEnabled: newAutoTrade,
                        sellPercentage: newSellPercentage
                    }
                });

                await ctx.answerCbQuery();

                // Edit the message with updated settings
                await showCopyTradeWalletSettings(ctx, ctx.from.id, walletAddress, ctx.callbackQuery.message.message_id);

            } catch (error) {
                console.error("Error toggling auto-sell:", error);
                await ctx.answerCbQuery("❌ Failed to update settings");
            }
            break;
        }

        case action === "copytrade_change_autobuy": {
            const walletAddress = step?.walletAddress || step?.data?.walletAddress;

            if (!walletAddress) {
                await ctx.answerCbQuery("❌ Error: Wallet address not found");
                return;
            }

            // Send the prompt with force_reply for auto-reply UI
            const botMessage = await ctx.reply(
                "💰 Enter the amount of SUI to copy per trade (e.g., 1, 5, 10):",
                {
                    reply_markup: {
                        force_reply: true,
                        input_field_placeholder: "Enter SUI amount..."
                    }
                }
            );

            // Set user state to await auto-buy amount input
            await saveUserStep(userId, {
                state: "awaiting_copytrade_autobuy_amount",
                walletAddress: walletAddress,
                botMessageId: botMessage.message_id,
                originalMessageId: ctx.callbackQuery.message.message_id
            });

            await ctx.answerCbQuery();
            break;
        }

        case action === "copytrade_change_autosell": {
            const walletAddress = step?.walletAddress || step?.data?.walletAddress;

            if (!walletAddress) {
                await ctx.answerCbQuery("❌ Error: Wallet address not found");
                return;
            }

            // Send the prompt with force_reply for auto-reply UI
            const botMessage = await ctx.reply(
                "📈 Enter the percentage to sell (e.g., 25, 50, 100):",
                {
                    reply_markup: {
                        force_reply: true,
                        input_field_placeholder: "Enter sell %..."
                    }
                }
            );

            // Set user state to await auto-sell percentage input
            await saveUserStep(userId, {
                state: "awaiting_copytrade_autosell_percentage",
                walletAddress: walletAddress,
                botMessageId: botMessage.message_id,
                originalMessageId: ctx.callbackQuery.message.message_id
            });

            await ctx.answerCbQuery();
            break;
        }

        case action === "copytrade_back": {
            await ctx.answerCbQuery();

            // Delete the current copytrade settings message
            try {
                await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
            } catch (error) {
                console.log("Could not delete message:", error.message);
            }

            // Clear user state
            await saveUserStep(userId, { state: "idle" });

            // Go back to the copytrade wallet selection menu
            // You can either show the wallet list again or go to main menu
            // Option 1: Show wallet selection again
            await handleCopyTradeWalletSelect(ctx, userId, "copytrade_select", step);

            // OR Option 2: Go to main copytrade menu
            // await showCopyTradeMenu(ctx, userId);

            break;
        }

        case action === "copytrade_save": {
            const walletAddress = step?.walletAddress;

            if (!walletAddress) {
                await ctx.answerCbQuery("❌ Error: Wallet address not found");
                return;
            }

            try {
                const prismaUserId = await getPrismaUserId(userId);

                // Get the wallet with updated settings
                const wallet = await prisma.copytradeWallet.findUnique({
                    where: {
                        userId_walletAddress: {
                            userId: prismaUserId,
                            walletAddress: walletAddress
                        }
                    }
                });

                if (!wallet) {
                    await ctx.answerCbQuery("❌ Wallet not found");
                    return;
                }

                // Update isActive to true (confirming the wallet)
                await prisma.copytradeWallet.update({
                    where: {
                        userId_walletAddress: {
                            userId: prismaUserId,
                            walletAddress: walletAddress
                        }
                    },
                    data: {
                        isActive: true
                    }
                });

                await ctx.answerCbQuery("✅ Wallet saved successfully!");

                // Clear user state
                await saveUserStep(userId, { state: "idle" });

                // Build the display name
                const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
                const displayName = wallet.nickname || shortAddr;

                // Determine auto-buy status
                let autoBuyStatus = "";
                if (wallet.autoBuyEnabled && wallet.autoBuyNotifications) {
                    autoBuyStatus = `✅ ${wallet.copyAmount} SUI`;
                } else if (wallet.autoBuyNotifications && !wallet.autoBuyEnabled) {
                    autoBuyStatus = `🔔 ${wallet.copyAmount} SUI`;
                } else {
                    autoBuyStatus = `☑️ ${wallet.copyAmount} SUI`;
                }

                // Determine auto-sell status
                let autoSellStatus = "";
                if (wallet.autoSellEnabled && wallet.autoSellNotifications) {
                    autoSellStatus = `✅ ${wallet.sellPercentage}%`;
                } else if (wallet.autoSellNotifications && !wallet.autoSellEnabled) {
                    autoSellStatus = `🔔 ${wallet.sellPercentage}%`;
                } else {
                    autoSellStatus = `☑️ ${wallet.sellPercentage}%`;
                }

                let message = "";
                message += "<b>Wallet Copytrading</b>\n\n";
                message += "In this menu, you can <b>add wallets that you would want to copy trades from.</b>\n\n";
                message += "The bot will notify you each time a new swap is done by one of the wallets you selected. ";
                message += "You can also set the bot to <b>auto-buy and auto-sell</b> for you by copying these wallets, too.\n\n";
                message += `<b>Selected wallet:</b> 💳 ${displayName}\n`;
                message += `<a href="https://suiscan.xyz/mainnet/account/${walletAddress}">${walletAddress}</a>\n\n`;
                message += `<b>Settings:</b>\n`;
                message += `• Auto-Buy: ${autoBuyStatus}\n`;
                message += `• Auto-Sell: ${autoSellStatus}\n`;
                message += `• Slippage: ${wallet.slippage}%`;

                const keyboard = {
                    inline_keyboard: [
                        [{ text: "➕ Add Wallet", callback_data: "copytrade_add_another" }],
                        [{ text: `💳 ${displayName} | ${autoBuyStatus}`, callback_data: "copytrade_view_saved_wallet" }],
                        [{ text: "← Main Menu", callback_data: "back_to_menu" }]
                    ]
                };

                await ctx.editMessageText(message, {
                    parse_mode: "HTML",
                    reply_markup: keyboard,
                    disable_web_page_preview: false
                }).catch(() =>
                    ctx.reply(message, {
                        parse_mode: "HTML",
                        reply_markup: keyboard,
                        disable_web_page_preview: false
                    })
                );

            } catch (error) {
                console.error("Error saving copytrade wallet:", error);
                await ctx.answerCbQuery("❌ Failed to save wallet");
            }
            break;
        }

        case action === "bridge": {
            try {
                await ctx.editMessageText(
                    "Select the chain you want to bridge from:",
                    bridgeMenu
                );
            } catch (error) {
                console.error("Failed to get bridge");
                return await ctx.reply("Feature in progress");
            }
            break;
        }

        case action === "bridge_sol": {
            await ctx.answerCbQuery();

            // Get user's SUI wallet address
            const user = await getUser(ctx.from.id);
            const userWallet = user?.wallets?.[0];

            if (!userWallet || !userWallet.address) {
                return ctx.reply(
                    "❌ You need to create a wallet first. Use /start to set up your wallet.",
                    { parse_mode: "HTML" }
                );
            }

            // Send the question
            const questionMsg = await ctx.reply(
                "<b>SOL Bridge</b>\n\nHow much SOL would you like to bridge to SUI?\n\nPlease enter the amount:",
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        force_reply: true,
                        selective: true
                    }
                }
            );

            await saveUserStep(ctx.from.id, {
                state: "awaiting_bridge_sol_amount",
                userSuiAddress: userWallet.address,
                questionMessageId: questionMsg.message_id,
                menuMessageId: ctx.callbackQuery.message.message_id // 👈 Save the menu message ID
            });

            break;
        }

        case action === "bridge_eth": {
            await ctx.answerCbQuery();

            // Get user's SUI wallet address
            const user = await getUser(ctx.from.id);
            const userWallet = user?.wallets?.[0];

            if (!userWallet || !userWallet.address) {
                return ctx.reply(
                    "❌ You need to create a wallet first. Use /start to set up your wallet.",
                    { parse_mode: "HTML" }
                );
            }

            // Send the question
            const questionMsg = await ctx.reply(
                "<b>ETH Bridge</b>\n\nHow much ETH would you like to bridge to SUI?\n\nPlease enter the amount:",
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        force_reply: true,
                        selective: true
                    }
                }
            );

            await saveUserStep(ctx.from.id, {
                state: "awaiting_bridge_eth_amount",
                userSuiAddress: userWallet.address,
                questionMessageId: questionMsg.message_id,
                menuMessageId: ctx.callbackQuery.message.message_id // 👈 Save the menu message ID
            });

            break;
        }

        case action === "bridge_btc": {
            await ctx.answerCbQuery();

            // Get user's SUI wallet address
            const user = await getUser(ctx.from.id);
            const userWallet = user?.wallets?.[0];

            if (!userWallet || !userWallet.address) {
                return ctx.reply(
                    "❌ You need to create a wallet first. Use /start to set up your wallet.",
                    { parse_mode: "HTML" }
                );
            }

            // Send the question
            const questionMsg = await ctx.reply(
                "<b>BTC Bridge</b>\n\nHow much BTC would you like to bridge to SUI?\n\nPlease enter the amount:",
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        force_reply: true,
                        selective: true
                    }
                }
            );

            await saveUserStep(ctx.from.id, {
                state: "awaiting_bridge_btc_amount",
                userSuiAddress: userWallet.address,
                questionMessageId: questionMsg.message_id,
                menuMessageId: ctx.callbackQuery.message.message_id // 👈 Save the menu message ID
            });

            break;
        }

        case action === "bridge_sui": {
            await ctx.answerCbQuery();

            // Get user's SUI wallet address
            const user = await getUser(ctx.from.id);
            const userWallet = user?.wallets?.[0];

            if (!userWallet || !userWallet.address) {
                return ctx.reply(
                    "❌ You need to create a wallet first. Use /start to set up your wallet.",
                    { parse_mode: "HTML" }
                );
            }

            // Send the question
            const questionMsg = await ctx.reply(
                "<b>SUI Bridge</b>\n\nHow much SUI would you like to bridge?\n\nPlease enter the amount:",
                {
                    parse_mode: "HTML",
                    reply_markup: {
                        force_reply: true,
                        selective: true
                    }
                }
            );

            await saveUserStep(ctx.from.id, {
                state: "awaiting_bridge_sui_amount",
                userSuiAddress: userWallet.address,
                questionMessageId: questionMsg.message_id,
                menuMessageId: ctx.callbackQuery.message.message_id // 👈 Save the menu message ID
            });

            break;
        }

        case action === "bridge_main_menu": {
            try {
                await handleCancelToMain(ctx);
                // await ctx.editMessageText("Main Menu:", mainMenu);
            } catch (error) {
                console.error("Failed to get bridge main menu");
            }
            break;
        }

        case action === "bridge_close": {
            await ctx.answerCbQuery();

            // Edit back to the bridge menu
            await ctx.editMessageText(
                "*Bridge to SUI*\n\nSelect which currency you want to bridge:",
                {
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "SOL", callback_data: "bridge_sol" },
                                { text: "ETH", callback_data: "bridge_eth" }
                            ],
                            [
                                { text: "BTC", callback_data: "bridge_btc" },
                                { text: "SUI", callback_data: "bridge_sui" }
                            ],
                            [{ text: "⬅️ Back", callback_data: "bridge_main_menu" }]
                        ]
                    }
                }
            );

            break;
        }

        case action.startsWith("bridge_refresh"): {
            await ctx.answerCbQuery("🔄 Refreshing...");

            const transactionId = action.split(":")[1];

            try {
                const status = await getBridgeTransactionStatus(transactionId);

                const refreshedMessage =
                    `<b>Bridge Transaction Status</b>\n\n` +
                    `<b>Deposit Address:</b>\n<code>${status.payinAddress || 'N/A'}</code>\n\n` +
                    `<b>Status: ${getStatusEmoji(status.status)} ${status.status}</b>\n` +
                    `<b>From: ${status.fromAmount || 'N/A'} ${status.fromCurrency?.toUpperCase() || 'N/A'}</b>\n` +
                    `<b>To: ~${status.toAmount || 'N/A'} ${status.toCurrency?.toUpperCase() || 'SUI'}</b>\n` +
                    `<b>TX ID: <code>${transactionId}</code></b>\n\n` +
                    `${getStatusDescription(status.status)}`;

                await ctx.editMessageText(refreshedMessage, {
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "❌ Close", callback_data: "bridge_close" },
                                { text: "Refresh", callback_data: `bridge_refresh:${transactionId}` },
                            ]
                        ]
                    }
                });

            } catch (error) {
                console.error("Error refreshing transaction status:", error);
                await ctx.answerCbQuery("❌ Failed to refresh status", { show_alert: true });
            }

            break;
        }

        case action === "nool": {
            try {
                await ctx.deleteMessage();
                // optional: go back to previous menu
                // await showPreviousMenu(ctx, ctx.from.id);
            } catch (err) {
                console.error("Failed to delete message:", err);
            }
            return; // Return after handling
        }

        default:
            return await ctx.reply("⚠️ Unknown command.");
    }
}