import { generateQRCode } from "./genQr.js";

export async function showReferralQRCode(ctx) {
  const userId = ctx.from.id.toString();
  const referralLink = `https://t.me/${ctx.me}?start=ref_${userId}`;

  const qrImageBuffer = await generateQRCode(referralLink); // your custom function
  await ctx.replyWithPhoto({ source: qrImageBuffer }, { caption: "Here's your referral QR code." });

  await ctx.answerCbQuery();
}