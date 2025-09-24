import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-09-30.acacia',
  typescript: true,
})

export const PLANS = {
  STANDARD: {
    name: 'スタンダード',
    price: 980,
    interval: 'month' as const,
    features: [
      'メール自動連携',
      '複数クレジットカード管理',
      'サブスクリプション自動検出',
      '3ヶ月間のデータ保持'
    ]
  },
  PRO: {
    name: 'プロ',
    price: 1980,
    interval: 'month' as const,
    features: [
      'スタンダードの全機能',
      '1年間のデータ保持',
      '高度な分析機能',
      '優先サポート'
    ]
  }
} as const

export type PlanType = keyof typeof PLANS