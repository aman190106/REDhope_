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

- [ ] Camp listing
- [ ] Camp search
- [ ] Camp filtering
- [ ] Camp details page
- [ ] Location-based camp discovery

---

# 🟣 Camp Registration

- [ ] Create camp registration model
- [ ] Register donor for camp
- [ ] Prevent duplicate registration
- [ ] Check camp capacity
- [ ] View registration status
- [ ] Cancel registration
- [ ] Organizer view of registered donors
- [ ] Test registration edge cases

---

# 🟤 Organizer Dashboard

- [ ] Define organizer role
- [ ] Organizer authentication
- [ ] Organizer dashboard
- [ ] Create camp
- [ ] Edit camp
- [ ] Cancel camp
- [ ] View registered donors
- [ ] Manage camp registrations
- [ ] Add organizer analytics

---

# 🔴 Blood Matching Engine

- [ ] Define blood compatibility rules
- [ ] Define donor matching criteria
- [ ] Implement blood compatibility logic
- [ ] Implement donor filtering
- [ ] Add location/distance consideration
- [ ] Implement donor matching service
- [ ] Create matching API
- [ ] Test matching logic

---

# 🟠 Notifications

- [ ] Design notification system
- [ ] Create notification model
- [ ] Implement in-app notifications
- [ ] Camp registration notifications
- [ ] Camp reminder notifications
- [ ] Blood requirement notifications
- [ ] Donation reminders
- [ ] Notification read/unread state

---

# 🟡 Donation Tracking

- [ ] Create donation model
- [ ] Record completed donations
- [ ] Connect donations to donors
- [ ] Connect donations to camps
- [ ] Create donation history API
- [ ] Update donor donation history
- [ ] Integrate donation history with eligibility

---

# 🟢 Analytics

- [ ] Donor statistics
- [ ] Donation statistics
- [ ] Blood group statistics
- [ ] Camp statistics
- [ ] Registration statistics
- [ ] Organizer statistics
- [ ] Donation trends
- [ ] Admin analytics dashboard

---

# 🔵 Frontend

## General

- [ ] Connect frontend to backend APIs
- [ ] Configure API base URL
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add authentication state
- [ ] Protect frontend routes

## Pages

- [ ] Landing page
- [ ] Registration page
- [ ] Login page
- [ ] User dashboard
- [ ] User profile
- [ ] Eligibility page
- [ ] Camp discovery
- [ ] Camp details
- [ ] Camp registration
- [ ] Donation history
- [ ] Notifications
- [ ] Organizer dashboard
- [ ] Analytics dashboard

---

# ⚙️ Security

- [ ] Secure password storage
- [ ] JWT security
- [ ] Authentication middleware
- [ ] Authorization
- [ ] Input validation
- [ ] API error handling
- [ ] Protect sensitive user data
- [ ] Remove sensitive fields from API responses
- [ ] Verify `.env` is ignored
- [ ] Audit exposed secrets
- [ ] Review API security before deployment

---

# 🧪 Testing

## Backend

- [ ] Test user registration
- [ ] Test duplicate email
- [ ] Test duplicate phone
- [ ] Test `GET /users`
- [ ] Test `GET /users/:id`
- [ ] Test update user
- [ ] Test delete user
- [ ] Test authentication
- [ ] Test authorization
- [ ] Test camp APIs
- [ ] Test camp registration
- [ ] Test matching engine

## Frontend

- [ ] Test registration flow
- [ ] Test login flow
- [ ] Test profile flow
- [ ] Test camp discovery
- [ ] Test camp registration
- [ ] Test organizer workflow

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