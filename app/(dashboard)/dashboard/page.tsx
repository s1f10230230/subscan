import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { TrendingUp, TrendingDown, CreditCard, AlertTriangle, Mail, RefreshCw, ChevronRight } from "lucide-react"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// モックデータ（後でAPIから取得）
const mockData = {
  monthlySpending: 127340,
  previousMonthSpending: 113420,
  transactionCount: 15,
  averageTransaction: 8489,
  subscriptions: 4,
  subscriptionsCost: 3100,
  annualSavings: 18600,
  recentTransactions: [
    { id: 1, date: '3/15', merchant: 'Amazon', amount: 2480, category: '🛒' },
    { id: 2, date: '3/14', merchant: 'Netflix', amount: 1490, category: '📺' },
    { id: 3, date: '3/14', merchant: 'セブン', amount: 384, category: '🏪' },
    { id: 4, date: '3/13', merchant: '楽天', amount: 8900, category: '🛍️' },
    { id: 5, date: '3/13', merchant: 'Uber Eats', amount: 1250, category: '🍕' },
  ],
  suspiciousSubscriptions: [
    { name: 'Spotify', cost: 980, lastUsed: '30日前', savings: 11760, status: 'HIGH' },
  ],
  categories: [
    { name: '食費', percentage: 40, amount: 50936 },
    { name: '交通費', percentage: 25, amount: 31835 },
    { name: 'サブスク', percentage: 20, amount: 25468 },
    { name: 'その他', percentage: 15, amount: 19101 },
  ]
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/signin')
  }

  const growthRate = ((mockData.monthlySpending - mockData.previousMonthSpending) / mockData.previousMonthSpending * 100).toFixed(1)
  const isPositiveGrowth = parseFloat(growthRate) > 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CardSync</h1>
              <p className="text-gray-600">ようこそ、{session.user?.name || 'ユーザー'}さん</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 border border-gray-200">
                プラン: {session.user?.plan || 'FREE'}
              </span>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                同期
              </Button>
              <Button variant="outline" size="sm">
                ⚙️ 設定
              </Button>
              <Link href="/pricing">
                <Button variant="outline" size="sm">
                  💳 プラン
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 概要カード */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📊 今月の概要</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  💰 月間支出
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">¥{mockData.monthlySpending.toLocaleString()}</div>
                <p className={`text-xs flex items-center ${isPositiveGrowth ? 'text-red-600' : 'text-green-600'}`}>
                  {isPositiveGrowth ?
                    <TrendingUp className="w-3 h-3 mr-1" /> :
                    <TrendingDown className="w-3 h-3 mr-1" />
                  }
                  {isPositiveGrowth ? '+' : ''}{growthRate}% ↗
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">🔄 利用回数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockData.transactionCount}回</div>
                <p className="text-xs text-muted-foreground">
                  平均 ¥{mockData.averageTransaction.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center">
                  📱 サブスク
                  {mockData.suspiciousSubscriptions.length > 0 && (
                    <AlertTriangle className="w-4 h-4 ml-2 text-orange-500" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockData.subscriptions}個</div>
                <p className="text-xs text-muted-foreground">
                  月額 ¥{mockData.subscriptionsCost.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">💸 節約可能額</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">¥{mockData.annualSavings.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  年間予想
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 支出推移 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                📈 支出推移
              </CardTitle>
              <CardDescription>
                過去3ヶ月の推移
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-end h-32">
                  <div className="flex flex-col justify-end items-center">
                    <div className="bg-blue-200 w-16 h-16 rounded-t"></div>
                    <span className="text-xs mt-1">Jan</span>
                    <span className="text-xs text-gray-500">¥89k</span>
                  </div>
                  <div className="flex flex-col justify-end items-center">
                    <div className="bg-blue-300 w-16 h-20 rounded-t"></div>
                    <span className="text-xs mt-1">Feb</span>
                    <span className="text-xs text-gray-500">¥112k</span>
                  </div>
                  <div className="flex flex-col justify-end items-center">
                    <div className="bg-blue-500 w-16 h-24 rounded-t"></div>
                    <span className="text-xs mt-1">Mar</span>
                    <span className="text-xs text-gray-500">¥127k</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* カテゴリ別 */}
          <Card>
            <CardHeader>
              <CardTitle>🍕 カテゴリ別</CardTitle>
              <CardDescription>
                今月の支出分類
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockData.categories.map((category, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-3 ${
                        ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-gray-400'][index]
                      }`}></div>
                      <span className="text-sm">{category.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium">{category.percentage}%</span>
                      <div className="text-xs text-gray-500">
                        ¥{category.amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 要注意サブスク */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-orange-600">
                ⚠️ 要注意サブスク
              </CardTitle>
              <CardDescription>
                解約を検討しませんか？
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mockData.suspiciousSubscriptions.length > 0 ? (
                <div className="space-y-4">
                  {mockData.suspiciousSubscriptions.map((sub, index) => (
                    <div key={index} className="border border-orange-200 bg-orange-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium">🎵 {sub.name}</h3>
                        <span className="text-sm font-medium">¥{sub.cost}/月</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{sub.lastUsed}未使用</p>
                      <p className="text-sm text-green-600 font-medium">
                        → 年¥{sub.savings.toLocaleString()}節約可能
                      </p>
                      <div className="flex space-x-2 mt-3">
                        <Button size="sm" variant="outline">解約を検討</Button>
                        <Button size="sm" variant="ghost">使用中にマーク</Button>
                      </div>
                    </div>
                  ))}
                  <Link href="/subscriptions">
                    <Button variant="outline" className="w-full">
                      すべてのサブスクを見る
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-gray-500">要注意なサブスクはありません</p>
              )}
            </CardContent>
          </Card>

          {/* 最新の取引 */}
          <Card>
            <CardHeader>
              <CardTitle>📱 最新の取引</CardTitle>
              <CardDescription>
                直近の支出履歴
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockData.recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-lg mr-3">{transaction.category}</span>
                      <div>
                        <div className="font-medium text-sm">{transaction.merchant}</div>
                        <div className="text-xs text-gray-500">{transaction.date}</div>
                      </div>
                    </div>
                    <span className="font-medium">¥{transaction.amount.toLocaleString()}</span>
                  </div>
                ))}
                <Link href="/transactions">
                  <Button variant="outline" className="w-full">
                    すべて見る
                    <ChevronRight className="w-4 h-4 ml-2" />
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
