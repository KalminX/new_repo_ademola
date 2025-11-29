import { prisma } from "../../config/prisma.js";
import { getPrismaUserId } from "../../services/copytradeService.js";
import { saveUserStep } from "../../services/userService.js";
import { getUsersWallets } from "../../services/walletService.js";

// 🔹 NEW FUNCTION — handles when a user clicks on a wallet
export async function handleCopyTradeWalletSelect(ctx, userId, callbackData, step) {
    try {
        const walletKey = callbackData.split("_").pop(); // e.g. "w0"
        const selectedAddress = step?.walletMap?.[walletKey];

        if (!selectedAddress) {
            return ctx.answerCbQuery("⚠️ Wallet not found. Please reopen the menu.");
        }
        // Get the wallet name (for display)
        const wallets = await getUsersWallets(userId);
        const selectedWallet = wallets.find(w => w.address === selectedAddress);
        const walletName = selectedWallet?.name || `${selectedAddress.slice(0, 6)}...${selectedAddress.slice(-4)}`;

        let message = "";
        message += "<b>Wallet Copytrading</b>\n\n";
        message += "In this menu, you can <b>add wallets that you would want to copy trades from.</b>\n\n";
        message += "The bot will notify you each time a new swap is done by one of the wallets you selected. ";
        message += "You can also set the bot to <b>auto-buy and auto-sell</b> for you by copying these wallets, too.\n\n";
        message += `<b>Selected wallet:</b> 💳 ${walletName}\n`;
        // message += `<a href="https://suiscan.xyz/mainnet/account/${selectedAddress}">${selectedAddress}</a>`;
        // message += `<a href="https://suiscan.xyz/mainnet/account/${selectedAddress}">${selectedAddress}</a>`;


        const keyboard = {
            inline_keyboard: [
                [{ text: "➕ Add Wallet", callback_data: `copytrade_add_${walletKey}` }],
                [{ text: "← Main Menu", callback_data: "back_to_menu" }]
            ]
        };

        await ctx.answerCbQuery();

        await ctx.editMessageText(message, {
            parse_mode: "HTML",
            reply_markup: keyboard,
            disable_web_page_preview: true
        }).catch(() =>
            ctx.reply(message, {
                parse_mode: "HTML",
                reply_markup: keyboard,
                disable_web_page_preview: true
            })
        );

        // Optionally store that user selected this wallet
        await saveUserStep(userId, {
            state: "copytrade_selected_wallet",
            selectedWallet: selectedAddress,
            walletMap: step?.walletMap || {}
        });

    } catch (error) {
        console.error("Error in handleCopyTradeWalletSelect:", error);
        try { await ctx.answerCbQuery("⚠️ Failed to open wallet"); } catch { }
    }
}


export async function handleCopyTradeAddWallet(ctx, userId, callbackData, step) {
    try {
        await ctx.answerCbQuery();

        // Show message & request input
        const promptMessage = "Please enter a <b>wallet address</b> for new copytrading:";
        await ctx.reply(promptMessage,
            {
                parse_mode: "HTML",
                disable_web_page_preview: true,
                reply_markup: {
                    force_reply: true,
                },
            }
        );

        // Store step so we know user is now entering a copytrade wallet address
        await saveUserStep(userId, {
            state: "awaiting_copytrade_wallet_address",
            selectedWallet: step?.selectedWallet,
            walletMap: step?.walletMap || {},
        });
    } catch (error) {
        console.error("Error in handleCopyTradeAddWallet:", error);
    }
}



export async function showCopyTradeWalletSettings(ctx, telegramId, walletAddress, messageIdToEdit = null) {
    const userId = await getPrismaUserId(telegramId);

    const wallet = await prisma.copytradeWallet.findUnique({
        where: {
            userId_walletAddress: {
                userId: userId,
                walletAddress: walletAddress
            }
        }
    });

    const shortAddr = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
    const displayName = wallet?.nickname || shortAddr;

    // Determine auto-buy icon
    let autoBuyIcon = '☑️';
    if (wallet?.autoBuyNotifications && wallet?.autoBuyEnabled) {
        autoBuyIcon = '✅'; // Both ON
    } else if (wallet?.autoBuyNotifications && !wallet?.autoBuyEnabled) {
        autoBuyIcon = '🔔'; // Notifications ON, trades OFF
    }

    // Determine auto-sell icon
    let autoSellIcon = '☑️';
    if (wallet?.autoSellNotifications && wallet?.autoSellEnabled) {
        autoSellIcon = '✅'; // Both ON
    } else if (wallet?.autoSellNotifications && !wallet?.autoSellEnabled) {
        autoSellIcon = '🔔'; // Notifications ON, trades OFF
    }

    await saveUserStep(telegramId, {
        state: "viewing_copytrade_settings",
        walletAddress: walletAddress
    });

    const message = `
<b>➕ Adding Wallet Copytrading</b>

Labels for auto-buy and auto-sell mode:
☑️ - notifications off, automatic trades off
✅ - notifications on, automatic trades on
🔔 - notifications on, automatic trades off

Press "Save" to confirm this wallet.
`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: `${displayName}`, callback_data: "noop" },
                { text: "✏️ Change Label", callback_data: "copytrade_change_label" },
            ],
            [
                { text: "Slippage", callback_data: "noop" },
                { text: `${wallet?.slippage || 10}%`, callback_data: "copytrade_change_slippage" },
            ],
            [
                { text: `${autoBuyIcon} Auto-Buy`, callback_data: "copytrade_toggle_autobuy" },
                { text: `✏️ ${wallet?.copyAmount || 0} SUI`, callback_data: "copytrade_change_autobuy" },
            ],
            [
                { text: `${autoSellIcon} Auto-Sell`, callback_data: "copytrade_toggle_autosell" },
                { text: `✏️ ${wallet?.sellPercentage || 0}%`, callback_data: "copytrade_change_autosell" },
            ],
            [
                { text: "🔙 Back", callback_data: "copytrade_back" },
                { text: "💾 Save", callback_data: "copytrade_save" },
            ],
        ],
    };

    if (messageIdToEdit) {
        try {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                messageIdToEdit,
                null,
                message,
                {
                    parse_mode: "HTML",
                    reply_markup: keyboard,
                }
            );
        } catch (error) {
            console.log("Could not edit message, sending new one:", error.message);
            await ctx.reply(message, {
                parse_mode: "HTML",
                reply_markup: keyboard,
            });
        }
    } else {
        await ctx.reply(message, {
            parse_mode: "HTML",
            reply_markup: keyboard,
        });
    }
}