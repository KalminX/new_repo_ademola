import { getBalance } from "../../services/balanceService.js";

export async function getWalletBalances(wallets) {
    return Promise.all(
        wallets.map(async (wallet, i) => {
            try {
                const balance = await getBalance(wallet.address);
                return { wallet, balance: balance || { sui: "0", usd: "0" } };
            } catch {
                return { wallet, balance: { sui: "0", usd: "0" } };
            }
        })
    );
}