'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

type Commit = {
  id: string
  author: string
  type?: 'feature' | 'fix' | 'refactor' | 'chore'
  timestamp: string
}

type CommitsResponse = {
  commits: Commit[]
  count: number
}

export default function MetricsBar() {
  const { data: session } = useSession()
  const [commits, setCommits] = useState<Commit[]>([])
  const [repoName, setRepoName] = useState<string>('')
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        // Fetch up to 100 recent commits for metrics
        const res = await fetch('/api/commits?page=1&pageSize=100')
        if (res.ok) {
          const data: CommitsResponse = await res.json()
          setCommits(Array.isArray(data.commits) ? data.commits : [])
        }
      } catch {}

      try {
        // Fetch config to display selected repository/app name
        const res = await fetch('/api/config')
        if (res.ok) {
          const data = await res.json()
          const name: string = data?.configuration?.repositoryFullName || ''
          setRepoName(name)
        }
      } catch {}
    }
    load()
  }, [])

  // Load credit balance for authenticated user
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setBalanceLoading(true)
        setBalanceError(null)
        // Resolve internal UUID via server
        const me = await fetch('/api/users/me')
        if (!me.ok) throw new Error('Failed to resolve user')
        const meJson = await me.json()
        const userId = meJson?.id
        if (!userId) throw new Error('Failed to resolve user')
        const res = await fetch('/api/billing/balance', {
          method: 'GET',
          headers: { 'x-user-id': String(userId) },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Failed to fetch balance')
        setBalance(typeof data.balance === 'number' ? data.balance : Number(data.balance) || 0)
      } catch (e: any) {
        setBalanceError(e?.message || 'Failed to fetch balance')
      } finally {
        setBalanceLoading(false)
      }
    }
    fetchBalance()
  }, [session])

  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 7)

  const featuresThisWeek = commits.filter(
    c => c.type === 'feature' && new Date(c.timestamp) >= weekAgo
  ).length

  const contributors = new Set(commits.map(c => c.author)).size

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="text-md text-gray-500 mb-1">App name</div>
        <div className="text-base font-medium text-gray-900 truncate">{repoName || '—'}</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="text-md text-gray-500 mb-1">Features this week</div>
        <div className="text-2xl font-semibold text-gray-900">{featuresThisWeek}</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="text-md text-gray-500 mb-1">Credits Remaining</div>
        {session ? (
          balanceLoading ? (
            <div className="text-gray-500">Loading…</div>
          ) : balanceError ? (
            <div className="text-red-600 text-sm">{balanceError}</div>
          ) : (
            <div className="text-2xl font-semibold text-gray-900">{balance ?? '—'}</div>
          )
        ) : (
          <div className="text-sm text-gray-600">
            <Link href="/billing" className="text-blue-600 hover:underline">Sign in</Link> to view and top up credits
          </div>
        )}
      </div>
    </div>
  )
}
