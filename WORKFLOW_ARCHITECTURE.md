# Vercel Cron-Based Workflow Architecture

## Overview
The workflow now uses **Vercel Cron Jobs** to execute each step as a **separate function call**, ensuring each stays under the 300-second Vercel Hobby limit.

## How It Works

### Architecture
```
8:00 PM IST Daily
    ↓
daily-workflow cron (initializes queue)
    ↓
workflow-step cron (runs every minute)
    ↓
Checks queue → Executes ONE step → Updates queue → Exits
    ↓
Next minute: workflow-step cron runs again
    ↓
Checks queue → Executes next step → Updates queue → Exits
    ↓
Repeats until workflow complete
```

### Cron Jobs

1. **`/api/cron/daily-workflow`** - Runs at 8:00 PM IST daily
   - Schedule: `30 14 * * *` (UTC: 2:30 PM = IST: 8:00 PM)
   - Action: Calls `startChainedWorkflow()` to initialize queue
   - Sets queue to `'clear_data'`
   - Returns immediately

2. **`/api/cron/workflow-step`** - Runs every minute
   - Schedule: `* * * * *` (every minute)
   - Action: Checks queue state and executes ONE step
   - Each execution is a separate Vercel function call (separate 300s limit)
   - Updates queue to next step
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

**Total Time**: ~9 minutes (each step is a separate function call)

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
- ✅ `/api/cron/daily-workflow` - Daily at 8:00 PM IST
- ✅ `/api/cron/workflow-step` - Every minute

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

✅ **Each step = Separate function call**
   - Scout runs → completes → exits
   - Cron triggers again → Dedup runs → completes → exits
   - Cron triggers again → Journalist 1 runs → completes → exits
   - And so on...

✅ **No timeout issues**
   - Each step completes in <60s
   - Well under 300s Vercel Hobby limit
   - No long-running processes

✅ **Works without browser**
   - Fully server-side
   - Cron triggers automatically
   - No client needed

✅ **Automatic continuation**
   - Each step updates queue to next step
   - Cron picks up next step within 1 minute
   - Workflow progresses automatically

✅ **Error handling**
   - If step fails, queue set to 'error'
   - Cron stops executing
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
