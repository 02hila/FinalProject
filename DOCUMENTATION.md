# AdsMaker -- Project Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Backend](#5-backend)
   - [Entry Point](#51-entry-point)
   - [Configuration](#52-configuration)
   - [Database Models](#53-database-models)
   - [Middleware](#54-middleware)
   - [Controllers](#55-controllers)
   - [Services](#56-services)
   - [Routes](#57-routes)
   - [Background Jobs](#58-background-jobs)
   - [Scripts](#59-scripts)
   - [Utility and Test Scripts](#510-utility-and-test-scripts)
6. [Frontend](#6-frontend)
   - [Entry Point and Routing](#61-entry-point-and-routing)
   - [Context Providers](#62-context-providers)
   - [Pages](#63-pages)
   - [Reusable Components](#64-reusable-components)
   - [Client Services](#65-client-services)
   - [Build Configuration](#66-build-configuration)
   - [CSS Files](#67-css-files)
7. [API Reference](#7-api-reference)
8. [Environment Variables](#8-environment-variables)

---

## 1. Project Overview

AdsMaker is a full-stack platform for generating, managing, and tracking AI-powered advertisements. It was built with the Israeli market in mind and supports Hebrew.

The system revolves around three user roles:

- **Companies** set up advertising campaigns, review the ads that agents submit, approve or reject them, and handle payments through Stripe but now with hyp simulation.
- **Agents** get assigned to campaigns by companies, use the built-in AI tools to generate ad creatives, then share approved ads on social media and earn commissions for doing so.
- **Admins** have a bird's-eye view of the entire platform and can manage users, monitor system-wide metrics, and remove content.

Under the hood, ad generation works like this: the server sends a structured prompt to Google Gemini to produce marketing copy, pulls a relevant stock photo from the Pexels API, and composites everything into a finished ad image using server-side Canvas rendering. If the campaign has a website URL, the system also generates a QR code that points to a tracked short link with UTM parameters baked in, so companies can see exactly how many people scanned and visited.

There are also background services running on a schedule that watch for underperforming or unshared ads and automatically create improved alternatives using the same AI pipeline.

---

## 2. Architecture

The application follows a standard client-server split. The frontend is a React single-page application served from Vercel. The backend is an Express.js REST API deployed on Render, backed by MongoDB Atlas.

```
Client (React + Vite)          Server (Express.js)           External Services
+--------------------+        +---------------------+       +------------------+
|                    |  HTTP  |                     |       |                  |
|  React SPA         |------->|  REST API           |------>|  Google Gemini   |
|  (Vercel)          |<-------|  (Render)           |<------|  (AI text gen)   |
|                    |        |                     |       |                  |
|  - Auth Context    |        |  - Express Routes   |------>|  Pexels API      |
|  - Protected Routes|        |  - Mongoose Models  |<------|  (stock photos)  |
|  - Stripe Elements |        |  - Canvas Renderer  |       |                  |
|  - Recharts        |        |  - Background Jobs  |------>|  Stripe          |
|                    |        |  - Rate Limiter     |<------|  (payments)      |
+--------------------+        |                     |       |                  |
                              |                     |------>|  SendGrid        |
                              |                     |       |  (emails)        |
                              +----------+----------+       |                  |
                                         |                  |  MongoDB Atlas   |
                                         +----------------->|  (database)      |
                                                            +------------------+
```

### How ad generation flows through the system

1. An agent picks a campaign and fills out details: what the product is, what message to convey, the tone, and which language to write in.
2. The server builds a structured prompt and sends it to Google Gemini. Gemini returns JSON containing the ad headline, body copy, a call-to-action line, and suggested image search keywords.
3. The server takes those keywords and hits the Pexels API to find a matching stock photo.
4. A Canvas renderer on the server composites the final ad image: the stock photo as a background, text overlaid on top, styled according to the chosen theme (modern, minimal, elegant, or dark), with a reserved zone on the right side for a QR code if the campaign has a website URL.
5. If there is a website URL, the server generates a QR code pointing to a tracked short URL and embeds it into the image using the sharp library.
6. The finished ad is stored as a "pending ad" and waits for the company to review and approve or reject it.

---

## 3. Technology Stack

### Backend
| Technology | Role |
|---|---|
| Node.js + Express.js | REST API server |
| MongoDB (via Mongoose) | Database and ODM |
| JWT + bcryptjs | Authentication and password hashing |
| Google Gemini API | AI-generated ad copy |
| Pexels API | Stock photo search |
| @napi-rs/canvas (with canvas fallback) | Server-side image rendering |
| sharp | Image compositing (QR embedding) |
| qrcode | QR code generation |
| Stripe | Payment processing |
| SendGrid (@sendgrid/mail) | Transactional email |
| multer | Multipart file uploads |
| axios | HTTP client for external APIs |

### Frontend
| Technology | Role |
|---|---|
| React 18 | UI framework |
| Vite | Build tool and dev server |
| React Router v6 | Client-side routing |
| Recharts | Charts and data visualizations |
| @stripe/react-stripe-js | Payment UI integration |
| CSS (external files + inline styles) | Styling |

### Hosting
| Service | What it runs |
|---|---|
| Render | Backend API |
| Vercel | Frontend SPA |
| MongoDB Atlas | Managed database |

---

## 4. Project Structure

```
FinalProject/
|-- client/                              # React frontend
|   |-- public/                          # Static assets
|   |-- src/
|   |   |-- components/                  # Shared UI components
|   |   |   |-- CampaignAssignmentPopup/ # New-assignment notification popup
|   |   |   |-- OnboardingGuide/         # Step-by-step guided tour
|   |   |   |-- CompanyQRAnalytics.jsx   # QR analytics for companies
|   |   |   |-- ExpandableText.jsx       # Text truncation with expand toggle
|   |   |   |-- PageSelectorModal.jsx    # Social media page picker
|   |   |   |-- PaymentForm.jsx          # Stripe payment form
|   |   |   |-- PaymentSection.jsx       # Payment list and processing
|   |   |   |-- ProtectedRoute.jsx       # Auth and role-based route guard
|   |   |   |-- QRGenerator.jsx          # QR code creation wizard
|   |   |   |-- SharedHeader.jsx         # Navigation header bar
|   |   |   +-- Sharemodal.jsx           # Social sharing modal
|   |   |-- context/
|   |   |   |-- AuthContext.jsx          # Auth state (login, register, session)
|   |   |   +-- DataContext.jsx          # Unused placeholder
|   |   |-- pages/
|   |   |   |-- AdGeneratorM.jsx         # Ad generator (production version)
|   |   |   |-- Adgenerator.jsx          # Ad generator (CSS version, unused)
|   |   |   |-- AdminDashboard.jsx       # Admin panel
|   |   |   |-- AgentDashboard.jsx       # Agent home screen
|   |   |   |-- AgentProfile.jsx         # Agent profile editor
|   |   |   |-- CompanyDashboard.jsx     # Company management hub
|   |   |   |-- CompanyDataContext.jsx   # Alternative company data provider
|   |   |   |-- CompanyPayments.jsx      # Payment processing page
|   |   |   |-- Companyprofile.jsx       # Company profile editor
|   |   |   |-- ConfirmRedirect.jsx      # QR scan landing page
|   |   |   |-- Dashboard.jsx            # Role-based redirect
|   |   |   |-- ErrorBoundary.jsx        # Global error fallback
|   |   |   |-- LandingPage.jsx          # Public homepage
|   |   |   |-- Login.jsx                # Login form
|   |   |   |-- MyCampaigns.jsx          # Agent's campaign list
|   |   |   |-- MyAds.jsx               # Agent's ad portfolio
|   |   |   |-- PrivacyPolicy.jsx        # Privacy policy (Hebrew)
|   |   |   |-- QRAnalytics.jsx          # QR analytics for agents
|   |   |   |-- Register.jsx             # Registration form
|   |   |   +-- TermsOfService.jsx       # Terms of service (Hebrew)
|   |   |-- services/
|   |   |   |-- companyService.js        # API client for company operations
|   |   |   +-- qrService.js            # API client for QR and analytics
|   |   |-- App.jsx                      # Root component, route table
|   |   |-- App.css                      # Global styles
|   |   |-- main.jsx                     # React entry point
|   |   +-- index.css                    # Base styles
|   |-- vite.config.js                   # Vite build config
|   |-- eslint.config.js                 # Linter config
|   |-- vercel.json                      # Vercel deployment config
|   +-- package.json
|
|-- server/                              # Express backend
|   |-- config/
|   |   |-- cors.js                      # CORS origin whitelist
|   |   |-- database.js                  # MongoDB connection
|   |   +-- stripe.js                    # Stripe SDK init
|   |-- controllers/
|   |   +-- adController.js             # Ad generation and QR embedding
|   |-- middleware/
|   |   |-- auth.js                      # JWT auth + role checking
|   |   +-- adminAuth.js                 # Admin-only middleware (duplicate)
|   |-- models/
|   |   |-- Ad.js                        # Quote schema (legacy naming)
|   |   |-- AgentRating.js               # Rating records
|   |   |-- Campaign.js                  # Campaigns
|   |   |-- Company.js                   # Standalone company entity
|   |   |-- GeminiRateLimit.js           # API usage tracking
|   |   |-- InviteCode.js               # Invitation codes
|   |   |-- Payment.js                   # Payment records
|   |   |-- PendingAd.js                 # Ads with approval workflow
|   |   |-- PriceProposal.js             # Price negotiations
|   |   |-- QRScan.js                    # QR scan tracking
|   |   |-- Quote.js                     # Agent-to-company quotes
|   |   +-- User.js                      # All user types
|   |-- routes/                          # 23 route files + 1 legacy (see section 5.7)
|   |-- services/
|   |   |-- canvasService.js             # Ad image renderer
|   |   |-- companyService.js            # Misplaced client-side duplicate
|   |   |-- emailService.js              # SendGrid email templates
|   |   |-- geminiRateLimiter.js         # Daily generation limit
|   |   |-- geminiService.js             # Gemini API with multi-key retry
|   |   |-- lowPerformanceChecker.js     # Background: low-scan detection
|   |   |-- pexelsService.js             # Pexels photo search
|   |   +-- unsharedAdsChecker.js        # Background: unshared ad detection
|   |-- jobs/
|   |   +-- paymentReminder.js           # Overdue payment checker
|   |-- scripts/
|   |   +-- add-unique-ids-to-existing-ads.js  # One-time migration
|   |-- server.js                        # Main entry point
|   |-- ai.js                            # AI utility routes (legacy)
|   |-- check-pending-ads.js             # Debug: list all pending ads
|   |-- simple-test.js                   # Debug: test nodemailer import
|   |-- test-email.js                    # Debug: test Gmail email delivery
|   +-- package.json
|
|-- testGenerateAd.js                    # Gemini API test script
+-- package.json                         # Root package (deployment)
```

---

## 5. Backend

### 5.1. Entry Point

**`server/server.js`**

This is the main file that boots up the Express application. Here is what it does, in order:

1. Connects to MongoDB through the database config module.
2. Sets up middleware: CORS with a custom origin whitelist, JSON body parsing (10MB limit), and URL-encoded form parsing.
3. Mounts every route module under its respective path prefix. The full mapping is listed in section 7.
4. Registers the `POST /api/generate-ad` endpoint using `multer` for optional image uploads.
5. Passes shared service functions into the ad improvement router and the two background checker services via an `injectHelpers()` pattern. This avoids circular `require()` dependencies: the background services need `createAdDesignOnServer`, `callGeminiWithRetry`, `buildGeminiAdAndImagePrompt`, and `searchPexelsImage`, but importing them directly would create a circular chain through `server.js`.
7. Starts the unshared ads checker and low performance checker background services.
8. Sets up the payment reminder job on an hourly interval, with an initial run 10 seconds after startup.


---

### 5.2. Configuration

**`server/config/database.js`**

Handles the MongoDB connection. It reads `MONGODB_URI` from environment variables and calls `mongoose.connect()`. If the connection fails, it logs the error and exits the process with code 1 -- there is no point running the server without a database.

Exports: `connectDatabase()` (async).

---

**`server/config/cors.js`**

Defines which origins are allowed to make cross-origin requests. The whitelist includes:

- The production Vercel frontend URL
- Any Vercel preview deployment URL (matched with a regex)

It is worth noting that the current implementation logs a warning for unrecognized origins but still lets them through. This makes development easier but is more permissive than a strict production setup would be.

Exports: `corsOptions` (the config object) and `allowedOrigins` (the whitelist array).

---

**`server/config/stripe.js`**

Initializes the Stripe SDK with the `STRIPE_SECRET_KEY` from environment variables, pinned to API version `2023-10-16`.

Exports: the configured Stripe client instance.

---

### 5.3. Database Models

#### `server/models/User.js`

This is the central user model. Rather than having separate collections for agents, companies, and admins, the application uses a single `users` collection with a `userType` discriminator field. Each user type has its own set of optional fields.

Common fields that all users have: `email` (unique, lowercased), `password` (bcrypt-hashed), `fullName`, `userType` (one of `agent`, `company`, `admin`), `phone`, `isActive`, `isVerified`, `lastLogin`, `hasSeenGuide`, `createdAt`, `updatedAt`.

Agent-specific fields: `specialty` (social, google, creative, analytics, or general), `bio`, `skills`, `socialMediaPlatform`, `socialMediaHandle`.

Company-specific fields: `companyName`, `description`, `industry`, `companySize`, `website`, `address`, `contactPerson`.

Both types carry a `stats` object with counters -- agents track ratings and ad counts, companies track campaigns and agent counts.

Agents also have a `seenCampaignAssignments` array that stores ObjectIds of campaigns whose assignment notification the agent has already dismissed.

The model has a pre-save hook that hashes passwords with bcrypt (10 rounds) whenever the password field changes.

Key instance methods:

- `comparePassword(candidatePassword)` -- bcrypt comparison against the stored hash. Used during login.
- `updateStats(statsUpdate)` -- merges a partial stats object into the existing one and saves.
- `calculateAverageRating(ratings)` -- given an array of rating documents, computes the average and total count, then sets them on the stats object.

There is a virtual field `approvalRate` that computes `(totalApproved / totalAds) * 100`. The schema is configured to include virtuals in JSON and plain object serialization.

Indexes: `email`, `userType`, `stats.averageRating` (descending), and `specialty`.

---

#### `server/models/PendingAd.js`

This is the most feature-rich model in the codebase. It represents an advertisement at any stage of the approval workflow -- pending review, approved, or rejected.

Core fields: `uniqueId` (a 6-character hex string for display), `title`, `text`, `callToAction`, `imageData` (base64 PNG), `companyId`, `campaignId`, `agentId`, `status` (pending/approved/rejected), `rejectionReason`, `websiteUrl`.

The `companyFeedback` subdocument holds the optional rating (1--5) and comment a company can leave when approving an ad.

The `qrCode` subdocument stores QR-related data: whether QR is enabled, the QR's own unique ID, the QR image as base64, the short URL, the full target URL, and a scan counter.

The `metadata` field is a Mixed type (essentially free-form JSON) that stores the generation parameters: business name, product, tone, style, language, image keywords, and so on.

The `shareTracking` subdocument tracks the share lifecycle: when the ad was approved, when it was first shared, how many times it has been shared, on which platforms, whether a reminder has been sent for not sharing, and whether an alternative ad has been auto-generated.

For the rejection-and-improvement workflow, there are two fields: `improvementHistory` (an array recording each version of the ad before it was rejected) and `currentRejection` (the most recent rejection details).

The `isAlternative` boolean flag marks ads that the background services generated as replacements for underperforming originals. `originalAdId` links back to the ad it was created to replace.

Instance methods:

- `addRejection(rejectionData)` -- pushes the current ad state onto `improvementHistory`, sets the rejection data and status.
- `addImprovement(improvementData)` -- applies new content (title, text, image, CTA) from the AI improvement and resets the status to pending.
- `recordShare(platform)` -- increments the share count, records the platform and timestamp.
- `markApproved()` -- sets status to approved and initializes the share tracking fields.

---

#### `server/models/Campaign.js`

Represents an advertising campaign that a company creates.

Fields: `title`, `description`, `companyId` (ref to User), `companyName` (denormalized for display), `targetAudience`, `websiteUrl`, `budget` (in ILS), `status` (draft/active/paused/completed), `assignedAgents` (array of User refs), `platform`, `impressions`, `clicks`, `createdAt`.

The `websiteUrl` field is important because it determines whether ads generated under this campaign will include QR codes.

---

#### `server/models/QRScan.js`

Each record represents a unique QR code associated with an ad and tracks every scan that QR receives.

Fields: `uniqueId` (the short URL identifier), `adUniqueId` (links to the ad), `campaignId`, `agentId`, `companyId`, `fullUrl` (the complete short URL), `targetUrl` (the destination with UTM params), `qrImageData` (base64), `scans` (counter), `lastScannedAt`, `scanHistory` (array of individual scans with timestamp, IP, user agent, and referrer), `metadata` (ad title, business name, product), `isDeleted` (soft delete flag).

The `incrementScans()` method bumps the counter and updates `lastScannedAt`.

Compound indexes on `campaignId + scans`, `agentId + lastScannedAt`, and `adUniqueId` support the analytics queries without full collection scans.

---

#### `server/models/Payment.js`

Tracks payment records between companies and agents.

Fields: `adId`, `companyId`, `agentId`, `quoteId`, `amount` (in ILS), `status` (pending/processing/completed/failed/cancelled), `paymentMethod` (object with type, last4, card brand, token), `dueAt`, `paidAt`, `cancelledAt`, `remindersSent` (array of reminder records), `agentNotifiedAt`, `notes`.

The `dueAt` field is set to 24 hours after the ad is shared, giving companies a window to pay before the payment is flagged as overdue.

---

#### `server/models/PriceProposal.js`

When an agent wants to negotiate their fee for a campaign, they submit a price proposal. The company can then approve or reject it.

Fields: `campaignId`, `agentId`, `companyId`, `originalBudget` (the campaign's budget at the time of proposal), `proposedBudget` (what the agent is asking for), `message` (the agent's justification), `status` (pending/approved/rejected), `companyResponse` (message and date).

---

#### `server/models/Quote.js`

A simpler financial record representing a quote from an agent to a company for ad work.

Fields: `agentId`, `companyId`, `adId`, `amount`, `description`, `status` (pending/approved/rejected), `approvedAt`, `rejectedAt`, `createdAt`.

---

#### `server/models/AgentRating.js`

Stores individual rating entries that companies give to agents when approving ads.

Fields: `agentId`, `companyId`, `rating` (1--5), `comment`, `createdAt`.

Has a static method `getAgentAverageRating(agentId)` that runs an aggregation to compute the average and total count for a given agent.

---

#### `server/models/Company.js`

A standalone company entity separate from the User model's company users. This exists for some legacy routes that predate the unified User model.

Fields: `name`, `industry`, `description`, `languages`, `brandColors`, `website`, `createdAt`.

---

#### `server/models/InviteCode.js`

Companies can generate invite codes that agents use to register and get linked to the company.

Fields: `code` (unique), `companyId`, `isUsed`, `usedBy`, plus timestamps.

---

#### `server/models/GeminiRateLimit.js`

Uses a singleton document pattern -- there is exactly one document in this collection, keyed by `key: 'global'`. It tracks how many Gemini API calls have been made today and when the last one happened.

Fields: `key`, `currentDate` (YYYY-MM-DD string that resets the counter when the day changes), `dailyCount`, `lastGenerationAt`, `generations` (array of recent generation records with timestamp, source, and ad ID).

---

#### `server/models/Ad.js`

Despite the filename suggesting it holds an Ad schema, this file actually defines a Quote schema. It appears to be a leftover from an earlier data model. The schema contains quote fields (`agentId`, `companyId`, `adId`, `amount`, `status`) mixed with some ad fields (`isShared`, `paymentStatus`). The actual ad model the system uses day-to-day is PendingAd.

---

### 5.4. Middleware

**`server/middleware/auth.js`**

This is the main authentication module. It exports four middleware functions:

- `authMiddleware` -- the workhorse. Reads the JWT from the `Authorization: Bearer <token>` header, verifies it, loads the corresponding user from the database (excluding the password hash), and attaches `req.userId`, `req.user`, and `req.userType` to the request object. Returns 401 if the token is missing, malformed, expired, or if the user's account is inactive.

- `requireUserType(userType)` -- a factory that returns middleware restricting access to a specific user type. Returns 403 if the authenticated user does not match. Used like `requireUserType('company')`.

- `isAdmin` -- shortcut middleware that checks `req.userType === 'admin'`. Returns 403 with a Hebrew-language message if the check fails.

- `isAdminOrCompany` -- same idea, allows either admin or company users through.

**`server/middleware/adminAuth.js`**

Exports `isAdmin` and `isAdminOrCompany` with the same logic as above. This is a duplicate that exists because some route files import from this path. Both modules work identically.

---

### 5.5. Controllers

**`server/controllers/adController.js`**

This controller contains the core ad generation pipeline. It is the most involved piece of business logic on the backend.

**`generateAd(req, res)`** -- mounted at `POST /api/generate-ad`, this function handles the entire lifecycle of creating a new ad. It accepts multipart form data (multer handles an optional image upload).

The processing steps:

1. Validate that the required fields are present: `businessName`, `productService`, `companyId`, `campaignId`, `agentId`.
2. Check with the rate limiter (`canGenerateAd()`) to make sure we have not hit the daily limit or the minimum delay between generations.
3. Load the campaign and the agent from the database.
4. Generate a 6-character hex ID for the new ad using `crypto.randomBytes(3)`.
5. Build a structured prompt and send it to Gemini using `callGeminiWithRetry()`. The prompt asks for a JSON response containing the ad's title, body text, call-to-action, image keywords, and image style hint.
6. Parse the Gemini response. If the JSON parsing fails, the generation is aborted.
7. Get a background image. If the agent uploaded one, use that. Otherwise, search Pexels with the keywords Gemini suggested.
8. Render the final ad image on a server-side Canvas using `createAdDesignOnServer()`.
9. If the campaign has a website URL, generate a QR code: create a unique short URL with UTM parameters (source, medium, campaign), generate the QR image, embed it into the ad image using `embedQrInAd()`, and save a QRScan record to the database.
10. Record the generation in the rate limiter so the daily counter stays accurate.
11. Return the full ad data to the client: the base64 image, the text fields, metadata, and QR info.

**`embedQrInAd(adBuffer, qrDataUrl, language)`** -- takes an existing ad image buffer and a QR code data URL, and composites the QR onto the ad's right-side QR zone using the `sharp` library. It adds a white border around the QR, a "Scan me!" label (or its Hebrew equivalent), and a drop shadow for visual depth. The QR is centered within the reserved zone.

**`getRateLimitStatus(req, res)`** -- a simple endpoint that returns the current state of the Gemini rate limiter: how many generations have been used today, how many remain, and how long until the next one is allowed.

---

### 5.6. Services

#### `server/services/geminiService.js`

This service wraps all communication with the Google Gemini API. Its main job is to make API calls reliable in the face of rate limits, quota exhaustion, and service outages.

**`callGeminiWithRetry(prompt, maxRetries, model)`**

The retry logic uses a triple-nested loop: models, API keys, and retry attempts. The function iterates through three Gemini models (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-2.5-flash-lite`) as a fallback chain. For each model, it tries every available API key. For each key, it retries up to `maxRetries` times (default 3).

When a key gets rate-limited (HTTP 429) or quota-exhausted (HTTP 403), the function marks it as blocked in `global.geminiKeyStatus` with a 60-second expiry and moves on to the next key. Service overload errors (HTTP 503) trigger an exponential backoff wait before retrying.

API keys are loaded from environment variables in two ways: either as a comma-separated list in `GEMINI_API_KEYS`, or as individual variables (`GEMINI_API_KEY`, `GEMINI_API_KEY_two`, `GEMINI_API_KEY_three`, `GEMINI_API_KEY_Four`).

**`buildGeminiAdAndImagePrompt(params)`**

Constructs the prompt that tells Gemini what kind of ad to generate. The prompt instructs Gemini to return a JSON object with fields for `title`, `ad_text`, `call_to_action`, `image_keyword`, and `image_style`. It includes language-specific instructions -- for Hebrew, Arabic, and other languages -- so the generated copy reads naturally in the target language.

**`parseGeminiJsonResponse(responseText)`**

Gemini sometimes wraps its JSON in markdown code fences (` ```json ... ``` `), and sometimes returns raw JSON. This function handles both cases, extracting and parsing the JSON regardless of how Gemini formatted it.

---

#### `server/services/geminiRateLimiter.js`

Controls how many ads the system generates per day to manage API costs. It uses a singleton MongoDB document (a single document in the `geminiratelimits` collection with `key: 'global'`) to persist the counter across server restarts.

The limits are straightforward: 15 generations per day (`DAILY_LIMIT`) with at least 60 seconds between consecutive calls (`MIN_DELAY_MS`). The counter resets automatically at the start of each new day (compared by date string, so it is timezone-naive and effectively resets at midnight UTC).

Exported functions:

- `canGenerateAd()` -- returns `{ allowed: true, remaining }` if a generation is permitted, or `{ allowed: false, error, errorCode, waitTime }` if not. The error codes are `DAILY_LIMIT_REACHED` or `DELAY_REQUIRED`.
- `recordGeneration(source, adId)` -- bumps the daily counter and logs the generation. The `source` parameter tracks where the generation came from (`manual`, `improvement`, `unshared`, `low_performance`). Keeps only the last 50 records.
- `getStatus()` -- returns a snapshot of the current state: count, limit, remaining, last generation time, and whether generation is currently allowed.
- `waitUntilAllowed(maxWaitMs)` -- a polling function that calls `canGenerateAd()` in a loop until it returns allowed or the timeout expires (default 5 minutes). The background services use this so they can queue up and wait rather than giving up immediately.

---

#### `server/services/canvasService.js`

Renders the final ad image on the server using HTML5 Canvas. This is what turns the AI-generated text and stock photo into an actual ad creative.

The canvas library loading has a fallback: it first tries to import `canvas` (node-canvas), and if that fails, it falls back to `@napi-rs/canvas`. This accommodates different deployment environments.

**`createAdDesignOnServer(adData)`**

Produces a PNG image with this layout:

- Total canvas size is either 1050x450 pixels (when a website URL is present, giving 750px for the text zone and 300px for the QR zone) or 900x450 pixels (full width, no QR zone).
- The background stock photo is drawn and clipped to the text section. A semi-transparent overlay goes on top -- the color and opacity depend on the chosen style.
- Text is rendered in layers: the title in the style's accent color (up to 2 lines), the body copy in white (filling the remaining height), and a CTA button centered at the bottom.
- If there is a website URL, the right 300px is a dedicated QR zone with a dashed border placeholder and "SCAN ME!" label. The actual QR is composited in later by `embedQrInAd()`.
- A small "Created by [agent name]" credit appears in the bottom-left corner.

There are four style configurations:

| Style | Overlay | Accent Color | Notes |
|---|---|---|---|
| modern | Black at 50% opacity | Purple-blue (#667eea) | Default style |
| minimal | White at 85% opacity | Dark gray (#333) | Clean, light look |
| elegant | Black at 60% opacity | Gold (#d4af37) | Rich, formal feel |
| dark | Black at 70% opacity | Cyan (#00d4ff) | High-contrast dark theme |

For Hebrew and Arabic text, the renderer switches to right-to-left alignment using Unicode directional markers (RLE and PDF characters around each text segment).

**`cleanAdText(text)`** -- strips out markdown formatting, numbered lists, bullet points, and extra punctuation that the AI sometimes includes in its output.

**`wrapText(ctx, text, maxWidth, isRTL)`** -- breaks text into lines that fit within a pixel width, respecting word boundaries. Handles both LTR and RTL text.

---

#### `server/services/pexelsService.js`

Searches the Pexels stock photo API for images that match the ad's theme.

**`searchPexelsImage(searchTerm, imageStyle)`**

Makes up to three search attempts with progressively broader queries:

1. The exact search term from the AI.
2. The search term plus the image style keyword (if the style name is short enough to add without making the query too long).
3. Just the first word of the search term, as a fallback for when the full term is too specific.

Returns the URL of the best available resolution (`large2x` preferred, then `large`, then `original`) from the first landscape-oriented result. Returns `null` if nothing is found, in which case the canvas renderer falls back to a gradient background.

---

#### `server/services/emailService.js`

Sends emails through SendGrid. Every template is written in Hebrew with RTL HTML layouts using table-based structures (for maximum email client compatibility).

The service has two modes for development and testing:

- **Dry-run mode** (`EMAIL_DRY_RUN=true`): logs email details to the console without actually sending anything.
- **Test mode** (`EMAIL_TEST_ADDRESS` set): redirects all emails to a single address regardless of the intended recipient.

There are seven email functions, each with its own HTML template:

| Function | Goes to | When it fires |
|---|---|---|
| `sendPaymentRequestEmail` | Company | An agent shared their ad and payment is due |
| `sendAlternativeAdEmail` | Agent | Their ad was rejected and an AI alternative was created |
| `sendUnsharedAdReminderEmail` | Agent | They have not shared an approved ad |
| `sendAlternativeAdApprovedEmail` | Agent | An auto-generated alternative ad was approved |
| `sendAlternativeAdCreatedToCompanyEmail` | Company | A new alternative ad needs their review |
| `sendContactFormEmail` | Admin | Someone submitted the contact form |
| `sendTestEmail` | Any address | Verifying the email service works |

---

#### `server/services/lowPerformanceChecker.js`

This is a background service that runs on a schedule and looks for ads that are not getting enough QR scans. When it finds one, it generates an AI-improved alternative automatically.

An ad is flagged when its QR code has received fewer than 5 scans after being live for at least 7 days.

When a flagged ad is found:

1. The service confirms the ad is approved, is not itself an alternative, and does not already have an alternative.
2. It waits for the rate limiter to allow a generation (using `waitUntilAllowed()`).
3. It sends a prompt to Gemini asking for more aggressive, attention-grabbing ad copy -- the prompt explains that the original ad underperformed and requests a different approach.
4. It searches Pexels for a different image, trying up to three times and comparing photo IDs to avoid reusing the same stock photo.
5. It renders the new ad image and saves it as a PendingAd with `isAlternative: true`, linked back to the original via `originalAdId`.
6. It sends an email to the company notifying them that a new alternative is waiting for review.
7. It marks the original ad so it will not be processed again.

The service runs every 12 hours, with an initial run 2 minutes after server startup. Each run processes up to 3 ads, with a 5-second pause between each to stay within rate limits.

The `injectHelpers()` pattern is used here to receive the canvas, Gemini, and Pexels service functions at runtime from `server.js`, avoiding circular module dependencies.

---

#### `server/services/unsharedAdsChecker.js`

Structurally almost identical to the low performance checker, but watches for a different problem: approved ads that agents never shared.

An ad is flagged when it has been approved for more than 5 days and has a share count of zero.

When a flagged ad is found:

1. The service sends a reminder email to the agent about the unshared ad, with tips on how and when to share.
2. It generates an alternative ad via Gemini, asking for a "completely different" marketing angle.
3. It searches Pexels for a different image (with keyword variations like "fresh", "new", "modern" appended to find something distinct from the original).
4. It saves the alternative, notifies the company, and sends the agent another reminder mentioning that an alternative was created.
5. It updates the original ad's `shareTracking.alternativeCreated` flag.

Same schedule as the low performance checker: every 12 hours, up to 3 ads per run, with a staggered initial run (1 minute after startup instead of 2, so the two services do not compete for rate limiter slots).

---

### 5.7. Routes

All route files are Express routers. Each is mounted at a specific path prefix in `server.js`. Below is the full set.

#### `server/routes/auth.js` -- mounted at `/api/auth`

Authentication, registration, and account management.

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/register` | No | Creates a new agent or company user. Returns a JWT token with 7-day expiry. |
| POST | `/login` | No | Authenticates with email and password. Returns a JWT token. |
| GET | `/me` | Yes | Returns the current user's profile. For agents, dynamically computes ad stats from the PendingAd collection. |
| PUT | `/profile` | Yes | Updates profile fields. Explicitly blocks changes to password, email, userType, and stats to prevent privilege escalation. |
| PUT | `/change-password` | Yes | Changes the password. Requires the current password for verification. Enforces a 6-character minimum. |
| POST | `/create-first-admin` | No | Creates the first admin account. Requires a secret key from environment variables. Only works once -- if an admin already exists, it refuses. |
| POST | `/create-admin` | Admin | Creates additional admin accounts. |
| GET | `/all-users` | Admin | Paginated user list with optional type filtering. |
| PUT | `/toggle-user/:userId` | Admin | Toggles a user's active/inactive status. |
| DELETE | `/delete-user/:userId` | Admin | Permanently deletes a user. |

---

#### `server/routes/admin.js` -- mounted at `/api/admin`

System administration. All endpoints except `create-first-admin` require admin authentication.

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/create-first-admin` | No | Same first-admin creation flow as in auth.js. |
| POST | `/create-admin` | Admin | Creates additional admins. |
| GET | `/system-stats` | Admin | Aggregates system-wide numbers: user counts by type, ad counts by status, total campaigns, overall approval rate, and monthly breakdowns for the last 6 months. |
| GET | `/users` | Admin | Paginated user list with filters for userType and text search (matches name, email, or company name). |
| PUT | `/toggle-user/:userId` | Admin | Toggles a user's active status. |
| DELETE | `/delete-user/:userId` | Admin | Deletes a user. |
| GET | `/all-ads` | Admin | Paginated ad list with optional status filter. |
| DELETE | `/delete-ad/:adId` | Admin | Deletes an ad and its associated QRScan records. |

---

#### `server/routes/ads.js` -- mounted at `/api/ads`

Agent-facing endpoints for working with approved ads.

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/` | Agent | Returns all approved ads belonging to the authenticated agent. |
| GET | `/download/:id` | Agent | Sends the ad's image as a downloadable PNG file. |
| GET | `/public/:adId` | No | Returns a public view of an ad (used by the QR redirect landing page). |
| POST | `/click/:adId` | No | Increments the click counter on an ad. Called from the redirect page. |
| POST | `/share/:adId` | Yes | Records that the agent shared an ad on a given platform. |
| GET | `/share-stats/:adId` | Yes | Returns share tracking data for an ad. |

---

#### `server/routes/pendingAds.js` -- mounted at `/api/pending-ads`

The core approval workflow -- this is where ads move from pending to approved or rejected.

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/` | Yes | Lists ads with optional filters (status, agentId, campaignId). Auto-filters based on user type so agents only see their own ads and companies only see theirs. Paginated, defaults to 6 per page. |
| GET | `/:id` | Yes | Returns a single ad with its campaign, agent, and company references populated. |
| POST | `/:id/approve` | Yes | Approves an ad. Sets up share tracking. Optionally saves the company's rating and feedback comment. |
| POST | `/:id/reject` | Yes | Rejects an ad, which triggers the AI improvement flow. |
| POST | `/:id/reject-with-components` | Yes | Alternative rejection endpoint (same behavior). |
| POST | `/save-approved` | Yes | Saves a new ad to the database after the agent likes the generated result. |
| DELETE | `/:id` | Yes | Deletes a pending ad. Only the creating agent can delete, and only while the ad is still in pending status. |

---

#### `server/routes/adImprovement.js` -- mounted at `/api/ad-improvement`

Handles the AI-powered improvement cycle when an ad gets rejected.

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/reject-and-improve` | Yes | Rejects an ad and generates an improved version. The company specifies which components need work (title, text, image), and the system regenerates just those parts. Saves the old version in the ad's improvement history, sends an email to the agent. |
| POST | `/regenerate` | Yes | Delegates to the same handler as reject-and-improve. |

This router uses `injectHelpers()` to receive the Gemini, Canvas, and Pexels service functions from `server.js` at startup.

---

#### `server/routes/campaigns.js` -- mounted at `/api/campaigns`

Standard CRUD for campaigns.

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/agent/:agentId` | Yes | Returns all campaigns the given agent is assigned to. |
| GET | `/company/:companyId` | Yes | Returns all campaigns belonging to a company. |
| POST | `/` | Yes | Creates a new campaign. |
| PUT | `/:id` | Yes | Updates a campaign's fields. |
| DELETE | `/:id` | Yes | Deletes a campaign. |

---

#### `server/routes/analytics.js` -- mounted at `/api/analytics`

QR scan analytics. Every endpoint applies automatic user-type filtering: agents see only their own QR data, companies see data for all QR codes linked to their ads.

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/overview` | Yes | Summary statistics: total QR codes, active QR codes, total scans, scans today/this week/this month, average scans per QR. |
| GET | `/campaigns` | Yes | Scans grouped by campaign, with a per-QR breakdown within each. |
| GET | `/top-qrs` | Yes | Top-performing ads ranked by scan count. Accepts a `limit` query parameter (default 10). |
| GET | `/timeline` | Yes | Daily scan counts over a configurable window (default 30 days). Days with no scans get filled in as zero. |
| GET | `/comparison` | Yes | Cross-entity comparison. The `type` parameter selects grouping by campaign or by agent. |
| GET | `/realtime` | Yes | The 10 most recent QR scans from the last 24 hours. |

---

#### `server/routes/qr.js` -- mounted at `/api/qr`

QR code generation and management.

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/generate` | Yes | Generates a QR code for an ad. Creates a unique short URL with UTM parameters, generates the QR image, saves a QRScan record, and links the QR to the ad. |
| POST | `/embed` | Yes | Composites a QR code onto an ad image at a chosen position (top-left, top-right, bottom-left, bottom-right, or center) and size. |
| GET | `/analytics/:adId` | Yes | Returns QR scan stats for a specific ad. |
| GET | `/analytics/agent/:agentId` | Yes | Returns all QR stats for an agent with aggregate numbers and a per-QR breakdown. |

---

#### `server/routes/redirect.js` -- mounted at `/r`

Public endpoints that handle QR code short URL redirects. No authentication required.

| Method | Path | What it does |
|---|---|---|
| GET | `/:uniqueId` | Looks up the QRScan record by unique ID, increments the scan counter, and issues a 302 redirect to the target URL. If the ID is not found, returns a styled HTML 404 page. |
| GET | `/stats/:uniqueId` | Returns public JSON stats for a QR code (scan count, URLs, timestamps). |
| GET | `/debug/:uniqueId` | Debug endpoint returning the full QR scan document. |

---

#### `server/routes/payments.js` -- mounted at `/api/payments`

Stripe payment processing. This file defines its own inline JWT verification middleware rather than importing from `auth.js`.

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/pending` | Yes | Returns pending payments for the authenticated company, with computed time-remaining values. |
| POST | `/create-payment-intent/:paymentId` | Yes | Creates a Stripe PaymentIntent. Verifies that the authenticated user owns the payment and that the payment is still pending. Returns the `clientSecret` needed by Stripe Elements. |
| POST | `/confirm/:paymentId` | Yes | Called after Stripe processes the charge. Updates the payment status to completed and marks the ad as paid. |
| GET | `/history` | Yes | Returns payment history for the authenticated user (filtered by role). Capped at 50 records. |
| DELETE | `/cancel/:paymentId` | Yes | Cancels a pending payment. Agent-only. Also cancels the Stripe PaymentIntent if one exists. |

All amounts are in ILS (Israeli New Shekel). When creating a PaymentIntent, amounts are multiplied by 100 because Stripe processes in agorot (the smallest currency unit).

---

#### `server/routes/priceProposals.js` -- mounted at `/api/price-proposals`

Price negotiations between agents and companies.

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/` | Yes | Submit a price proposal for a campaign. |
| GET | `/` | Yes | List proposals with optional filters (campaignId, agentId, status). |
| GET | `/company/:companyId` | Yes | Get all proposals directed at a specific company. |
| POST | `/:id/approve` | Yes | Approve a proposal. The proposed budget gets added to the campaign's existing budget. |
| POST | `/:id/reject` | Yes | Reject a proposal. Accepts an optional response message. |

---

#### `server/routes/share.js` -- mounted at `/api/share`

Handles what happens after an agent shares an ad.

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/confirm-share/:adId` | Yes | Confirms the share. If an approved PriceProposal exists for the ad's campaign, creates a Payment record with a 24-hour deadline and sends the company a payment request email. If there is no approved proposal, records the share as unpaid. |

---

#### `server/routes/agents.js` -- mounted at `/api/agents`

Agent-related lookups and campaign assignment notifications.

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/` | Yes | Lists all agents with dynamically computed ad stats. Sorted by average rating, highest first. |
| GET | `/:id/stats` | Yes | Returns ad statistics for a specific agent (counts by status). |
| GET | `/new-assignments` | Yes | Returns campaigns the authenticated agent has been assigned to but has not yet seen. |
| PUT | `/mark-assignment-seen/:campaignId` | Yes | Marks a campaign assignment as acknowledged by adding the campaign ID to the agent's `seenCampaignAssignments` array. |

---

#### `server/routes/company.js` -- mounted at `/api/company`

Company-specific aggregate statistics.

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/stats` | Company/Admin | Returns the company's ad counts (by status), campaign counts (total and active), unique agent count, and approval rate. |
| GET | `/stats/monthly` | Company/Admin | Returns monthly ad counts aggregated over the last 6 months. |

---

#### `server/routes/companies.js` -- mounted at `/api/companies`

CRUD for the standalone Company model (not the User-based company accounts).

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/` | Yes | Lists all companies, newest first. |
| POST | `/` | No | Creates a new company record. |
| GET | `/:id` | Yes | Gets a company by ID. |
| PUT | `/:id` | Yes | Updates a company. |
| DELETE | `/:id` | Yes | Deletes a company. |

---

#### `server/routes/users.js` -- mounted at `/api/users`

User lookups and onboarding tracking.

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/` | Yes | Lists users, filterable by `userType` and `companyId`. |
| GET | `/:id` | Yes | Returns a single user by ID. |
| PUT | `/mark-guide-seen` | Yes | Sets `hasSeenGuide: true` on the authenticated user's document. Called when the onboarding tour completes. |

---

#### `server/routes/invites.js` -- mounted at `/api/invites`

Invitation code system for linking agents to companies.

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/generate` | Company | Generates a unique 8-character alphanumeric invite code tied to the authenticated company. |
| GET | `/validate/:code` | No | Validates an invite code and returns the associated company's name and ID. |

---

#### `server/routes/contact.js` -- mounted at `/api/contact`

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/` | No | Accepts a contact form submission (name, email, message), validates the fields, and sends the message to the admin via SendGrid. |

---

#### `server/routes/dashboard.js` -- mounted at `/api/dashboard`

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/stats` | No | Returns public system-wide numbers: total companies, campaigns, ads, impressions, clicks, and CTR. Used on the landing page. |

---

#### `server/routes/requests.js` -- mounted at `/api/requests`

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/agent/my-requests` | Yes | Returns all ad submissions for the authenticated agent, with summary stats: counts by status and total earnings from completed payments. |

---

#### `server/routes/ai.js` and `server/ai.js` -- mounted at `/api`

AI utility endpoints for image search and text generation. Both files define the same three endpoints (the second file is a legacy duplicate).

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/smart-image-search` | No | Uses Gemini to translate business details into English stock photo search keywords. |
| POST | `/search-images` | Yes | Searches Pexels for stock photos. Returns up to 15 landscape-oriented results. |
| POST | `/generate-text` | Yes | Uses Gemini to generate a short marketing slogan (max 6 words) in a specified language. |

---

#### `server/routes/CompanyDashboard.js` -- legacy route file

An early version of the company dashboard API that was written before the system moved to the PendingAd model. It uses the old `Ad` model (which is actually a Quote schema) and contains placeholder comments like "you'll need to add status field" throughout the code. The endpoints duplicate functionality that now lives in `company.js`, `pendingAds.js`, and `campaigns.js`.

Endpoints defined: `GET /stats`, `GET /pending-ads`, `GET /campaigns`, `GET /agents`, `PUT /approve-ad/:adId`, `PUT /reject-ad/:adId`, `POST /campaigns`.

This file is effectively superseded by the current route modules and is not actively used by the frontend.

---

### 5.8. Background Jobs

**`server/jobs/paymentReminder.js`**

A scheduled function that checks for overdue and almost-due payments. It runs every hour (via `setInterval` in `server.js`), with an initial run 10 seconds after the server starts.

It does two things:

1. **Overdue payments:** Finds payments that are still `pending` but past their `dueAt` deadline, where the agent has not yet been notified. For each, it sets `agentNotifiedAt` on the payment record and updates the associated ad's `paymentStatus` to `overdue`.

2. **Upcoming reminders:** Finds payments due within the next 2 hours that have not yet received a `final_reminder`. Records a reminder entry in the payment's `remindersSent` array.

One thing to note: the actual notification delivery is not fully wired up. The notification service import is commented out in the code, so while the database gets updated correctly (payments are flagged, reminders are logged), no emails or push notifications are actually sent for these events.

---

### 5.9. Scripts

**`server/scripts/add-unique-ids-to-existing-ads.js`**

A one-time migration script, meant to be run manually with `node server/scripts/add-unique-ids-to-existing-ads.js`.

It was created to backfill `uniqueId` values on ads that were created before the unique ID feature existed. The script connects to MongoDB, finds all PendingAd documents that are missing a unique ID, generates a 6-character hex ID for each one (with collision checking, up to 10 retries), and updates the ad's `uniqueId` and `metadata.adUniqueId` fields. If the ad has a QR code, it also updates the corresponding QRScan document's `adUniqueId`.

**`server/routes/fix-companies.js`**

Despite being in the `routes/` directory, this is actually a standalone migration script, not a route. It finds all company-type users that are missing a `companyId` field and sets it to their own `_id`. This was a one-time fix for data that predated the `companyId` field on users.

### 5.10. Utility and Test Scripts

These are standalone scripts used during development for debugging and testing. They are not part of the running application.

**`testGenerateAd.js`** (project root)

A quick smoke test for the Gemini API. Uses ES module syntax (`import`) and the `@google/genai` package to send a simple Hebrew prompt ("write a short, catchy ad for a new candy business") to the `gemini-2.5-flash` model. Prints the generated text to the console. Useful for verifying that the Gemini API key works and the model is reachable.

**`server/check-pending-ads.js`**

A diagnostic script for inspecting the PendingAd collection. Connects directly to MongoDB, fetches every document from the PendingAd collection, and prints each ad's ID, title, company, agent, status, and creation date. Intended for quick database inspection during development or debugging.

**`server/simple-test.js`**

A minimal script that checks whether the `nodemailer` package is installed and loadable. Prints its type and available methods. This was likely used during the transition from nodemailer to SendGrid to verify package availability.

**`server/test-email.js`**

A test script for sending an email via nodemailer with Gmail SMTP. Reads `EMAIL_USER` and `EMAIL_PASSWORD` from environment variables, creates a Gmail transport, and sends a test email to the same address. This predates the current SendGrid-based email service and was used to validate email delivery during early development.

---

## 6. Frontend

### 6.1. Entry Point and Routing

**`client/src/main.jsx`**

This is the React entry point. It renders the component tree into the DOM:

```jsx
<BrowserRouter>
  <AuthProvider>
    <App />
  </AuthProvider>
</BrowserRouter>
```

It enables React Router v7 future flags (`v7_startTransition` and `v7_relativeSplatPath`) for forward compatibility.

---

**`client/src/App.jsx`**

Defines the full route table for the application. Most page components are loaded with `React.lazy()` and wrapped in `<Suspense>` for code splitting.

Public routes (no login required):

| Path | Component | Purpose |
|---|---|---|
| `/` | LandingPage | Marketing homepage |
| `/login` | Login | Login form |
| `/register` | Register | Registration form |
| `/ad/:adId` | ConfirmRedirect | QR scan redirect landing page |
| `/privacy-policy` | PrivacyPolicy | Privacy policy |
| `/terms-of-service` | TermsOfService | Terms of service |

Protected routes (login required):

| Path | Component | Who can access |
|---|---|---|
| `/dashboard` | Dashboard | Any authenticated user (redirects to role-specific dashboard) |
| `/admin-dashboard` | AdminDashboard | Admins only |
| `/company-dashboard` | CompanyDashboard | Companies only |
| `/company-profile` | CompanyProfile | Companies only |
| `/company-qr-analytics` | CompanyQRAnalytics | Companies only |
| `/agent-dashboard` | AgentDashboard | Agents only |
| `/ad-generator` | AdGeneratorM | Agents only |
| `/my-ads` | MyAds | Agents only |
| `/my-campaigns` | MyCampaigns | Agents only |
| `/qr-analytics` | QRAnalytics | Agents only |
| `/agent-profile` | AgentProfile | Agents only |

A catch-all `*` route renders a Hebrew-language 404 page.

---

### 6.2. Context Providers

**`client/src/context/AuthContext.jsx`**

This is the global auth state manager. It wraps the entire app and provides login, registration, logout, and session management to all child components through React context.

What it exports:

- `AuthProvider` -- the provider component.
- `useAuth()` -- the hook that components use to access auth state and actions.
- `API_URL` -- the backend URL (from `VITE_API_BASE_URL`.

The context exposes:

| Value | What it is |
|---|---|
| `user` | The current user object (or null if not logged in) |
| `loading` | Whether a login/register call is in flight |
| `isInitialized` | Whether the initial session check on page load has finished |
| `handleLogin(email, password)` | Sends credentials to the server, stores the JWT, and navigates to the dashboard |
| `handleRegister(data)` | Sends registration data, stores the JWT, and navigates to the dashboard |
| `handleLogout()` | Clears localStorage and redirects to `/login` |
| `loadUserFromToken()` | Re-fetches the user profile using the stored JWT |
| `forceRefresh()` | Nuclear option: clears everything and reloads the page |

On mount, the provider checks if there is a stored JWT in `localStorage`. If so, it validates it by calling `GET /api/auth/me`. For agent users, it also fetches performance stats from `GET /api/agents/{userId}/stats`. Once this check finishes (success or failure), `isInitialized` flips to `true`.

There is a storage versioning mechanism: a `STORAGE_VERSION` key in `localStorage` ensures that when the version changes between deployments, stale data gets cleared automatically.

---

**`client/src/context/DataContext.jsx`**

An empty file. Not wired into anything in the current codebase.

---

### 6.3. Pages

#### `client/src/pages/LandingPage.jsx`

The public marketing homepage. It has a navigation bar with smooth-scroll links to sections (Home, Features, Contact), a hero section with login/register CTAs, a feature showcase highlighting company management, the agent portal, and AI ad creation, a contact form, and a footer with links to legal pages.

The contact form posts to `POST /api/contact`. On success, a confirmation message appears and auto-dismisses after 5 seconds.

---

#### `client/src/pages/Login.jsx`

A straightforward email and password form. It calls `handleLogin()` from the auth context and shows error messages with a shake animation on failure. Errors clear as soon as the user starts typing. There is a link to the registration page at the bottom.

---

#### `client/src/pages/Register.jsx`

Registration starts with a visual user-type selector (agent or company, presented as clickable cards). After picking a type, the form shows common fields (name, email, password, confirm password) and type-specific fields (company name and industry for company users). Passwords must match before the form can submit. Delegates to `handleRegister()` from the auth context.

---

#### `client/src/pages/Dashboard.jsx`

Not really a page in the traditional sense -- it is a routing hub. It reads the authenticated user's type from context and immediately redirects: admins go to `/admin-dashboard`, companies to `/company-dashboard`, agents to `/agent-dashboard`. Uses `replace: true` to keep the browser history clean.

---

#### `client/src/pages/AgentDashboard.jsx`

The agent's home screen after logging in. Shows a welcome card with a rating badge (color-coded: gold for 4.5+, green for 3.5+, pink for lower), a stats grid (approved, pending, rejected, and total ads), and quick-action links to the ad generator, ads portfolio, campaigns, analytics, and profile.

Stats refresh automatically every 30 seconds.

First-time agents see the onboarding guide (the `OnboardingGuide` component with `agentTourSteps`), which walks them through the dashboard elements step by step.

When an agent has been newly assigned to a campaign, the `CampaignAssignmentPopup` appears to notify them.

The various dashboard sections have `data-tour` attributes so the onboarding guide's spotlight can target them.

---

#### `client/src/pages/AdGeneratorM.jsx`

The production ad generator -- a three-step wizard.

**Step 1: Select Campaign.** Fetches the agent's campaigns from the API, groups them by company, and presents a company-then-campaign selection flow. Campaign data is cached in `localStorage` for 5 minutes to avoid redundant API calls.

**Step 2: Ad Details.** A form with: product/service (required), key message (required), tone (dropdown with options like professional, friendly, urgent), language (Hebrew, English, Arabic, Russian, French), ad style (modern, minimal, elegant, dark), and an optional image upload field. Fields auto-fill from campaign data where possible.

**Step 3: Generated Ad.** Shows the result: the rendered ad image, headline, body text, and unique ID. The agent can "Like" it (saves to the database via `POST /api/pending-ads/save-approved`) or "Dislike" it (discards the result and goes back to regenerate). There is also a button to copy the unique ad ID to the clipboard.

The API call uses a `fetchWithRetry()` helper with exponential backoff, a 30-second AbortController timeout, and up to 2 retry attempts for resilience against slow Gemini responses.

---

#### `client/src/pages/Adgenerator.jsx`

An older version of the ad generator that uses external CSS files instead of inline styles. It has the same three-step flow but is not wired into the current route table.

---

#### `client/src/pages/CompanyDashboard.jsx`

The most substantial component in the frontend. It is a tabbed dashboard that serves as the command center for company users.

**Tabs:**

1. **Overview** -- Stats cards: approved ads, pending ads, rejected ads, total ads, proposal count, and agent count.

2. **Pending Ads** -- A paginated list (6 per page) of ads waiting for approval. Each card shows the ad image, title, body text (expandable), and the QR code if one is present. Approve and reject buttons open respective modals.

3. **Price Proposals** -- Lists all price proposals from agents. Each entry shows the original budget next to the proposed amount. The company can approve (which adds the proposed amount to the campaign budget) or reject with an optional message.

4. **Campaigns** -- A form for creating new campaigns (title, description, target audience, budget in ILS, website URL, and agent assignment). Below the form, a list of existing campaigns.

5. **Agents** -- A browsable directory of all agents, with filters for minimum rating, specialty, and text search. Agent cards show social media links, ad stats, and contact information.

6. **History** -- A chronological feed of all processed ads with status indicators.

The approve modal has a 1--5 star rating (clickable) and an optional comment field. The reject modal lets the company select which components to regenerate (title, text, image), write a detailed explanation, and optionally allow revision.

Everything auto-refreshes every 30 seconds. The URL supports deep linking via `?tab=` and `?paymentId=` query parameters.

First-time company users get the onboarding guide with `companyTourSteps`.

---

#### `client/src/pages/Companyprofile.jsx`

The company profile page. Displays company information in a read-only view by default, with a toggle to switch to edit mode. Editable fields: company name, email, phone, industry, company size (dropdown), website, address, description, and contact person. At the bottom, there are stats cards for approved ads, pending ads, active campaigns, and active agents. Stats refresh every 30 seconds.

---

#### `client/src/pages/AgentProfile.jsx`

The agent's profile management page.

The profile section has a view/edit toggle. In edit mode, the agent can change: name, phone, social media (a platform dropdown plus a handle input with a live preview link), specialty, bio, and skills. Email is displayed but read-only.

Below the profile, there is a performance stats summary (total ads, approved, pending, rejected, average rating).

The password change section requires the current password, a new password (minimum 6 characters), and confirmation.

There is a delete account section, but it is a placeholder -- it shows a "feature in development" message instead of actually doing anything.

The `parseSocialMediaHandle()` function is worth noting: it can extract the platform and username from various URL formats. If an agent pastes `https://instagram.com/username`, it recognizes the platform as Instagram and pulls out `username` as the handle.

---

#### `client/src/pages/AdminDashboard.jsx`

The admin panel with three tabs:

1. **Overview** -- System-wide stats: total companies, total agents, total ads, overall approval rate (shown as a progress bar), and monthly trend charts.

2. **Users** -- A paginated table of all users. Filterable by user type and text search. Actions include toggling a user's active status and deleting a user, both with confirmation dialogs. The UI prevents admins from deactivating or deleting their own account.

3. **Ads** -- A paginated grid of ad cards. Filterable by status. Each card shows the ad image, title, creator, company, and a status badge. Deleting requires confirmation and shows an ad preview in the dialog.

Auto-refreshes every 30 seconds. Redirects non-admin users to `/dashboard`.

---

#### `client/src/pages/MyAds.jsx`

The agent's ad portfolio. Lists all ads the agent has created with filtering, pagination, sharing, and download features.

Agents can filter by campaign using a dropdown. Pagination is server-side, 6 ads per page.

Each ad card shows: the ad image (blurred with a lock icon overlay if the ad has not been approved yet), a status badge, the title, expandable body text, creation date, and campaign name.

For approved ads, additional functionality appears: the QR code section (if present) with the scan count and short URL, a share button, and a download button.

Sharing uses the Web Share API when available. It constructs a `File` object from the ad's base64 image data so the actual image gets shared, not just a link. If the Web Share API is not available, it falls back to copying the share text to the clipboard.

After sharing, a "Did you actually share it?" confirmation popup appears. If the agent confirms, the frontend calls `POST /api/share/confirm-share/{adId}`, which may trigger payment processing on the backend.

The download feature converts the base64 image to a blob and creates a temporary download link.

Auto-refreshes every 30 seconds.

---

#### `client/src/pages/MyCampaigns.jsx`

Shows the campaigns the agent is assigned to.

Each campaign card displays the company name, campaign title, description, target audience, creation date, and deadline (if set). The budget section shows the agent's default share (10% of the campaign budget) or the approved proposal amount if the agent has negotiated a custom rate.

The price negotiation modal lets agents propose a different fee. It shows the base fee, an input for the proposed amount, and a text area for a justification message. The difference between the base fee and the proposed amount is what gets submitted as the proposal.

For each campaign, the component fetches approved proposals to determine which fee to display.

---

#### `client/src/pages/QRAnalytics.jsx`

A full analytics dashboard for agents, built with Recharts.

The page is divided into several sections:

- **Stats grid** at the top: total QR codes, total scans, today's scans, average scans per QR.
- **Additional stats bar**: scans this week, scans this month, active QR codes.
- **Line chart**: scan trends over a selectable window (7, 30, or 90 days).
- **Pie chart**: scan distribution across campaigns.
- **Top 5 ads**: ranked cards with scan counts, plus a horizontal bar chart for visual comparison.
- **Real-time feed**: the most recent scans from the last 24 hours, showing the ad ID, timestamp, and other details.
- **Campaign breakdown**: expandable cards for each campaign, listing individual QR codes and their scan counts.

All five analytics API endpoints are called in parallel with `Promise.all` on mount. Data refreshes every 30 seconds.

---

#### `client/src/pages/ConfirmRedirect.jsx`

This page is shown when someone scans a QR code or clicks an ad link. It is the intermediary before redirecting to the advertiser's website.

The flow:

1. Fetches the ad data (no auth needed -- this is public).
2. Displays the ad image, title, body text, and company name.
3. Shows the target URL so the user knows where they are going.
4. Starts a 5-second countdown with a circular progress timer animation.
5. Logs a click event to the backend.
6. When the countdown hits zero (or the user clicks "Continue to site now"), redirects to the target URL.
7. There is a "Cancel" button that navigates back.

A "Verified by Ads-Maker" badge is shown for trust.

---

#### `client/src/pages/CompanyPayments.jsx`

Payment processing page for companies. Uses Stripe Elements for the payment UI.

Each pending payment is shown as a card with the business name, a thumbnail of the ad, the agent's name, the amount in ILS, and a time-remaining indicator (with an overdue warning if the deadline has passed).

Clicking "Pay now" creates a Stripe PaymentIntent via the backend and opens a modal with a summary of the payment details, an SSL security badge, and the Stripe payment form (rendered by the `PaymentForm` component inside a Stripe `<Elements>` wrapper).

---

#### `client/src/pages/CompanyDataContext.jsx`

A React context provider that centralizes data fetching for the company dashboard -- pending ads, agents, history, and proposals. This appears to have been developed as an alternative to the direct fetching done inside `CompanyDashboard.jsx`. It is not currently connected to the active route configuration.

---

#### `client/src/pages/ErrorBoundary.jsx`

A React class component (class components are still required for error boundaries in React 18) that catches JavaScript errors in the component tree and shows a fallback UI instead of a white screen.

The fallback shows an error icon and a message in Hebrew saying something went wrong, a button to return to the home page (navigates to `/` and resets the error state), and a button to reload the page. In development mode, an expandable section shows the full error message and component stack trace.

---

#### `client/src/pages/PrivacyPolicy.jsx`

A static page in Hebrew laying out the platform's privacy policy. Covers: what data is collected, how it is used, when it is shared with third parties, security measures, user rights, cookie usage, policy changes, and a note about minors. Links back to the home page.

---

#### `client/src/pages/TermsOfService.jsx`

A static page in Hebrew with the platform's terms of service. Covers: definitions, acceptance of terms, permitted use, accounts and registration, intellectual property, liability limitations, indemnification, service modifications, termination, jurisdiction, and miscellaneous provisions.

---

### 6.4. Reusable Components

#### `client/src/components/ProtectedRoute.jsx`

A route guard that wraps protected page components. Its logic is straightforward:

1. If there is no JWT in `localStorage`, redirect to `/login`.
2. If a `requiredUserType` prop is specified and does not match the stored `userType`, redirect the user to the correct dashboard for their role.
3. If everything checks out, render the `children`.

Uses `<Navigate replace />` to prevent the guarded route from staying in the browser history.

---

#### `client/src/components/SharedHeader.jsx`

The navigation bar shared across all dashboard pages.

Props: `userType`, `userName`, `onLogout`.

Renders the app logo (clicking it navigates to the appropriate dashboard based on user type), a "Dashboard" link, a "More Info" dropdown with links to the home page, privacy policy, and terms of service, the user's name, and a logout button.

---

#### `client/src/components/Sharemodal.jsx`

A modal for sharing ads to social media. Supports WhatsApp, Facebook, Instagram, Telegram, Twitter, LinkedIn, Email, direct download, and clipboard copy.

When the agent clicks a platform button, the modal opens the platform's share URL in a new tab. After a 2-second delay, a "Did you share?" confirmation popup appears. If confirmed, the share is reported to the backend via `POST /api/share/confirm-share/{adId}`. If the backend responds that the share is blocked (for example, because the company has not approved a price proposal), a popup explains the reason.

Instagram gets special treatment since it does not support direct URL sharing. The component copies the share text to the clipboard and then opens Instagram (using a deep link on mobile, or the web version on desktop).

---

#### `client/src/components/ExpandableText.jsx`

A text component that truncates long content and provides a show-more/show-less toggle.

Props: `text`, `maxLines` (default 2), `className`, `style`, `showMoreText`, `showLessText`.

The truncation uses CSS `-webkit-line-clamp`. The component checks whether the text actually overflows by comparing `scrollHeight` to the clamped container height, and only shows the toggle button if it does. This check re-runs on window resize. The toggle button uses `stopPropagation()` so clicking it does not trigger click handlers on parent elements.

---

#### `client/src/components/PaymentForm.jsx`

A Stripe payment form component.

Props: `paymentId`, `amount`, `onSuccess`, `onCancel`.

Renders Stripe's `<PaymentElement>` with a tab-based layout. On form submission, it calls `stripe.confirmPayment()` with `redirect: 'if_required'`, then confirms the payment with the backend. A note tells the user that their card details are processed by Stripe and not stored on the server.

---

#### `client/src/components/PaymentSection.jsx`

A dashboard section that displays pending payments and handles the Stripe payment flow end to end.

Accepts an optional `highlightedPaymentId` prop for deep-linking from notification emails.

The flow: loads pending payments, shows each one as a card (business name, agent, amount, time remaining), "Pay Now" creates the PaymentIntent, then the component switches to show the `PaymentForm` inside a Stripe `<Elements>` wrapper. On success, the payment list refreshes.

---

#### `client/src/components/QRGenerator.jsx`

A three-step modal for generating QR codes and embedding them into ad images.

Props: `ad`, `onQRGenerated`, `onClose`.

Step 1 shows a feature list (tracked QR, short URL, real-time stats, UTM tracking) and a "Create QR" button. Step 2 shows a QR code preview, the short URL, a position picker (5 positions), a size slider (100--300px), and buttons to embed or skip. Step 3 shows a summary with the short URL, target hostname, and a "Done" button.

Uses `qrService.generateQR()` and `qrService.embedQR()` for the API calls.

---

#### `client/src/components/CompanyQRAnalytics.jsx`

The QR analytics dashboard for company users. Structurally identical to the agent's `QRAnalytics` page -- same chart types (line, pie, bar), same stats grid, same real-time feed, same campaign breakdown. The difference is that it filters data to show only QR codes belonging to the company's ads. Auto-refreshes every 30 seconds. Uses Recharts for all charts.

---

#### `client/src/components/PageSelectorModal.jsx`

A stub component for selecting social media pages to publish ads on. Currently contains hardcoded placeholder data (three entries: a Facebook page, an Instagram account, and a Twitter profile) rather than fetching real connected accounts from an API. The modal renders a checkbox list of pages and logs the selection to the console on save. The button label and heading are in Hebrew. This component is not integrated into any active page and appears to be a prototype for a planned feature.

---

#### `client/src/components/CampaignAssignmentPopup/CampaignAssignmentPopup.jsx`

A notification popup that appears when an agent is assigned to a new campaign.

Props: `campaign`, `onClose`, `onViewCampaign`.

Shows the campaign's company name, title, description (if any), budget in ILS (if greater than 0), and target audience (if specified). Two buttons: "Understood" (dismisses the popup) and "View My Campaigns" (navigates to the campaigns page).

---

#### `client/src/components/OnboardingGuide/OnboardingGuide.jsx`

An interactive step-by-step tour with spotlight highlighting.

Props: `steps`, `onComplete`, `isVisible`.

Each step in the `steps` array specifies a CSS selector for the element to spotlight, a title, description text, tooltip position (top/bottom/left/right), and an icon.

The implementation uses a full-screen SVG overlay with a cutout mask around the target element, creating a spotlight effect. Tooltips are positioned relative to the target element with boundary clamping to prevent them from going off-screen. The component auto-scrolls to bring the target element into view before showing the tooltip.

Navigation includes previous/next buttons, a skip button, progress dots, and a step counter.

---

#### `client/src/components/OnboardingGuide/tourSteps.js`

Contains the step definitions for the onboarding tours.

The agent tour has 9 steps: welcome card, stats grid, quick actions, ad generator link, my ads link, campaigns link, statistics link, profile link, and header stats.

The company tour has 10 steps: welcome card, tab navigation, general stats, QR stats, pending ads, proposals, campaigns, agents, profile, and history.

All steps use `[data-tour="..."]` selectors to find their target elements. All text is in Hebrew.

---

### 6.5. Client Services

#### `client/src/services/companyService.js`

An API client module that handles all HTTP requests the company dashboard needs. Every function pulls the JWT from `localStorage` via a shared `getAuthHeaders()` helper and attaches it as a Bearer token. All functions are wrapped in try/catch and return `{ success: false, error }` on failure.

There are 17 exported functions covering: company stats, pending ads (list, approve, reject), agents listing, ad history, price proposals (list, approve, reject), campaigns (CRUD), payments (list pending, create intent, confirm, history).

Note: a copy of this file exists at `server/services/companyService.js`, which appears to be a misplaced duplicate.

---

#### `client/src/services/qrService.js`

API client for QR code operations and analytics. Unlike `companyService.js`, this module takes the JWT token as a parameter to each function rather than reading it from `localStorage` internally.

8 exported functions: `generateQR`, `embedQR`, `getQRAnalytics` (per-ad), `getOverviewAnalytics`, `getCampaignAnalytics`, `getTopQRs`, `getTimelineAnalytics`, `getComparisonAnalytics`.

---

### 6.6. Build Configuration

**`client/vite.config.js`**

Vite configuration for the React build:

- Plugin: `@vitejs/plugin-react`
- Output directory: `dist`, cleaned before each build
- File naming includes both a content hash and a build timestamp for cache busting: `assets/[name]-[hash]-{timestamp}.js`

**`client/eslint.config.js`**

Uses the ESLint flat config format:

- Extends `@eslint/js` recommended rules, `react-hooks` recommended rules, and the `react-refresh` Vite plugin config.
- Targets `**/*.{js,jsx}` files.
- `no-unused-vars` is set to error, but ignores variables starting with an uppercase letter or underscore (accommodating unused React component imports and intentionally unused parameters).
- Ignores the `dist` directory.

---

### 6.7. CSS Files

Most page and component files have a companion CSS file with the same base name (for example, `AgentDashboard.jsx` has `AgentDashboard.css`). The project uses a mix of external CSS and inline JavaScript style objects -- the production ad generator (`AdGeneratorM.jsx`) primarily uses inline styles, while the older version (`Adgenerator.jsx`) uses its external CSS file.

All stylesheets follow a consistent visual language: the `#667eea` to `#764ba2` purple gradient for primary colors, rounded corners (`border-radius: 12px` to `20px`), subtle shadows, and RTL-first layout with `direction: rtl` on container elements.

CSS files in the project:

| File | Styles for |
|---|---|
| `App.css` | Global app layout and Suspense loading spinner |
| `index.css` | Base reset and font defaults |
| `LandingPage.css` | Public homepage sections, hero, features, contact form |
| `AdminDashboard.css` | Admin panel tabs, stats cards, user table, ad grid |
| `AgentDashboard.css` | Agent home screen stats grid, action cards, rating badge |
| `AgentProfile.css` | Profile editor form, stats display, password section |
| `Adgenerator.css` | Old ad generator wizard (unused in current routing) |
| `AdGeneratorM.css` | Production ad generator (minimal -- most styles are inline) |
| `CompanyDashboard.css` | Company tabs, pending ads cards, proposal list, campaign form |
| `Companyprofile.css` | Company profile editor and stats cards |
| `CompanyPayments.css` | Payment cards, time remaining indicators, Stripe modal |
| `MyAds.css` | Ad portfolio grid, status badges, share/download buttons |
| `MyCampaigns.css` | Campaign cards, budget display, negotiation modal |
| `QRAnalytics.css` | Analytics dashboard charts, stats grid, real-time feed |
| `ConfirmRedirect.css` | QR redirect landing page, countdown timer, ad preview |
| `PolicyPage.css` | Shared styles for PrivacyPolicy and TermsOfService pages |
| `SharedHeader.css` | Navigation bar, logo, dropdown menu, user greeting |
| `Sharemodal.css` | Share modal platform buttons, confirmation popup |
| `QRGenerator.css` | QR creation wizard steps, position picker, size slider |
| `PaymentForm.css` | Stripe payment element wrapper, security badge |
| `CampaignAssignmentPopup.css` | Assignment notification card layout |
| `OnboardingGuide.css` | SVG spotlight overlay, tooltip positioning, progress dots |

---

## 7. API Reference

### Base URL

- Production: `https://adsmaker.onrender.com`

### Authentication

Protected endpoints expect a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens come back from `POST /api/auth/login` and `POST /api/auth/register` with a 7-day expiry.

### Route prefix mapping

| Prefix | Route file | Description |
|---|---|---|
| `/api/auth` | auth.js | Authentication and accounts |
| `/api/admin` | admin.js | Admin management |
| `/api/ads` | ads.js | Agent ad operations |
| `/api/pending-ads` | pendingAds.js | Approval workflow |
| `/api/ad-improvement` | adImprovement.js | AI-powered ad improvement |
| `/api/campaigns` | campaigns.js | Campaign CRUD |
| `/api/companies` | companies.js | Company CRUD |
| `/api/company` | company.js | Company statistics |
| `/api/agents` | agents.js | Agent listing and stats |
| `/api/analytics` | analytics.js | QR scan analytics |
| `/api/qr` | qr.js | QR code generation |
| `/api/payments` | payments.js | Stripe payments |
| `/api/price-proposals` | priceProposals.js | Price negotiations |
| `/api/share` | share.js | Share confirmation |
| `/api/users` | users.js | User management |
| `/api/requests` | requests.js | Agent request history |
| `/api/contact` | contact.js | Contact form |
| `/api/dashboard` | dashboard.js | Public stats |
| `/api/invites` | invites.js | Invite codes |
| `/r` | redirect.js | QR short URL redirects |
| `/api` | ai.js | AI utilities |
| `/api/generate-ad` | adController.js | Ad generation (direct mount) |

---

## 8. Environment Variables

### Backend (`server/.env`)

| Variable | Required | What it is |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Secret used to sign JWT tokens |
| `GEMINI_API_KEY` | Yes | Primary Google Gemini API key |
| `GEMINI_API_KEY_two` | No | Second Gemini key for rotation |
| `GEMINI_API_KEY_three` | No | Third Gemini key |
| `GEMINI_API_KEY_Four` | No | Fourth Gemini key |
| `GEMINI_API_KEYS` | No | Comma-separated key list (alternative to individual variables) |
| `PEXELS_API_KEY` | Yes | Pexels API key for stock photo search |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `SENDGRID_API_KEY` | Yes | SendGrid API key for email |
| `SENDGRID_FROM_EMAIL` | No | Sender email address (default: hilamaayan99@gmail.com) |
| `EMAIL_DRY_RUN` | No | Set to `true` to log emails instead of sending them |
| `EMAIL_TEST_ADDRESS` | No | Redirect all emails to this address for testing |
| `ADMIN_SECRET` | Yes | Secret required to create the first admin account |
| `BASE_URL` | No | Server base URL for QR short links (default: https://adsmaker.onrender.com) |

### Frontend (`client/.env`)

| Variable | Required | What it is |
|---|---|---|
| `VITE_API_BASE_URL` | No | Backend API URL  
| `VITE_API_URL` | No | Alternative API URL used by companyService |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key for the payment UI |
