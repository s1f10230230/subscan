export type UserPlan = 'FREE' | 'STANDARD' | 'PRO'

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
  return PLAN_LIMITS[plan]
}

export function canAddMonthlyTransaction(plan: UserPlan, currentCount: number) {
  const limit = PLAN_LIMITS[plan].monthlyTransactions
  return currentCount < limit
}

export function canAddCreditCard(plan: UserPlan, currentCount: number) {
  const limit = PLAN_LIMITS[plan].creditCards
  return currentCount < limit
}

export function isCsvMonthOnly(plan: UserPlan) {
  return PLAN_LIMITS[plan].csvRange === 'MONTH_ONLY'
}

