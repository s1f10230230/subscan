import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

const AUTH_NO_DB = process.env.NEXT_PUBLIC_AUTH_NO_DB === 'true'
import { encrypt } from "@/lib/encryption"

export const authOptions: NextAuthOptions = {
  debug: true,
  // adapter: PrismaAdapter(prisma), // Temporarily disabled for deployment
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly"
          ].join(" "),
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account && account.provider === "google") {
        // NOTE: JWTサイズ肥大によるCookie保存失敗を避けるため、
        // アクセス/リフレッシュトークンはJWTに保存しない。
        // 必要時はDBに保存・取得する実装に切替予定。
        token.gmail_scope_granted = account.scope?.includes('gmail.readonly') || false

        // ユーザー作成時にデフォルト設定
        if (user && !AUTH_NO_DB) {
          try {
            await prisma.user.upsert({
              where: { email: user.email! },
              update: {},
              create: {
                email: user.email!,
                name: user.name,
                image: user.image,
                provider: 'google',
                providerId: account.providerAccountId,
                plan: 'FREE',
              },
            })
          } catch (e) {
            console.error('Prisma upsert(user) failed in jwt callback (continuing without DB):', e)
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user?.email) {
        if (AUTH_NO_DB) {
          // DBへはアクセスせず最低限の属性を設定
          session.user.plan = (session.user as any).plan || 'FREE'
          // @ts-expect-error
          session.hasEmailConnection = false
          // @ts-expect-error
          session.creditCardCount = 0
        } else {
          try {
            const user = await prisma.user.findUnique({
              where: { email: session.user.email },
              include: {
                emailAccounts: true,
                creditCards: true,
              },
            })

            if (user) {
              session.user.id = user.id
              session.user.plan = user.plan
              session.user.monthStartDay = user.monthStartDay
              // @ts-expect-error extra fields
              session.hasEmailConnection = user.emailAccounts.length > 0
              // @ts-expect-error extra fields
              session.creditCardCount = user.creditCards.length
            } else {
              session.user.plan = 'FREE'
            }
          } catch (e) {
            console.error('Prisma findUnique(user) failed in session callback (continuing without DB):', e)
            session.user.plan = 'FREE'
          }
        }
      }

      // GmailトークンはJWTに含めない方針（Cookieサイズ対策）
      // UIではフラグのみ使用
      // @ts-expect-error add custom flag
      session.gmail_scope_granted = (token as any).gmail_scope_granted ?? false

      return session
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          // Gmail APIスコープが含まれているかチェック
          const hasGmailScope = account.scope?.includes('gmail.readonly')

          if (!hasGmailScope) {
            console.warn('Gmail scope not granted')
          }

          return true
        } catch (error) {
          console.error('Sign in error:', error)
          return false
        }
      }
      return true
    },
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
  session: {
    strategy: "jwt",
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      try {
        if (!AUTH_NO_DB && isNewUser && user.email) {
          await prisma.userActivityLog.create({
            data: {
              userId: user.id!,
              action: 'signup',
              details: JSON.stringify({
                provider: account?.provider,
                isNewUser: true,
              }),
            },
          })
        } else if (!AUTH_NO_DB && user.email) {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          })

          if (existingUser) {
            await prisma.userActivityLog.create({
              data: {
                userId: existingUser.id,
                action: 'login',
                details: JSON.stringify({
                  provider: account?.provider,
                }),
              },
            })
            // Persist Gmail tokens for email integration (if provided)
            if (!AUTH_NO_DB && account?.provider === 'google' && (account.access_token || account.refresh_token)) {
              try {
                const encAccess = account.access_token ? encrypt(account.access_token) : undefined
                const encRefresh = account.refresh_token ? encrypt(account.refresh_token) : undefined
                await prisma.emailAccount.upsert({
                  where: { userId_emailAddress: { userId: existingUser.id, emailAddress: user.email } },
                  update: {
                    ...(encAccess ? { accessToken: encAccess } : {}),
                    ...(encRefresh ? { refreshToken: encRefresh } : {}),
                    provider: 'google',
                  },
                  create: {
                    userId: existingUser.id,
                    emailAddress: user.email,
                    provider: 'google',
                    accessToken: encAccess || '',
                    refreshToken: encRefresh,
                  },
                })
              } catch (e) {
                console.error('Failed to upsert EmailAccount during signIn:', e)
              }
            }
          }
        }
      } catch (e) {
        console.error('Prisma logging failed in signIn event (continuing):', e)
      }
    },
  },
}
