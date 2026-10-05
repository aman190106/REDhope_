
# REDhope - AI Agent Development Instructions

## 1. Project Overview

REDhope is a blood donation and blood donation camp management platform.

The goal is to build a production-ready web application that helps:

- Donors register and manage their profiles
- Users determine blood donation eligibility
- Donors discover nearby blood donation camps
- Users register for donation camps
- Organizers create and manage camps
- Organizers manage registered donors
- Match blood requirements with suitable donors
- Track donations
- Send notifications
- Provide analytics and dashboards

The project should prioritize:

1. Correctness
2. Security
3. Maintainability
4. Scalability
5. Clean architecture
6. Good user experience

Do not sacrifice correctness simply to finish a feature faster.

---

# 2. Existing Technology Stack

Use the technologies already present in the repository.

## Frontend

Expected technologies may include:

- React
- JavaScript
- HTML
- CSS
- Tailwind CSS / Bootstrap / Material UI where already used

Do not introduce a new frontend framework unless explicitly requested.

## Backend

- Node.js
- Express.js

## Database

- MongoDB Atlas
- Mongoose

## Development Tools

- Git
- GitHub
- VS Code
- npm
- Postman for API testing

---

# 3. Architecture

The backend follows this architecture:

Routes
    ↓
Controllers
    ↓
Models
    ↓
MongoDB

Keep responsibilities separated.

## Routes

Routes should:

- Define API endpoints
- Connect endpoints to controllers
- Handle route parameters
- Avoid containing business logic

Example:

```js
router.get("/users", getAllUsers);
Do not rename this simply for stylistic reasons.
Before creating or modifying files:
1. Inspect the existing project.
2. Find related routes/controllers/models.
3. Reuse existing code where appropriate.
4. Do not assume a file exists without checking.
Development Rules
Before implementing a feature:
1. Inspect the relevant code.
2. Explain the implementation plan briefly.
3. Identify the files that need modification.
4. Implement the smallest correct solution.
5. Test the feature.
6. Review the changes.
Do not rewrite unrelated code.
Do not perform large refactors unless explicitly requested.
Do not introduce unnecessary abstractions or dependencies.
Prefer simple, readable, maintainable code.
API Rules
Prefer RESTful conventions:
GET     /users
GET     /users/:id
POST    /users
PUT     /users/:id
DELETE  /users/:id

Use appropriate HTTP status codes.
Handle:
- Invalid input
- Missing data
- Duplicate records
- Invalid MongoDB ObjectIds
- Non-existent records
- Database errors
Maintain the existing API response format when modifying existing endpoints.
Security
Never expose:
- Passwords
- MongoDB credentials
- API keys
- JWT secrets
- Other private credentials
Never commit .env.
Use environment variables for secrets.
Passwords must never be stored or returned in plaintext once authentication is implemented.
Never put backend secrets in frontend code.
Database
Use Mongoose for MongoDB operations.
Prefer existing Mongoose methods such as:
find()
findById()
findOne()
create()
findByIdAndUpdate()
findByIdAndDelete()

Do not bypass the existing database architecture without a clear reason.
Git
Before making changes:
git status

Do not:
- Force push
- Delete branches without permission
- Reset/revert user work without permission
- Overwrite unrelated uncommitted changes
- Commit .env or secrets
Review the Git diff before considering a significant feature complete.
Testing
Do not claim a feature is complete merely because the code was written.
Test relevant functionality.
For APIs, test:
- Successful requests
- Invalid requests
- Missing data
- Non-existent records
- Invalid IDs
- Duplicate records where applicable
Use the project's existing testing tools such as Postman when appropriate.
REDhope Roadmap
The project is being developed approximately in this order:
1. Backend foundation
2. User CRUD
3. Authentication
4. User profiles
5. Blood donation eligibility
6. Camp discovery
7. Camp registration
8. Organizer dashboard
9. Blood donor matching
10. Notifications
11. Donation tracking
12. Analytics
Do not implement future phases unless requested.
AI Agent Behavior
You are an implementation agent, but you must preserve developer control.
When given a task:
1. Understand the requirement.
2. Inspect the repository.
3. Plan the change.
4. Implement it.
5. Test it.
6. Review the diff.
7. Report what changed.
After completing a task, report:
Changed files
List the files modified and what changed.
Testing
List what was actually tested.
Notes
Mention remaining issues, limitations, or anything requiring manual testing.
Never claim that something was tested if it was not actually tested.
Core Principle
Move quickly without destroying the existing project.
Prefer:
- Existing architecture
- Existing conventions
- Minimal changes
- Simple solutions
- Secure implementation
- Tested code
Do not rewrite working parts of REDhope just to use a different architecture or technology.
