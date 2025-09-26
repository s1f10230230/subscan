'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function SyncNowButton() {
  const [loading, setLoading] = useState(false)
  const [persist, setPersist] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const handleClick = async () => {
    try {
      setLoading(true)
      setLastResult(null)
      const res = await fetch('/api/email/scan-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(persist ? { save: true } : {}),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Scan failed (${res.status})`)
      }
      const data = await res.json()
      const saved = data.saved ? ` / 保存: ${data.saved.transactionsCreated}件 (+ED ${data.saved.emailDataCreated})` : ''
      setLastResult(`検出: ${data.transactionsFound}件${saved}`)
    } catch (e: any) {
      setLastResult(`エラー: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <label className="flex items-center space-x-1 text-xs text-gray-600">
        <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} />
        <span>保存</span>
      </label>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? '同期中…' : '同期'}
      </Button>
      {lastResult && (
        <span className="text-xs text-gray-600">{lastResult}</span>
      )}
    </div>
  )
}
