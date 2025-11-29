import { formatDuration, formatSui } from "../../jobs/manageOrders/formater.js";
import { getUserOrders } from "../../jobs/manageOrders/limitAndDca.js";
import { getBalance } from "../../services/balanceService.js";
import { fetchUserStep, saveUserStep } from "../../services/userService.js";

bot.action(/^view_orders_idx_(\d+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const index = ctx.match[1]; // wallet index

  const step = await fetchUserStep(userId);
  // const walletAddress = step.walletMap[`wallet_${index}`];
  const address = step.walletMap[`wallet_${index}`];

  // --- FETCH BALANCE DYNAMICALLY ---
  // const balance = await getBalance(walletAddress);
  const balance = await getBalance(address);
  if (!balance || Number(balance.sui) <= 0) {
    return ctx.answerCbQuery(
      "You do not have any limit or DCA orders yet",
      { show_alert: true }
    );
  }

  const { limitOrders, dcaOrders } = await getUserOrders(userId);

  const walletLimit = limitOrders.filter(o => o.address === address);
  const walletDca = dcaOrders.filter(o => o.address === address);

  if (walletLimit.length === 0 && walletDca.length === 0) {
    await ctx.answerCbQuery(
      // "Centron Bot \n\nYou do not have any limit or DCA orders yet",
      "You do not have any limit or DCA orders yet",
      { show_alert: true }
    );
    return;
  }

  // Combine orders to get unique tokens
  const allOrders = [...walletLimit, ...walletDca];
  const tokenMap = {}; // key: token_0, token_1, ...
  const tokenNames = {}; // store display names

  allOrders.forEach((o) => {
    const tokenName = o.tokenAddress.split("::").pop(); // crude symbol extraction
    if (!Object.values(tokenMap).includes(o.tokenAddress)) {
      const tokenIndex = `token_${Object.keys(tokenMap).length}`;
      tokenMap[tokenIndex] = o.tokenAddress;
      tokenNames[tokenIndex] = tokenName;
    }
  });

  // Save tokenMap in user step for later lookup
  await saveUserStep(userId, {
    ...step,
    state: "awaiting_token_selection",
    walletMap: step.walletMap,
    tokenMap,
  });

  // Build keyboard
  const keyboard = Object.keys(tokenMap).map((tokenIndex) => ([{
    text: `${tokenNames[tokenIndex]}`,
    callback_data: `view_token_orders_${index}_${tokenIndex}`
  }]));

  // Add back button
  keyboard.push([{ text: "← Back", callback_data: "manage_orders" }]);

  // Message header
  const walletLink = `<a href="https://suiexplorer.com/address/${address}?network=mainnet">${address.slice(0, 4)}...${address.slice(-4)}</a>`;
  const msg = `Select a token to see a list of active Limit & DCA Orders for ${walletLink}:`;

  await ctx.editMessageText(msg, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: keyboard
    }
  });

});

bot.action(/^view_token_orders_(\d+)_token_(\d+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const walletIndex = ctx.match[1];
  const tokenIndex = ctx.match[2];

  const step = await fetchUserStep(userId);
  const address = step.walletMap[`wallet_${walletIndex}`];
  const tokenAddress = step.tokenMap[`token_${tokenIndex}`];

  const { limitOrders, dcaOrders } = await getUserOrders(userId);

  const walletLimit = limitOrders.filter(o => o.address === address && o.tokenAddress === tokenAddress);
  const walletDca = dcaOrders.filter(o => o.address === address && o.tokenAddress === tokenAddress);

  const tokenName = tokenAddress.split("::").pop();

  const walletLink = `<a href="https://suiexplorer.com/address/${address}?network=mainnet">${address.slice(0, 4)}...${address.slice(-4)}</a>`;

  let msg = `$${tokenName} - <b>Limit Orders</b> for ${walletLink}\n\n`;

  // Limit Orders
  const buyLimit = walletLimit.filter(o => o.mode.toLowerCase() === "buy");
  const sellLimit = walletLimit.filter(o => o.mode.toLowerCase() === "sell");

  msg += `BUY:\n${buyLimit.length > 0 ? buyLimit.map(o => `<b>${formatSui(o.suiAmount)}</b> SUI at <b>$${o.triggerValue}</b>`).join("\n") : "No buy orders."}\n\n`;
  msg += `SELL:\n${sellLimit.length > 0 ? sellLimit.map(o => `<b>${formatSui(o.suiAmount)}</b> SUI at <b>$${o.triggerValue}</b>`).join("\n") : "No sell orders."}\n\n`;

  // DCA Orders
  msg += `$${tokenName} - <b>DCA Orders</b> for ${walletLink}\n\n`;
  const buyDca = walletDca.filter(o => o.mode.toLowerCase() === "buy");
  const sellDca = walletDca.filter(o => o.mode.toLowerCase() === "sell");

  // BUY summary
  if (buyDca.length > 0) {
    const totalSui = buyDca.reduce((sum, o) => sum + Number(o.suiAmount), 0);
    const readableTotal = formatSui(totalSui);

    const interval = formatDuration(buyDca[0].intervalMinutes) || "?";
    const totalPeriod = formatDuration(buyDca[0].intervalDuration || buyDca[0].durationMinutes) || "?";
    msg += `BUY:\nTotal <b>${readableTotal} SUI</b> worth of $${tokenName} through multiple payments with <b> interval ${interval}</b> for a <b>period of ${totalPeriod}</b> [cancel] \n\n`;
  } else {
    msg += "BUY:\nNo buy orders.\n\n";
  }

  // SELL summary
  if (sellDca.length > 0) {
    const totalSui = sellDca.reduce((sum, o) => sum + Number(o.suiAmount), 0);
    const readableTotal = formatSui(totalSui);
    const interval = formatDuration(sellDca[0].intervalMinutes) || "?";
    const totalPeriod = formatDuration(sellDca[0].intervalDuration || sellDca[0].durationMinutes) || "?";

    msg += `SELL:\nTotal <b>${readableTotal} SUI</b> worth of $${tokenName} through multiple payments with <b> interval ${interval}</b> for a <b>period of ${totalPeriod}</b> [cancel]\n\n`;
  } else {
    msg += "SELL:\nNo sell orders.\n";
  }

  const keyboard = [
    [
      { text: "➕ Limit Order", callback_data: "limit_order" },
      { text: "➕ DCA Order", callback_data: "dca_order" },
    ],
    [
      { text: "← Back", callback_data: `view_orders_idx_${walletIndex}` }
    ]
  ];

  const edited = await ctx.editMessageText(msg, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: keyboard
    },
    disable_web_page_preview: true
  });

  // Save message id in step so we can re-edit it later from limit_order/dca_order
  await saveUserStep(userId, {
    ...step,
    state: "viewing_token_orders",
    walletMap: step.walletMap,
    tokenMap: step.tokenMap,
    mainMessageId: ctx.callbackQuery.message.message_id,  // 👈 use the id of the message we just edited
    currentToken: tokenAddress,
    currentWallet: address
  });

});