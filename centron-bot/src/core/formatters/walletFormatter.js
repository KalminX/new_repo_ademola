import { abbreviateNumber, formatPriceAbbreviated, 
    formatPricePrecise } from "../utils/getTokenDetails.js";
import { shortAddress } from "../../utils/shortAddress.js";
import { getWalletDisplayName } from "../../bot/keyboards/getWalletName.js";
/**
 * Formats a wallet line for token balance display.
 */
export function formatWalletBalanceLine(wallet, tokenBalance, suiBalance, tokenInfo, displayName = null) {
    const walletDisplay = displayName || shortAddress(wallet);
    const formattedToken = abbreviateNumber(tokenBalance.balance);
    const formattedSui = formatPricePrecise(suiBalance);
    const formattedUsd = formatPriceAbbreviated(tokenBalance.balanceUsd);

    return `💳 ${walletDisplay} | ${formattedToken} ${tokenInfo.symbol} (worth ${formattedSui} SUI / ${formattedUsd})`;
}

/**
 * Formats a wallet’s full balance row (HTML rich version for Telegram).
 */
export function formatWalletBalanceRow(wallet, suiBalance, tokenBalance, tokenInfo) {
    const tokenAmount = Number(tokenBalance.balance);
    const tokenValueUSD = Number(tokenBalance.balanceUsd);

    const formattedSui = suiBalance?.sui != null
        ? formatPricePrecise(suiBalance.sui)
        : "0.000";

    const formattedToken = abbreviateNumber(tokenAmount);
    const formattedUsdValue = formatPriceAbbreviated(tokenValueUSD);

    const formattedSuiValue = tokenInfo.priceInSui
        ? formatPricePrecise(tokenAmount * tokenInfo.priceInSui)
        : "";

    const walletName = getWalletDisplayName(wallet);
    const explorerWalletLink = `https://suiexplorer.com/address/${wallet.address || wallet.walletAddress}?network=mainnet`;
    const boldWalletLink = `<a href="${explorerWalletLink}">${walletName}</a>`;

    return (
        `${boldWalletLink} | ${formattedSui} SUI | ${formattedToken} $${tokenInfo.symbol}` +
        (formattedSuiValue
            ? ` (worth ${formattedSuiValue} SUI / ${formattedUsdValue})\n`
            : ` (worth ${formattedUsdValue})\n`)
    );
}