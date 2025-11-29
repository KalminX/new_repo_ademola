import redisClient from "../../../config/redis.js";
import { getBalance } from "../../../services/balanceService.js";
import { fetchUser } from "../../../services/userService.js";
import { mainMenu } from "../../menus/mainMenu.js";


const BALANCE_CACHE_TTL = 5 * 60; // 5 minutes

// Helper: Get balance from cache or fetch from API
async function getBalanceWithCache(userId, address) {
    const cacheKey = `balance_${userId}_${address}`;

    try {
        // Check Redis cache first
        const cachedBalance = await redisClient.get(cacheKey);
        if (cachedBalance) {
            console.log(`✅ Using cached balance for ${address}`);
            return JSON.parse(cachedBalance);
        }
    } catch (err) {
        console.warn("Failed to check balance cache:", err.message);
    }

    try {
        // Fetch from API if not cached
        const balance = await getBalance(address);
        const balanceData = balance || { sui: "0", usd: "0" };

        // Cache it
        try {
            await redisClient.setEx(cacheKey, BALANCE_CACHE_TTL, JSON.stringify(balanceData));
            console.log(`✅ Cached balance for ${address}`);
        } catch (cacheErr) {
            console.error(`Failed to cache balance:`, cacheErr.message);
        }

        return balanceData;
    } catch (err) {
        console.error(`Failed to fetch balance for ${address}:`, err.message);
        return { sui: "0", usd: "0" };
    }
}

export const handleCancelToMain = async (ctx) => {
    try {
        await ctx.deleteMessage();

        const userId = ctx.from.id;
        const user = await fetchUser(userId);
        const wallets = user?.wallets || [];

        if (!user) {
            return ctx.reply("❌ Wallet not found. Use /start to generate one.");
        }

        let message = "";
        message += "*Welcome to Centron Bot* 👋\n\n";
        message += "Trade seamlessly on Sui with low fees + high speeds. We support all DEXes, including memecoin launchpads.\n\n";

        // Fetch all balances in parallel with Redis cache
        const balanceResults = await Promise.all(
            wallets.map(async (wallet) => {
                const address = wallet.address;
                if (!address) return null;
                
                const balance = await getBalanceWithCache(userId, address);
                return { wallet, balance };
            })
        );

        // Build message
        for (let i = 0; i < balanceResults.length; i++) {
            const entry = balanceResults[i];
            if (!entry) continue;

            const { wallet, balance } = entry;
            const address = wallet.address;
            const name = wallet.name?.trim();
            const label = name || `Sui Wallet ${i + 1}`;

            // Escape special Markdown characters
            const escapedAddress = address.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
            const escapedLabel = label.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");

            message += `*${escapedLabel}: ${balance.sui} SUI ($${balance.usd})*\n`;
            message += `\`${escapedAddress}\` (tap to copy)\n\n`;
        }

        message += "To start trading, tap *Buy a Token* and paste the token address.";

        return ctx.reply(message, {
            parse_mode: "MarkdownV2",
            ...mainMenu,
        });
    } catch (err) {
        console.error("handleCancelToMain error:", err.message);
        return ctx.reply("❌ An error occurred returning to the main menu.");
    }
};

// export const handleCancelToMain = async (ctx) => {
//     try {
//         await ctx.deleteMessage();

//         const userId = ctx.from.id;
//         const user = await fetchUser(userId);
//         const wallets = user?.wallets || [];

//         if (!user) {
//             return ctx.reply("❌ Wallet not found. Use /start to generate one.");
//         }

//         let message = "";
//         message += "*Welcome to Centron Bot* 👋\n\n";
//         message += "Trade seamlessly on Sui with low fees + high speeds. We support all DEXes, including memecoin launchpads.\n\n";
//         // message += "Sui Wallet Address:\n";

//         for (let i = 0; i < wallets.length; i++) {
//             const wallet = wallets[i];
//             // const address = wallet.walletAddress;
//             const address = wallet.address;
//             if (!address) continue;

//             const balance = await getBalance(address) || { sui: "0", usd: "0" };
//             const name = wallet.name?.trim();
//             const label = name || `Sui Wallet ${i + 1}`;

//             // Escape special Markdown characters
//             const escapedAddress = address.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
//             const escapedLabel = label.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");

//             message += `*${escapedLabel}: ${balance.sui} SUI ($${balance.usd})*\n`;
//             message += `\`${escapedAddress}\` (tap to copy)\n\n`;
//         }

//         message += "To start trading, tap *Buy a Token* and paste the token address.";

//         return ctx.reply(message, {
//             parse_mode: "MarkdownV2",
//             ...mainMenu,
//         });
//     } catch (err) {
//         return ctx.reply("❌ An error occurred returning to the main menu.");
//     }
// };