// test-pnl-card.js
import fs from 'fs';
import { generatePnlCard } from '../controllers/pnlcard/sellPnl.js';

async function testCard() {
    console.log("🎨 Generating test PnL card...");
    // Fake data for testing
    const testData = {
        walletName: "My Test Wallet",
        walletAddress: "0x1234...5678",
        tokenSymbol: "JEETS",
        totalInvested: 0.009443,
        // totalReceived: 0.008648,
        totalReceived: 4.578648,
        // profitLoss: -0.000795,
        profitLoss: 3.000795,
        // profitLossPercent: -8.43,
        profitLossPercent: 8.43,
        amountSold: 2568.236,
        referralCode: "CENTRON",
        txLink: "https://suiscan.xyz/mainnet/tx/ABC123", // for QR code
    };

    try {
        const imageBuffer = await generatePnlCard(testData);

        // Save to file
        fs.writeFileSync('test-pnl-card.png', imageBuffer);

        console.log("✅ Card generated successfully!");
        console.log("📁 Saved as: test-pnl-card.png");
        console.log("👀 Open it to check alignment!");
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

testCard();