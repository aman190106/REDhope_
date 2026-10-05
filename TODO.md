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
- [ ] `GET /users/:id`
- [ ] `PUT /users/:id`
- [ ] `DELETE /users/:id`

---

# 🟠 Authentication

- [ ] Design authentication flow
- [ ] Add password hashing with bcrypt
- [ ] Update registration to securely store passwords
- [ ] Implement login
- [ ] Implement JWT authentication
- [ ] Create authentication middleware
- [ ] Protect private routes
- [ ] Implement authorization
- [ ] Define user roles
- [ ] Test authentication and authorization

---

# 🟡 User Profiles

- [ ] Create user profile structure
- [ ] Add blood group
- [ ] Add location information
- [ ] Add donor information
- [ ] Add profile update API
- [ ] Add profile retrieval API
- [ ] Connect profile with authentication
- [ ] Build frontend profile page

---

# 🟢 Blood Donation Eligibility

- [ ] Define eligibility rules
- [ ] Design eligibility data structure
- [ ] Implement eligibility engine
- [ ] Create eligibility API
- [ ] Connect eligibility engine with donor profiles
- [ ] Add frontend eligibility interface
- [ ] Test eligibility edge cases

---

# 🔵 Blood Donation Camps

## Camp Backend

- [ ] Create Camp model
- [ ] Create camp controller
- [ ] Create camp routes
- [ ] Create camp API
- [ ] Add camp validation
- [ ] Implement create camp
- [ ] Implement get camps
- [ ] Implement get camp by ID
- [ ] Implement update camp
- [ ] Implement delete/cancel camp

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