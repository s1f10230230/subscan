export type UserPlan = 'FREE' | 'STANDARD' | 'PRO'

// Dev override: disable all plan limits when set to 'true'
export const PLAN_LIMITS_DISABLED = process.env.NEXT_PUBLIC_DISABLE_PLAN_LIMITS === 'true'

export const PLAN_LIMITS = {
  FREE: {
    monthlyTransactions: 100,
    creditCards: 2,
    quickInputSuggestions: 3,
    csvRange: 'MONTH_ONLY' as const,
  },
  STANDARD: {
    monthlyTransactions: Infinity,
    creditCards: Infinity,
    quickInputSuggestions: Infinity,
    csvRange: 'ANY' as const,
  },
  PRO: {
    monthlyTransactions: Infinity,
    creditCards: Infinity,
    quickInputSuggestions: Infinity,
    csvRange: 'ANY' as const,
  },
}

export function getPlanLimits(plan: UserPlan) {
  if (PLAN_LIMITS_DISABLED) return PLAN_LIMITS.PRO
  return PLAN_LIMITS[plan]
}

export function canAddMonthlyTransaction(plan: UserPlan, currentCount: number) {
  if (PLAN_LIMITS_DISABLED) return true
  const limit = PLAN_LIMITS[plan].monthlyTransactions
  return currentCount < limit
}

export function canAddCreditCard(plan: UserPlan, currentCount: number) {
  if (PLAN_LIMITS_DISABLED) return true
  const limit = PLAN_LIMITS[plan].creditCards
  return currentCount < limit
}

export function isCsvMonthOnly(plan: UserPlan) {
  if (PLAN_LIMITS_DISABLED) return false
  return PLAN_LIMITS[plan].csvRange === 'MONTH_ONLY'
}

export function isPlanLimitsDisabled() {
  return PLAN_LIMITS_DISABLED
}
