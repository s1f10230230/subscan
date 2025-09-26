import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus } from 'lucide-react'
import { canAddCreditCard, getPlanLimits, isPlanLimitsDisabled } from '@/lib/plan'

export const dynamic = 'force-dynamic'

// Mock list until API is wired
const mockCards = [
  { id: 'c1', name: '楽天カード', issuer: 'Rakuten', lastDigits: '1234', color: '#3B82F6' },
  { id: 'c2', name: 'メインカード', issuer: 'Visa', lastDigits: '5678', color: '#10B981' },
]

export default async function CardsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/signin')

  const plan = (session.user?.plan || 'FREE') as 'FREE' | 'STANDARD' | 'PRO'
  const planLimits = getPlanLimits(plan)
  const devNoLimits = isPlanLimitsDisabled()
  const cardCount = session.creditCardCount ?? mockCards.length
  const canAdd = devNoLimits ? true : canAddCreditCard(plan, cardCount)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-800 mr-4">
                <ArrowLeft className="w-4 h-4 mr-1" />
                ダッシュボード
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">カード管理</h1>
            </div>
            <div className="flex items-center space-x-2">
              {canAdd ? (
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  カードを追加
                </Button>
              ) : (
                <Link href="/pricing">
                  <Button size="sm" variant="secondary">
                    追加上限に達しました（アップグレード）
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{cardCount}枚</div>
                  <div className="text-sm text-gray-600">
                    登録カード
                    {plan === 'FREE' && !devNoLimits && (
                      <span className="ml-1 text-xs text-gray-500">/ 上限 {planLimits.creditCards}枚</span>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">プラン</div>
                  <div className="text-sm text-gray-600">{plan}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{canAdd ? '追加可能' : '上限到達'}</div>
                  <div className="text-sm text-gray-600">ステータス</div>
                </div>
              </div>
              {plan === 'FREE' && !devNoLimits && !canAdd && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center text-sm bg-yellow-50 text-yellow-800 border border-yellow-200 rounded px-3 py-2">
                    無料プランではカードは{planLimits.creditCards}枚までです。
                    <Link href="/pricing" className="ml-2 underline">無制限で管理する</Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>登録済みカード</CardTitle>
            <CardDescription>カード別の利用状況は近日対応予定</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(session.creditCardCount ? [] : mockCards).map((c) => (
                <div key={c.id} className="p-4 border rounded-lg bg-white flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-6 rounded mr-3" style={{ backgroundColor: c.color }} />
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.issuer} • **** {c.lastDigits}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">詳細</Button>
                </div>
              ))}
              {session.creditCardCount && session.creditCardCount > 0 && (
                <div className="text-sm text-gray-500">
                  実データ表示はAPI接続後に反映されます（現在はセッションの枚数のみ参照）。
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
