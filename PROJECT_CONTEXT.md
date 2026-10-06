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
PUT  /users/:id   Update       ⬜
DELETE /users/:id Delete       ⬜
```

The next immediate backend task is completing User CRUD.

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

# 10. Authentication Roadmap

Authentication has not yet been fully implemented.

Planned authentication functionality:

- Password hashing
- Login
- JWT authentication
- Authentication middleware
- Protected routes
- Authorization
- User roles

Potential roles may include:

```text
Donor/User
Organizer
Admin
```

Do not implement role-specific functionality until the authentication architecture is established.

---

# 11. Future User Profile

After authentication, users should eventually have profiles containing relevant donor information.

Potential profile information includes:

- Name
- Email
- Phone
- Blood group
- Date of birth / age where required
- Location
- Donation history
- Eligibility status
- Profile information

Only collect information that is actually required by the application.

---

# 12. Blood Donation Eligibility

REDhope will eventually contain an eligibility engine.

The eligibility engine should determine whether a donor can currently donate based on the application's defined rules.

Eligibility logic should be centralized.

Do not duplicate the same eligibility rules across multiple controllers or frontend components.

The final eligibility rules should be explicitly defined before implementation.

---

# 13. Blood Donation Camps

A major REDhope feature is blood donation camp management.

Planned functionality:

### Camp discovery

Users should eventually be able to:

- View camps
- Search camps
- Filter camps
- View camp details
- Find nearby camps

### Camp registration

Users should be able to:

- Register for a camp
- View registration status
- Cancel registration where allowed
- Prevent duplicate registrations

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