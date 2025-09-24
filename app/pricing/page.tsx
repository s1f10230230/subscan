'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckIcon } from 'lucide-react'
import { PLANS } from '@/lib/stripe'

const pricingPlans = [
  {
    name: '無料版',
    price: 0,
    interval: 'month',
    description: '基本的な家計簿機能',
    features: [
      '手動家計簿入力',
      '手動サブスクリプション登録',
      '基本的なカテゴリ分類',
      '月次レポート（簡易版）',
    ],
    buttonText: '無料で始める',
    planType: null,
    popular: false,
  },
  {
    name: PLANS.STANDARD.name,
    price: PLANS.STANDARD.price,
    interval: PLANS.STANDARD.interval,
    description: '自動化で時短！',
    features: PLANS.STANDARD.features,
    buttonText: 'スタンダードを始める',
    planType: 'STANDARD' as const,
    popular: true,
  },
  {
    name: PLANS.PRO.name,
    price: PLANS.PRO.price,
    interval: PLANS.PRO.interval,
    description: '本格的な家計分析',
    features: PLANS.PRO.features,
    buttonText: 'プロを始める',
    planType: 'PRO' as const,
    popular: false,
  },
]

export default function PricingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const handleSubscribe = async (planType: 'STANDARD' | 'PRO') => {
    if (!session) {
      router.push('/signin')
      return
    }

    setLoading(planType)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planType }),
      })

      const data = await response.json()
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        throw new Error('チェックアウトURLの作成に失敗しました')
      }
    } catch (error) {
      console.error('Subscription failed:', error)
      alert('サブスクリプションの作成に失敗しました。再度お試しください。')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto py-16 px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            シンプルな料金プラン
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            あなたのニーズに合ったプランを選択してください。
            いつでもプランの変更やキャンセルが可能です。
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative ${
                plan.popular
                  ? 'border-blue-500 border-2 shadow-lg scale-105'
                  : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    人気プラン
                  </span>
                </div>
              )}

              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <CardDescription className="text-gray-600">
                  {plan.description}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">¥{plan.price.toLocaleString()}</span>
                  {plan.price > 0 && (
                    <span className="text-gray-600 ml-1">/月</span>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center">
                      <CheckIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className={`w-full ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-800 hover:bg-gray-900'
                  }`}
                  onClick={() => {
                    if (plan.planType) {
                      handleSubscribe(plan.planType)
                    } else {
                      router.push(session ? '/dashboard' : '/signin')
                    }
                  }}
                  disabled={loading === plan.planType}
                >
                  {loading === plan.planType ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      処理中...
                    </div>
                  ) : (
                    plan.buttonText
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">よくある質問</h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-2">
                プランはいつでも変更・キャンセルできますか？
              </h3>
              <p className="text-gray-600">
                はい、いつでもプランの変更やキャンセルが可能です。
                アカウント設定から簡単に変更できます。
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-2">
                支払い方法は何が利用できますか？
              </h3>
              <p className="text-gray-600">
                クレジットカード（Visa、Mastercard、JCB、American Express）
                による月額自動決済に対応しています。
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-2">
                データはどのくらい保存されますか？
              </h3>
              <p className="text-gray-600">
                無料版では手動入力データのみ永続保存、
                有料版では3ヶ月間、プロ版では1年間のメールデータを保存します。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}