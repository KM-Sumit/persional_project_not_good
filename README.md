# 🎓 UCI Exam Prep — Complete Setup & Run Guide
> **सरकारी प्रतियोगी परीक्षाओं (SSC, Railway, Banking, Teaching आदि) की तैयारी के लिए Full-Stack Mobile और Web Application**

---

## 📌 Table of Contents (विषय सूची)
1. [परिचय (Project Overview)](#-project-overview)
2. [सिस्टम आवश्यकताएँ (Prerequisites)](#-prerequisites)
3. [प्रोजेक्ट आर्किटेक्चर (Tech Stack & Architecture)](#-tech-stack--architecture)
4. [स्टेप 1: रिपॉजिटरी सेटअप और डिपेंडेंसी डाउनलोड (Installation)](#-step-1-installation--dependency-download)
5. [स्टेप 2: एनवायरनमेंट वेरिएबल्स सेट करें (.env Setup)](#-step-2-environment-variables-env-setup)
6. [स्टेप 3: डेटाबेस सेटअप और सीडिंग (Database Setup & Seeding)](#-step-3-database-setup--seeding)
7. [स्टेप 4: एप्लीकेशन को रन करना (Running the Application)](#-step-4-running-the-application)
8. [एडमिन पैनल और फीचर्स (Features & Admin Access)](#-features--admin-access)
9. [प्रोडक्शन बिल्ड और डिप्लॉयमेंट (Build & Deployment)](#-production-build--deployment)
10. [आम समस्याएं और समाधान (Troubleshooting & FAQs)](#-troubleshooting--faqs)
11. [प्रोजेक्ट डायरेक्टरी मैप (Project Folder Structure)](#-project-folder-structure)

---

## 📖 Project Overview

**UCI Exam Prep** एक आधुनिक, फुल-स्टैक एजुकेशन और टेस्ट प्रिपरेशन प्लेटफॉर्म है।
- **Frontend:** Expo (React Native & React Native Web) — एक ही कोडबेस से Web, Android और iOS तीनों चलते हैं।
- **Backend:** Express 5 REST API + Drizzle ORM + Node.js (TypeScript)।
- **Database:** PostgreSQL (Supabase / Neon / Render)।
- **AI Engine:** Google Gemini AI API — एक क्लिक में विषय और कठिनाई के अनुसार ऑटोमैटिक मॉक टेस्ट प्रश्न जनरेट करने के लिए।

---

## 💻 Prerequisites (सिस्टम आवश्यकताएँ)

शुरू करने से पहले आपके कंप्यूटर पर ये टूल्स होने चाहिए:

1. **Node.js**: Version 20.x या 22.x या नया ([Node.js डाउनलोड करें](https://nodejs.org/))
   ```bash
   node --version
   ```
2. **Git**: रिपॉजिटरी क्लोन करने के लिए ([Git डाउनलोड करें](https://git-scm.com/))
3. **pnpm** (Package Manager):
   अगर आपके सिस्टम में `pnpm` इनस्टॉल नहीं है, तो टर्मिनल में यह कमांड चलाएं:
   ```bash
   npm install -g pnpm
   ```
   *(नोट: अगर आपके पास `pnpm` इंस्टॉल करने की ग्लोबल परमिशन नहीं है, तो आप हर कमांड के आगे `npx -y pnpm` का उपयोग भी कर सकते हैं)*

---

## 🛠️ Tech Stack & Architecture

| लेयर | टेक्नोलॉजी | विवरण |
| :--- | :--- | :--- |
| **Monorepo** | PNPM Workspaces | सिंगल रिपॉजिटरी में सारे ऐप्स और लाइब्रेरीज मैनेज होती हैं |
| **Frontend** | React Native + Expo 57 + Expo Router | Responsive UI जो Web (Desktop/Mobile Browser) और Android/iOS पर चलती है |
| **Backend** | Express 5 + TypeScript + esbuild | Fast & Lightweight REST API Server |
| **Database & ORM** | PostgreSQL (Supabase) + Drizzle ORM | Type-safe डेटाबेस स्कीमा और क्वेरीज |
| **AI Integration** | Google Gemini API (`GEMINI_API_KEY`) | AI द्वारा स्वचालित प्रश्न-पत्र निर्माण |
| **Validation** | Zod + drizzle-zod | स्ट्रिक्ट एंड-टू-एंड डेटा वैलिडेशन |

---

## 🚀 Step 1: Installation & Dependency Download

### 1. प्रोजेक्ट फ़ोल्डर में जाएं
```bash
cd /home/chota-tota/apps/UCI-Exam-Prep
```

### 2. सारी डिपेंडेंसीज डाउनलोड करें (Download All Dependencies)
प्रोजेक्ट रूट में यह कमांड चलाएं। यह बैकएंड, फ्रंटएंड और सभी शेयर्ड लाइब्रेरीज की डिपेंडेंसीज एक साथ इंस्टॉल कर देगा:

```bash
pnpm install
```

> **वैकल्पिक (अगर pnpm कमांड नहीं मिलती है):**
> ```bash
> npx -y pnpm install
> ```

---

## 🔐 Step 2: Environment Variables (.env Setup)

प्रोजेक्ट को सही से चलने के लिए दो `.env` फ़ाइलों की आवश्यकता होती है:

### 1. Root `.env` (प्रोजेक्ट के मुख्य फ़ोल्डर में)
प्रोजेक्ट के रूट में `.env` फ़ाइल चेक करें या बनाएं:

```env
# Google Gemini API Key (AI टेस्ट जनरेटर के लिए)
GEMINI_API_KEY=your_gemini_api_key_here

# PostgreSQL Database Connection String (Supabase / Render / Neon)
DATABASE_URL=postgresql://postgres:your_password@db.your_project.supabase.co:5432/postgres

# API Server Port & Session Secret
PORT=5000
SESSION_SECRET=uci_super_secret_key_123
```

### 2. Frontend `.env` (`artifacts/uci-education/.env`)
फ्रंटएंड को यह बताने के लिए कि बैकएंड API कहाँ चल रहा है:

फ़ाइल लोकेशन: `artifacts/uci-education/.env`
```env
# लोकल डेवलपमेंट के लिए:
EXPO_PUBLIC_DOMAIN=http://localhost:5000

# या अगर मोबाइल डिवाइस (Expo Go) से कनेक्ट कर रहे हैं, तो अपने PC का Local IP दें (जैसे http://192.168.1.15:5000)
# लाइव प्रोडक्शन के लिए Render URL:
# EXPO_PUBLIC_DOMAIN=https://uci-8y03.onrender.com
```

---

## 🗄️ Step 3: Database Setup & Seeding

डेटाबेस में टेबल्स बनाने और शुरुआती डेटा डालने के लिए नीचे दिए गए स्टेप्स फॉलो करें:

### 1. डेटाबेस स्कीमा पुश करें (Create Tables in DB)
```bash
pnpm db:push
```
*(यह Drizzle Kit के जरिए `users`, `courses`, `lessons`, `notes`, `tests`, `test_questions` आदि सारी टेबल्स डेटाबेस में बना देगा)*

---

### 2. एडमिन (Admin) अकाउंट बनाएं
एडमिन अकाउंट बनाने के लिए टर्मिनल में ये एनवायरनमेंट वेरिएबल्स के साथ कमांड रन करें:
*(नोट: पासवर्ड कम से कम 12 कैरेक्टर का होना चाहिए)*

```bash
ADMIN_NAME="UCI Admin" \
ADMIN_EMAIL="admin@uci.com" \
ADMIN_MOBILE="9876543210" \
ADMIN_PASSWORD="AdminPassword@123" \
pnpm seed:admin
```

सफलतापूर्वक बनने पर यह मैसेज दिखेगा:
```
Administrator account created or updated.
```

---

### 3. सैंपल कंटेंट और मॉक टेस्ट सीड करें (Seed Default Courses & Tests)
छात्रों के लिए शुरुआती कोर्सेज, चैप्टर्स, नोट्स और मॉक टेस्ट लोड करने के लिए:

```bash
# पहले सुनिश्चित करें कि रूट .env लोडेड है (यदि आवश्यक हो):
set -a && source .env && set +a

pnpm seed:content
```

सफलतापूर्वक पूरा होने पर दिखेगा:
```
UCI sample learning content is ready.
```

---

## 🖥️ Step 4: Running the Application

एप्लीकेशन को चलाने के लिए दो सर्विस चालू करनी होती हैं:
1. **API Server (Backend)** — Port 5000 पर
2. **Frontend (Expo Web / Mobile)** — Port 8081 पर

---

### 🟢 तरीका 1: अलग-अलग टर्मिनल में रन करना (अनुशंसित / Recommended)

#### **टर्मिनल 1 (Terminal 1) — बैकएंड API सर्वर चालू करें:**
```bash
cd /home/chota-tota/apps/UCI-Exam-Prep
pnpm start:server
```
या अगर कोड में कोई नया बदलाव किया है और रीबिल्ड करके चलाना है:
```bash
pnpm dev:server
```
👉 सर्वर आउटपुट दिखेगा:
```
[INFO]: Server listening port: 5000
```
अब आपका API तैयार है: `http://localhost:5000/api/health`

---

#### **टर्मिनल 2 (Terminal 2) — फ्रंटएंड (Web & Mobile) चालू करें:**
नया टर्मिनल खोलें और यह कमांड चलाएं:

**वेब ब्राउज़र के लिए (Web Mode):**
```bash
cd /home/chota-tota/apps/UCI-Exam-Prep
pnpm dev:web
```
या सीधे `artifacts/uci-education` फ़ोल्डर से:
```bash
cd /home/chota-tota/apps/UCI-Exam-Prep/artifacts/uci-education
npx expo start --web --port 8081
```

👉 **ब्राउज़र में खोलें:**
अपने ब्राउज़र (Chrome, Edge, Firefox) में जाएं और यह URL खोलें:
**[http://localhost:8081](http://localhost:8081)**

---

#### **मोबाइल में चलाने के लिए (Mobile Mode via Expo Go):**
```bash
cd /home/chota-tota/apps/UCI-Exam-Prep
pnpm dev:mobile
```
1. अपने Android फोन में **Expo Go** ऐप डाउनलोड करें (Play Store से)।
2. टर्मिनल में दिखने वाले **QR Code** को स्कैन करें।
3. ऐप आपके फोन में लाइव खुल जाएगी!
*(ध्यान रहे: आपका मोबाइल और कंप्यूटर एक ही Wi-Fi नेटवर्क से जुड़े होने चाहिए)*

---

## 🔑 Features & Admin Access

### 1. स्टूडेंट पोर्टल (Student Access)
- ब्राउज़र में `http://localhost:8081` खोलें।
- "Create an account" पर क्लिक करके नया छात्र खाता बनाएं या लॉगिन करें।
- **फीचर्स:**
  - 📚 **Courses:** SSC, Banking, Railway आदि के वीडियो/टेक्स्ट लेक्चर्स।
  - 📝 **Mock Tests:** टाइमर के साथ लाइव ऑनलाइन टेस्ट दें।
  - 📊 **Results & Analytics:** टेस्ट सबमिट करने के बाद तुरंत स्कोर, एक्यूरेसी और सही-गलत उत्तरों का विश्लेषण देखें।
  - 📖 **Study Notes:** विषयवार संक्षिप्त रिवीजन नोट्स और फॉर्मूला शीट्स।

### 2. एडमिन पोर्टल (Admin Dashboard & AI Test Generator)
- अपने एडमिन ईमेल और पासवर्ड से लॉगिन करें (जो आपने `seed:admin` में सेट किया था):
  - **Email:** `admin@uci.com`
  - **Password:** `AdminPassword@123` (या जो आपने रखा हो)
- लॉगिन करते ही आपको **ADMIN PANEL** दिखाई देगा:
  - ➕ **Add Course:** नया कोर्स और चैप्टर्स जोड़ें।
  - 📄 **Add Note:** नए स्टडी नोट्स और PDF अटैचमेंट्स अपलोड करें।
  - ⚡ **AI Generate Test:** Google Gemini AI की मदद से किसी भी विषय (जैसे Reasoning, Quant, English, GK) पर तुरंत 10, 20 या 50 प्रश्नों का मॉक टेस्ट ऑटो-जनरेट करें।
  - 🏆 **Scoreboard & Submissions:** सभी छात्रों के टेस्ट परिणाम और प्रगति ट्रैक करें।

---

## 🏗️ Production Build & Deployment

### 1. वेब फ्रंटएंड बिल्ड (Web Export for Vercel / Netlify)
```bash
pnpm build:web
```
- आउटपुट फ़ोल्डर: `artifacts/uci-education/dist`
- रूट में पहले से `vercel.json` कॉन्फ़िगर है, इसलिए GitHub पर पुश करके सीधे Vercel पर डिप्लॉय किया जा सकता है।

### 2. बैकएंड API सर्वर बिल्ड (For Render / Railway / VPS)
```bash
pnpm build:server
```
- आउटपुट फ़ोल्डर: `artifacts/api-server/dist`
- प्रोडक्शन में स्टार्ट करने की कमांड:
  ```bash
  node --env-file=.env artifacts/api-server/dist/index.mjs
  ```

### 3. Android APK बनाना (EAS Build)
Android APK फ़ाइल जनरेट करने के लिए EAS CLI का उपयोग करें:
```bash
cd artifacts/uci-education
npx eas-cli login
npx eas-cli build --platform android --profile preview
```
बिल्ड पूरा होने के बाद EAS आपको डाउनलोड करने के लिए सीधा APK लिंक प्रदान करेगा।

---

## ❓ Troubleshooting & FAQs (आम समस्याएं और समाधान)

### समस्या 1: `bash: pnpm: command not found`
**कारण:** आपके सिस्टम में pnpm ग्लोबली पाथ में नहीं है।  
**समाधान:**
```bash
npm install -g pnpm
```
या बिना ग्लोबल इंस्टॉल किए `npx -y pnpm` का इस्तेमाल करें, उदाहरण के लिए:
```bash
npx -y pnpm install
npx -y pnpm start:server
```

---

### समस्या 2: `PORT 5000 is already in use`
**कारण:** बैकएंड सर्वर पहले से किसी बैकग्राउंड प्रोसेस में चल रहा है।  
**समाधान:**
पुरानी प्रोसेस को बंद करें:
```bash
fuser -k 5000/tcp || npx kill-port 5000
```
फिर दोबारा सर्वर स्टार्ट करें।

---

### समस्या 3: `PORT 8081 is already in use` (Expo)
**कारण:** मेट्रो बंडलर या कोई अन्य ऐप पोर्ट 8081 का उपयोग कर रही है।  
**समाधान:**
```bash
fuser -k 8081/tcp || npx kill-port 8081
```
या किसी दूसरे पोर्ट पर चलाएं:
```bash
cd artifacts/uci-education && npx expo start --web --port 8082
```

---

### समस्या 4: Database SSL Connection Error (`self-signed certificate`)
**कारण:** Supabase या अन्य क्लाउड डेटाबेस को सुरक्षित SSL कनेक्शन चाहिए होता है।  
**समाधान:**
प्रोजेक्ट के `lib/db/src/index.ts` में SSL को पहले से ही `ssl: { rejectUnauthorized: false }` पर कॉन्फ़िगर किया गया है। सुनिश्चित करें कि `.env` में `DATABASE_URL` सही है और पासवर्ड में स्पेशल कैरेक्टर URL-encoded हैं (जैसे `@` की जगह `%40`)।

---

### समस्या 5: `ADMIN_PASSWORD must be at least 12 characters`
**कारण:** सुरक्षा कारणों से एडमिन पासवर्ड न्यूनतम 12 अक्षरों का होना अनिवार्य है।  
**समाधान:**
`seed:admin` चलाते समय 12 या अधिक अक्षरों का पासवर्ड प्रदान करें (जैसे `AdminPassword@123`)।

---

## 📁 Project Folder Structure

```
UCI-Exam-Prep/
├── .env                              # मुख्य एनवायरनमेंट वेरिएबल्स (DB, Gemini, Port)
├── package.json                      # रूट वर्कस्पेस स्क्रिप्ट्स (dev:server, dev:web आदि)
├── pnpm-workspace.yaml               # PNPM वर्कस्पेस कॉन्फ़िगरेशन
├── vercel.json                       # Vercel वेब डिप्लॉयमेंट कॉन्फ़िगरेशन
│
├── artifacts/
│   ├── api-server/                   # 🚀 Express 5 Backend API
│   │   ├── src/
│   │   │   ├── routes/               # API एंडपॉइंट्स (Auth, Courses, Tests, Notes)
│   │   │   ├── lib/                  # JWT ऑथ, पासवर्ड हैशिंग, लॉगर
│   │   │   └── app.ts / index.ts     # Express ऐप सेटअप
│   │   ├── scripts/
│   │   │   ├── seed-admin.ts         # एडमिन यूजर बनाने की स्क्रिप्ट
│   │   │   └── seed-content.ts       # सैंपल कंटेंट लोड करने की स्क्रिप्ट
│   │   └── build.mjs                 # esbuild बंडलिंग स्क्रिप्ट
│   │
│   └── uci-education/                # 📱 Expo / React Native Frontend
│       ├── app/                      # Expo Router स्क्रीन पेजेस (auth, tabs, admin)
│       ├── components/               # Reusable UI कॉम्पोनेंट्स
│       ├── store/                    # ऑथ और स्टेट मैनेजमेंट
│       ├── hooks/ / lib/             # कस्टम हुक्स और API क्लाइंट
│       ├── eas.json                  # Android APK / AAB बिल्ड सेटिंग्स
│       └── .env                      # फ्रंटएंड बैकएंड URL (EXPO_PUBLIC_DOMAIN)
│
└── lib/
    ├── db/                           # 🗄️ Drizzle ORM + PostgreSQL स्कीमा
    │   ├── src/schema/education.ts   # डेटाबेस टेबल्स (users, tests, courses आदि)
    │   └── drizzle.config.ts         # Drizzle किट कॉन्फ़िग
    ├── api-client-react/             # React Query Hooks (Auto-generated)
    ├── api-spec/                     # OpenAPI 3.0 API Specification
    └── api-zod/                      # Zod Validations
```

---

## ⚡ Quick Cheat-Sheet (शॉर्टकट कमांड्स)

| कार्य (Task) | कमांड (Command) |
| :--- | :--- |
| **सभी डिपेंडेंसीज डाउनलोड करना** | `pnpm install` |
| **डेटाबेस स्कीमा अपडेट करना** | `pnpm db:push` |
| **एडमिन अकाउंट बनाना** | `ADMIN_NAME="..." ADMIN_EMAIL="..." ADMIN_MOBILE="..." ADMIN_PASSWORD="..." pnpm seed:admin` |
| **सैंपल डेटा लोड करना** | `pnpm seed:content` |
| **बैकएंड सर्वर चालू करना** | `pnpm start:server` *(Port 5000)* |
| **वेब ऐप चालू करना** | `pnpm dev:web` *(Port 8081)* |
| **मोबाइल ऐप (Expo) चालू करना** | `pnpm dev:mobile` |
| **वेब प्रोडक्शन बिल्ड बनाना** | `pnpm build:web` |

---

🎯 **All set! Happy coding & exam preparation!** 🚀
