import { SignInButton } from "@/components/auth/signin-button"

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎯 CardSync
          </h1>
          <p className="text-gray-600">
            クレジットカードの支出を自動で管理
          </p>
        </div>

        <SignInButton />

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            初回ログインで自動的にアカウントが作成されます
          </p>
        </div>
      </div>
    </div>
  )
}