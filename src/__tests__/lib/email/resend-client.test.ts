import { ResendEmailClient } from '@/lib/email/resend-client'

describe('ResendEmailClient', () => {
  const originalEnv = process.env
  beforeEach(() => {
    jest.resetAllMocks()
    process.env = { ...originalEnv, RESEND_API_KEY: 'rk_test_123' }
  })
  afterAll(() => {
    process.env = originalEnv
  })

  it('sends email with proper headers and payload', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email_123' }),
    } as any)

    const client = new ResendEmailClient()
    const res = await client.sendEmail({
      to: ['a@example.com'],
      from: 'no-reply@test.dev',
      subject: 'Test',
      html: '<p>Hello</p>',
    })

    expect(fetchMock).toHaveBeenCalled()
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('/emails')
    expect(opts.headers['Authorization']).toMatch(/^Bearer /)
    expect(JSON.parse(opts.body).subject).toBe('Test')
    expect(res.id).toBe('email_123')
    expect(res.status).toBe('queued')
  })
})


