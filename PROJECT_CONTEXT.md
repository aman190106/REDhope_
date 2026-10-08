# REDhope - Project Context

## 1. Project Overview

REDhope is a blood donation and blood donation camp management platform.

The purpose of REDhope is to connect blood donors, blood donation camps, organizers, and people who need blood through a single platform.

The long-term goal is to build a production-ready application with:

- Donor registration
- User profiles
- Blood donation eligibility checking
- Blood donation camp discovery
- Camp registration
- Organizer management
- Blood donor matching
- Notifications
- Donation tracking
- Analytics

---

# 2. Current Development Status

The project is currently in the backend development stage.

The backend foundation has already been created and MongoDB Atlas is connected.

Completed:

- Express server
- Express middleware
- MongoDB Atlas connection
- Mongoose setup
- User schema/model
- User registration API
- Request validation
- Duplicate email detection
- Duplicate phone detection
- MongoDB unique indexes for email and phone
- GET all users endpoint

Current CRUD progress:

```text
POST /test        Create       ✅
GET  /users       Read all     ✅
GET  /users/:id   Read one     ✅
PUT  /users/:id   Update       ✅
DELETE /users/:id Delete       ✅
```

User CRUD is complete. The next backend phase is Authentication.

---

# 3. Current Backend Architecture

The current architecture is:

Routes
    ↓
Controllers
    ↓
Models
    ↓
MongoDB Atlas

### Routes

Routes define API endpoints and connect them to controllers.

### Controllers

Controllers contain request handling, validation, database operations, and response handling.

### Models

Mongoose models define the MongoDB document structure.

### Database

MongoDB Atlas stores application data.

Keep this architecture unless there is a strong reason to change it.

---

# 4. User Model

The project currently has a User Mongoose model.

The current model convention uses lowercase:

```js
const user = mongoose.model("user", userSchema);

module.exports = user;
```

Controllers currently import and use it as:

```js
const user = require("../models/User");
```

and database operations look like:

```js
await user.find();
await user.findOne();
await user.create();
```

Preserve this convention unless there is a technical reason to change it.

---

# 5. User Registration

User registration is already implemented.

The registration flow currently:

1. Receives user data
2. Validates required fields
3. Checks whether email already exists
4. Checks whether phone already exists
5. Creates the user
6. Stores the user in MongoDB
7. Returns an API response

Duplicate email and phone numbers are prevented.

The database also has unique indexes for:

```text
email
phone
```

---

# 6. User Validation

The User schema includes validation.

The phone number currently follows the Indian 10-digit format:

```js
match: /^[6-9]\d{9}$/
```

Do not weaken existing validation unless explicitly requested.

Validation should eventually be expanded as additional user fields and business rules are introduced.

---

# 7. Existing API

## Get all users

Endpoint:

```text
GET /users
```

Current controller behavior:

```js
const users = await user.find();
```

Response includes:

```json
{
    "success": true,
    "count": 2,
    "users": []
}
```

The `count` represents the number of users returned by MongoDB.

---

# 8. Next API: Get User By ID

The next endpoint to implement is:

```text
GET /users/:id
```

Expected behavior:

1. Read the ID from `req.params`
2. Validate the MongoDB ObjectId
3. Search using `user.findById(id)`
4. Return the user if found
5. Return 404 if the user does not exist
6. Handle invalid ObjectIds appropriately
7. Handle database errors

Expected route:

```js
router.get("/users/:id", getUserById);
```

---

# 9. CRUD Roadmap

Complete User CRUD before moving into more complex functionality.

Target API structure:

```text
POST   /users
GET    /users
GET    /users/:id
PUT    /users/:id
DELETE /users/:id
```

The existing registration endpoint may currently use `/test`.

Do not change existing routes unless specifically requested.

Once CRUD is stable, the API can be reorganized into cleaner production REST conventions.

---

# 10. Authentication

Authentication is fully implemented:

- Secure password hashing with bcrypt (salt rounds = 10) on registration and password updates
- User login (`POST /auth/login`) with `bcrypt.compare()`
- JWT authentication (`id`, `email`, `role`) with configurable expiry
- Authentication middleware (`authMiddleware.js`) reading `Bearer <token>`
- Role-based authorization (`user`, `organizer`, `admin`)
- Self-only profile access/update/delete for standard users; admin privileges for user management
- Admin-only access to `GET /users` (all users)
- Passwords never returned or exposed in API responses

Potential roles may include:

```text
Donor/User
Organizer
Admin
```

Do not implement role-specific functionality until the authentication architecture is established.

---

# 11. User Profile

User Profiles are fully implemented on the backend:

- Identity: `name`, `email`, `password`, `phone`, `role`
- Donor Attributes:
  - `bloodGroup` (validated enum: `["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]`)
  - `dateOfBirth` (custom validator requiring age >= 18)
  - `gender` (enum: `["male", "female", "other", "prefer_not_to_say"]`)
  - `isDonorAvailable` (boolean, default: true)
  - `lastDonationDate` (system/admin controlled)
  - `isEligible` (boolean, default: true, system/admin controlled)
- Location:
  - GeoJSON `Point` coordinates `[longitude, latitude]` with range validation
  - Sparse `2dsphere` index configured for geospatial matching
  - `city`, `state`, `pincode` (6-digit Indian pincode format)
- Endpoints:
  - `GET /auth/me`: retrieves the authenticated user's profile via JWT
  - `PUT /auth/me`: updates user-editable profile fields, hashes passwords if updated, and denies tampering with `role`, `isEligible`, or `lastDonationDate`
- Privacy: passwords and sensitive internal fields are never exposed
- Frontend:
  - Route `/profile` (`src/routes/profile.tsx`) connected to `GET /auth/me` and `PUT /auth/me`
  - Clean inline authentication fallback when unauthenticated
  - Badges for status and non-editable system attributes (`role`, `isEligible`, `lastDonationDate`)
  - Full reactive update support with notifications and design system consistency

---

# 12. Blood Donation Eligibility Engine

Blood Donation Eligibility is fully implemented on the backend:

- Architecture:
  `GET /eligibility/me` -> `eligibilityController` -> `eligibilityService` -> `eligibilityRules` -> Structured Result
- Modular Rules (`server/rules/eligibilityRules.js`):
  - Dynamic age calculation from `dateOfBirth` ($\ge 18$)
  - Donation interval calculation (`lastDonationDate + MIN_DONATION_INTERVAL_DAYS (90 days)`)
  - Administrative/System override check (`isEligible` boolean)
  - Clear separation of medical eligibility (`isMedicallyEligible`) and donor availability preference (`isDonorAvailable`)
  - Decoupled from blood groups (reserved for Blood Matching Engine)
- Reusable Service (`server/services/eligibilityService.js`):
  - Can be invoked directly by Camp Registration, Blood Matching Engine, and Donation Tracking without HTTP requests
- Controller & API (`server/controllers/eligibilityController.js`, `server/routes/eligibilityRoutes.js`):
  - `GET /eligibility/me`: Authenticated endpoint returning `{ success: true, data: { isMedicallyEligible, isDonorAvailable, nextEligibleDate, reasons, checkedAt } }`
  - Passwords and sensitive authentication tokens are omitted
  - Full automated test suite in `scratch/test_eligibility.js` passing 100%
- Frontend Interface (`src/routes/eligibility.tsx`):
  - Dedicated route `/eligibility` consuming `GET /eligibility/me` using existing JWT authentication
  - Renders all key UI states: Loading, Fully Eligible, Medically Eligible but Unavailable, Not Eligible (with authoritative reasons list and formatted `nextEligibleDate`), and Error/Sign-in states
  - Formats `checkedAt` and `nextEligibleDate` cleanly in Indian locale format
  - Accessible from the primary navigation bar (`Navbar.tsx`) and through the profile management page (`profile.tsx`)

---

# 13. Blood Donation Camps

Camp Management is implemented on the backend:

- Architecture:
  `campRoutes.js` -> `campController.js` -> `camp` model -> MongoDB
- Model (`server/models/camp.js`):
  - Fields: `name`, `description`, `organizer` (ref `user`), `location` (address, city, state, pincode, GeoJSON Point coordinates with sparse `2dsphere` index), `startDate`, `endDate`, `startTime`, `endTime`, `capacity`, `registrationCount`, and `status`.
  - Initial status defaults to `draft`.
  - `registrationCount` is system-controlled (defaults to 0, protected from client edits).
- APIs:
  - `POST /camps`: Protected (`organizer`, `admin`). Automatically ties `organizer` to `req.user.id`.
  - `GET /camps`: Public discovery for `published` camps. Supports filtering by `city`, `state`, and date range (`from`/`to`). Draft camps are hidden from public.
  - `GET /camps/:id`: Public for `published` camps. Drafts restricted to owning organizer or admins. Organizer personal email/phone numbers are omitted for privacy.
  - `PUT /camps/:id`: Protected. Organizers edit their own camps; admins edit any camp. Enforces allowed status transitions (`draft -> published/cancelled`, `published -> completed/cancelled`).
  - `DELETE /camps/:id`: Protected. Owners and admins can delete camps with 0 registrations. Blocks hard-delete if `registrationCount > 0` (directs to cancel instead).
- Full automated test suite in `scratch/test_camp_full.js` covering all 31 scenarios.

### Camp Registration

Camp Registration is implemented on the backend:

- Model (`server/models/campRegistration.js`):
  - Fields: `user` (ref `user`), `camp` (ref `camp`), `status` (`registered`, `cancelled`), `registeredAt`, and `cancelledAt`.
  - Compound unique index on `{ user: 1, camp: 1 }` preventing duplicate documents for the same user and camp.
- Endpoints:
  - `POST /camps/:campId/register`:
    - Restricted to donors (`user` role only).
    - Requires published camp that has not already started.
    - Integrates with `eligibilityService.evaluateEligibility()`, requiring `isMedicallyEligible === true` and `isDonorAvailable === true`.
    - Enforces capacity atomically via `$expr: { $lt: ["$registrationCount", "$capacity"] }` ensuring `registrationCount <= capacity` under concurrent requests.
    - Reactivates cancelled registrations without violating the unique index.
    - Atomically increments `camp.registrationCount`.
  - `GET /camps/:campId/registrations/me`: Returns the current user's registration status.
  - `DELETE /camps/:campId/register`: Cancels user's active registration and atomically decrements `camp.registrationCount` without dropping below 0.
  - `GET /camps/:campId/registrations`:
    - Role-protected: Accessible only by the camp's organizer owner or admins. Rejects normal users (403) and non-owner organizers (403).
    - Returns active registrations (`status === 'registered'`) by default.
    - Query filters supported: `?status=registered`, `?status=cancelled`, `?status=all`.
    - Pagination supported: `?page=1&limit=20` (limit capped at 100), includes metadata (`page`, `limit`, `total`, `totalPages`, `count`).
    - Sorted chronologically by registration timestamp (`registeredAt: 1`).
    - Safe donor projection: populates only `_id`, `name`, `bloodGroup`, `gender`, `phone`, and `location` (`city`, `state`, `pincode`). Never exposes passwords, JWTs, or private user data.
    - Read-only: does not modify camp data or registration counts.
- Automated tests in `scratch/test_camp_registration_full.js` covering all functional, edge-case, authorization, pagination, and concurrency scenarios.

### Frontend Camp Discovery & Registration

The donor-facing camp discovery and registration interface is integrated into the frontend application:

- Routes:
  - `/camps`: Publicly browses published blood donation camps (`GET /camps`) with query filtering by `city`, `state`, and date range (`from`, `to`), empty/error handling, and capacity indicators.
  - `/camps/$campId`: Displays detailed camp location and schedules, safe organizer attribution, live authenticated registration status check (`GET /camps/:campId/registrations/me`), donor eligibility advisory (`GET /eligibility/me`), inline login for visitors, slot registration (`POST /camps/:campId/register`), and cancellation (`DELETE /camps/:campId/register`) with confirmation modal.
- Backend Authority:
  - The frontend displays computed slots (`capacity - registrationCount`) for user convenience, but all registration, capacity, and medical eligibility determinations are strictly evaluated and enforced by the backend API.
- Navigation:
  - Added "Camps" to global Navbar (`src/components/Navbar.tsx`) and Footer quick links (`src/components/Footer.tsx`).

### Location-Based Camp Discovery

Geospatial discovery of published blood donation camps:

- Endpoint: `GET /camps/nearby`
  - Parameters: `longitude`, `latitude`, `radius` (optional, meters; default 25,000, max 500,000).
  - Queries MongoDB via `$geoNear` using the sparse `location.coordinates` `2dsphere` index.
  - Returns published camps ordered nearest-first with a calculated `distanceMeters` field.
  - Camps without coordinates and draft/cancelled camps are safely omitted.
  - Tested with 14 automated test assertions in `scratch/test_camp_nearby.js`.
- Frontend Integration:
  - Integrated into `/camps` with an interactive "Nearby Camps (Radius Search)" tab.
  - Reuses saved donor coordinates from profile (`/auth/me`).
  - Supports configurable radius options (5 km, 10 km, 25 km, 50 km) and shows distance badges (e.g. `2.4 km away`).
  - Handles empty states (no nearby camps, prompt to add coordinates in profile).

### Organizer functionality

Organizers should be able to:

- Create camps
- Update camps
- Cancel/delete camps where appropriate
- View registered donors
- Manage camp information

---

# 14. Blood Matching Engine

REDhope will eventually include a matching system.

The system should help match blood requirements with suitable donors.

Matching may consider factors such as:

- Blood group compatibility
- Donor eligibility
- Location/distance
- Availability
- Donation history
- Other project-defined rules

Do not implement medical/business rules based on assumptions.

The exact matching rules should be defined before implementation.

---

# 15. Notifications

A future notification system may support:

- Camp reminders
- Registration confirmations
- Blood requirement notifications
- Donation reminders
- Other important system notifications

The notification architecture should be modular so that notification providers can be changed later.

Do not add third-party notification services unless explicitly requested.

---

# 16. Donation Tracking

A future donation tracking system should maintain information such as:

- Donation date
- Camp associated with donation
- Donor
- Donation history
- Eligibility-related information

This data should be designed carefully because it is important application data.

---

# 17. Analytics

The final stages of the project may include analytics such as:

- Total donors
- Total donations
- Blood group distribution
- Camp statistics
- Registration statistics
- Organizer statistics
- Donation trends

Analytics should be based on actual stored data.

---

# 18. Frontend

The project also contains a frontend.

The frontend will eventually consume the backend REST APIs.

The frontend should not directly communicate with MongoDB.

The architecture should remain:

```text
Frontend
   ↓
REST API
   ↓
Express Backend
   ↓
Mongoose
   ↓
MongoDB Atlas
```

Do not put database credentials or other backend secrets in the frontend.

---

# 19. Database

Database:

```text
MongoDB Atlas
```

ODM:

```text
Mongoose
```

Current database functionality includes:

- User collection
- User creation
- User retrieval
- Unique email index
- Unique phone index

The database connection is already working.

Do not replace MongoDB with another database technology unless explicitly requested.

---

# 20. Environment Configuration

The project uses environment variables.

Sensitive values should remain in `.env`.

Examples include:

```env
MONGO_URI=
PORT=
JWT_SECRET=
```

The exact variables should be determined from the existing project files.

Never expose or commit actual secret values.

---

# 21. Development Workflow

Development should proceed incrementally.

Recommended order:

```text
Backend Foundation
        ↓
User CRUD
        ↓
Authentication
        ↓
User Profiles
        ↓
Eligibility Engine
        ↓
Camp Management
        ↓
Camp Registration
        ↓
Organizer Dashboard
        ↓
Matching Engine
        ↓
Notifications
        ↓
Donation Tracking
        ↓
Analytics
        ↓
Production Hardening
```

Do not jump into advanced features before the underlying architecture is stable.

---

# 22. Important Existing Decisions

The following decisions have already been made and should be preserved:

1. Node.js + Express for backend
2. MongoDB Atlas + Mongoose for database
3. Routes → Controllers → Models → MongoDB architecture
4. Existing User model naming convention
5. Environment variables for secrets
6. REST-style API
7. Backend validation
8. MongoDB unique indexes for email and phone
9. Incremental development
10. Existing working code should not be unnecessarily rewritten

---

# 23. Current Priority

The immediate priority is:

```text
Complete User CRUD
        ↓
Authentication
        ↓
Protected APIs
        ↓
User Profiles
```

Do not start implementing the entire REDhope roadmap at once.

Complete and test each major phase before moving to the next one.

---

# 24. Agent Context Rule

When implementing a new feature:

1. Read this file.
2. Read `AGENTS.md`.
3. Inspect the relevant existing code.
4. Determine what is already implemented.
5. Avoid duplicating existing functionality.
6. Preserve existing architecture.
7. Implement only the requested feature.
8. Test the implementation.
9. Report the files changed and tests performed.

If the repository contradicts this document, trust the actual current code and inform the developer about the discrepancy rather than silently rewriting the project.