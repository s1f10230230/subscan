import { User, CreditCard, Transaction, Category, Subscription, EmailAccount, EmailData } from '@prisma/client'

// Extended types with relations
export type UserWithRelations = User & {
  creditCards: CreditCard[]
  emailAccounts: EmailAccount[]
  transactions: TransactionWithRelations[]
  subscriptions: SubscriptionWithRelations[]
  categories: Category[]
}

export type CreditCardWithRelations = CreditCard & {
  user: User
  transactions: TransactionWithRelations[]
  subscriptions: SubscriptionWithRelations[]
  _count: {
    transactions: number
  }
}

export type TransactionWithRelations = Transaction & {
  user: User
  creditCard: CreditCard
  category: Category
  emailData?: EmailData
}

export type SubscriptionWithRelations = Subscription & {
  user: User
  creditCard?: CreditCard
}

export type CategoryWithRelations = Category & {
  user?: User
  transactions: Transaction[]
  _count: {
    transactions: number
  }
}

// API response types
export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  meta?: {
    pagination?: PaginationMeta
    timestamp: string
    requestId: string
  }
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
  }
  meta: {
    timestamp: string
    requestId: string
  }
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// Dashboard types
export interface DashboardStats {
  totalExpenses: number
  transactionCount: number
  averageTransaction: number
  activeSubscriptions: number
  monthlySubscriptionCost: number
}

export interface DashboardComparison {
  expenseChange: number
  transactionChange: number
}

export interface ChartData {
  timeline: TimelineData[]
  categories: CategoryData[]
  subscriptions: SubscriptionChartData[]
}

export interface TimelineData {
  date: string
  amount: number
  count: number
}

export interface CategoryData {
  categoryId: string
  name: string
  amount: number
  count: number
  color: string
  icon: string
  percentage: number
}

export interface SubscriptionChartData {
  serviceName: string
  amount: number
  billingCycle: string
  color: string
}

// Subscription analytics types
export interface SubscriptionAlert {
  id: string
  type: 'expensive' | 'unused' | 'duplicate'
  serviceName: string
  message: string
  severity: 'high' | 'medium' | 'low'
  action: string
  potentialSaving?: number
}

export interface SavingOpportunity {
  subscriptionId: string
  serviceName: string
  recommendation: 'CANCEL' | 'DOWNGRADE' | 'REVIEW'
  potentialMonthlySaving: number
  potentialYearlySaving: number
  reason: string
}

// Email processing types
export interface EmailMessage {
  id: string
  subject: string
  sender: string
  receivedDate: Date
  body: string
}

export interface ProcessingJob {
  id: string
  userId: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
  progress: number
  totalEmails: number
  processedEmails: number
  results: EmailParseResult[]
  errors: string[]
  estimatedTimeRemaining?: number
  createdAt: Date
  updatedAt: Date
}

export interface EmailParseResult {
  success: boolean
  confidence: number
  type: 'SUBSCRIPTION' | 'TRANSACTION' | 'UNKNOWN'
  data?: {
    amount: number
    currency: string
    merchantName: string
    serviceName?: string
    billingCycle?: string
  }
  errors: string[]
  matchedPattern?: string
}

// Form types
export interface ContactFormData {
  name: string
  email: string
  subject: string
  message: string
}

export interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'other'
  description: string
  severity?: 'low' | 'medium' | 'high'
  userAgent?: string
  url?: string
}

// Error types
export interface AppError {
  code: string
  message: string
  status: number
  details?: any
}

export interface HandledError extends AppError {
  user: string
  action: 'RETRY' | 'RECONNECT' | 'CONTACT_SUPPORT' | 'RETRY_LATER'
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
}

// Filter types
export interface TransactionFilters {
  page?: number
  limit?: number
  categoryId?: string
  creditCardId?: string
  startDate?: string
  endDate?: string
  search?: string
}

export interface SubscriptionFilters {
  status?: 'ACTIVE' | 'CANCELED' | 'PAUSED'
  detectionMethod?: 'AUTO' | 'MANUAL'
  minAmount?: number
  maxAmount?: number
}

// Onboarding types
export interface OnboardingStep {
  id: string
  title: string
  description: string
  component: string
  isCompleted: boolean
  isRequired: boolean
}

export interface OnboardingState {
  currentStep: number
  steps: OnboardingStep[]
  isCompleted: boolean
  data: {
    emailConnected?: boolean
    analysisResults?: {
      subscriptionsFound: number
      transactionsFound: number
      potentialSavings: number
    }
    selectedPlan?: 'FREE' | 'STANDARD' | 'PRO'
  }
}

// Settings types
export interface NotificationSettings {
  emailNotifications: boolean
  subscriptionAlerts: boolean
  monthlyReports: boolean
  securityAlerts: boolean
}

export interface PrivacySettings {
  dataRetention: '3_months' | '1_year' | 'forever'
  emailDataSharing: boolean
  analyticsOptOut: boolean
}

// Export commonly used enums
export { PlanType, SourceType, BillingCycle, SubStatus, DetectionType } from '@prisma/client'