import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('シードデータを開始...')

  // デフォルトカテゴリの作成
  const categories = [
    { name: '食費', icon: '🍽️', color: '#EF4444', isDefault: true },
    { name: '交通費', icon: '🚃', color: '#3B82F6', isDefault: true },
    { name: 'エンタメ', icon: '🎬', color: '#8B5CF6', isDefault: true },
    { name: 'サブスクリプション', icon: '💳', color: '#F59E0B', isDefault: true },
    { name: '生活費', icon: '🏠', color: '#10B981', isDefault: true },
    { name: '医療費', icon: '🏥', color: '#EC4899', isDefault: true },
    { name: 'その他', icon: '📦', color: '#6B7280', isDefault: true },
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        id: `default-${category.name.toLowerCase().replace(/\s+/g, '-')}`
      },
      update: {},
      create: {
        id: `default-${category.name.toLowerCase().replace(/\s+/g, '-')}`,
        ...category,
        userId: null,
        sortOrder: categories.indexOf(category),
      },
    })
  }

  console.log('デフォルトカテゴリを作成しました')

  // サブスクリプションパターンの作成
  const subscriptionPatterns = [
    {
      serviceName: 'Netflix',
      senderPattern: 'noreply@account\\.netflix\\.com',
      subjectPattern: 'お支払いのお知らせ|Payment confirmation',
      amountPattern: '¥?([0-9,]+)',
      currency: 'JPY',
      billingCycle: 'MONTHLY' as const,
      confidence: 0.95,
    },
    {
      serviceName: 'Spotify',
      senderPattern: 'noreply@spotify\\.com',
      subjectPattern: 'Premium|お支払い',
      amountPattern: '\\$([0-9.]+)|¥([0-9,]+)',
      currency: 'JPY',
      billingCycle: 'MONTHLY' as const,
      confidence: 0.90,
    },
    {
      serviceName: 'Amazon Prime',
      senderPattern: 'account-update@amazon\\.co\\.jp',
      subjectPattern: 'プライム会員|Prime membership',
      amountPattern: '¥([0-9,]+)',
      currency: 'JPY',
      billingCycle: 'MONTHLY' as const,
      confidence: 0.85,
    },
    {
      serviceName: 'Adobe Creative Cloud',
      senderPattern: 'message\\.adobe\\.com',
      subjectPattern: 'Creative Cloud|お支払い完了',
      amountPattern: '¥([0-9,]+)|\\$([0-9.]+)',
      currency: 'JPY',
      billingCycle: 'MONTHLY' as const,
      confidence: 0.88,
    },
    {
      serviceName: 'YouTube Premium',
      senderPattern: 'noreply@youtube\\.com',
      subjectPattern: 'YouTube Premium|Premium メンバーシップ',
      amountPattern: '¥([0-9,]+)',
      currency: 'JPY',
      billingCycle: 'MONTHLY' as const,
      confidence: 0.85,
    },
    {
      serviceName: 'iCloud',
      senderPattern: 'appleid@id\\.apple\\.com',
      subjectPattern: 'iCloud|お支払い方法',
      amountPattern: '¥([0-9,]+)',
      currency: 'JPY',
      billingCycle: 'MONTHLY' as const,
      confidence: 0.80,
    },
  ]

  for (const pattern of subscriptionPatterns) {
    await prisma.subscriptionPattern.upsert({
      where: {
        serviceName_senderPattern: {
          serviceName: pattern.serviceName,
          senderPattern: pattern.senderPattern,
        },
      },
      update: {},
      create: pattern,
    })
  }

  console.log('サブスクリプションパターンを作成しました')

  console.log('シードデータが完了しました! 🎉')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })