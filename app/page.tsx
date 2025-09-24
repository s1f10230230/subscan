export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          🎯 CardSync
        </h1>
        <p className="text-center text-xl text-muted-foreground mb-8">
          クレジットカードの支出を自動で管理し、隠れたサブスクリプションを発見
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="p-6 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">📧 自動メール解析</h3>
            <p className="text-sm text-muted-foreground">
              Gmailからクレジットカード利用通知を自動取得
            </p>
          </div>

          <div className="p-6 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">🔍 サブスク検知</h3>
            <p className="text-sm text-muted-foreground">
              忘れがちなサブスクリプションを自動検出
            </p>
          </div>

          <div className="p-6 border rounded-lg">
            <h3 className="text-lg font-semibold mb-2">💰 節約提案</h3>
            <p className="text-sm text-muted-foreground">
              解約可能なサービスで年間節約額を表示
            </p>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-muted-foreground">
            実装中... Phase 1: プロジェクト基盤構築
          </p>
        </div>
      </div>
    </main>
  )
}