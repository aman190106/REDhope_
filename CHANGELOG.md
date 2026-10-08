# REDhope Changelog

All notable changes to the REDhope project are documented here.

The changelog tracks meaningful development progress, completed features,
important fixes, architecture changes, and security improvements.

---

# [Unreleased]

Changes currently being developed.

---

# [2026-10-09]

## Donor Health Screening & Medical Review

- **Dedicated Clinical Models** (`server/models/healthScreening.js`, `server/models/medicalDocument.js`, `server/models/medicalAuditLog.js`):
  - Created `HealthScreening` schema holding structured questionnaire data, preliminary clinical flags, reviewer decision records, and informed consent metadata.
  - Created `MedicalDocument` schema capturing sanitized metadata, mime types, file sizes, and private storage references (never public URLs).
  - Created `MedicalAuditLog` schema tracking all access events (`MEDICAL_DOCUMENT_UPLOADED`, `MEDICAL_DOCUMENT_VIEWED`, `MEDICAL_DOCUMENT_DOWNLOADED`, `SCREENING_REVIEWED`) with zero sensitive medical payload leakage.
- **Private Document Storage Abstraction** (`server/services/storageService.js`):
  - Created dedicated private local storage adapter outside web-accessible assets with strict directory permissions.
  - Enforced magic byte / file signature verification (PDF, JPEG, PNG) to prevent renamed executable exploits.
  - Enforced 5MB per-file size limits and sanitized original filenames against path traversal.
  - Documented production migration to encrypted cloud object storage (AWS S3 SSE-KMS / GCS).
- **Preliminary Screening Rules & Human Authority** (`server/rules/preliminaryScreeningRules.js`):
  - Generates transparent review checklists for items requiring clinical attention (e.g. low weight, recent surgery, chronic conditions, travel exposure).
  - Strictly prevents automated medical diagnoses or AI-driven decisions; final clearance is solely determined by human clinical reviewers.
- **RESTful Screening & Reviewer APIs** (`server/controllers/healthScreeningController.js`, `server/controllers/adminHealthScreeningController.js`, `server/routes/`):
  - Donor endpoints: `GET /health-screening/me`, `PUT /health-screening/me`, `POST /health-screening/me/submit`, `POST /health-screening/me/documents`, `GET /health-screening/documents/:id`.
  - Admin/Reviewer endpoints: `GET /admin/health-screenings`, `GET /admin/health-screenings/:id`, `GET /admin/health-screenings/:id/documents/:id`, `PATCH /admin/health-screenings/:id/review`.
  - Enforced strict IDOR protection and denied organizers from accessing medical records.
- **Authoritative Eligibility & Downstream Integration** (`server/rules/eligibilityRules.js`, `server/services/eligibilityService.js`, `campRegistrationController.js`, `bloodMatchingService.js`):
  - Added `checkHealthScreening` rule to the central eligibility engine.
  - Preserved existing 90-day donation interval and administrative block rules.
  - Prevented donors with unapproved or deferred health screenings from camp registration and blood matching.
- **User & Admin Frontend Interfaces**:
  - `src/routes/health-screening.tsx`: 5-step interactive wizard (Consent & Disclaimer, Health Questionnaire, Document Upload, Review & Submit, Live Status).
  - `src/routes/admin/health-screenings/index.tsx`: Review console with status filters, search, and paginated submissions.
  - `src/routes/admin/health-screenings/$screeningId.tsx`: Comprehensive clinical review detail with questionnaire inspection, document downloads, and clinical decision form.
- **Verification & Testing**:
  - Created `scratch/test_health_screening.js` testing 42 assertions covering RBAC, upload validation, review decisions, eligibility integration, zero-PII privacy, and audit logging (100% pass rate).
  - Full regression verified: `test_security.js` (40 passed), `test_analytics.js` (35 passed), `test_donation_tracking.js` (77 passed), `test_eligibility.js` (10 passed).
  - Production build verified: `npm run build` compiled all routes with 0 errors.

## Frontend Integration & Authentication Completion

- **Centralized API Client & Base URL Configuration** (`src/lib/api.ts`, `.env.example`):
  - Standardized all backend requests through a unified `api` client (`get`, `post`, `put`, `patch`, `delete`).
  - Configurable `VITE_API_BASE_URL` defaulting to `http://localhost:5000` with clean fallback.
  - Automatically attaches `Authorization: Bearer <token>` from `localStorage` (`token` / `redhope_token`).
  - Comprehensive error parsing via `ApiError` with HTTP status codes and user-friendly messages.
  - Replaced all hardcoded `http://localhost:5000` references across `Navbar`, `camps`, `profile`, and `eligibility`.
- **Global Authentication Context & Hook** (`src/lib/auth.tsx`, `src/routes/__root.tsx`):
  - Implemented `AuthProvider` and `useAuth()` hook providing reactive `user`, `token`, `isAuthenticated`, `isLoading`, `login`, `register`, `logout`, and profile refresh capabilities.
  - Root route (`__root.tsx`) wrapped in `AuthProvider` for application-wide availability.
- **Dedicated Login & Registration Pages** (`src/routes/login.tsx`, `src/routes/register.tsx`):
  - Created clean, responsive, and accessible login form with input validation, password visibility toggles, loading indicators, and smart role-based redirects.
  - Created complete donor registration form capturing full name, email, 10-digit phone number, blood group dropdown, and password confirmation with inline validation.
- **Full-Featured User Dashboard** (`src/routes/dashboard.tsx`):
  - Replaced mock WhatsApp OTP interface with real-time authenticated donor dashboard.
  - Displays verified blood group, real-time medical eligibility status (`/eligibility/me`), completed donation counts, emergency donor availability toggle (`PUT /auth/me`), registered camps, and donation history log.
- **Navbar & Navigation Refactor** (`src/components/Navbar.tsx`, `src/routes/index.tsx`):
  - Integrated `useAuth()` into `Navbar`: displays "Sign In" and "Register" when unauthenticated, and "Profile", "Notifications" (with live unread badge), "Dashboard", and "Logout" when authenticated.
  - Updated landing page call-to-actions to route directly to `/register` and `/camps`.
- **Verification & Build**:
  - Successfully executed full Vite + Nitro production build (`npm run build`) with zero TypeScript or route compilation errors.
  - Full backend test suites re-verified: `test_security.js` (40 passed), `test_analytics.js` (35 passed), `test_donation_tracking.js` (77 passed).

## Security Hardening Phase

- **Security Headers & Defense-in-Depth** (`server/server.js`):
  - Added `helmet` to apply protection against MIME-type sniffing (`X-Content-Type-Options: nosniff`), clickjacking (`X-Frame-Options: SAMEORIGIN`), cross-domain resource leaks (`Cross-Origin-Resource-Policy: cross-origin`), and hidden `X-Powered-By: Express` header leakage.
  - Safe CSP configuration preserving frontend SPA and SSR routing.
- **Environment-Restricted CORS & Request Size Limits** (`server/server.js`, `server/.env.example`):
  - Replaced wildcard CORS with explicit allowed origin whitelist controlled via `FRONTEND_URL` environment variable.
  - Restricted request body sizes to `500kb` for JSON and URL-encoded bodies to prevent memory exhaustion and denial-of-service attacks.
- **Multi-Tier Rate Limiting** (`server/middleware/rateLimitMiddleware.js`, `server/server.js`):
  - Implemented `authLimiter`: 25 requests per 15 minutes window on `/auth/login` and `/auth/register` to prevent brute-force attacks and credential stuffing.
  - Implemented `matchingLimiter`: 60 requests per 10 minutes on `/matching/donors` and `/matching/requests`.
  - Implemented `generalLimiter`: 300 requests per 15 minutes across all API routes.
  - Environment-aware bypass for automated tests (`NODE_ENV === "test"` or `DISABLE_RATE_LIMIT=true`).
- **Input Validation & Injection Resistance** (`server/controllers/authcontroller.js`, `server/controllers/campController.js`):
  - Protected authentication endpoints from MongoDB operator injection by enforcing explicit `typeof === "string"` checks on login and registration bodies.
  - Added minimum 6-character password length validation across registration, profile update (`PUT /auth/me`), and user management (`PUT /users/:id`).
  - Escaped special regular expression characters in camp search queries (`city`, `state`) to prevent ReDoS or query manipulation.
- **Verification & Testing**:
  - Created dedicated automated test suite `scratch/test_security.js` covering 40 assertions across authentication, authorization, IDOR, input validation, injection resistance, role tampering, and sensitive data projection (100% pass rate).
  - Verified regression suites: `test_analytics.js` (35 passed), `test_donation_tracking.js` (77 passed), `test_notification_features.js` (50 passed), and `test_email_notifications.js` (46 passed).
  - Verified production frontend build (`npm run build`) passing with zero errors.

## Analytics System

- **Analytics Aggregation Service** (`server/services/analyticsService.js`):
  - Read-only pipeline deriving metrics directly from live MongoDB Atlas collections (`camps`, `campregistrations`, `donations`, `users`, `bloodrequests`).
  - Strict scope isolation:
    - `organizer`: strictly camps owned by that organizer (`organizer: req.user.id`), preventing IDOR or data leakage between organizers.
    - `admin`: global aggregates across all drives, plus admin-only user metrics (`totalRegisteredUsers`, `availableDonors`, `eligibleDonors`, `usersByBloodGroup`) and blood request metrics (`totalRequests`, `activeRequests`, `fulfilledRequests`, `requestsByBloodGroup`, `monthlyTrend`).
    - `user` / unauthenticated: blocked with HTTP 403 / 401 respectively.
  - Comprehensive metrics returned:
    - Summary (`totalCamps`, `draftCamps`, `publishedCamps`, `completedCamps`, `cancelledCamps`, `totalCapacity`, `totalRegistrations`, `activeRegistrations`, `cancelledRegistrations`, `capacityUtilization`, `totalDonations`, `completedDonations`, `scheduledDonations`, `cancelledDonations`, `noShowDonations`, `totalUnitsDonated`).
    - Capacity sub-object with utilization percentages.
    - Registrations breakdown (monthly trend and blood group distribution across 8 standard blood types).
    - Donations tracking (monthly completed donation trend, collected units, blood group breakdown).
    - Lifecycle camp status distribution (all 4 statuses).
    - Top camps leaderboard (ranked by completed donations, then active registrations).
  - Robust query filtering via `from` and `to` ISO date parameters with validation (rejects invalid date formats and inverted ranges with HTTP 400).
  - Absolute Zero-PII guarantee: donor names, emails, phone numbers, exact coordinates, and passwords are never included in analytics responses.
- **Controller & API Integration** (`server/controllers/campController.js`, `server/routes/campRoutes.js`):
  - Connected `GET /camps/analytics` to `analyticsService.getAnalytics`.
  - Preserved backward compatibility with existing frontend payload formats (`registrationTrend`, `bloodGroupDistribution`, `campStatusDistribution`).
- **Frontend Dashboard Enhancements** (`src/routes/organizer/analytics.tsx`):
  - Added Completed Donations and Units Donated summary metric card with collection status counts.
  - Added Monthly Completed Donations & Units Collected bar chart using Recharts.
  - Added Units Donated by Blood Group breakdown chart.
  - Added System-Wide Administrator Metrics section when viewed by admin accounts.
- **Verification & Testing**:
  - Created automated test suite `scratch/test_analytics.js` covering 35 test assertions (100% pass rate).
  - Passed all existing regression suites (`test_donation_tracking.js`, `test_notification_features.js`, `test_email_notifications.js`).
  - Successfully verified production frontend build (`npm run build`).

---

# [2026-10-08]

## Email Notifications (Brevo HTTP API Integration)

- **Environment & Configuration** (`server/.env.example`, `server/services/emailService.js`):
  - Integrated Brevo Transactional Email HTTP API (`https://api.brevo.com/v3/smtp/email`) using native `fetch`.
  - Added configuration support for `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, and `EMAIL_NOTIFICATIONS_ENABLED`.
  - Secrets protection: API key is never exposed in logs, responses, tests, git, or client bundles.
- **User Preferences** (`server/models/user.js`, `server/controllers/authcontroller.js`):
  - Added `emailNotifications: { type: Boolean, default: true }` to User model schema.
  - Allowed updating email preference in `updateProfile` (`PUT /auth/me`).
  - Honor user opt-out: if `emailNotifications === false`, in-app notifications still succeed while email dispatch is safely skipped.
- **Branded Responsive HTML & Text Templates** (`server/templates/emailTemplates.js`):
  - Created responsive templates with red/dark theme (`#e63946`, `#1d3557`), typography, details table, call-to-action button, and plain-text fallback.
  - Covers all 8 core events:
    1. Camp Registration Confirmed
    2. Camp Registration Cancelled
    3. Camp Schedule / Location Updated
    4. Camp Cancelled by Organizer
    5. Camp Reminder (24-hour upcoming drive)
    6. Blood Match / Urgent Requirement Alert
    7. Donation Eligibility Reminder (90-day interval completed)
    8. Donation Verified / Recorded
- **Decoupled Notification Delivery Service** (`server/services/notificationDeliveryService.js`):
  - Bridges in-app notifications and email delivery.
  - Matches notification `type`, `title`, and `metadata` to corresponding email templates.
  - Handles fire-and-forget asynchronous execution: email errors, network timeouts, or Brevo API downtime never break core business transactions (e.g. registration, donation recording).
- **In-App Integration Hook** (`server/services/notificationService.js`):
  - Attached non-blocking email delivery handler to `createNotification`.
  - Enforced idempotency: if an `eventKey` already exists, email delivery is skipped to avoid duplicate notifications.
- **Verification & Regression Testing**:
  - Created dedicated automated test suite `scratch/test_email_notifications.js` with `setMockEmailSender` interceptor preventing real email dispatches during testing.
  - Verified 16 test scenarios (46 assertions, 100% pass rate).
  - Passed all regression test suites (`test_donation_tracking.js`, `test_notification_features.js`).
  - Production build (`npm run build`) passed with zero errors.

## Donation Tracking System

- **Donation Model & Persistence** (`server/models/donation.js`):
  - Created `Donation` schema associating `donor` (ref `user`), `camp` (ref `camp`), `registration` (ref `campRegistration`), `donationDate`, `units`, `bloodGroup` (snapshot), `status` (`scheduled`, `completed`, `cancelled`, `no_show`), `notes`, `recordedBy` (ref `user`), and `verifiedAt`.
  - Enforced unique compound index on `{ registration: 1 }` ensuring one donation record per camp registration.
  - Indexed by `{ donor: 1, donationDate: -1 }`, `{ camp: 1, status: 1 }`, and `{ camp: 1, donationDate: -1 }`.
- **Donation Service & Lifecycle** (`server/services/donationService.js`):
  - Secure parameter derivation: Automatically extracts `donor`, `camp`, and historical `bloodGroup` snapshot from registration and donor profile to prevent client-side spoofing.
  - State machine: Strictly allows `scheduled -> completed`, `scheduled -> cancelled`, `scheduled -> no_show`. Terminal states are protected against arbitrary reversions.
  - Idempotency: Repeated completion requests return the current state safely without duplicate dates or notifications.
  - `lastDonationDate` synchronization: Calculates latest valid completed donation date so older historical records never overwrite newer donation timestamps.
  - In-app notification on completion: Automatically creates `"system"` notification (`"Donation Recorded"`) with unique deduplication key `donation-completed:${donationId}`.
- **REST Endpoints & Access Control** (`server/controllers/donationController.js`, `server/routes/donationRoutes.js`):
  - `POST /donations`: Organizer owner / Admin only to record donations for active registrations.
  - `PATCH /donations/:id/status`: Organizer owner / Admin only to advance donation status.
  - `GET /donations/me`: Authenticated donors to view their paginated donation history with safe populated camp details.
  - `GET /camps/:campId/donations`: Organizer owner / Admin only to view camp donations with status filters and summary metrics.
  - `GET /donations/:id`: Donor, camp organizer, or admin with strict IDOR protections.
- **Analytics & Organizer Dashboard Integration** (`server/controllers/campController.js`, `src/routes/organizer/camps/$campId.tsx`):
  - Extended camp analytics (`GET /camps/analytics`) with `data.donations` metrics (total donations, completed donations, units, blood group distribution, monthly trends).
  - Extended Organizer camp details view with summary cards for scheduled, completed, no-show, and cancelled donations.
  - Added interactive donation actions directly in the registered donors table: "Record Donation", "Complete", "No-Show", "Cancel".
- **Donor Frontend Interface** (`src/routes/donations.tsx`, `src/components/Navbar.tsx`):
  - Built dedicated `/donations` route showing donor's personal donation history, units contributed, verification timestamps, and status badges.
  - Added "Donations" link in main Navbar.
- **Verification**:
  - Dedicated test suite `scratch/test_donation_tracking.js` passed 77/77 assertions (100%).
  - Full regression test suite passed across all suites.
  - Frontend production build (`npm run build`) completed with 0 errors.

## Notification Features (Camp Registration, Camp Reminders, Blood Requirements, Donation Reminders)

- Camp Registration Notifications (`server/controllers/campRegistrationController.js`, `server/controllers/campController.js`):
  - Automatically triggers in-app `camp_registration` notification upon successful registration with camp name, date, venue, and metadata (`campId`, `registrationId`).
  - Automatically triggers `camp_registration` notification upon registration cancellation.
  - Automatically triggers `camp_cancellation` or `camp_update` notifications to all registered donors when an organizer cancels a camp or updates schedule/location details.
  - Registration failures (capacity full, ineligible, duplicate) create zero notifications.
- Camp Reminder Notifications (`server/services/notificationScheduler.js`):
  - Time-based reminder identifying published camps starting within 24 hours.
  - Generates `camp_update` reminder notifications with camp name, schedule, and venue for actively registered donors (`status: "registered"`). Cancelled registrations are excluded.
  - Guaranteed idempotency: Enforces deterministic event keys (`camp-reminder:${campId}:${registrationId}:24h`) to prevent duplicate reminders across scheduler cycles.
- Blood Requirement Notifications (`server/models/bloodRequest.js`, `server/services/bloodRequestService.js`, `server/controllers/bloodMatchingController.js`):
  - Minimal `BloodRequest` model persisting requirements with `bloodGroup`, `unitsNeeded`, `urgency`, `location`, `radius`, `createdBy`, and `status`.
  - Reuses authoritative `bloodMatchingService.findMatchingDonors` to find compatible, medically eligible, and available donors within the geographic radius.
  - Ineligible, unavailable, and incompatible donors are strictly excluded.
  - Generates `blood_match` notifications with urgency level and required units without exposing donor phone, email, or exact coordinates.
  - Exposed via protected REST endpoints `POST /matching/requests` and `GET /matching/requests`.
- Donation Reminders (`server/services/notificationScheduler.js`):
  - Reuses authoritative `evaluateEligibility` to check donors with `lastDonationDate`.
  - Sends `system` notification ("You're Eligible to Donate Again") when 90-day minimum donation interval has elapsed.
  - Sends optional early reminder when donor is within 7 days of eligibility.
  - Does not modify user record (`isEligible` and `lastDonationDate` remain untouched).
  - Deduplicated by donation cycle key (`donation-eligibility:${userId}:${lastDonationDate}`).
- Periodic Scheduler Architecture (`server/services/notificationScheduler.js`, `server/server.js`):
  - In-process, non-blocking scheduler running periodic checks (`runAllJobs()`) every 60 seconds without halting server startup.
  - Controlled via `ENABLE_NOTIFICATION_SCHEDULER` environment variable (gracefully disabled in test runners).
  - Error-resilient execution wrapping job loops to prevent unhandled rejections or crashes.
- Duplicate Prevention Strategy (`server/models/notification.js`, `server/services/notificationService.js`):
  - Added `eventKey` with MongoDB partial unique compound index `{ user: 1, eventKey: 1 }` filtered by `{ eventKey: { $type: "string" } }`.
  - Pre-insert idempotency verification in `notificationService.createNotification` returning existing notifications safely.
- Frontend Enhancements (`src/routes/notifications.tsx`):
  - Added contextual links on notification cards: "View Camp Details →" for camps, "Find Donors & Matching →" with required blood group pills for blood matches, and "Check Eligibility Details →" for donation reminders.
- Verification & Test Results:
  - `scratch/test_notification_features.js`: 50/50 test assertions passed (100% pass rate).
  - Full regression test suite: 322/322 assertions passed across all 10 suites.
  - Production build (`npm run build`): Successfully compiled client, SSR, and Nitro server bundles with 0 errors.

## In-App Notification System

- Notification Model (`server/models/notification.js`):
  - Created Mongoose schema storing internal user notifications with fields: `user` (ref: "user", required), `type` (enum: `['blood_match', 'camp_registration', 'camp_update', 'camp_cancellation', 'system']`), `title` (required string), `message` (required string), `isRead` (boolean, default: false), `metadata` (flexible key-value store, e.g. `campId`, `registrationId`), and Mongoose timestamps (`createdAt`, `updatedAt`).
  - Added compound indexes `{ user: 1, createdAt: -1 }` and `{ user: 1, isRead: 1, createdAt: -1 }` for high-performance notification retrieval and unread filtering.
- Centralized Notification Service (`server/services/notificationService.js`):
  - Pure service interface implementing: `createNotification`, `getUserNotifications`, `getUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`, and `deleteNotification`.
  - Strict ownership isolation: All update and delete queries enforce `{ _id: notificationId, user: userId }`, returning `null` (and `404 Not Found`) if an unowned notification is targeted.
  - Pagination enforcement: Newest-first sorting (`createdAt: -1`), default 20 items per page, capped at 100 max per query.
- Protected Notification Endpoints (`server/controllers/notificationController.js`, `server/routes/notificationRoutes.js`):
  - `GET /notifications`: Paginated retrieval with user ownership scoping.
  - `GET /notifications/unread-count`: Lightweight unread counter query for badge updates.
  - `PATCH /notifications/:id/read`: Marks individual notification as read.
  - `PATCH /notifications/read-all`: Marks all unread notifications as read for current user; mounted before `/:id/read` to prevent route collision.
  - `DELETE /notifications/:id`: Safely deletes an owned notification.
  - Mounted at `/notifications` in `server/server.js` with `authMiddleware`.
- Frontend Notification Integration (`src/routes/notifications.tsx`, `src/components/Navbar.tsx`):
  - Created dedicated `/notifications` route featuring authenticated inbox view, unread badge indicators, category filter tabs (All, Unread, Blood Matches, Camps, System), relative timestamps, contextual links to camp details, individual mark-as-read, mark-all-read button, and pagination controls.
  - Added notification bell icon with dynamic unread counter badge to the main navigation bar in `src/components/Navbar.tsx`, updating on session changes and route navigation.
- Verification & Test Results:
  - `scratch/test_notifications.js`: 45/45 test assertions passed (100% pass rate) covering model validation, authorization, multi-user isolation, pagination bounds, unread counters, state transitions, deletion, and PII protection.
  - Full regression test suite: 272/272 assertions passed across all 9 suites.
  - Production build (`npm run build`): Successfully compiled client, SSR, and Nitro server bundles with 0 errors.

## Blood Matching Engine

- Backend Compatibility Rules (`server/rules/bloodCompatibilityRules.js`):
  - Pure, isolated business logic module for red blood cell (RBC) compatibility across all 8 supported blood groups (`O-`, `O+`, `A-`, `A+`, `B-`, `B+`, `AB-`, `AB+`).
  - Implements recipient perspective: `O-` receives only `O-`; `O+` receives `O+`, `O-`; `A-` receives `A-`, `O-`; `A+` receives `A+`, `A-`, `O+`, `O-`; `B-` receives `B-`, `O-`; `B+` receives `B+`, `B-`, `O+`, `O-`; `AB-` receives `AB-`, `A-`, `B-`, `O-`; `AB+` receives all 8 groups (universal recipient).
  - Pure functions: `isValidBloodGroup`, `getCompatibleDonorBloodGroups`, and `isBloodCompatible`.
- Blood Matching Service (`server/services/bloodMatchingService.js`):
  - Reusable, read-only donor candidate matching and ranking service.
  - Reuses authoritative `eligibilityService.js` (`evaluateEligibility`) to enforce medical eligibility (age >= 18, donation interval >= 90 days, administrative block check) and availability without duplicating logic.
  - Supports optional location parameters (`latitude`, `longitude`, `radius` up to 500 km).
  - Geospatial matching: Leverages MongoDB `$geoNear` aggregation over the existing sparse `2dsphere` index on `user.location.coordinates`. Automatically sorts nearest-first and excludes users without coordinates from radius queries.
  - Non-geospatial matching: Performs blood-compatibility + eligibility + availability queries across all donors when location is omitted, without fabricating distance.
  - Explainable Matching Score: Deterministic 0-100 scoring based on base eligibility (50/70 pts), exact vs compatible blood group bonus (20/10 or 30/15 pts), and inverse distance proximity (up to 30 pts). Returns explanatory `matchReason` array.
  - Privacy Guarantees: Strictly excludes donor email, phone, password, auth tokens, precise coordinates, date of birth, complete street address, and internal roles.
- Blood Matching API (`server/controllers/bloodMatchingController.js`, `server/routes/bloodMatchingRoutes.js`):
  - Added protected endpoint `POST /matching/donors` with JWT `authMiddleware`.
  - Validates recipient `bloodGroup`, numeric coordinate bounds (-90 to 90, -180 to 180), positive radius (<= 500 km), and result limit (capped at 100, default 20).
  - Mounted `/matching` in `server/server.js`.
- Frontend Matching Interface (`src/routes/matching.tsx`, `src/components/Navbar.tsx`):
  - Created `/matching` route featuring recipient blood group selector, optional location proximity search with browser geolocation integration, and ranked donor candidate cards.
  - Displays match scores, compatibility badges, distances, and match reasons with zero contact buttons or PII leakage.
  - Added "Find Donors" navigation link to Navbar.
- Verification & Test Results:
  - `scratch/test_blood_matching.js`: 45/45 test assertions passed (all 8 recipient groups, eligibility, availability, radius bounds, nearest-first ranking, privacy checks).
  - All regression suites passed (227 total assertions across 8 test suites).
  - `npm run build`: Succeeded with 0 errors across client, SSR, and Nitro server bundles.

## Organizer Analytics

- Backend Analytics API (`server/controllers/campController.js`, `server/routes/campRoutes.js`):
  - Added dedicated read-only `GET /camps/analytics` endpoint with `authMiddleware` mounted before `/:id` route.
  - Role-scoped authorization: Organizers view insights strictly for camps they own (`organizer = req.user.id`); Admins view global platform-wide statistics. Unauthenticated requests return `401 Unauthorized`; regular donors (`role: "user"`) return `403 Forbidden`.
  - Aggregations and metrics calculated via MongoDB queries:
    - Summary counts: `totalCamps`, `draftCamps`, `publishedCamps`, `completedCamps`, `cancelledCamps`.
    - Capacity and registration counts: `totalCapacity`, `totalRegistrations`, `activeRegistrations` (`status: "registered"`), `cancelledRegistrations` (`status: "cancelled"`).
    - Capacity utilization percentage: `(activeRegistrations / totalCapacity) * 100` safely guarded against zero capacity (returns 0 instead of NaN/Infinity).
    - Monthly registration trend: Aggregates registration count grouped by month (`period: "YYYY-MM"`).
    - Top performing camps: Top 5 camps sorted descending by active registrations, including name, capacity, registrations, and utilization %.
    - Blood group distribution: `$lookup` and `$group` aggregation mapping donor blood groups (`bloodGroup`, `count`) sorted descending.
    - Camp status distribution: Array of objects with status name and count.
  - Date filtering: Supports optional `?from=YYYY-MM-DD` and `?to=YYYY-MM-DD` query parameters filtering on `camp.startDate`. Strictly validates date formats and rejects `from > to` with `400 Bad Request`.
  - Donor Privacy & PII Protection: Strictly zero donor personal information (`name`, `email`, `phone`, `password`, `dateOfBirth`) is returned in analytics responses.
  - Automated test suite (`scratch/test_camp_analytics.js`): All 56 test assertions passed (authentication, role scoping, calculations, zero-division safety, date filters, PII protection).
- Frontend Analytics Dashboard (`src/routes/organizer/analytics.tsx`):
  - Created `/organizer/analytics` route with TanStack Router.
  - Integrated with `recharts` for rich visual charting:
    - `LineChart`: Monthly registration volume trend over time.
    - `BarChart`: Blood group distribution with custom crimson styling.
    - Lifecycle breakdown bars: Visual percentages for draft, published, completed, and cancelled camps.
    - Top performing camps table: Shows rankings, capacity slots, donor numbers, and utilization color indicators.
  - Summary metric cards: Total Camps, Total Capacity Slots, Active Registrations, and Capacity Utilization % with progress bar.
  - Date range filter form with live Apply and Reset controls and validation against invalid date ranges.
  - Top action bar: "Back to Dashboard" navigation link and scope indicator badge ("Organizer Workspace" vs "Admin Global Scope").
  - Role protection: Prompts unauthenticated visitors to sign in and displays access denied notice to regular donors.
- Dashboard & Navigation Updates:
  - Added "Analytics" action button to the Organizer Dashboard toolbar (`src/routes/organizer/index.tsx`).
- Build & Regression Verification:
  - `npm run build`: Succeeded with 0 errors across client, SSR, and Nitro server bundles.
  - All regression test suites passed (182 total assertions across `test_camp_analytics.js`, `test_camp_full.js`, `test_camp_registration_full.js`, `test_camp_nearby.js`, `test_eligibility.js`, `test_profile_full.js`, `test_auth_full.js`).

## Organizer Dashboard

- Frontend Routes:
  - `/organizer`: Primary Organizer Dashboard with role verification, live summary cards (Total, Draft, Published, Completed, Cancelled, Registered Donors), status filter tabs, camp action items, and interactive "Create New Camp" modal.
  - `/organizer/camps/$campId`: Detail and management view for a specific camp showing capacity metrics, lifecycle actions (Publish draft, Edit, Cancel, Mark completed), and complete registered donor directory (`GET /camps/:campId/registrations`).
- Role & Permission Enforcement:
  - Protected against unauthenticated requests (shows sign-in prompt) and normal donors (shows clear Access Denied notice with donor camp links).
  - Organizer role: Views and manages camps owned by their account (`organizer === req.user.id`).
  - Admin role: Can access dashboard and manage any camp per existing backend authorization rules.
  - Role-aware Navbar: Dynamically renders an "Organizer" navigation link for verified organizers and administrators.
- Camp Creation & Management:
  - Form validation matching the Camp model (`name`, `description`, `address`, `city`, `state`, `pincode`, optional coordinates, `startDate`, `endDate`, `startTime`, `endTime`, `capacity`).
  - New camps created as `draft` per backend specification (`POST /camps`).
  - Supports editing draft and published camps (`PUT /camps/:id`) while strictly preventing modifications to system-protected fields (`organizer`, `registrationCount`).
  - Enforces backend status transitions (`draft -> published/cancelled`, `published -> completed/cancelled`).
- Registered Donor Management:
  - Live donor listing with status filters (`registered`, `cancelled`, `all`) and pagination (`page`, `limit`).
  - Displays donor name, blood group, gender, phone, location, status, and registration timestamp.
  - Strictly preserves backend privacy projection (no passwords, tokens, or private internal account metadata exposed).
- Backend Updates:
  - Enhanced `GET /camps` query filter: Added support for `status=all`, allowing organizers to query all their own camps across all statuses simultaneously, and admins to retrieve all camps (`server/controllers/campController.js`).
- Build & Verification:
  - `npm run build`: Succeeded with 0 errors.
  - All 6 backend test suites passed (126 total assertions across auth, profile, eligibility, camp management, camp registration, and nearby discovery).

## Location-Based Camp Discovery

- Backend Geospatial API (`server/controllers/campController.js`, `server/routes/campRoutes.js`):
  - Added `GET /camps/nearby` endpoint utilizing MongoDB `$geoNear` aggregation pipeline over the existing sparse `location.coordinates` `2dsphere` index.
  - Query parameters: `longitude` (validated between -180 and 180), `latitude` (validated between -90 and 90), and optional `radius` in meters (default 25,000 m = 25 km, max 500,000 m = 500 km).
  - Returns published camps strictly ordered nearest-first with accurate `distanceMeters` calculation provided natively by MongoDB.
  - Safe projections: populates safe organizer details (`_id`, `name`) while omitting private contact details (`email`, `phone`).
  - Safe omission: camps lacking coordinates or in draft/cancelled status are safely excluded without breaking geospatial queries.
  - Automated test suite (`scratch/test_camp_nearby.js`): All 14 test assertions passed (distance calculation, nearest-first ordering, radius filtering, invalid coordinate bounds, boundary conditions, privacy projection).
- Frontend Nearby Camps UI (`src/routes/camps/index.tsx`):
  - Added tab switcher between "All Camps" (text/date filters) and "Nearby Camps" (geospatial radius search).
  - Integrates authenticated user profile location coordinates (`/auth/me`).
  - Radius selection options: 5 km, 10 km, 25 km, and 50 km.
  - Displays formatted distance badges (e.g. `2.3 km away`, `450 m away`) on each camp card.
  - Informative empty and error states: prompts unauthenticated users to sign in, prompts users with missing coordinates to configure their profile location with a direct link to `/profile`, and offers an "Expand to 50 km" button when no nearby camps exist in the initial radius.
- Build & Regression Verification:
  - `npm run build`: Succeeded with 0 errors across all client, SSR, and Nitro server bundles.
  - Backend regression test suites (`test_camp_full.js`, `test_camp_registration_full.js`, `test_eligibility.js`, `test_profile_full.js`, `test_auth_full.js`): 100% passed.

## Frontend Camp Discovery & Registration

- Created Camps Discovery Page (`src/routes/camps/index.tsx`):
  - Route: `/camps`
  - Fetches and displays published blood donation camps (`GET /camps`).
  - Supports server-side query filters for `city`, `state`, and date range (`from`, `to`) with clean reset capabilities.
  - Informative card design displaying camp name, location, dates, timings, capacity, registered donor count, and remaining slots.
  - Distinguishes statuses (e.g. "Open for Registration", "Camp Full", "Ended").
  - Handles loading states, empty results ("No upcoming camps found"), and server error states with retry actions.
- Created Camp Details & Registration Page (`src/routes/camps/$campId.tsx`):
  - Route: `/camps/$campId`
  - Fetches camp information (`GET /camps/:id`) and displays complete location, timings, capacity metrics, and organizer name safely (excluding organizer private contact info).
  - Live registration status checking (`GET /camps/:campId/registrations/me`) for authenticated users; gracefully handles 404 as "not registered".
  - Advisory eligibility inspection (`GET /eligibility/me`) warning ineligible or unavailable donors before registration while deferring authority to backend.
  - Seamless inline sign-in modal for unauthenticated visitors attempting to register.
  - One-click registration (`POST /camps/:campId/register`) with loading spinner and button debouncing; dynamically updates local slot count and switches UI to registered state.
  - Registration cancellation (`DELETE /camps/:campId/register`) with confirmation dialog; decrements registered count, frees slot, and allows subsequent re-registration.
  - Handles backend validation errors (capacity full, camp started, duplicate registration, role restrictions, eligibility blocks).
- Navigation Updates:
  - Added "Camps" to global navigation in `src/components/Navbar.tsx`.
  - Added "Blood Donation Camps" link in `src/components/Footer.tsx`.
- Verified build and TypeScript validity: `npm run build` succeeds with zero errors.

## Camp Registration

- Created CampRegistration model (`server/models/campRegistration.js`):
  - Fields: `user` (ref `user`), `camp` (ref `camp`), `status` (`"registered"` or `"cancelled"`), `registeredAt`, and `cancelledAt`.
  - Compound unique index on `{ user: 1, camp: 1 }` preventing duplicate active/historical records for the same donor and camp.
  - Secondary indexes on `{ camp: 1, status: 1 }` and `{ user: 1, status: 1 }`.
- Created Camp Registration Controller & Routes (`server/controllers/campRegistrationController.js`, `server/routes/campRegistrationRoutes.js`):
  - `POST /camps/:campId/register`:
    - Role-restricted to normal donors (`user` role only).
    - Requires published camp status and verifies that the camp has not already started.
    - Integrated with authoritative `eligibilityService.evaluateEligibility()` requiring `isMedicallyEligible === true` and `isDonorAvailable === true`.
    - Enforces capacity via atomic conditional update (`$expr: { $lt: ["$registrationCount", "$capacity"] }`) to guarantee `registrationCount <= capacity` under concurrent requests.
    - Re-activation supported: previously cancelled registrations are reactivated rather than creating duplicate documents.
    - Atomically increments `camp.registrationCount` by 1.
  - `GET /camps/:campId/registrations/me`: Returns the authenticated user's registration status for the specified camp without exposing other donors or sensitive camp organizer info.
  - `DELETE /camps/:campId/register`: Cancels user's registration (`status -> "cancelled"`, sets `cancelledAt`) and atomically decrements `camp.registrationCount` without letting it drop below 0. Double-cancellation is cleanly prevented.
  - `GET /camps/:campId/registrations`:
    - Role-protected: only camp organizer owners (`camp.organizer === req.user.id`) and admins can view registered donors for a camp.
    - Default response returns active registrations (`status: "registered"`).
    - Status filtering supported via query parameter: `?status=registered`, `?status=cancelled`, and `?status=all`.
    - Pagination metadata included: `page`, `limit` (capped at 100), `total`, `totalPages`, `count`.
    - Sorted chronologically by registration timestamp (`registeredAt: 1`).
    - Safe donor projection: only public donor info exposed (`_id`, `name`, `bloodGroup`, `gender`, `phone`, `location.city`, `location.state`, `location.pincode`), never exposing passwords, JWT tokens, or internal account metadata.
    - Read-only: does not alter camp data or registration counts.
- Mounted `/camps` registration endpoints in `server/server.js`.
- Automated test suite (`scratch/test_camp_registration_full.js`) covering functional cases, edge cases, organizer/admin view authorization, pagination, filtering, privacy projections, and concurrency with capacity 1 (44 automated test assertions).

## Blood Donation Camp Management

- Created Camp data model (`server/models/camp.js`):
  - Fields: `name`, `description`, `organizer` (ref `user`), `location` (address, city, state, pincode, GeoJSON Point coordinates with sparse `2dsphere` index), `startDate`, `endDate`, `startTime`, `endTime`, `capacity`, `registrationCount`, and `status`.
  - Default status is `draft`.
  - Registration count is strictly system-controlled (defaults to 0, protected from manual PUT edits).
  - Schema validation for 6-digit Indian pincode, coordinates, capacity $\ge 1$, date ordering (`endDate >= startDate`), and HH:mm time formatting.
  - Compound indexes for status/city/startDate and organizer/status queries.
- Created Camp Controller & Routes (`server/controllers/campController.js`, `server/routes/campRoutes.js`):
  - `POST /camps`: Requires `organizer` or `admin` role. Sets `organizer = req.user.id` (client-supplied organizer IDs are rejected/ignored).
  - `GET /camps`: Public discovery endpoint. Returns `published` camps by default with filters for `city`, `state`, and date range (`from`/`to`). Draft camps are strictly omitted from public views.
  - `GET /camps/:id`: Public for `published` camps. Draft camps are accessible only to the owning organizer or admins (returns 404 to unauthorized users).
  - `PUT /camps/:id`: Organizers can edit only their own camps; admins can edit any camp. Enforces allowed status transitions (`draft -> published/cancelled`, `published -> completed/cancelled`). Prevents changes to `organizer`, `registrationCount`, or completed/cancelled camps.
  - `DELETE /camps/:id`: Organizers can delete their own camps and admins can delete any camp provided `registrationCount === 0`. Blocks deletion if registrations exist (instructs users to cancel instead).
  - Privacy: Organizers' email and phone numbers are completely omitted from public camp responses, exposing only safe fields (`_id`, `name`).
- Created `server/middleware/optionalAuthMiddleware.js`:
  - Gracefully extracts `req.user` if a valid Bearer token is present, allowing public endpoints to transparently support organizer/admin privileges without blocking unauthenticated visitors.
- Mounted `/camps` in `server/server.js`.
- Automated test suite (`scratch/test_camp_full.js`) covering all 31 core scenarios and edge cases.

## Blood Donation Eligibility Engine

- Created modular, isolated eligibility rules (`server/rules/eligibilityRules.js`):
  - Configurable donation interval business rule (`MIN_DONATION_INTERVAL_DAYS = 90`).
  - Dynamic age rule: calculates donor's exact age from `dateOfBirth` ensuring age >= 18 without duplicating User model constraints or hard-coding maximum limits.
  - Donation interval rule: calculates `nextEligibleDate = lastDonationDate + 90 days`. If `now < nextEligibleDate`, donor is marked medically ineligible with reason and next eligible date.
  - System/Admin block rule: checks `isEligible`; if `false`, donor is marked medically ineligible regardless of donation date.
  - Cleanly separates medical eligibility (`isMedicallyEligible`) from donor preferences/availability (`isDonorAvailable`).
  - Decoupled from blood groups (reserved for Blood Matching Engine).
- Created Service layer (`server/services/eligibilityService.js`):
  - Core evaluation engine reusable directly by future modules (Camp Registration, Blood Matching, Donation Tracking) without HTTP requests.
  - Aggregates rule failures into human-readable `reasons` array and formats structured response.
- Created Controller & Routes (`server/controllers/eligibilityController.js`, `server/routes/eligibilityRoutes.js`):
  - Implemented `GET /eligibility/me` protected by `authMiddleware`.
  - Excludes passwords and sensitive authentication data.
  - Handles missing/expired tokens (401) and deleted users (404).
- Mounted `/eligibility` routes in `server/server.js`.
- Automated testing suite (`scratch/test_eligibility.js`) covering all 10 core eligibility test cases and edge cases.
- Implemented Frontend Eligibility Interface (`src/routes/eligibility.tsx`):
  - Created `/eligibility` route integrated with the REDhope design system and navigation (`Navbar solid`, `hero-compact`, `.form-section`).
  - Calls `GET /eligibility/me` using existing JWT authentication stored in `localStorage`.
  - Distinctly handles all UI states:
    - Initial loading state with spinner.
    - Fully eligible state (`isMedicallyEligible: true && isDonorAvailable: true`) with positive confirmation banner.
    - Medically eligible but unavailable state (`isMedicallyEligible: true && isDonorAvailable: false`) with link to profile settings.
    - Not medically eligible state (`isMedicallyEligible: false`) rendering authoritative reasons list and formatted `nextEligibleDate`.
    - Error and unauthenticated states with inline sign-in card and retry mechanisms.
  - Formats `checkedAt` timestamp and `nextEligibleDate` cleanly in Indian locale format (`en-IN`).
  - Added "Eligibility" link in `Navbar.tsx` and "Check Eligibility" shortcut on the Profile page (`profile.tsx`).

## User Profiles

- Extended User model with donor profile fields:
  - `dateOfBirth`: validated $\ge 18$ years old without arbitrary upper-bound.
  - `gender`: enum `["male", "female", "other", "prefer_not_to_say"]`.
  - `location`: optional GeoJSON `Point` coordinates `[longitude, latitude]` with range validation, `city`, `state`, `pincode` (6-digit Indian PIN regex).
  - `isDonorAvailable`: boolean (default `true`).
  - `lastDonationDate`: date (system/admin controlled).
  - `isEligible`: boolean (default `true`, system/admin controlled).
  - Added sparse `2dsphere` index for location and compound index for blood matching queries.
- Added authenticated current-user profile endpoints:
  - `GET /auth/me`: retrieves authenticated user's profile using JWT without requiring ID in URL.
  - `PUT /auth/me`: updates allowed profile fields, prevents tampering with `role`, `isEligible`, or `lastDonationDate`, and hashes password if updated.
- Enforced system/admin control over `isEligible` and `lastDonationDate` across both `/auth/me` and `/users/:id`.
- Implemented Frontend Profile Page (`src/routes/profile.tsx`):
  - Integrates seamlessly with existing REDhope design system, styling classes, and layout (`Navbar solid`, `hero-compact`, `form-section`, and responsive grid).
  - Reads JWT token from `localStorage` and loads user profile via `GET /auth/me`.
  - Provides inline authentication form if unauthenticated, allowing login via `POST /auth/login`.
  - Displays user profile data, badges for `role`, `isEligible`, and read-only status for `lastDonationDate`.
  - Enables in-place profile editing for allowed fields (`name`, `phone`, `bloodGroup`, `dateOfBirth`, `gender`, `location`, `isDonorAvailable`, and optional `password`) calling `PUT /auth/me` with live local state updates and toast notifications.
  - Added "Profile" navigation link in `Navbar.tsx`.

## Authentication & Authorization

- Installed `bcrypt` and `jsonwebtoken` dependencies.
- Added `JWT_SECRET` and `JWT_EXPIRES_IN` configuration to environment.
- Added `role` field to User schema (`user`, `organizer`, `admin`, default `user`).
- Implemented secure password hashing (10 salt rounds) for user registration and password updates.
- Added user login endpoint `POST /auth/login` using `bcrypt.compare()` and JWT generation.
- Added `authMiddleware.js` for Bearer token extraction and JWT verification.
- Implemented role-based authorization:
  - `GET /users` restricted to admin only.
  - `GET /users/:id`, `PUT /users/:id`, `DELETE /users/:id` restricted to account owner (self) or admin.
  - Role escalation prevention: normal users cannot change their role.
- Created `authRoutes.js` mounted at `/auth`.
- Removed legacy plaintext development users.

# [2026-10-06]

## Project Setup

- Configured REDhope development environment in VS Code.
- Connected the project to GitHub.
- Configured Codex for AI-assisted development.
- Added `AGENTS.md` containing project development rules.
- Added `PROJECT_CONTEXT.md` containing project architecture, current status, and roadmap.
- Added `CHANGELOG.md` for tracking project progress.

## Backend Foundation

- Created Node.js backend.
- Configured Express server.
- Added Express middleware.
- Configured environment variables.
- Connected backend to MongoDB Atlas.
- Configured Mongoose.

## User Management

- Created User Mongoose schema/model.
- Added user registration functionality.
- Added required-field validation.
- Added email validation.
- Added Indian 10-digit phone validation.
- Added duplicate email detection.
- Added duplicate phone detection.
- Added unique MongoDB indexes for email and phone.
- Implemented `GET /users`.

## API

Current implemented endpoints:

```text
POST   /auth/register
POST   /auth/login
GET    /auth/me (protected profile lookup)
PUT    /auth/me (protected profile update)
POST   /test (legacy registration alias)
POST   /users (legacy registration alias)
GET    /users (protected, admin only)
GET    /users/:id (protected, self or admin)
PUT    /users/:id (protected, self or admin)
DELETE /users/:id (protected, self or admin)
```
## Backend Foundation 

- Fixed duplicate PORT declaration.
- Fixed controller import filename casing.
- Standardized `bloodGroup` naming.
- Added duplicate phone detection.
- Added email format validation.
- Prevented passwords from being returned in registration responses.
- Added MongoDB duplicate-key error handling.
- Verified backend syntax and server startup.
- Resolved MongoDB Atlas SRV query failure (`querySrv ECONNREFUSED`) by configuring DNS servers in `config/db.js`.
