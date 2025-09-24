import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { EmailParser } from '@/lib/email/parser';
import { getGmailClientForUser } from '@/lib/email/gmail';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

interface DetectSubscriptionsRequest {
  dateRange?: {
    start: string;
    end: string;
  };
  maxEmails?: number;
  confidenceThreshold?: number;
  autoSave?: boolean;
}

interface DetectedSubscription {
  id?: string;
  serviceName: string;
  amount: number;
  currency: string;
  billingCycle: string;
  confidence: number;
  nextBillingDate?: Date;
  status: 'DETECTED' | 'EXISTING' | 'SAVED';
  emailId: string;
  emailSubject: string;
  emailDate: Date;
  detectionMethod: string;
}

interface SubscriptionAnalysis {
  totalDetected: number;
  highConfidenceDetections: number;
  newSubscriptions: number;
  existingSubscriptions: number;
  estimatedMonthlyCost: number;
  estimatedYearlyCost: number;
  serviceBreakdown: Record<string, number>;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json() as DetectSubscriptionsRequest;
    const {
      dateRange,
      maxEmails = 200,
      confidenceThreshold = 0.7,
      autoSave = false
    } = body;

    // Gmail クライアント取得
    const gmailClient = await getGmailClientForUser(user.id);
    if (!gmailClient) {
      return NextResponse.json({
        error: 'Gmail account not connected'
      }, { status: 400 });
    }

    // サブスクリプション特化の検索キーワード
    const subscriptionKeywords = [
      'subscription',
      'サブスクリプション',
      'monthly',
      '月額',
      'billing',
      '請求',
      'renewal',
      '更新',
      'payment confirmation',
      'お支払い確認',
      'Netflix',
      'Spotify',
      'Adobe',
      'Microsoft',
      'Amazon Prime',
      'Apple',
      'Google'
    ];

    const daysPast = dateRange ?
      Math.ceil((new Date().getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) :
      90; // デフォルト3ヶ月

    // サブスクリプション関連メール取得
    const emails = await gmailClient.searchCreditCardEmails(subscriptionKeywords, daysPast);
    const limitedEmails = emails.slice(0, maxEmails);

    // 解析実行
    const parser = new EmailParser(false);
    const detectedSubscriptions: DetectedSubscription[] = [];
    const errors: string[] = [];

    // 既存のサブスクリプション取得（重複チェック用）
    const existingSubscriptions = await prisma.subscription.findMany({
      where: { userId: user.id }
    });

    for (const email of limitedEmails) {
      try {
        const parseResult = await parser.parseEmail({
          id: email.id,
          subject: email.subject,
          sender: email.from,
          receivedDate: email.date,
          body: email.body || email.snippet
        });

        if (parseResult.success &&
            parseResult.type === 'SUBSCRIPTION' &&
            parseResult.confidence >= confidenceThreshold &&
            parseResult.data) {

          const detected: DetectedSubscription = {
            serviceName: parseResult.data.serviceName!,
            amount: parseResult.data.amount,
            currency: parseResult.data.currency,
            billingCycle: parseResult.data.billingCycle!,
            confidence: parseResult.confidence,
            status: 'DETECTED',
            emailId: email.id,
            emailSubject: email.subject,
            emailDate: email.date,
            detectionMethod: parseResult.matchedPattern || 'PATTERN_MATCH'
          };

          // 重複チェック
          const existing = existingSubscriptions.find(sub =>
            sub.serviceName.toLowerCase() === detected.serviceName.toLowerCase() &&
            Math.abs(sub.amount - detected.amount) < 10
          );

          if (existing) {
            detected.status = 'EXISTING';
            detected.id = existing.id;
          } else if (autoSave) {
            try {
              const saved = await saveDetectedSubscription(user.id, detected);
              detected.id = saved.id;
              detected.status = 'SAVED';
            } catch (saveError) {
              const errorMessage = saveError instanceof Error ? saveError.message : String(saveError)
              errors.push(`Failed to save ${detected.serviceName}: ${errorMessage}`);
            }
          }

          // 次回請求日の推測
          detected.nextBillingDate = calculateNextBillingDate(
            detected.emailDate,
            detected.billingCycle
          );

          detectedSubscriptions.push(detected);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        errors.push(`Error processing email ${email.id}: ${errorMessage}`);
      }
    }

    // 分析結果の計算
    const analysis = calculateSubscriptionAnalysis(detectedSubscriptions);

    return NextResponse.json({
      success: true,
      data: {
        totalEmails: limitedEmails.length,
        detectedSubscriptions,
        analysis,
        errors,
        confidenceThreshold,
        autoSave
      }
    });

  } catch (error) {
    console.error('Detect subscriptions error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
}

/**
 * 検出されたサブスクリプションを保存
 */
async function saveDetectedSubscription(
  userId: string,
  detected: DetectedSubscription
) {
  // デフォルトクレジットカード取得
  const defaultCard = await prisma.creditCard.findFirst({
    where: {
      userId,
      isActive: true
    }
  });

  return await prisma.subscription.create({
    data: {
      userId,
      creditCardId: defaultCard?.id,
      serviceName: detected.serviceName,
      amount: detected.amount,
      currency: detected.currency,
      billingCycle: detected.billingCycle,
      nextBillingDate: detected.nextBillingDate,
      detectionMethod: 'AUTO',
      confidenceScore: detected.confidence,
      status: 'ACTIVE'
    }
  });
}

/**
 * 次回請求日の計算
 */
function calculateNextBillingDate(lastBillingDate: Date, cycle: string): Date {
  const next = new Date(lastBillingDate);

  switch (cycle) {
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}

/**
 * サブスクリプション分析の計算
 */
function calculateSubscriptionAnalysis(subscriptions: DetectedSubscription[]): SubscriptionAnalysis {
  const highConfidenceDetections = subscriptions.filter(s => s.confidence >= 0.9).length;
  const newSubscriptions = subscriptions.filter(s => s.status === 'DETECTED' || s.status === 'SAVED').length;
  const existingSubscriptions = subscriptions.filter(s => s.status === 'EXISTING').length;

  // 月額・年額コストの計算
  let estimatedMonthlyCost = 0;
  let estimatedYearlyCost = 0;

  const serviceBreakdown: Record<string, number> = {};

  for (const sub of subscriptions) {
    // 重複除去のため最新の検出のみを考慮
    if (!serviceBreakdown[sub.serviceName] || serviceBreakdown[sub.serviceName] < sub.confidence) {
      const monthlyAmount = convertToMonthlyAmount(sub.amount, sub.currency, sub.billingCycle);

      if (serviceBreakdown[sub.serviceName]) {
        estimatedMonthlyCost -= serviceBreakdown[sub.serviceName];
      }

      serviceBreakdown[sub.serviceName] = monthlyAmount;
      estimatedMonthlyCost += monthlyAmount;
    }
  }

  estimatedYearlyCost = estimatedMonthlyCost * 12;

  return {
    totalDetected: subscriptions.length,
    highConfidenceDetections,
    newSubscriptions,
    existingSubscriptions,
    estimatedMonthlyCost: Math.round(estimatedMonthlyCost),
    estimatedYearlyCost: Math.round(estimatedYearlyCost),
    serviceBreakdown
  };
}

/**
 * 金額を月額換算に変換
 */
function convertToMonthlyAmount(amount: number, currency: string, billingCycle: string): number {
  let monthlyAmount = amount;

  // 通貨変換（簡易版、実際はAPI使用推奨）
  if (currency === 'USD') {
    monthlyAmount = amount / 100 * 150; // $1 = ¥150 として計算
  }

  // 請求サイクル変換
  switch (billingCycle) {
    case 'YEARLY':
      monthlyAmount = monthlyAmount / 12;
      break;
    case 'WEEKLY':
      monthlyAmount = monthlyAmount * 4.33; // 1ヶ月 ≈ 4.33週
      break;
    case 'MONTHLY':
    default:
      // そのまま
      break;
  }

  return monthlyAmount;
}

/**
 * サブスクリプション分析取得API（GET）
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 既存のサブスクリプション取得
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE'
      },
      orderBy: {
        amount: 'desc'
      }
    });

    // 分析計算
    let totalMonthlyCost = 0;
    const serviceBreakdown: Record<string, number> = {};

    for (const sub of subscriptions) {
      const monthlyAmount = convertToMonthlyAmount(sub.amount, sub.currency, sub.billingCycle);
      totalMonthlyCost += monthlyAmount;
      serviceBreakdown[sub.serviceName] = monthlyAmount;
    }

    return NextResponse.json({
      success: true,
      data: {
        subscriptions,
        analysis: {
          totalSubscriptions: subscriptions.length,
          totalMonthlyCost: Math.round(totalMonthlyCost),
          totalYearlyCost: Math.round(totalMonthlyCost * 12),
          serviceBreakdown,
          averageCost: subscriptions.length > 0 ? Math.round(totalMonthlyCost / subscriptions.length) : 0
        }
      }
    });

  } catch (error) {
    console.error('Get subscriptions analysis error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}