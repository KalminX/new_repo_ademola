import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import cron from 'node-cron';
import { prisma } from '../../config/prisma.js';
import { buyTokenWithAftermath } from '../aftermath/buyToken.js';
import { sellTokenWithAftermath } from '../aftermath/sellToken.js';

const client = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });

// Store active subscriptions
const activeSubscriptions = new Map();

// Track last processed transaction for each wallet (to avoid duplicates)
const lastProcessedTx = new Map();

// Cooldown to prevent duplicate buys (walletAddress-tokenAddress -> timestamp)
const buyerCooldowns = new Map();

/**
 * Start monitoring all active copytrade wallets
 */
export async function startCopytradeMonitoring(bot) {
    console.log('🔄 Starting copytrade monitoring system...');

    // Initial setup - subscribe to all active wallets
    await subscribeToAllWallets(bot);

    // Refresh subscriptions every 5 minutes (in case new wallets added)
    cron.schedule('*/5 * * * *', async () => {
        console.log('🔄 Refreshing copytrade subscriptions...');
        await subscribeToAllWallets(bot);
    });

    // Backup polling system (checks every 30 seconds for missed transactions)
    cron.schedule('*/30 * * * * *', async () => {
        await pollForMissedTransactions(bot);
    });

    console.log('✅ Copytrade monitoring system started!');
}

/**
 * Subscribe to all active copytrade wallets
 */
async function subscribeToAllWallets(bot) {
    try {
        // Get all unique wallet addresses being watched
        const copytradeWallets = await prisma.copytradeWallet.findMany({
            where: { isActive: true },
            select: { walletAddress: true },
            distinct: ['walletAddress']
        });

        console.log(`📡 Found ${copytradeWallets.length} unique wallets to monitor`);

        for (const { walletAddress } of copytradeWallets) {
            // Skip if already subscribed
            if (activeSubscriptions.has(walletAddress)) {
                continue;
            }

            await subscribeToWallet(walletAddress, bot);
        }
    } catch (error) {
        console.error('❌ Error subscribing to wallets:', error);
    }
}

/**
 * Subscribe to a single wallet's transactions
 */
async function subscribeToWallet(walletAddress, bot) {
    try {
        const unsubscribe = await client.subscribeTransaction({
            filter: { FromAddress: walletAddress },
            onMessage: async (transaction) => {
                await handleTransaction(walletAddress, transaction, bot);
            }
        });

        activeSubscriptions.set(walletAddress, unsubscribe);
        console.log(`✅ Subscribed to wallet: ${walletAddress.slice(0, 8)}...`);
    } catch (error) {
        console.error(`❌ Failed to subscribe to ${walletAddress}:`, error.message);
    }
}

/**
 * Handle incoming transaction from watched wallet
 */
async function handleTransaction(walletAddress, transaction, bot) {
    try {
        const txDigest = transaction.digest;

        // Prevent duplicate processing
        const txKey = `${walletAddress}-${txDigest}`;
        if (lastProcessedTx.has(txKey)) {
            return;
        }
        lastProcessedTx.set(txKey, Date.now());

        // Clean up old entries (keep only last 1000)
        if (lastProcessedTx.size > 1000) {
            const firstKey = lastProcessedTx.keys().next().value;
            lastProcessedTx.delete(firstKey);
        }

        console.log(`🔍 New transaction from ${walletAddress.slice(0, 8)}...: ${txDigest}`);

        // Get full transaction details
        const txDetails = await client.getTransactionBlock({
            digest: txDigest,
            options: {
                showInput: true,
                showEffects: true,
                showEvents: true,
                showObjectChanges: true,
                showBalanceChanges: true
            }
        });

        // Detect if this is a DEX trade
        const tradeInfo = await detectTrade(txDetails);

        if (!tradeInfo) {
            console.log(`⏭️  Not a trade transaction`);
            return;
        }

        console.log(`💱 Detected ${tradeInfo.type}: ${tradeInfo.tokenSymbol || 'Unknown'}`);

        // Process copytrade for all users watching this wallet
        await processCopytrade(walletAddress, tradeInfo, txDetails, bot);

    } catch (error) {
        console.error('❌ Error handling transaction:', error);
    }
}

/**
 * Detect if transaction is a DEX trade (buy/sell)
 */
async function detectTrade(txDetails) {
    try {
        const balanceChanges = txDetails.balanceChanges || [];

        // Look for SUI balance changes (indicates a swap)
        const suiChanges = balanceChanges.filter(change =>
            change.coinType === '0x2::sui::SUI'
        );

        if (suiChanges.length === 0) {
            return null; // Not a trade
        }

        // Determine if buy or sell based on SUI flow
        const suiChange = suiChanges[0];
        const suiAmount = Math.abs(parseInt(suiChange.amount)) / 1e9; // Convert to SUI

        // Negative SUI = buying (spending SUI)
        // Positive SUI = selling (receiving SUI)
        const isBuy = parseInt(suiChange.amount) < 0;

        // Find the token being traded (non-SUI coin change)
        const tokenChange = balanceChanges.find(change =>
            change.coinType !== '0x2::sui::SUI' && change.coinType
        );

        if (!tokenChange) {
            return null; // No token found
        }

        const tokenAddress = tokenChange.coinType;
        const tokenAmount = Math.abs(parseInt(tokenChange.amount));

        // Try to get token metadata
        let tokenSymbol = 'Unknown';
        let tokenDecimals = 9;

        try {
            const metadata = await client.getCoinMetadata({ coinType: tokenAddress });
            if (metadata) {
                tokenSymbol = metadata.symbol;
                tokenDecimals = metadata.decimals;
            }
        } catch (e) {
            console.log('⚠️  Could not fetch token metadata');
        }

        return {
            type: isBuy ? 'buy' : 'sell',
            tokenAddress,
            tokenSymbol,
            tokenDecimals,
            tokenAmount: tokenAmount / Math.pow(10, tokenDecimals),
            suiAmount,
            timestamp: Date.now()
        };

    } catch (error) {
        console.error('Error detecting trade:', error);
        return null;
    }
}

/**
 * Process copytrade for all users watching this wallet
 */
async function processCopytrade(walletAddress, tradeInfo, txDetails, bot) {
    try {
        // Get all users copying this wallet
        const copytraders = await prisma.copytradeWallet.findMany({
            where: {
                walletAddress: walletAddress,
                isActive: true,
                // Filter based on trade type
                ...(tradeInfo.type === 'buy' ? { copyBuys: true } : { copySells: true })
            },
            include: {
                user: {
                    include: {
                        wallets: true
                    }
                }
            }
        });

        console.log(`👥 Found ${copytraders.length} users to notify/execute for`);

        for (const ct of copytraders) {
            try {
                // Send notification if enabled
                if (tradeInfo.type === 'buy' && ct.autoBuyNotifications) {
                    await sendBuyNotification(ct, tradeInfo, txDetails, bot);
                }

                if (tradeInfo.type === 'sell' && ct.autoSellNotifications) {
                    await sendSellNotification(ct, tradeInfo, txDetails, bot);
                }

                // Execute trade if auto-trading enabled
                if (tradeInfo.type === 'buy' && ct.autoBuyEnabled && ct.copyAmount > 0) {
                    await executeCopyBuy(ct, tradeInfo, bot);
                }

                if (tradeInfo.type === 'sell' && ct.autoSellEnabled && ct.sellPercentage > 0) {
                    await executeCopySell(ct, tradeInfo, bot);
                }

                // Update stats
                await prisma.copytradeWallet.update({
                    where: { id: ct.id },
                    data: {
                        totalCopied: { increment: 1 }
                    }
                });

            } catch (error) {
                console.error(`❌ Error processing copytrade for user ${ct.user.telegramId}:`, error);
            }
        }

    } catch (error) {
        console.error('Error processing copytrade:', error);
    }
}

/**
 * Send buy notification to user
 */
async function sendBuyNotification(copytradeWallet, tradeInfo, txDetails, bot) {
    try {
        const shortAddr = `${copytradeWallet.walletAddress.slice(0, 6)}...${copytradeWallet.walletAddress.slice(-4)}`;
        const walletName = copytradeWallet.nickname || shortAddr;

        let message = `🟢 <b>Copytrade Buy Alert</b>\n\n`;
        message += `<b>Wallet:</b> ${walletName}\n`;
        message += `<b>Token:</b> ${tradeInfo.tokenSymbol}\n`;
        message += `<b>Amount:</b> ${tradeInfo.suiAmount.toFixed(4)} SUI\n`;
        message += `<b>Received:</b> ${tradeInfo.tokenAmount.toFixed(2)} ${tradeInfo.tokenSymbol}\n\n`;

        if (copytradeWallet.autoBuyEnabled && copytradeWallet.copyAmount > 0) {
            message += `⚡ <b>Auto-buy:</b> Buying ${copytradeWallet.copyAmount} SUI worth...\n`;
        }

        message += `\n<a href="https://suiscan.xyz/mainnet/tx/${txDetails.digest}">View Transaction</a>`;

        await bot.telegram.sendMessage(
            copytradeWallet.user.telegramId,
            message,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }
        );
    } catch (error) {
        console.error('Error sending buy notification:', error);
    }
}

/**
 * Send sell notification to user
 */
async function sendSellNotification(copytradeWallet, tradeInfo, txDetails, bot) {
    try {
        const shortAddr = `${copytradeWallet.walletAddress.slice(0, 6)}...${copytradeWallet.walletAddress.slice(-4)}`;
        const walletName = copytradeWallet.nickname || shortAddr;

        let message = `🔴 <b>Copytrade Sell Alert</b>\n\n`;
        message += `<b>Wallet:</b> ${walletName}\n`;
        message += `<b>Token:</b> ${tradeInfo.tokenSymbol}\n`;
        message += `<b>Sold:</b> ${tradeInfo.tokenAmount.toFixed(2)} ${tradeInfo.tokenSymbol}\n`;
        message += `<b>Received:</b> ${tradeInfo.suiAmount.toFixed(4)} SUI\n\n`;

        if (copytradeWallet.autoSellEnabled && copytradeWallet.sellPercentage > 0) {
            message += `⚡ <b>Auto-sell:</b> Selling ${copytradeWallet.sellPercentage}% of position...\n`;
        }

        message += `\n<a href="https://suiscan.xyz/mainnet/tx/${txDetails.digest}">View Transaction</a>`;

        await bot.telegram.sendMessage(
            copytradeWallet.user.telegramId,
            message,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }
        );
    } catch (error) {
        console.error('Error sending sell notification:', error);
    }
}

/**
 * Execute copy buy trade
 */
async function executeCopyBuy(copytradeWallet, tradeInfo, bot) {
    try {
        console.log(`💰 Executing copy buy for user ${copytradeWallet.user.telegramId}`);

        // Get user's first active wallet
        const userWallet = copytradeWallet.user.wallets[0];
        if (!userWallet) {
            throw new Error('No wallet found for user');
        }

        // Check cooldown (prevent buying same token multiple times quickly)
        const cooldownKey = `${userWallet.address}-${tradeInfo.tokenAddress}`;
        const lastBuy = buyerCooldowns.get(cooldownKey);

        if (lastBuy && Date.now() - lastBuy < 30000) { // 30 second cooldown
            console.log('⏭️ Skipping - cooldown active (bought recently)');
            return;
        }

        // Check if user has enough balance
        const balances = await client.getAllBalances({ owner: userWallet.address });
        const suiBalance = balances.find(b => b.coinType === '0x2::sui::SUI');
        const suiBalanceSUI = Number(suiBalance?.totalBalance || 0) / 1e9;

        const requiredAmount = copytradeWallet.copyAmount + 0.05; // +0.05 for gas

        if (suiBalanceSUI < requiredAmount) {
            throw new Error(
                `Insufficient balance: ${suiBalanceSUI.toFixed(4)} SUI ` +
                `(need ${requiredAmount.toFixed(4)} SUI)`
            );
        }

        // Convert copyAmount to MIST (1 SUI = 1e9 MIST)
        const suiAmountInMist = Math.floor(copytradeWallet.copyAmount * 1e9);

        // Execute the buy using your existing function
        const result = await buyTokenWithAftermath({
            tokenAddress: tradeInfo.tokenAddress,
            phrase: userWallet.seedPhrase,
            suiAmount: suiAmountInMist,
            slippage: copytradeWallet.slippage
        });

        if (result.success) {
            // Set cooldown
            buyerCooldowns.set(cooldownKey, Date.now());

            // Update or create position in database
            await updatePositionAfterCopyBuy(copytradeWallet, result, tradeInfo, userWallet);

            // Send success notification
            let message = `✅ <b>Copy Buy Executed!</b>\n\n`;
            message += `<b>Token:</b> ${result.tokenSymbol}\n`;
            message += `<b>Spent:</b> ${result.spentSUI.toFixed(4)} SUI\n`;
            message += `<b>Received:</b> ${result.tokenAmountReadable.toFixed(2)} ${result.tokenSymbol}\n`;
            message += `<b>Fee:</b> ${result.feePaid.toFixed(4)} SUI (1.2%)\n\n`;
            message += `<a href="https://suiscan.xyz/mainnet/tx/${result.transactionDigest}">View Transaction</a>`;

            await bot.telegram.sendMessage(
                copytradeWallet.user.telegramId,
                message,
                {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                }
            );

            // Update success count
            await prisma.copytradeWallet.update({
                where: { id: copytradeWallet.id },
                data: {
                    successfulCopies: { increment: 1 }
                }
            });

            console.log(`✅ Copy buy successful for user ${copytradeWallet.user.telegramId}`);
        }

    } catch (error) {
        console.error('Error executing copy buy:', error);

        let errorMessage = `❌ <b>Copy Buy Failed</b>\n\n`;
        errorMessage += `<b>Token:</b> ${tradeInfo.tokenSymbol}\n`;
        errorMessage += `<b>Reason:</b> ${error.message}\n\n`;

        // If fee was taken but trade failed
        if (error.feeTransactionDigest) {
            errorMessage += `⚠️ Note: Fee was already deducted\n`;
            errorMessage += `<a href="https://suiscan.xyz/mainnet/tx/${error.feeTransactionDigest}">View Fee TX</a>`;
        }

        await bot.telegram.sendMessage(
            copytradeWallet.user.telegramId,
            errorMessage,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }
        );
    }
}

/**
 * Update position in database after successful copy buy
 */
async function updatePositionAfterCopyBuy(copytradeWallet, buyResult, tradeInfo, userWallet) {
    try {
        // Find existing position
        const existingPosition = await prisma.position.findUnique({
            where: {
                userId_walletId_tokenAddress: {
                    userId: copytradeWallet.userId,
                    walletId: userWallet.id,
                    tokenAddress: tradeInfo.tokenAddress
                }
            }
        });

        if (existingPosition) {
            // Update existing position
            const totalSpent = existingPosition.spentSUI + buyResult.spentSUI;
            const totalAmount = existingPosition.amountBought + buyResult.tokenAmountReceived;
            const newAvgPrice = totalSpent / (totalAmount / Math.pow(10, buyResult.decimals));

            await prisma.position.update({
                where: {
                    userId_walletId_tokenAddress: {
                        userId: copytradeWallet.userId,
                        walletId: userWallet.id,
                        tokenAddress: tradeInfo.tokenAddress
                    }
                },
                data: {
                    amountBought: totalAmount,
                    balance: totalAmount,
                    humanAmount: totalAmount / Math.pow(10, buyResult.decimals),
                    spentSUI: totalSpent,
                    averageEntry: newAvgPrice,
                    avgPriceSUI: newAvgPrice,
                    lastBuySUI: buyResult.spentSUI,
                    lastBuyAmount: buyResult.tokenAmountReceived,
                    updatedAt: new Date()
                }
            });
        } else {
            // Create new position
            const avgPrice = buyResult.spentSUI / buyResult.tokenAmountReadable;

            await prisma.position.create({
                data: {
                    userId: copytradeWallet.userId,
                    walletId: userWallet.id,
                    tokenAddress: tradeInfo.tokenAddress,
                    symbol: buyResult.tokenSymbol,
                    tokenName: buyResult.tokenSymbol,
                    decimals: buyResult.decimals,
                    amountBought: buyResult.tokenAmountReceived,
                    balance: buyResult.tokenAmountReceived,
                    humanAmount: buyResult.tokenAmountReadable,
                    averageEntry: avgPrice,
                    avgPriceSUI: avgPrice,
                    amountInSUI: buyResult.spentSUI,
                    spentSUI: buyResult.spentSUI,
                    lastBuySUI: buyResult.spentSUI,
                    lastBuyAmount: buyResult.tokenAmountReceived,
                }
            });
        }
    } catch (error) {
        console.error('Error updating position after copy buy:', error);
        // Don't throw - position update failure shouldn't fail the whole trade
    }
}

/**
 * Execute copy sell trade
 */
async function executeCopySell(copytradeWallet, tradeInfo, bot) {
    try {
        console.log(`💰 Executing copy sell for user ${copytradeWallet.user.telegramId}`);

        // Get user's first active wallet
        const userWallet = copytradeWallet.user.wallets[0];
        if (!userWallet) {
            throw new Error('No wallet found for user');
        }

        // Check if user has a position in this token
        const position = await prisma.position.findFirst({
            where: {
                userId: copytradeWallet.userId,
                walletId: userWallet.id,
                tokenAddress: tradeInfo.tokenAddress
            }
        });

        if (!position || position.balance <= 0) {
            console.log(`⏭️  User doesn't have position in ${tradeInfo.tokenSymbol}`);
            return;
        }

        // Execute the sell using your existing function
        const result = await sellTokenWithAftermath({
            tokenAddress: tradeInfo.tokenAddress,
            phrase: userWallet.seedPhrase,
            suiPercentage: copytradeWallet.sellPercentage,
            slippage: copytradeWallet.slippage
        });

        if (result.success) {
            // Update position in database
            await updatePositionAfterCopySell(copytradeWallet, result, position, userWallet);

            // Send success notification
            let message = `✅ <b>Copy Sell Executed!</b>\n\n`;
            message += `<b>Token:</b> ${result.tokenSymbol}\n`;
            message += `<b>Percentage Sold:</b> ${result.percentageSold}%\n`;
            message += `<b>SUI Received:</b> ${result.suiReceivedAfterFee.toFixed(4)} SUI\n`;
            message += `<b>Fee:</b> ${result.feePaid.toFixed(4)} SUI (1.2%)\n\n`;
            message += `<a href="https://suiscan.xyz/mainnet/tx/${result.transactionDigest}">View Transaction</a>`;

            await bot.telegram.sendMessage(
                copytradeWallet.user.telegramId,
                message,
                {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                }
            );

            // Update success count
            await prisma.copytradeWallet.update({
                where: { id: copytradeWallet.id },
                data: {
                    successfulCopies: { increment: 1 }
                }
            });

            console.log(`✅ Copy sell successful for user ${copytradeWallet.user.telegramId}`);
        }

    } catch (error) {
        console.error('Error executing copy sell:', error);

        let errorMessage = `❌ <b>Copy Sell Failed</b>\n\n`;
        errorMessage += `<b>Token:</b> ${tradeInfo.tokenSymbol}\n`;
        errorMessage += `<b>Reason:</b> ${error.message}\n`;

        await bot.telegram.sendMessage(
            copytradeWallet.user.telegramId,
            errorMessage,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }
        );
    }
}

/**
 * Update position in database after successful copy sell
 */
async function updatePositionAfterCopySell(copytradeWallet, sellResult, position, userWallet) {
    try {
        const tokensSold = sellResult.tokenAmountSold;
        const remainingBalance = position.balance - tokensSold;
        const percentageSold = sellResult.percentageSold;
        const isFullSell = percentageSold === 100 || remainingBalance <= 0;

        if (isFullSell) {
            // Record PNL for full sell
            const totalReceived = sellResult.actualSuiReceived;
            const totalInvested = position.spentSUI || 0;
            const profitLoss = totalReceived - totalInvested;
            const profitLossPercent = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

            await prisma.pNLRecord.create({
                data: {
                    userId: copytradeWallet.userId,
                    walletId: userWallet.id,
                    tokenAddress: sellResult.tokenAddress,
                    tokenSymbol: sellResult.tokenSymbol,
                    tokenName: sellResult.tokenSymbol,
                    totalInvested: totalInvested,
                    totalReceived: totalReceived,
                    profitLoss: profitLoss,
                    profitLossPercent: profitLossPercent,
                    amountSold: tokensSold,
                    percentageSold: percentageSold,
                    isFullSell: true,
                    transactionDigest: sellResult.transactionDigest
                }
            });

            // Delete position
            await prisma.position.delete({
                where: {
                    userId_walletId_tokenAddress: {
                        userId: copytradeWallet.userId,
                        walletId: userWallet.id,
                        tokenAddress: sellResult.tokenAddress
                    }
                }
            });
        } else {
            // Partial sell - record PNL and update position
            const suiReceivedForSold = sellResult.actualSuiReceived;
            const investedForSold = (position.spentSUI || 0) * (percentageSold / 100);
            const profitLoss = suiReceivedForSold - investedForSold;
            const profitLossPercent = investedForSold > 0 ? (profitLoss / investedForSold) * 100 : 0;

            await prisma.pNLRecord.create({
                data: {
                    userId: copytradeWallet.userId,
                    walletId: userWallet.id,
                    tokenAddress: sellResult.tokenAddress,
                    tokenSymbol: sellResult.tokenSymbol,
                    tokenName: sellResult.tokenSymbol,
                    totalInvested: investedForSold,
                    totalReceived: suiReceivedForSold,
                    profitLoss: profitLoss,
                    profitLossPercent: profitLossPercent,
                    amountSold: tokensSold,
                    percentageSold: percentageSold,
                    isFullSell: false,
                    transactionDigest: sellResult.transactionDigest
                }
            });

            // Update position with remaining balance
            const remainingSpent = (position.spentSUI || 0) * ((100 - percentageSold) / 100);

            await prisma.position.update({
                where: {
                    userId_walletId_tokenAddress: {
                        userId: copytradeWallet.userId,
                        walletId: userWallet.id,
                        tokenAddress: sellResult.tokenAddress
                    }
                },
                data: {
                    balance: remainingBalance,
                    humanAmount: remainingBalance / Math.pow(10, sellResult.decimals),
                    spentSUI: remainingSpent,
                    updatedAt: new Date()
                }
            });
        }
    } catch (error) {
        console.error('Error updating position after copy sell:', error);
        // Don't throw - position update failure shouldn't fail the whole trade
    }
}

/**
 * Backup polling system for missed transactions
 */
async function pollForMissedTransactions(bot) {
    // This is a backup in case WebSocket misses something
    // For now, WebSocket should catch everything
}

/**
 * Stop monitoring (cleanup)
 */
export async function stopCopytradeMonitoring() {
    console.log('🛑 Stopping copytrade monitoring...');

    for (const [walletAddress, unsubscribe] of activeSubscriptions) {
        try {
            await unsubscribe();
            console.log(`✅ Unsubscribed from ${walletAddress.slice(0, 8)}...`);
        } catch (error) {
            console.error(`❌ Error unsubscribing from ${walletAddress}:`, error);
        }
    }

    activeSubscriptions.clear();
    lastProcessedTx.clear();
    buyerCooldowns.clear();

    console.log('✅ Copytrade monitoring stopped');
}