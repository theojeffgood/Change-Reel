# Change Reel

A SaaS tool that automatically generates and publishes plain-English summaries of Git commit diffs. These summaries are distributed via email or posted to a publicly accessible changelog webpage.

## Overview

Change Reel helps engineering teams, product managers, and stakeholders gain visibility into ongoing development without reading raw commit messages or diffs. It integrates with GitHub using secure OAuth authentication to automatically process commits and generate human-readable summaries using AI.

## Key Features

- **Secure GitHub OAuth Integration**: Safe and secure repository access without manual token management
- **AI-Powered Summaries**: Uses OpenAI API to generate natural language summaries of code changes
- **Repository Selection**: Choose which repositories to monitor through an intuitive configuration interface
- **Multiple Distribution Methods**: Email notifications via Resend or public changelog pages
- **Change Type Detection**: Automatically categorizes changes as features, fixes, refactors, or chores
- **Admin Panel**: Review and manage generated summaries with manual publishing options
- **Enterprise Security**: Encrypted token storage with comprehensive security auditing

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, App Router
- **Backend**: Next.js API Routes with NextAuth.js for OAuth
- **Database**: Supabase (PostgreSQL) with encrypted token storage
- **Authentication**: GitHub OAuth 2.0 with NextAuth.js
- **AI**: OpenAI GPT-4 Turbo
- **Email**: Resend
- **Deployment**: Docker on AWS EC2

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm or yarn
- Git
- A GitHub account for OAuth integration

### GitHub OAuth App Setup

Before installing Change Reel, you need to create a GitHub OAuth App:

1. **Go to GitHub Settings**:
   - Navigate to [GitHub Developer Settings](https://github.com/settings/developers)
   - Click "OAuth Apps" → "New OAuth App"

2. **Configure your OAuth App**:
   - **Application name**: `Change Reel - Git Commit Changelog`
   - **Homepage URL**: `http://localhost:3000` (for development)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
   - **Application description**: `Automated changelog generation for Git repositories`

3. **Required OAuth Scopes**:
   - `repo` - Access to repository data
   - `write:repo_hook` - Create webhooks for automatic processing
   - `user:email` - Access to user email for notifications

4. **Save your credentials**:
   - Copy the **Client ID** and **Client Secret** for the next step

### Installation

1. **Clone the repository**:
```bash
git clone https://github.com/theojeffgood/Change-Reel.git
cd change-reel
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables**:
```bash
cp .env.example .env.local
```

4. **Configure your environment variables in `.env.local`**:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Configuration
OPENAI_API_KEY=your_openai_api_key

# Email Configuration (Optional)
RESEND_API_KEY=your_resend_api_key

# GitHub OAuth Configuration (Required)
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret

# NextAuth Configuration (Required)
NEXTAUTH_SECRET=your_nextauth_secret_key_32chars_min
NEXTAUTH_URL=http://localhost:3000

# Security Configuration (Required)
TOKEN_ENCRYPTION_KEY=change-reel-secure-encryption-key-2024-v1-production-grade!!
```

> **Security Note**: The `TOKEN_ENCRYPTION_KEY` must be at least 32 characters long. Use a strong, unique key for production deployments.

5. **Run the development server**:
```bash
npm run dev
```

6. **Complete OAuth Setup**:
   - Open [http://localhost:3000/config](http://localhost:3000/config) in your browser
   - Click "Connect with GitHub" to authenticate
   - Select the repositories you want to monitor
   - Configure email recipients for changelog notifications

### Configuration

After OAuth authentication, use the configuration interface at `/config` to:

- **Repository Selection**: Choose which repositories to monitor for changes
- **Email Recipients**: Set up who receives changelog notifications  
- **Webhook Management**: Automatic webhook creation for selected repositories
- **Security Review**: Monitor OAuth token status and security logs

## Development

### Available Scripts

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── config/         # OAuth configuration interface
│   └── api/            # API routes and authentication
├── components/          # React components
│   └── providers/      # Authentication providers
├── lib/                # Utility libraries and configurations
│   ├── auth/           # OAuth and security services
│   ├── supabase/       # Database integration
│   └── validation/     # Input validation services
├── utils/               # Helper functions
└── __tests__/           # Test files and fixtures
```

### Security Features

- **Encrypted Token Storage**: OAuth tokens are encrypted using AES-256-CBC before database storage
- **Security Audit Logging**: All token operations are logged for security monitoring
- **Automatic Token Rotation**: Built-in support for OAuth token refresh and rotation
- **Request Validation**: Comprehensive input validation for all user inputs
- **Environment Isolation**: Sensitive configuration isolated in environment variables

## Features

### Current Implementation

- **GitHub OAuth Integration**: Secure repository access with automatic token management
- **Repository Configuration**: Select and configure multiple repositories through web interface
- **Webhook Integration**: Automatic webhook creation for real-time commit processing
- **Commit Analysis**: AI-powered analysis and summarization of code changes
- **Email Distribution**: Automated changelog distribution via email
- **Security Monitoring**: Comprehensive audit logging and token security

### Roadmap

- **Public Changelog Pages**: Web-accessible changelog pages for each repository
- **Advanced Admin Dashboard**: Enhanced repository and user management
- **Team Collaboration**: Multi-user support with role-based permissions
- **Custom Email Templates**: Branded and customizable email notifications
- **API Access**: REST API for third-party integrations

## Troubleshooting

### OAuth Issues

- **"Callback URL mismatch"**: Ensure your OAuth app callback URL is exactly `http://localhost:3000/api/auth/callback/github`
- **"Invalid client"**: Verify your `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correct
- **"Token storage failed"**: Check that `TOKEN_ENCRYPTION_KEY` is at least 32 characters long

### Database Issues

- **"oauth_tokens table does not exist"**: Apply the database migration in your Supabase dashboard
- **Connection errors**: Verify your Supabase URL and keys are correct

### General Setup

- **Environment variables**: Ensure all required environment variables are set
- **Port conflicts**: Change the port if 3000 is already in use: `npm run dev -- -p 3001`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes with tests
4. Run `npm run lint` and `npm run format`
5. Submit a pull request

## License

[Add your license information here]
