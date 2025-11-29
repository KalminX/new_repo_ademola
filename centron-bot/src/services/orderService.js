import { prisma } from "../config/prisma.js";
import { fetchUser } from "./userService.js";

/* ===================== LIMIT ORDERS ===================== */
export async function savePendingLimitOrder(order) {
    const user = await fetchUser(order.userId);
    if (!user) throw new Error("User not found");

    const wallet = user.wallets?.find(
        // (w) => w.address.toLowerCase() === order.walletAddress.toLowerCase()
        (w) => w.address.toLowerCase() === order.address.toLowerCase()
    );
    if (!wallet) throw new Error("Wallet not found for this user");

    return prisma.limitOrder.create({
        data: {
            userId: user.id,
            walletId: wallet.id,
            tokenAddress: order.tokenAddress,
            mode: order.mode,
            suiAmount: Number(order.suiAmount), // 👈 ensure it's a number
            suiPercentage: Number(order.suiPercentage ?? 0),
            slippage: Number(order.slippage ?? 1),
            triggerMcap: order.triggerMcap ? Number(order.triggerMcap) : null,
            triggerPrice: order.triggerPrice ? Number(order.triggerPrice) : null,
            status: "pending",
        },
    });
}


export async function getAllPendingLimitOrders() {
    return prisma.limitOrder.findMany({ where: { status: "pending" } });
}

export async function markOrderAsCompleted(orderId) {
    return prisma.limitOrder.update({
        where: { id: orderId },
        data: { status: "completed" },
    });
}

/* ===================== DCA ORDERS ===================== */

export async function savePendingDcaOrder(order) {
    const user = await fetchUser(order.userId);
    if (!user) throw new Error("User not found");

    // Resolve wallet
    const wallet = user.wallets.find(
        // (w) => w.address?.toLowerCase() === order.walletAddress.toLowerCase()
        (w) => w.address?.toLowerCase() === order.address.toLowerCase()
    );

    if (!wallet) {
        // throw new Error(`Wallet not found for address: ${order.walletAddress}`);
        throw new Error(`Wallet not found for address: ${order.address}`);
    }

    return prisma.dcaOrder.create({
        data: {
            userId: user.id,
            walletId: wallet.id,   // ✅ now attached
            tokenAddress: order.tokenAddress,
            mode: order.mode,
            suiAmount: order.suiAmount ? Number(order.suiAmount) : null,
            suiPercentage: order.suiPercentage ? Number(order.suiPercentage) : null,
            slippage: order.slippage ?? 1,
            intervalMinutes: order.intervalMinutes,
            durationMinutes: order.durationMinutes,
            // maxExecutions: order.maxExecutions ?? null,
            maxExecutions: order.times ?? null,
            executedCount: 0,
            lastExecuted: null,
            status: "pending",
        },
    });
}


export async function getAllPendingDcaOrders() {
    return prisma.dcaOrder.findMany({ where: { status: "pending" } });
}

export async function markDcaOrderAsCompleted(orderId) {
    return prisma.dcaOrder.update({
        where: { id: orderId },
        data: { status: "completed" },
    });
}

export async function updateDcaOrderExecution(orderId, data) {
    return prisma.dcaOrder.update({
        where: { id: orderId },
        data: {
            lastExecuted: data.lastExecuted,
            executedCount: data.executedCount,
        },
    });
}