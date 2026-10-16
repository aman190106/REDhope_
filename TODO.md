# REDhope TODO

This file contains the current development tasks for REDhope.

Tasks should be completed incrementally and checked off when verified.

---

# 🔴 Current Priority

## User CRUD

- [x] User registration
- [x] Required-field validation
- [x] Email validation
- [x] Phone validation
- [x] Duplicate email detection
- [x] Duplicate phone detection
- [x] MongoDB unique indexes for email and phone
- [x] `GET /users`
- [x] `GET /users/:id`
- [x] `PUT /users/:id`
- [x] `DELETE /users/:id`

---

# 🟠 Authentication

- [x] Design authentication flow
- [x] Add password hashing with bcrypt
- [x] Update registration to securely store passwords
- [x] Implement login
- [x] Implement JWT authentication
- [x] Create authentication middleware
- [x] Protect private routes
- [x] Implement authorization
- [x] Define user roles
- [x] Test authentication and authorization

---

# 🟡 User Profiles

- [x] Create user profile structure
- [x] Add blood group validation
- [x] Add location information (GeoJSON Point, city, state, pincode)
- [x] Add donor information (dateOfBirth, gender, isDonorAvailable, lastDonationDate, isEligible)
- [x] Add profile update API (`PUT /auth/me`)
- [x] Add profile retrieval API (`GET /auth/me`)
- [x] Connect profile with authentication (`authMiddleware`)
- [x] Build frontend profile page

---

# 🟢 Blood Donation Eligibility

- [x] Define eligibility rules
- [x] Design eligibility data structure
- [x] Implement eligibility engine
- [x] Create eligibility API (`GET /eligibility/me`)
- [x] Connect eligibility engine with donor profiles
- [x] Add frontend eligibility interface
- [x] Test eligibility edge cases

---

# 🩺 Donor Health Screening & Medical Review

- [x] Create HealthScreening model with structured questionnaire & preliminary flags
- [x] Create MedicalDocument model with private storage metadata
- [x] Implement private document storage abstraction (`storageService.js`)
- [x] File signature validation (magic bytes for PDF, JPG, PNG) and path traversal sanitization
- [x] Comprehensive preliminary screening rules for transparent reviewer checklists
- [x] Medical disclaimer and informed consent enforcement (`consentGiven: true`)
- [x] Tamper-evident Medical Audit Trail (`MedicalAuditLog` & `medicalAuditService.js`)
- [x] Donor health screening API (`GET /health-screening/me`, `PUT /health-screening/me`, `POST /health-screening/me/submit`)
- [x] Private document upload & streaming download (`POST /health-screening/me/documents`, `GET /health-screening/documents/:id`)
- [x] Clinical reviewer & admin console API (`GET /admin/health-screenings`, `PATCH /admin/health-screenings/:id/review`)
- [x] Integration with Eligibility Engine, Camp Registration, and Blood Matching
- [x] User health screening multi-step frontend (`src/routes/health-screening.tsx`)
- [x] Admin medical review dashboard & detail review routes (`src/routes/admin/health-screenings/`)
- [x] Automated test suite with 42 passed assertions (`scratch/test_health_screening.js`)

---

# 🏥 Camp-Specific Manual Donor Screening

- [x] Create CampScreening model (`server/models/campScreening.js`) belonging to Donor + Camp + CampRegistration
- [x] Unique index enforcing single screening record per camp registration (`{ registration: 1 }`)
- [x] Strict camp-ownership authorization (Organizer can only access registered donors for camps they own)
- [x] Private medical document streaming with camp registration verification (`GET /camps/:campId/screenings/:registrationId/documents/:documentId`)
- [x] Organizer camp screening list API (`GET /camps/:campId/screenings`)
- [x] Comprehensive donor screening workspace API (`GET /camps/:campId/screenings/:registrationId`)
- [x] Manual camp screening questionnaire & decision saving API (`PUT/POST /camps/:campId/screenings/:registrationId`)
- [x] Mandatory decision reasons for temporary deferral, medical review, and rejection
- [x] Auto-derived `screenedBy` and timestamped `screenedAt`
- [x] Gated donation recording on camp screening approval when `requireHealthScreening: true`
- [x] Medical audit logging (`ORGANIZER_SCREENING_VIEWED`, `MEDICAL_DOCUMENT_VIEWED_BY_ORGANIZER`, `CAMP_SCREENING_CREATED`, `CAMP_SCREENING_UPDATED`, `CAMP_SCREENING_DECISION_RECORDED`)
- [x] Non-sensitive notifications and Brevo email updates for screening decisions
- [x] Organizer dashboard donor table updated with screening status, screenedAt, and "Screen Donor" button (`/organizer/camps/$campId`)
- [x] Organizer manual screening station frontend (`/organizer/camps/$campId/screening/$registrationId`)
- [x] Donor view registration status updated with `screeningStatus` (`/camps/:campId/registrations/me`)
- [x] 23-assertion automated test suite (`scratch/test_camp_screening.js`) passing 100%

---

# 🔵 Blood Donation Camps

## Camp Backend

- [x] Create Camp model
- [x] Create camp controller
- [x] Create camp routes
- [x] Create camp API
- [x] Add camp validation
- [x] Implement create camp
- [x] Implement get camps
- [x] Implement get camp by ID
- [x] Implement update camp
- [x] Implement delete/cancel camp

## Camp Discovery

- [x] Camp listing
- [x] Camp search
- [x] Camp filtering
- [x] Camp details page
- [x] Location-based camp discovery

---

# 🟣 Camp Registration

- [x] Create camp registration model
- [x] Register donor for camp
- [x] Prevent duplicate registration
- [x] Check camp capacity
- [x] View registration status
- [x] Cancel registration
- [x] Organizer view of registered donors
- [x] Test registration edge cases

---

# 🟤 Organizer Dashboard

- [x] Define organizer role
- [x] Organizer authentication
- [x] Organizer dashboard
- [x] Create camp
- [x] Edit camp
- [x] Cancel camp
- [x] View registered donors
- [x] Manage camp registrations
- [x] Add organizer analytics

---

# 🔴 Blood Matching Engine

- [x] Define blood compatibility rules
- [x] Define donor matching criteria
- [x] Implement blood compatibility logic
- [x] Implement donor filtering
- [x] Add location/distance consideration
- [x] Implement donor matching service
- [x] Create matching API
- [x] Test matching logic

---

# 🟠 Notifications

- [x] Design notification system
- [x] Create notification model
- [x] Implement in-app notifications
- [x] Camp registration notifications
- [x] Camp reminder notifications
- [x] Blood requirement notifications
- [x] Donation reminders
- [x] Notification read/unread state
- [x] Brevo Email API integration (`emailService.js`)
- [x] Email notification templates (Camp Registration, Update, Cancellation, Reminders, Blood Match, Donation)
- [x] Email notification delivery decoupling (`notificationDeliveryService.js`)
- [x] User email notification preferences (`user.emailNotifications`)
- [x] Email notification automated regression suite (16 test scenarios verified)

---

# 🟡 Donation Tracking

- [x] Create donation model
- [x] Record completed donations
- [x] Connect donations to donors
- [x] Connect donations to camps
- [x] Create donation history API
- [x] Update donor donation history
- [x] Integrate donation history with eligibility

---

# 🟢 Analytics

- [x] Donor statistics
- [x] Donation statistics
- [x] Blood group statistics
- [x] Camp statistics
- [x] Registration statistics
- [x] Organizer statistics
- [x] Donation trends
- [x] Admin analytics dashboard

---

# 🔵 Frontend

## General

- [x] Connect frontend to backend APIs
- [x] Configure API base URL
- [x] Add loading states
- [x] Add error handling
- [x] Add authentication state
- [x] Protect frontend routes

## Pages

- [x] Landing page
- [x] Registration page
- [x] Login page
- [x] User dashboard
- [x] User profile
- [x] Eligibility page
- [x] Camp discovery
- [x] Camp details
- [x] Camp registration
- [x] Donation history
- [x] Notifications
- [x] Organizer dashboard
- [x] Analytics dashboard

---

# ⚙️ Security

- [x] Secure password storage
- [x] JWT security
- [x] Authentication middleware
- [x] Authorization
- [x] Input validation
- [x] API error handling
- [x] Protect sensitive user data
- [x] Remove sensitive fields from API responses
- [x] Verify `.env` is ignored
- [x] Audit exposed secrets
- [x] Review API security before deployment
- [x] Security headers (Helmet)
- [x] API rate limiting (auth, matching, general)
- [x] Origin-restricted CORS

---

# 🧪 Testing

## Backend

- [x] Test user registration
- [x] Test duplicate email
- [x] Test duplicate phone
- [x] Test `GET /users`
- [x] Test `GET /users/:id`
- [x] Test update user
- [x] Test delete user
- [x] Test authentication
- [x] Test authorization
- [x] Test camp APIs
- [x] Test camp registration
- [x] Test matching engine

## Frontend

- [x] Test registration flow
- [x] Test login flow
- [x] Test profile flow
- [x] Test camp discovery
- [x] Test camp registration
- [x] Test organizer workflow

---

# 🚀 Production Preparation

- [ ] Review environment variables
- [ ] Configure production MongoDB
- [ ] Configure production backend
- [ ] Configure production frontend
- [ ] Add proper CORS configuration
- [ ] Add production error handling
- [ ] Review security
- [ ] Optimize database queries
- [ ] Add database indexes where necessary
- [ ] Test complete application flow
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Verify production APIs
- [ ] Verify production database connection

---

# 📌 Development Rules

When completing a task:

1. Implement only the requested task.
2. Test it before marking it complete.
3. Mark `[ ]` as `[x]` only after verification.
4. Update `CHANGELOG.md` for meaningful completed features.
5. Update `PROJECT_CONTEXT.md` when the project's overall state changes.
6. Do not mark tasks complete merely because code was written.
7. Do not add speculative tasks unless they are actually required.

---

# 🎯 Current Goal

Complete the remaining User CRUD operations:

```text
GET    /users/:id
PUT    /users/:id
DELETE /users/:id