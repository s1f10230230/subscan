import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { ArrowLeft, Filter, Search, Download, Calendar, Plus } from "lucide-react"
import { canAddMonthlyTransaction, getPlanLimits, isPlanLimitsDisabled } from '@/lib/plan'
import { prisma } from '@/lib/prisma'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  return { start, end: next }
}

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/signin')
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      weekday: 'short'
    })
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SUBSCRIPTION': return 'text-blue-600 bg-blue-50'
      case 'PURCHASE': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getTypeName = (type: string) => {
    switch (type) {
      case 'SUBSCRIPTION': return 'サブスク'
      case 'PURCHASE': return '支払い'
      default: return '取引'
    }
  }

  const { start, end } = monthRange()
  const rows = await prisma.transaction.findMany({
    where: { userId: session.user!.id!, transactionDate: { gte: start, lt: end } },
    orderBy: { transactionDate: 'desc' },
    select: {
      id: true,
      amount: true,
      transactionDate: true,
      merchantName: true,
      creditCard: { select: { name: true } },
      category: { select: { name: true } },
    },
  })

  const mapped = rows.map(r => ({
    id: r.id,
    date: r.transactionDate.toISOString(),
    merchant: r.merchantName,
    amount: r.amount,
    category: '💳',
    categoryName: r.category?.name || 'その他',
    card: r.creditCard?.name || '-',
    type: r.category?.name === 'サブスクリプション' ? 'SUBSCRIPTION' : 'PURCHASE',
    status: 'CONFIRMED',
  }))

  const totalAmount = mapped.reduce((sum, t) => sum + t.amount, 0)
  const plan = (session.user?.plan || 'FREE') as 'FREE' | 'STANDARD' | 'PRO'
  const planLimits = getPlanLimits(plan)
  const devNoLimits = isPlanLimitsDisabled()
  const canAdd = devNoLimits ? true : canAddMonthlyTransaction(plan, mapped.length)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-800 mr-4">
                <ArrowLeft className="w-4 h-4 mr-1" />
                ダッシュボード
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">取引履歴</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                {plan === 'FREE' ? '当月をエクスポート' : 'エクスポート'}
              </Button>
              {canAdd ? (
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  手動追加
                </Button>
              ) : (
                <Link href="/pricing">
                  <Button size="sm" variant="secondary">
                    上限に達しました（アップグレード）
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 概要カード */}
        <div className="mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {mapped.length}件
                  </div>
                  <div className="text-sm text-gray-600">
                    今月の取引
                    {plan === 'FREE' && !devNoLimits && (
                      <span className="ml-1 text-xs text-gray-500">
                        / 上限 {planLimits.monthlyTransactions}件
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    ¥{totalAmount.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">合計支出</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    ¥{mapped.length ? Math.round(totalAmount / mapped.length).toLocaleString() : 0}
                  </div>
                  <div className="text-sm text-gray-600">平均単価</div>
                </div>
              </div>
              {plan === 'FREE' && !devNoLimits && !canAdd && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center text-sm bg-yellow-50 text-yellow-800 border border-yellow-200 rounded px-3 py-2">
                    今月の無料上限（{planLimits.monthlyTransactions}件）に達しました。
                    <Link href="/pricing" className="ml-2 underline">
                      無制限で続ける
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* フィルタエリア */}
        <div className="mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="店舗名で検索..."
                    className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <select className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500">
                    <option>今月</option>
                    <option disabled={plan === 'FREE' && !devNoLimits}>先月</option>
                    <option disabled={plan === 'FREE' && !devNoLimits}>過去3ヶ月</option>
                    <option disabled={plan === 'FREE' && !devNoLimits}>カスタム</option>
                  </select>
                  {plan === 'FREE' && !devNoLimits ? (
                    <Link href="/pricing" className="text-xs text-blue-600 underline ml-1">
                      カスタム期間は有料で解放
                    </Link>
                  ) : (
                    <Button variant="outline" size="sm">期間を選択</Button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <select className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500">
                    <option>すべてのカテゴリ</option>
                    <option>食事・外食</option>
                    <option>ショッピング</option>
                    <option>交通費</option>
                    <option>エンタメ</option>
                    <option>サブスク</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <select className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500">
                    <option>すべての種類</option>
                    <option>支払い</option>
                    <option>サブスク</option>
                  </select>
                </div>

                <Button variant="outline" size="sm">リセット</Button>
              </div>
              {plan === 'FREE' && !devNoLimits && (
                <div className="mt-2 text-xs text-gray-500">
                  CSVエクスポートは当月のみ利用できます（有料で期間指定可）
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 取引一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              📱 取引一覧
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({mapped.length}件)
              </span>
            </CardTitle>
            <CardDescription>
              今月の取引履歴
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              {mapped.map((transaction, index) => (
                <div key={transaction.id} className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${index === 0 ? 'border-t-0' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col items-center">
                        <span className="text-2xl">{transaction.category}</span>
                        <span className={`text-xs px-2 py-1 rounded ${getTypeColor(transaction.type)}`}>
                          {getTypeName(transaction.type)}
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900">{transaction.merchant}</h3>
                          {transaction.type === 'SUBSCRIPTION' && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              定期
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>{formatDate(transaction.date)}</span>
                          <span>•</span>
                          <span>{transaction.card}</span>
                          <span>•</span>
                          <span>{transaction.categoryName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        ¥{transaction.amount.toLocaleString()}
                      </div>
                      <div className="text-sm text-green-600">
                        {transaction.status === 'CONFIRMED' ? '確認済み' : '保留中'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  10件中 1-10件を表示
                </span>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" disabled>
                    前へ
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    次へ
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* アクションエリア */}
        <div className="mt-8">
          <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                📊 より詳しい分析が必要ですか？
              </h3>
              <p className="text-gray-600 mb-4">
                Gmail連携で自動取引検出と高度な支出分析を利用できます
              </p>
              <div className="flex justify-center space-x-4">
                <Link href="/onboarding">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Gmail連携を設定
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button variant="outline">
                    プランを見る
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
