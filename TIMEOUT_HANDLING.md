# Phase 3 Timeout Handling System

## Problem
Vercel serverless functions have a 5-minute (300s) execution limit. Phase 3 (Editor) can occasionally take longer, causing timeouts and failed newspaper generation.

## Solution
Automatic timeout detection and resume system that monitors Phase 3 execution and switches to resume mode if it runs too long.

## How It Works

### 1. **Timeout Detection (Cron Job)**
The cron job (`/api/cron/workflow-step`) runs every minute and checks:
- If Phase 3 has been running for **230+ seconds** (3:50)
- If yes, automatically switches to `phase3_editor_resume` mode
- This happens BEFORE hitting Vercel's 300s limit

### 2. **Execution Flow**

#### Normal Flow (No Timeout):
```
Phase 3 starts → Records start time → Editor creates newspaper → Completes < 230s → Done
```

#### Timeout Flow:
```
Phase 3 starts → Records start time → Runs for 230s → Cron detects timeout
→ Switches to phase3_editor_resume → Next cron cycle → Editor resumes → Completes
```

### 3. **State Management**

**QueueState fields added:**
- `phase3StartTime`: Timestamp when Phase 3 started (for timeout detection)
- `partialHtml`: Partial HTML progress (for future incremental saving)
- `pagesCompleted`: Number of pages completed (for future incremental saving)

**WorkflowStep types added:**
- `phase3_editor`: Initial Phase 3 execution
- `phase3_editor_resume`: Resume after timeout

### 4. **Key Components**

#### `workflow-queue.ts`
- Added timeout tracking fields to `QueueState`
- Added `phase3_editor_resume` step type

#### `actions-workflow-chained.ts`
- `executePhase3_Editor()`: Records start time, handles timeout errors
- `executePhase3_EditorResume()`: Retries editor from beginning (clean retry)

#### `api/cron/workflow-step/route.ts`
- Monitors Phase 3 execution time every minute
- Auto-switches to resume mode at 230s threshold
- Logs warning at 115s (halfway point)

## Key Features

### ✅ **No Editor Prompt Changes**
- Editor prompt remains unchanged
- System handles timeout at infrastructure level

### ✅ **Automatic Recovery**
- Cron automatically detects long-running Phase 3
- Switches to resume mode without manual intervention

### ✅ **Clean State Management**
- Timeout tracking fields are preserved across cycles
- Cleared on completion or error

### ✅ **Logging & Visibility**
- Logs timeout warnings at 115s
- Logs timeout detection at 230s
- Shows elapsed time in cron responses

## Timeline

```
0s    - Phase 3 starts, records start time
115s  - Cron logs "approaching timeout" warning
230s  - Cron detects timeout, switches to resume mode
240s  - Next cron cycle, Phase 3 resume executes
...   - Editor completes (fresh attempt)
```

## Future Enhancements (Not Implemented Yet)

The infrastructure supports future incremental saving:
- Save partial HTML after each page
- Resume from last completed page
- Stitch together final HTML from parts

Currently, the system does a **clean retry** (restart editor from beginning) which is simpler and sufficient for most cases.

## Testing

To test timeout handling:
1. Run workflow normally
2. If Phase 3 takes > 230s, cron will auto-resume
3. Check logs for "TIMEOUT DETECTED" messages
4. Verify edition is created after resume

## Configuration

**Timeout Threshold**: 230 seconds (3:50)
- Set to give 70s buffer before Vercel's 300s limit
- Adjust in `workflow-step/route.ts` if needed:
```typescript
const PHASE3_TIMEOUT_THRESHOLD = 230 * 1000; // 230 seconds
```

## Error Handling

- Timeout errors in Phase 3 trigger auto-resume
- Other errors still go to error state
- Resume failures go to error state (won't loop forever)

## Summary

This system ensures newspaper generation never fails due to timeouts. The cron job monitors execution time and automatically triggers a resume if Phase 3 runs too long, all without changing the editor's behavior or prompts.
