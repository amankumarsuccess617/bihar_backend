# 📚 Complete API Documentation

## Base URL
```
http://localhost:5000
```

## Authentication
All protected routes require JWT token in header:
```
Authorization: Bearer your_token_here
```

---

# Authentication Endpoints

## 1. Send OTP
**Endpoint:** `POST /api/auth/send-otp`

**Request:**
```json
{
  "email": "user@example.com",
  "type": "email"
}
```

**Response (Success):**
```json
{
  "message": "OTP sent successfully",
  "otp": "123456",
  "expiresIn": 600
}
```

**Response (Error):**
```json
{
  "error": "Email or phone required"
}
```

---

## 2. Register
**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "password": "SecurePassword123",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "CANDIDATE"
  }
}
```

---

## 3. Login
**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

**Response (Success):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "CANDIDATE"
  }
}
```

---

## 4. Get Profile
**Endpoint:** `GET /api/auth/profile`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+919876543210",
  "role": "CANDIDATE",
  "isActive": true,
  "createdAt": "2026-05-01T10:30:00Z"
}
```

---

# HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

# Error Responses

### 400 Bad Request
```json
{
  "error": "Email or phone required"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid credentials"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied: insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Server Error
```json
{
  "error": "Internal server error",
  "message": "Error details in development mode"
}
```

---

# Rate Limiting

- **Window:** 15 minutes
- **Max Requests:** 100 per window
- **Headers Response:**
  ```
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1234567890
  ```

---

# Testing with cURL

## Send OTP
```bash
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "type": "email"
  }'
```

## Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "password": "MyPassword123",
    "otp": "123456"
  }'
```

## Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "MyPassword123"
  }'
```

## Get Profile
```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

# Testing with Postman

1. **Create new request**
2. **Select POST method**
3. **Enter URL:** `http://localhost:5000/api/auth/login`
4. **Go to Body tab** → select `raw` → select `JSON`
5. **Paste JSON:**
```json
{
  "email": "john@example.com",
  "password": "MyPassword123"
}
```
6. **Click Send**
7. **Copy token from response**
8. **Create new request for protected route**
9. **Go to Headers tab**
10. **Add:** 
    - Key: `Authorization`
    - Value: `Bearer YOUR_TOKEN_HERE`
11. **Send**

---

# Webhook Responses

### Payment Success Webhook
```json
{
  "orderId": "ORD123456",
  "paymentId": "PAY123456",
  "status": "completed",
  "amount": 50000,
  "currency": "INR",
  "timestamp": "2026-05-01T10:30:00Z"
}
```

### Payment Failure Webhook
```json
{
  "orderId": "ORD123456",
  "status": "failed",
  "error": "Insufficient funds",
  "timestamp": "2026-05-01T10:30:00Z"
}
```

---

# Future Endpoints (To be implemented)

## Recruitment
- `GET /api/recruitment` - List all recruitments
- `POST /api/recruitment` - Create recruitment (Admin)
- `GET /api/recruitment/:id` - Get recruitment details
- `PUT /api/recruitment/:id` - Update recruitment (Admin)

## Applications
- `GET /api/applications` - List user applications
- `POST /api/applications` - Submit application
- `GET /api/applications/:id` - Get application details
- `PUT /api/applications/:id` - Update application
- `DELETE /api/applications/:id` - Cancel application

## Payments
- `POST /api/payments/create-order` - Create payment order
- `POST /api/payments/verify` - Verify payment
- `GET /api/payments/:applicationId` - Get payment details

## Admit Cards
- `GET /api/admit-cards/:applicationId` - Get admit card
- `GET /api/admit-cards/:applicationId/download` - Download admit card PDF
- `GET /api/admit-cards/:rollNumber` - Get by roll number

## Results
- `GET /api/results/:applicationId` - Get result
- `GET /api/results/roll/:rollNumber` - Get by roll number
- `GET /api/results/merit-list` - Get merit list
- `GET /api/results/toppers` - Get toppers

## Notices
- `GET /api/notices` - List notices
- `POST /api/notices` - Create notice (Admin)
- `GET /api/notices/:id` - Get notice
- `PUT /api/notices/:id` - Update notice (Admin)
- `DELETE /api/notices/:id` - Delete notice (Admin)

## Admin Dashboard
- `GET /api/admin/dashboard` - Dashboard overview
- `GET /api/admin/analytics/applications` - Application analytics
- `GET /api/admin/analytics/payments` - Payment analytics
- `GET /api/admin/users` - List users
- `PATCH /api/admin/users/:userId/status` - Toggle user status

---

# Pagination

All list endpoints support pagination:

**Query Parameters:**
```
?page=1&limit=10
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

---

# Sorting

Supported sort parameters:

**Query:**
```
?sort=-createdAt,name
```

**Response: Items sorted by creation date (newest first), then by name**

---

# Filtering

Example filter queries:

```
GET /api/applications?status=submitted&paymentStatus=pending
GET /api/notices?category=recruitment&isImportant=true
GET /api/results?isQualified=true&isTopper=false
```

---

# Version Info

**API Version:** 1.0.0
**Latest Update:** May 1, 2026
**Supported Methods:** GET, POST, PUT, PATCH, DELETE

---

# Support

For issues or questions:
- Email: support@bsmdo.gov.in
- Phone: +91-9241733773
