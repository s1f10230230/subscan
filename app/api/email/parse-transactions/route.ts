import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { EmailParser, ParseResult } from '@/lib/email/parser';
import { getGmailClientForUser } from '@/lib/email/gmail';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface ParseTransactionsRequest {
  emailAccountId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  maxEmails?: number;
  autoSave?: boolean;
}

interface ParseTransactionsResponse {
  success: boolean;
  data?: {
    totalEmails: number;
    parsedEmails: number;
    successfulParses: number;
    transactions: TransactionResult[];
    subscriptions: SubscriptionResult[];
    errors: string[];
  };
  error?: string;
}

interface TransactionResult {
  id?: string;
  amount: number;
  currency: string;
  merchantName: string;
  confidence: number;
  type: string;
  emailId: string;
  created: boolean;
}

interface SubscriptionResult {
  id?: string;
  serviceName: string;
  amount: number;
  currency: string;
  billingCycle: string;
  confidence: number;
  emailId: string;
  created: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json() as ParseTransactionsRequest;
    const {
      emailAccountId,
      dateRange,
      maxEmails = 100,
      autoSave = false
    } = body;

    // Gmail クライアント取得
    const gmailClient = await getGmailClientForUser(user.id);
    if (!gmailClient) {
      return NextResponse.json({
        error: 'Gmail account not connected'
      }, { status: 400 });
    }

    // メール取得
    const daysPast = dateRange ?
      Math.ceil((new Date().getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) :
      30;

    const emails = await gmailClient.searchCreditCardEmails([], daysPast);
    const limitedEmails = emails.slice(0, maxEmails);

    // メール解析
    const parser = new EmailParser(false);
    const parseResults: ParseResult[] = [];

    for (const email of limitedEmails) {
      try {
        const result = await parser.parseEmail({
          id: email.id,
          subject: email.subject,
          sender: email.from,
          receivedDate: email.date,
          body: email.body || email.snippet
        });
        parseResults.push(result);
      } catch (error) {
        parseResults.push({
          success: false,
          confidence: 0,
          type: 'UNKNOWN',
          errors: [`Parse error: ${error instanceof Error ? error.message : String(error)}`]
        });
      }
    }

    // 結果を分類
    const transactions: TransactionResult[] = [];
    const subscriptions: SubscriptionResult[] = [];
    const errors: string[] = [];

    for (let i = 0; i < parseResults.length; i++) {
      const result = parseResults[i];
      const email = limitedEmails[i];

      if (!result.success || !result.data) {
        errors.push(...result.errors);
        continue;
      }

      if (result.type === 'SUBSCRIPTION' && result.confidence >= 0.7) {
        const subscriptionResult: SubscriptionResult = {
          serviceName: result.data.serviceName!,
          amount: result.data.amount,
          currency: result.data.currency,
          billingCycle: result.data.billingCycle!,
          confidence: result.confidence,
          emailId: email.id,
          created: false
        };

        if (autoSave) {
          try {
            const saved = await saveSubscription(user.id, subscriptionResult, email);
            subscriptionResult.id = saved.id;
            subscriptionResult.created = true;
          } catch (saveError) {
            errors.push(`Failed to save subscription: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
          }
        }

        subscriptions.push(subscriptionResult);

      } else if (result.type === 'TRANSACTION' && result.confidence >= 0.5) {
        const transactionResult: TransactionResult = {
          amount: result.data.amount,
          currency: result.data.currency,
          merchantName: result.data.merchantName,
          confidence: result.confidence,
          type: result.type,
          emailId: email.id,
          created: false
        };

        if (autoSave && result.confidence >= 0.7) {
          try {
            const saved = await saveTransaction(user.id, transactionResult, email);
            transactionResult.id = saved.id;
            transactionResult.created = true;
          } catch (saveError) {
            errors.push(`Failed to save transaction: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
          }
        }

        transactions.push(transactionResult);
      }
    }

    const response: ParseTransactionsResponse = {
      success: true,
      data: {
        totalEmails: limitedEmails.length,
        parsedEmails: parseResults.length,
        successfulParses: parseResults.filter(r => r.success).length,
        transactions,
        subscriptions,
        errors
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Parse transactions error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * サブスクリプションをデータベースに保存
 */
async function saveSubscription(
  userId: string,
  subscription: SubscriptionResult,
  email: any
) {
  // 重複チェック
  const existing = await prisma.subscription.findFirst({
    where: {
      userId,
      serviceName: subscription.serviceName,
      amount: subscription.amount,
      currency: subscription.currency
    }
  });

  if (existing) {
    return existing;
  }

  // EmailData を先に保存
  const emailData = await saveEmailData(userId, email);

  // 新規作成
  return await prisma.subscription.create({
    data: {
      userId,
      serviceName: subscription.serviceName,
      amount: subscription.amount,
      currency: subscription.currency,
      billingCycle: subscription.billingCycle,
      detectionMethod: 'AUTO',
      confidenceScore: subscription.confidence,
      status: 'ACTIVE'
    }
  });
}

/**
 * 取引をデータベースに保存
 */
async function saveTransaction(
  userId: string,
  transaction: TransactionResult,
  email: any
) {
  // EmailData を先に保存
  const emailData = await saveEmailData(userId, email);

  // デフォルトカテゴリ取得
  const defaultCategory = await prisma.category.findFirst({
    where: {
      OR: [
        { userId, isDefault: true },
        { userId: null, isDefault: true }
      ]
    }
  });

  if (!defaultCategory) {
    throw new Error('Default category not found');
  }

  // デフォルトクレジットカード取得
  const defaultCard = await prisma.creditCard.findFirst({
    where: {
      userId,
      isActive: true
    }
  });

  if (!defaultCard) {
    throw new Error('No credit card found for user');
  }

  return await prisma.transaction.create({
    data: {
      userId,
      creditCardId: defaultCard.id,
      categoryId: defaultCategory.id,
      amount: transaction.amount,
      currency: transaction.currency,
      merchantName: transaction.merchantName,
      transactionDate: new Date(email.date),
      source: 'AUTO_EMAIL',
      emailDataId: emailData.id,
      isVerified: transaction.confidence >= 0.8
    }
  });
}

/**
 * EmailData を保存
 */
async function saveEmailData(userId: string, email: any) {
  // EmailAccount 取得
  const emailAccount = await prisma.emailAccount.findFirst({
    where: {
      userId,
      isActive: true,
      provider: 'gmail'
    }
  });

  if (!emailAccount) {
    throw new Error('Email account not found');
  }

  // 重複チェック
  const existing = await prisma.emailData.findFirst({
    where: {
      emailAccountId: emailAccount.id,
      messageId: email.id
    }
  });

  if (existing) {
    return existing;
  }

  return await prisma.emailData.create({
    data: {
      emailAccountId: emailAccount.id,
      messageId: email.id,
      subject: email.subject.substring(0, 255),
      sender: email.from.substring(0, 255),
      receivedAt: email.date,
      processed: true,
      processedAt: new Date()
    }
  });
}