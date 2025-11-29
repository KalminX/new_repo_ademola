import { prisma } from "../config/prisma.js";
/* ===================== SLIPPAGE ===================== */
// Helper function to fetch user with wallets and slippages
export async function setBuySlippage(userId, slippage, target) {
    const user = await fetchUserWithSlippages(userId);
    if (!user || !user.wallets) return;

    if (target === "all") {
        await updateAllBuyWalletsSlippage(userId, slippage);
    } else if (typeof target === "number" && user.wallets[target]) {
        const wallet = user.wallets[target];
        await updateBuySlippage(userId, target, slippage, wallet.id);
    }
}

export async function setSellSlippage(userId, slippage, target) {
    const user = await fetchUserWithSlippages(userId);
    if (!user || !user.wallets) return;

    if (target === "all") {
        await updateAllSellWalletsSlippage(userId, slippage);
    } else if (typeof target === "number" && user.wallets[target]) {
        const wallet = user.wallets[target];
        await updateSellSlippage(userId, target, slippage, wallet.id);
    }
}

export async function updateBuySlippage(userId, target, slippage, walletId = null) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(userId) },
        include: { wallets: true }
    });

    if (!user) {
        throw new Error(`User with ID ${userId} not found`);
    }

    if (target === "all") {
        // Update global buy slippage (walletId = null)
        const walletIdValue = walletId ?? "ALL";
        await prisma.slippage.upsert({
            where: {
                userId_walletId_type: {
                    userId: user.id,
                    walletId: walletIdValue,
                    // walletId: null,
                    type: "buy"
                }
            },
            update: { value: slippage },
            create: {
                userId: user.id,
                // walletId: null,
                walletId: walletIdValue,
                type: "buy",
                value: slippage
            }
        });

        // Update all individual wallet buy slippages
        const updates = user.wallets.map(wallet =>
            prisma.slippage.upsert({
                where: {
                    userId_walletId_type: {
                        userId: user.id,
                        walletId: wallet.id,
                        type: "buy"
                    }
                },
                update: { value: slippage },
                create: {
                    userId: user.id,
                    walletId: wallet.id,
                    type: "buy",
                    value: slippage
                }
            })
        );

        await prisma.$transaction(updates);
    } else if (typeof target === "number") {
        if (!walletId) {
            throw new Error(`Wallet ID is required for updating specific wallet`);
        }

        const wallet = user.wallets.find(w => w.id === walletId);

        if (!wallet) {
            throw new Error(`Wallet at index ${target} not found`);
        }

        await prisma.slippage.upsert({
            where: {
                userId_walletId_type: {
                    userId: user.id,
                    walletId: wallet.id,
                    type: "buy"
                }
            },
            update: { value: slippage },
            create: {
                userId: user.id,
                walletId: wallet.id,
                type: "buy",
                value: slippage
            }
        });
    } else {
        throw new Error(`Invalid target: ${target}`);
    }
}

export async function updateSellSlippage(userId, target, slippage, walletId = null) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(userId) },
        include: { wallets: true }
    });

    if (!user) {
        throw new Error(`User with ID ${userId} not found`);
    }

    if (target === "all") {
        const walletIdValue = walletId ?? "ALL";
        // Update global sell slippage (walletId = null)
        await prisma.slippage.upsert({
            where: {
                userId_walletId_type: {
                    userId: user.id,
                    // walletId: null,
                    walletId: walletIdValue,
                    type: "sell"
                }
            },
            update: { value: slippage },
            create: {
                userId: user.id,
                // walletId: null,
                walletId: walletIdValue,
                type: "sell",
                value: slippage
            }
        });

        // Update all individual wallet sell slippages
        const updates = user.wallets.map(wallet =>
            prisma.slippage.upsert({
                where: {
                    userId_walletId_type: {
                        userId: user.id,
                        walletId: wallet.id,
                        type: "sell"
                    }
                },
                update: { value: slippage },
                create: {
                    userId: user.id,
                    walletId: wallet.id,
                    type: "sell",
                    value: slippage
                }
            })
        );

        await prisma.$transaction(updates);
    } else if (typeof target === "number") {
        if (!walletId) {
            throw new Error(`Wallet ID is required for updating specific wallet`);
        }

        const wallet = user.wallets.find(w => w.id === walletId);

        if (!wallet) {
            throw new Error(`Wallet at index ${target} not found`);
        }

        await prisma.slippage.upsert({
            where: {
                userId_walletId_type: {
                    userId: user.id,
                    walletId: wallet.id,
                    type: "sell"
                }
            },
            update: { value: slippage },
            create: {
                userId: user.id,
                walletId: wallet.id,
                type: "sell",
                value: slippage
            }
        });
    } else {
        throw new Error(`Invalid target: ${target}`);
    }
}

// Helper function to get slippage for a specific wallet or global
export async function getSlippage(userId, walletId, type) {
    const user = await prisma.user.findUnique({
        where: { telegramId: userId }
    });

    if (!user) return null;

    // Try to get wallet-specific slippage first
    if (walletId) {
        const walletSlippage = await prisma.slippage.findUnique({
            where: {
                userId_walletId_type: {
                    userId: user.id,
                    walletId,
                    type
                }
            }
        });

        if (walletSlippage) return walletSlippage.value;
    }

    // Fall back to global slippage
    const globalSlippage = await prisma.slippage.findUnique({
        where: {
            userId_walletId_type: {
                userId: user.id,
                walletId: null,
                type
            }
        }
    });

    return globalSlippage?.value || 1.0;
}

// src/services/slippageService.js
export async function fetchUserWithSlippages(userId) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(userId) },
        include: {
            wallets: true,
            slippages: true
        }
    });

    if (!user) return null;

    // Global slippages ("ALL")
    const globalBuy = user.slippages.find(s => s.walletId === "ALL" && s.type === "buy");
    const globalSell = user.slippages.find(s => s.walletId === "ALL" && s.type === "sell");

    user.buySlippage = globalBuy?.value || 1.0;
    user.sellSlippage = globalSell?.value || 1.0;

    // Attach wallet-level slippages
    user.wallets = user.wallets.map(wallet => {
        const buy = user.slippages.find(s => s.walletId === wallet.id && s.type === "buy");
        const sell = user.slippages.find(s => s.walletId === wallet.id && s.type === "sell");
        return {
            ...wallet,
            buySlippage: buy?.value || user.buySlippage,
            sellSlippage: sell?.value || user.sellSlippage
        };
    });

    return user;
}

export async function updateAllBuyWalletsSlippage(userId, value) {
    return updateBuySlippage(userId, "all", value);
}

export async function updateAllSellWalletsSlippage(userId, value) {
    return updateSellSlippage(userId, "all", value);
}