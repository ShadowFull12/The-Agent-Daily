# Vercel Deployment Setup

## Environment Variables Required

Add these environment variables in your Vercel project settings:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

### Required Variables

| Variable Name | Description | Where to Get |
|--------------|-------------|--------------|
| `NEWSDATA_API_KEY` | NewsData.io API key for fetching news | [newsdata.io](https://newsdata.io/) |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI (Grok model) | [openrouter.ai](https://openrouter.ai/) |

### Optional Variables

| Variable Name | Description | Where to Get |
|--------------|-------------|--------------|
| `GEMINI_API_KEY` | Google Gemini API key (if using Gemini) | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `GOOGLE_GENAI_API_KEY` | Alternative Gemini key name | Same as above |

## Deployment Steps

1. **Connect Repository to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository

2. **Configure Environment Variables**
   - In project settings, add all required environment variables
   - Make sure to add them for **Production**, **Preview**, and **Development** environments

3. **Deploy**
   - Vercel will automatically deploy your application
   - The build process will use Next.js 15 with Turbopack

## Troubleshooting

### "Workflow started successfully" but nothing happens

Check the **Function Logs** in Vercel:
1. Go to your project dashboard
2. Click on the latest deployment
3. Navigate to the **Functions** tab
4. Look for detailed error messages in the logs

Common issues:
- **Missing environment variables**: Ensure all API keys are set
- **Firebase initialization errors**: Check that Firebase config in `src/firebase/config.ts` is correct
- **Function timeout**: Vercel free tier has 10s limit, Pro has 60s. This app is configured for 300s (requires Pro plan)

### Firebase Errors

If you see Firebase initialization errors:
- Ensure the Firebase config in `src/firebase/config.ts` matches your Firebase project
- No Firebase environment variables are needed since config is hardcoded

### API Key Issues

If scout or AI features fail:
- Verify `NEWSDATA_API_KEY` is correct
- Verify `OPENROUTER_API_KEY` is correct
- Check that you have sufficient quota/credits

## Vercel Plan Requirements

- **Hobby (Free)**: 10-second function timeout (may not be enough for full workflow)
- **Pro**: 60-second function timeout (recommended)
- **Enterprise**: 900-second function timeout

This app is configured for 300-second timeout, which works best on **Pro or Enterprise** plans.
