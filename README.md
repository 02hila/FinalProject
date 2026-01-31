# Ads-Maker - AI-Powered Advertisement Generator

A full-stack platform for creating and managing AI-powered advertisements. Companies create advertising campaigns and agents generate professional ads using AI technology.

## Live Platform

- **Frontend (Vercel)**: https://adsmaker-rho.vercel.app
- **Backend API (Render)**: https://adsmaker.onrender.com

---

## Features

- **AI-Powered Ad Generation**: Create professional ads using Google Gemini AI
- **Multi-User Roles**: Support for Companies, Agents, and Admins
- **Campaign Management**: Create, manage, and track advertising campaigns
- **QR Code Analytics**: Track ad performance with QR code scanning analytics
- **Stripe Payment Integration**: A full Stripe integration is in place, but payments are currently simulated using a hypothetical (HYP) payment flow.
- **Real-time Dashboard**: Statistics and performance metrics
- **Hebrew RTL Support**: Full right-to-left language support

---

## Tech Stack

### Backend (Render)
- Node.js + Express.js
- MongoDB Atlas (Database)
- Google Gemini AI
- Stripe Payment Processing
- SendGrid Email Service
- JWT Authentication

### Frontend (Vercel)
- React 18
- Vite 5
- React Router v6
- Recharts (Data Visualization)
- Stripe React SDK

---

## Project Structure

```
FinalProject/
├── client/                 # React Frontend (Deployed on Vercel)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── context/        # State management (Auth, Data)
│   │   ├── services/       # API service functions
│   │   ├── App.jsx         # Route definitions
│   │   └── main.jsx        # Entry point
│   ├── public/             # Static assets
│   ├── vite.config.js      # Vite configuration
│   └── package.json
│
├── server/                 # Express Backend (Deployed on Render)
│   ├── config/             # Database, CORS, Stripe config
│   ├── controllers/        # Request handlers
│   ├── middleware/         # Auth middleware
│   ├── models/             # Mongoose schemas
│   ├── routes/             # API endpoints
│   ├── services/           # Business logic (AI, email, etc.)
│   ├── jobs/               # Background jobs
│   └── server.js           # Server entry point
│
├── package.json            # Root package configuration
├── README.md               # This file
└── USER_HELP.md            # Comprehensive user & developer guide
```

---

## Deployment

### Frontend - Vercel

The React frontend is deployed on Vercel at https://adsmaker-rho.vercel.app

**Vercel Configuration:**
- Root Directory: `client`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables:
  - `VITE_API_BASE_URL` = `https://adsmaker.onrender.com`
  - `VITE_STRIPE_PUBLISHABLE_KEY` = Stripe publishable key

### Backend - Render

The Express backend is deployed on Render at https://adsmaker.onrender.com

**Render Configuration:**
- Root Directory: `.` (project root)
- Build Command: `npm install`
- Start Command: `npm start`
- Environment Variables: MongoDB URI, JWT secrets, API keys (Gemini, Pexels, Stripe, SendGrid)

### Database - MongoDB Atlas

- Hosted on MongoDB Atlas cloud
- Connection via `MONGODB_URI` environment variable
- IP whitelist configured for Render servers

---

## Documentation

For detailed usage instructions, see **[USER_HELP.md](./USER_HELP.md)** which includes:

- **User Guide**: Registration, campaigns, ad generation, analytics, payments
- **Role-specific Instructions**: Companies, Agents, Admins
- **Developer Guide**: Architecture, API endpoints, maintenance tips

---

## Quick Links

| Resource | URL |
|----------|-----|
| Live Platform | https://adsmaker-rho.vercel.app |
| API Server | https://adsmaker.onrender.com |
| FAQ & Help | https://adsmaker-rho.vercel.app/faq |
| Privacy Policy | https://adsmaker-rho.vercel.app/privacy-policy |
| Terms of Service | https://adsmaker-rho.vercel.app/terms-of-service |

---

## Contact

For support, contact: hilamaayan99@gmail.com

---

## License

This project is private and proprietary.
