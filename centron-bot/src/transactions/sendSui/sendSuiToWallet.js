import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { decodeSuiPrivateKeyLocal } from '../../inputs/getKeypairFromInput.js';
import { decryptWallet } from '../../core/cryptoCore.js';
import { importWalletFromInput } from '../../inputs/walletImport.js';


/**
 * Create keypair from various input formats
 */
export async function createKeypairFromInput(privateKey) {
    let keypair;

    // Handle different input formats
    if (typeof privateKey === 'object') {
        if (Buffer.isBuffer(privateKey)) {
            privateKey = privateKey.toString('hex');
        } else if (privateKey?.type === 'Buffer' && Array.isArray(privateKey?.data)) {
            privateKey = Buffer.from(privateKey.data).toString('hex');
        } else if (typeof privateKey.seedPhrase === 'string') {
            privateKey = privateKey.seedPhrase;
        } else {
            throw new Error("Unable to extract private key from object");
        }
    } else if (typeof privateKey !== 'string') {
        throw new Error(`Private key must be a string or buffer. Got: ${typeof privateKey}`);
    }

    // Try different key formats
    try {
        // 1. Check if it's a mnemonic seed phrase
        if (bip39.validateMnemonic(privateKey, wordlist)) {
            keypair = Ed25519Keypair.deriveKeypair(privateKey, "m/44'/784'/0'/0'/0'");
            if (!keypair) throw new Error("Failed to derive keypair from mnemonic");
            return keypair;
        }
    } catch (err) {
        // Not a mnemonic, continue trying other formats
    }

    try {
        // 2. Check if it's a Bech32 private key (suiprivkey1...)
        if (privateKey.startsWith('suiprivkey1')) {
            try {
                // Use your decodeSuiPrivateKeyLocal function
                const decoded = decodeSuiPrivateKeyLocal(privateKey);
                keypair = Ed25519Keypair.fromSecretKey(decoded.secretKey);
            } catch (bech32Error) {
                throw new Error(`Failed to import Bech32 key: ${bech32Error.message}`);
            }
            if (!keypair) throw new Error("Failed to create keypair from Bech32 key");
            return keypair;
        }
    } catch (err) {
        // Not Bech32, continue
    }

    try {
        // 3. Check if it's a hex private key (64 or 66 chars)
        if (privateKey.length === 64 || privateKey.length === 66) {
            let hexKey = privateKey;
            if (hexKey.startsWith('0x')) {
                hexKey = hexKey.slice(2);
            }
            const keyBytes = new Uint8Array(Buffer.from(hexKey, 'hex'));
            keypair = Ed25519Keypair.fromSecretKey(keyBytes);
            if (!keypair) throw new Error("Failed to create keypair from hex key");
            return keypair;
        }
    } catch (err) {
        // Not hex, continue
    }

    // 4. Try importing using your existing function
    try {
        // const { importWalletFromInput } = await import('./generateWallet.js');
        const walletData = await importWalletFromInput(privateKey);

        if (walletData.type === "Mnemonic") {
            keypair = Ed25519Keypair.deriveKeypair(walletData.phrase, "m/44'/784'/0'/0'/0'");
        } else {
            if (walletData.privateKey.startsWith('suiprivkey1')) {
                const decoded = decodeSuiPrivateKeyLocal(walletData.privateKey);
                keypair = Ed25519Keypair.fromSecretKey(decoded.secretKey);
            } else {
                let hexKey = walletData.privateKey;
                if (hexKey.startsWith('0x')) {
                    hexKey = hexKey.slice(2);
                }
                const keyBytes = new Uint8Array(Buffer.from(hexKey, 'hex'));
                keypair = Ed25519Keypair.fromSecretKey(keyBytes);
            }
        }
        if (!keypair) throw new Error("Failed to create keypair from imported wallet");
        return keypair;
    } catch (importError) {
        throw new Error(`Unable to import wallet: ${importError.message}`);
    }
}

/**
 * Send SUI from your vault wallet to a recipient with multiple decryption support
 */
export async function sendSuiToWallet(recipientAddress, amountInSui) {
    try {
        const CENTRON_BOT_VAULT_WALLET = process.env.CENTRON_BOT_VAULT_WALLET;
        const VAULT_PRIVATE_KEY = process.env.CENTRON_BOT_VAULT_PRIVATE_KEY;
        const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;

        if (!CENTRON_BOT_VAULT_WALLET || !VAULT_PRIVATE_KEY) {
            throw new Error("Vault wallet configuration missing");
        }

        if (!recipientAddress) {
            throw new Error("Missing recipient address");
        }

        if (!amountInSui || typeof amountInSui !== "number" || amountInSui <= 0) {
            throw new Error(`Invalid amount: ${amountInSui}`);
        }

        const client = new SuiClient({
            url: getFullnodeUrl("mainnet")
        });

        // Decrypt vault private key if it's encrypted
        let vaultPrivateKey = VAULT_PRIVATE_KEY;

        // Try decryption first
        if (ENCRYPTION_SECRET) {
            try {
                vaultPrivateKey = decryptWallet(VAULT_PRIVATE_KEY, ENCRYPTION_SECRET);
            } catch (decryptError) {
                vaultPrivateKey = VAULT_PRIVATE_KEY;
            }
        }

        // Create keypair using multiple methods
        const keyPair = await createKeypairFromInput(vaultPrivateKey);

        if (!keyPair) {
            throw new Error("❌ Failed to create keypair from vault private key");
        }

        const vaultAddress = keyPair.getPublicKey().toSuiAddress();

        // Check balance
        const { data: ownedCoins } = await client.getCoins({
            owner: vaultAddress,
            coinType: "0x2::sui::SUI",
        });

        if (!ownedCoins.length) {
            throw new Error("No SUI coins found in vault wallet");
        }

        const availableBalance = ownedCoins.reduce((acc, coin) => acc + BigInt(coin.balance), 0n);

        // Convert SUI to smallest unit (MIST)
        const amountInMist = BigInt(Math.floor(amountInSui * 1e9));
        const gasBuffer = 10_000_000n; // 0.01 SUI for gas
        const totalRequired = amountInMist + gasBuffer;

        if (availableBalance < totalRequired) {
            throw new Error(
                `Insufficient vault balance. Required: ${Number(totalRequired) / 1e9} SUI, ` +
                `Available: ${Number(availableBalance) / 1e9} SUI`
            );
        }

        // Create transaction
        const tx = new Transaction();
        const [coin] = tx.splitCoins(tx.gas, [amountInMist]);
        tx.transferObjects([coin], recipientAddress);
        const gasBudget = 10_000_000n; // 0.01 SUI
        tx.setGasBudget(Number(gasBudget));
        // tx.setGasBudget(10000000); // 0.01 SUI


        // Sign and execute
        const result = await client.signAndExecuteTransaction({
            signer: keyPair,
            transaction: tx,
            options: {
                showEffects: true,
                showObjectChanges: true
            }
        });

        return {
            success: true,
            digest: result.digest,
            amount: amountInSui,
            recipient: recipientAddress,
            vaultAddress: vaultAddress
        };
    } catch (error) {
        console.error(`❌ Error sending SUI:`, error.message);
        throw error;
    }
}