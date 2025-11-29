import { formatPrice } from "../../core/utils/getTokenDetails.js";
import { normalizeWallets } from "../../services/wallets/walletUtils.js";
import { shortAddress } from "../../utils/shortAddress.js";


export function buildLimitOrderKeyboard(selectedWallets, allWallets, mode = "buy", value, showAll = false) {
    const selectedKeys = new Set(selectedWallets);
    const seenAddresses = new Set();

    const dedupedWallets = allWallets.filter((w) => {
        const addr = w.address?.toLowerCase();
        if (addr && !seenAddresses.has(addr)) {
            seenAddresses.add(addr);
            return true;
        }
        return false;
    });

    const normalizedWallets = normalizeWallets(dedupedWallets);
    const walletsToShow = showAll ? normalizedWallets : normalizedWallets.slice(0, 4);

    const rows = [
        [{ text: "➕ Setup Limit Order ➕", callback_data: "noop" }]
    ];

    if (normalizedWallets.length > 4) {
        rows.push([{
            text: showAll ? "🔼 Select Wallets 🔼" : "🔽 Select Wallets 🔽",
            callback_data: "toggle_all_wallets"
        }]);
    }

    for (let i = 0; i < walletsToShow.length; i += 2) {
        const row = [];
        for (let j = i; j < i + 2 && j < walletsToShow.length; j++) {
            const wallet = walletsToShow[j];
            const walletKey = `w${j}`;
            const isSelected = selectedKeys.has(walletKey);
            const displayName = wallet.name?.trim() || shortAddress(wallet.address);
            row.push({
                text: `${isSelected ? "🟢" : "🔘"} ${displayName}`,
                callback_data: `toggle_wallet:${walletKey}`
            });
        }
        rows.push(row);
    }

    rows.push([{ text: mode === "buy" ? "✅ Buy / Sell" : "Buy / Sell ✅", callback_data: "toggle_mode" }]);
    const formattedTrigger = typeof value === "number" ? `${formatPrice(value)}` : (value || "---");
    rows.push([{ text: `MCap: ${formattedTrigger} ✏️`, callback_data: "enter_mcap" }]);

    const actionButtons = {
        buy: [
            [{ text: "Buy 1 SUI", callback_data: "buy_1:limit" }, { text: "Buy 5 SUI", callback_data: "buy_5:limit" }],
            [{ text: "Buy Custom SUI", callback_data: "buy_x:limit" }]
        ],
        sell: [
            [{ text: "Sell 50%", callback_data: "sell_50:limit" }, { text: "Sell 100%", callback_data: "sell_100:limit" }],
            [{ text: "Sell X%", callback_data: "sell_x:limit" }]
        ]
    };

    rows.push(...(actionButtons[mode] || []));
    rows.push([{ text: "← Back", callback_data: "back" }]);
    return rows;
}