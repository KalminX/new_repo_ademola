// retryFailedCredits.js
import cron from 'node-cron';
import { prisma } from '../../config/prisma.js';
import { sendSuiToWallet } from '../../transactions/sendSui/sendSuiToWallet.js';

// Run every hour
cron.schedule('0 * * * *', async () => {
    console.log('🔄 Retrying failed referral credits...');
    
    const pendingEarnings = await prisma.referralEarning.findMany({
        where: { credited: false },
        include: {
            user: {
                include: { wallets: true }
            }
        },
        take: 50 // Process 50 at a time
    });

    for (const earning of pendingEarnings) {
        const firstWallet = earning.user.wallets[0];
        if (!firstWallet) continue;

        try {
            await sendSuiToWallet(firstWallet.address, earning.amount);
            await prisma.referralEarning.update({
                where: { id: earning.id },
                data: { credited: true, creditedAt: new Date() }
            });
            console.log(`✅ Retried credit for earning ${earning.id}`);
        } catch (error) {
            console.error(`❌ Retry failed for earning ${earning.id}`);
        }
    }
});