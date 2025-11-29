export async function closeMessage(ctx) {
  try {
    await ctx.deleteMessage();
  } catch (err) {
    console.error("❌ Couldn't delete message:", err.message);
  }
  await ctx.answerCbQuery("Closed.");
}