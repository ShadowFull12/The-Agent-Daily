# Cron-Job.org Setup Guide

## Step 1: Wait for Vercel Deployment
1. Go to https://vercel.com/dashboard
2. Wait for your app to finish deploying (should succeed now without cron config)
3. Copy your app URL (e.g., `https://your-app.vercel.app`)

## Step 2: Generate a Secret Key
1. Open PowerShell and run:
   ```powershell
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```
2. Copy the output (this is your CRON_SECRET)

## Step 3: Add Secret to Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add new variable:
   - **Name**: `CRON_SECRET`
   - **Value**: (paste the secret from Step 2)
   - **Environment**: All (Production, Preview, Development)
3. Click **Save**
4. Redeploy your app (Settings → Deployments → Click latest → Redeploy)

## Step 4: Sign Up for Cron-Job.org
1. Go to https://console.cron-job.org/signup
2. Create a free account (email + password)
3. Verify your email
4. Log in to https://console.cron-job.org/jobs

## Step 5: Create Cron Job #1 - Daily Workflow (2:30 AM IST)
1. Click **"Create cronjob"**
2. Fill in the form:
   - **Title**: `Daily Workflow - 2:30 AM IST`
   - **Address (URL)**: `https://your-app.vercel.app/api/cron/daily-workflow`
     (Replace `your-app.vercel.app` with your actual Vercel URL)
   - **Schedule**:
     - Click "Extended"
     - Minutes: `30`
     - Hours: `21` (9 PM UTC = 2:30 AM IST)
     - Days: `*`
     - Months: `*`
     - Weekdays: `*`
   - **Request method**: `GET`
   - **Request timeout**: `60` seconds
   - **HTTP Headers** → Click "Add header":
     - Header: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET_HERE`
       (Replace with the secret from Step 2)
3. Click **"Create cronjob"**

## Step 6: Create Cron Job #2 - Workflow Step (Every Minute)
1. Click **"Create cronjob"** again
2. Fill in the form:
   - **Title**: `Workflow Step - Every Minute`
   - **Address (URL)**: `https://your-app.vercel.app/api/cron/workflow-step`
   - **Schedule**:
     - Click "Every minute"
   - **Request method**: `GET`
   - **Request timeout**: `60` seconds
   - **HTTP Headers** → Click "Add header":
     - Header: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET_HERE`
3. Click **"Create cronjob"**

## Step 7: Create Cron Job #3 - Daily Publish (3:00 AM IST)
1. Click **"Create cronjob"** again
2. Fill in the form:
   - **Title**: `Daily Publish - 3:00 AM IST`
   - **Address (URL)**: `https://your-app.vercel.app/api/cron/daily-publish`
   - **Schedule**:
     - Click "Extended"
     - Minutes: `30`
     - Hours: `21` (9:30 PM UTC = 3:00 AM IST)
     - Days: `*`
     - Months: `*`
     - Weekdays: `*`
   - **Request method**: `GET`
   - **Request timeout**: `60` seconds
   - **HTTP Headers** → Click "Add header":
     - Header: `Authorization`
     - Value: `Bearer YOUR_CRON_SECRET_HERE`
3. Click **"Create cronjob"**

## Step 8: Test Your Setup
1. Go back to cron-job.org dashboard
2. Find the "Workflow Step - Every Minute" job
3. Click the **"Execute now"** button (play icon)
4. Check if it shows success (green checkmark)
5. Go to your Mission Control and check if workflow is running

## Summary
You should now have 3 cron jobs:
- ✅ **Daily Workflow** - Runs at 2:30 AM IST daily
- ✅ **Workflow Step** - Runs every minute (only executes when workflow active)
- ✅ **Daily Publish** - Runs at 3:00 AM IST daily

## Troubleshooting

### If cron job shows error:
1. Check the error message in cron-job.org
2. Verify your Vercel URL is correct
3. Make sure CRON_SECRET is added to Vercel environment variables
4. Check Authorization header format: `Bearer YOUR_SECRET` (with space after Bearer)

### If workflow doesn't start:
1. Go to Mission Control
2. Click "Start Workflow" manually first to test
3. Check Vercel Function Logs (Vercel Dashboard → Project → Functions)

### View Execution History:
- In cron-job.org dashboard, click on any job to see execution history
- Shows success/failure for each run
- Shows response time and status code

## What Happens Now

**Every Day at 2:30 AM IST:**
1. Cron-job.org triggers `/api/cron/daily-workflow`
2. Workflow initializes (queue set to 'clear_data')
3. Every minute after that, workflow-step cron executes next step
4. ~9-10 minutes later, workflow completes

**Every Day at 3:00 AM IST:**
1. Cron-job.org triggers `/api/cron/daily-publish`
2. Latest edition gets published

**Manual Runs (Anytime):**
- Click "Start Workflow" in Mission Control
- Client executor provides instant step execution
- ~5-8 minutes completion time

## Cost
**FREE!** ✅
- Vercel Hobby: Free
- Cron-Job.org: Free (up to 50 cron jobs)
- No credit card required for either
