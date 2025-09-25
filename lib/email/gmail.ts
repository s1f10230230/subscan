import { google, gmail_v1 } from 'googleapis'
import { decrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'
import { EmailAccount, User } from '@prisma/client'

export interface GmailMessage {
  id: string
  threadId: string
  subject: string
  from: string
  date: Date
  snippet: string
  body?: string
}

export interface EmailProcessingResult {
  success: boolean
  processedCount: number
  errorCount: number
  errors: string[]
}

export class GmailAPI {
  private gmail: gmail_v1.Gmail
  private accessToken: string
  private refreshToken?: string

  constructor(accessToken: string, refreshToken?: string) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    )

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    })

    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  }

  /**
   * 指定された日数以内のメールを取得
   */
  async getRecentEmails(daysPast: number = 30, maxResults: number = 50): Promise<GmailMessage[]> {
    try {
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - daysPast)
      const query = `after:${fromDate.getFullYear()}/${fromDate.getMonth() + 1}/${fromDate.getDate()}`

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults,
      })

      const messages = response.data.messages || []
      const emailDetails: GmailMessage[] = []

      for (const message of messages) {
        if (message.id) {
          const detail = await this.getMessageDetails(message.id)
          if (detail) {
            emailDetails.push(detail)
          }
        }
      }

      return emailDetails
    } catch (error) {
      console.error('Failed to fetch recent emails:', error)
      throw new Error('Gmail API error: Failed to fetch emails')
    }
  }

  /**
   * 特定のメールの詳細を取得
   */
  async getMessageDetails(messageId: string): Promise<GmailMessage | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      })

      const message = response.data
      const headers = message.payload?.headers || []

      const getHeader = (name: string) =>
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

      const subject = getHeader('subject')
      const from = getHeader('from')
      const dateStr = getHeader('date')
      const date = dateStr ? new Date(dateStr) : new Date()

      // メール本文の取得
      let body = ''
      if (message.payload?.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
      } else if (message.payload?.parts) {
        // マルチパート形式の場合
        for (const part of message.payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8')
            break
          }
        }
      }

      return {
        id: messageId,
        threadId: message.threadId || '',
        subject,
        from,
        date,
        snippet: message.snippet || '',
        body,
      }
    } catch (error) {
      console.error(`Failed to get message details for ${messageId}:`, error)
      return null
    }
  }

  /**
   * クレジットカード関連のメールを検索
   */
  async searchCreditCardEmails(keywords: string[] = [], daysPast: number = 30): Promise<GmailMessage[]> {
    const defaultKeywords = [
      'ご利用明細',
      'クレジットカード',
      'カード利用',
      'ご請求',
      '決済完了',
      'お支払い',
      'subscription',
      'payment',
      'billing',
      'charge'
    ]

    const searchKeywords = keywords.length > 0 ? keywords : defaultKeywords
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - daysPast)

    const queries = searchKeywords.map(keyword =>
      `subject:"${keyword}" OR from:"${keyword}" after:${fromDate.getFullYear()}/${fromDate.getMonth() + 1}/${fromDate.getDate()}`
    )

    const allMessages: GmailMessage[] = []
    const seenIds = new Set<string>()

    for (const query of queries) {
      try {
        const response = await this.gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 20,
        })

        const messages = response.data.messages || []

        for (const message of messages) {
          if (message.id && !seenIds.has(message.id)) {
            seenIds.add(message.id)
            const detail = await this.getMessageDetails(message.id)
            if (detail) {
              allMessages.push(detail)
            }
          }
        }
      } catch (error) {
        console.error(`Failed to search emails with query: ${query}`, error)
      }
    }

    return allMessages.sort((a, b) => b.date.getTime() - a.date.getTime())
  }

  /**
   * トークンの有効性を確認
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.gmail.users.getProfile({ userId: 'me' })
      return true
    } catch (error) {
      console.error('Token validation failed:', error)
      return false
    }
  }
}

/**
 * ユーザーのEmailAccountからGmailAPIインスタンスを作成
 */
export async function createGmailClient(emailAccount: EmailAccount): Promise<GmailAPI> {
  const decryptedAccessToken = decrypt(emailAccount.accessToken)
  const decryptedRefreshToken = emailAccount.refreshToken ? decrypt(emailAccount.refreshToken) : undefined

  return new GmailAPI(decryptedAccessToken, decryptedRefreshToken)
}

/**
 * ユーザーのEmailAccountからGmailAPIインスタンスを取得
 */
export async function getGmailClientForUser(userId: string, emailAddress?: string): Promise<GmailAPI | null> {
  try {
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        userId,
        ...(emailAddress && { emailAddress }),
        isActive: true,
        provider: 'gmail',
      },
    })

    if (!emailAccount) {
      return null
    }

    return createGmailClient(emailAccount)
  } catch (error) {
    console.error('Failed to get Gmail client for user:', error)
    return null
  }
}

/**
 * メールからクレジットカード取引情報を抽出
 */
export function extractTransactionFromEmail(message: GmailMessage): {
  amount?: number
  currency?: string
  merchantName?: string
  transactionDate?: Date
  cardInfo?: string
} {
  const { subject, from, body = '', snippet } = message
  const content = `${subject} ${body} ${snippet}`.toLowerCase()

  // 金額抽出のパターン
  const amountPatterns = [
    /(\d{1,3}(?:,\d{3})*)\s*円/,
    /¥\s*(\d{1,3}(?:,\d{3})*)/,
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
    /(\d{1,3}(?:,\d{3})*)\s*yen/i,
  ]

  let extractedAmount: number | undefined
  let currency = 'JPY' // デフォルト通貨

  for (const pattern of amountPatterns) {
    const match = content.match(pattern)
    if (match) {
      const amountStr = match[1].replace(/,/g, '')
      // 主要単位で保持（JPYは整数化、USD等は小数維持）
      if (pattern.source.includes('$')) {
        currency = 'USD'
        extractedAmount = Math.round(parseFloat(amountStr) * 100) / 100
      } else {
        extractedAmount = Math.round(parseFloat(amountStr))
      }
      break
    }
  }

  // 加盟店名抽出のパターン
  const merchantPatterns = [
    /(?:ご利用店|店舗名|merchant|from)\s*[:：]\s*([^\n\r]+)/i,
    /([A-Za-z0-9\s]+(?:店|ストア|Store|Shop))/i,
    /Amazon\.co\.jp|Netflix|Spotify|Apple|Google|Microsoft/i,
  ]

  let merchantName: string | undefined
  for (const pattern of merchantPatterns) {
    const match = content.match(pattern)
    if (match) {
      merchantName = match[1] || match[0]
      merchantName = merchantName.trim().substring(0, 50) // 長さ制限
      break
    }
  }

  // 送信者からマーチャント名を推測
  if (!merchantName && from) {
    const emailMatch = from.match(/@([^.]+)/)
    if (emailMatch) {
      merchantName = emailMatch[1].replace(/[-_]/g, ' ')
    }
  }

  return {
    amount: extractedAmount,
    currency,
    merchantName,
    transactionDate: message.date,
    cardInfo: extractCardInfo(content),
  }
}

/**
 * メールからカード情報を抽出
 */
function extractCardInfo(content: string): string | undefined {
  const cardPatterns = [
    /(?:カード番号|card\s*number)\s*[:：]\s*\*+(\d{4})/i,
    /下4桁\s*[:：]\s*(\d{4})/,
    /ending\s+in\s+(\d{4})/i,
    /\*+(\d{4})\s*(?:でのご利用|での決済)/,
  ]

  for (const pattern of cardPatterns) {
    const match = content.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return undefined
}

/**
 * メール処理エラーのログ記録
 */
export async function logEmailProcessingError(
  emailDataId: string,
  errorType: string,
  errorMessage: string,
  emailSubject: string,
  emailSender: string
): Promise<void> {
  try {
    await prisma.emailProcessingError.create({
      data: {
        emailDataId,
        errorType,
        errorMessage,
        emailSubject: emailSubject.substring(0, 255),
        emailSender: emailSender.substring(0, 255),
      },
    })
  } catch (error) {
    console.error('Failed to log email processing error:', error)
  }
}
