import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const AAD = Buffer.from('cardsync', 'utf8')

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || 'default-32-char-key-for-dev-only!'
  // Derive a 32-byte key from the provided string (stable across restarts)
  return crypto.createHash('sha256').update(raw, 'utf8').digest()
}

export function encrypt(text: string): string {
  try {
    const key = getKey()
    const iv = crypto.randomBytes(12) // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    cipher.setAAD(AAD)

    const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${enc.toString('hex')}`
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('暗号化に失敗しました')
  }
}

export function decrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 3) throw new Error('無効な暗号化データ形式')

    const [ivHex, tagHex, dataHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(tagHex, 'hex')
    const data = Buffer.from(dataHex, 'hex')

    const key = getKey()
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAAD(AAD)
    decipher.setAuthTag(authTag)

    const dec = Buffer.concat([decipher.update(data), decipher.final()])
    return dec.toString('utf8')
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('復号化に失敗しました')
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return salt + ':' + hash
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  try {
    const parts = hashedPassword.split(':')
    if (parts.length !== 2) return false

    const salt = parts[0]
    const hash = parts[1]
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')

    return hash === verifyHash
  } catch (error) {
    console.error('Password verification error:', error)
    return false
  }
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex')
}
