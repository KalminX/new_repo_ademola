import { prisma } from "../config/prisma.js";
import { fetchUserWithSlippages } from "./slippageService.js";

/* --- USERS --- */
export async function fetchUser(telegramId) {
    return prisma.user.findUnique({
        where: { telegramId: String(telegramId) },
        include: { wallets: true, referrals: true, referredBy: true },
    });
}

export async function saveUser(userId, data = {}) {
    return prisma.user.upsert({
        where: { telegramId: String(userId) },
        update: data,
        create: { telegramId: String(userId), ...data },
        include: { wallets: true, referrals: true },
    });
}

export async function getUser(userId, referrerCode = null, walletData = null, ctx = null) {
    let user = await fetchUser(userId);
    const username = ctx?.from?.username?.toLowerCase() || null;

    if (!user) {
        user = await prisma.user.create({
            data: {
                telegramId: String(userId),
                username,
                wallets: walletData ? { create: walletData } : undefined,
            },
            include: { wallets: true, referrals: true, referredBy: true },
        });
    } else if (username && user.username !== username) {
        user = await prisma.user.update({
            where: { id: user.id },
            data: { username },
            include: { wallets: true, referrals: true, referredBy: true },
        });
    }

    return user;
}

// Update only user fields (not wallets)
export async function updateUser(userId, updatedUserData) {
    return prisma.user.update({
        where: { telegramId: String(userId) },
        data: updatedUserData,
    });
}

/* --- USER STEPS --- */
export async function saveUserStep(userId, stepData) {
    try {
        return await prisma.user.update({
            where: { telegramId: String(userId) },
            data: { step: stepData },
        });
    } catch (error) {
        console.error('Error saving user step:', error);
        throw error;
    }
}

export async function fetchUserStep(userId) {
    try {
        const user = await prisma.user.findUnique({
            where: { telegramId: String(userId) },
        });
        return user?.step ?? null;
    } catch (error) {
        console.error('Error fetching user step:', error);
        return null;
    }
}

export async function clearUserStep(userId) {
    try {
        return await prisma.user.update({
            where: { telegramId: String(userId) },
            data: { step: null },
        });
    } catch (error) {
        console.error('Error clearing user step:', error);
        throw error;
    }
}

export async function updateUserStep(userId, newStepData) {
    try {
        await prisma.user.update({
            where: { telegramId: userId.toString() },
            data: { step: newStepData }
        });
    } catch (error) {
        console.error(`❌ Failed to update step for user ${userId}:`, error);
    }
}

export async function deleteUserStep(userId) {
    try {
        await prisma.user.update({
            where: { telegramId: userId.toString() },
            data: { step: null } // clear the step
        });
    } catch (error) {
        console.error(`❌ Failed to delete step for user ${userId}:`, error);
    }
}