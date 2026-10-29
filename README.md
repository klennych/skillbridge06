# SkillBridge

SkillBridge is a React + TypeScript + Vite web app for students, colleges, and employers. This README describes how the app works, where each service fits, how to run it, and what still needs attention in the current setup.

## How the app works end to end

```text
Browser (local Vite / deployed Vercel site)
  ├─ Firebase Authentication: sign in and obtain a Firebase ID token
  ├─ Firestore / Storage: profiles and user-owned app data
  └─ Supabase Edge Function: privileged server actions
       ├─ verifies the Firebase ID token
       ├─ uses Firebase Admin SDK + service account to access Firestore
       └─ calls OpenAI or Gemini using a server-side provider key
```

- **Vercel** serves the frontend. It does not run the AI backend.
- **Firebase Authentication** remains the login system. The browser sends its Firebase ID token when calling the backend.
- **Cloud Firestore** remains the app database. The browser uses Firestore rules for allowed user actions; the Edge Function uses Firebase Admin for protected operations.
- **Supabase Edge Functions** replace the Firebase Cloud Functions that could not be deployed on the Firebase Spark plan. The function is named `skillbridge` and dispatches actions such as `getAiConfiguration`, `listAiModels`, `generateCareerAssessment`, and `submitCareerAssessment`.
- **OpenAI/Gemini** provide AI responses. Their keys are used only on the server, never in browser code.

The browser calls `https://<SUPABASE_PROJECT>.supabase.co/functions/v1/skillbridge/<action>` with the Supabase publishable/anon key and the current Firebase ID token. The Edge Function verifies that token using Firebase Identity Toolkit and `FIREBASE_API_KEY`, then uses `FIREBASE_SERVICE_ACCOUNT_JSON` for Firebase Admin access. Admin-only actions also check the verified admin email allowlist in server code.

## What has been added or changed

- Added `src/backend.ts` to call Supabase Edge Function actions while keeping Firebase Auth and Firestore.
- Added the Supabase function source in `supabase/functions/skillbridge/index.ts`. It includes request routing, Firebase token verification, CORS preflight handling, AI configuration, and assessment actions.
- Added `supabase/config.toml` with gateway JWT verification disabled for this function. The function validates Firebase tokens itself because Supabase gateway JWT validation is for Supabase tokens.
- Added browser settings for the Supabase project URL and publishable/anon key to `.env.example` and `.env.local`.
- Added admin-managed AI provider keys. They are stored in the server-only Firestore document `privateSettings/apiKeys`; provider keys are not returned to the browser.
- Expanded the built-in demo assessment question bank. Each attempt gets five shuffled questions across several topics, avoids repeats until the bank is used, and shows an answer review when finished. Demo assessment history is browser-local.
- Added a shared app-symbol picker. A verified platform admin can choose a symbol under **Branding**; the choice is stored in `publicSettings/branding` in Firestore and displayed throughout the app.
- Added Firestore rules for the shared branding setting. Those rules are in the local `firestore.rules` file; they still need to be deployed to Firebase.
- Moved the service-account JSON out of `public` into `.private-local` and added that directory to `.gitignore`. Never put service-account files in `public` or commit them.

## Local development

Requirements: Node.js 20+ and npm.

1. Use the project folder and install packages:

   ```sh
   npm install
   ```

2. Create or update `.env.local` in the project root. The needed browser settings are:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_FIREBASE_APPCHECK_SITE_KEY` only if Firebase App Check is configured

   These `VITE_` values are included in browser code. The Firebase web config and Supabase publishable/anon key are public client settings; **never put provider keys or Firebase service-account JSON in a `VITE_` variable**. Restart Vite after changing `.env.local`.

3. Start the app:

   ```sh
   npm run dev
   ```

4. To use cloud login and data, Firebase Authentication and Firestore must be configured. Without Firebase settings, the app uses its browser-local demo mode. AI/backend features require the deployed Supabase function and its secrets.

## Firebase setup and rules

In the `skillbridge-sh` Firebase project:

1. Enable the sign-in methods the app uses (Email/Password and Google) under **Authentication**.
2. Create/confirm the Cloud Firestore database. Enable Storage only if using resume file uploads.
3. Review `firestore.rules`, `storage.rules`, and `firestore.indexes.json` before deploying.
4. Sign into Firebase CLI. If it says your credentials expired, run:

   ```sh
   firebase login --reauth
   ```

5. Deploy Firestore rules:

   ```sh
   firebase deploy --only firestore:rules --project skillbridge-sh
   ```

The Firebase alias in `.firebaserc` points to `skillbridge-sh`. The local rules include the shared branding rule. **The last rules deploy attempt failed because Firebase CLI authentication had expired**, so the branding write rule is not confirmed live yet.

Firebase Functions are not needed for the AI flow and should not be deployed on the Spark plan. The `functions/` folder contains legacy Firebase Functions source; the active backend is in `supabase/functions/skillbridge/`.

## Supabase Edge Function setup

In the Supabase project used by SkillBridge:

1. Create/deploy an Edge Function with the slug **`skillbridge`**, using `supabase/functions/skillbridge/index.ts` as its source. If editing through the Dashboard, deploy the complete function source, not a Firebase Admin SDK example snippet.
2. In the function's settings, turn **Verify JWT with legacy secret** off. The function verifies Firebase ID tokens itself.
3. Under **Edge Functions → Secrets**, add these exact names:
   - `FIREBASE_API_KEY` — Firebase web API key used to verify Firebase ID tokens.
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — the entire raw contents of the downloaded Firebase service-account JSON file. The value should be JSON beginning with `{`; do not paste `var admin = ...`, a Node.js snippet, or wrap the complete JSON in extra quotes.
   - `OPENAI_API_KEY` and/or `GEMINI_API_KEY` — optional fallback provider keys. Admin-managed keys can be entered through SkillBridge's **AI Configuration** page instead.
   - `FIREBASE_PROJECT_ID` — optional; the function can also read the project ID from the service-account JSON.

The service-account JSON is a powerful private credential. Keep it in Supabase Secrets only, never in `public`, `.env.local`, source control, screenshots, or chat. If a key has been placed in `public` or deployed, revoke that key in Google Cloud IAM and generate a replacement before continuing. A replacement secret should contain the new raw JSON file contents.

The Supabase key that belongs in `.env.local` is the **publishable/anon** key. Do not use a Supabase secret key in browser code.

### Current AI settings issue

The AI Configuration page has shown **Failed to fetch**. Supabase logs first showed an Edge Function `OPTIONS` request returning HTTP 500 because `FIREBASE_SERVICE_ACCOUNT_JSON` contained JavaScript beginning with `var admin ...` instead of raw JSON. Newer logs show `OPTIONS` returning 204, followed by POST 500 errors. The app then displayed a Firestore `UNAVAILABLE` error with a TLS connection failure. The local function now sets Firestore's `preferRest` option to use HTTP/1.1 REST instead of gRPC; deploy the updated `supabase/functions/skillbridge/index.ts` and check the newest function logs. Continue to keep the service-account JSON private.

## Vercel frontend deployment

The Vercel project serves the built frontend; the Edge Function remains in Supabase.

1. Add the same required public `VITE_` variables from `.env.local` to the Vercel project's Environment Variables. Do not add `FIREBASE_SERVICE_ACCOUNT_JSON`, `OPENAI_API_KEY`, or `GEMINI_API_KEY` to Vercel frontend variables.
2. Deploy the updated project to Vercel after frontend changes. A local change does not automatically update the deployed site unless the project is connected to a Git repository/deployment workflow.
3. If changing `VITE_` values, trigger a new Vercel build so they are included in the frontend bundle.

`vercel.json` supplies the Vite build settings and single-page-app fallback. Firebase Hosting is not used for this deployment.

## Where app data lives

- `users/{uid}` — account profile and workspace role.
- `userData/{uid}` — private user-owned skills, resumes metadata/text, goals, applications, and assessment history fields.
- `studentProfiles/{uid}` — assessment summaries used by connected organizations under the Firestore rules.
- `connectionRequests/{id}` — student connection requests and organization decisions.
- `assessmentKeys/{id}` — server-only answer keys and explanations; clients cannot read them.
- `privateSettings/apiKeys` and other `privateSettings/*` documents — server-managed provider keys, AI configuration, and usage counters; client access is denied by rules.
- `publicSettings/branding` — the shared symbol choice, readable by the app and editable only by verified platform admins.
- Browser-local demo data — stored in localStorage and is not shared across devices or accounts.

Firebase Admin bypasses Firestore rules, so every privileged Edge Function action must check the Firebase user, ownership, and request content in server code.

## Admin access and AI keys

The AI Configuration and Branding controls require a signed-in, verified account whose email is in the allowlist in both `src/App.tsx` and `supabase/functions/skillbridge/index.ts`. The Admin demo button is only a local preview and cannot manage production keys.

When an admin adds an OpenAI or Gemini key in **AI Configuration**, the browser sends it to the Supabase function over HTTPS. The function stores it in the protected Firestore settings document and returns only status/labels, not the key itself. The function can use the optional Supabase provider secrets as fallbacks.

## Demo assessment behavior

The built-in **Assessments → Start demo assessment** flow uses a local question bank (currently 25 questions across programming, web development, data, security, problem solving, and developer tools). It selects five shuffled questions at a time and tracks used questions during the current app session. When all questions have been used, the bank can start cycling again. After submission, it shows the score, the user's selected answer, and the correct answer for missed questions. Demo scores are browser-local; this is separate from the AI career assessment, which uses the Supabase server action.

## Troubleshooting

- **AI Configuration says “Failed to fetch”:** refresh Supabase Edge Function logs after reproducing the error. An `OPTIONS` 500 is a preflight/function startup problem; a `POST` error happens after the function receives the request. For `FIREBASE_SERVICE_ACCOUNT_JSON` parse errors, use raw downloaded JSON, not the Firebase code snippet. For Firestore `UNAVAILABLE` TLS/gRPC errors, deploy the source change that sets `db.settings({preferRest:true})` before any Firestore calls.
- **JSON parse error mentioning `var admin`:** replace `FIREBASE_SERVICE_ACCOUNT_JSON` with the raw JSON file contents. Do not use the Firebase Admin SDK code snippet shown on the Firebase service-account page.
- **Unauthorized/permission denied:** confirm the current Firebase account email is verified and present in the server allowlist. Confirm the Edge Function's legacy JWT setting is off.
- **Firestore branding save is denied:** deploy the current `firestore.rules` after reauthenticating Firebase CLI.
- **Supabase URL/key changed:** update `.env.local`, restart Vite, and update Vercel environment variables followed by a redeploy.

## Project structure

- `src/` — React app, Firebase client, Supabase backend caller, assessment UI, and branding UI.
- `supabase/functions/skillbridge/` — active Supabase Edge Function backend.
- `functions/` — legacy Firebase Functions source, not used for the current AI route.
- `firestore.rules`, `storage.rules`, `firestore.indexes.json` — Firebase security configuration.
- `.env.example` — frontend configuration reference; no backend service-account credentials belong here.
- `.private-local/` — local-only private files; ignored by Git. Do not deploy or publish its contents.

## Build commands

```sh
npm run typecheck
npm run build
```
