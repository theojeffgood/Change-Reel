import { POST } from '@/app/api/emails/schedule/daily/route'

// Mock Supabase service used by the route
jest.mock('@/lib/supabase/client', () => ({
  SupabaseService: jest.fn().mockImplementation(() => ({
    getRawClient: () => ({}),
    commits: {
      getCommitsForEmail: jest
        .fn()
        .mockResolvedValue({ data: [{ id: 'c1' }, { id: 'c2' }], error: null }),
    },
  })),
}))

// Mock JobQueueService used by the route
jest.mock('@/lib/supabase/services/jobs', () => ({
  JobQueueService: jest.fn().mockImplementation(() => ({
    createJob: jest.fn().mockResolvedValue({ data: { id: 'job-123' }, error: null }),
  })),
}))

function createJsonRequest(body: any): Request {
  return new Request('http://localhost/api/emails/schedule/daily', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/emails/schedule/daily', () => {
  it('schedules a digest job and returns 201', async () => {
    const req = createJsonRequest({ projectId: 'proj-1', recipients: ['a@example.com'] })
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.jobId).toBe('job-123')
    expect(typeof json.scheduled_for).toBe('string')
  })

  it('returns 200 with message when no commits eligible', async () => {
    const { SupabaseService } = require('@/lib/supabase/client')
    // Override mock for this test case to return empty commits
    SupabaseService.mockImplementation(() => ({
      getRawClient: () => ({}),
      commits: {
        getCommitsForEmail: jest.fn().mockResolvedValue({ data: [], error: null }),
      },
    }))

    const req = createJsonRequest({ projectId: 'proj-1', recipients: ['a@example.com'] })
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toMatch(/No commits eligible/i)
  })
})


