import { normalizeWallets } from "../../services/wallets/walletUtils.js";
import { shortAddress } from "../../utils/shortAddress.js";
import { formatDurationLabel } from "../utils/formatDurationLabel.js";

export function buildDcaKeyboard(selectedWallets, allWallets, showAll = false, mode = "buy", opts = {}) {
    const { duration, interval } = opts;
    const selectedKeys = new Set(selectedWallets);
    const normalizedWallets = normalizeWallets(allWallets);
    const walletsToShow = showAll ? normalizedWallets : normalizedWallets.slice(0, 4);

    const rows = [[{ text: "➕ Setup DCA Order ➕", callback_data: "noop" }]];

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
    rows.push([
        { text: `Duration: ${formatDurationLabel(duration)}`, callback_data: "dca_set_duration" },
        { text: `Interval: ${formatDurationLabel(interval)}`, callback_data: "dca_set_interval" }
    ]);

    const actionButtons = {
        buy: [
            [{ text: "Buy 1 SUI", callback_data: "buy_1:dca" }, { text: "Buy 5 SUI", callback_data: "buy_5:dca" }],
            [{ text: "Buy Custom SUI", callback_data: "buy_x:dca" }]
        ],
        sell: [
            [{ text: "Sell 25%", callback_data: "sell_25:dca" }, { text: "Sell 50%", callback_data: "sell_50:dca" }],
            [{ text: "Sell X%", callback_data: "sell_x:dca" }]
        ]
    };

    rows.push(...(actionButtons[mode] || []));
    rows.push([{ text: "← Back", callback_data: "back" }]);

    return rows;
}