'use client'

import { useEffect, useState } from 'react'

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
  const [commits, setCommits] = useState<Commit[]>([])
  const [repoNames, setRepoNames] = useState<string[]>([])

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
        // Fetch all projects to derive repository list for display
        const res = await fetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          const names: string[] = Array.isArray(data?.projects)
            ? data.projects.map((p: any) => p.repo_name || p.name).filter(Boolean)
            : []
          setRepoNames(names)
        }
      } catch {}
    }
    load()
  }, [])

  const summariesDisplayed = commits.length

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-col items-center justify-center text-center min-h-[120px]">
          <div className="text-2xl font-semibold text-gray-900 truncate">{repoNames.length}</div>
          <div className="text-md text-gray-500 mt-1">Repositories</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-col items-center justify-center text-center min-h-[120px]">
          <div className="text-2xl font-semibold text-gray-900">{summariesDisplayed}</div>
          <div className="text-md text-gray-500 mt-1">Features Shipped</div>
        </div>
      </div>
    </div>
  )
}
