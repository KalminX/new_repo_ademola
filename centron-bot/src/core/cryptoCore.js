import * as crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ENCRYPTION_ALGORITHM = process.env.ENCRYPTION_ALGORITHM || "aes-256-cbc";
const IV_LENGTH = Number(process.env.IV_LENGTH || 16);

/**
 * Encrypt a wallet object using AES.
 */
export function encryptWallet(wallet, password) {
    const json = JSON.stringify(wallet);
    const key = crypto.createHash("sha256").update(password).digest();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a previously encrypted wallet string.
 */
export function decryptWallet(encrypted, password) {
    const [ivHex, encryptedHex] = encrypted.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encryptedData = Buffer.from(encryptedHex, "hex");
    const key = crypto.createHash("sha256").update(password).digest();

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
}