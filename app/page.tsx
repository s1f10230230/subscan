import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-4xl w-full text-center">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            🎯 CardSync
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            複数クレカの隠れた支出とサブスクを3分で発見
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-12">
          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="text-2xl mb-3">✅</div>
            <h3 className="text-lg font-semibold mb-2">自動でクレカ利用を検出</h3>
            <p className="text-sm text-gray-600">
              Gmailからクレジットカード利用通知を自動取得
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="text-2xl mb-3">✅</div>
            <h3 className="text-lg font-semibold mb-2">解約忘れサブスクを発見</h3>
            <p className="text-sm text-gray-600">
              Netflix、Spotify等の忘れがちなサブスクを自動検出
            </p>
          </div>

          <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="text-2xl mb-3">✅</div>
            <h3 className="text-lg font-semibold mb-2">年間◯万円の節約可能額表示</h3>
            <p className="text-sm text-gray-600">
              使わないサービスを見つけて節約提案
            </p>
          </div>
        </div>

        <div className="mb-8">
          <Link href="/onboarding">
            <Button size="lg" className="px-8 py-3 text-lg bg-blue-600 hover:bg-blue-700">
              📧 Gmailで始める（3分で完了）
            </Button>
          </Link>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500 max-w-lg mx-auto">
            💡 メール内容は読まず、件名と差出人のみ取得します
          </p>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            すでにアカウントをお持ちの方は{' '}
            <Link href="/signin" className="text-blue-600 hover:underline">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}