import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import * as crypto from "crypto";
import * as bip39 from "bip39";
import { wordlist } from "@scure/bip39/wordlists/english";

/**
 * Generate a 12-word mnemonic phrase.
 */
export async function generate12WordMnemonic() {
    const entropy = crypto.randomBytes(16); // 16 bytes = 128 bits
    return bip39.entropyToMnemonic(entropy.toString("hex"), wordlist);
}

/**
 * Generate a new SUI wallet from a 12-word mnemonic.
 */
export async function generateWallet() {
    const mnemonic = await generate12WordMnemonic();
    const keypair = Ed25519Keypair.deriveKeypair(mnemonic);

    return {
        seedPhrase: mnemonic,
        walletAddress: keypair.getPublicKey().toSuiAddress(),
        privateKey: keypair.getSecretKey(),
    };
}