/**
 * Email parsing patterns for subscription services and credit card transactions
 */

export interface AmountPattern {
  regex: RegExp;
  currencyGroup: number;
  amountGroup: number;
}

export interface TestCase {
  email: {
    subject: string;
    sender: string;
    body: string;
  };
  expected: {
    amount: number;
    currency: string;
    merchantName: string;
  };
}

export interface SubscriptionPattern {
  serviceName: string;
  senderPatterns: RegExp[];
  subjectPatterns: RegExp[];
  amountPatterns: AmountPattern[];
  merchantPatterns: RegExp[];
  billingCycle: 'MONTHLY' | 'YEARLY' | 'WEEKLY';
  confidence: number;
  testCases: TestCase[];
}

export interface CreditCardPattern {
  issuer: string;
  senderPatterns: RegExp[];
  subjectPatterns: RegExp[];
  amountPatterns: AmountPattern[];
  merchantPatterns: RegExp[];
  confidence: number;
  testCases: TestCase[];
}

export const SUBSCRIPTION_PATTERNS: SubscriptionPattern[] = [
  {
    serviceName: 'Netflix',
    senderPatterns: [
      /noreply@account\.netflix\.com/i,
      /info@account\.netflix\.com/i,
      /netflix\.com/i
    ],
    subjectPatterns: [
      /netflix.*お支払い.*お知らせ/i,
      /netflix.*payment.*confirmation/i,
      /netflix.*receipt/i,
      /netflix.*billing/i
    ],
    amountPatterns: [
      {
        regex: /¥([0-9,]+)/,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /JPY\s*([0-9,]+)/i,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /([0-9,]+)円/,
        currencyGroup: 0,
        amountGroup: 1
      }
    ],
    merchantPatterns: [/Netflix/i],
    billingCycle: 'MONTHLY',
    confidence: 0.95,
    testCases: [
      {
        email: {
          subject: 'Netflix - お支払いのお知らせ',
          sender: 'noreply@account.netflix.com',
          body: 'Netflix プレミアムプランの月額料金 ¥1,490 のお支払いが完了しました。'
        },
        expected: {
          amount: 1490,
          currency: 'JPY',
          merchantName: 'Netflix'
        }
      }
    ]
  },

  {
    serviceName: 'Spotify',
    senderPatterns: [
      /noreply@spotify\.com/i,
      /info@spotify\.com/i,
      /spotify\.com/i
    ],
    subjectPatterns: [
      /spotify.*premium/i,
      /spotify.*subscription/i,
      /spotify.*お支払い/i,
      /spotify.*payment/i
    ],
    amountPatterns: [
      {
        regex: /\$([0-9.]+)/,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /¥([0-9,]+)/,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /USD\s*([0-9.]+)/i,
        currencyGroup: 0,
        amountGroup: 1
      }
    ],
    merchantPatterns: [/Spotify/i],
    billingCycle: 'MONTHLY',
    confidence: 0.90,
    testCases: [
      {
        email: {
          subject: 'Your Spotify Premium subscription',
          sender: 'noreply@spotify.com',
          body: 'Thank you for your Spotify Premium subscription. Amount: $9.99'
        },
        expected: {
          amount: 9.99,
          currency: 'USD',
          merchantName: 'Spotify'
        }
      }
    ]
  },

  {
    serviceName: 'Amazon Prime',
    senderPatterns: [
      /auto-confirm@amazon\.co\.jp/i,
      /auto-confirm@amazon\.com/i,
      /digital-no-reply@amazon/i
    ],
    subjectPatterns: [
      /amazon.*prime.*更新/i,
      /amazon.*prime.*renewal/i,
      /prime.*membership/i,
      /プライム会員/i
    ],
    amountPatterns: [
      {
        regex: /¥([0-9,]+)/,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /([0-9,]+)円/,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /\$([0-9.]+)/,
        currencyGroup: 0,
        amountGroup: 1
      }
    ],
    merchantPatterns: [/Amazon/i, /アマゾン/i],
    billingCycle: 'YEARLY',
    confidence: 0.85,
    testCases: [
      {
        email: {
          subject: 'Amazon Prime 年会費の更新について',
          sender: 'auto-confirm@amazon.co.jp',
          body: 'Amazon Prime年会費 ¥4,900 の更新が完了しました。'
        },
        expected: {
          amount: 4900,
          currency: 'JPY',
          merchantName: 'Amazon'
        }
      }
    ]
  },

  {
    serviceName: 'Adobe Creative Cloud',
    senderPatterns: [
      /adobe\.com/i,
      /noreply@adobe\.com/i
    ],
    subjectPatterns: [
      /adobe.*subscription/i,
      /creative cloud.*payment/i,
      /adobe.*お支払い/i
    ],
    amountPatterns: [
      {
        regex: /¥([0-9,]+)/,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /\$([0-9.]+)/,
        currencyGroup: 0,
        amountGroup: 1
      }
    ],
    merchantPatterns: [/Adobe/i],
    billingCycle: 'MONTHLY',
    confidence: 0.85,
    testCases: []
  },

  {
    serviceName: 'Microsoft 365',
    senderPatterns: [
      /microsoft\.com/i,
      /microsoftstore@microsoft\.com/i
    ],
    subjectPatterns: [
      /microsoft.*365.*subscription/i,
      /office.*365.*payment/i,
      /microsoft.*お支払い/i
    ],
    amountPatterns: [
      {
        regex: /¥([0-9,]+)/,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /\$([0-9.]+)/,
        currencyGroup: 0,
        amountGroup: 1
      }
    ],
    merchantPatterns: [/Microsoft/i],
    billingCycle: 'MONTHLY',
    confidence: 0.85,
    testCases: []
  }
];

export const CREDIT_CARD_PATTERNS: CreditCardPattern[] = [
  {
    issuer: '楽天カード',
    senderPatterns: [
      /rakuten-card\.co\.jp/i,
      /rakuten\.co\.jp/i
    ],
    subjectPatterns: [
      /カード利用のお知らせ/i,
      /ご利用確認/i,
      /利用通知/i
    ],
    amountPatterns: [
      {
        regex: /利用金額[：:]\s*¥?([0-9,]+)/i,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /ご利用金額[：:]\s*¥?([0-9,]+)/i,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /([0-9,]+)円/,
        currencyGroup: 0,
        amountGroup: 1
      }
    ],
    merchantPatterns: [
      /ご利用店舗[：:]\s*(.+?)(?:\n|$)/i,
      /利用先[：:]\s*(.+?)(?:\n|$)/i,
      /加盟店名[：:]\s*(.+?)(?:\n|$)/i
    ],
    confidence: 0.90,
    testCases: [
      {
        email: {
          subject: 'カード利用のお知らせ',
          sender: 'info@rakuten-card.co.jp',
          body: 'ご利用金額：¥1,234\nご利用店舗：Amazon.co.jp'
        },
        expected: {
          amount: 1234,
          currency: 'JPY',
          merchantName: 'Amazon.co.jp'
        }
      }
    ]
  },

  {
    issuer: '三井住友カード',
    senderPatterns: [
      /vpass\.ne\.jp/i,
      /smbc-card\.com/i
    ],
    subjectPatterns: [
      /ご利用速報/i,
      /カード利用通知/i,
      /お支払い確定/i
    ],
    amountPatterns: [
      {
        regex: /利用金額[：:]\s*¥?([0-9,]+)/i,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /([0-9,]+)円/,
        currencyGroup: 0,
        amountGroup: 1
      }
    ],
    merchantPatterns: [
      /利用先[：:]\s*(.+?)(?:\n|$)/i,
      /ご利用店[：:]\s*(.+?)(?:\n|$)/i
    ],
    confidence: 0.88,
    testCases: []
  },

  {
    issuer: 'JCBカード',
    senderPatterns: [
      /jcb\.co\.jp/i,
      /jcb\.jp/i
    ],
    subjectPatterns: [
      /カードご利用のお知らせ/i,
      /JCB.*利用通知/i
    ],
    amountPatterns: [
      {
        regex: /利用金額[：:]\s*¥?([0-9,]+)/i,
        currencyGroup: 0,
        amountGroup: 1
      },
      {
        regex: /([0-9,]+)円/,
        currencyGroup: 0,
        amountGroup: 1
      }
    ],
    merchantPatterns: [
      /利用先[：:]\s*(.+?)(?:\n|$)/i,
      /加盟店[：:]\s*(.+?)(?:\n|$)/i
    ],
    confidence: 0.85,
    testCases: []
  }
];

// 汎用的な抽出パターン（フォールバック用）
export const GENERIC_AMOUNT_PATTERNS: RegExp[] = [
  /¥([0-9,]+)/g,
  /([0-9,]+)円/g,
  /\$([0-9.]+)/g,
  /USD\s*([0-9.]+)/ig,
  /JPY\s*([0-9,]+)/ig,
  /EUR\s*([0-9.]+)/ig,
  /€([0-9.]+)/g
];

export const GENERIC_MERCHANT_PATTERNS: RegExp[] = [
  /店舗[：:]\s*(.+?)(?:\n|$)/i,
  /利用先[：:]\s*(.+?)(?:\n|$)/i,
  /merchant[：:]\s*(.+?)(?:\n|$)/i,
  /from[：:]\s*(.+?)(?:\n|$)/i,
  /([A-Za-z0-9\s]+(?:店|ストア|Store|Shop))/i
];

/**
 * 通貨の検出
 */
export function detectCurrency(text: string): string {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('¥') || lowerText.includes('円') || lowerText.includes('jpy')) {
    return 'JPY';
  }
  if (lowerText.includes('$') || lowerText.includes('usd')) {
    return 'USD';
  }
  if (lowerText.includes('€') || lowerText.includes('eur')) {
    return 'EUR';
  }

  return 'JPY'; // デフォルト
}

/**
 * 金額の正規化（カンマ除去、小数点処理）
 */
export function normalizeAmount(amountStr: string, currency: string): number {
  const cleaned = amountStr.replace(/,/g, '');
  const amount = parseFloat(cleaned);

  if (isNaN(amount)) {
    throw new Error(`Invalid amount format: ${amountStr}`);
  }

  // 解析結果は通貨の「主要単位」で返す
  // 例) JPY: 1490, USD: 9.99, EUR: 12.5
  if (currency === 'JPY') {
    return Math.round(amount);
  }

  // 非JPYは小数第2位までに丸めて返す（表示/後段での換算を想定）
  return Math.round(amount * 100) / 100;
}
