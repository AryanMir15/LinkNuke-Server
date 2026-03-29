# LinkNuke Server

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.17.1-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5.13.2-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Paddle](https://img.shields.io/badge/Paddle-Payment-00A8E8?style=flat-square&logo=paddle)](https://paddle.com/)

Express.js backend server for LinkNuke secure file sharing platform. Built with Node.js, Express, MongoDB, and Paddle payment integration. Provides RESTful API for self-destructing links, user authentication, and subscription management.

## 🌟 Features

### 🔐 Authentication & Security

- **JWT Authentication** - Secure token-based authentication
- **Google OAuth 2.0** - Social authentication integration
- **Password Security** - bcrypt hashing with salt rounds
- **Session Management** - Secure session handling with MongoDB store
- **Rate Limiting** - API abuse prevention and DDoS protection
- **Input Validation** - Joi schema validation throughout
- **XSS Protection** - Content Security Policy and sanitization

### 💰 Payment & Subscriptions

- **Paddle Integration** - Complete payment processing system
- **Subscription Management** - Free/Pro/Lifetime tier system
- **Webhook Handling** - Real-time payment notifications
- **Usage Tracking** - Monitor link creation and storage limits
- **Refund System** - Automated refund processing and eligibility
- **Plan Upgrades** - Seamless subscription changes

### 📁 File & Link Management

- **Self-Destructing Links** - Auto-deletion after viewing
- **Multiple File Formats** - Text, image, video, audio, document support
- **Cloudinary Integration** - Optimized file storage and delivery
- **View Limiting** - Control access count per link
- **Custom Expiration** - Hours, days, weeks expiration options
- **Real-time Status** - Live link status tracking

### 🛡️ Security & Performance

- **Helmet.js** - Security headers and CSP configuration
- **CORS Configuration** - Cross-origin resource sharing
- **Error Handling** - Comprehensive error middleware
- **API Documentation** - Swagger/OpenAPI integration
- **Monitoring** - Request logging and performance tracking
- **Data Validation** - Server-side input sanitization

## 🛠️ Technology Stack

### Core Framework

- **Node.js 18+** - JavaScript runtime environment
- **Express.js 4.17.1** - Web application framework
- **MongoDB 5.13.2** - NoSQL database
- **Mongoose 5.13.2** - MongoDB object modeling and validation

### Authentication & Security

- **JWT 8.5.1** - JSON Web Tokens for authentication
- **Passport.js 0.7.0** - Authentication middleware
- **Google OAuth 2.0** - Social authentication
- **bcryptjs 2.4.3** - Password hashing
- **Helmet 4.6.0** - Security headers
- **CORS 2.8.5** - Cross-origin resource sharing
- **express-rate-limit 5.3.0** - API rate limiting
- **xss-clean 0.1.1** - XSS protection

### Payments & Business Logic

- **@paddle/paddle-node-sdk 3.2.0** - Payment processing
- **Webhook handling** - Real-time subscription updates
- **Subscription management** - Tier-based access control

### Communication & Utilities

- **Nodemailer 7.0.5** - Email service integration
- **Joi 17.4.0** - Input validation and sanitization
- **Day.js 1.11.13** - Date manipulation and formatting
- **Nanoid 5.1.5** - Secure unique ID generation
- **express-session 1.18.1** - Session management
- **connect-mongo 5.1.0** - MongoDB session store

### Development & Documentation

- **Swagger UI 4.1.6** - API documentation
- **Nodemon 2.0.9** - Development auto-restart
- **YAML.js** - Configuration management
- **Docker** - Containerization support

## 📁 Project Structure

```
Server/
├── app.js                      # Main Express application
├── package.json               # Dependencies and scripts
├── controllers/                # Route handlers
│   ├── paddleController.js    # Payment processing
│   ├── authController.js      # Authentication logic
│   ├── linkController.js      # Link management
│   └── paddle/                # Paddle-specific handlers
│       └── webhookController.js
├── models/                     # Database schemas
│   ├── User.js                # User model with subscriptions
│   └── Link.js               # Link model with metadata
├── routes/                     # API route definitions
│   ├── auth.js                # Authentication routes
│   ├── authRoutes.js          # Google OAuth routes
│   ├── linkRoutes.js          # Link CRUD operations
│   ├── publicLinkRoutes.js    # Public link access
│   └── paddleRoutes.js        # Payment webhooks
├── middleware/                 # Express middleware
│   ├── auth.js                # Authentication middleware
│   ├── subscription.js        # Subscription validation
│   ├── error-handler.js      # Global error handling
│   └── not-found.js           # 404 handling
├── utils/                      # Helper functions
│   ├── passportConfig.js      # Passport.js configuration
│   ├── subscriptionUtils.js   # Subscription helpers
│   ├── sendVerificationPin.js # Email verification
│   ├── sendResetEmail.js      # Password reset
│   └── refundUtils.js         # Refund processing
├── errors/                     # Custom error classes
│   ├── bad-request.js         # 400 errors
│   ├── unauthorized.js        # 401 errors
│   ├── forbidden.js           # 403 errors
│   ├── not-found.js           # 404 errors
│   └── custom-api.js          # Custom API errors
├── db/                         # Database configuration
│   └── connect.js              # MongoDB connection
├── tests/                      # Test files
│   └── refund.test.js         # Refund system tests
├── docs/                       # Documentation
│   └── REFUND_SYSTEM.md       # Refund policy docs
├── Dockerfile                  # Container configuration
├── fly.toml                    # Fly.io deployment
└── vercel.json                 # Vercel deployment
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB 5.0+
- Paddle account (for payments)
- Email service (for notifications)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd LinkNuke/Server
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment configuration**
   Create `.env` file:

   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/linknuke

   # JWT
   JWT_SECRET=your_jwt_secret_key
   JWT_EXPIRE=7d

   # Paddle Payment System
   PADDLE_API_KEY=your_paddle_api_key
   PADDLE_PRO_PRICE_ID=pro_price_id
   PADDLE_LIFETIME_PRICE_ID=lifetime_price_id
   PADDLE_WEBHOOK_SECRET=webhook_secret

   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # Email Service
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password

   # Application
   NODE_ENV=development
   CLIENT_URL=http://localhost:5173
   PORT=3001
   ```

4. **Start development server**

   ```bash
   npm run dev
   ```

5. **Start production server**
   ```bash
   npm start
   ```

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development with nodemon

## 🔧 Configuration

### Database Configuration

- **MongoDB Connection** - Mongoose with connection pooling
- **Schema Validation** - Mongoose schemas with custom validators
- **Indexing** - Optimized queries with proper indexes

### Authentication Setup

- **JWT Configuration** - Token generation and validation
- **Passport.js** - Strategy configuration for OAuth
- **Session Store** - MongoDB-based session persistence

### Payment Configuration

- **Paddle SDK** - Payment gateway integration
- **Webhook Security** - Signature verification
- **Subscription Plans** - Tier configuration and limits

## 📊 Database Schema

### User Model

```javascript
{
  firstName: String (required, 3-50 chars),
  lastName: String (required, 3-50 chars),
  email: String (required, unique, email validation),
  password: String (required, 6+ chars, bcrypt hashed),
  subscription: {
    plan: String (free/pro/lifetime),
    status: String (active/cancelled/refunded),
    usageLimits: { links: Number, customDomains: Number },
    endDate: Date,
    startDate: Date,
    paddleCustomerId: String,
    paddleSubscriptionId: String
  },
  usage: {
    linksCreated: Number,
    storageUsed: Number
  },
  isEmailVerified: Boolean,
  emailVerificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date
}
```

### Link Model

```javascript
{
  title: String (required),
  format: String (enum: text/image/video/audio/document),
  url: String (required),
  imageUrl: String,
  videoUrl: String,
  audioUrl: String,
  documentUrl: String,
  maxViews: Number (default: 1),
  currentViews: Number (default: 0),
  expiresAt: Date,
  isDeleted: Boolean (default: false),
  linkId: String (unique, auto-generated),
  createdBy: ObjectId (ref: User),
  extraSecure: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 🛡️ Security Features

### Authentication & Authorization

- **JWT Tokens** - Secure stateless authentication
- **Password Hashing** - bcrypt with salt rounds
- **Session Security** - Secure cookie configuration
- **Rate Limiting** - Prevent API abuse and brute force
- **Input Validation** - Joi schemas for all inputs

### Data Protection

- **XSS Prevention** - Input sanitization and CSP
- **SQL Injection** - NoSQL injection prevention
- **CSRF Protection** - SameSite cookie configuration
- **HTTPS Enforcement** - Secure data transmission

### API Security

- **CORS Configuration** - Origin whitelisting
- **Helmet.js** - Security headers
- **Request Validation** - Schema validation
- **Error Sanitization** - Safe error responses

## 💰 Payment System

### Paddle Integration

- **Payment Processing** - Secure checkout integration
- **Subscription Management** - Automated subscription handling
- **Webhook Processing** - Real-time payment notifications
- **Refund System** - Automated refund eligibility and processing

### Subscription Tiers

- **Free Plan** - 5 links/month, 1 custom domain
- **Pro Plan** - 500 links/month, 3 custom domains
- **Lifetime Plan** - 9999 links, 10 custom domains

### Usage Tracking

- **Real-time Monitoring** - Link creation and usage tracking
- **Limit Enforcement** - Automatic limit checking
- **Upgrade Prompts** - Smart upgrade suggestions

## 📡 API Endpoints

### Authentication Routes (`/api/v1/auth`)

- `POST /register` - User registration
- `POST /login` - User login
- `POST /forgot-password` - Password reset request
- `POST /reset-password` - Password reset confirmation
- `GET /verify` - Token verification
- `POST /verify-email` - Email verification

### Google OAuth (`/api/v1/auth/google`)

- `GET /` - Google OAuth redirect
- `GET /callback` - OAuth callback handler

### Link Management (`/api/v1/links`)

- `POST /` - Create new link
- `GET /` - Get user links (authenticated)
- `GET /:id` - Get link details
- `DELETE /:id` - Delete link
- `GET /stats` - Usage statistics

### Public Access (`/api/v1/public`)

- `GET /links/:linkId` - Access self-destructing link
- `GET /links/:linkId/view` - Increment view count

### Payment Processing (`/api/v1/paddle`)

- `GET /subscription-status` - Get subscription status
- `POST /checkout` - Initiate payment
- `POST /webhook` - Paddle webhook handler

## 🔄 Middleware Stack

### Authentication Middleware

- JWT token validation
- User session management
- Subscription status checking

### Error Handling

- Global error handler
- Custom error classes
- Consistent error responses
- Error logging and monitoring

### Security Middleware

- Rate limiting
- CORS configuration
- Security headers
- Input sanitization

## 📧 Email Services

### Email Templates

- **Welcome Email** - User registration confirmation
- **Password Reset** - Secure password recovery
- **Email Verification** - Account verification
- **Subscription Updates** - Plan changes and notifications

### Email Configuration

- **SMTP Setup** - Gmail/SMTP integration
- **Template System** - Dynamic email templates
- **Queue Management** - Email delivery tracking

## 🐳 Deployment

### Docker Deployment

```bash
# Build image
docker build -t linknuke-server .

# Run container
docker run -p 3001:3001 linknuke-server
```

### Fly.io Deployment

```bash
# Login to Fly
fly auth login

# Deploy
fly deploy
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables

- Configure all required environment variables
- Set up MongoDB connection string
- Configure payment processor keys
- Set up email service credentials

## 📈 Monitoring & Logging

### Request Logging

- **Morgan Logging** - HTTP request logging
- **Error Tracking** - Comprehensive error logging
- **Performance Metrics** - Response time monitoring
- **API Analytics** - Usage statistics

### Health Checks

- **Database Health** - MongoDB connection status
- **Service Health** - Application health monitoring
- **Payment Health** - Payment processor status

## 🧪 Testing

### Test Structure

- **Unit Tests** - Controller and utility testing
- **Integration Tests** - API endpoint testing
- **Payment Tests** - Webhook and payment testing

### Test Coverage

- **Authentication** - Login, registration, OAuth
- **Link Management** - CRUD operations
- **Payment System** - Subscription and refund testing
- **Error Handling** - Edge cases and error scenarios

## 📚 API Documentation

### Swagger Integration

- **Interactive Documentation** - Swagger UI interface
- **Endpoint Documentation** - Complete API reference
- **Schema Documentation** - Request/response models
- **Testing Interface** - Direct API testing

### Documentation Features

- **Authentication Examples** - JWT and OAuth examples
- **Error Responses** - Standardized error formats
- **Rate Limiting** - Usage guidelines and limits

## 🔧 Development Tools

### Code Quality

- **ESLint Configuration** - Code linting and formatting
- **Prettier Integration** - Code formatting
- **Git Hooks** - Pre-commit validation
- **TypeScript Support** - Type definitions

### Development Workflow

- **Hot Reload** - Nodemon auto-restart
- **Environment Management** - Development/staging/production
- **Database Seeding** - Sample data generation
- **API Testing** - Postman collection included

## 🌐 API Rate Limiting

### Rate Limit Configuration

- **Authentication** - 5 requests per minute
- **Link Creation** - 10 requests per minute
- **Public Access** - 100 requests per minute
- **Payment Webhooks** - No rate limiting

### Rate Limit Features

- **Sliding Window** - Fair rate limiting
- **IP-based Tracking** - Per-IP limits
- **User-based Limits** - Authenticated user limits
- **Custom Responses** - Rate limit exceeded messages

## 🔍 Error Handling

### Custom Error Classes

- **BadRequest** - 400 Bad Request
- **Unauthorized** - 401 Unauthorized
- **Forbidden** - 403 Forbidden
- **NotFound** - 404 Not Found
- **CustomAPIError** - Application-specific errors

### Error Features

- **Consistent Format** - Standardized error responses
- **Error Logging** - Comprehensive error tracking
- **Client Safety** - Sanitized error messages
- **Debug Information** - Development error details

## 📊 Performance Optimization

### Database Optimization

- **Indexing Strategy** - Optimized query performance
- **Connection Pooling** - Efficient database connections
- **Query Optimization** - Efficient MongoDB queries
- **Caching Strategy** - Response caching where appropriate

### API Performance

- **Response Compression** - Gzip compression
- **Request Validation** - Early request validation
- **Async Processing** - Non-blocking operations
- **Memory Management** - Efficient memory usage

## 🔄 Webhook Processing

### Paddle Webhooks

- **Signature Verification** - Secure webhook validation
- **Event Processing** - Real-time subscription updates
- **Error Handling** - Webhook failure recovery
- **Idempotency** - Prevent duplicate processing

### Webhook Events

- **Payment Success** - Subscription activation
- **Payment Failed** - Subscription cancellation
- **Subscription Updated** - Plan changes
- **Refund Processed** - Refund handling

## 📈 Analytics & Metrics

### Usage Analytics

- **Link Creation** - Track link creation patterns
- **User Activity** - Monitor user engagement
- **Subscription Metrics** - Plan conversion tracking
- **Performance Metrics** - API performance monitoring

### Business Intelligence

- **Revenue Tracking** - Subscription revenue analytics
- **User Growth** - User acquisition metrics
- **Feature Usage** - Product feature adoption
- **Churn Analysis** - Subscription cancellation patterns

## 🤝 Contributing

### Development Guidelines

- **Code Style** - ESLint and Prettier configuration
- **Commit Messages** - Conventional commit format
- **Branch Strategy** - Git flow workflow
- **Pull Requests** - Code review process

### Testing Requirements

- **Unit Tests** - Function-level testing
- **Integration Tests** - API endpoint testing
- **Security Tests** - Vulnerability testing
- **Performance Tests** - Load and stress testing

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Check the API documentation
- Review the troubleshooting guide
- Contact the development team

---

**LinkNuke Server** - Secure, scalable backend for privacy-first file sharing. 🚀
src/
├── controllers/ # Route controllers
│ ├── auth.js # Authentication logic
│ ├── linkController.js # Link management
│ ├── paddleController.js # Payment processing
│ └── paddle/ # Paddle-specific controllers
├── routes/ # API route definitions
│ ├── auth.js # Authentication routes
│ ├── authRoutes.js # OAuth routes
│ ├── linkRoutes.js # Link CRUD routes
│ ├── paddleRoutes.js # Payment routes
│ └── publicLinkRoutes.js # Public link access
├── models/ # MongoDB schemas
├── middleware/ # Custom middleware
├── errors/ # Error handling
├── utils/ # Utility functions
├── db/ # Database connection
└── app.js # Application entry point

````

## Installation

1. **Prerequisites**
   - Node.js 18+
   - MongoDB database
   - Paddle account (for payments)
   - Google OAuth credentials

2. **Clone and Install**

   ```bash
   git clone <repository-url>
   cd linknuke/server
   npm install
````

3. **Environment Configuration**
   Create `.env` file:

   ```env
   # Database
   MONGO_URI=mongodb://localhost:27017/linknuke

   # JWT
   JWT_SECRET=your_jwt_secret
   JWT_LIFETIME=7d

   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

   # Paddle Payments
   PADDLE_ENV=sandbox
   PADDLE_VENDOR_ID=your_vendor_id
   PADDLE_API_KEY=your_api_key
   PADDLE_WEBHOOK_SECRET=your_webhook_secret
   PADDLE_CLIENT_TOKEN=your_client_token

   # Email
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password

   # URLs
   FRONTEND_URL=http://localhost:5173
   CLIENT_URL=http://localhost:5173

   # Session
   SESSION_SECRET=your_session_secret

   # Server
   PORT=5000
   ```

4. **Development**
   ```bash
   npm run dev     # Start with nodemon (auto-restart)
   npm start       # Production start
   ```

## API Endpoints

### Authentication

- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/google` - Google OAuth initiation
- `GET /api/v1/auth/google/callback` - OAuth callback

### Links

- `POST /api/v1/links` - Create new link
- `GET /api/v1/links` - Get user links
- `GET /api/v1/links/:id` - Get specific link
- `PATCH /api/v1/links/:id` - Update link
- `DELETE /api/v1/links/:id` - Delete link

### Payments

- `POST /api/v1/paddle/webhook` - Payment webhook
- `GET /api/v1/paddle/subscription` - Get subscription status
- `POST /api/v1/paddle/cancel` - Cancel subscription

### Public Access

- `GET /api/v1/public/links/:id` - Access public link
- `POST /api/v1/public/links/:id/access` - Record link access

## Database Models

### User Model

- Email validation and uniqueness
- Password hashing with bcrypt
- OAuth integration fields
- Subscription and payment tracking

### Link Model

- Secure link generation
- Access tracking and analytics
- Expiration and self-destruct functionality
- File attachment support

## Security Features

- **Rate Limiting**: Request throttling to prevent abuse
- **Input Validation**: Joi schema validation for all inputs
- **CORS Configuration**: Controlled cross-origin access
- **Security Headers**: Helmet.js security middleware
- **XSS Protection**: Input sanitization
- **Session Security**: Secure session management with MongoDB store

## Deployment

### Environment Variables

Ensure all environment variables are properly configured for production:

- Database connection strings
- OAuth credentials
- Payment gateway keys
- Email service credentials
- Secure secrets and tokens

### Production Checklist

- [ ] Environment variables configured
- [ ] MongoDB connection tested
- [ ] OAuth credentials verified
- [ ] Payment webhooks configured
- [ ] HTTPS enabled
- [ ] Rate limiting tuned
- [ ] Error logging configured

### Supported Platforms

- **Railway** - Full-stack deployment
- **Render** - Cloud application hosting
- **Fly.io** - Global deployment
- **Docker** - Containerized deployment

## Development

### Scripts

- `npm run dev` - Development server with auto-reload
- `npm start` - Production server
- `npm test` - Run test suite (if configured)

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/name`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push branch (`git push origin feature/name`)
5. Open pull request

## License

Proprietary software. All rights reserved.

## Support

For technical support or feature requests, please contact the development team.
