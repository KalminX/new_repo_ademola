import { normalizeWallets } from "../../services/wallets/walletUtils.js";
import { shortAddress } from "../../utils/shortAddress.js";

export function buildFullKeyboard(selectedWallets, allWallets, showAll = false, mode = "buy") {
    const selectedAddressesSet = new Set(
        selectedWallets
            .map(k => allWallets[parseInt(k.replace("w", ""))]?.address?.toLowerCase())
            .filter(Boolean)
    );

    const normalizedWallets = normalizeWallets(allWallets);
    const walletsToShow = showAll ? normalizedWallets : normalizedWallets.slice(0, 4);

    const rows = [
        [
            { text: "➕ Limit Order", callback_data: "limit_order" },
            { text: "➕ DCA Order", callback_data: "dca_order" }
        ],
        [{ text: "⚙️ Manage Orders", callback_data: "manage_orders" }]
    ];

    if (normalizedWallets.length > 1) {
        rows.push([{
            text: showAll ? "🔼 Select Wallets 🔼" : "🔽 Select Wallets 🔽",
            callback_data: "toggle_all_wallets"
        }]);

        for (let i = 0; i < walletsToShow.length; i += 2) {
            const row = [];
            for (let j = i; j < i + 2 && j < walletsToShow.length; j++) {
                const wallet = walletsToShow[j];
                const walletKey = `w${j}`;
                const isSelected = selectedAddressesSet.has(wallet.address.toLowerCase());
                const displayName = wallet.name?.trim() || shortAddress(wallet.address);
                row.push({
                    text: `${isSelected ? "🟢" : "🔘"} ${displayName}`,
                    callback_data: `toggle_wallet:${walletKey}`,
                });
            }
            rows.push(row);
        }
    }

    rows.push([{ text: "Buy ↔ Sell", callback_data: "toggle_mode" }]);

    const actionRows = {
        buy: [
            [{ text: "Buy 1 SUI", callback_data: "buy_1:market" }, { text: "Buy 5 SUI", callback_data: "buy_5:market" }],
            [{ text: "Buy Custom SUI", callback_data: "buy_x:market" }]
        ],
        sell: [
            [{ text: "Sell 50%", callback_data: "sell_50:market" }, { text: "Sell 100%", callback_data: "sell_100:market" }],
            [{ text: "Sell X%", callback_data: "sell_x:market" }]
        ]
    };

    rows.push(...(actionRows[mode] || []));
    rows.push([
        { text: "❌ Cancel", callback_data: "cancel_to_main" },
        { text: "🔄 Refresh", callback_data: "refresh_info" }
    ]);

    return rows;
}