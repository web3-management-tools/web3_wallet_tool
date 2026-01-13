const te = new TextEncoder();
const td = new TextDecoder("utf-8", { fatal: true });
const PWD_DECRYPT_KEY = import.meta.env.VITE_APP_PWD_DECRYPT_KEY || 'default_secure_key';

// IV = b'0000000000000000' -> ASCII '0' (0x30) * 16
const IV = new Uint8Array(16).fill(0x30);

function bytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function sha256Key(password) {
  const keyBytes = await crypto.subtle.digest("SHA-256", te.encode(password));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
}

// 与 api/index.js 中的 encryptPwd 逻辑完全一致
async function encrypt(content, password) {
  if (!content) return content;
  if (!password) password = PWD_DECRYPT_KEY;

  const key = await sha256Key(password);
  const data = te.encode(content);
  const ctBuf = await crypto.subtle.encrypt({ name: "AES-CBC", iv: IV }, key, data);
  return bytesToBase64(new Uint8Array(ctBuf));
}

async function decrypt(encryptedContent, password) {
  if (!encryptedContent) return encryptedContent;
  if (!password) password = PWD_DECRYPT_KEY;

  const key = await sha256Key(password);
  const ct = base64ToBytes(encryptedContent);
  const ptBuf = await crypto.subtle.decrypt({ name: "AES-CBC", iv: IV }, key, ct);
  return td.decode(new Uint8Array(ptBuf));
}

export async function encryptPwd(pwd) {
  return await encrypt(pwd);
}

export async function decryptPwd(encryptedPwd) {
  return await decrypt(encryptedPwd);
}

export async function encryptPrivateKey(privateKey, password) {
  return await encrypt(privateKey, password);
}

export async function decryptPrivateKey(encryptedPrivateKey, password) {
  return await decrypt(encryptedPrivateKey, password);
}

export async function encryptPhrase(phrase, password) {
  return await encrypt(phrase, password);
}

export async function decryptPhrase(encryptedPhrase, password) {
  return await decrypt(encryptedPhrase, password);
}

export default {
  encryptPwd,
  decryptPwd,
  encryptPrivateKey,
  decryptPrivateKey,
  encryptPhrase,
  decryptPhrase
};
