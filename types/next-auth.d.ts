import { DefaultSession, DefaultUser } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      plan: string
      monthStartDay: number
    } & DefaultSession["user"]
    hasEmailConnection: boolean
    creditCardCount: number
    gmail_access_token?: string
    gmail_refresh_token?: string
    gmail_expires_at?: number
  }

  interface User extends DefaultUser {
    id: string
    plan: string
    monthStartDay: number
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    gmail_access_token?: string
    gmail_refresh_token?: string
    gmail_expires_at?: number
  }
}