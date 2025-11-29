import { prisma } from "../config/prisma.js";
import { fetchUser } from "./userService.js";

export async function getUserWallets(userId) {
    const user = await fetchUser(userId);
    if (!user) throw new Error("User not found");

    return prisma.wallet.findMany({ where: { userId: user.id } });
}

export async function addWalletToUser(userId, wallet) {
    const user = await fetchUser(userId);
    if (!wallet?.address) throw new Error("Wallet address is required");

    const existing = await prisma.wallet.findUnique({ where: { address: wallet.address } });
    if (existing) throw new Error("Wallet already exists");

    return prisma.wallet.create({
        data: {
            userId: user.id,
            address: wallet.address,
            name: wallet.name || null,
            seedPhrase: wallet.seedPhrase || null,
            privateKey: wallet.privateKey || null,
        },
    });
}

export async function renameWallet(userId, address, newName) {
    const user = await fetchUser(userId);
    return prisma.wallet.updateMany({
        where: { userId: user.id, address },
        data: { name: newName },
    });
}

export async function deleteWallet(userId, address) {
    const user = await fetchUser(userId);
    return prisma.wallet.deleteMany({ where: { userId: user.id, address } });
}

export async function getUsersWallets(telegramId) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) },
        select: { wallets: true }
    });
    return user?.wallets || [];
}
