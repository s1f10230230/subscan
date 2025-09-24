import { z } from 'zod'

// User schemas
export const userProfileSchema = z.object({
  name: z.string().min(1, '名前は必須です').max(100),
  monthStartDay: z.number().min(1).max(28),
  timezone: z.string().optional(),
})

// Credit Card schemas
export const creditCardSchema = z.object({
  name: z.string().min(1, 'カード名は必須です').max(50),
  brand: z.enum(['VISA', 'MasterCard', 'JCB', 'AMEX'], {
    errorMap: () => ({ message: '有効なカードブランドを選択してください' })
  }),
  issuer: z.string().min(1, '発行会社は必須です').max(50),
  lastDigits: z.string().length(4, '下4桁を入力してください').regex(/^\d{4}$/, '数字のみ入力してください'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '有効な色コードを入力してください'),
})

// Transaction schemas
export const transactionSchema = z.object({
  creditCardId: z.string().cuid('無効なカードIDです'),
  categoryId: z.string().cuid('無効なカテゴリIDです'),
  amount: z.number().positive('金額は0より大きい値を入力してください'),
  currency: z.string().default('JPY'),
  merchantName: z.string().min(1, '店舗名は必須です').max(100),
  description: z.string().max(500).optional(),
  transactionDate: z.string().transform(str => new Date(str)),
})

// Subscription schemas
export const subscriptionSchema = z.object({
  serviceName: z.string().min(1, 'サービス名は必須です').max(100),
  planName: z.string().max(100).optional(),
  amount: z.number().positive('金額は0より大きい値を入力してください'),
  currency: z.string().default('JPY'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY', 'WEEKLY']),
  nextBillingDate: z.string().transform(str => new Date(str)).optional(),
  creditCardId: z.string().cuid().optional(),
  usageMemo: z.string().max(500).optional(),
})

// Category schemas
export const categorySchema = z.object({
  name: z.string().min(1, 'カテゴリ名は必須です').max(50),
  icon: z.string().max(10),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '有効な色コードを入力してください'),
})

// Email account schemas
export const emailAccountSchema = z.object({
  provider: z.enum(['gmail', 'yahoo']),
  accessToken: z.string().min(1, 'アクセストークンは必須です'),
  refreshToken: z.string().optional(),
})

// Search and filter schemas
export const searchParamsSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val), 100) : 20),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  creditCardId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

// API response schemas
export const apiSuccessSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  meta: z.object({
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
      hasNext: z.boolean(),
      hasPrev: z.boolean(),
    }).optional(),
    timestamp: z.string(),
    requestId: z.string(),
  }).optional(),
})

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  meta: z.object({
    timestamp: z.string(),
    requestId: z.string(),
  }),
})

// Email parsing schemas
export const emailParseResultSchema = z.object({
  success: z.boolean(),
  confidence: z.number().min(0).max(1),
  type: z.enum(['SUBSCRIPTION', 'TRANSACTION', 'UNKNOWN']),
  data: z.object({
    amount: z.number(),
    currency: z.string(),
    merchantName: z.string(),
    serviceName: z.string().optional(),
    billingCycle: z.string().optional(),
  }).optional(),
  errors: z.array(z.string()),
  matchedPattern: z.string().optional(),
})

export type UserProfileInput = z.infer<typeof userProfileSchema>
export type CreditCardInput = z.infer<typeof creditCardSchema>
export type TransactionInput = z.infer<typeof transactionSchema>
export type SubscriptionInput = z.infer<typeof subscriptionSchema>
export type CategoryInput = z.infer<typeof categorySchema>
export type EmailAccountInput = z.infer<typeof emailAccountSchema>
export type SearchParams = z.infer<typeof searchParamsSchema>
export type EmailParseResult = z.infer<typeof emailParseResultSchema>