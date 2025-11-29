import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Aftermath } from "aftermath-ts-sdk";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { getKeypairFromInput } from "../../inputs/getKeypairFromInput.js";
import { normalizeSlippage } from "../../utils/slippage.js";

const CENTRON_BOT_VAULT_WALLET = process.env.CENTRON_BOT_VAULT_WALLET

export const sellTokenWithAftermath = async ({ tokenAddress, phrase, suiPercentage, slippage }) => {
    try {

        if (!tokenAddress || !phrase || !suiPercentage || !slippage) {
            throw new Error("Missing required parameters");
        }

        if (slippage < 0 || slippage > 100) {
            throw new Error("Slippage must be between 0 and 100");
        }

        if (suiPercentage <= 0 || suiPercentage > 100) {
            throw new Error("Percentage must be between 1 and 100");
        }

        if (!CENTRON_BOT_VAULT_WALLET) {
            throw new Error("Fee receiver address not configured");
        }

        const client = new SuiClient({
            url: getFullnodeUrl("mainnet")
        });

        const afsdk = new Aftermath("MAINNET");
        await afsdk.init();
        const router = afsdk.Router();
        const keyPair = await getKeypairFromInput(phrase);
        const walletAddress = keyPair.getPublicKey().toSuiAddress();

        // 🟢 GET SUI BALANCE BEFORE SWAP
        const balancesBeforeSwap = await client.getAllBalances({ owner: walletAddress });
        const suiBeforeSwapObj = balancesBeforeSwap.find(b => b.coinType === '0x2::sui::SUI');
        const suiBalanceBeforeSwap = suiBeforeSwapObj ? BigInt(suiBeforeSwapObj.totalBalance) : 0n;

        const tokenBalanceObj = balancesBeforeSwap.find(b => b.coinType === tokenAddress);
        const totalBalance = tokenBalanceObj ? BigInt(tokenBalanceObj.totalBalance) : 0n;

        if (totalBalance === 0n) {
            throw new Error("You have no balance of this token to sell.");
        }

        const tokenAmount = (totalBalance * BigInt(suiPercentage)) / 100n;
        if (tokenAmount === 0n) {
            throw new Error("Token amount to sell is too small.");
        }

        // Get expected SUI output to calculate fee beforehand
        let route;
        try {
            route = await router.getCompleteTradeRouteGivenAmountIn({
                coinInType: tokenAddress,
                coinOutType: '0x2::sui::SUI',
                coinInAmount: tokenAmount,
            });
        } catch (e) {
            console.error("❌ Route error:", e.message || e);
            throw new Error("Failed to find swap route for this token.");
        }

        if (!route || !route.routes?.length) {
            throw new Error("No viable trade route found for this token.");
        }

        // Calculate expected output and fee
        const expectedSuiOutput = BigInt(route.coinOut.amount);
        const FEE_BPS = 120; // 1.2% in basis points
        const feeAmount = (expectedSuiOutput * BigInt(FEE_BPS)) / 10000n;
        const expectedUserSui = expectedSuiOutput - feeAmount;

        // Execute the swap
        const txBlock = await router.getTransactionForCompleteTradeRoute({
            walletAddress,
            completeRoute: route,
            slippage: normalizeSlippage(slippage),
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

        // 🟢 GET SUI BALANCE AFTER SWAP
        const updatedBalances = await client.getAllBalances({ owner: walletAddress });
        const suiBalanceObj = updatedBalances.find(b => b.coinType === '0x2::sui::SUI');
        const suiBalanceAfterSwap = suiBalanceObj ? BigInt(suiBalanceObj.totalBalance) : 0n;

        // 🟢 CALCULATE ACTUAL SUI RECEIVED FROM SWAP
        const actualSuiFromSwap = suiBalanceAfterSwap - suiBalanceBeforeSwap;

        // Calculate actual fee based on what we received (with minimum check)
        const actualFeeAmount = actualSuiFromSwap >= feeAmount ? feeAmount : actualSuiFromSwap / 100n;

        // Send fee
        if (actualFeeAmount > 0n) {
            const feeTx = new Transaction();
            const [feeCoin] = feeTx.splitCoins(feeTx.gas, [actualFeeAmount]);
            feeTx.transferObjects([feeCoin], CENTRON_BOT_VAULT_WALLET);

            await client.signAndExecuteTransaction({
                signer: keyPair,
                transaction: feeTx,
                options: {
                    showEffects: true,
                    showObjectChanges: true,
                }
            });
        }

        // Fetch token metadata for symbol
        let symbol = "UNKNOWN";
        let decimals = 9;
        try {
            const metadata = await fetchWithRetry(client, tokenAddress);
            if (metadata) {
                symbol = metadata.symbol || tokenAddress.split("::")[2] || "UNKNOWN";
                decimals = metadata.decimals || 9;
            }
        } catch (err) {
            console.warn("⚠️ Token metadata error:", err.message);
            symbol = tokenAddress.split("::")[2] || "UNKNOWN";
        }

        const finalUserSui = actualSuiFromSwap - actualFeeAmount;

        return {
            success: true,
            transactionDigest: result.digest,
            walletAddress,
            tokenAmountSold: Number(tokenAmount),
            tokenAddress,
            decimals,
            expectedSuiOutput: Number(expectedSuiOutput) / 1e9,
            actualSuiReceived: Number(actualSuiFromSwap) / 1e9, // 🟢 FIXED: Only swap proceeds
            suiReceivedAfterFee: Number(finalUserSui) / 1e9,
            suiAfterFee: Number(finalUserSui) / 1e9,
            feeAmount: Number(actualFeeAmount) / 1e9,
            feePaid: Number(actualFeeAmount) / 1e9,
            feeRecipient: CENTRON_BOT_VAULT_WALLET,
            percentageSold: suiPercentage,
            tokenSymbol: symbol,
        };
    } catch (error) {
        console.error('❌ [SELL] Error:', error);
        throw error;
    }
};