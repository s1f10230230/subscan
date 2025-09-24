import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

// 環境変数を読み込み
dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

async function testDatabase() {
  try {
    console.log('🔍 データベース接続テスト開始...')

    // 接続テスト
    await prisma.$connect()
    console.log('✅ データベースに正常に接続しました')

    // テーブル存在確認
    const userCount = await prisma.user.count()
    console.log(`👥 ユーザー数: ${userCount}`)

    const categoryCount = await prisma.category.count()
    console.log(`📂 カテゴリ数: ${categoryCount}`)

    const patternCount = await prisma.subscriptionPattern.count()
    console.log(`🔍 サブスクパターン数: ${patternCount}`)

    console.log('✅ データベーステスト完了')

  } catch (error) {
    console.error('❌ データベースエラー:', error)

    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.log('\n💡 解決方法:')
        console.log('1. PostgreSQLサーバーが起動しているか確認してください')
        console.log('2. DATABASE_URLが正しく設定されているか確認してください')
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        console.log('\n💡 解決方法:')
        console.log('1. PostgreSQLでcardsyncデータベースを作成してください')
        console.log('2. npm run db:push でスキーマを適用してください')
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

testDatabase()