#IN PROGRESS IT'S HALF DONE BRO


# Dahej Control System

A production-minded full-stack starter with:

- React + Vite + Tailwind CSS + React Router frontend
- Node.js + Express + MongoDB backend
- JWT-based admin authentication
- Anonymous complaint reporting with optional image/video upload
- Consent-based approximate location sharing with encrypted storage
- Floating Hinglish AI chat assistant powered by the OpenAI API
- Clean `client` / `server` modular structure

## Project structure

```text
.
|-- client/
|   |-- src/
|   |   |-- app/
|   |   |-- components/
|   |   |-- context/
|   |   |-- hooks/
|   |   |-- pages/
|   |   |-- services/
|   |   `-- styles/
|   |-- index.html
|   |-- package.json
|   |-- tailwind.config.js
|   `-- vite.config.js
|-- server/
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- middlewares/
|   |   |-- models/
|   |   |-- routes/
|   |   |-- services/
|   |   `-- utils/
|   |-- uploads/
|   |-- .env.example
|   `-- package.json
`-- package.json
```

## Features

- Seeded admin user created from environment variables at server startup
- Protected Express routes using JWT bearer tokens
- Protected React dashboard route with persisted auth state
- Public complaint submission route with generated anonymous IDs
- Optional image/video uploads stored locally and exposed by URL
- Approximate location stored encrypted at rest and shown only when consented
- Admin dashboard for complaint review, filtering, media access, and status updates
- Floating WhatsApp-style chatbot for dowry-law awareness and action guidance
- MongoDB-based user storage with modular services and controllers
- Secure API middleware stack with Helmet, CORS, rate limiting, and compression
- Structured request validation, request IDs, encrypted complaint text/location, and spam protection
- Uploaded images/videos are renamed to random IDs and sanitized to remove metadata before storage
- Complaint text is analyzed for dowry-related keywords with stored risk score and Low/Medium/High risk levels
- Approximate-location-based NGO routing assigns a mock nearest NGO and stores the assignment for future integration upgrades
- In-app admin notifications are created when new complaints arrive and shown in the dashboard
- Dashboard analytics include complaint counts, chart-ready trend data, and a consent-based location heatmap

## Setup

### 1. Install dependencies

From the project root:

```bash
npm install
```

### 2. Configure environment variables

Create the server environment file:

```bash
cp server/.env.example server/.env
```

Create the client environment file if you want an explicit API URL:

```bash
cp client/.env.example client/.env
```

Update `server/.env` with your MongoDB connection string and admin credentials.

## Run locally

Start both client and server:

```bash
npm run dev
```

App URLs:

- Client: `http://localhost:5173`
- Server: `http://localhost:5000`
- API health check: `http://localhost:5000/api/v1/health`
- Complaint submission page: `http://localhost:5173/report`

## Complaint reporting

Public endpoint:

```text
POST /api/v1/complaints
```

Request format:

- `multipart/form-data`
- `description`: optional text
- `city`: optional city-level location
- `district`: optional district-level location
- `locationConsent`: optional boolean toggle
- `media`: optional image or video file

At least one of `description` or `media` must be provided.

Privacy rules:

- Only approximate city or district is accepted
- Exact GPS coordinates should not be submitted and are rejected by the API
- Location is stored encrypted at rest
- Admin views show anonymous IDs and approximate location only when consent is granted
- No personal identity fields are collected in the complaint form

Stored fields:

- `anonymousId`
- `mediaUrl`
- `description`
- `locationConsent`
- `detectedKeywords`
- `riskScore`
- `riskLevel`
- `assignedNgo`
- `timestamp`
- `status`
- `mediaType`

NGO routing notes:

- Uses approximate complaint location to assign the best match from a mock NGO directory
- Falls back to a national referral NGO when no city/district match is available
- Stores the NGO assignment snapshot with source and match type in MongoDB
- Routing logic is isolated in `server/src/services/ngo-router.service.js` so real NGO APIs can replace the mock directory later

Admin dashboard endpoints:

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/complaints?status=submitted`
- `PATCH /api/v1/dashboard/complaints/:anonymousId/status`

Analytics notes:

- Dashboard summary now includes overall complaint counts, status/risk breakdowns, 7-day complaint trend data, and heatmap buckets by approximate location
- Heatmap data is generated only from complaints where location sharing was consented
- Visualizations use lightweight native dashboard components rather than an external chart library

Security notes:

- Global and route-specific rate limiting is enabled for API, login, complaints, and chatbot routes
- JWTs are signed with issuer, audience, expiry, and algorithm checks
- Complaint text and approximate location are encrypted at rest
- Uploaded images are re-encoded to drop EXIF/embedded metadata before storage
- Uploaded videos are remuxed with metadata and chapters removed before storage
- Original filenames are never persisted; stored media uses random file IDs
- Request payloads are sanitized to block Mongo-style operator injection
- Public complaint submissions use validation, honeypot blocking, and duplicate-submission detection
- Error responses include a request ID for tracing and return safer messages in production

Notification notes:

- A simple in-app notification record is created whenever a new complaint is submitted
- Notifications are included in the dashboard summary response for admin alerts
- The current setup is intentionally simple and ready to evolve into email, SMS, push, or websocket delivery later

Chatbot endpoint:

- `POST /api/v1/chatbot`

Chatbot notes:

- Uses the OpenAI API from the server side only
- Replies in Hinglish
- Focuses on dowry-law awareness and practical next steps
- Warns users not to share personal identity or exact location
- Returns a configuration message until `OPENAI_API_KEY` is set

## Default auth flow

On first server startup, the backend checks MongoDB for the configured admin email:

- If the admin user does not exist, it is created with the password from `ADMIN_PASSWORD`
- If the admin user already exists, the existing account is used

Use those same credentials on the `/login` page.

## Production notes

- Set a strong `JWT_SECRET`
- `JWT_SECRET` must be at least 32 characters
- Configure `JWT_ISSUER` and `JWT_AUDIENCE` if you need custom token boundaries
- Set a strong `LOCATION_ENCRYPTION_KEY`
- Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` to enable the chat assistant
- Set `SERVER_PUBLIC_URL` to your deployed API origin so stored media URLs are correct
- Restrict `CLIENT_URL` to your deployed frontend origin
- Replace the default MongoDB URI with a managed production database
- Serve the client and API behind HTTPS in deployment
