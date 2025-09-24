import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encryption'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
import { getGmailClientForUser, createGmailClient } from '@/lib/email/gmail'
import { z } from 'zod'

// バリデーションスキーマ
const createEmailAccountSchema = z.object({
  emailAddress: z.string().email(),
  provider: z.enum(['gmail']),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  tokenExpires: z.string().datetime().optional(),
})

const updateEmailAccountSchema = z.object({
  isActive: z.boolean().optional(),
})

/**
 * GET /api/email-accounts
 * ユーザーのEmailAccountリストを取得
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const emailAccounts = await prisma.emailAccount.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        emailAddress: true,
        provider: true,
        isActive: true,
        lastSync: true,
        createdAt: true,
        updatedAt: true,
        tokenExpires: true,
        _count: {
          select: {
            emailData: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // トークンの有効性をチェック
    const accountsWithStatus = await Promise.all(
      emailAccounts.map(async (account) => {
        let isTokenValid = false

        try {
          if (account.isActive) {
            const fullAccount = await prisma.emailAccount.findUnique({
              where: { id: account.id },
            })

            if (fullAccount) {
              const gmailClient = await createGmailClient(fullAccount)
              isTokenValid = await gmailClient.validateToken()
            }
          }
        } catch (error) {
          console.error(`Failed to validate token for account ${account.id}:`, error)
        }

        return {
          ...account,
          isTokenValid,
          emailDataCount: account._count.emailData,
        }
      })
    )

    return NextResponse.json({
      emailAccounts: accountsWithStatus,
      total: emailAccounts.length,
    })
  } catch (error) {
    console.error('Failed to fetch email accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email-accounts
 * 新しいEmailAccountを作成
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = createEmailAccountSchema.parse(body)

    // 既存のEmailAccountをチェック
    const existingAccount = await prisma.emailAccount.findUnique({
      where: {
        userId_emailAddress: {
          userId: session.user.id,
          emailAddress: validatedData.emailAddress,
        },
      },
    })

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Email account already exists' },
        { status: 400 }
      )
    }

    // トークンを暗号化
    const encryptedAccessToken = encrypt(validatedData.accessToken)
    const encryptedRefreshToken = validatedData.refreshToken
      ? encrypt(validatedData.refreshToken)
      : null

    // EmailAccountを作成
    const emailAccount = await prisma.emailAccount.create({
      data: {
        userId: session.user.id,
        emailAddress: validatedData.emailAddress,
        provider: validatedData.provider,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpires: validatedData.tokenExpires
          ? new Date(validatedData.tokenExpires)
          : null,
        isActive: true,
        lastSync: null,
      },
      select: {
        id: true,
        emailAddress: true,
        provider: true,
        isActive: true,
        lastSync: true,
        createdAt: true,
        updatedAt: true,
        tokenExpires: true,
      },
    })

    // アクティビティログ記録
    await prisma.userActivityLog.create({
      data: {
        userId: session.user.id,
        action: 'email_account_connected',
        details: JSON.stringify({
          emailAddress: validatedData.emailAddress,
          provider: validatedData.provider,
        }),
      },
    })

    return NextResponse.json(emailAccount, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to create email account:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}