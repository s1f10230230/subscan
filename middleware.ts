import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // 認証が必要なルートへのアクセス時の処理
    console.log("Middleware executed for:", req.nextUrl.pathname)
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl

        // 公開ページ（認証不要）
        const publicPaths = [
          '/',
          '/auth/signin',
          '/auth/signup',
          '/auth/error',
          '/privacy',
          '/terms',
          '/pricing',
        ]

        if (publicPaths.includes(pathname)) {
          return true
        }

        // API routes（認証が必要）
        if (pathname.startsWith('/api/')) {
          // Webhook routes は認証不要
          if (pathname.startsWith('/api/webhooks/')) {
            return true
          }
          // 認証 API routes は認証不要
          if (pathname.startsWith('/api/auth/')) {
            return true
          }
          // その他の API routes は認証が必要
          return !!token
        }

        // Dashboard routes（認証が必要）
        if (pathname.startsWith('/dashboard')) {
          return !!token
        }

        // その他のルート（認証が必要）
        return !!token
      },
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$).*)',
  ],
}