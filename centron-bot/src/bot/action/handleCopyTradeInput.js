import {
    updateCopyTradeAutoBuyAmount,
    updateCopyTradeAutoSellPercentage,
    updateCopyTradeWalletLabel,
    updateCopyTradeWalletSlippage
} from "../../services/copytradeService.js";
import { saveUserStep } from "../../services/userService.js";
import { showCopyTradeWalletSettings } from "./handleCopyTradeWalletSelect.js";



/**
 * Validation and update configs for different copytrade input types
 */
const COPYTRADE_INPUT_CONFIGS = {
    'label': {
        validate: (value) => {
            if (value.length === 0) return "⚠️ Label cannot be empty. Please try again:";
            if (value.length > 50) return "⚠️ Label too long. Max 50 characters. Please try again:";
            return null;
        },
        process: (value) => value,
        updateFn: updateCopyTradeWalletLabel,
        errorMsg: "Failed to update label"
    },
    'slippage': {
        validate: (value) => {
            const num = parseFloat(value);
            if (isNaN(num)) return "⚠️ Invalid input. Please enter a number (e.g., 5, 10, 15):";
            if (num < 0.1 || num > 100) return "⚠️ Slippage must be between 0.1% and 100%. Please try again:";
            return null;
        },
        process: (value) => parseFloat(value),
        updateFn: updateCopyTradeWalletSlippage,
        errorMsg: "Failed to update slippage"
    },
    'autobuy': {
        validate: (value) => {
            const num = parseFloat(value);
            if (isNaN(num)) return "⚠️ Invalid input. Please enter a valid number (e.g., 1, 5, 10):";
            if (num <= 0) return "⚠️ Amount must be greater than 0. Please try again:";
            if (num > 1000) return "⚠️ Amount too high. Maximum is 1000 SUI. Please try again:";
            return null;
        },
        process: (value) => parseFloat(value),
        updateFn: updateCopyTradeAutoBuyAmount,
        errorMsg: "Failed to update amount"
    },
    'autosell': {
        validate: (value) => {
            const num = parseFloat(value);
            if (isNaN(num)) return "⚠️ Invalid input. Please enter a number (e.g., 25, 50, 100):";
            if (num < 0 || num > 100) return "⚠️ Percentage must be between 0 and 100. Please try again:";
            return null;
        },
        process: (value) => parseFloat(value),
        updateFn: updateCopyTradeAutoSellPercentage,
        errorMsg: "Failed to update percentage"
    }
};

/**
 * Generic handler for all copytrade input types
 */
export async function handleCopyTradeInput(ctx, step, userId, text, inputType) {
    const config = COPYTRADE_INPUT_CONFIGS[inputType];
    if (!config) {
        console.error(`Unknown copytrade input type: ${inputType}`);
        return ctx.reply("❌ An error occurred. Please try again.");
    }

    const inputValue = ctx.message.text.trim();
    const walletAddress = step.walletAddress;

    // Check if session is still valid
    if (!walletAddress) {
        return ctx.reply("❌ Error: Session expired. Please start over.");
    }

    // Validate input
    const validationError = config.validate(inputValue);
    if (validationError) {
        return ctx.reply(validationError);
    }

    try {
        // Process and update the value
        const processedValue = config.process(inputValue);
        await config.updateFn(userId, walletAddress, processedValue);

        // Delete both the bot's question and user's answer
        try {
            await ctx.deleteMessage(step.botMessageId);
            await ctx.deleteMessage(ctx.message.message_id);
        } catch (deleteError) {
            console.log("Could not delete messages:", deleteError.message);
        }

        // Reset user state
        await saveUserStep(userId, { state: "idle" });

        // Edit the original copytrade UI with updated info
        await showCopyTradeWalletSettings(ctx, userId, walletAddress, step.originalMessageId);

        return;

    } catch (error) {
        console.error(`Error updating copytrade ${inputType}:`, error);
        return ctx.reply(`❌ ${config.errorMsg}. Please try again later.`);
    }
}