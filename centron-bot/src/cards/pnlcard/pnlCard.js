import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage, registerFont } from 'canvas';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

registerFont(path.join(__dirname, '../../assets/fonts/SpaceGrotesk-Bold.ttf'), {
    family: 'Space Grotesk',
    weight: '700'
});


// Updated templates with better positioning based on your image
const cardTemplates = [
    {
        path: path.join(__dirname, '../../assets/loss1.png'),
        positions: {
            // Token symbol at top
            tokenSymbol: { x: 908, y: 150, font: "700 48px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // PnL Percentage (big green/red box)
            pnlPercent: { x: 912, y: 270, font: "700 48px 'Space Grotesk', sans-serif", color: "#000000", align: "center" },

            // Dollar amount (medium green/red box)
            pnlAmount: { x: 914, y: 400, font: "700 48px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // INVESTED label and value
            investedValue: { x: 1100, y: 508, font: "700 30px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "right" },

            // SOLD label and value
            soldValue: { x: 1100, y: 558, font: "700 30px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "right" },

            // Ref code
            referralCode: { x: 935, y: 655, font: "700 42px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // QR code at bottom
            qr: { x: 1043, y: 615, size: 90 },
        },
    },
    {
        path: path.join(__dirname, '../../assets/loss2.png'),
        positions: {
            // Token symbol at top
            tokenSymbol: { x: 908, y: 150, font: "700 48px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // PnL Percentage (big green/red box)
            pnlPercent: { x: 912, y: 270, font: "700 48px 'Space Grotesk', sans-serif", color: "#000000", align: "center" },

            // Dollar amount (medium green/red box)
            pnlAmount: { x: 914, y: 400, font: "700 48px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // INVESTED label and value
            investedValue: { x: 1100, y: 508, font: "700 30px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "right" },

            // SOLD label and value
            soldValue: { x: 1100, y: 558, font: "700 30px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "right" },

            // Ref code
            referralCode: { x: 935, y: 655, font: "700 42px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // QR code at bottom
            qr: { x: 1043, y: 615, size: 90 },
        },
    },
    {
        path: path.join(__dirname, '../../assets/profit1.png'),
        positions: {
            // Token symbol at top
            tokenSymbol: { x: 908, y: 150, font: "700 48px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // PnL Percentage (big green/red box)
            pnlPercent: { x: 918, y: 265, font: "700 48px 'Space Grotesk', sans-serif", color: "#000000", align: "center" },

            // Dollar amount (medium green/red box)
            pnlAmount: { x: 920, y: 396, font: "700 48px 'Space Grotesk', sans-serif", color: "#00FF88", align: "center" },

            // INVESTED label and value
            investedValue: { x: 1100, y: 496, font: "700 30px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "right" },

            // SOLD label and value
            soldValue: { x: 1100, y: 546, font: "700 30px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "right" },

            // Ref code
            referralCode: { x: 935, y: 650, font: "700 42px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // QR code at bottom
            qr: { x: 1042, y: 605, size: 90 },
        },
    },
    {
        path: path.join(__dirname, '../../assets/profit3.png'),
        positions: {
            // Token symbol at top
            tokenSymbol: { x: 908, y: 150, font: "700 48px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // PnL Percentage (big green/red box)
            pnlPercent: { x: 918, y: 265, font: "700 48px 'Space Grotesk', sans-serif", color: "#000000", align: "center" },

            // Dollar amount (medium green/red box)
            pnlAmount: { x: 920, y: 396, font: "700 48px 'Space Grotesk', sans-serif", color: "#00FF88", align: "center" },

            // INVESTED label and value
            investedValue: { x: 1100, y: 496, font: "700 30px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "right" },

            // SOLD label and value
            soldValue: { x: 1100, y: 546, font: "700 30px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "right" },

            // Ref code
            referralCode: { x: 935, y: 650, font: "700 42px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // QR code at bottom
            qr: { x: 1042, y: 605, size: 90 },
        },
    },
    {
        path: path.join(__dirname, '../../assets/profit3.png'),
        positions: {
            // Token symbol at top
            tokenSymbol: { x: 908, y: 150, font: "700 48px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // PnL Percentage (big green/red box)
            pnlPercent: { x: 918, y: 265, font: "700 48px 'Space Grotesk', sans-serif", color: "#000000", align: "center" },

            // Dollar amount (medium green/red box)
            pnlAmount: { x: 920, y: 396, font: "700 48px 'Space Grotesk', sans-serif", color: "#00FF88", align: "center" },

            // INVESTED label and value
            investedValue: { x: 1100, y: 496, font: "700 30px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "right" },

            // SOLD label and value
            soldValue: { x: 1100, y: 546, font: "700 30px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "right" },

            // Ref code
            referralCode: { x: 935, y: 650, font: "700 42px 'Space Grotesk', sans-serif", color: "#FFFFFF", align: "center" },

            // QR code at bottom
            qr: { x: 1042, y: 605, size: 90 },
        },
    },
];

export async function generatePnlCard(data) {
    const isProfit = data.profitLoss >= 0;

    // Select template based on profit/loss
    const profitTemplates = cardTemplates.slice(3, 6); // profit1, profit2, profit3
    const lossTemplates = cardTemplates.slice(0, 3);   // loss1, loss2, loss3

    const availableTemplates = isProfit ? profitTemplates : lossTemplates;
    const templateConfig = isProfit
        ? profitTemplates[Math.floor(Math.random() * profitTemplates.length)]
        : lossTemplates[Math.floor(Math.random() * lossTemplates.length)];

    // const templateConfig = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];

    const template = await loadImage(templateConfig.path);
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');

    // Draw background template
    ctx.drawImage(template, 0, 0);

    // Helper function to draw text with alignment
    const drawText = (text, pos) => {
        ctx.font = pos.font;
        ctx.fillStyle = pos.color;
        ctx.textAlign = pos.align || 'left';
        ctx.fillText(text, pos.x, pos.y);
    };

    // Format values
    const pnlColor = isProfit ? "#00FF88" : "#FF5555";
    const pnlPrefix = isProfit ? "+" : "";

    // Draw token symbol
    // Draw token symbol dynamically using helper
    const tokenText = `$${data.tokenSymbol.toUpperCase()}`;
    const tokenPos = { ...templateConfig.positions.tokenSymbol };

    const dynamicFont = tokenText.length > 8
        ? "700 36px 'Space Grotesk', sans-serif"
        : tokenText.length > 5
            ? "700 42px 'Space Grotesk', sans-serif"
            : tokenPos.font;

    drawText(tokenText, { ...tokenPos, font: dynamicFont });

    // drawText(`$${data.tokenSymbol.toUpperCase()}`, templateConfig.positions.tokenSymbol);

    drawText(
        `${pnlPrefix}${data.profitLossPercent.toFixed(2)}%`,
        { ...templateConfig.positions.pnlPercent }
    );

    // Draw PnL amount in dollars (convert SUI to USD if needed, or just show SUI)
    const pnlDisplay = `$${Math.abs(data.profitLoss * 2.5).toFixed(0)}`; // Assuming SUI = $2.5

    drawText(
        pnlDisplay,
        { ...templateConfig.positions.pnlAmount }
    );

    // Draw INVESTED section
    drawText(
        `${data.totalInvested.toFixed(3)}`, // ◎ is SUI symbol
        templateConfig.positions.investedValue
    );

    // Draw SOLD section
    drawText(
        `${data.totalReceived.toFixed(3)}`,
        templateConfig.positions.soldValue
    );

    // Draw REFERRAL CODE (dynamic from user data)
    const referralCode = data.referralCode || "CENTRON"; // Fallback to default
    drawText(referralCode, templateConfig.positions.referralCode);

    // Generate and draw QR code
    if (data.txLink) {
        try {
            const qrBuffer = await QRCode.toBuffer(data.txLink, {
                width: templateConfig.positions.qr.size,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            const qrImage = await loadImage(qrBuffer);
            ctx.drawImage(
                qrImage,
                templateConfig.positions.qr.x,
                templateConfig.positions.qr.y,
                templateConfig.positions.qr.size,
                templateConfig.positions.qr.size
            );
        } catch (err) {
            console.warn("⚠️ Failed to generate QR code:", err.message);
        }
    }

    return canvas.toBuffer('image/png');
}