# Hybrid Workflow Architecture

## Overview
The workflow uses a **hybrid approach**:
- **Manual runs**: Client-side executor provides instant step execution
- **Automated runs**: Vercel Cron Jobs execute steps (no client needed)
- **Each step** = Separate function call (stays under 300s Vercel Hobby limit)

## How It Works

### Manual Runs (Instant Execution)
```
User clicks "Start Workflow"
    ↓
startChainedWorkflow() initializes queue
    ↓
WorkflowChainExecutor (client) detects work
    ↓
Immediately calls executeNextWorkflowStep()
    ↓
Step 1 executes → completes → queue updates
    ↓
Client detects change (1-second polling)
    ↓
Immediately calls next step
    ↓
Repeats until all 9 steps complete (~5-8 minutes)
```

### Automated Runs (2:30 AM IST Daily - No Client Needed)
```
2:30 AM IST Daily
    ↓
daily-workflow cron initializes queue
    ↓
workflow-step cron (runs every minute)
    ↓
Checks queue → Executes ONE step → Updates queue → Exits
    ↓
Next minute: cron runs again → next step
    ↓
Repeats until workflow complete (~9-10 minutes with cron delays)
    ↓
3:00 AM IST Daily
    ↓
daily-publish cron publishes edition
```

## Cron Jobs

1. **`/api/cron/daily-workflow`** - Runs at 2:30 AM IST daily
   - Schedule: `0 21 * * *` (UTC: 9:00 PM = IST: 2:30 AM)
   - Action: Calls `startChainedWorkflow()` to initialize queue
   - Sets queue to `'clear_data'`
   - Returns immediately

2. **`/api/cron/workflow-step`** - Runs every minute
   - Schedule: `* * * * *` (every minute)
   - Action: Checks queue state and executes ONE step
   - Each execution is a separate Vercel function call (separate 300s limit)
   - Updates queue to next step
   - Returns immediately

3. **`/api/cron/daily-publish`** - Runs at 3:00 AM IST daily
   - Schedule: `30 21 * * *` (UTC: 9:30 PM = IST: 3:00 AM)
   - Action: Publishes the latest edition
   - Runs independently of workflow
   - Returns immediately

### Workflow Steps (9 total)
1. `clear_data` → Scout (60s)
2. `dedup` → Deduplication (20s)
3. `journalist_1` → Journalist 1 (60s)
4. `journalist_2` → Journalist 2 (60s)
5. `journalist_3` → Journalist 3 (60s)
6. `journalist_4` → Journalist 4 (60s)
7. `journalist_5` → Journalist 5 (60s)
8. `validate` → Validation (30s)
9. `editor` → Editor + Publish (60s)

**Total Time**: 
- Manual run: ~5-8 minutes (instant step transitions)
- Automated run: ~9-10 minutes (includes 1-minute cron delays)

## Components

### Client-Side (Manual Runs Only)
- **WorkflowChainExecutor**: React component that polls queue every 1-3 seconds
- Only active when user has Mission Control open
- Provides instant feedback and step progression
- Not needed for automated runs

### Server-Side (Both Manual & Automated)
- **Server Actions**: Individual step functions (Scout, Dedup, Journalists, Validate, Editor)
- **Cron Endpoints**: API routes that Vercel triggers on schedule
- **Firestore Queue**: Tracks current workflow step and state

## Deployment Setup

### 1. Deploy to Vercel
```bash
git push
# Vercel will auto-deploy
```

### 2. Add Environment Variable (Optional but Recommended)
In Vercel Dashboard → Settings → Environment Variables:
```
CRON_SECRET=<generate-random-secret>
```

Generate secret:
```bash
openssl rand -base64 32
```

### 3. Verify Cron Jobs
After deployment, Vercel Dashboard → Settings → Cron Jobs should show:
- ✅ `/api/cron/daily-workflow` - Daily at 2:30 AM IST (9:00 PM UTC)
- ✅ `/api/cron/workflow-step` - Every minute
- ✅ `/api/cron/daily-publish` - Daily at 3:00 AM IST (9:30 PM UTC)

## Manual Testing

### Test Daily Trigger (Initialize Workflow)
```bash
curl https://your-domain.vercel.app/api/cron/daily-workflow \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test Step Execution
```bash
curl https://your-domain.vercel.app/api/cron/workflow-step \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Test from Mission Control
Just click the "Start Workflow" button - it calls `startChainedWorkflow()` which initializes the queue. The cron will pick it up within 1 minute.

## Benefits

✅ **Manual runs: Instant execution**
   - Client executor provides immediate step transitions
   - ~5-8 minute total completion time
   - Real-time UI feedback

✅ **Automated runs: No client needed**
   - Runs at 2:30 AM IST via Vercel Cron
   - Works when browser is closed
   - Publishes automatically at 3:00 AM IST

✅ **Each step = Separate function call**
   - Scout runs → completes → exits
   - Cron/Client triggers next step
   - Each step <60s, well under 300s limit
   - No timeout issues

✅ **Error handling**
   - If step fails, queue set to 'error'
   - Execution stops automatically
   - Error visible in Mission Control

## Vercel Limits

- **Hobby Plan**: 300s per function call ✅
- **Cron Jobs**: Unlimited on all plans ✅
- **Function Calls**: Each cron = separate call ✅

## Monitoring

### Vercel Dashboard
- Functions → View logs for each cron execution
- See each step as separate invocation

### Mission Control UI
- Real-time status updates via Firestore
- See current step in progress
- Individual journalist progress tracked

## Notes

- Cron runs every minute but only executes if queue has work
- When queue is 'idle' or 'complete', cron returns early (no work)
- Each step updates Firestore workflow_state for UI updates
- Total workflow time: ~9-10 minutes (including cron delays)
