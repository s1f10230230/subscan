import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// バリデーションスキーマ
const updateEmailAccountSchema = z.object({
  isActive: z.boolean().optional(),
})

/**
 * GET /api/email-accounts/[id]
 * 特定のEmailAccountの詳細を取得
 */
export async function GET(
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

    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        id: params.id,
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
    })

    if (!emailAccount) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...emailAccount,
      emailDataCount: emailAccount._count.emailData,
    })
  } catch (error) {
    console.error('Failed to fetch email account:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/email-accounts/[id]
 * EmailAccountの設定を更新
 */
export async function PATCH(
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

    const body = await request.json()
    const validatedData = updateEmailAccountSchema.parse(body)

    // EmailAccountの存在確認と所有者確認
    const existingAccount = await prisma.emailAccount.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      )
    }

    // EmailAccountを更新
    const updatedAccount = await prisma.emailAccount.update({
      where: {
        id: params.id,
      },
      data: validatedData,
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
    if (typeof validatedData.isActive === 'boolean') {
      await prisma.userActivityLog.create({
        data: {
          userId: session.user.id,
          action: validatedData.isActive ? 'email_account_activated' : 'email_account_deactivated',
          details: JSON.stringify({
            emailAccountId: params.id,
            emailAddress: existingAccount.emailAddress,
          }),
        },
      })
    }

    return NextResponse.json(updatedAccount)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to update email account:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/email-accounts/[id]
 * EmailAccountを削除
 */
export async function DELETE(
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

    // EmailAccountの存在確認と所有者確認
    const existingAccount = await prisma.emailAccount.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Email account not found' },
        { status: 404 }
      )
    }

    // EmailAccountを削除（Cascade削除でEmailDataも削除される）
    await prisma.emailAccount.delete({
      where: {
        id: params.id,
      },
    })

    // アクティビティログ記録
    await prisma.userActivityLog.create({
      data: {
        userId: session.user.id,
        action: 'email_account_deleted',
        details: JSON.stringify({
          emailAddress: existingAccount.emailAddress,
          provider: existingAccount.provider,
        }),
      },
    })

    return NextResponse.json(
      { message: 'Email account deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete email account:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}