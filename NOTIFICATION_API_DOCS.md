# Notification System - API Documentation

## Overview

The Bihar Government Portal notification system provides real-time alerts to users via SMS and Email for critical events. All notifications are persisted in the database for user reference.

## Architecture

### Components

```
┌─────────────────────────────────────┐
│   Application Events                 │
│  (Registration, Payment, etc.)      │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Notification Manager               │
│  (lib/notificationManager.js)       │
│  - Format messages                  │
│  - Handle SMS/Email                 │
│  - Persist to DB                    │
└────────┬────────────────────────────┘
         │
    ┌────┴───────┬──────────────────┐
    ▼            ▼                  ▼
┌─────────────┐ ┌──────────────┐ ┌──────────────┐
│   Twilio    │ │  SendGrid    │ │  Database    │
│   (SMS)     │ │  (Email)     │ │ (Persistence)│
└─────────────┘ └──────────────┘ └──────────────┘
```

### Notification Flow

1. **Event Triggered** → Application event occurs (registration, payment, etc.)
2. **Notification Created** → Manager formats SMS + Email messages
3. **SMS Sent** → Via Twilio API to user's phone
4. **Email Sent** → Via SendGrid API to user's email
5. **Stored in DB** → Notification record created for history
6. **Delivered to User** → Via API or real-time updates

## API Endpoints

### Base URL
```
/api/notifications
```

### Authentication
All endpoints require Bearer token authentication header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## User Endpoints

### 1. List Notifications

**Endpoint**: `GET /api/notifications`

**Query Parameters**:
- `limit` (optional): Number of notifications per page. Default: 20, Max: 100
- `skip` (optional): Number of records to skip. Default: 0

**Request**:
```bash
GET /api/notifications?limit=20&skip=0
Authorization: Bearer token
```

**Response** (200 OK):
```json
{
  "notifications": [
    {
      "id": 1,
      "userId": 123,
      "type": "REGISTRATION",
      "title": "Welcome to Bihar Government Portal",
      "message": "Your account has been created successfully.",
      "metadata": {
        "email": "user@example.com"
      },
      "isRead": false,
      "createdAt": "2026-05-11T10:30:00Z",
      "updatedAt": "2026-05-11T10:30:00Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "skip": 0,
  "pages": 3
}
```

---

### 2. Get Unread Count

**Endpoint**: `GET /api/notifications/unread/count`

**Request**:
```bash
GET /api/notifications/unread/count
Authorization: Bearer token
```

**Response** (200 OK):
```json
{
  "unreadCount": 5
}
```

---

### 3. Mark Notification as Read

**Endpoint**: `PUT /api/notifications/:id/read`

**Path Parameters**:
- `id` (required): Notification ID

**Request**:
```bash
PUT /api/notifications/123/read
Authorization: Bearer token
```

**Response** (200 OK):
```json
{
  "id": 123,
  "userId": 456,
  "type": "APPLICATION_SUBMITTED",
  "title": "Application Submitted",
  "message": "Your application has been submitted successfully.",
  "isRead": true,
  "updatedAt": "2026-05-11T11:00:00Z"
}
```

**Error** (403 Forbidden):
```json
{
  "message": "Unauthorized"
}
```

---

### 4. Mark All as Read

**Endpoint**: `PUT /api/notifications/read-all`

**Request**:
```bash
PUT /api/notifications/read-all
Authorization: Bearer token
```

**Response** (200 OK):
```json
{
  "updated": 5
}
```

---

### 5. Delete Notification

**Endpoint**: `DELETE /api/notifications/:id`

**Path Parameters**:
- `id` (required): Notification ID

**Request**:
```bash
DELETE /api/notifications/123
Authorization: Bearer token
```

**Response** (200 OK):
```json
{
  "deleted": true
}
```

---

### 6. Clear All Notifications

**Endpoint**: `DELETE /api/notifications/clear-all`

**Query Parameters** (optional):
- `userId`: User ID (admin only - for clearing other user's notifications)

**Request**:
```bash
DELETE /api/notifications/clear-all
Authorization: Bearer token
```

**Response** (200 OK):
```json
{
  "deleted": 25
}
```

---

## Admin Endpoints

### 1. Get Notification Statistics

**Endpoint**: `GET /api/notifications/stats`

**Requirements**: Admin or Super Admin role

**Request**:
```bash
GET /api/notifications/stats
Authorization: Bearer token
```

**Response** (200 OK):
```json
{
  "total": 1250,
  "unread": 145,
  "recent24h": 89,
  "byType": [
    {
      "type": "REGISTRATION",
      "count": 45
    },
    {
      "type": "PAYMENT_SUCCESS",
      "count": 78
    },
    {
      "type": "APPLICATION_SUBMITTED",
      "count": 120
    }
  ]
}
```

**Error** (403 Forbidden):
```json
{
  "message": "Admin only"
}
```

---

### 2. Send Bulk Notification

**Endpoint**: `POST /api/notifications/bulk`

**Requirements**: Admin or Super Admin role

**Request Body**:
```json
{
  "title": "Important Announcement",
  "message": "Please check the new notice posted on the portal.",
  "smsMessage": "Important: New notice posted on portal. Login to check.",
  "filter": {
    "role": "CANDIDATE",
    "isActive": true
  }
}
```

**Request**:
```bash
POST /api/notifications/bulk
Authorization: Bearer token
Content-Type: application/json

{
  "title": "Important Announcement",
  "message": "Please check the new notice posted on the portal.",
  "smsMessage": "Important: New notice posted on portal.",
  "filter": {
    "role": "CANDIDATE"
  }
}
```

**Response** (200 OK):
```json
{
  "sent": 1250,
  "total": 1250,
  "message": "Notification sent to 1250 users"
}
```

**Error** (400 Bad Request):
```json
{
  "message": "title and message required"
}
```

**Error** (403 Forbidden):
```json
{
  "message": "Admin only"
}
```

---

## Notification Types

### Supported Notification Types

| Type | Triggered On | Recipients | SMS | Email |
|------|--------------|------------|-----|-------|
| REGISTRATION | User signs up | Candidate | ✅ | ✅ |
| LOGIN | User logs in | Candidate | ✅ | ✅ |
| APPLICATION_SUBMITTED | Application submitted | Candidate + Admin | ✅ | ✅ |
| PAYMENT_SUCCESS | Payment successful | Candidate + Admin | ✅ | ✅ |
| PAYMENT_FAILED | Payment failed | Candidate | ✅ | ✅ |
| NOTICE_POSTED | Notice created | All Users | ✅ | ✅ |
| NEW_POST | Job posting created | All Candidates | ✅ | ✅ |
| SHORTLISTED | Application shortlisted | Candidate | ✅ | ✅ |
| REJECTED | Application rejected | Candidate | ✅ | ✅ |
| ADMIT_CARD_READY | Admit card generated | Candidate | ✅ | ✅ |
| RESULT_PUBLISHED | Results published | Candidate | ✅ | ✅ |
| BULK_MESSAGE | Admin broadcast | Selected Users | ✅ | ✅ |

---

## Notification Data Schema

### Notification Object

```json
{
  "id": 123,
  "userId": 456,
  "type": "APPLICATION_SUBMITTED",
  "title": "Application Submitted",
  "message": "Your application has been submitted successfully. Reference: APP-2026-001",
  "smsMessage": "Application APP-2026-001 submitted successfully.",
  "metadata": {
    "applicationId": 789,
    "postId": 100,
    "appNumber": "APP-2026-001"
  },
  "isRead": false,
  "createdAt": "2026-05-11T10:30:00Z",
  "updatedAt": "2026-05-11T10:30:00Z"
}
```

### Metadata Examples

**Registration**:
```json
{
  "email": "user@example.com",
  "name": "John Doe"
}
```

**Payment Success**:
```json
{
  "paymentId": "PAY-123456",
  "amount": 1500,
  "applicationId": 789
}
```

**Application Submitted**:
```json
{
  "applicationId": 789,
  "postId": 100,
  "appNumber": "APP-2026-001"
}
```

---

## SMS Message Templates

### Character Limits
All SMS messages are optimized to fit within 160 characters to avoid extra charges.

**Registration**:
```
Welcome to Bihar Government Portal! Your account has been created. Login to apply for jobs.
```

**Application Submitted**:
```
Application APP-001234 submitted successfully. Reference number saved. Wait for results.
```

**Payment Success**:
```
Payment received. Receipt: PAY-123456. Application APP-001234 confirmed. Good luck!
```

**Payment Failed**:
```
Payment failed. Please retry or contact support. Reference: FAL-123456.
```

**Notice Posted**:
```
Important notice posted on Bihar Government Portal. Login to check. Visit: portal.com
```

---

## Email Templates

### Email Structure
- HTML formatted emails
- Branded header with logo
- Clear call-to-action buttons
- Footer with links

### Email Example: Application Submitted

```html
Subject: Application Submitted - Reference: APP-2026-001

Dear John,

Your application has been successfully submitted!

Application Details:
- Reference Number: APP-2026-001
- Post: Senior Developer
- Submission Time: 2026-05-11 10:30 AM
- Status: Under Review

Next Steps:
- We will notify you once your application is reviewed
- You can check status anytime by logging into your account
- Keep your reference number safe

[View Application Status]

Best regards,
Bihar Government Portal Team
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Notification retrieved |
| 400 | Bad Request | Missing required fields |
| 403 | Forbidden | Unauthorized access |
| 404 | Not Found | Notification doesn't exist |
| 500 | Server Error | Database error |

### Error Response Format

```json
{
  "message": "Error description"
}
```

### Common Errors

**400 - Missing Fields**:
```json
{
  "message": "title and message required"
}
```

**403 - Insufficient Permissions**:
```json
{
  "message": "Admin only"
}
```

**403 - Unauthorized Access**:
```json
{
  "message": "Unauthorized"
}
```

---

## Best Practices

### Frontend Integration

1. **List Notifications on Load**
   ```javascript
   // Get all notifications for the user
   GET /api/notifications?limit=20
   ```

2. **Check Unread Count**
   ```javascript
   // Get unread count for badge
   GET /api/notifications/unread/count
   ```

3. **Mark as Read on View**
   ```javascript
   // When user clicks notification
   PUT /api/notifications/{id}/read
   ```

4. **Real-time Updates (Optional)**
   - Use WebSocket for live updates
   - Or poll unread count every 30 seconds

### Real-time Notifications (Optional)

For real-time notification delivery to frontend:
1. Connect WebSocket on user login
2. Server broadcasts notification events
3. Frontend displays toast/alert
4. User can mark as read immediately

---

## Configuration

### Environment Variables

```env
# Email (SendGrid)
SENDGRID_API_KEY=sg_xxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@bihar.gov.in

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+911234567890

# Notifications
NOTIFICATION_RETRY_COUNT=3
NOTIFICATION_RETRY_DELAY=5000
```

---

## Rate Limiting

### Notification API Rate Limits
- List notifications: 100 requests/minute
- Get unread count: 100 requests/minute
- Mark as read: 50 requests/minute
- Bulk send (admin): 10 requests/minute

---

## Testing

### Test Registration Notification
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+911234567890",
    "password": "SecurePass123"
  }'
```

### Test Get Notifications
```bash
curl -X GET http://localhost:5000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Bulk Notification (Admin)
```bash
curl -X POST http://localhost:5000/api/notifications/bulk \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "System Maintenance",
    "message": "Portal will be under maintenance on Sunday.",
    "smsMessage": "System maintenance scheduled for Sunday.",
    "filter": {"role": "CANDIDATE"}
  }'
```

---

## Troubleshooting

### SMS Not Sending
1. Check Twilio credentials in .env
2. Verify phone number format (+91 for India)
3. Check Twilio account balance
4. Review error logs

### Email Not Sending
1. Check SendGrid API key
2. Verify sender email in .env
3. Check spam folder
4. Review SendGrid activity log

### Notifications Not Persisting
1. Verify database connection
2. Check notification table exists
3. Review database errors in logs

---

## Support

For issues or questions:
1. Check error logs in terminal
2. Review API documentation
3. Test with curl commands first
4. Contact development team

---

*Last Updated: May 11, 2026*
*API Version: 1.0*
