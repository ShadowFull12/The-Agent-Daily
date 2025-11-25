# Quick Reference: Hybrid Workflow

## Schedule
- **2:30 AM IST** - Automated workflow starts (via Vercel Cron)
- **3:00 AM IST** - Automated publish (via Vercel Cron)

## Manual vs Automated

### Manual Run (From Mission Control)
1. User clicks "Start Workflow" button
2. ✅ **Instant execution** - Client executor runs steps immediately
3. ✅ **Fast completion** - ~5-8 minutes total
4. ✅ **Real-time feedback** - See progress in UI
5. Requires browser open

### Automated Run (Daily at 2:30 AM IST)
1. Vercel Cron triggers workflow
2. ✅ **No client needed** - Fully server-side
3. ✅ **Reliable** - Runs even when browser closed
4. Takes ~9-10 minutes (includes cron 1-minute delays)
5. Auto-publishes at 3:00 AM IST

## Architecture

```
Manual Run:
User → startChainedWorkflow() → WorkflowChainExecutor (client) → 
Instant step transitions → ~5-8 min completion

Automated Run:
Vercel Cron (2:30 AM) → startChainedWorkflow() → workflow-step cron → 
1-minute step delays → ~9-10 min completion → 
Vercel Cron (3:00 AM) → Publish
```

## Vercel Cron Jobs

| Endpoint | Schedule | Time (IST) | Purpose |
|----------|----------|------------|---------|
| `/api/cron/daily-workflow` | `0 21 * * *` | 2:30 AM | Start workflow |
| `/api/cron/workflow-step` | `* * * * *` | Every minute | Execute steps |
| `/api/cron/daily-publish` | `30 21 * * *` | 3:00 AM | Publish edition |

## Key Files

- `src/app/actions-workflow-chained.ts` - Step functions
- `src/app/api/cron/daily-workflow/route.ts` - Start workflow cron
- `src/app/api/cron/workflow-step/route.ts` - Execute steps cron
- `src/app/api/cron/daily-publish/route.ts` - Publish cron
- `src/components/workflow-chain-executor.tsx` - Client executor (manual runs)
- `vercel.json` - Cron configuration

## Benefits of Hybrid Approach

✅ Manual runs get instant execution (5-8 min)
✅ Automated runs work without client (2:30 AM daily)
✅ Each step = separate function call (no timeout)
✅ Auto-publish at 3:00 AM IST
✅ Best of both worlds!
