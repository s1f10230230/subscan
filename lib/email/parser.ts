/**
 * Advanced Email Parsing Engine for Credit Card and Subscription Detection
 */

import {
  SUBSCRIPTION_PATTERNS,
  CREDIT_CARD_PATTERNS,
  GENERIC_AMOUNT_PATTERNS,
  GENERIC_MERCHANT_PATTERNS,
  SubscriptionPattern,
  CreditCardPattern,
  detectCurrency,
  normalizeAmount
} from './patterns';

export interface EmailMessage {
  id: string;
  subject: string;
  sender: string;
  receivedDate: Date;
  body: string;
  snippet?: string;
}

export interface ParseResult {
  success: boolean;
  confidence: number; // 0.0 - 1.0
  type: 'SUBSCRIPTION' | 'TRANSACTION' | 'UNKNOWN';
  data?: {
    amount: number;
    currency: string;
    merchantName: string;
    serviceName?: string;
    billingCycle?: string;
    issuer?: string;
  };
  errors: string[];
  matchedPattern?: string;
  processingTime?: number;
}

export interface ExtractionResult {
  success: boolean;
  amount?: number;
  currency?: string;
  merchantName?: string;
}

export class EmailParser {
  private debugMode: boolean;

  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  /**
   * メイン解析エントリーポイント
   */
  async parseEmail(email: EmailMessage): Promise<ParseResult> {
    const startTime = Date.now();

    try {
      this.log(`Parsing email: ${email.id} - ${email.subject}`);

      // 1. サブスクリプションパターンチェック（高精度）
      const subscriptionResult = await this.checkSubscriptionPatterns(email);
      if (subscriptionResult.success && (subscriptionResult.confidence || 0) >= 0.7) {
        return {
          ...subscriptionResult,
          processingTime: Date.now() - startTime
        };
      }

      // 2. クレジットカード利用通知パターンチェック
      const cardResult = await this.checkCreditCardPatterns(email);
      if (cardResult.success && cardResult.confidence >= 0.7) {
        return {
          ...cardResult,
          processingTime: Date.now() - startTime
        };
      }

      // 3. 汎用パターン（フォールバック）
      const genericResult = await this.genericParsing(email);

      return {
        success: genericResult.success,
        confidence: Math.max(
          subscriptionResult.confidence || 0,
          cardResult.confidence || 0,
          genericResult.confidence || 0
        ),
        type: genericResult.type || 'UNKNOWN',
        data: genericResult.data,
        errors: [
          ...(subscriptionResult.errors || []),
          ...(cardResult.errors || []),
          ...(genericResult.errors || [])
        ],
        matchedPattern: genericResult.matchedPattern || 'NONE',
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      this.log(`Parse error: ${error.message}`);
      return {
        success: false,
        confidence: 0,
        type: 'UNKNOWN',
        errors: [`Parse error: ${error.message}`],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * サブスクリプションパターンとの照合
   */
  private async checkSubscriptionPatterns(email: EmailMessage): Promise<Partial<ParseResult>> {
    const errors: string[] = [];

    for (const pattern of SUBSCRIPTION_PATTERNS) {
      try {
        // 送信者チェック
        const senderMatch = pattern.senderPatterns.some(p => p.test(email.sender));
        if (!senderMatch) {
          this.log(`${pattern.serviceName}: Sender not matched`);
          continue;
        }

        // 件名チェック
        const subjectMatch = pattern.subjectPatterns.some(p => p.test(email.subject));
        if (!subjectMatch) {
          this.log(`${pattern.serviceName}: Subject not matched`);
          continue;
        }

        this.log(`${pattern.serviceName}: Pattern matched, extracting data...`);

        // 金額抽出
        const amountResult = await this.extractAmountFromPattern(email, pattern);
        if (!amountResult.success) {
          errors.push(`${pattern.serviceName}: 金額抽出失敗`);
          continue;
        }

        // 店舗名抽出
        const merchantResult = await this.extractMerchantFromPattern(email, pattern);

        this.log(`${pattern.serviceName}: Successfully extracted data`);

        return {
          success: true,
          confidence: pattern.confidence,
          type: 'SUBSCRIPTION',
          data: {
            amount: amountResult.amount!,
            currency: amountResult.currency!,
            merchantName: merchantResult.merchantName || pattern.serviceName,
            serviceName: pattern.serviceName,
            billingCycle: pattern.billingCycle
          },
          errors: [],
          matchedPattern: pattern.serviceName
        };

      } catch (error) {
        errors.push(`${pattern.serviceName}: ${error.message}`);
      }
    }

    return {
      success: false,
      confidence: 0,
      type: 'UNKNOWN',
      errors
    };
  }

  /**
   * クレジットカードパターンとの照合
   */
  private async checkCreditCardPatterns(email: EmailMessage): Promise<Partial<ParseResult>> {
    const errors: string[] = [];

    for (const pattern of CREDIT_CARD_PATTERNS) {
      try {
        // 送信者チェック
        const senderMatch = pattern.senderPatterns.some(p => p.test(email.sender));
        if (!senderMatch) continue;

        // 件名チェック
        const subjectMatch = pattern.subjectPatterns.some(p => p.test(email.subject));
        if (!subjectMatch) continue;

        this.log(`${pattern.issuer}: Pattern matched, extracting data...`);

        // 金額抽出
        const amountResult = await this.extractAmountFromCardPattern(email, pattern);
        if (!amountResult.success) {
          errors.push(`${pattern.issuer}: 金額抽出失敗`);
          continue;
        }

        // 店舗名抽出
        const merchantResult = await this.extractMerchantFromCardPattern(email, pattern);

        return {
          success: true,
          confidence: pattern.confidence,
          type: 'TRANSACTION',
          data: {
            amount: amountResult.amount!,
            currency: amountResult.currency!,
            merchantName: merchantResult.merchantName || '不明',
            issuer: pattern.issuer
          },
          errors: [],
          matchedPattern: pattern.issuer
        };

      } catch (error) {
        errors.push(`${pattern.issuer}: ${error.message}`);
      }
    }

    return {
      success: false,
      confidence: 0,
      type: 'UNKNOWN',
      errors
    };
  }

  /**
   * 汎用的なパターンマッチング（フォールバック）
   */
  private async genericParsing(email: EmailMessage): Promise<Partial<ParseResult>> {
    const content = `${email.subject} ${email.body} ${email.snippet || ''}`;

    try {
      // 金額抽出（複数パターン試行）
      const amountResult = await this.extractGenericAmount(content);
      if (!amountResult.success) {
        return {
          success: false,
          confidence: 0,
          type: 'UNKNOWN',
          errors: ['金額が見つかりませんでした']
        };
      }

      // 店舗名抽出
      const merchantResult = await this.extractGenericMerchant(content, email.sender);

      return {
        success: true,
        confidence: 0.3, // 低信頼度
        type: 'TRANSACTION',
        data: {
          amount: amountResult.amount!,
          currency: amountResult.currency!,
          merchantName: merchantResult.merchantName || '不明'
        },
        errors: [],
        matchedPattern: 'GENERIC'
      };

    } catch (error) {
      return {
        success: false,
        confidence: 0,
        type: 'UNKNOWN',
        errors: [`Generic parsing failed: ${error.message}`]
      };
    }
  }

  /**
   * パターンから金額抽出（サブスクリプション用）
   */
  private async extractAmountFromPattern(
    email: EmailMessage,
    pattern: SubscriptionPattern
  ): Promise<ExtractionResult> {
    const content = `${email.subject} ${email.body}`;

    for (const amountPattern of pattern.amountPatterns) {
      const match = content.match(amountPattern.regex);
      if (match) {
        try {
          const amountStr = match[amountPattern.amountGroup];
          const currency = detectCurrency(match[0]);
          const amount = normalizeAmount(amountStr, currency);

          if (!isNaN(amount) && amount > 0) {
            return { success: true, amount, currency };
          }
        } catch (error) {
          this.log(`Amount extraction error: ${error.message}`);
        }
      }
    }

    return { success: false };
  }

  /**
   * パターンから金額抽出（クレジットカード用）
   */
  private async extractAmountFromCardPattern(
    email: EmailMessage,
    pattern: CreditCardPattern
  ): Promise<ExtractionResult> {
    const content = `${email.subject} ${email.body}`;

    for (const amountPattern of pattern.amountPatterns) {
      const match = content.match(amountPattern.regex);
      if (match) {
        try {
          const amountStr = match[amountPattern.amountGroup];
          const currency = detectCurrency(match[0]);
          const amount = normalizeAmount(amountStr, currency);

          if (!isNaN(amount) && amount > 0) {
            return { success: true, amount, currency };
          }
        } catch (error) {
          this.log(`Card amount extraction error: ${error.message}`);
        }
      }
    }

    return { success: false };
  }

  /**
   * パターンから店舗名抽出（サブスクリプション用）
   */
  private async extractMerchantFromPattern(
    email: EmailMessage,
    pattern: SubscriptionPattern
  ): Promise<ExtractionResult> {
    const content = `${email.subject} ${email.body}`;

    for (const merchantPattern of pattern.merchantPatterns) {
      const match = content.match(merchantPattern);
      if (match) {
        const merchantName = match[0].trim();
        if (merchantName && merchantName.length > 0) {
          return { success: true, merchantName };
        }
      }
    }

    return { success: false };
  }

  /**
   * パターンから店舗名抽出（クレジットカード用）
   */
  private async extractMerchantFromCardPattern(
    email: EmailMessage,
    pattern: CreditCardPattern
  ): Promise<ExtractionResult> {
    const content = `${email.subject} ${email.body}`;

    for (const merchantPattern of pattern.merchantPatterns) {
      const match = content.match(merchantPattern);
      if (match) {
        const merchantName = (match[1] || match[0]).trim();
        if (merchantName && merchantName.length > 0) {
          return { success: true, merchantName: merchantName.substring(0, 50) };
        }
      }
    }

    return { success: false };
  }

  /**
   * 汎用的な金額抽出
   */
  private async extractGenericAmount(content: string): Promise<ExtractionResult> {
    for (const pattern of GENERIC_AMOUNT_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern));
      for (const match of matches) {
        try {
          const amountStr = match[1];
          const currency = detectCurrency(match[0]);
          const amount = normalizeAmount(amountStr, currency);

          if (!isNaN(amount) && amount > 0) {
            return { success: true, amount, currency };
          }
        } catch (error) {
          continue;
        }
      }
    }

    return { success: false };
  }

  /**
   * 汎用的な店舗名抽出
   */
  private async extractGenericMerchant(content: string, sender: string): Promise<ExtractionResult> {
    // パターンマッチングによる抽出
    for (const pattern of GENERIC_MERCHANT_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        const merchantName = (match[1] || match[0]).trim();
        if (merchantName && merchantName.length > 2) {
          return { success: true, merchantName: merchantName.substring(0, 50) };
        }
      }
    }

    // 送信者のドメインから推測
    if (sender) {
      const emailMatch = sender.match(/@([^.]+)/);
      if (emailMatch) {
        const domain = emailMatch[1].replace(/[-_]/g, ' ');
        if (domain && domain.length > 2) {
          return {
            success: true,
            merchantName: domain.charAt(0).toUpperCase() + domain.slice(1).substring(0, 49)
          };
        }
      }
    }

    return { success: false };
  }

  /**
   * デバッグログ
   */
  private log(message: string): void {
    if (this.debugMode) {
      console.log(`[EmailParser] ${message}`);
    }
  }
}

/**
 * バッチ処理用のヘルパー関数
 */
export async function parseEmailBatch(
  emails: EmailMessage[],
  options: { debugMode?: boolean; maxConcurrency?: number } = {}
): Promise<ParseResult[]> {
  const { debugMode = false, maxConcurrency = 5 } = options;
  const parser = new EmailParser(debugMode);

  // 並列処理制限
  const results: ParseResult[] = [];

  for (let i = 0; i < emails.length; i += maxConcurrency) {
    const batch = emails.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(email => parser.parseEmail(email));
    const batchResults = await Promise.allSettled(batchPromises);

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          confidence: 0,
          type: 'UNKNOWN',
          errors: [`Batch processing error: ${result.reason?.message || 'Unknown error'}`]
        });
      }
    }
  }

  return results;
}

/**
 * 精度測定用の関数
 */
export function calculateAccuracy(result: ParseResult, expected: any): number {
  if (!result.success || !expected) return 0;

  let score = 0;
  let total = 0;

  // 金額の精度
  if (expected.amount !== undefined) {
    total++;
    if (result.data?.amount === expected.amount) {
      score++;
    } else if (result.data?.amount && Math.abs(result.data.amount - expected.amount) / expected.amount < 0.05) {
      score += 0.8; // 5%以内の誤差は部分点
    }
  }

  // 通貨の精度
  if (expected.currency) {
    total++;
    if (result.data?.currency === expected.currency) {
      score++;
    }
  }

  // 店舗名の精度
  if (expected.merchantName) {
    total++;
    if (result.data?.merchantName?.toLowerCase().includes(expected.merchantName.toLowerCase())) {
      score++;
    }
  }

  return total > 0 ? score / total : 0;
}