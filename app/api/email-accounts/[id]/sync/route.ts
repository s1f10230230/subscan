import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createGmailClient, extractTransactionFromEmail, logEmailProcessingError } from '@/lib/email/gmail'

/**
 * POST /api/email-accounts/[id]/sync
 * 特定のEmailAccountでGmailからメールを同期
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { daysPast = 30, maxResults = 50 } = await request.json()

    // EmailAccountの取得と所有者確認
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        isActive: true,
      },
    })

    if (!emailAccount) {
      return NextResponse.json(
        { error: 'Email account not found or inactive' },
        { status: 404 }
      )
    }

    // Gmail APIクライアントを作成
    const gmailClient = await createGmailClient(emailAccount)

    // トークンの有効性を確認
    const isTokenValid = await gmailClient.validateToken()
    if (!isTokenValid) {
      return NextResponse.json(
        { error: 'Invalid or expired Gmail token' },
        { status: 401 }
      )
    }

    // クレジットカード関連のメールを検索
    const emails = await gmailClient.searchCreditCardEmails([], daysPast)

    let processedCount = 0
    let errorCount = 0
    const errors: string[] = []

    // 各メールを処理
    for (const email of emails) {
      try {
        // 既存のEmailDataをチェック
        const existingEmailData = await prisma.emailData.findUnique({
          where: {
            emailAccountId_messageId: {
              emailAccountId: emailAccount.id,
              messageId: email.id,
            },
          },
        })

        if (existingEmailData) {
          continue // すでに処理済み
        }

        // メールから取引情報を抽出
        const extractedInfo = extractTransactionFromEmail(email)

        // EmailDataを作成
        const emailData = await prisma.emailData.create({
          data: {
            emailAccountId: emailAccount.id,
            messageId: email.id,
            subject: email.subject.substring(0, 255),
            sender: email.from.substring(0, 255),
            receivedAt: email.date,
            extractedAmount: extractedInfo.amount,
            extractedCurrency: extractedInfo.currency,
            merchantName: extractedInfo.merchantName?.substring(0, 100),
            processed: false,
          },
        })

        processedCount++
      } catch (error) {
        console.error(`Failed to process email ${email.id}:`, error)

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Email ${email.id}: ${errorMessage}`)
        errorCount++

        // エラーログを記録
        try {
          await logEmailProcessingError(
            '', // emailDataIdが未作成なので空文字
            'sync_error',
            errorMessage,
            email.subject,
            email.from
          )
        } catch (logError) {
          console.error('Failed to log email processing error:', logError)
        }
      }
    }

    // 最終同期時刻を更新
    await prisma.emailAccount.update({
      where: {
        id: emailAccount.id,
      },
      data: {
        lastSync: new Date(),
      },
    })

    // アクティビティログ記録
    await prisma.userActivityLog.create({
      data: {
        userId: session.user.id,
        action: 'email_sync_completed',
        details: JSON.stringify({
          emailAccountId: emailAccount.id,
          emailAddress: emailAccount.emailAddress,
          processedCount,
          errorCount,
          totalEmailsFound: emails.length,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      processedCount,
      errorCount,
      totalEmailsFound: emails.length,
      errors: errors.slice(0, 10), // 最初の10件のエラーのみ返す
    })
  } catch (error) {
    console.error('Failed to sync emails:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // エラーのアクティビティログ記録
    try {
      const session = await getServerSession(authOptions)
      if (session?.user?.id) {
        await prisma.userActivityLog.create({
          data: {
            userId: session.user.id,
            action: 'email_sync_failed',
            details: JSON.stringify({
              emailAccountId: params.id,
              error: errorMessage,
            }),
          },
        })
      }
    } catch (logError) {
      console.error('Failed to log sync error:', logError)
    }

    return NextResponse.json(
      { error: 'Failed to sync emails', details: errorMessage },
      { status: 500 }
    )
  }
}