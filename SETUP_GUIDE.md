# 📋 Complete Backend Setup Guide for Bihar Recruitment Portal

## ✅ Quick Start - 10 Steps to Get Running

### Step 1: Clone Repository
```bash
cd C:\Users\Aman\Desktop\bihar-govt\backend
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Setup PostgreSQL Database
```bash
# Create database in PostgreSQL
CREATE DATABASE bihar_recruitment;

# OR via command line
createdb bihar_recruitment
```

### Step 4: Configure Environment Variables
Create `.env` file in project root:
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/bihar_recruitment"

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your_secret_key_here_change_in_production

# Razorpay (Payment Gateway)
RAZORPAY_KEY_ID=rzp_test_1234567890ABCD
RAZORPAY_SECRET_KEY=your_razorpay_secret_key

# Email Service (SendGrid or Gmail)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# SMS Service (Twilio or AWS SNS)
SMS_PROVIDER=twilio
SMS_ACCOUNT_SID=your_account_sid
SMS_AUTH_TOKEN=your_auth_token
SMS_PHONE_NUMBER=+12345678900

# AWS S3 (File Uploads)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=bihar-recruitment
AWS_REGION=us-east-1

# Admin Email
ADMIN_EMAIL=admin@bsmdo.gov.in
```

### Step 5: Run Database Migrations
```bash
npx prisma migrate dev --name init
```

### Step 6: Start Development Server
```bash
npm run dev
# OR
node index.js
```

Server runs on: `http://localhost:5000`

### Step 7: Test API
```bash
# Health check
curl http://localhost:5000/api/health

# Send OTP
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Step 8: Setup Payment Gateway (Razorpay)
1. Sign up at [Razorpay](https://dashboard.razorpay.com)
2. Get Test API Keys from Dashboard
3. Add to `.env`:
   ```env
   RAZORPAY_KEY_ID=rzp_test_xxx
   RAZORPAY_SECRET_KEY=secret_xxx
   ```

### Step 9: Setup SMS/Email Service
Choose one:

**Option A: Gmail (Easiest)**
- Enable 2-factor authentication
- Generate App Password
- Add to `.env`

**Option B: Twilio**
- Sign up at [Twilio](https://www.twilio.com)
- Get credentials
- Add to `.env`

### Step 10: Start Building!
```bash
npm run dev
```

---

## 🔐 OTP Implementation Guide

### How OTP Works in This System

1. **User sends email/phone**
   ```bash
   POST /api/auth/send-otp
   {
     "email": "user@example.com",
     "type": "email"
   }
   ```

2. **Backend generates 6-digit OTP**
   - Valid for 10 minutes
   - Stored in database/cache
   - Sent via email/SMS

3. **User receives OTP** (Simulation in development mode)
   ```
   Your OTP: 123456
   Valid for 10 minutes
   ```

4. **User submits OTP with registration**
   ```bash
   POST /api/auth/register
   {
     "name": "John Doe",
     "email": "john@example.com",
     "password": "securepassword",
     "otp": "123456"
   }
   ```

### SMS Gateway Setup (Twilio)

**Step 1: Create Twilio Account**
- Visit https://www.twilio.com/console
- Get Account SID and Auth Token
- Get a Phone Number

**Step 2: Add to `.env`**
```env
SMS_PROVIDER=twilio
SMS_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxx
SMS_AUTH_TOKEN=your_auth_token
SMS_PHONE_NUMBER=+1234567890
```

**Step 3: Install Twilio SDK**
```bash
npm install twilio
```

**Step 4: Implement SMS Sending**
```javascript
const twilio = require('twilio');

const sendSMS = async (phoneNumber, otp) => {
  const client = twilio(
    process.env.SMS_ACCOUNT_SID,
    process.env.SMS_AUTH_TOKEN
  );

  await client.messages.create({
    body: `Your OTP is: ${otp}. Valid for 10 minutes.`,
    from: process.env.SMS_PHONE_NUMBER,
    to: phoneNumber,
  });
};
```

### Email Service Setup (SendGrid)

**Step 1: Create SendGrid Account**
- Visit https://sendgrid.com
- Create API Key

**Step 2: Add to `.env`**
```env
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@bsmdo.gov.in
```

**Step 3: Install SendGrid**
```bash
npm install @sendgrid/mail
```

**Step 4: Implement Email Sending**
```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (email, otp) => {
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'Your OTP for Registration',
    text: `Your OTP is: ${otp}. Valid for 10 minutes.`,
  };

  await sgMail.send(msg);
};
```

---

## 💳 Payment Gateway Integration (Razorpay)

### Step 1: Razorpay Account Setup
```
1. Visit: https://dashboard.razorpay.com/signin
2. Sign up with email
3. Complete KYC verification
4. Go to Settings → API Keys
5. Copy Test/Live Keys
```

### Step 2: Add Keys to `.env`
```env
# Test mode (for development)
RAZORPAY_KEY_ID=rzp_test_1234567890ABCD
RAZORPAY_SECRET_KEY=your_razorpay_secret_key

# Live mode (production - after testing)
# RAZORPAY_KEY_ID=rzp_live_xxxxx
# RAZORPAY_SECRET_KEY=your_live_secret_key
```

### Step 3: Install Razorpay SDK
```bash
npm install razorpay
```

### Step 4: Implement Payment Processing

**Create Payment Order:**
```javascript
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_SECRET_KEY,
});

const createOrder = async (amount, applicationId) => {
  const options = {
    amount: amount * 100, // Convert to paise
    currency: 'INR',
    receipt: `app_${applicationId}`,
    payment_capture: 1, // Auto capture
  };

  const order = await razorpay.orders.create(options);
  return order;
};
```

**Verify Payment:**
```javascript
const crypto = require('crypto');

const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_SECRET_KEY)
    .update(body.toString())
    .digest('hex');

  return expectedSignature === signature;
};
```

### Step 5: Payment Flow in UI
```javascript
// Frontend Payment Integration
const initiatePayment = async (amount, applicationId) => {
  // 1. Create order from backend
  const { order } = await fetch('/api/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ amount, applicationId }),
  }).then(r => r.json());

  // 2. Open Razorpay
  const options = {
    key: process.env.REACT_APP_RAZORPAY_KEY,
    amount: order.amount,
    currency: 'INR',
    order_id: order.id,
    handler: async (response) => {
      // 3. Verify payment
      await fetch('/api/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        }),
      });
    },
  };

  new Razorpay(options).open();
};
```

---

## 🛢️ Database Setup & Migrations

### Initialize Prisma
```bash
npx prisma init
```

### Run Migrations
```bash
# Create and run migrations
npx prisma migrate dev --name init

# Apply existing migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset
```

### View Database
```bash
# Open Prisma Studio
npx prisma studio
```

---

## 🧪 Testing API Endpoints

### Authentication

**1. Send OTP**
```bash
curl -X POST http://localhost:5000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "type": "email"
  }'
```

**Response (Development):**
```json
{
  "message": "OTP sent successfully",
  "otp": "123456",
  "expiresIn": 600
}
```

**2. Register**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "password": "MySecurePassword123",
    "otp": "123456"
  }'
```

**Response:**
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

**3. Login**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "MySecurePassword123"
  }'
```

**4. Get Profile (Protected Route)**
```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 📁 Project Structure Explanation

```
backend/
├── controllers/           # Business logic for each feature
│   └── authController.js
├── routes/               # API endpoint definitions
│   └── authRoutes.js
├── middleware/           # Express middleware
│   ├── auth.js          # JWT verification
│   └── errorHandler.js  # Error handling
├── utils/               # Helper functions
│   └── helpers.js       # OTP, tokens, etc
├── prisma/              # Database schema
│   ├── schema.prisma    # Data models
│   └── migrations/      # Database changes
├── index.js             # Main server file
├── package.json         # Dependencies
├── .env                 # Environment variables
└── .env.example         # Template for .env
```

---

## 🚨 Common Issues & Fixes

### Issue 1: Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Fix:**
```bash
# Check PostgreSQL is running
pg_isready

# Start PostgreSQL (Windows)
net start postgresql-14

# Or start PostgreSQL service via Services
```

### Issue 2: JWT Token Errors
```
Error: Invalid token
```

**Fix:**
- Ensure JWT_SECRET is set in .env
- Token not expired
- Include "Bearer" in Authorization header

### Issue 3: Prisma Migration Fails
```
Error: P3005
```

**Fix:**
```bash
# Reset database and re-migrate
npx prisma migrate reset

# Or manually run migration
npx prisma migrate deploy
```

---

## 🔄 Deployment Checklist

- [ ] Set NODE_ENV=production
- [ ] Generate strong JWT_SECRET
- [ ] Setup production database
- [ ] Configure payment gateway for live mode
- [ ] Setup email/SMS services
- [ ] Enable CORS for frontend domain
- [ ] Setup SSL certificates
- [ ] Configure environment variables on server
- [ ] Test all endpoints
- [ ] Setup logging & monitoring
- [ ] Enable backups
- [ ] Setup CI/CD pipeline

---

## 📊 Database Tables Overview

| Table | Purpose |
|-------|---------|
| User | User accounts & profiles |
| Recruitment | Job recruitment drives |
| Post | Individual job postings |
| Application | Candidate applications |
| Payment | Payment transactions |
| AdmitCard | Exam admit cards |
| Result | Exam results |
| Notice | Announcements |

---

## 🎯 Next Steps

1. **Run migrations**: `npx prisma migrate dev`
2. **Start server**: `npm run dev`
3. **Test endpoints**: Use curl or Postman
4. **Create recruitment**: Add test data
5. **Build frontend**: Connect React/Vue app

---

## 📞 Support & Resources

- **Prisma Docs**: https://www.prisma.io/docs/
- **Express Docs**: https://expressjs.com/
- **Razorpay Docs**: https://razorpay.com/docs/
- **Twilio Docs**: https://www.twilio.com/docs
- **SendGrid Docs**: https://docs.sendgrid.com/

---

**Last Updated**: May 1, 2026
**For**: Bihar State Mission Development Organization
