# Automatic Job Processing System

## Overview

The Change Reel application now features an **automatic job processing system** that starts when the Next.js application boots up. This replaces the previous manual job processing approach and ensures all webhook-triggered jobs are processed automatically in the background.

## How It Works

### Automatic Startup

1. **App Starts** → Next.js `instrumentation.ts` runs
2. **Job System Initializes** → All dependencies and handlers are created
3. **Processor Starts** → Background polling begins every 2 seconds  
4. **Webhooks Create Jobs** → GitHub webhooks create jobs in the database
5. **Automatic Processing** → Job processor finds and processes jobs automatically
6. **No Manual Intervention** → Everything runs in the background

### System Components

#### 1. Startup Service (`src/lib/startup/job-system-startup.ts`)
- **Purpose**: Initializes and starts the job processing system
- **Features**:
  - Environment validation
  - Service dependency creation
  - Graceful shutdown handling
  - Configuration management
  - Global instance management

#### 2. Instrumentation Hook (`instrumentation.ts`)
- **Purpose**: Next.js server startup hook
- **Features**:
  - Runs automatically when server starts
  - Calls the startup service
  - Handles initialization errors gracefully
  - Continues app startup even if job system fails

#### 3. Job Status API (`/api/jobs/status`)
- **Purpose**: Monitor the automatic job processing system
- **Endpoints**:
  - `GET /api/jobs/status` - View system status and queue statistics
  - `POST /api/jobs/status` - Check current processing activity

### Configuration

The system uses different configurations based on environment:

#### Production Config
```typescript
{
  max_concurrent_jobs: 10,
  retry_delay_ms: 2000,
  max_retry_delay_ms: 60000,
  exponential_backoff: true,
  job_timeout_ms: 600000, // 10 minutes
  cleanup_completed_after_days: 7
}
```

#### Development Config  
```typescript
{
  max_concurrent_jobs: 3,
  retry_delay_ms: 1000,
  max_retry_delay_ms: 10000,
  exponential_backoff: true,
  job_timeout_ms: 300000, // 5 minutes
  cleanup_completed_after_days: 1
}
```

## Migration from Manual Processing

### Before (Manual System)
- ❌ Jobs sat in database unprocessed
- ❌ Required manual API calls to `/api/jobs/process`
- ❌ No automatic polling or background processing
- ❌ Had to manually trigger job processing

### After (Automatic System)
- ✅ Jobs are processed automatically every 2 seconds
- ✅ Background polling starts with the app
- ✅ Automatic retry logic with exponential backoff
- ✅ Graceful shutdown handling
- ✅ Built-in monitoring and statistics

## Usage

### Starting the System
The system starts automatically when you run:
```bash
npm run dev        # Development
npm run build && npm start  # Production
```

### Monitoring the System
Check if the job processor is running:
```bash
curl http://localhost:3000/api/jobs/status
```

Example response:
```json
{
  "status": "running",
  "message": "Job processing system is running automatically",
  "running": true,
  "queue_stats": {
    "pending": 2,
    "running": 1,
    "completed": 15,
    "failed": 0
  },
  "active_jobs": [...],
  "active_job_count": 1,
  "processor_config": {...}
}
```

### Testing Job Processing Activity
Send a POST request to see current activity:
```bash
curl -X POST http://localhost:3000/api/jobs/status
```

## Troubleshooting

### Job System Not Running
If the status shows `not_initialized` or `stopped`:

1. **Check Environment Variables**:
   ```bash
   # Required variables
   NEXT_PUBLIC_SUPABASE_URL=your_url
   SUPABASE_SERVICE_ROLE_KEY=your_key  
   OPENAI_API_KEY=your_key
   NEXTAUTH_SECRET=your_secret
   ```

2. **Check Server Logs**:
   Look for startup messages:
   ```
   🚀 [Startup] Initializing job processing system...
   ✅ [Startup] Job processing system started successfully
   ```

3. **Restart the Application**:
   ```bash
   # Stop the app (Ctrl+C) and restart
   npm run dev
   ```

### Jobs Not Being Processed
If jobs remain in `pending` status:

1. **Verify System is Running**:
   ```bash
   curl http://localhost:3000/api/jobs/status
   ```

2. **Check for Processing Errors**:
   Look for error messages in server logs

3. **Check Job Dependencies**:
   Ensure prerequisite jobs are completed

### Performance Issues
If processing is slow:

1. **Increase Concurrent Jobs** (production):
   The system automatically uses higher limits in production

2. **Check Resource Usage**:
   Monitor CPU and memory usage during processing

3. **Review Retry Configuration**:
   Failed jobs may be consuming resources

## Development Notes

### Adding New Job Handlers
New handlers are automatically registered during startup in `job-system-startup.ts`.

### Graceful Shutdown
The system handles shutdown signals:
- `SIGTERM` - Production deployments
- `SIGINT` - Development (Ctrl+C)
- `uncaughtException` - Error recovery
- `unhandledRejection` - Promise error recovery

### Dependencies
The startup system creates service dependencies with error handling:
- Supabase services (commits, projects)
- OpenAI client and summarization service  
- Token storage service
- Webhook processing service
- GitHub API clients (created as needed)

## Security Considerations

- Environment variables are validated on startup
- OAuth tokens are encrypted in storage
- Webhook signatures are verified before processing
- Job processing runs in isolated contexts
- Graceful error handling prevents information leakage

## Performance Benefits

- **Immediate Processing**: Jobs start processing within 2 seconds of creation
- **Concurrent Execution**: Multiple jobs processed simultaneously  
- **Automatic Retries**: Failed jobs retry with exponential backoff
- **Resource Cleanup**: Completed jobs are automatically cleaned up
- **Efficient Polling**: Intelligent polling only when jobs are available 