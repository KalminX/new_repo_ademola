export function buildWelcomeMessage(balances) {
    let message = "Welcome to *Centron Bot* 👋\n\n";
    message += "Trade seamlessly on Sui with low fees + high speeds.\n\n";

    balances.forEach((entry, i) => {
        const { wallet, balance } = entry;
        const name = wallet.name?.trim() || `Sui Wallet ${i + 1}`;
        const address = wallet.address;
        const escape = (str) => str.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");

        message += `*${escape(name)}: ${balance.sui} SUI ($${balance.usd})*\n`;
        message += `\`${escape(address)}\` (tap to copy)\n\n`;
    });

    message += 'To start trading, tap "Buy a Token" and paste the token address.';
    return message;
}