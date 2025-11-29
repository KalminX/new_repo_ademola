export async function fetchWithRetry(client, tokenAddress, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const metadata = await client.getCoinMetadata({ coinType: tokenAddress });
            return metadata;
        } catch (e) {
            console.warn(`Metadata fetch failed (attempt ${i + 1}):`, e.message);
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
        }
    }
}

export async function getTokenMetadataSafe(client, tokenAddress) {
    try {
        const metadata = await fetchWithRetry(client, tokenAddress);
        return {
            symbol: metadata?.symbol || "UNKNOWN",
            decimals: metadata?.decimals ?? 9
        };
    } catch {
        return { symbol: "UNKNOWN", decimals: 9 };
    }
}