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
