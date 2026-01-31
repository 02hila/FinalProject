# Ads-Maker User Help Guide

A comprehensive reference guide for the Ads-Maker platform - an AI-powered advertisement generation system.

**Live Platform**: https://adsmaker-rho.vercel.app
**API Server**: https://adsmaker.onrender.com

---

## Table of Contents

### Part 1: User Guide
- [1.1 Platform Overview](#11-platform-overview)
- [1.2 Getting Started](#12-getting-started)
- [1.3 Company Guide](#13-company-guide)
- [1.4 Agent Guide](#14-agent-guide)
- [1.5 Admin Guide](#15-admin-guide)
- [1.6 Common Features](#16-common-features)

### Part 2: Developer Guide
- [2.1 System Architecture](#21-system-architecture)
- [2.2 Frontend Structure](#22-frontend-structure)
- [2.3 Backend Structure](#23-backend-structure)
- [2.4 Database Models](#24-database-models)
- [2.5 API Endpoints](#25-api-endpoints)
- [2.6 Authentication Flow](#26-authentication-flow)
- [2.7 Key Features Implementation](#27-key-features-implementation)
- [2.8 Maintenance & Monitoring](#28-maintenance--monitoring)

---

# Part 1: User Guide

## 1.1 Platform Overview

Ads-Maker is a platform that connects **Companies** who need advertisements with **Agents** who create them using AI technology.

### User Roles

| Role | Description |
|------|-------------|
| **Company** | Creates campaigns, assigns agents, reviews and approves ads, handles payments |
| **Agent** | Joins campaigns, generates AI-powered ads, earns commissions |
| **Admin** | Monitors platform, manages users, handles system administration |

### Platform Flow

```
Company creates campaign
        ↓
Agents submit price proposals
        ↓
Company assigns agents to campaign
        ↓
Agents generate ads using AI
        ↓
Company reviews and approves/rejects ads
        ↓
Approved ads with QR codes for tracking
        ↓
Company pays for approved ads
        ↓
Analytics track ad performance
```

---

## 1.2 Getting Started

### Accessing the Platform

1. Open your browser and navigate to: **https://adsmaker-rho.vercel.app**
2. You will see the landing page with options to **Login** or **Register**

### Registration

1. Click **"הרשמה"** (Register) button
2. Fill in the registration form:
   - **שם מלא**: Your display name
   - **אימייל**: Valid email address (used for login)
   - **סיסמה**: Minimum 6 characters
   - **סוג משתמש**: Select "חברה" (Company) or "סוכן" (Agent)
3. Click **"הרשמה"** to create your account
4. You will be automatically logged in and redirected to your dashboard

### Login

1. Click **"התחברות"** (Login) button
2. Enter your email and password
3. Click **"התחבר"** to access your dashboard

### Logout

1. Click **"יציאה"** (Logout) button in the top navigation bar
2. You will be redirected to the login page

---

## 1.3 Company Guide

### Dashboard Overview

After logging in as a Company, you'll see the Company Dashboard with multiple tabs:

| Tab | Hebrew | Purpose |
|-----|--------|---------|
| Overview | סקירה כללית | Statistics and summary |
| Pending Ads | מודעות ממתינות | Review ads submitted by agents |
| Proposals | הצעות מחיר | Review price proposals from agents |
| Campaigns | קמפיינים | Create and manage campaigns |
| Agents | סוכנים | Browse and assign agents |
| QR Analytics | אנליטיקס QR | Track QR code scans |
| History | היסטוריה | View past approved/rejected ads |
| Payments | תשלומים | Process payments |

### Step 1: Create a Campaign

1. Go to **"קמפיינים"** (Campaigns) tab
2. Click **"צור קמפיין חדש"** (Create New Campaign)
3. Fill in campaign details:
   - **Campaign Name**: Descriptive name for the campaign
   - **Description**: What the campaign is about
   - **Budget**: Total budget for the campaign
   - **Target Audience:**: Define the target audience
   - **Budget**: Total budget allocated for the campaign
   - **Company Website URL**: Link to the company’s website
   - **Select Agents for the Campaign**: Choose one agent to participate in the campaign, including their rating and contact information
4. Click **" צור קמפיין"** (Create) to save the campaign

### Step 2: Review Price Proposals

1. Go to **"הצעות מחיר"** (Proposals) tab
2. View proposals submitted by agents for your campaigns
3. For each proposal, you can:
   - **Accept**
   - **Reject**

### Step 3: Assign Agents Directly

1. Go to **"סוכנים"** (Agents) tab
2. Browse available agents
3. Filter by:
   - Rating
   - Specialization
4. Click on an agent to view their profile
5. Click **"הקצה לקמפיין"** (Assign to Campaign) to assign them

### Step 4: Review Pending Ads

1. Go to **"מודעות ממתינות"** (Pending Ads) tab
2. View all ads submitted by agents
3. For each ad:
   - Preview the ad design
   - Read the ad copy/text
   - Check if it meets campaign requirements
4. Actions:
   - **אשר** (Approve): Accept the ad
   - **דחה** (Reject): Reject with optional feedback

### Step 5: Process Payments
After the company approves an ad, the agent can share it. Once the agent confirms that the ad has been shared, a payment request email is sent. When the company clicks **"שלם"**, a hypothetical (HYP) payment simulation is displayed, and the agent receives a payment confirmation.

### Step 6: Track Performance

1. Go to **"אנליטיקס QR"** (QR Analytics) tab
2. View statistics:
   - Total QR scans
   - Scans by date

---

## 1.4 Agent Guide

### Dashboard Overview

After logging in as an Agent, you'll see the Agent Dashboard with:

| Section | Hebrew | Purpose |
|---------|--------|---------|
| Statistics | סטטיסטיקות | Your performance metrics |
| My Campaigns | הקמפיינים שלי | Campaigns you're assigned to |
| My Ads | המודעות שלי | Ads you've created |
| Ad Generator | יצירת מודעה | Create new ads with AI |
| QR Analytics | אנליטיקס | Track your ad performance |
| Profile | פרופיל | Manage your profile |

### Step 1: Complete Your Profile

1. Click on **"פרופיל"** (Profile) in the navigation
2. Add your details:
   - Profile picture
   - Bio/description
   - Specializations (e.g., food, technology, fashion)
   - Contact information
3. A complete profile increases your chances of being selected

### Step 2: Browse Available Campaigns

1. Go to **"הקמפיינים שלי"** (My Campaigns)
2. View campaigns you're assigned to
3. Click on a campaign to see details:
   - Campaign requirements
   - Budget
   - Deadline
   - Company information

### Step 3: Submit Price Proposal

1. Go to **"הקמפיינים שלי"** and select a campaign.
2. Click **"הסכום המוצע** (Proposed Amount)
3. Enter your proposed price
4. Add a message explaining your approach
5. Wait for company approval

### Step 4: Generate Ads with AI

1. Go to **"יצירת מודעה"** (Ad Generator)
2. Select the campaign you're creating the ad for
3. Fill in ad details:
   - **Product/Service**: What you're advertising
   - **Target Audience**: Who the ad is for
   - **Key Message**: Main point to convey
   - **Style**: Visual style preference
4. Click **"צור מודעה"** (Generate Ad)
5. The AI will generate:
   - Ad headline (from Pexels)
   - Ad body text (from Pexels)
   - Background image (from Pexels)
   - QR code that takes you to the company website for tracking. 
   - Complete ad design
6. Review the generated ad
7. Options:
   - **אהבתי-שלח לאישור** (Submit for Approval): Send to company
   - **צור מחדש** (Regenerate): Generate a new 

### Step 5: Track Your Ads

1. Go to **"המודעות שלי"** (My Ads)
2. View all your ads with status:
   - **ממתין** (Pending): Waiting for review
   - **מאושר** (Approved): Accepted by company
   - **נדחה** (Rejected): Rejected with feedback
3. For approved ads:
   - View QR code
   - Download ad image
   - Share on social media

### Step 6: Monitor Performance

1. Go to **"אנליטיקס"** (Analytics)
2. View your statistics: QR scan counts
3. Track individual ad performance

### Tips for Success

- Complete your profile fully
- Respond quickly to campaign opportunities
- Follow campaign requirements carefully
- Create high-quality, relevant ads
- Maintain a high approval rate

---

## 1.5 Admin Guide

### Accessing Admin Dashboard

1. Register with the admin secret code
2. Login with your admin credentials
3. You'll be redirected to the Admin Dashboard

### Admin Capabilities

| Feature | Description |
|---------|-------------|
| User Management | View, edit, or remove users |
| Platform Statistics | Monitor overall platform metrics |
| Content Moderation | Review and remove inappropriate content |
| System Health | Monitor API status and performance |

### Managing Users

1. View all registered users (companies and agents)
2. Filter by user type, registration date, activity
3. Actions:
   - View user details
   - Disable/enable accounts
   - Remove users if necessary

### Monitoring Platform

1. View real-time statistics:
   - Total users
   - Active campaigns
   - Ads generated
2. Identify issues or anomalies

---

## 1.6 Common Features

### FAQ & Help Page

Access the help center at: **https://adsmaker-rho.vercel.app/faq**

Or click the floating **"?"** help button visible on all pages.

The FAQ includes:
- General questions about the platform
- Company-specific guides
- Agent-specific guides
- Technical support

### QR Code Tracking

Every ad receives a unique QR code that:
- Redirects to the advertised content
- Tracks scan statistics
- Provides analytics

### Notifications

The platform sends email notifications for:
- New price proposals (Companies)
- Ad approval/rejection (Agents)
- Payment confirmations
- Campaign updates

### Contact Support

1. Visit the landing page
2. Scroll to **"צור קשר"** (Contact) section
3. Fill in the contact form:
   - Name
   - Email
   - Message
4. Submit and wait for response (within 24 hours)

---

# Part 2: Developer Guide

## 2.1 System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                    │
│              (Companies, Agents, Admins)                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                            │
│                                                                 │
│  URL: https://adsmaker-rho.vercel.app                          │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   React     │  │   Vite      │  │   React     │            │
│  │   18        │  │   5         │  │   Router    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  Components: SharedHeader, Dashboards, Pages, Forms            │
│  State: AuthContext, DataContext                               │
│  Services: companyService, qrService                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS API Calls
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Render)                             │
│                                                                 │
│  URL: https://adsmaker.onrender.com                            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Express   │  │   Node.js   │  │   JWT       │            │
│  │   REST API  │  │   Runtime   │  │   Auth      │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  Routes: /api/auth, /api/campaigns, /api/ads, etc.            │
│  Services: geminiService, pexelsService, canvasService        │
│  Jobs: paymentReminder, unsharedAdsChecker                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┬───────────────┐
          ▼               ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   MongoDB    │  │   Google     │  │   Pexels     │  │   Stripe     │
│   Atlas      │  │   Gemini AI  │  │   API        │  │   Payments   │
│              │  │              │  │              │  │              │
│  Database    │  │  AI Text     │  │  Stock       │  │  Payment     │
│  Storage     │  │  Generation  │  │  Photos      │  │  Processing  │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 | UI Framework |
| Frontend | Vite 5 | Build Tool & Dev Server |
| Frontend | React Router v6 | Client-side Routing |
| Frontend | Recharts | Data Visualization |
| Backend | Node.js | Runtime Environment |
| Backend | Express.js | HTTP Server & Routing |
| Backend | Mongoose | MongoDB ODM |
| Database | MongoDB Atlas | Cloud Database |
| AI | Google Gemini | Text Generation |
| Images | Pexels API | Stock Photos |
| Images | @napi-rs/canvas | Server-side Rendering |
| Payments | Stripe | Payment Processing |
| Email | SendGrid | Email Service |
| Auth | JWT + bcryptjs | Authentication |

---

## 2.2 Frontend Structure

### Directory Layout

```
client/
├── src/
│   ├── main.jsx                 # Entry point, renders App
│   ├── App.jsx                  # Route definitions
│   ├── index.css                # Global styles
│   │
│   ├── components/              # Reusable UI components
│   │   ├── SharedHeader.jsx     # Navigation bar (all dashboards)
│   │   ├── SharedHeader.css
│   │   ├── HelpButton.jsx       # Floating help button
│   │   ├── HelpButton.css
│   │   ├── ProtectedRoute.jsx   # Auth route wrapper
│   │   ├── QRGenerator.jsx      # QR code generation
│   │   ├── PaymentForm.jsx      # Stripe payment form
│   │   ├── CompanyQRAnalytics.jsx
│   │   └── OnboardingGuide/     # User onboarding tour
│   │
│   ├── pages/                   # Page components
│   │   ├── LandingPage.jsx      # Public homepage
│   │   ├── Login.jsx            # Login form
│   │   ├── Register.jsx         # Registration form
│   │   ├── CompanyDashboard.jsx # Company main dashboard
│   │   ├── AgentDashboard.jsx   # Agent main dashboard
│   │   ├── AdminDashboard.jsx   # Admin main dashboard
│   │   ├── AdGeneratorM.jsx     # AI ad generation page
│   │   ├── MyCampaigns.jsx      # Agent's campaigns
│   │   ├── MyAds.jsx            # Agent's ads
│   │   ├── QRAnalytics.jsx      # QR tracking analytics
│   │   ├── FAQHelp.jsx          # FAQ & Help page
│   │   ├── PrivacyPolicy.jsx    # Privacy policy
│   │   └── TermsOfService.jsx   # Terms of service
│   │
│   ├── context/                 # React Context providers
│   │   ├── AuthContext.jsx      # Authentication state
│   │   └── DataContext.jsx      # Application data state
│   │
│   └── services/                # API service functions
│       ├── companyService.js    # Company API calls
│       └── qrService.js         # QR code API calls
│
├── public/                      # Static assets
├── vite.config.js               # Vite configuration
└── package.json                 # Dependencies & scripts
```

### Key Components

#### AuthContext (`context/AuthContext.jsx`)

Manages authentication state across the application:

```javascript
// Provides:
- user           // Current user object
- token          // JWT token
- login()        // Login function
- logout()       // Logout function
- register()     // Registration function
- isAuthenticated // Boolean auth status
```

#### ProtectedRoute (`components/ProtectedRoute.jsx`)

Wraps routes that require authentication:

```javascript
<ProtectedRoute requiredUserType="company">
  <CompanyDashboard />
</ProtectedRoute>
```

#### SharedHeader (`components/SharedHeader.jsx`)

Navigation bar used across all authenticated pages:
- Logo linking to appropriate dashboard
- Navigation dropdown (FAQ, Privacy, Terms)
- User greeting
- Logout button

### Routing Structure

| Path | Component | Access |
|------|-----------|--------|
| `/` | LandingPage | Public |
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/faq` | FAQHelp | Public |
| `/company-dashboard` | CompanyDashboard | Company only |
| `/agent-dashboard` | AgentDashboard | Agent only |
| `/admin-dashboard` | AdminDashboard | Admin only |
| `/ad-generator` | AdGeneratorM | Agent only |
| `/my-campaigns` | MyCampaigns | Agent only |
| `/my-ads` | MyAds | Agent only |
| `/qr-analytics` | QRAnalytics | Agent only |

### State Management

The application uses React Context for global state:

1. **AuthContext**: User authentication, JWT tokens
2. **DataContext**: Application data caching

Local component state is managed with `useState` and `useEffect` hooks.

---

## 2.3 Backend Structure

### Directory Layout

```
server/
├── server.js                    # Entry point
│
├── config/
│   ├── database.js              # MongoDB connection
│   ├── cors.js                  # CORS configuration
│   └── stripe.js                # Stripe initialization
│
├── middleware/
│   ├── auth.js                  # JWT verification
│   └── adminAuth.js             # Admin-only verification
│
├── models/                      # Mongoose schemas
│   ├── User.js                  # User model
│   ├── Company.js               # Company profile
│   ├── Campaign.js              # Campaign model
│   ├── Ad.js                    # Approved ads
│   ├── PendingAd.js             # Pending ads for review
│   ├── Payment.js               # Payment records
│   ├── PriceProposal.js         # Agent proposals
│   ├── QRScan.js                # QR scan tracking
│   ├── AgentRating.js           # Agent ratings
│   └── GeminiRateLimit.js       # AI rate limiting
│
├── routes/                      # API endpoints
│   ├── auth.js                  # /api/auth/*
│   ├── companies.js             # /api/companies/*
│   ├── campaigns.js             # /api/campaigns/*
│   ├── ads.js                   # /api/ads/*
│   ├── pendingAds.js            # /api/pending-ads/*
│   ├── agents.js                # /api/agents/*
│   ├── qr.js                    # /api/qr/*
│   ├── analytics.js             # /api/analytics/*
│   ├── payments.js              # /api/payments/*
│   ├── priceProposals.js        # /api/price-proposals/*
│   ├── admin.js                 # /api/admin/*
│   ├── contact.js               # /api/contact
│   └── redirect.js              # /r/* (QR redirects)
│
├── controllers/
│   └── adController.js          # Ad generation logic
│
├── services/
│   ├── geminiService.js         # Google Gemini AI
│   ├── pexelsService.js         # Pexels stock photos
│   ├── canvasService.js         # Image rendering
│   ├── unsharedAdsChecker.js    # Background job
│   └── lowPerformanceChecker.js # Background job
│
└── jobs/
    └── paymentReminder.js       # Payment checking
```

### Server Initialization (`server.js`)

The server performs the following on startup:

1. Load environment variables from `.env`
2. Connect to MongoDB via `connectDatabase()`
3. Configure middleware (CORS, JSON parsing, multer)
4. Mount all API routes
5. Inject helpers into services (Gemini, Pexels, Canvas)
6. Start background jobs

### Middleware

#### Authentication (`middleware/auth.js`)

```javascript
// Verifies JWT token from Authorization header
// Attaches user object to req.user
// Returns 401 if token is invalid/missing
```

#### Admin Authentication (`middleware/adminAuth.js`)

```javascript
// Extends auth middleware
// Additionally checks if user.userType === 'admin'
// Returns 403 if not admin
```

### CORS Configuration (`config/cors.js`)

Allowed origins:
- `https://adsmaker-frontend.vercel.app`
- `https://adsmaker-rho.vercel.app`
- `https://adsmaker.onrender.com`
- Vercel preview deployments (`adsmaker-*.vercel.app`)

---

## 2.4 Database Models

### User Model

```javascript
{
  email: String (unique, required),
  password: String (hashed, required),
  name: String (required),
  userType: String (enum: 'company', 'agent', 'admin'),
  createdAt: Date,
  lastLogin: Date
}
```

### Campaign Model

```javascript
{
  company: ObjectId (ref: User),
  name: String,
  description: String,
  budget: Number,
  startDate: Date,
  endDate: Date,
  requirements: String,
  status: String (enum: 'active', 'paused', 'completed'),
  assignedAgents: [ObjectId],
  createdAt: Date
}
```

### Ad Model (Approved)

```javascript
{
  campaign: ObjectId (ref: Campaign),
  agent: ObjectId (ref: User),
  company: ObjectId (ref: User),
  headline: String,
  bodyText: String,
  imageUrl: String,
  designUrl: String,
  qrCode: String,
  shortUrl: String,
  status: String,
  approvedAt: Date,
  createdAt: Date
}
```

### PendingAd Model

```javascript
{
  campaign: ObjectId (ref: Campaign),
  agent: ObjectId (ref: User),
  headline: String,
  bodyText: String,
  imageUrl: String,
  designUrl: String,
  status: String (enum: 'pending', 'approved', 'rejected'),
  feedback: String,
  submittedAt: Date
}
```

### QRScan Model

```javascript
{
  ad: ObjectId (ref: Ad),
  scannedAt: Date,
  ipAddress: String,
  userAgent: String,
  country: String,
  city: String,
  device: String
}
```

---

## 2.5 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout user |

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List campaigns |
| POST | `/api/campaigns` | Create campaign |
| GET | `/api/campaigns/:id` | Get campaign details |
| PUT | `/api/campaigns/:id` | Update campaign |
| DELETE | `/api/campaigns/:id` | Delete campaign |

### Ads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ads` | List approved ads |
| GET | `/api/ads/:id` | Get ad details |
| POST | `/api/generate-ad` | Generate ad with AI |
| GET | `/api/pending-ads` | List pending ads |
| PUT | `/api/pending-ads/:id/approve` | Approve ad |
| PUT | `/api/pending-ads/:id/reject` | Reject ad |

### Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List agents |
| GET | `/api/agents/:id` | Get agent profile |
| PUT | `/api/agents/:id` | Update agent profile |

### QR & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/qr/:adId` | Get QR code for ad |
| POST | `/api/qr/scan` | Record QR scan |
| GET | `/api/analytics/overview` | Get analytics overview |
| GET | `/api/analytics/ad/:id` | Get ad analytics |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/create-intent` | Create payment intent |
| POST | `/api/payments/confirm` | Confirm payment |
| GET | `/api/payments/history` | Get payment history |

### Price Proposals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/price-proposals` | List proposals |
| POST | `/api/price-proposals` | Submit proposal |
| PUT | `/api/price-proposals/:id/accept` | Accept proposal |
| PUT | `/api/price-proposals/:id/reject` | Reject proposal |

---

## 2.6 Authentication Flow

### Registration Flow

```
1. User submits registration form
   ↓
2. Frontend POST /api/auth/register
   ↓
3. Backend validates input
   ↓
4. Password hashed with bcryptjs
   ↓
5. User saved to MongoDB
   ↓
6. JWT token generated
   ↓
7. Token returned to frontend
   ↓
8. Frontend stores token in localStorage
   ↓
9. User redirected to dashboard
```

### Login Flow

```
1. User submits login form
   ↓
2. Frontend POST /api/auth/login
   ↓
3. Backend finds user by email
   ↓
4. Password compared with bcryptjs
   ↓
5. JWT token generated (24h expiry)
   ↓
6. Token returned to frontend
   ↓
7. Frontend stores token in localStorage
   ↓
8. AuthContext updated with user
   ↓
9. User redirected to role-specific dashboard
```

### Protected Request Flow

```
1. Frontend makes API request
   ↓
2. Authorization header: "Bearer <token>"
   ↓
3. auth middleware extracts token
   ↓
4. JWT verified with JWT_SECRET
   ↓
5. User ID extracted from token
   ↓
6. User fetched from database
   ↓
7. req.user populated
   ↓
8. Route handler executed
```

---

## 2.7 Key Features Implementation

### AI Ad Generation

```
1. Agent fills ad generation form
   ↓
2. Frontend POST /api/generate-ad (multipart)
   ↓
3. Backend validates campaign access
   ↓
4. geminiService.callGeminiWithRetry()
   - Builds prompt with product/audience/message
   - Calls Google Gemini API
   - Returns headline + body text
   ↓
5. pexelsService.searchPexelsImage()
   - Searches for relevant stock photo
   - Returns image URL
   ↓
6. canvasService.createAdDesignOnServer()
   - Downloads background image
   - Renders text overlay
   - Returns base64 image
   ↓
7. PendingAd created in database
   ↓
8. Response returned to frontend
```

### QR Code Tracking

```
1. Ad approved → QR code generated
   ↓
2. QR encodes: https://adsmaker.onrender.com/r/<shortId>
   ↓
3. User scans QR code
   ↓
4. GET /r/<shortId>
   ↓
5. Backend records scan:
   - IP address
   - User agent
   - Timestamp
   - Geo-location (if available)
   ↓
6. User redirected to target URL
   ↓
7. Analytics updated in real-time
```

### Payment Processing

```
1. Company clicks "Pay" for approved ad
   ↓
2. Frontend POST /api/payments/create-intent
   ↓
3. Backend creates Stripe PaymentIntent
   ↓
4. Client secret returned to frontend
   ↓
5. Stripe.js renders payment form
   ↓
6. User enters card details
   ↓
7. Payment confirmed via Stripe
   ↓
8. Webhook confirms payment
   ↓
9. Payment record created
   ↓
10. Agent notified of payment
```

---

## 2.8 Maintenance & Monitoring

### Environment Variables (Render)

Required environment variables on Render backend:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret for JWT signing |
| `ADMIN_SECRET` | Secret for admin registration |
| `PORT` | Server port (Render sets this) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `PEXELS_API_KEY` | Pexels API key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `SENDGRID_API_KEY` | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Sender email address |

### Environment Variables (Vercel)

Required environment variables on Vercel frontend:

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend URL (`https://adsmaker.onrender.com`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |

### Monitoring

#### Backend Health Check

```
GET https://adsmaker.onrender.com/health
Response: { "status": "healthy" }
```

#### Frontend Status

Check Vercel dashboard for:
- Build status
- Deployment logs
- Error tracking

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| API calls failing | Check CORS configuration, verify backend is running |
| Auth not working | Verify JWT_SECRET matches, check token expiry |
| AI generation failing | Check Gemini API key, rate limits |
| Payments failing | Verify Stripe keys, check webhook configuration |
| Database errors | Check MongoDB Atlas connection, IP whitelist |

### Background Jobs

The server runs these scheduled jobs:

1. **Unshared Ads Checker**: Monitors ads that haven't been shared
2. **Low Performance Checker**: Flags underperforming ads
3. **Payment Reminder**: Checks for overdue payments (runs hourly)

### Updating the Platform

#### Frontend Updates (Vercel)

1. Push changes to GitHub
2. Vercel automatically rebuilds
3. New version deployed in ~1-2 minutes

#### Backend Updates (Render)

1. Push changes to GitHub
2. Render automatically rebuilds
3. New version deployed in ~3-5 minutes

### Database Backup

MongoDB Atlas provides:
- Automatic daily backups
- Point-in-time recovery
- Manual backup on demand

Access via MongoDB Atlas dashboard.

---

## Quick Reference

### URLs

| Service | URL |
|---------|-----|
| Frontend | https://adsmaker-rho.vercel.app |
| Backend | https://adsmaker.onrender.com |
| API Base | https://adsmaker.onrender.com/api |
| Health Check | https://adsmaker.onrender.com/health |

### Support

- **Email**: hilamaayan99@gmail.com
- **FAQ**: https://adsmaker-rho.vercel.app/faq
- **Contact Form**: https://adsmaker-rho.vercel.app/#contact

---

*Last updated: January 2026*
