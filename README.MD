# LinkNuke Server

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.17.1-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5.13.2-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)

Express.js backend server for LinkNuke secure file sharing platform. Built with Node.js, Express, and MongoDB.

## Features

- **REST API**: Complete RESTful API for LinkNuke application
- **Authentication**: JWT-based authentication with Google OAuth integration
- **Payment Processing**: Paddle payment gateway integration
- **Database**: MongoDB with Mongoose ODM
- **Security**: Rate limiting, CORS, helmet, input validation
- **Email**: Nodemailer integration for notifications

## Technology Stack

### Core Framework

- **Node.js 18+** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling

### Authentication & Security

- **JWT** - JSON Web Tokens for authentication
- **Passport.js** - Authentication middleware
- **bcryptjs** - Password hashing
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing

### Payments & Integrations

- **Paddle SDK** - Payment processing
- **Google OAuth 2.0** - Social authentication
- **Nodemailer** - Email service

### Utilities

- **Joi** - Input validation
- **Day.js** - Date manipulation
- **Nanoid** - Unique ID generation

## Project Structure

```
src/
├── controllers/          # Route controllers
│   ├── auth.js          # Authentication logic
│   ├── linkController.js # Link management
│   ├── paddleController.js # Payment processing
│   └── paddle/          # Paddle-specific controllers
├── routes/              # API route definitions
│   ├── auth.js          # Authentication routes
│   ├── authRoutes.js    # OAuth routes
│   ├── linkRoutes.js    # Link CRUD routes
│   ├── paddleRoutes.js  # Payment routes
│   └── publicLinkRoutes.js # Public link access
├── models/              # MongoDB schemas
├── middleware/          # Custom middleware
├── errors/              # Error handling
├── utils/               # Utility functions
├── db/                  # Database connection
└── app.js              # Application entry point
```

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
   ```

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
