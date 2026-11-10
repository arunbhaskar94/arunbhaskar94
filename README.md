# QuizMaster

An anonymous-first SSC and Banking exam-preparation app with quizzes, social learning, and ad-supported access.

## Screenshot

Add product screenshots to `docs/screenshots/` and replace these placeholders before release:

| Home | Quiz session |
|---|---|
| ![Home screenshot placeholder](docs/screenshots/home.png) | ![Quiz screenshot placeholder](docs/screenshots/quiz.png) |

![Profile and share card screenshot placeholder](docs/screenshots/profile.png)

## Features

### Anonymous users
- Subject tests, full mock tests, and vertical question reels
- Banner ads and rewarded-ad offers
- XP, streaks, badges, coins, daily challenges, and cohort leaderboards
- Light, dark, and system appearance; installable PWA experience

### Verified users
- Everything available to anonymous users
- PYQ mode (one set per account), real-time chat, AI-generated questions, and AI tutoring
- Public progress profiles, referrals, performance insights, and spaced-repetition reviews
- FCM review reminders (after notification permission) and downloadable PNG share cards
- 1v1 battles, live tournaments, study groups, story mode, audio questions, fill-in-the-blank, and image questions are planned feature surfaces

### Administrators
- Question import and AI-question review
- User management (ban, verify, XP adjustments) and DAU/retention analytics
- Flagged-chat review, announcements, and feature flags are planned admin surfaces
- Admin access is restricted to the configured administrator email

### Scheduled services
- Daily anonymous-profile cleanup, streak reset, daily challenge publishing, and due-SRS push reminders
- Weekly cohort leaderboard snapshots

## Tech stack

- Next.js App Router, React, and strict TypeScript
- Firebase Authentication, Firestore, Storage, Cloud Functions (2nd gen, Node 20), FCM, and Hosting
- Upstash Redis REST for rate limiting and leaderboards
- Tailwind CSS and shadcn/ui
- Zustand, TanStack Query, and Zod
- Google Gemini API (Cloud Functions only)
- Cloudflare Turnstile, Framer Motion, Recharts, and next-pwa
- pnpm and Node.js 20

## Prerequisites

- Node.js 20
- pnpm
- Firebase CLI
- A Firebase project with billing enabled for production services

## Setup

1. Clone the repository and enter the project directory:

   ```sh
git clone https://github.com/arunbhaskar94/arunbhaskar94.git
cd arunbhaskar94
pnpm install
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Authenticate with Firebase:

   ```sh
   firebase login
   ```

4. Copy `.env.example` to `.env.local` and fill in the values for your Firebase, Upstash, Gemini, administrator, ads, and Turnstile projects. Set `ALLOWED_ORIGINS` in the app and Functions environments to your local and deployed app origins.
5. Configure `REWARDED_AD_PROOF_SECRET` as a server-only secret in the Functions environment, and issue short-lived HMAC proofs only from the trusted ad-provider server callback. The browser never signs or verifies its own ad completion.
6. To enable web push, add the Firebase Web Push certificate key as `NEXT_PUBLIC_FIREBASE_VAPID_KEY` and configure the FCM web app. Notification permission is requested only after the user opts in from Settings.
7. Start the development server:

   ```sh
   pnpm dev
   ```

## Firebase setup

1. Create a Firebase project and register a web app.
2. In Authentication, enable Anonymous, Email/Password, and Google sign-in providers. In Cloud Messaging, configure a Web Push certificate (VAPID) for browser notifications.
3. Create a Firestore database and configure Firebase Storage.
4. Configure the Firebase CLI project for the app before deploying.
5. Set the Firebase Admin credentials and other server-only secrets in the appropriate deployment environment; never expose them as `NEXT_PUBLIC_*` variables.

## Deploying

Deploy Cloud Functions, Firestore rules/indexes, and Storage rules with the Firebase CLI after configuring the project and secrets:

```sh
firebase deploy --only functions,firestore:rules,firestore:indexes,storage
pnpm build
firebase deploy --only hosting
```

The functions target Node.js 20 in `asia-south1`. Configure Hosting to serve the built Next.js app using the Firebase-supported Next.js integration for your deployment setup. Build with the Firebase web app settings in `.env.local`; PWA service-worker assets are generated during production builds and are ignored by Git.
Deploying Functions also provisions the scheduled jobs: anonymous-profile cleanup (03:00 UTC), streak reset and daily challenge (00:00 UTC), weekly leaderboard snapshots (Sunday 23:00 UTC), and due-review notifications (08:00 UTC). Due-review notifications use verified-user FCM tokens stored in `users/{uid}.fcmTokens`; register tokens only through a trusted server flow.

## Folder structure

- `src/app/`: App Router pages, layouts, and API route
- `src/components/`: UI, quiz, ads, gamification, social, and layout components
- `src/lib/`, `src/stores/`, `src/types/`: shared clients, validation, hooks, state, and domain types
- `functions/src/`: Cloud Functions, middleware, scheduled jobs, and triggers
- `public/`: web app manifest and icons
- Root Firebase configuration and security rules: `firebase.json`, `firestore.rules`, `firestore.indexes.json`, and `storage.rules`

## Security notes

- Correct answers are never included in question payloads sent to clients. Functions sanitize question responses and only return solutions after a valid answer submission.
- Firestore question and PYQ reads are Cloud-Function-only; Storage rules deny direct access to PYQ images, which must be served with signed URLs.
- Firebase Admin SDK and Gemini credentials are server-side only.
- Protected features require verified Firebase identities, and admin access is restricted by `ADMIN_EMAIL`.
- Production deployments must configure allowed CORS origins, rate limits, and server-side validation for rewarded-ad callbacks.

## Roadmap

1. **Phase 1:** Core app foundation, anonymous authentication, quiz flows, and baseline security.
2. **Phase 2:** Verified-user features, social experiences, and gamification.
3. **Phase 3:** AI, intelligence tools, tournaments, and production notifications.
4. **Phase 4:** Admin operations, analytics, hardening, and launch readiness.

## License

MIT
