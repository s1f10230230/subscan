import { useState, useEffect } from 'react'
import useSWR from 'swr'

interface EmailAccount {
  id: string
  emailAddress: string
  provider: string
  isActive: boolean
  lastSync: string | null
  createdAt: string
  tokenExpires: string | null
  isTokenValid: boolean
  emailDataCount: number
}

interface EmailAccountsResponse {
  emailAccounts: EmailAccount[]
  total: number
}

interface SyncResult {
  success: boolean
  processedCount: number
  errorCount: number
  totalEmailsFound: number
  errors: string[]
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function useEmailAccounts() {
  const { data, error, mutate } = useSWR<EmailAccountsResponse>('/api/email-accounts', fetcher)

  return {
    emailAccounts: data?.emailAccounts || [],
    total: data?.total || 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate,
  }
}

export function useEmailAccountSync() {
  const [syncingAccounts, setSyncingAccounts] = useState<Set<string>>(new Set())
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>({})

  const syncAccount = async (accountId: string): Promise<SyncResult | null> => {
    if (syncingAccounts.has(accountId)) {
      return null
    }

    setSyncingAccounts(prev => new Set(prev).add(accountId))

    try {
      const response = await fetch(`/api/email-accounts/${accountId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          daysPast: 30,
          maxResults: 100,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result: SyncResult = await response.json()

      setSyncResults(prev => ({
        ...prev,
        [accountId]: result,
      }))

      return result
    } catch (error) {
      console.error(`Failed to sync account ${accountId}:`, error)

      const errorResult: SyncResult = {
        success: false,
        processedCount: 0,
        errorCount: 1,
        totalEmailsFound: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      }

      setSyncResults(prev => ({
        ...prev,
        [accountId]: errorResult,
      }))

      return errorResult
    } finally {
      setSyncingAccounts(prev => {
        const next = new Set(prev)
        next.delete(accountId)
        return next
      })
    }
  }

  const syncMultipleAccounts = async (accountIds: string[]): Promise<SyncResult[]> => {
    const results = []

    for (const accountId of accountIds) {
      const result = await syncAccount(accountId)
      if (result) {
        results.push(result)
      }

      // 各同期の間に1秒待機してAPIの負荷を軽減
      if (accountIds.indexOf(accountId) < accountIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  const isSyncing = (accountId: string): boolean => {
    return syncingAccounts.has(accountId)
  }

  const getLastSyncResult = (accountId: string): SyncResult | undefined => {
    return syncResults[accountId]
  }

  const clearSyncResult = (accountId: string) => {
    setSyncResults(prev => {
      const next = { ...prev }
      delete next[accountId]
      return next
    })
  }

  return {
    syncAccount,
    syncMultipleAccounts,
    isSyncing,
    getLastSyncResult,
    clearSyncResult,
    syncingAccountsCount: syncingAccounts.size,
    allSyncResults: syncResults,
  }
}

export function useEmailAccountActions() {
  const [isLoading, setIsLoading] = useState(false)

  const updateAccount = async (accountId: string, data: { isActive?: boolean }) => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/email-accounts/${accountId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Failed to update account ${accountId}:`, error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const deleteAccount = async (accountId: string) => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/email-accounts/${accountId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`Failed to delete account ${accountId}:`, error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const createAccount = async (data: {
    emailAddress: string
    provider: string
    accessToken: string
    refreshToken?: string
    tokenExpires?: string
  }) => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/email-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to create email account:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    updateAccount,
    deleteAccount,
    createAccount,
    isLoading,
  }
}