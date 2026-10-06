# REDhope Changelog

All notable changes to the REDhope project are documented here.

The changelog tracks meaningful development progress, completed features,
important fixes, architecture changes, and security improvements.

---

# [Unreleased]

Changes currently being developed.

## In Progress

- Complete User CRUD
- Implement `GET /users/:id`
- Implement `PUT /users/:id`
- Implement `DELETE /users/:id`

---

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
POST /test
GET  /users
## Backend Foundation 

- Fixed duplicate PORT declaration.
- Fixed controller import filename casing.
- Standardized `bloodGroup` naming.
- Added duplicate phone detection.
- Added email format validation.
- Prevented passwords from being returned in registration responses.
- Added MongoDB duplicate-key error handling.
- Verified backend syntax and server startup.