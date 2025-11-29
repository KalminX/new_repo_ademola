// src/services/wallet/walletUtils.js
import { shortAddress } from "../../utils/shortAddress.js";

/**
 * Normalizes an array of wallets to a consistent format.
 */
export function normalizeWallets(wallets = []) {
    return wallets
        .filter(w => typeof w === "object" && (w.address || w.walletAddress))
        .map(w => {
            const address = w.address || w.walletAddress;
            return {
                ...w,
                address,
                name: w.name || shortAddress(address),
                buySlippage: w.buySlippage ?? 0.01,
                sellSlippage: w.sellSlippage ?? 0.01,
            };
        });
}

/**
 * Returns a list of lowercase wallet addresses from mixed inputs.
 */
export function toAddressList(wallets) {
    return wallets
        .map(w => (typeof w === "string" ? w : (w?.address || w?.walletAddress)))
        .filter(Boolean)
        .map(a => a.toLowerCase());
}

/**
 * Builds a map like { w0: wallet1, w1: wallet2, ... } for quick lookups.
 */
export function buildWalletMap(wallets = []) {
    return normalizeWallets(wallets).reduce((map, w, i) => {
        map[`w${i}`] = w;
        return map;
    }, {});
}