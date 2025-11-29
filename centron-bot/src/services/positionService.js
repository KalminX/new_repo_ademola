import { prisma } from "../config/prisma.js";
// import { getPrismaUserAndWallet } from "./walletService.js";

export async function saveOrUpdatePosition(telegramId, walletAddress, tokenInfo) {
    const { user, wallet } = await getPrismaUserAndWallet(telegramId, walletAddress);

    const { 
        tokenAddress, 
        symbol, 
        amountBought, 
        humanAmount,
        amountInSUI, 
        decimals, 
        marketCap, 
        tokenName 
    } = tokenInfo;
    
    const price = amountBought === 0 ? 0 : amountInSUI / amountBought;

    const existing = await prisma.position.findFirst({
        where: { userId: user.id, walletId: wallet.id, tokenAddress },
    });

    if (existing) {
        const updatedAmount = existing.amountBought + amountBought;
        const updatedHumanAmount = existing.humanAmount + (humanAmount || amountBought);
        const updatedCost = existing.amountInSUI + amountInSUI;
        const avgPrice = updatedAmount === 0 ? 0 : updatedCost / updatedAmount;
        const newBalance = existing.balance + amountBought;

        return prisma.position.update({
            where: { id: existing.id },
            data: {
                amountBought: updatedAmount,
                humanAmount: updatedHumanAmount, 
                balance: newBalance,
                amountInSUI: updatedCost,
                averageEntry: avgPrice,
                avgPriceSUI: avgPrice,
                marketCap: marketCap ?? existing.marketCap,
                tokenName: tokenName ?? existing.tokenName,
                decimals,
            },
        });
    }

    return prisma.position.create({
        data: {
            userId: user.id,
            walletId: wallet.id,
            tokenAddress,
            symbol,
            tokenName: tokenName ?? "Unknown",
            decimals,
            amountBought,
            humanAmount: humanAmount || amountBought,
            balance: amountBought,
            averageEntry: price,
            avgPriceSUI: price,
            amountInSUI,
            marketCap,
        },
    });
}


// export async function saveOrUpdatePosition(telegramId, walletAddress, tokenInfo) {
//     const { user, wallet } = await getPrismaUserAndWallet(telegramId, walletAddress);

//     const { tokenAddress, symbol, amountBought, amountInSUI, decimals, marketCap, tokenName } = tokenInfo;
//     const price = amountBought === 0 ? 0 : amountInSUI / amountBought;

//     const existing = await prisma.position.findFirst({
//         where: { userId: user.id, walletId: wallet.id, tokenAddress },
//     });

//     if (existing) {
//         const updatedAmount = existing.amountBought + amountBought;
//         const updatedCost = existing.amountInSUI + amountInSUI;
//         const avgPrice = updatedAmount === 0 ? 0 : updatedCost / updatedAmount;
//         const newBalance = existing.balance + amountBought;

//         return prisma.position.update({
//             where: { id: existing.id },
//             data: {
//                 amountBought: updatedAmount,
//                 balance: newBalance,
//                 amountInSUI: updatedCost,
//                 averageEntry: avgPrice,
//                 avgPriceSUI: avgPrice,
//                 marketCap: marketCap ?? existing.marketCap,
//                 tokenName: tokenName ?? existing.tokenName,
//                 decimals,
//             },
//         });
//     }

//     return prisma.position.create({
//         data: {
//             userId: user.id,
//             walletId: wallet.id,
//             tokenAddress,
//             symbol,
//             tokenName: tokenName ?? "Unknown",
//             decimals,
//             amountBought,
//             balance: amountBought,
//             averageEntry: price,
//             avgPriceSUI: price,
//             amountInSUI,
//             marketCap,
//         },
//     });
// }

export async function getPrismaUserAndWallet(telegramId, walletAddress) {
    const user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) },
        include: { wallets: true }
    });

    if (!user) {
        throw new Error(`User with telegramId ${telegramId} not found`);
    }

    const wallet = user.wallets.find(w =>
        w.address?.toLowerCase() === walletAddress.toLowerCase()
    );

    if (!wallet) {
        throw new Error(`Wallet ${walletAddress} not found for user ${telegramId}`);
    }

    return { user, wallet };
}

// Use it in your functions
export async function getUserPositions(telegramId, walletAddress) {
    const { user, wallet } = await getPrismaUserAndWallet(telegramId, walletAddress);

    return prisma.position.findMany({
        where: {
            userId: user.id,      // ✅ Prisma user ID
            walletId: wallet.id   // ✅ Prisma wallet ID
        }
    });
}

// Get position for a specific token
export async function getPositionForToken(telegramId, walletAddress, tokenAddress) {
    try {
        const { user, wallet } = await getPrismaUserAndWallet(telegramId, walletAddress);

        return await prisma.position.findFirst({
            where: {
                userId: user.id,
                walletId: wallet.id,
                tokenAddress: tokenAddress
            }
        });
    } catch (error) {
        console.error("Error getting position:", error);
        return null;
    }
}

// Save PNL record
export async function savePNLRecord(data) {
    return await prisma.pNLRecord.create({ data });
}
