import redisClient from "../../../config/redis.js";
import { getBalance } from "../../../services/balanceService.js";
import { fetchUser, fetchUserStep, saveUserStep } from "../../../services/userService.js";
import { mainMenu } from "../../menus/mainMenu.js";
import { handleBuyTokenAddressFlow } from "../handleBuyTokenAddress.js";
import { handleSellTokenAddressFlow } from "../handleSellTokenAddress.js";


export const handleRefreshInfo = async (ctx) => {
    const userId = ctx.from.id;
    const step = await fetchUserStep(userId);

    if (
        !step ||
        !step.tokenAddress ||
        !Array.isArray(step.selectedWallets) ||
        step.selectedWallets.length === 0
    ) {
        await ctx.answerCbQuery("❌ Nothing to refresh.");
        return;
    }

    await ctx.answerCbQuery("🔄 Refreshing...");

    try {
        if (!step.tokenAddress.includes("::")) {
            await ctx.reply("❌ Stored token address is invalid. Please enter the token address again.");
            return;
        }

        const mode = step.mode || "buy";
        step.state = mode === "buy" ? "awaiting_buy_token_address" : "awaiting_sell_token_address";
        await saveUserStep(userId, step);

        if (mode === "buy") {
            await handleBuyTokenAddressFlow(ctx, step, step.tokenAddress);
        } else {
            await handleSellTokenAddressFlow(ctx, step, step.tokenAddress);
        }
    } catch (err) {
        await ctx.reply("❌ Failed to refresh token data. Please try again.");
    }
};


const BALANCE_CACHE_TTL = 5 * 60; // 5 minutes

export async function handleBackToMenu(ctx) {
    const userId = ctx.from.id.toString();
    const user = await fetchUser(userId);

    if (!user) {
        return ctx.reply("❌ Wallet not found. Use /start to generate one.");
    }

    const wallets = user.wallets || [];

    // Fetch all balances with Redis caching
    const balances = await Promise.all(
        wallets.map(async (wallet) => {
            const address = wallet.address;
            if (!address) return null;

            try {
                // Check Redis cache first
                const cacheKey = `balance_${userId}_${address}`;
                const cachedBalance = await redisClient.get(cacheKey);

                if (cachedBalance) {
                    console.log(`✅ Using cached balance for ${address}`);
                    return {
                        balance: JSON.parse(cachedBalance),
                        wallet
                    };
                }

                // If not cached, fetch from API
                const balance = await getBalance(address);
                const balanceData = balance || { sui: "0", usd: "0" };

                // Store in Redis cache
                try {
                    await redisClient.setEx(
                        cacheKey,
                        BALANCE_CACHE_TTL,
                        JSON.stringify(balanceData)
                    );
                    console.log(`✅ Cached balance for ${address}`);
                } catch (cacheErr) {
                    console.error(`Failed to cache balance:`, cacheErr.message);
                }

                return {
                    balance: balanceData,
                    wallet
                };
            } catch (err) {
                console.error(`Failed to fetch balance for ${address}:`, err.message);
                return {
                    balance: { sui: "0", usd: "0" },
                    wallet
                };
            }
        })
    );

    let message = '';
    message += 'Welcome to *Centron Bot* 👋\n\n';
    message += "Trade seamlessly on Sui with low fees + high speeds. We support all DEXes, including memecoin launchpads.\n\n";

    balances.forEach((entry) => {
        if (!entry) return;
        const { balance, wallet } = entry;
        const address = wallet.address;
        const name = wallet.name?.trim();
        const label = `${name || `Sui Wallet`}`;
        const escapedLabel = label.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
        const escapedAddress = address.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
        message += `*${escapedLabel}: ${balance.sui} SUI ($${balance.usd})*\n`;
        message += `\`${escapedAddress}\` \(tap to copy\)\n\n`;
    });

    message += 'To start trading, tap "Buy a Token" and paste the token address.';

    try {
        return await ctx.editMessageText(message, {
            parse_mode: "MarkdownV2",
            ...mainMenu,
        });
    } catch (error) {
        if (error.description?.includes('message is not modified')) {
            return;
        }
        try {
            return await ctx.reply(message, {
                parse_mode: "MarkdownV2",
                ...mainMenu,
            });
        } catch (replyErr) {
            console.error("Failed to send menu message:", replyErr);
        }
    }
}