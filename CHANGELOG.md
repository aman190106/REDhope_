# REDhope Changelog

All notable changes to the REDhope project are documented here.

The changelog tracks meaningful development progress, completed features,
important fixes, architecture changes, and security improvements.

---

# [Unreleased]

Changes currently being developed.

## In Progress

- Blood Donation Eligibility (Rule engine, eligibility data structure, eligibility API)

---

# [2026-10-08]

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
