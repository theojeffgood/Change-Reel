# Change Reel

A SaaS tool that automatically generates and publishes plain-English summaries of Git commit diffs. These summaries are distributed via email or posted to a publicly accessible changelog webpage.

## Overview

Change Reel helps engineering teams, product managers, and stakeholders gain visibility into ongoing development without reading raw commit messages or diffs. It integrates with GitHub to automatically process commits and generate human-readable summaries using AI.

## Key Features

- **Git Integration**: GitHub webhook integration for automatic commit processing
- **AI-Powered Summaries**: Uses OpenAI API to generate natural language summaries of code changes
- **Multiple Distribution Methods**: Email notifications via Resend or public changelog pages
- **Change Type Detection**: Automatically categorizes changes as features, fixes, refactors, or chores
- **Admin Panel**: Review and manage generated summaries with manual publishing options

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, App Router
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI GPT-4 Turbo
- **Email**: Resend
- **Deployment**: Docker on AWS EC2

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm or yarn
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd change-reel
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure your environment variables in `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
RESEND_API_KEY=your_resend_api_key
GITHUB_TOKEN=your_github_token
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

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
├── components/          # React components
├── lib/                 # Utility libraries and configurations
├── utils/               # Helper functions
└── styles/              # Additional stylesheets
```

## MVP Scope

The current MVP focuses on:
- Single repository configuration via environment variables
- GitHub webhook integration
- Commit diff analysis and summarization
- Email distribution
- Basic admin interface

Post-MVP features will include:
- GitHub OAuth authentication
- Multi-repository support
- Advanced user dashboard
- Enhanced admin features

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

[Add your license information here]
