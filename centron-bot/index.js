// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { bot } from './src/core/telegraf.js';
import { prisma } from './src/config/prisma.js';
import { checkPendingDcaOrders } from './src/core/dca/dca.js';
import { checkPendingMcapOrders } from './src/core/mcap/mcap.js';
import { webhookCallback } from './src/config/webhook.js';
import { registerStartCommand } from './src/bot/commands/start.js';
import { registerWalletCommand } from './src/bot/commands/wallets.js';
import { registerPositionsCommand } from './src/bot/commands/positions.js';
import { registerReferalCommand } from './src/bot/commands/referal.js';
import { registerCancelCommand } from './src/bot/commands/cancel.js';
import { registerOrderCommand } from './src/bot/commands/orders.js';
import { registerConfigCommand } from './src/bot/commands/config.js';
import { registerCallbackHandler } from './src/bot/handlers/callbackHandler.js';
import { registerMessageHandler } from './src/bot/handlers/messageHandler.js';
import { startCopytradeMonitoring, stopCopytradeMonitoring } from './src/transactions/copytrade/copyTradeMonitor.js';
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
const PORT = process.env.PORT || 8080;

// ---------- Express routes ----------
app.get("/", (req, res) => {
  res.send("🤖 Telegram bot is live!");
});

registerStartCommand(bot);
registerWalletCommand(bot);
registerPositionsCommand(bot);
registerReferalCommand(bot);
registerCancelCommand(bot);
registerOrderCommand(bot);
registerConfigCommand(bot);


registerCallbackHandler(bot);
registerMessageHandler(bot);


// --- Only add webhook route if PUBLIC_URL exists -----------
if (process.env.PUBLIC_URL) {
  app.post('/', webhookCallback);
}

// ---------- Start server ----------
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Trading Bot API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  // ---------- Local vs Production ----------
  if (!process.env.PUBLIC_URL) {
    // Local dev: use long polling
    console.log("⚡ Running in LOCAL mode (polling). No webhook set.");
    await bot.launch();
    console.log("✅ Bot launched with polling for local dev.");

    // 🚀 START COPYTRADE MONITORING ⬅️ ADD THIS
    startCopytradeMonitoring(bot);

    // Graceful shutdown
    process.once("SIGINT", async () => { // ⬅️ ADD async
      console.log("Shutting down...");
      await stopCopytradeMonitoring(); // ⬅️ ADD THIS
      await bot.stop("SIGINT");
    });
    process.once("SIGTERM", async () => { // ⬅️ ADD async
      console.log("Shutting down...");
      await stopCopytradeMonitoring(); // ⬅️ ADD THIS
      await bot.stop("SIGTERM");
    });
  } else {
    // Production: use webhook
    const webhookUrl = `${process.env.PUBLIC_URL}/`;
    try {
      await bot.telegram.setWebhook(webhookUrl);
      console.log(`✅ Webhook set successfully to ${webhookUrl}`);

      // 🚀 START COPYTRADE MONITORING ⬅️ ADD THIS
      startCopytradeMonitoring(bot);
    } catch (err) {
      console.error("❌ Failed to set webhook:", err.message);
    }
  }
});

// Background polling/checking task (e.g. every 90 seconds)
setInterval(() => {
  try {
    checkPendingMcapOrders();
  } catch (err) {
    console.error("Error in checkPendingMcapOrders:", err);
  }
}, 120 * 1000);


setInterval(() => {
  try {
    checkPendingDcaOrders();
  } catch (err) {
    console.error("Error in runDcaOrdersLoop:", err);
  }
}, 90 * 1000);

// Helper function to calculate date range
function getDateFilter(range) {
  const now = new Date();
  let days = 30;

  switch (range) {
    case '24h':
      days = 1;
      break;
    case '7d':
      days = 7;
      break;
    case '90d':
      days = 90;
      break;
    default:
      days = 30;
  }

  return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
}

// API Routes
// Get overall statistics
app.get('/api/stats', async (req, res) => {
  try {
    const timeRange = req.query.range || '30d';
    const dateFilter = getDateFilter(timeRange);

    // Get total PNL records in date range
    const pnlRecords = await prisma.pNLRecord.findMany({
      where: {
        createdAt: {
          gte: dateFilter
        }
      }
    });

    // Calculate statistics
    const totalProfit = pnlRecords.reduce((sum, record) => sum + record.profitLoss, 0);
    const totalVolume = pnlRecords.reduce((sum, record) => sum + record.totalInvested + record.totalReceived, 0);

    // Win rate (profitable trades vs total trades)
    const profitableTrades = pnlRecords.filter(r => r.profitLoss > 0).length;
    const winRate = pnlRecords.length > 0 ? (profitableTrades / pnlRecords.length) * 100 : 0;

    // Active traders (unique users)
    const activeTraders = await prisma.user.count({
      where: {
        pnlRecords: {
          some: {
            createdAt: {
              gte: dateFilter
            }
          }
        }
      }
    });

    res.json({
      total_profit: parseFloat(totalProfit.toFixed(2)),
      total_volume: parseFloat(totalVolume.toFixed(2)),
      win_rate: parseFloat(winRate.toFixed(1)),
      active_traders: activeTraders
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get profit and volume data over time
app.get('/api/profit-data', async (req, res) => {
  try {
    const timeRange = req.query.range || '30d';
    const dateFilter = getDateFilter(timeRange);

    const pnlRecords = await prisma.pNLRecord.findMany({
      where: {
        createdAt: {
          gte: dateFilter
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Group by date
    const dataByDate = {};
    pnlRecords.forEach(record => {
      const date = record.createdAt.toISOString().split('T')[0];
      if (!dataByDate[date]) {
        dataByDate[date] = { profit: 0, volume: 0 };
      }
      dataByDate[date].profit += record.profitLoss;
      dataByDate[date].volume += record.totalInvested + record.totalReceived;
    });

    const data = Object.entries(dataByDate).map(([date, values]) => ({
      date: date.substring(5), // Get MM-DD format
      profit: parseFloat(values.profit.toFixed(2)),
      volume: parseFloat(values.volume.toFixed(2))
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching profit data:', error);
    res.status(500).json({ error: 'Failed to fetch profit data' });
  }
});

// Get token distribution
app.get('/api/token-distribution', async (req, res) => {
  try {
    const positions = await prisma.position.findMany({
      select: {
        symbol: true,
        amountInSUI: true
      }
    });

    // Group by token symbol
    const tokenData = {};
    positions.forEach(pos => {
      if (!tokenData[pos.symbol]) {
        tokenData[pos.symbol] = 0;
      }
      tokenData[pos.symbol] += pos.amountInSUI;
    });

    const total = Object.values(tokenData).reduce((sum, val) => sum + val, 0);

    // Convert to array and calculate percentages
    const data = Object.entries(tokenData)
      .map(([name, value]) => ({
        name,
        value: total > 0 ? parseFloat(((value / total) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 tokens

    res.json(data);
  } catch (error) {
    console.error('Error fetching token distribution:', error);
    res.status(500).json({ error: 'Failed to fetch token distribution' });
  }
});

// Get daily trading activity
app.get('/api/daily-trades', async (req, res) => {
  try {
    const dateFilter = getDateFilter('7d');

    const pnlRecords = await prisma.pNLRecord.findMany({
      where: {
        createdAt: {
          gte: dateFilter
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Group by day of week
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dataByDay = {};

    pnlRecords.forEach(record => {
      const dayIndex = record.createdAt.getDay();
      const dayName = dayNames[dayIndex];

      if (!dataByDay[dayName]) {
        dataByDay[dayName] = { trades: 0, successful: 0 };
      }
      dataByDay[dayName].trades += 1;
      if (record.profitLoss > 0) {
        dataByDay[dayName].successful += 1;
      }
    });

    // Ensure all days are present in order
    const data = dayNames.map(day => ({
      day,
      trades: dataByDay[day]?.trades || 0,
      successful: dataByDay[day]?.successful || 0
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching daily trades:', error);
    res.status(500).json({ error: 'Failed to fetch daily trades' });
  }
});

// Get top performing tokens/strategies
app.get('/api/top-strategies', async (req, res) => {
  try {
    const pnlRecords = await prisma.pNLRecord.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Group by token
    const tokenStats = {};
    pnlRecords.forEach(record => {
      const key = record.tokenSymbol;
      if (!tokenStats[key]) {
        tokenStats[key] = {
          profit: 0,
          trades: 0,
          successful: 0
        };
      }
      tokenStats[key].profit += record.profitLoss;
      tokenStats[key].trades += 1;
      if (record.profitLoss > 0) {
        tokenStats[key].successful += 1;
      }
    });

    // Convert to array and calculate win rates
    const data = Object.entries(tokenStats)
      .map(([name, stats]) => ({
        name,
        profit: parseFloat(stats.profit.toFixed(2)),
        trades: stats.trades,
        winRate: stats.trades > 0
          ? parseFloat(((stats.successful / stats.trades) * 100).toFixed(1))
          : 0
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10); // Top 10

    res.json(data);
  } catch (error) {
    console.error('Error fetching top strategies:', error);
    res.status(500).json({ error: 'Failed to fetch top strategies' });
  }
});

// Get user stats (optional - for individual user analytics)
app.get('/api/user-stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        pnlRecords: true,
        positions: true,
        wallets: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalProfit = user.pnlRecords.reduce((sum, r) => sum + r.profitLoss, 0);
    const totalTrades = user.pnlRecords.length;
    const profitableTrades = user.pnlRecords.filter(r => r.profitLoss > 0).length;
    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;

    res.json({
      userId: user.id,
      username: user.username,
      totalProfit: parseFloat(totalProfit.toFixed(2)),
      totalTrades,
      winRate: parseFloat(winRate.toFixed(1)),
      walletsCount: user.wallets.length,
      activePositions: user.positions.length
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// Get referral stats
app.get('/api/referral-stats', async (req, res) => {
  try {
    const timeRange = req.query.range || '30d';
    const dateFilter = getDateFilter(timeRange);

    // Total referral earnings
    const earnings = await prisma.referralEarning.findMany({
      where: {
        createdAt: {
          gte: dateFilter
        }
      }
    });

    const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
    const totalFees = earnings.reduce((sum, e) => sum + e.feeAmount, 0);

    // Top referrers
    const earningsByUser = {};
    earnings.forEach(earning => {
      if (!earningsByUser[earning.userId]) {
        earningsByUser[earning.userId] = 0;
      }
      earningsByUser[earning.userId] += earning.amount;
    });

    const topReferrers = await Promise.all(
      Object.entries(earningsByUser)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(async ([userId, amount]) => {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true, telegramId: true }
          });
          return {
            userId,
            username: user?.username || `User ${userId.substring(0, 8)}`,
            earnings: parseFloat(amount.toFixed(2))
          };
        })
    );

    res.json({
      totalEarnings: parseFloat(totalEarnings.toFixed(2)),
      totalFees: parseFloat(totalFees.toFixed(2)),
      totalReferrals: earnings.length,
      topReferrers
    });
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    res.status(500).json({ error: 'Failed to fetch referral stats' });
  }
});

// Get total wallets created (optionally in time range)
app.get('/api/wallet-stats', async (req, res) => {
  try {
    const timeRange = req.query.range || '30d';
    const dateFilter = getDateFilter(timeRange);

    // Fetch total wallets created in the given range
    const totalWallets = await prisma.wallet.count({
      where: {
        createdAt: {
          gte: dateFilter
        }
      }
    });

    // Fetch all-time total wallets (for comparison)
    const allTimeWallets = await prisma.wallet.count();

    res.json({
      total_wallets_created: totalWallets,
      total_wallets_all_time: allTimeWallets,
      range: timeRange
    });
  } catch (error) {
    console.error('Error fetching wallet stats:', error);
    res.status(500).json({ error: 'Failed to fetch wallet statistics' });
  }
});


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Graceful shutdown
// Graceful shutdown (backup handlers)
process.on('SIGINT', async () => {
  console.log("Shutting down gracefully...");
  await stopCopytradeMonitoring();
  await bot.stop("SIGINT");
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log("Shutting down gracefully...");
  await stopCopytradeMonitoring();
  await bot.stop("SIGTERM");
  await prisma.$disconnect();
  process.exit(0);
});