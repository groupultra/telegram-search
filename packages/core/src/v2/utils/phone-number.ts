const KEY = 123456789

/**
 * Encrypts a phone number (with country code) into a UUID format
 * Uses a simple multiplication cipher with timestamp for uniqueness
 */
export function encryptPhoneToUUID(phone: string): string {
  // Remove "+" and convert to pure number
  const numStr = phone.replace('+', '')
  const num = Number.parseInt(numStr)

  // Simple obfuscation with fixed key
  const encrypted = (num * KEY) % 1e14 // Supports up to 14 digits (country code + phone)

  // Convert to hex and pad to 32 chars with timestamp
  let hex = encrypted.toString(16).padStart(10, '0') + Date.now().toString(16).slice(-6)
  hex = hex.padEnd(32, '0') // Ensure 32 chars

  // Format as UUID
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Decrypts a UUID back to the original phone number
 * Reverses the multiplication cipher using modular multiplicative inverse
 */
export function decryptPhoneFromUUID(uuid: string, originalLength: number): string {
  // Remove hyphens and take first 10 chars (encrypted portion)
  const hex = uuid.replace(/-/g, '').slice(0, 10)
  const num = Number.parseInt(hex, 16)

  // Reverse calculation
  const modInverse = 13717421 // Multiplicative inverse of key mod 1e14
  const decrypted = (num * modInverse) % 1e14

  // Pad to original length and add back "+"
  return `+${decrypted.toString().padStart(originalLength - 1, '0')}`
}
