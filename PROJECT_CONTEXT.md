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

### Organizer Dashboard

The Organizer Dashboard enables event organizers and administrators to oversee camps and donor registrations:

- Routes:
  - `/organizer`: Dashboard home featuring live summary cards (total camps, draft, published, completed, cancelled, total registered donors), status filter tabs, quick status actions, and an interactive "Create New Camp" modal.
  - `/organizer/camps/$campId`: Detailed management view for a specific camp showing capacity metrics, status transitions, camp details editing (`PUT /camps/:id`), and registered donor directory with pagination and status filtering (`GET /camps/:campId/registrations`).
- Role Protection:
  - Role checks verify `organizer` and `admin` privileges (`/auth/me`).
  - Unauthenticated users receive an authentication prompt.
  - Normal donors (`user` role) receive an access-denied screen redirecting them to public camp discovery.
  - Role-aware Navbar dynamically presents the "Organizer" link exclusively to authorized roles.
- Backend Integration:
  - Supports `GET /camps?status=all` for organizers to retrieve all their own camps and admins to retrieve all camps.
  - Respects lifecycle restrictions: `draft -> published/cancelled`, `published -> completed/cancelled`.
  - Enforces donor safe projections (`_id`, `name`, `bloodGroup`, `gender`, `phone`, `location`), never exposing passwords, tokens, or private credentials.

### Organizer Analytics

Organizer Analytics provides aggregated, read-only operational intelligence and performance metrics for drive organizers and system administrators:

- Backend Analytics Endpoint:
  - `GET /camps/analytics`: Protected endpoint requiring `authMiddleware` mounted before dynamic camp routes.
  - Role scoping: Organizers receive metrics scoped strictly to camps they own (`organizer = req.user.id`). Admins receive platform-wide statistics across all organizers and camps. Normal donors receive `403 Forbidden`; unauthenticated requests return `401 Unauthorized`.
  - Calculations via MongoDB Aggregations:
    - Summary counts: total camps, draft, published, completed, cancelled, total capacity, total registrations, active registrations, cancelled registrations.
    - Capacity utilization: `(activeRegistrations / totalCapacity) * 100`, safely returning 0 when capacity is 0.
    - Monthly registration trends: Grouped by registration date (`YYYY-MM`).
    - Top performing camps: Top 5 camps sorted descending by active registration counts.
    - Blood group distribution: Aggregated counts by donor blood groups.
    - Camp lifecycle distribution: Status breakdown counts.
  - Date filtering: Optional `from` and `to` query parameters on `camp.startDate`. Strictly validated against invalid dates and inverted date windows (`400 Bad Request`).
  - Strict Donor Privacy: Responses contain only aggregated statistics; zero donor PII (`name`, `email`, `phone`, `password`, `dateOfBirth`) is included.
- Frontend Route:
  - `/organizer/analytics`: Built using TanStack Router and `recharts`.
  - Features: Summary metric cards with capacity progress indicator, monthly registration volume `LineChart`, registered donor blood group `BarChart`, camp lifecycle distribution bars, top performing camps ranking table, and date range filters with Apply and Reset controls.
  - Accessible directly via the "Analytics" button on `/organizer`.

---

# 14. Blood Matching Engine

REDhope includes a reusable, read-only blood donor matching engine that evaluates blood requirements against registered donors and returns suitable candidates ranked by relevance and proximity.

### Architecture

```
Client Request (POST /matching/donors)
              ↓
    authMiddleware (JWT)
              ↓
  bloodMatchingController.js
              ↓
   bloodMatchingService.js
              ↓
 ┌──────────────────────────────┐
 │ Blood compatibility rules    │ (RBC donor-recipient mapping)
 │ Medical eligibility check    │ (delegated to eligibilityService.js)
 │ Donor availability check     │ (isDonorAvailable: true)
 │ Geospatial proximity         │ (MongoDB $geoNear aggregation)
 │ Candidate scoring & ranking  │ (0-100 deterministic scoring)
 └──────────────────────────────┘
              ↓
   Ranked Donor Candidates (Privacy-preserving projection)
```

### Blood Compatibility
Red blood cell (RBC) compatibility logic is isolated in `server/rules/bloodCompatibilityRules.js`:
- Recipient `O-`: receives only `O-` (O- is universal donor).
- Recipient `O+`: receives `O+`, `O-`.
- Recipient `A-`: receives `A-`, `O-`.
- Recipient `A+`: receives `A+`, `A-`, `O+`, `O-`.
- Recipient `B-`: receives `B-`, `O-`.
- Recipient `B+`: receives `B+`, `B-`, `O+`, `O-`.
- Recipient `AB-`: receives `AB-`, `A-`, `B-`, `O-`.
- Recipient `AB+`: receives all 8 groups (universal recipient).

### Eligibility & Availability
- Reuses `eligibilityService.js` (`evaluateEligibility`) directly.
- Ensures donor is medically eligible (age >= 18, donation interval >= 90 days, admin block check) and available (`isDonorAvailable: true`).
- Does not allow client overrides of eligibility rules or donor availability.

### Proximity & Scoring
- When coordinates (`latitude`, `longitude`, `radius`) are supplied, MongoDB `$geoNear` aggregation queries donors using the sparse `2dsphere` index on `user.location.coordinates`. Donors without coordinates are excluded from radius queries.
- When coordinates are omitted, all compatible eligible donors are retrieved without fabricating distances.
- Deterministic score (0-100) rewards:
  - Base eligibility & availability (50 or 70 points).
  - Exact blood group match bonus (20 or 30 points) vs compatible match (10 or 15 points).
  - Proximity points (up to 30 points inversely proportional to distance within radius).
- Returns human-readable `matchReason` array explaining each scoring factor.

### Donor Privacy
- The matching API strictly protects donor personal data.
- Returned fields: `userId`, `name`, `bloodGroup`, `city`, `state`, `distanceMeters`, `score`, and `matchReason`.
- Strictly omitted: `password`, `email`, `phone`, `dateOfBirth`, `address`, `role`, tokens, and precise coordinates.
- Read-only; does not create a permanent `BloodMatch` collection or trigger notifications.

### Frontend
- `/matching`: Dedicated interface to select recipient blood group, configure optional proximity search, and view ranked candidate cards with match scores, compatibility badges, and explanations. Includes "Find Donors" link in Navbar.

---

# 15. Notifications

The in-app notification system provides reliable, user-isolated internal messaging for blood donor matches, camp events, and platform updates.

### Architecture
```text
HTTP Request
    ↓
notificationRoutes.js (authMiddleware)
    ↓
notificationController.js
    ↓
notificationService.js
    ↓
Notification Model (server/models/notification.js)
    ↓
MongoDB Atlas
```

### Notification Model
The `Notification` schema defines:
- `user`: ObjectId referencing `user` (required, indexed)
- `type`: Enum `['blood_match', 'camp_registration', 'camp_update', 'camp_cancellation', 'system']` (required)
- `title`: String (required, trimmed)
- `message`: String (required, trimmed)
- `isRead`: Boolean (default: false, indexed)
- `metadata`: Flexible Map/Object for contextual references (`campId`, `registrationId`, `bloodGroup`, `unitsNeeded`, `requestId`, etc.)
- `eventKey`: Optional string for idempotent duplicate prevention
- Timestamps: `createdAt` and `updatedAt`
- Compound Indexes:
  - `{ user: 1, createdAt: -1 }` (for fast paginated retrieval ordered newest first)
  - `{ user: 1, isRead: 1, createdAt: -1 }` (for efficient unread counting and queries)
  - `{ user: 1, eventKey: 1 }` (partial unique index with `partialFilterExpression: { eventKey: { $type: "string" } }` guaranteeing single delivery per event)

### Notification Triggers & Features
1. **Camp Registration Notifications (`server/controllers/campRegistrationController.js`, `server/controllers/campController.js`)**:
   - Creates `camp_registration` notification on successful registration with camp name, date, and venue.
   - Creates `camp_registration` notification when a registration is cancelled.
   - When a camp is cancelled by organizer/admin, triggers `camp_cancellation` notifications for all actively registered donors.
   - When a camp's schedule or venue changes, triggers `camp_update` notifications for all actively registered donors.
2. **Camp Reminders (`server/services/notificationScheduler.js`)**:
   - 24-hour reminder job checking published camps starting within the next 24 hours.
   - Sends `camp_update` notification with title `"Camp Reminder"` to donors with active registrations (`status: "registered"`).
   - Cancelled registrations are excluded. Idempotent key: `camp-reminder:${campId}:${registrationId}:24h`.
3. **Blood Requirement Notifications (`server/models/bloodRequest.js`, `server/services/bloodRequestService.js`, `server/controllers/bloodMatchingController.js`)**:
   - Persistent `BloodRequest` model tracks requirement lifecycle (`bloodGroup`, `unitsNeeded`, `urgency`, `location`, `radius`, `createdBy`, `status`).
   - Leverages `bloodMatchingService.findMatchingDonors` to filter compatible, eligible, and available donors.
   - Sends `blood_match` notifications to matching donors within the search radius without leaking donor PII.
   - Exposed via `POST /matching/requests` and `GET /matching/requests`.
4. **Donation Reminders (`server/services/notificationScheduler.js`)**:
   - Reuses authoritative `evaluateEligibility` to check donors with previous `lastDonationDate`.
   - Sends `system` notification `"You're Eligible to Donate Again"` when 90 days have elapsed.
   - Optionally sends early reminder when donor is within 7 days of eligibility.
   - Never modifies user `isEligible` or `lastDonationDate`.
   - Idempotent key: `donation-eligibility:${userId}:${lastDonationDate}`.

### Notification Scheduler
- `server/services/notificationScheduler.js`: Lightweight, non-blocking periodic scheduler running every 60 seconds.
- Automatically started on server boot in `server/server.js` when `ENABLE_NOTIFICATION_SCHEDULER !== "false"`.
- Functions: `checkCampReminders()`, `checkDonationEligibilityReminders()`, `runAllJobs()`, `startScheduler()`, `stopScheduler()`.

### Endpoints
All endpoints are protected by `authMiddleware`:
- `GET /notifications`: Paginated retrieval (`page`, `limit` up to 100). Default 20 items per page, sorted newest first (`createdAt: -1`).
- `GET /notifications/unread-count`: Returns `{ success: true, count: N }` for unread notifications.
- `PATCH /notifications/:id/read`: Marks a single notification as read (`isRead: true`).
- `PATCH /notifications/read-all`: Bulk marks all unread notifications as read for the authenticated user. Mounted before `/:id/read` to prevent route collision.
- `DELETE /notifications/:id`: Permanently removes an owned notification.
- `POST /matching/requests`: Creates a blood requirement and notifies matching compatible donors.
- `GET /matching/requests`: Lists active blood requirements.

### Ownership & Privacy Isolation
- All query operations in `notificationService.js` strictly enforce `{ _id: id, user: userId }`.
- Any attempt to view, mark read, or delete a notification belonging to another user safely yields `404 Not Found`, completely preventing unauthorized manipulation and existence probing.
- Notification payloads and metadata never contain passwords, tokens, or unneeded private donor PII.

### Frontend Integration
- `/notifications`: Dedicated inbox interface displaying notification cards with type badges, unread indicators, relative timestamps, quick "Mark as Read" and "Delete" buttons, category filter tabs (All, Unread, Blood Matches, Camps, System), "Mark All as Read" header button, and pagination. Includes contextual links for camps ("View Camp Details →"), blood matches ("Find Donors & Matching →"), and eligibility reminders ("Check Eligibility Details →").
- `Navbar.tsx`: Integrated notification bell icon with a real-time unread counter badge. Unread count updates automatically on user authentication and route transitions.

---

# 16. Donation Tracking

The Donation Tracking System records actual blood donations associated with users and camps, synchronizing completed donations with the donor's medical eligibility interval.

### Architecture & Lifecycle
```text
Camp Registration
        ↓
Organizer Records Donation (POST /donations)
        ↓
Donation Record (status: "scheduled")
        ↓
Actual Donation Occurs
        ↓
Organizer Marks Completed (PATCH /donations/:id/status { status: "completed" })
        ↓
Donation Verified (verifiedAt set)
        ↓
Update User.lastDonationDate (latest completed donation date rule)
        ↓
Eligibility Engine (GET /eligibility/me automatically recalculates 90-day interval)
        ↓
In-App Notification ("Donation Recorded" with eventKey idempotency)
```

### Models & Collections
- `server/models/donation.js`:
  - `donor` (ref `user`, required)
  - `camp` (ref `camp`, required)
  - `registration` (ref `campRegistration`, required, unique index enforces 1 donation per camp registration)
  - `donationDate` (Date, default `Date.now`, validates <= 1 year in future)
  - `units` (Number, integer >= 1, default 1)
  - `bloodGroup` (String, historical snapshot enum: `["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]`)
  - `status` (enum: `["scheduled", "completed", "cancelled", "no_show"]`, default `"scheduled"`)
  - `notes` (String, max 500 chars)
  - `recordedBy` (ref `user`, required)
  - `verifiedAt` (Date, set on completion)
  - Indexes: `{ registration: 1 }` (unique), `{ donor: 1, donationDate: -1 }`, `{ donor: 1, status: 1 }`, `{ camp: 1, status: 1 }`, `{ camp: 1, donationDate: -1 }`.

### State Machine & Idempotency
- Allowed transitions: `scheduled -> completed`, `scheduled -> cancelled`, `scheduled -> no_show`.
- Terminal states (`completed`, `cancelled`, `no_show`) are protected against arbitrary status reversal.
- Repeated completion calls return current state safely without creating duplicate notifications or modifying dates.

### Date Ordering & Eligibility Synchronization
- When a donation transitions to `completed`, `syncDonorLastDonationDate` queries all completed donations for the donor and resolves `max(dates)`.
- If an older historical donation is completed after a newer one exists, `user.lastDonationDate` is preserved at the newest date.
- Cancelled and no-show donations never modify `user.lastDonationDate`.
- `GET /eligibility/me` naturally evaluates the updated date with the 90-day interval without duplicated logic.

### Endpoints & Authorization
- `POST /donations`: Organizer camp owner or Admin only. Derives donor, camp, and bloodGroup snapshot securely from registration.
- `PATCH /donations/:id/status`: Organizer camp owner or Admin only.
- `GET /donations/me`: Authenticated donor only. Paginated, sorted newest first (`donationDate: -1`).
- `GET /camps/:campId/donations`: Organizer camp owner or Admin only. Supports status filtering (`scheduled`, `completed`, `cancelled`, `no_show`, `all`) and pagination.
- `GET /donations/:id`: Donor, camp organizer, or Admin (IDOR-protected).
- `GET /camps/analytics`: Extended with `data.donations` metrics (total donations, completed donations, units, blood group distribution, monthly trends).

### Frontend Integration
- `/donations`: Donor-facing page with history table, unit counts, status badges, and camp details.
- `Navbar.tsx`: Added "Donations" navigation item.
- `/organizer/camps/$campId`: Organizer dashboard with donation summary counters, registered donor rows with donation status badges, and action buttons to record donations, complete, mark no-show, or cancel.

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
BREVO_API_KEY=
EMAIL_FROM=
EMAIL_FROM_NAME=
EMAIL_NOTIFICATIONS_ENABLED=
```

The exact variables should be determined from the existing project files.

Never expose or commit actual secret values.

---

# 20.1 Email Notification System (Brevo HTTP API)

Email notifications are integrated as an asynchronous delivery channel on top of the in-app notification system:

1. **HTTP Delivery**: Uses the Brevo v3 transactional email API (`POST https://api.brevo.com/v3/smtp/email`) directly via Node native `fetch`. No SMTP dependencies.
2. **Decoupled Architecture**: `notificationService.createNotification` triggers `deliverNotificationEmail` in a non-blocking background promise. Email delivery failures or timeouts never impact API response codes or database transactions.
3. **User Preferences**: Respected via `user.emailNotifications` (default `true`). Opted-out users receive in-app notifications only.
4. **Templates**: Rich responsive HTML and plain-text fallback templates for all 8 system events:
   - Camp Registration Confirmed
   - Camp Registration Cancelled
   - Camp Details Updated
   - Camp Cancelled by Organizer
   - Camp Reminder (24 Hours Prior)
   - Blood Requirement / Match Alert
   - Donation Eligibility Reminder
   - Donation Verified / Recorded
5. **Security & Testing**: Brevo API key is protected and never returned in responses or tests. Automated test suites use `setMockEmailSender` to mock API interactions with zero live emails sent.

---

# 20.2 Analytics System

The Analytics system provides read-only aggregations computed directly from MongoDB operational collections (`camps`, `campregistrations`, `donations`, `users`, `bloodrequests`) without redundant counters or data mutations:

1. **Role-Based Isolation & Access Control**:
   - `organizer`: strictly isolated to camps owned by that organizer (`{ organizer: req.user.id }`), completely preventing cross-organizer data leakage and IDOR.
   - `admin`: global aggregations across all drives, plus admin-only platform metrics (total registered users, available donors, medically eligible donors, and blood request volume).
   - `user` / unauthenticated: restricted with HTTP 403 / 401.
2. **Aggregated Metrics**:
   - Summary: total camps, status breakdown (`draft`, `published`, `completed`, `cancelled`), total capacity, total registrations, active registrations, cancelled registrations, capacity utilization percentage, total donations, completed donations, scheduled donations, no-show donations, total units donated.
   - Capacity: total capacity, active registrations, utilization percentage.
   - Registrations: monthly trend and donor blood group distribution across all 8 standard types.
   - Donations: completed donations monthly trend, units donated, and blood group breakdown.
   - Top Camps: leaderboard of top 10 camps sorted by completed donations and active registrations.
   - Camp Status: distribution of drives across all lifecycle states.
3. **Filtering & Privacy**:
   - Optional `from` and `to` ISO date parameters with validation against malformed dates and inverted ranges.
   - Strict Zero-PII guarantee: donor names, emails, phone numbers, exact location coordinates, and passwords are never returned in analytics payloads.

---

# 20.3 Security Architecture & Hardening

Security controls implemented across the REDhope backend:

1. **Security Headers (Helmet)**:
   - Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Cross-Origin-Resource-Policy: cross-origin`, and suppresses `X-Powered-By`.
2. **Environment-Restricted CORS**:
   - Production allows origins defined in `FRONTEND_URL` environment variable; development permits localhost ports (3000, 5173, 8080).
3. **Multi-Tier Rate Limiting (`express-rate-limit`)**:
   - `authLimiter`: 25 requests per 15 minutes window on `/auth/login` and `/auth/register`.
   - `matchingLimiter`: 60 requests per 10 minutes on `/matching/donors` and `/matching/requests`.
   - `generalLimiter`: 300 requests per 15 minutes globally across the API.
   - Bypassed in automated test runs via `NODE_ENV === "test"` or `DISABLE_RATE_LIMIT=true`.
4. **Injection & Tampering Defenses**:
   - Enforced string validation on authentication parameters preventing MongoDB query operator injection (e.g. `{ $ne: null }`).
   - Escaped regular expression special characters in user-provided search filters (`city`, `state`).
   - Enforced password length >= 6 characters on registration and updates.
   - Atomic conditional operations (`findOneAndUpdate` with `$expr: { $lt: ["$registrationCount", "$capacity"] }`) preventing capacity overflow race conditions.
5. **Role-Based Access & IDOR Controls**:
   - Organizers can strictly manage their own camps, registrations, and donation events.
   - Donors can access only their own notifications, personal registrations, and personal donation history.
   - Admin has system-wide management access.
   - Terminal donation states (`completed`, `cancelled`, `no_show`) are immutable.

---

# 20.4 Donor Health Screening & Medical Review System

The Donor Health Screening & Medical Review system provides a secure, private, and human-supervised medical review pipeline for prospective donors:

1. **Private Medical Storage Abstraction (`storageService.js`)**:
   - Files are stored in a dedicated private directory (`server/storage/medical_documents/`) outside public web roots.
   - Enforces 5MB maximum file size limit, sanitized file names, and UUID-based storage keys.
   - Magic bytes / file signature validation prevents extension masquerading (validates `%PDF` for PDF, `FF D8 FF` for JPEG, and `89 50 4E 47` for PNG).
   - Strict read streaming with `X-Content-Type-Options: nosniff` and non-destructive deletion.

2. **Structured Health Questionnaire & Data Models**:
   - `HealthScreening`: Comprehensive 9-section questionnaire covering General Health, Medical History, Medications, Blood Donation History, Recent Procedures (piercings/tattoos/surgeries), Travel (malaria zones), Pregnancy & Lactation, Vitals & Physical Measurements, and High-Risk Infections.
   - Requires explicit informed consent and disclaimer agreement (`consentGiven: true`, timestamp, and user IP).
   - `MedicalDocument`: Metadata tracking donor ID, screening ID, sanitized file name, MIME type, size, status (`pending`, `verified`, `rejected`), and secure storage key.
   - `MedicalAuditLog`: Tamper-evident logging of all medical record access, document downloads, and clinical review status decisions with zero questionnaire/PII in log details.

3. **Preliminary Screening Flags (No Automated Diagnosis)**:
   - Evaluated by `preliminaryScreeningRules.js` to create an actionable summary checklist for medical reviewers.
   - **Never makes automated diagnostic decisions or automatic approvals.**
   - All approvals, temporary deferrals, permanent deferrals, or information requests require explicit human review by an administrator or qualified reviewer.

4. **Reviewer Decision Workflow & Access Control**:
   - Lifecycle: `draft` -> `submitted` -> `under_review` -> `approved` | `temporarily_deferred` | `permanently_deferred` | `needs_information`.
   - Mandatory clinical reasoning required for all deferrals and information requests.
   - Strict IDOR prevention: Donors can only access their own screening and documents.
   - Medical Privacy Isolation: Organizers and normal users are strictly blocked (HTTP 403) from accessing screening data, medical answers, and uploaded files.

5. **Eligibility Engine & System Integration**:
   - Enforces medical screening within `evaluateEligibility` without breaking legacy date-based donation intervals (90 days) or admin block rules.
   - Unapproved screenings (`submitted`, `under_review`, `temporarily_deferred`, `permanently_deferred`) mark donors medically ineligible with clear reasons.
   - Camp registration enforces `requireHealthScreening: true` where configured by organizers.
   - Emergency blood matching excludes donors who are not medically approved.

6. **Frontend Interfaces**:
   - `/health-screening`: 5-step interactive wizard (Consent -> Questionnaire -> Document Upload -> Review & Submit -> Status Tracker).
   - `/admin/health-screenings`: Admin triage console with status filters, search, and paginated queue.
   - `/admin/health-screenings/$screeningId`: Clinical review station with questionnaire inspection, audit trail, secure document downloads, and decision submit form.

---

# 20.5 Camp-Specific Manual Donor Screening System

The Camp-Specific Manual Donor Screening system establishes an authorized on-site physical screening workflow for camp organizers without compromising medical privacy or global eligibility integrity:

1. **Architecture & Scope Distinction**:
   - **Donor Health Screening (Layer 1)**: Self-reported health history, symptoms, and medical records uploaded by the donor. Labeled as `"Submitted by donor"` and strictly read-only for organizers.
   - **Camp Screening (Layer 2)**: On-site physical examination questionnaire and observations recorded by authorized camp screeners when the donor is physically present at the drive.
   - **Medical Documents**: Private health reports and certificates accessible only to the donor, administrators, and the authorized organizer of a camp for which the donor is actively registered.
   - **Camp-Specific Approval Scope**: Camp screening decisions belong strictly to `Donor + Camp + CampRegistration`. Approving a donor for Camp A authorizes them for donation at Camp A only and does **NOT** automatically grant permanent global eligibility (`user.isEligible`) for future drives.

2. **Data Model (`CampScreening`)**:
   - `donor`: Ref `user`
   - `camp`: Ref `camp`
   - `registration`: Ref `campRegistration` (Unique index `{ registration: 1 }` prevents duplicate records per registration)
   - `questionnaire`: 10 manual physical questions (general appearance, acute fever/illness, medications, recent surgeries, donation reactions, measured vitals including hemoglobin, blood pressure, and pulse)
   - `observations`: Free-text clinical notes
   - `reviewedDocuments`: Array of referenced `MedicalDocument` ObjectIds
   - `decision`: `["pending", "approved", "temporarily_deferred", "needs_medical_review", "rejected"]`
   - `decisionReason`: Mandatory string when setting decision to deferred, rejected, or needs review
   - `screenedBy`: Authenticated organizer/screener ID (auto-derived)
   - `screenedAt`: Server timestamp (auto-generated)

3. **Strict Camp-Ownership Authorization & Document Security**:
   - Organizers can access donor screening details and documents **only** if they own the camp and the donor is registered for that camp.
   - Organizers cannot browse all donors, access donors of other camps (HTTP 403), or download medical records merely by knowing a document ID.
   - Secure Document Streaming: `GET /camps/:campId/screenings/:registrationId/documents/:documentId` verifies ownership and registration before streaming with `X-Content-Type-Options: nosniff`.
   - Immutable Audit Logging: Every organizer access (`ORGANIZER_SCREENING_VIEWED`, `MEDICAL_DOCUMENT_VIEWED_BY_ORGANIZER`, `CAMP_SCREENING_DECISION_RECORDED`) is logged in `MedicalAuditLog`.

4. **Lifecycle & Donation Recording Gate**:
   - Flow: `REGISTERED` $\rightarrow$ `SCREENING_PENDING` $\rightarrow$ `SCREENED` $\rightarrow$ `APPROVED` $\rightarrow$ `DONATION`.
   - When a camp is configured with `requireHealthScreening: true`, `recordDonation` enforces that the donor's camp screening must be `approved` before units can be recorded.

5. **Frontend Interfaces**:
   - `/organizer/camps/$campId`: Donor table displays Blood Group, Reg Status, Screening Status badge, Screened At timestamp, and a `"Screen Donor"` button.
   - `/organizer/camps/$campId/screening/$registrationId`: Dedicated screening station featuring donor demographics, read-only donor health history, secure document downloads, manual on-site screening questionnaire, observations, and decision submission form.
   - `/camps/:campId/registrations/me`: Donor view reflecting updated `screeningStatus`.

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