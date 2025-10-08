import { SendEmailHandler } from '@/lib/jobs/handlers/send-email-handler'

describe('SendEmailHandler', () => {
  const commitService = {
    getCommit: jest.fn(),
    markCommitAsEmailSent: jest.fn(),
  }
  const projectService = {
    getProject: jest.fn(),
  }
  const emailClient = {
    sendEmail: jest.fn().mockResolvedValue({ id: 'email_1', status: 'queued', provider: 'resend' }),
  }
  const emailTracking = {
    recordEmailSend: jest.fn().mockResolvedValue({ data: { id: 'rec_1' }, error: null }),
    markEmailSendStatus: jest.fn().mockResolvedValue({ data: {}, error: null }),
  }

  beforeEach(() => {
    jest.resetAllMocks()
    ;(global as any).process.env.RESEND_FROM_EMAIL = 'no-reply@test.dev'
  })

  it('sends digest email and marks commits', async () => {
    const handler = new SendEmailHandler(
      commitService as any,
      projectService as any,
      emailClient as any,
      emailTracking as any
    )

    const job: any = { id: 'job_1' }
    const data = {
      commit_ids: ['c1', 'c2'],
      recipients: ['x@example.com'],
      template_type: 'digest' as const,
    }
    commitService.getCommit
      .mockResolvedValueOnce({ data: { id: 'c1', summary: 'A', author: 'aa', sha: '1111111', timestamp: new Date().toISOString(), project_id: 'p1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'c2', summary: 'B', author: 'bb', sha: '2222222', timestamp: new Date().toISOString(), project_id: 'p1' }, error: null })
    projectService.getProject.mockResolvedValue({ data: { id: 'p1', name: 'Proj' }, error: null })
    commitService.markCommitAsEmailSent.mockResolvedValue({ data: {}, error: null })

    const res = await handler.handle(job, data)
    expect(res.success).toBe(true)
    expect(emailClient.sendEmail).toHaveBeenCalled()
    expect(commitService.markCommitAsEmailSent).toHaveBeenCalledTimes(2)
  })
})


