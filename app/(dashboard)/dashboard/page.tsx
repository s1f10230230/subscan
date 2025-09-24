import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            ダッシュボード
          </h1>
          <p className="text-gray-600 mt-2">
            ようこそ、{session.user?.name}さん
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">今月の支出</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥0</div>
              <p className="text-xs text-muted-foreground">
                前月比 +0%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">取引回数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0回</div>
              <p className="text-xs text-muted-foreground">
                平均 ¥0
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">サブスク</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0個</div>
              <p className="text-xs text-muted-foreground">
                月額 ¥0
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">節約可能額</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥0</div>
              <p className="text-xs text-muted-foreground">
                年間予想
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>はじめに</CardTitle>
              <CardDescription>
                CardSyncを使い始めるために必要な設定を行いましょう
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">📧 Gmail連携</h3>
                    <p className="text-sm text-muted-foreground">
                      メール自動解析でクレカ利用を検出
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    設定する
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">💳 クレジットカード追加</h3>
                    <p className="text-sm text-muted-foreground">
                      使用中のカード情報を登録
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    追加する
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">🔍 初回分析実行</h3>
                    <p className="text-sm text-muted-foreground">
                      過去3ヶ月のメール分析
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    開始する
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>お知らせ</CardTitle>
              <CardDescription>
                CardSyncの最新情報
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-medium">Phase 1 実装完了</h3>
                  <p className="text-sm text-muted-foreground">
                    基本的なプロジェクト構造が完成しました
                  </p>
                </div>

                <div className="border-l-4 border-yellow-500 pl-4">
                  <h3 className="font-medium">次の実装予定</h3>
                  <p className="text-sm text-muted-foreground">
                    Gmail API連携とメール解析機能
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}