import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Plus, TrendingDown, AlertTriangle, CheckCircle, Edit3 } from "lucide-react"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// モックデータ
const mockSubscriptions = {
  summary: {
    monthlyTotal: 4100,
    annualTotal: 49200,
    activeCount: 4,
    potentialSavings: 18600,
    lastUpdated: '2時間前'
  },
  suspicious: [
    {
      id: 1,
      name: 'Spotify Premium',
      cost: 980,
      billing: 'monthly',
      lastUsed: '30日前',
      status: 'HIGH_RISK',
      annualSavings: 11760,
      icon: '🎵',
      nextBilling: '2024-04-15',
      note: 'パターン学習中...'
    }
  ],
  active: [
    {
      id: 2,
      name: 'Netflix Premium',
      cost: 1490,
      billing: 'monthly',
      lastUsed: '昨日',
      status: 'ACTIVE',
      icon: '📺',
      nextBilling: '2024-04-15',
      note: '家族で使用中',
      frequency: '高頻度利用'
    },
    {
      id: 3,
      name: 'Amazon Prime',
      cost: 500,
      billing: 'monthly',
      lastUsed: '3日前',
      status: 'ACTIVE',
      icon: '📦',
      nextBilling: '2024-04-20',
      note: '配送・動画・音楽すべて利用',
      frequency: '中頻度利用'
    },
    {
      id: 4,
      name: 'iCloud 200GB',
      cost: 400,
      billing: 'monthly',
      lastUsed: '1週間前',
      status: 'ACTIVE',
      icon: '💾',
      nextBilling: '2024-04-25',
      note: '容量使用率: 52%',
      frequency: '容量使用率: 52%',
      suggestion: '100GBプランに変更で年¥1,200節約'
    }
  ]
}

export default async function SubscriptionsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/signin')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HIGH_RISK': return 'bg-red-50 border-red-200'
      case 'ACTIVE': return 'bg-white border-gray-200'
      default: return 'bg-gray-50 border-gray-200'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HIGH_RISK': return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">HIGH</span>
      case 'ACTIVE': return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">AUTO</span>
      default: return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">MANUAL</span>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-800 mr-4">
              <ArrowLeft className="w-4 h-4 mr-1" />
              ダッシュボード
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">サブスクリプション管理</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* サブスク概要 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">💰 サブスク概要</h2>
            <div className="flex items-center text-sm text-gray-500">
              <RefreshCw className="w-4 h-4 mr-1" />
              最終更新: {mockSubscriptions.summary.lastUpdated}
            </div>
          </div>

          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    ¥{mockSubscriptions.summary.monthlyTotal.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">月額</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    ¥{mockSubscriptions.summary.annualTotal.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">年額</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {mockSubscriptions.summary.activeCount}個
                  </div>
                  <div className="text-sm text-gray-600">アクティブ</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    ¥{mockSubscriptions.summary.potentialSavings.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">節約可能</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex space-x-4">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              🔍 再スキャン
            </Button>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              ➕ 手動追加
            </Button>
            <Button variant="outline">
              <TrendingDown className="w-4 h-4 mr-2" />
              📊 節約分析
            </Button>
          </div>
        </div>

        {/* 要注意サブスク */}
        {mockSubscriptions.suspicious.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-orange-600 mb-4 flex items-center">
              🔥 要注意（解約推奨）
            </h2>
            <div className="space-y-4">
              {mockSubscriptions.suspicious.map((sub) => (
                <Card key={sub.id} className={getStatusColor(sub.status)}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">{sub.icon}</span>
                        <div>
                          <h3 className="text-lg font-semibold">{sub.name}</h3>
                          <p className="text-sm text-gray-600">
                            最終利用: {sub.lastUsed} • {sub.note}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg font-bold">¥{sub.cost}/月</span>
                          {getStatusBadge(sub.status)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <p className="text-green-800 font-medium">
                        💡 年間¥{sub.annualSavings.toLocaleString()}の節約可能
                      </p>
                    </div>

                    <div className="flex space-x-3">
                      <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
                        解約を検討
                      </Button>
                      <Button size="sm" variant="ghost">
                        使用中にマーク
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* アクティブサブスク */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-green-600 mb-4 flex items-center">
            ⚡ アクティブ
          </h2>
          <div className="space-y-4">
            {mockSubscriptions.active.map((sub) => (
              <Card key={sub.id} className={getStatusColor(sub.status)}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{sub.icon}</span>
                      <div>
                        <h3 className="text-lg font-semibold">{sub.name}</h3>
                        <p className="text-sm text-gray-600">
                          次回請求: {formatDate(sub.nextBilling)} • {sub.frequency}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg font-bold">¥{sub.cost}/月</span>
                        {getStatusBadge(sub.status)}
                      </div>
                    </div>
                  </div>

                  {sub.note && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-blue-800 text-sm flex items-center">
                        <Edit3 className="w-4 h-4 mr-2" />
                        📝 メモ: {sub.note}
                        <Button size="sm" variant="ghost" className="ml-2 h-auto p-1">
                          [編集]
                        </Button>
                      </p>
                    </div>
                  )}

                  {sub.suggestion && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                      <p className="text-yellow-800 text-sm">
                        💡 {sub.suggestion}
                      </p>
                      <Button size="sm" variant="ghost" className="mt-2 h-auto p-1 text-yellow-700">
                        [プラン変更を検討]
                      </Button>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                      最終利用: {sub.lastUsed}
                    </div>
                    <Button size="sm" variant="ghost">
                      詳細を見る
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* アクションエリア */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              📈 さらに詳しい分析が必要ですか？
            </h3>
            <p className="text-gray-600 mb-4">
              スタンダードプランで利用パターン分析と自動最適化提案を利用できます
            </p>
            <div className="flex justify-center space-x-4">
              <Link href="/pricing">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  プランをアップグレード
                </Button>
              </Link>
              <Button variant="outline">
                詳細を見る
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}