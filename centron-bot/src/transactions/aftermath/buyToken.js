import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Aftermath } from "aftermath-ts-sdk";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { getKeypairFromInput } from "../../inputs/getKeypairFromInput.js";
import { normalizeSlippage } from "../../utils/slippage.js";

const CENTRON_BOT_VAULT_WALLET = process.env.CENTRON_BOT_VAULT_WALLET


export const buyTokenWithAftermath = async ({ tokenAddress, phrase, suiAmount, slippage }) => {
    let feeTransactionDigest = null;

    try {
        if (!tokenAddress || !phrase || !suiAmount || !slippage) {
            throw new Error("Missing required parameters");
        }

        if (slippage < 0 || slippage > 100) {
            throw new Error("Slippage must be between 0 and 100");
        }

        const client = new SuiClient({
            url: getFullnodeUrl("mainnet")
        });

        const afsdk = new Aftermath("MAINNET");
        await afsdk.init();
        const router = afsdk.Router();
        const keyPair = await getKeypairFromInput(phrase);
        const walletAddress = keyPair.getPublicKey().toSuiAddress();

        const balances = await client.getAllBalances({ owner: walletAddress });
        const suiBalanceObj = balances.find(balance => balance.coinType === "0x2::sui::SUI");
        const suiBalance = suiBalanceObj ? BigInt(suiBalanceObj.totalBalance) : 0n;

        // const feeAmount = BigInt(suiAmount) / 100n; // 1%
        const buffer = 10_000_000n; // 0.01 SUI buffer for gas
        const feeAmount = (BigInt(suiAmount) * 12n) / 1000n; // 1.2% (12/1000)
        const tradeAmount = BigInt(suiAmount) - feeAmount;

        const totalRequired = feeAmount + tradeAmount + buffer;
        if (suiBalance < totalRequired) {
            throw new Error("Insufficient SUI balance (including gas + fee)");
        }

        // First check if the route exists before taking fees
        let route;
        try {
            route = await router.getCompleteTradeRouteGivenAmountIn({
                coinInType: '0x2::sui::SUI',
                coinOutType: tokenAddress,
                coinInAmount: tradeAmount,
            });
        } catch (e) {
            console.error("⚠️ Route error:", e.message || e);
            throw new Error("❌ Failed to find swap route. Possibly unsupported token or too low amount.");
        }

        if (!route || !route.routes?.length) {
            throw new Error("No viable trade route found.");
        }

        // STEP 1: Send 1% fee to your wallet
        const feeTx = new Transaction()
        const [feeCoin] = feeTx.splitCoins(feeTx.gas, [feeAmount]);
        feeTx.transferObjects([feeCoin], CENTRON_BOT_VAULT_WALLET);

        const feeResult = await client.signAndExecuteTransaction({
            signer: keyPair,
            transaction: feeTx,
            options: {
                showEffects: true,
                showObjectChanges: true,
            }
        });

        feeTransactionDigest = feeResult.digest;

        // STEP 2: Execute token trade
        const txBlock = await router.getTransactionForCompleteTradeRoute({
            walletAddress,
            completeRoute: route,
            slippage: normalizeSlippage(slippage)
        });

        const result = await client.signAndExecuteTransaction({
            signer: keyPair,
            transaction: txBlock,
            options: {
                showEffects: true,
                showObjectChanges: true,
            }
        });

        // Wait for balances to update
        await new Promise(resolve => setTimeout(resolve, 2000));

        const allBalances = await client.getAllBalances({ owner: walletAddress });
        const tokenBalanceObj = allBalances.find(b => b.coinType === tokenAddress);
        const tokenAmountReceived = tokenBalanceObj ? BigInt(tokenBalanceObj.totalBalance) : 0n;

        // Fetch token metadata
        let symbol = "UNKNOWN";
        let decimals = 9;
        try {
            const metadata = await fetchWithRetry(client, tokenAddress);
            if (!metadata || metadata.decimals === undefined) {
                throw new Error('⚠️ Failed to fetch token metadata');
            }
            symbol = metadata.symbol || symbol;
            decimals = metadata.decimals || decimals;
        } catch (err) {
            console.warn("⚠️ Token metadata error:", err.message);
        }

        const tokenAmountReadable = Number(tokenAmountReceived) / (10 ** decimals);

        return {
            success: true,
            transactionDigest: result.digest,
            feeTransactionDigest,
            walletAddress,
            spentSUI: Number(tradeAmount) / 1e9,
            tokenAmountReceived: Number(tokenAmountReceived),
            tokenAmountReadable,
            tokenSymbol: symbol,
            tokenAddress,
            decimals,
            feeAmount: Number(feeAmount) / 1e9,
            feePaid: Number(feeAmount) / 1e9,
            feeRecipient: CENTRON_BOT_VAULT_WALLET,
        };
    } catch (error) {
        console.error('Buy token error:', error);

        // If fee was taken but trade failed, include that info
        if (feeTransactionDigest) {
            error.feeTransactionDigest = feeTransactionDigest;
            error.message = `Trade failed but fee was already taken. Fee TX: ${feeTransactionDigest}. Error: ${error.message}`;
        }

        throw error;
    }
};