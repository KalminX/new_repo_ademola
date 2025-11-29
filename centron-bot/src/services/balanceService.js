import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";

const suiClient = new SuiClient({ url: getFullnodeUrl("mainnet") });

const BLOCKBERRY_API_KEY = process.env.BLOCKBERRYAPIKEY;
const BIRD_EYE_API_KEY = process.env.BIRD_EYE_API_KEY;

let cachedSuiPrice = null;
let lastPriceFetchTime = 0;

/**
 * Fetch the SUI and USD balance for a single wallet address.
 * Tries Blockberry first, then falls back to BirdEye + RPC.
 */
export async function getBalance(address) {
    if (!address) throw new Error("No address provided to getBalance");

    // --- 1. Try Blockberry ---
    try {
        const res = await fetch(
            `https://api.blockberry.one/sui/v1/accounts/${address}/balance`,
            {
                headers: {
                    accept: "*/*",
                    "x-api-key": BLOCKBERRY_API_KEY,
                },
            }
        );

        if (!res.ok) throw new Error(`Blockberry API error: ${res.status}`);

        const balances = await res.json();

        const suiData = balances.find(
            (item) => item.coinType === "0x2::sui::SUI"
        );

        if (!suiData) {
            return { sui: 0, usd: 0, source: "blockberry" };
        }

        return {
            sui: Number(Number(suiData.balance).toFixed(3)),
            usd: Number(Number(suiData.balanceUsd).toFixed(2)),
            source: "blockberry",
        };
    } catch (err) {
        console.warn("⚠️ Blockberry failed, falling back to BirdEye:", err.message);
    }

    // --- 2. Fallback to BirdEye ---
    try {
        const balanceResult = await suiClient.getBalance({ owner: address });
        const mistBalance = BigInt(balanceResult.totalBalance);
        const suiBalance = Number(mistBalance) / 1e9;

        const res = await fetch(
            "https://public-api.birdeye.so/defi/price?address=0x2::sui::SUI",
            {
                headers: {
                    accept: "application/json",
                    "x-chain": "sui",
                    "X-API-KEY": BIRD_EYE_API_KEY || "",
                },
            }
        );

        if (!res.ok) throw new Error(`BirdEye API error: ${res.status}`);
        const json = await res.json();

        const suiPrice = json?.data?.value || 0;
        const usdValue = suiBalance * suiPrice;

        return {
            sui: Number(suiBalance.toFixed(3)),
            usd: Number(usdValue.toFixed(2)),
            source: "birdeye",
        };
    } catch (err) {
        console.error("❌ Both Blockberry and BirdEye failed:", err.message);
        return { sui: 0, usd: 0, source: "error" };
    }
}

/**
 * Fetch balances for multiple addresses at once using Coingecko for price data.
 */
export async function getBatchBalances(addresses) {
    if (!addresses || addresses.length === 0) return [];

    try {
        // --- 1. Fetch SUI price (cached for 5 mins) ---
        const now = Date.now();
        if (!cachedSuiPrice || now - lastPriceFetchTime > 300_000) {
            const res = await fetch(
                "https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd"
            );
            if (res.ok) {
                const json = await res.json();
                cachedSuiPrice = json?.sui?.usd || 0;
                lastPriceFetchTime = now;
            }
        }

        // --- 2. Get all balances in parallel ---
        const balancePromises = addresses.map(async (address) => {
            try {
                const balanceResult = await suiClient.getBalance({ owner: address });
                const mistBalance = BigInt(balanceResult.totalBalance);
                const suiBalance = Number(mistBalance) / 1e9;
                const usdValue = suiBalance * cachedSuiPrice;

                return {
                    address,
                    sui: Number(suiBalance.toFixed(3)),
                    usd: Number(usdValue.toFixed(2)),
                };
            } catch {
                return { address, sui: 0, usd: 0 };
            }
        });

        const results = await Promise.allSettled(balancePromises);
        return results
            .filter((r) => r.status === "fulfilled")
            .map((r) => r.value);
    } catch (error) {
        console.error("❌ getBatchBalances failed:", error.message);
        return [];
    }
}