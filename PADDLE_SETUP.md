# Paddle Integration Setup Guide

This guide will help you set up Paddle payments for your LinkNuke SaaS application.

## Prerequisites

1. A Paddle account (https://paddle.com)
2. Your application deployed and accessible via HTTPS
3. Environment variables configured

## Step 1: Paddle Dashboard Setup

### 1.1 Create Products and Prices

1. Log into your Paddle dashboard
2. Go to **Catalog** → **Products**
3. Create three products:
   - **Starter Plan** ($9/month)
   - **Pro Plan** ($19/month)
   - **Lifetime Plan** ($59 one-time)

### 1.2 Get Price IDs

For each product, note down the Price IDs (they start with `pri_`). You'll need these for your environment variables.

### 1.3 Configure Webhooks

1. Go to **Developer Tools** → **Webhooks**
2. Add a new webhook endpoint: `https://yourdomain.com/api/v1/paddle/webhook`
3. Select these events:
   - `transaction.completed`
   - `subscription.created`
   - `subscription.updated`
   - `subscription.cancelled`
   - `subscription.paused`
4. Copy the webhook secret

## Step 2: Environment Variables

Add these variables to your `.env` file:

```env
# Paddle Configuration
PADDLE_ENV=sandbox  # or 'production'
PADDLE_API_KEY=your_paddle_api_key
PADDLE_WEBHOOK_SECRET=your_webhook_secret

# Paddle Price IDs
PADDLE_STARTER_PRICE_ID=pri_01hxxxxx
PADDLE_PRO_PRICE_ID=pri_01hxxxxx
PADDLE_LIFETIME_PRICE_ID=pri_01hxxxxx

# Client URL (for redirects)
CLIENT_URL=https://yourdomain.com
```

## Step 3: Testing

### 3.1 Sandbox Testing

1. Set `PADDLE_ENV=sandbox`
2. Use Paddle's sandbox test cards:
   - **Success**: `4000 0000 0000 0002`
   - **Decline**: `4000 0000 0000 0002`
   - **3D Secure**: `4000 0000 0000 1000`

### 3.2 Webhook Testing

1. Use Paddle's webhook testing tool in the dashboard
2. Test each event type to ensure your handlers work correctly

## Step 4: Production Deployment

1. Set `PADDLE_ENV=production`
2. Update webhook URL to your production domain
3. Ensure your server is accessible via HTTPS
4. Test the complete payment flow

## API Endpoints

### Create Checkout Session

```
POST /api/v1/paddle/create-checkout
Body: { "productType": "starter|pro|lifetime" }
```

### Get Subscription Status

```
GET /api/v1/paddle/subscription-status
```

### Cancel Subscription

```
POST /api/v1/paddle/cancel-subscription
```

### Update Subscription

```
PUT /api/v1/paddle/update-subscription
Body: { "newPlan": "starter|pro|lifetime" }
```

### Webhook Endpoint

```
POST /api/v1/paddle/webhook
```

## Subscription Plans

| Plan     | Price | Links/Month | Storage   | File Types  |
| -------- | ----- | ----------- | --------- | ----------- |
| Free     | $0    | 10          | 100MB     | Image, Text |
| Starter  | $9    | 50          | 1GB       | Image, Text |
| Pro      | $19   | 500         | 10GB      | All Types   |
| Lifetime | $59   | Unlimited   | Unlimited | All Types   |

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**

   - Check webhook URL is accessible
   - Verify webhook secret matches
   - Check server logs for errors

2. **Checkout not working**

   - Verify price IDs are correct
   - Check API key permissions
   - Ensure environment is set correctly

3. **Subscription not updating**
   - Check webhook handlers
   - Verify database connection
   - Check user model subscription fields

### Debug Mode

Enable debug logging by adding to your environment:

```env
DEBUG=paddle:*
```

## Security Notes

1. Never expose your API keys in client-side code
2. Always verify webhook signatures
3. Use HTTPS in production
4. Implement proper error handling
5. Log all payment events for audit

## Support

- Paddle Documentation: https://developer.paddle.com/
- Paddle Support: https://paddle.com/support/
- GitHub Issues: [Your repo issues page]
