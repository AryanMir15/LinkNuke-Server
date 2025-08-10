# Google OAuth Backend URL Update Guide

## ✅ **Changes Made**

### 1. **Fixed Server Routes** (`Server/routes/authRoutes.js`)

- **Fixed syntax error** in router declaration
- **Updated hardcoded URLs** to use environment variables:
  - `failureRedirect`: Now uses `${process.env.FRONTEND_URL}/login`
  - `successRedirect`: Now uses `${process.env.FRONTEND_URL}/oauth-success?token=${token}`

### 2. **Updated Frontend** (`Client/src/Auth/Register.jsx`)

- **Replaced hardcoded backend URL** with environment variable:
  - Old: `"https://linkbolt-server-production-969c.up.railway.app/auth/google"`
  - New: `${import.meta.env.VITE_API_URL}/auth/google`

## 🔧 **Environment Variables Required**

### **Server Environment Variables** (`.env` file in Server folder)

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:5173

# For Production
# FRONTEND_URL=https://yourdomain.com
# GOOGLE_CALLBACK_URL=https://yourdomain.com/api/v1/auth/google/callback
```

### **Client Environment Variables** (`.env` file in Client folder)

```env
# API URL
VITE_API_URL=http://localhost:5000/api/v1

# For Production
# VITE_API_URL=https://yourdomain.com/api/v1
```

## 🌐 **Google OAuth Console Setup**

### 1. **Update Authorized Redirect URIs**

Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials:

**For Development:**

```
http://localhost:5000/api/v1/auth/google/callback
```

**For Production:**

```
https://yourdomain.com/api/v1/auth/google/callback
```

### 2. **Update Authorized JavaScript Origins**

**For Development:**

```
http://localhost:5173
```

**For Production:**

```
https://yourdomain.com
```

## 🚀 **Testing the OAuth Flow**

### 1. **Start Your Servers**

```bash
# Terminal 1 - Start Backend
cd Server
npm start

# Terminal 2 - Start Frontend
cd Client
npm run dev
```

### 2. **Test OAuth Login**

1. Go to `http://localhost:5173/login`
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Should redirect to `http://localhost:5173/oauth-success?token=...`

## 🔄 **Production Deployment**

### **Railway/Heroku/Vercel**

Update your environment variables in your hosting platform:

**Backend Environment Variables:**

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-backend-domain.com/api/v1/auth/google/callback
FRONTEND_URL=https://your-frontend-domain.com
```

**Frontend Environment Variables:**

```env
VITE_API_URL=https://your-backend-domain.com/api/v1
```

### **Update Google OAuth Console for Production**

1. Add your production domain to **Authorized JavaScript Origins**
2. Add your production callback URL to **Authorized Redirect URIs**
3. Remove development URLs if not needed

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **"Invalid redirect_uri" Error**

   - Check that your callback URL in Google Console matches exactly
   - Ensure no trailing slashes mismatch

2. **"Origin not allowed" Error**

   - Add your frontend domain to Authorized JavaScript Origins
   - Include both `http://` and `https://` versions if needed

3. **Environment Variables Not Loading**

   - Restart your server after updating `.env` files
   - Check that variable names match exactly (case-sensitive)

4. **CORS Issues**
   - Ensure your backend CORS configuration includes your frontend domain
   - Check that credentials are properly configured

## 📋 **Complete OAuth Flow**

1. **User clicks "Sign in with Google"** → `VITE_API_URL/auth/google`
2. **Google OAuth redirects to** → `GOOGLE_CALLBACK_URL`
3. **Server processes OAuth** → Creates JWT token
4. **Server redirects to** → `FRONTEND_URL/oauth-success?token=...`
5. **Frontend handles token** → Stores in localStorage, redirects to dashboard

## 🎯 **Next Steps**

1. **Update your `.env` files** with the correct URLs
2. **Update Google OAuth Console** with your domains
3. **Test the OAuth flow** in development
4. **Deploy to production** and update production environment variables
5. **Test production OAuth flow**

Your Google OAuth is now properly configured with environment variables! 🚀
