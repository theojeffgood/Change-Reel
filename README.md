# Change Reel

**Automated Git Commit Changelogs with AI-Powered Summaries**

Change Reel helps engineering teams, product managers, and stakeholders gain visibility into ongoing development without reading raw commit messages or diffs. It integrates with GitHub using secure OAuth, processes commits with AI, and delivers clear, professional updates via email or public changelog.

## 🚀 Features

- **AI-Powered Summaries**: Transforms technical git diffs into clear, business-friendly language
- **GitHub Integration**: Secure OAuth connection with real-time webhook processing
- **Flexible Distribution**: Email stakeholders or publish to a public changelog
- **Professional Templates**: Beautifully formatted updates that enhance team credibility
- **Zero Configuration**: Automatic setup with intelligent categorization
- **Secure & Private**: Your code stays private while enabling seamless automation

## 📋 Prerequisites

Before installing Change Reel, you need to create a GitHub OAuth App:

### GitHub OAuth App Setup

1. Go to [GitHub Developer Settings > OAuth Apps](https://github.com/settings/applications/new)
2. Create a new OAuth app with these settings:
   - **Application name**: `Change Reel - Git Commit Changelog`
   - **Homepage URL**: `http://localhost:3000` (for development)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
3. Save the **Client ID** and **Client Secret** for later

## 🛠️ Installation

### Local Development

```bash
# Clone the repository
git clone https://github.com/yourusername/wins-column.git
cd wins-column

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Configure your environment variables (see below)
```

### Environment Configuration

Create `.env.local` with your actual values:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here-min-32-chars

# GitHub OAuth (from the OAuth app you created)
OAUTH_CLIENT_ID=your-oauth-client-id
OAUTH_CLIENT_SECRET=your-oauth-client-secret

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Token Encryption (32+ characters required)
TOKEN_ENCRYPTION_KEY=your-secure-encryption-key-32-chars-min
```

### Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to configure your first repository.

## 🎯 How It Works

1. **Connect Repository**: Link your GitHub repository via secure OAuth
2. **Configure Webhooks**: Automatic webhook setup for real-time processing  
3. **AI Processing**: Each commit is analyzed and summarized using OpenAI
4. **Smart Distribution**: Updates are sent via email or published to changelog
5. **Professional Results**: Stakeholders receive clear, actionable updates

## 🔧 Production Deployment

### AWS EC2 with Docker

```bash
# Copy environment template
cp env.production.template .env.production

# Configure production values in .env.production
# Deploy to EC2
./scripts/deploy-ec2.sh
```

### Docker Compose

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

## 📚 Configuration

### Repository Setup

1. Navigate to `/config`
2. Sign in with GitHub
3. Select your repository
4. Configure email recipients
5. Test webhook connection

### Email Configuration

Change Reel uses your email service provider to send updates. Configure SMTP settings in your environment file.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📖 API Documentation

### Health Check
```
GET /api/health
```

### Configuration
```
POST /api/config
GET /api/config
```

### Webhook Processing
```
POST /api/webhooks/github
```

### Admin Billing (requires ADMIN_EMAIL)

```
POST /api/admin/billing/adjust
Body: { "userId": "<uuid>", "amount": number, "description"?: string }
# Positive adds credits; negative debits. Returns { success, balance }

GET /api/admin/billing/transactions?userId=<uuid>&limit=50
Returns { userId, transactions: [{ id, amount, type, description, created_at }, ...] }
```

## 🛡️ Security

- OAuth tokens are encrypted using AES-256
- Webhook signatures are verified using HMAC-SHA256
- All API routes include proper authentication checks
- Database queries use parameterized statements
- CORS policies restrict unauthorized access

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Create an issue on GitHub for bugs or feature requests
- **Email**: Contact us at support@changereel.com

## 🗺️ Roadmap

- [ ] Slack integration
- [ ] Custom email templates
- [ ] Advanced analytics dashboard
- [ ] Multi-repository support
- [ ] API rate limiting controls
- [ ] Webhook retry mechanisms

---

**Change Reel** - Transform your development updates into professional communication.
