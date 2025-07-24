# OAuth Setup Guide for Change Reel

This guide explains how to set up GitHub OAuth for both development and production environments.

## 🚀 The Problem

When using ngrok for development, the URL changes every time you restart it. This breaks GitHub OAuth because the callback URL no longer matches what's configured in your GitHub OAuth app.

## ✅ Solution: Separate Development OAuth App

Create two separate GitHub OAuth apps:
1. **Production app** - uses your production domain
2. **Development app** - uses `localhost:3000` 

## 📋 Setup Instructions

### 1. Create Development OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/applications/new)
2. Create a new OAuth App with these settings:
   - **Application name**: `Change Reel (Development)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
   - **Application description**: `Development version of Change Reel`

3. Note down the **Client ID** and **Client Secret**

### 2. Update Your Local .env File

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# GitHub OAuth (Use DEV version for local development)
GITHUB_CLIENT_ID=your_development_github_client_id
GITHUB_CLIENT_SECRET=your_development_github_client_secret

# NextAuth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

### 3. Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to `http://localhost:3000/config`

3. Click "Connect with GitHub" - it should work without needing ngrok!

## 🌐 When You Need ngrok

You only need ngrok for **webhook testing** (when GitHub needs to send webhooks to your local machine). For OAuth, you can use localhost directly.

### Option A: Use Both (Recommended)
- **OAuth**: Use localhost (`http://localhost:3000`) 
- **Webhooks**: Use ngrok for receiving GitHub webhooks

### Option B: ngrok Static Domain (Paid)
If you have ngrok Pro/Team:
```bash
# Get a static domain (one-time setup)
ngrok authtoken your_auth_token
ngrok http 3000 --domain=your-static-domain.ngrok.io
```

## 🔧 Production Setup

For production, create a separate OAuth app:
- **Application name**: `Change Reel (Production)`
- **Homepage URL**: `https://your-production-domain.com`
- **Authorization callback URL**: `https://your-production-domain.com/api/auth/callback/github`

Update your production environment variables:
```bash
GITHUB_CLIENT_ID=your_production_github_client_id
GITHUB_CLIENT_SECRET=your_production_github_client_secret
NEXTAUTH_URL=https://your-production-domain.com
```

## 🎯 Next Steps

1. Create the development OAuth app
2. Update your `.env` file with the development credentials
3. Test the OAuth flow at `http://localhost:3000/config`
4. For webhook testing, you can still use ngrok temporarily

This approach gives you a stable development environment without the ngrok URL changing issues! 