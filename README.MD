# LinkNuke Server

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.17.1-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-5.13.2-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Paddle](https://img.shields.io/badge/Paddle-Payment-00A8E8?style=flat-square&logo=paddle)](https://paddle.com/)

Express.js backend for LinkNuke secure file sharing platform with JWT auth, Paddle payments, and self-destructing links.

## 🔗 LIVE APP

https://linknuke.whynotship.me

## 🌟 Core Features

- **JWT Authentication** with Google OAuth 2.0
- **Self-Destructing Links** with custom expiration
- **Paddle Payment System** with subscription tiers
- **Real-time Usage Tracking** and limits
- **Secure File Upload** via Cloudinary

## 🛠️ Tech Stack

- **Backend**: Node.js 18+, Express.js 4.17.1
- **Database**: MongoDB 5.13.2 with Mongoose 5.13.2
- **Auth**: JWT 8.5.1, Passport.js 0.7.0, Google OAuth
- **Payments**: @paddle/paddle-node-sdk 3.2.0
- **Security**: Helmet.js, bcryptjs, rate limiting

## 📁 Project Structure

```
Server/
├── app.js                 # Main Express app
├── controllers/           # Route handlers
├── models/               # MongoDB schemas
├── routes/               # API routes
├── middleware/           # Auth, validation, errors
├── utils/               # Helper functions
└── db/                  # Database connection
```

## ⚡ Technical Highlights

- **JWT + Session Authentication** for maximum security
- **Paddle Webhook Processing** for real-time payments
- **MongoDB Connection Pooling** for performance
- **Rate Limiting** with express-rate-limit
- **Comprehensive Error Handling** with custom error classes

## 🚀 Quick Start

```bash
npm install
npm run dev
```

## 📄 License

Proprietary software. All rights reserved.
