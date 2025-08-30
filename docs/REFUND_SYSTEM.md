# LinkNuke Refund System Documentation

## Overview

The LinkNuke refund system provides a comprehensive 15-day money-back guarantee for all paid subscriptions. This document outlines the complete implementation, business logic, and usage guidelines.

## Features

### ✅ Core Features

- **15-day refund window** from first payment date
- **Immediate access removal** upon successful refund
- **Full refund processing** via Paddle API
- **Comprehensive validation** and error handling
- **Audit logging** for all refund activities
- **User-friendly UI** with clear policy information

### ✅ Business Logic

- **Refund vs Cancel distinction**: Refunds remove access immediately, cancellations allow access until period end
- **Eligibility validation**: Multiple checks to prevent invalid refunds
- **Transaction tracking**: Full audit trail of refund requests and processing
- **Status management**: Clear status tracking (none, requested, processing, completed, failed)

## Architecture

### Backend Components

#### 1. Database Schema (User Model)

```javascript
subscription: {
  status: "active" | "inactive" | "cancelled" | "refunded",
  plan: "free" | "starter" | "pro" | "lifetime",
  // ... existing fields ...

  // Refund tracking fields
  refundedAt: Date,
  refundAmount: Number,
  refundReason: String,
  refundStatus: "none" | "requested" | "processing" | "completed" | "failed",
  firstPaymentDate: Date, // Track first payment for 15-day window
}
```

#### 2. API Endpoints

- `POST /api/v1/paddle/request-refund` - Process refund request
- `GET /api/v1/paddle/refund-policy` - Get refund policy information
- `POST /api/v1/paddle/webhook` - Handle Paddle refund webhooks

#### 3. Utility Functions (`Server/utils/refundUtils.js`)

- `calculateDaysSincePayment()` - Calculate days since first payment
- `checkRefundEligibility()` - Validate refund eligibility
- `validateRefundRequest()` - Comprehensive request validation
- `formatRefundAmount()` - Format refund amounts for display
- `getRefundPolicy()` - Get refund policy information
- `logRefundActivity()` - Audit logging for refund activities

### Frontend Components

#### 1. SubscriptionManager (`Client/src/Dashboard/SubscriptionManager.jsx`)

- Refund eligibility display
- Refund request modal
- Status tracking and updates
- Integration with existing subscription management

#### 2. RefundPolicyModal (`Client/src/components/ui/RefundPolicyModal.jsx`)

- Comprehensive policy information
- Clear terms and conditions
- User-friendly presentation

## API Reference

### Request Refund

```http
POST /api/v1/paddle/request-refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Optional refund reason"
}
```

**Response (Success):**

```json
{
  "message": "Refund processed successfully",
  "refundId": "ref_123456",
  "refundAmount": 1999,
  "refundedAt": "2024-01-15T10:30:00.000Z",
  "accessRemoved": true
}
```

**Response (Error):**

```json
{
  "error": "Refund window has expired. Refunds are only available within 15 days of first payment.",
  "daysSincePayment": 20,
  "refundWindowExpired": true
}
```

### Get Refund Policy

```http
GET /api/v1/paddle/refund-policy
Authorization: Bearer <token>
```

**Response:**

```json
{
  "policy": {
    "windowDays": 15,
    "description": "Full refunds are available within 15 days of first payment",
    "conditions": [...],
    "processingTime": "Refunds are processed immediately"
  },
  "userEligibility": {
    "eligible": true,
    "reason": "Eligible for refund",
    "daysSincePayment": 5,
    "daysRemaining": 10
  }
}
```

## Business Rules

### 1. Refund Eligibility

- ✅ Must be within 15 days of first payment
- ✅ Must have active subscription
- ✅ Must not have already requested/been refunded
- ✅ Must have valid transaction ID

### 2. Refund Processing

- ✅ Immediate access removal upon successful refund
- ✅ Downgrade to free plan with free limits
- ✅ Full refund to original payment method
- ✅ Comprehensive audit logging

### 3. Error Handling

- ✅ Graceful handling of Paddle API failures
- ✅ Clear error messages for different scenarios
- ✅ Fallback mechanisms for network issues
- ✅ User-friendly error display

## Testing

### Unit Tests

The system includes comprehensive unit tests covering:

- ✅ Date calculations and boundary conditions
- ✅ Eligibility validation logic
- ✅ Edge cases and error scenarios
- ✅ Business rule enforcement

### Integration Tests

- ✅ End-to-end refund flow testing
- ✅ Paddle API integration testing
- ✅ Database state validation
- ✅ Webhook processing verification

### Edge Cases Covered

- ✅ Exactly 15 days since payment (boundary condition)
- ✅ Multiple refund attempts prevention
- ✅ Missing payment date handling
- ✅ Network timeout scenarios
- ✅ Invalid transaction IDs
- ✅ Already refunded transactions

## Security Considerations

### 1. Authentication & Authorization

- ✅ All refund endpoints require valid JWT token
- ✅ Users can only refund their own subscriptions
- ✅ Admin-level access controls for refund management

### 2. Data Validation

- ✅ Input sanitization and validation
- ✅ SQL injection prevention
- ✅ XSS protection in error messages

### 3. Audit Trail

- ✅ Complete logging of all refund activities
- ✅ User identification and tracking
- ✅ Timestamp and reason logging

## Monitoring & Analytics

### 1. Logging

- ✅ Structured logging for all refund activities
- ✅ Error tracking and alerting
- ✅ Performance monitoring

### 2. Metrics

- ✅ Refund request volume
- ✅ Success/failure rates
- ✅ Processing times
- ✅ User satisfaction indicators

## Deployment Considerations

### 1. Environment Variables

```bash
PADDLE_API_KEY=your_paddle_api_key
PADDLE_WEBHOOK_SECRET=your_webhook_secret
PADDLE_ENV=sandbox|production
```

### 2. Database Migration

The refund system requires adding new fields to the User model:

```javascript
// Add to subscription object
refundedAt: Date,
refundAmount: Number,
refundReason: String,
refundStatus: String,
firstPaymentDate: Date
```

### 3. Webhook Configuration

Ensure Paddle webhooks are configured to send `transaction.refunded` events to:

```
https://yourdomain.com/api/v1/paddle/webhook
```

## Troubleshooting

### Common Issues

#### 1. "Refund window has expired"

- **Cause**: User trying to refund after 15 days
- **Solution**: Inform user of policy, suggest cancellation instead

#### 2. "No active subscription found"

- **Cause**: User doesn't have a paid subscription
- **Solution**: Check subscription status, redirect to pricing

#### 3. "Refund already requested"

- **Cause**: User trying to request multiple refunds
- **Solution**: Check refund status, show current status

#### 4. "Transaction not found"

- **Cause**: Missing or invalid transaction ID
- **Solution**: Check Paddle integration, verify transaction exists

### Debug Commands

```bash
# Check user subscription status
curl -H "Authorization: Bearer <token>" \
  https://api.linknuke.com/paddle/subscription-status

# Check refund policy
curl -H "Authorization: Bearer <token>" \
  https://api.linknuke.com/paddle/refund-policy
```

## Future Enhancements

### Planned Features

- [ ] Partial refund support
- [ ] Refund analytics dashboard
- [ ] Automated refund processing for failed payments
- [ ] Integration with customer support system
- [ ] Refund reason categorization and analytics

### Performance Optimizations

- [ ] Caching of eligibility calculations
- [ ] Batch processing for multiple refunds
- [ ] Async processing for large refund volumes

## Support

For technical support or questions about the refund system:

- 📧 Email: support@linknuke.com
- 📚 Documentation: [Internal Wiki]
- 🐛 Bug Reports: [GitHub Issues]
- 💬 Slack: #refund-system

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Maintainer**: Development Team

