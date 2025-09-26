'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import { X, ArrowLeft, Mail, Shield, Loader2, TrendingUp, CreditCard } from 'lucide-react'
import { signIn } from 'next-auth/react'

const STEPS = [
  { id: 'welcome', title: 'Welcome', progress: 20 },
  { id: 'email-connection', title: 'Email Connection', progress: 40 },
  { id: 'analysis-progress', title: 'Analysis Progress', progress: 60 },
  { id: 'results', title: 'Results', progress: 80 },
  { id: 'plan-selection', title: 'Plan Selection', progress: 100 },
]

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)

  const currentStepData = STEPS[currentStep]

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleGmailConnect = async () => {
    setIsAnalyzing(true)
    // Google OAuth後はダッシュボードへ遷移（セッション確立後の保護ルート）
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  const simulateAnalysis = () => {
    let progress = 0
    const interval = setInterval(() => {
      progress += Math.random() * 15
      setAnalysisProgress(Math.min(progress, 100))

      if (progress >= 100) {
        clearInterval(interval)
        setTimeout(() => {
          nextStep() // Results画面へ
        }, 1000)
      }
    }, 500)
  }

  const StepIndicator = () => (
    <div className="flex justify-center mb-8">
      {STEPS.map((_, index) => (
        <div key={index} className="flex items-center">
          <div
            className={`w-3 h-3 rounded-full ${
              index <= currentStep ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          />
          {index < STEPS.length - 1 && (
            <div className="w-8 h-0.5 bg-gray-300 mx-1" />
          )}
        </div>
      ))}
    </div>
  )

  const renderWelcomeStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="mb-8">
        <div className="text-6xl mb-4 animate-bounce">🎯</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          複数クレカの隠れた支出とサブスクを3分で発見
        </h1>
      </div>

      <div className="space-y-4 mb-8 text-left">
        <div className="flex items-center text-gray-700">
          <div className="text-green-600 mr-3">✅</div>
          <span>自動でクレカ利用を検出</span>
        </div>
        <div className="flex items-center text-gray-700">
          <div className="text-green-600 mr-3">✅</div>
          <span>解約忘れサブスクを発見</span>
        </div>
        <div className="flex items-center text-gray-700">
          <div className="text-green-600 mr-3">✅</div>
          <span>年間◯万円の節約可能額表示</span>
        </div>
      </div>

      <Button
        onClick={nextStep}
        size="lg"
        className="w-full mb-4 bg-blue-600 hover:bg-blue-700"
      >
        📧 Gmailで始める（3分で完了）
      </Button>

      <p className="text-sm text-gray-500">
        💡 メール内容は読まず、件名と差出人のみ取得
      </p>
    </div>
  )

  const renderEmailConnectionStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="mb-8">
        <Shield className="w-16 h-16 mx-auto mb-4 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Gmailアカウントに安全に接続
        </h2>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
        <h3 className="font-semibold mb-3 flex items-center">
          <Mail className="w-5 h-5 mr-2" />
          📧 取得対象
        </h3>
        <ul className="text-sm space-y-2 text-gray-700">
          <li>• 過去3ヶ月のクレカ通知メール</li>
          <li>• 件名と差出人のみ（本文は読みません）</li>
          <li>• Netflix、楽天カードなど主要サービス</li>
        </ul>

        <h3 className="font-semibold mb-3 mt-6 flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          🛡️ セキュリティ
        </h3>
        <ul className="text-sm space-y-2 text-gray-700">
          <li>• 最高水準の暗号化</li>
          <li>• メール内容の永続保存なし</li>
          <li>• いつでも連携解除可能</li>
        </ul>
      </div>

      <Button
        onClick={handleGmailConnect}
        size="lg"
        className="w-full mb-4 bg-blue-600 hover:bg-blue-700"
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Mail className="w-4 h-4 mr-2" />
        )}
        🔗 Gmailに接続する
      </Button>

      <button
        onClick={nextStep}
        className="text-gray-500 hover:text-gray-700"
      >
        後で設定する
      </button>
    </div>
  )

  const renderAnalysisProgressStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="mb-8">
        <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-600 animate-spin" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🔍 メール分析中...
        </h2>
      </div>

      <div className="mb-8">
        <Progress value={analysisProgress} className="w-full h-3 mb-2" />
        <p className="text-sm text-gray-600">{Math.round(analysisProgress)}%</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left">
        <h3 className="font-semibold mb-3">📊 現在の状況</h3>
        <ul className="text-sm space-y-2 text-gray-700">
          <li>• スキャン済み: {Math.round(analysisProgress * 1.8)}/180 件</li>
          <li>• 検出したクレカ利用: {Math.round(analysisProgress * 0.23)} 件</li>
          <li>• 見つかったサブスク: {Math.round(analysisProgress * 0.04)} 個</li>
        </ul>

        <h3 className="font-semibold mb-3 mt-6">🎯 解析中のサービス</h3>
        <ul className="text-sm space-y-2 text-gray-700">
          <li>✅ 楽天カード</li>
          <li className="flex items-center">
            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            🔄 Netflix をチェック中...
          </li>
          <li>⏳ Amazon Prime</li>
          <li>⏳ Spotify</li>
        </ul>
      </div>

      <p className="text-sm text-gray-500">
        残り時間: 約{Math.max(45 - Math.round(analysisProgress * 0.45), 5)}秒
      </p>
    </div>
  )

  const renderResultsStep = () => (
    <div className="max-w-md mx-auto text-center">
      <div className="mb-8">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          すごい！隠れた支出を発見！
        </h2>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-2">💳 過去3ヶ月の支出</h3>
        <div className="text-3xl font-bold text-blue-600 mb-2">¥127,340</div>
        <p className="text-sm text-gray-600">思ったより使ってました 😅</p>
      </div>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">🔍 発見したサブスク</h3>
        <div className="space-y-3 text-left">
          <div className="flex justify-between items-center">
            <span className="flex items-center text-sm">📺 Netflix</span>
            <span className="text-sm font-medium">¥1,490/月</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center text-sm">🎵 Spotify</span>
            <span className="text-sm font-medium">¥980/月</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center text-sm">📦 Amazon Prime</span>
            <span className="text-sm font-medium">¥500/月</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center text-sm">💾 iCloud</span>
            <span className="text-sm font-medium">¥130/月</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="font-semibold">💰 年間 ¥37,200 のサブスク代</span>
          </div>
          <p className="text-sm text-orange-600 mt-2">
            ⚠️ 使っていないものがあれば年間◯万円節約可能
          </p>
        </div>
      </div>

      <Button
        onClick={nextStep}
        size="lg"
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        <TrendingUp className="w-4 h-4 mr-2" />
        📊 詳しく見る
      </Button>
    </div>
  )

  const renderPlanSelectionStep = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🚀 さらに詳しい分析と継続監視
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">無料版で続ける</h3>
          <div className="space-y-3 mb-6">
            <div className="flex items-center text-sm">
              <span className="text-green-600 mr-2">✅</span>
              手動家計簿
            </div>
            <div className="flex items-center text-sm">
              <span className="text-green-600 mr-2">✅</span>
              基本統計
            </div>
            <div className="flex items-center text-sm">
              <span className="text-red-600 mr-2">❌</span>
              メール連携
            </div>
            <div className="flex items-center text-sm">
              <span className="text-red-600 mr-2">❌</span>
              自動監視
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold mb-2">無料</div>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                無料版で始める
              </Button>
            </Link>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6 relative">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
              おすすめ
            </span>
          </div>
          <h3 className="text-lg font-semibold mb-4">スタンダード</h3>
          <div className="space-y-3 mb-6">
            <div className="flex items-center text-sm">
              <span className="text-blue-600 mr-2">🚀</span>
              今回の機能
            </div>
            <div className="flex items-center text-sm">
              <span className="text-green-600 mr-2">✅</span>
              メール自動取得
            </div>
            <div className="flex items-center text-sm">
              <span className="text-green-600 mr-2">✅</span>
              サブスク検知
            </div>
            <div className="flex items-center text-sm">
              <span className="text-green-600 mr-2">✅</span>
              継続監視
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-blue-600 font-medium">初月無料</div>
            <div className="text-2xl font-bold mb-2">¥980/月</div>
            <Link href="/pricing">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                <CreditCard className="w-4 h-4 mr-2" />
                スタンダードで始める（初月無料）
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-blue-600">⭐ 今なら初月無料でお試し可能</p>
        <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
          無料版で続ける
        </Link>
      </div>
    </div>
  )

  const renderCurrentStep = () => {
    switch (STEPS[currentStep].id) {
      case 'welcome':
        return renderWelcomeStep()
      case 'email-connection':
        return renderEmailConnectionStep()
      case 'analysis-progress':
        return renderAnalysisProgressStep()
      case 'results':
        return renderResultsStep()
      case 'plan-selection':
        return renderPlanSelectionStep()
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          {currentStep > 0 ? (
            <button
              onClick={prevStep}
              className="flex items-center text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
            </button>
          ) : (
            <Link href="/" className="text-gray-600 hover:text-gray-800">
              Skip
            </Link>
          )}

          <div className="text-center">
            <h1 className="text-xl font-bold">CardSync</h1>
            {currentStep < STEPS.length - 1 && (
              <p className="text-sm text-gray-500">
                {currentStep + 1}/5
              </p>
            )}
          </div>

          <Link href="/" className="text-gray-600 hover:text-gray-800">
            <X className="w-5 h-5" />
          </Link>
        </header>

        <StepIndicator />

        <main className="max-w-4xl mx-auto">
          {renderCurrentStep()}
        </main>
      </div>
    </div>
  )
}
