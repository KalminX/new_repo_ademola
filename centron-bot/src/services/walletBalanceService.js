// src/services/walletService.js
import redisClient from "../config/redis.js";
import { getBalance } from "./balanceService.js";

const BALANCE_CACHE_TTL = 5 * 60; // 5 minutes

export async function getCachedBalance(userId, address) {
    const cacheKey = `balance_${userId}_${address}`;

    // Try Redis cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
        console.log(`✅ Using cached balance for ${address}`);
        return JSON.parse(cached);
    }

    // Otherwise, fetch fresh balance
    const balance = await getBalance(address) || { sui: "0", usd: "0" };

    // Store in cache
    try {
        await redisClient.setEx(cacheKey, BALANCE_CACHE_TTL, JSON.stringify(balance));
        console.log(`✅ Cached balance for ${address}`);
    } catch (err) {
        console.error(`Failed to cache balance for ${address}:`, err.message);
    }

    return balance;
}

export async function invalidateBalanceCache(userId, address) {
    const cacheKey = `balance_${userId}_${address}`;
    try {
        await redisClient.del(cacheKey);
        console.log(`✅ Invalidated balance cache for ${address}`);
    } catch (err) {
        console.error(`Failed to invalidate cache for ${address}:`, err.message);
    }
}