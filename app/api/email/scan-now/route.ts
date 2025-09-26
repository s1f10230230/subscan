import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getGmailClientFromAccessToken, fetchAndParseTransactions, refineSubscriptionFlags, aggregateMonthly } from '@/lib/gmail-card-parser'
import { decrypt } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

const AUTH_NO_DB = process.env.NEXT_PUBLIC_AUTH_NO_DB === 'true'

export async function POST(req: NextRequest) {
  try {
    const { save = false } = (await req.json().catch(() => ({}))) as { save?: boolean }
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let accessToken: string | null = null
    let userId: string | null = null
    let emailAccountId: string | null = null
    if (AUTH_NO_DB) {
      accessToken = process.env.GMAIL_ACCESS_TOKEN || null
      if (!accessToken) {
        return NextResponse.json({ error: 'GMAIL_ACCESS_TOKEN not set (dev no-DB mode)' }, { status: 500 })
      }
    } else {
      const user = await prisma.user.findUnique({ where: { email: session.user.email } })
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      userId = user.id

      const account = await prisma.emailAccount.findFirst({ where: { userId: user.id, isActive: true } })
      if (!account) {
        return NextResponse.json({ error: 'No connected email account' }, { status: 400 })
      }
      try {
        accessToken = decrypt(account.accessToken)
      } catch {
        accessToken = account.accessToken
      }
      emailAccountId = account.id
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'No access token available' }, { status: 500 })
    }

    // Parser is expected at '@/lib/gmail-card-parser'

    // Decrypt tokens
    // In production, decrypt here; for now assume plaintext or already usable.
    const gmail = getGmailClientFromAccessToken(accessToken)
    const tx = await fetchAndParseTransactions(gmail, { newerThanDays: 90, maxMessages: 200 })
    if (refineSubscriptionFlags) refineSubscriptionFlags(tx)
    const summary = aggregateMonthly ? aggregateMonthly(tx) : null

    let persisted = { emailDataCreated: 0, transactionsCreated: 0, duplicates: 0 }
    if (save && !AUTH_NO_DB && userId && emailAccountId) {
      for (const t of tx) {
        try {
          // Upsert EmailData by unique (emailAccountId, messageId)
          const existingEmailData = await prisma.emailData.findFirst({ where: { emailAccountId, messageId: t.id } })
          const emailData = await prisma.emailData.upsert({
            where: { emailAccountId_messageId: { emailAccountId, messageId: t.id } },
            update: {
              subject: (t.subject || '').slice(0, 255),
              sender: (t.sender || '').slice(0, 255),
              receivedAt: t.emailTs ? new Date(t.emailTs) : new Date(),
              extractedAmount: typeof t.amount === 'number' ? t.amount : null,
              extractedCurrency: 'JPY',
              merchantName: t.merchant || t.merchantRaw || null,
              processed: true,
              processedAt: new Date(),
            },
            create: {
              emailAccountId,
              messageId: t.id,
              subject: (t.subject || '').slice(0, 255),
              sender: (t.sender || '').slice(0, 255),
              receivedAt: t.emailTs ? new Date(t.emailTs) : new Date(),
              extractedAmount: typeof t.amount === 'number' ? t.amount : null,
              extractedCurrency: 'JPY',
              merchantName: t.merchant || t.merchantRaw || null,
              processed: true,
              processedAt: new Date(),
            },
          })
          const existingTx = await prisma.transaction.findFirst({ where: { emailDataId: emailData.id } })
          if (existingTx) {
            persisted.duplicates += 1
            continue
          }

          // Resolve category by name mapping
          const categoryName = t.category === 'サブすく' ? 'サブスクリプション' : t.category
          const category = await prisma.category.findFirst({
            where: {
              OR: [
                { userId, name: categoryName },
                { userId: null, name: categoryName },
              ],
            },
            orderBy: { userId: 'desc' },
          })
          if (!category) {
            // fallback to 'その他'
            const fallback = await prisma.category.findFirst({ where: { OR: [{ userId, name: 'その他' }, { userId: null, name: 'その他' }] } })
            if (!fallback) throw new Error('No category available')
            var categoryId = fallback.id
          } else {
            var categoryId = category.id
          }

          // Resolve a credit card (first active or create placeholder)
          let card = await prisma.creditCard.findFirst({ where: { userId, isActive: true } })
          if (!card) {
            card = await prisma.creditCard.create({
              data: {
                userId,
                name: t.cardName || `${t.provider} Card`,
                brand: t.provider,
                issuer: t.provider,
                lastDigits: '0000',
                isActive: true,
              },
            })
          }

          const amt = typeof t.amount === 'number' ? t.amount : 0
          if (!amt || amt <= 0) {
            // Skip creating Transaction when amount couldn't be parsed
            persisted.duplicates += 0 // no-op; keep stats structure stable
            continue
          }

          await prisma.transaction.create({
            data: {
              userId,
              creditCardId: card.id,
              categoryId,
              amount: amt,
              currency: 'JPY',
              merchantName: t.merchant || t.merchantRaw || '',
              description: t.subject || null,
              transactionDate: t.occurredAt ? new Date(t.occurredAt) : (t.emailTs ? new Date(t.emailTs) : new Date()),
              source: 'AUTO_EMAIL',
              emailDataId: emailData.id,
              isVerified: false,
            },
          })
          persisted.transactionsCreated += 1
          if (!existingEmailData) persisted.emailDataCreated += 1
        } catch (e) {
          // skip individual failures to keep flow robust
        }
      }
    }

    return NextResponse.json({
      transactionsFound: tx.length,
      sample: tx.slice(0, 5),
      summary,
      saved: save && !AUTH_NO_DB ? persisted : undefined,
    })
  } catch (e) {
    console.error('scan-now failed', e)
    return NextResponse.json({ error: 'Scan failed', detail: (e as any)?.message || String(e) }, { status: 500 })
  }
}
