import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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
        // Gmail アクセストークンを暗号化して保存
        if (account.access_token) {
          token.gmail_access_token = encrypt(account.access_token)
        }
        if (account.refresh_token) {
          token.gmail_refresh_token = encrypt(account.refresh_token)
        }
        token.gmail_expires_at = account.expires_at

        // ユーザー作成時にデフォルト設定
        if (user) {
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
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user?.email) {
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
          session.hasEmailConnection = user.emailAccounts.length > 0
          session.creditCardCount = user.creditCards.length
        }
      }

      // Gmail トークンをセッションに含める（UI用）
      session.gmail_access_token = token.gmail_access_token as string
      session.gmail_refresh_token = token.gmail_refresh_token as string
      session.gmail_expires_at = token.gmail_expires_at as number

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
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: "jwt",
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      if (isNewUser && user.email) {
        // 新規ユーザーのアクティビティログ
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
      } else if (user.email) {
        // 既存ユーザーのログインログ
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
        }
      }
    },
  },
}