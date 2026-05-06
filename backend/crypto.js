/**
 * NetEase Cloud Music API Crypto Module
 * Implements the weapi encryption algorithm
 */
const crypto = require('crypto');

// Constants for RSA encryption
const PUBLIC_KEY = '010001';
const MODULUS = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';
const NONCE = '0CoJUm6Qyw8W8jud';
const IV = '0102030506070809';

/**
 * Generate a random 16-byte key as a raw string (NOT hex)
 * Each character is one byte, totaling 16 bytes for AES-128
 */
function generateRandomKey() {
  const bytes = crypto.randomBytes(16);
  // Convert each byte to a character (Latin-1 range)
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

/**
 * AES-128-CBC encryption
 * key must be 16 bytes
 */
function aesEncrypt(text, key, iv) {
  const keyBuffer = Buffer.from(key, 'latin1');
  const ivBuffer = Buffer.from(iv, 'latin1');
  const cipher = crypto.createCipheriv('aes-128-cbc', keyBuffer, ivBuffer);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

/**
 * RSA encryption for the key
 * The key string is first converted to hex, then reversed (as hex bytes),
 * then encrypted with RSA public key
 */
function rsaEncrypt(keyStr) {
  // Convert the raw key string to hex representation
  let hexStr = '';
  for (let i = 0; i < keyStr.length; i++) {
    hexStr += keyStr.charCodeAt(i).toString(16).padStart(2, '0');
  }
  
  // Reverse the hex bytes (reverse pairs)
  const reversed = Buffer.from(hexStr, 'hex').reverse().toString('hex');
  
  // Use Node.js built-in RSA encryption with modPow
  const publicKeyBigInt = BigInt('0x' + PUBLIC_KEY);
  const modulusBigInt = BigInt('0x' + MODULUS);
  const messageBigInt = BigInt('0x' + reversed);
  
  const result = modPow(messageBigInt, publicKeyBigInt, modulusBigInt);
  const resultHex = result.toString(16).padStart(256, '0');
  
  return resultHex;
}

/**
 * Modular exponentiation using BigInt
 */
function modPow(base, exponent, modulus) {
  if (modulus === 1n) return 0n;
  let result = 1n;
  base = base % modulus;
  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      result = (result * base) % modulus;
    }
    exponent = exponent >> 1n;
    base = (base * base) % modulus;
  }
  return result;
}

/**
 * Create weapi params and encSecKey
 * Returns { params: string, encSecKey: string }
 */
function weapiEncrypt(data) {
  const text = JSON.stringify(data);
  const randomKey = generateRandomKey();
  
  // First AES encryption with NONCE
  const firstEncrypted = aesEncrypt(text, NONCE, IV);
  // Second AES encryption with random key
  const params = aesEncrypt(firstEncrypted, randomKey, IV);
  // RSA encrypt the random key
  const encSecKey = rsaEncrypt(randomKey);
  
  return { params, encSecKey };
}

module.exports = { weapiEncrypt, aesEncrypt, rsaEncrypt };
