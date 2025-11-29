export const bridgeMenu = {
    parse_mode: "Markdown",
    reply_markup: {
        inline_keyboard: [
            [
                { text: "SOL", callback_data: "bridge_sol" },
                { text: "ETH", callback_data: "bridge_eth" }
            ],
            [
                { text: "BTC", callback_data: "bridge_btc" },
                { text: "SUI", callback_data: "bridge_sui" }
            ],
            [{ text: "⬅️ Back", callback_data: "bridge_main_menu" }]
        ]
    }
};