import { prisma } from "../config/prisma.js";

// Get all copytrade wallets for a user
export async function getCopytradeWallets(telegramId) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) },
        include: {
            copytradeWallets: {
                where: { isActive: true }
            }
        }
    });

    return user?.copytradeWallets || [];
}

export async function saveCopyTradeWallet(telegramId, walletAddress) {
    // 1️⃣ Find the actual user record using Telegram ID
    const user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) },
    });

    // 2️⃣ If no user found, stop
    if (!user) {
        throw new Error(`User with telegramId ${telegramId} not found`);
    }

    // 3️⃣ Save copytrade wallet using the internal Prisma user.id
    return await prisma.copytradeWallet.create({
        data: {
            userId: user.id,  // ✅ now this matches the foreign key
            walletAddress,
        },
    });
}

export async function updateCopyTradeWalletLabel(telegramId, walletAddress, label) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) }
    });

    if (!user) {
        throw new Error(`User with telegramId ${telegramId} not found`);
    }

    return await prisma.copytradeWallet.upsert({
        where: {
            userId_walletAddress: {
                userId: user.id,
                walletAddress: walletAddress
            }
        },
        update: {
            nickname: label
        },
        create: {
            userId: user.id,
            walletAddress: walletAddress,
            nickname: label
        }
    });
}

export async function updateCopyTradeWalletSlippage(telegramId, walletAddress, slippage) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) }
    });

    if (!user) {
        throw new Error(`User with telegramId ${telegramId} not found`);
    }

    return await prisma.copytradeWallet.upsert({
        where: {
            userId_walletAddress: {
                userId: user.id,
                walletAddress: walletAddress
            }
        },
        update: {
            slippage: slippage
        },
        create: {
            userId: user.id,
            walletAddress: walletAddress,
            slippage: slippage
        }
    });
}

export async function updateCopyTradeAutoBuyAmount(telegramId, walletAddress, amount) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) }
    });

    if (!user) {
        throw new Error(`User with telegramId ${telegramId} not found`);
    }

    return await prisma.copytradeWallet.upsert({
        where: {
            userId_walletAddress: {
                userId: user.id,
                walletAddress: walletAddress
            }
        },
        update: {
            copyAmount: amount
        },
        create: {
            userId: user.id,
            walletAddress: walletAddress,
            copyAmount: amount
        }
    });
}

export async function updateCopyTradeAutoSellPercentage(telegramId, walletAddress, percentage) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) }
    });

    if (!user) {
        throw new Error(`User with telegramId ${telegramId} not found`);
    }

    return await prisma.copytradeWallet.upsert({
        where: {
            userId_walletAddress: {
                userId: user.id,
                walletAddress: walletAddress
            }
        },
        update: {
            sellPercentage: percentage
        },
        create: {
            userId: user.id,
            walletAddress: walletAddress,
            sellPercentage: percentage
        }
    });
}

export async function getPrismaUserId(telegramId) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) }
    });

    if (!user) {
        throw new Error("User not found");
    }

    return user.id;
}