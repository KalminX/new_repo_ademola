import { fetchUserStep, saveUserStep } from "../../services/userService.js";
import { buildDcaKeyboard } from "../keyboards/dcaKeyboard.js";

export async function renderDcaMessage(ctx, userId, step) {
    if (!step) step = await fetchUserStep(userId);
    if (!step || !step.tokenInfo) return;

    const { selectedWallets = [], wallets = [], tokenInfo, walletMap = {}, mode = "buy" } = step;

    if (!tokenInfo?.symbol) {
        return ctx.answerCbQuery("❌ Token info not found. Start from Buy Token screen.");
    }
    let text = `To place a DCA order for <b>${tokenInfo.symbol}</b>, follow these steps:\n\n`;
    text += `1️⃣ Select the wallets you want to set the order for.\n`;
    text += `2️⃣ Choose a mode — Buy or Sell.\n`;
    text += `3️⃣ Enter the total duration for the DCA strategy.\n`;
    text += `4️⃣ Define the interval between each buy/sell action.\n`;
    text += `5️⃣ Use one of the buttons to determine the total amount of tokens to buy/sell.\n\n`;

    text += `<b>Selected Wallets:</b>\n`;
    selectedWallets.forEach(key => {
        const wallet = walletMap[key];
        const explorerWalletLink = `https://suiexplorer.com/address/${wallet.address}?network=mainnet`;
        const displayName = wallet?.name || `Wallet ${key.replace("w", "")}`;
        text += `💳 <a href="${explorerWalletLink}">${displayName}</a>\n`;
    });
    text += `\n📘 <a href="https://example.com/how-to-use">How to Use?</a>`;
    const keyboard = {
        inline_keyboard: buildDcaKeyboard(
            selectedWallets,
            wallets,
            step.showAllWallets ?? false,
            mode,
            {
                duration: null,
                interval: null,
            }
        )
    };

    try {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            step.mainMessageId,
            undefined,
            text,
            {
                parse_mode: "HTML",
                disable_web_page_preview: true,
                reply_markup: keyboard,
            }
        );
    } catch (e) {
        console.error("Edit failed, sending new DCA message instead:", e);
        const sent = await ctx.reply(text, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: keyboard,
        });
        step.mainMessageId = sent.message_id;
        await saveUserStep(userId, step);
    }
}