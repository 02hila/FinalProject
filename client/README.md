# AdsMaker - AI Marketing Studio

## 🚀 הרצת הפרויקט

### אפשרות 1: הרצה מה-Root (מומלץ)

```bash
# הרצת הקליינט בלבד (פיתוח)
npm run dev

# הרצת השרת בלבד (עם טעינה מחדש אוטומטית)
npm run server

# בניית הקליינט לפרודקשן
npm run build

# הרצת השרת בפרודקשן (אחרי build)
npm start
```

### אפשרות 2: הרצה ידנית

#### הרצת הקליינט (React + Vite):
```bash
cd client
npm run dev
```

#### הרצת השרת (Node.js + Express):
```bash
cd server
nodemon server.js
```

---

## 📁 מבנה הפרויקט

```
AdsMaker/
├── client/              # Frontend React
│   ├── src/
│   └── package.json
├── server/              # Backend Node.js
│   ├── server.js
│   ├── models/
│   └── routes/
├── package.json         # תלויות Root + Scripts
└── .env                 # משתני סביבה
```

---

## 🛠️ התקנה ראשונית

```bash
# 1. התקן תלויות Root (Server)
npm install

# 2. התקן תלויות Client
cd client
npm install
cd ..
```

---

## 🌐 משתני סביבה

צור קובץ `.env` בתיקיית השורש (`AdsMaker`) עם המשתנים הבאים:

```env
MONGODB_URI=mongodb://...
GEMINI_API_KEY=your_api_key
PEXELS_API_KEY=your_pexels_key
JWT_SECRET=your_jwt_secret
PORT=5000
```