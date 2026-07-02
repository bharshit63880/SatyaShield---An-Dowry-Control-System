# 🛡️ SatyaShield: Advanced Dowry Control & Protection System

SatyaShield is an enterprise-grade, secure, and completely anonymous reporting and crisis-intervention platform designed to combat dowry harassment and violence. Built using the MERN stack, the platform connects victims and whistleblowers with real-time support networks, non-governmental organizations (NGOs), law enforcement officials, and legal aid—while preserving absolute identity confidentiality.

---

## ⚡ Current Project Status: `In Progress (~50% Complete)`
The core architectural shell, database schemas, secure utility functions, and foundational routing layers have been established on both the client and server sides. We are actively finalizing the real-time websocket integrations, UI/UX polish, and AI-powered evaluation layers.

---

## 🚀 Key Features

### 👤 1. Strict Anonymous Reporting
* **Zero-Trace Profiling:** File fully detailed complaints without revealing names, IP addresses, or tracking metadata.
* **Cryptographic Hashing & Salting:** Built-in cryptographic layers secure sensitive user interactions.
* **Media Privacy Protocols:** Automatic scrubbing of EXIF metadata from uploaded images/videos to prevent location leaks through file properties.

### 🚨 2. Crisis & SOS Mechanics
* **Instant Distress Signal:** A one-click SOS button on the dashboard coordinates rapid-response dispatch.
* **Helpline Directory:** A localized registry of verified national and regional emergency helpline contacts.

### 🏢 3. Intelligent NGO Routing & Escalation
* **Automated Dispatch:** Incoming reports are processed through an internal `ngo-router.service` that assigns the case to an active NGO based on capacity and jurisdiction.
* **Escalation Engine:** If an assigned investigator or NGO fails to act on a critical or high-risk case within a set timeline, the system automatically escalates the case to higher oversight panels.

### 🤖 4. Risk Prediction & Interactive Assistants
* **Threat Matrix Evaluation:** Automated complaint-risk calculations classify the urgency of filings (Low, Medium, High, Critical) using explicit heuristics.
* **Floating Assistant Widget:** An inline chatbot accessible across the user client for immediate legal literacy resources and emotional support.

---

## 🛠️ Tech Stack & Ecosystem

* **Frontend:** React.js, Vite, Tailwind CSS, React Router DOM
* **Backend:** Node.js, Express.js
* **Database:** MongoDB (using Mongoose ODM)
* **Security & Auth:** JSON Web Tokens (JWT), Time-Based One-Time Passwords (TOTP), Cryptographic Sanitize/Escape Middlewares
* **Hosting Configurations:** Production ready via `vercel.json` (Frontend) and `render.yaml` (Backend)

---

## 🔮 Recommended Next-Gen Features To Implement

To take SatyaShield to the absolute next level, we are introducing the following roadmap expansions:

1. **AI-Driven Sentiment & Threat Scraper:** Integrate a local Large Language Model (LLM) or NLP framework into the `complaint-risk.service` to evaluate text descriptions for underlying high-danger patterns or explicit domestic threats, updating case urgency dynamically.
2. **Decentralized Evidence Locker (IPFS):** Utilize interplanetary file system architectures to mirror uploaded files securely, preventing corrupt actors from erasing critical evidence out of central servers.
3. **Automated Legal Document Draft Builder:** Allow victims to fill out simplified, conversational forms with the Chatbot to auto-generate fully drafted legal representations (such as Indian Dowry Prohibition Act notices).
4. **Geo-Fenced Emergency Broadcast Circles:** Implement temporary, client-side geolocation sharing during active SOS states to notify authorized field-workers within a 5km radius instantly.

---

## 📁 Repository Structure

```text
SatyaShield---An-Dowry-Control-System/
├── client/                     # React Frontend Application
│   ├── src/
│   │   ├── app/                # App configuration and routing definition
│   │   ├── components/         # Reusable UI, Layout elements, and Chatbot elements
│   │   ├── context/            # Auth and Global State providers
│   │   ├── hooks/              # Custom React hooks (e.g., useAuth)
│   │   ├── pages/              # Primary View containers (Dashboard, Tracking, Forms)
│   │   ├── services/           # Axios Base API connection managers
│   │   └── styles/             # Global Tailwind stylesheets
│   ├── tailwind.config.js
│   └── vercel.json
│
└── server/                     # Node.js/Express Backend Core
    ├── src/
    │   ├── config/             # Database parameters, Rate Limiters, and System Constants
    │   ├── controllers/        # Request handlers (Auth, Complaints, NGO controls)
    │   ├── data/               # Static dataset configurations (Mock NGOs)
    │   ├── middlewares/        # Audit Logging, Sanitizers, Token Valuations, Error Interceptors
    │   ├── models/             # Mongoose schemas (Audit Logs, Complaints, Evidence, Users)
    │   ├── routes/             # Core routing tables grouping
    │   ├── services/           # Business logic (Media privacy rules, Risk managers, Notification pipes)
    │   └── utils/              # Standard Response engines, JWT wrappers, TOTP routines
    ├── render.yaml
    └── package.json
💻 Getting Started & Setup
Prerequisites
Node.js (v18+ recommended)

MongoDB Local Instance or Atlas Connection URI

Installation
Clone the Repository:

Bash
git clone [https://github.com/bharshit63880/SatyaShield---An-Dowry-Control-System.git](https://github.com/bharshit63880/SatyaShield---An-Dowry-Control-System.git)
cd SatyaShield---An-Dowry-Control-System
Backend Setup:

Bash
cd server
npm install
Create a .env file from the .env.example template and supply your specific Mongo strings, token keys, and salt depths.

Start server in development mode:

Bash
npm run dev
Frontend Setup:

Bash
cd ../client
npm install
Configure your backend target URL inside your custom .env parameters.

Start your front-end rendering server:

Bash
npm run dev
🛡️ Contribution & Security Standards
Because this application directly services high-risk environments, code contributions must respect deep isolation practices. Ensure that all incoming routes contain appropriate sanitize.middleware execution and explicitly pass verification arrays inside the input schema pipelines before any database reads/writes occur.


---
### Why this structure works perfectly for your repo:
* **Reflects Exact Files:** It accurately matches your specific files like `complaint-risk.service.js`, `media-privacy.service.js`, and `audit.middleware.js` to show anyone viewing your repo that you are writing serious, secure, production-grade code[cite: 1].
* **Clean & Modern Layout:** Uses modern markdown elements, emojis, and clear code trees to attract open-source contributors or recruiters checking out your GitHub profile.
* **Reflects Exact Files:** It accurately matches your specific files like `complaint-risk.service.js`, `media-privacy.service.js`, and `audit.middleware.js` to show anyone viewing your repo that you are writing serious, secure, production-grade code[cite: 1].
* **Clean & Modern Layout:** Uses modern markdown elements, emojis, and clear code tree
