/**
 * REDhope Frontend Workflows Integration Test Suite
 * 
 * Accurately simulates the 6 core client workflows:
 * 1. Test registration flow (Client registration, client validation, auto-login)
 * 2. Test login flow (Credentials check, role routing to /admin, /organizer, /dashboard, session check)
 * 3. Test profile flow (Profile retrieval, medical eligibility advisory, updates via PUT /auth/me)
 * 4. Test camp discovery (Public list, city/state filters, geospatial nearby discovery)
 * 5. Test camp registration (Camp details, atomic slot booking, 409 duplicate check, cancellation)
 * 6. Test organizer workflow (Camp creation, hosted camp management, registration roster, status update)
 */

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { setupTestServer, teardownTestServer, clearTestDatabase, request } = require("./test_helper");

describe("Frontend Client Workflows & Flow Verification", () => {
    let serverData;

    before(async () => {
        serverData = await setupTestServer();
    });

    after(async () => {
        await teardownTestServer();
    });

    beforeEach(async () => {
        await clearTestDatabase();
    });

    // Helper to simulate frontend registration flow: register + login
    async function registerAndLogin(payload) {
        const regRes = await request("/auth/register", {
            method: "POST",
            body: payload
        });
        if (!regRes.ok) {
            return { regRes, loginRes: null, token: null, user: null };
        }

        const loginRes = await request("/auth/login", {
            method: "POST",
            body: { email: payload.email, password: payload.password }
        });

        return {
            regRes,
            loginRes,
            token: loginRes.body?.token,
            user: loginRes.body?.user
        };
    }

    // ==========================================
    // 1. REGISTRATION FLOW
    // ==========================================
    describe("1. Registration Flow", () => {
        test("should successfully register a voluntary blood donor, sanitize output, and complete auto-login", async () => {
            const donorPayload = {
                name: "Aman Donor",
                email: "aman.donor@redhope.test",
                password: "SecurePassword123!",
                phone: "9876543210",
                bloodGroup: "O+",
                role: "user",
                isDonorAvailable: true
            };

            // Step 1: Register
            const regRes = await request("/auth/register", {
                method: "POST",
                body: donorPayload
            });

            assert.equal(regRes.status, 201, "Registration should return 201 Created");
            assert.equal(regRes.body.success, true, "Response should indicate success");
            assert.equal(regRes.body.data.email, donorPayload.email);
            assert.equal(regRes.body.data.bloodGroup, "O+");
            assert.equal(regRes.body.data.role, "user");
            assert.equal(regRes.body.data.isDonorAvailable, true);
            assert.equal(regRes.body.data.password, undefined, "Password hash must never be returned");

            // Step 2: Auto-login (as performed by RegisterPage in src/routes/register.tsx)
            const loginRes = await request("/auth/login", {
                method: "POST",
                body: { email: donorPayload.email, password: donorPayload.password }
            });

            assert.equal(loginRes.status, 200);
            assert.ok(loginRes.body.token, "Auto-login must return valid JWT session token");
            assert.equal(loginRes.body.user.role, "user");
        });

        test("should successfully register a camp organizer account and assign organizer role", async () => {
            const organizerPayload = {
                name: "Red Cross Organizer",
                email: "organizer@redhope.test",
                password: "SecurePassword123!",
                phone: "9876543211",
                bloodGroup: "A+",
                role: "organizer",
                isDonorAvailable: false
            };

            const regRes = await request("/auth/register", {
                method: "POST",
                body: organizerPayload
            });

            assert.equal(regRes.status, 201);
            assert.equal(regRes.body.success, true);
            assert.equal(regRes.body.data.role, "organizer");
        });

        test("should enforce client validation rules: reject duplicate email with 400", async () => {
            const userPayload = {
                name: "Duplicate User",
                email: "duplicate@redhope.test",
                password: "Password123!",
                phone: "9876543212",
                bloodGroup: "B+"
            };

            const firstRes = await request("/auth/register", { method: "POST", body: userPayload });
            assert.equal(firstRes.status, 201);

            const duplicateRes = await request("/auth/register", {
                method: "POST",
                body: { ...userPayload, phone: "9876543213" }
            });
            assert.equal(duplicateRes.status, 400, "Duplicate email must be rejected");
            assert.match(duplicateRes.body.message, /already exist/i);
        });

        test("should enforce client validation rules: reject invalid phone number", async () => {
            const invalidPhonePayload = {
                name: "Invalid Phone User",
                email: "invalid.phone@redhope.test",
                password: "Password123!",
                phone: "12345", // invalid format
                bloodGroup: "AB+"
            };

            const res = await request("/auth/register", { method: "POST", body: invalidPhonePayload });
            assert.equal(res.status, 400);
            assert.match(res.body.message, /phone/i);
        });
    });

    // ==========================================
    // 2. LOGIN FLOW
    // ==========================================
    describe("2. Login Flow", () => {
        beforeEach(async () => {
            // Seed a donor and organizer
            await request("/auth/register", {
                method: "POST",
                body: {
                    name: "Donor User",
                    email: "donor@redhope.test",
                    password: "Password123!",
                    phone: "9876543220",
                    bloodGroup: "O-",
                    role: "user"
                }
            });

            await request("/auth/register", {
                method: "POST",
                body: {
                    name: "Camp Organizer",
                    email: "organizer@redhope.test",
                    password: "Password123!",
                    phone: "9876543221",
                    bloodGroup: "A+",
                    role: "organizer"
                }
            });
        });

        test("should login donor, return JWT token, and determine user dashboard redirect", async () => {
            const res = await request("/auth/login", {
                method: "POST",
                body: { email: "donor@redhope.test", password: "Password123!" }
            });

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.ok(res.body.token, "JWT token must be present");
            assert.equal(res.body.user.role, "user");

            // Verify frontend routing decision: user role routes to /dashboard
            const expectedRoute = res.body.user.role === "organizer" ? "/organizer" : "/dashboard";
            assert.equal(expectedRoute, "/dashboard");
        });

        test("should login organizer and determine /organizer portal redirect", async () => {
            const res = await request("/auth/login", {
                method: "POST",
                body: { email: "organizer@redhope.test", password: "Password123!" }
            });

            assert.equal(res.status, 200);
            assert.equal(res.body.user.role, "organizer");

            // Verify frontend routing decision: organizer role routes to /organizer
            const expectedRoute = res.body.user.role === "organizer" ? "/organizer" : "/dashboard";
            assert.equal(expectedRoute, "/organizer");
        });

        test("should reject login with wrong password (401 Unauthorized)", async () => {
            const res = await request("/auth/login", {
                method: "POST",
                body: { email: "donor@redhope.test", password: "WrongPassword999!" }
            });

            assert.equal(res.status, 401);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /invalid credentials/i);
        });

        test("should verify active session via GET /auth/me using JWT token", async () => {
            const loginRes = await request("/auth/login", {
                method: "POST",
                body: { email: "donor@redhope.test", password: "Password123!" }
            });
            const token = loginRes.body.token;

            const meRes = await request("/auth/me", { token });
            assert.equal(meRes.status, 200);
            assert.equal(meRes.body.success, true);
            assert.equal(meRes.body.user.email, "donor@redhope.test");
        });
    });

    // ==========================================
    // 3. PROFILE FLOW
    // ==========================================
    describe("3. Profile Flow", () => {
        let token;

        beforeEach(async () => {
            const auth = await registerAndLogin({
                name: "Rahul Verma",
                email: "rahul@redhope.test",
                password: "Password123!",
                phone: "9876543230",
                bloodGroup: "B+",
                role: "user",
                isDonorAvailable: true
            });
            token = auth.token;
        });

        test("should fetch user profile and populate profile view fields via GET /auth/me", async () => {
            const res = await request("/auth/me", { token });

            assert.equal(res.status, 200);
            assert.equal(res.body.user.name, "Rahul Verma");
            assert.equal(res.body.user.bloodGroup, "B+");
            assert.equal(res.body.user.phone, "9876543230");
            assert.equal(res.body.user.isDonorAvailable, true);
        });

        test("should fetch donor medical eligibility advisory via GET /eligibility/me", async () => {
            const res = await request("/eligibility/me", { token });

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.ok(res.body.data);
            assert.equal(typeof res.body.data.isMedicallyEligible, "boolean");
        });

        test("should update donor profile data and location coordinates via PUT /auth/me", async () => {
            const updatePayload = {
                name: "Rahul S. Verma",
                phone: "9876543231",
                bloodGroup: "B+",
                gender: "male",
                dateOfBirth: "1998-05-15",
                isDonorAvailable: true,
                emailNotifications: true,
                location: {
                    type: "Point",
                    coordinates: [77.5946, 12.9716], // Bangalore
                    city: "Bangalore",
                    state: "Karnataka",
                    pincode: "560001"
                }
            };

            const updateRes = await request("/auth/me", {
                method: "PUT",
                token,
                body: updatePayload
            });

            assert.equal(updateRes.status, 200, "Profile update must return 200 OK");
            assert.equal(updateRes.body.success, true);
            assert.equal(updateRes.body.user.name, "Rahul S. Verma");
            assert.equal(updateRes.body.user.phone, "9876543231");
            assert.equal(updateRes.body.user.location.city, "Bangalore");
            assert.deepEqual(updateRes.body.user.location.coordinates, [77.5946, 12.9716]);

            // Re-fetch to ensure database persistence
            const refetchRes = await request("/auth/me", { token });
            assert.equal(refetchRes.body.user.name, "Rahul S. Verma");
            assert.equal(refetchRes.body.user.location.city, "Bangalore");
        });
    });

    // ==========================================
    // 4. CAMP DISCOVERY FLOW
    // ==========================================
    describe("4. Camp Discovery Flow", () => {
        let organizerToken;

        beforeEach(async () => {
            const auth = await registerAndLogin({
                name: "Discovery Host",
                email: "host.discovery@redhope.test",
                password: "Password123!",
                phone: "9876543240",
                bloodGroup: "O+",
                role: "organizer"
            });
            organizerToken = auth.token;

            // Create a published camp in Mumbai
            await request("/camps", {
                method: "POST",
                token: organizerToken,
                body: {
                    name: "Mumbai Central Blood Drive",
                    description: "Annual university blood donation drive",
                    startDate: new Date(Date.now() + 86400000).toISOString(),
                    endDate: new Date(Date.now() + 172800000).toISOString(),
                    startTime: "09:00",
                    endTime: "17:00",
                    capacity: 100,
                    location: {
                        address: "CSMT Station Plaza",
                        city: "Mumbai",
                        state: "Maharashtra",
                        pincode: "400001",
                        coordinates: [72.8353, 18.9401]
                    },
                    status: "published"
                }
            });

            // Create a published camp in Pune
            await request("/camps", {
                method: "POST",
                token: organizerToken,
                body: {
                    name: "Pune Tech Park Blood Camp",
                    description: "Corporate drive",
                    startDate: new Date(Date.now() + 86400000).toISOString(),
                    endDate: new Date(Date.now() + 172800000).toISOString(),
                    startTime: "10:00",
                    endTime: "18:00",
                    capacity: 50,
                    location: {
                        address: "Hinjawadi Phase 1",
                        city: "Pune",
                        state: "Maharashtra",
                        pincode: "411057",
                        coordinates: [73.7297, 18.5913]
                    },
                    status: "published"
                }
            });
        });

        test("should fetch list of published blood donation camps via GET /camps", async () => {
            const res = await request("/camps");

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.ok(Array.isArray(res.body.camps));
            assert.equal(res.body.camps.length, 2);
            assert.equal(res.body.camps[0].status, "published");
        });

        test("should filter camps by city filter query parameter", async () => {
            const res = await request("/camps?city=Mumbai");

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.camps.length, 1);
            assert.equal(res.body.camps[0].name, "Mumbai Central Blood Drive");
            assert.equal(res.body.camps[0].location.city, "Mumbai");
        });

        test("should perform geospatial nearby camp discovery (/camps/nearby)", async () => {
            // Query near Mumbai coordinates [72.83, 18.94] within 25 km
            const res = await request("/camps/nearby?longitude=72.83&latitude=18.94&radiusKm=25");

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.ok(Array.isArray(res.body.camps));
            assert.equal(res.body.camps.length, 1);
            assert.equal(res.body.camps[0].name, "Mumbai Central Blood Drive");
            assert.ok(typeof res.body.camps[0].distanceMeters === "number");
        });
    });

    // ==========================================
    // 5. CAMP REGISTRATION FLOW
    // ==========================================
    describe("5. Camp Registration Flow", () => {
        let organizerToken;
        let donorToken;
        let campId;

        beforeEach(async () => {
            // 1. Create organizer and camp with capacity of 2
            const orgAuth = await registerAndLogin({
                name: "Host Org",
                email: "org.reg@redhope.test",
                password: "Password123!",
                phone: "9876543250",
                bloodGroup: "O+",
                role: "organizer"
            });
            organizerToken = orgAuth.token;

            const campRes = await request("/camps", {
                method: "POST",
                token: organizerToken,
                body: {
                    name: "Limited Capacity Drive",
                    startDate: new Date(Date.now() + 86400000).toISOString(),
                    endDate: new Date(Date.now() + 172800000).toISOString(),
                    startTime: "09:00",
                    endTime: "17:00",
                    capacity: 2,
                    location: {
                        address: "City Hall",
                        city: "Delhi",
                        state: "Delhi",
                        pincode: "110001",
                        coordinates: [77.2090, 28.6139]
                    },
                    status: "published"
                }
            });
            campId = campRes.body.camp._id;

            // 2. Create donor
            const donorAuth = await registerAndLogin({
                name: "Priya Sharma",
                email: "priya@redhope.test",
                password: "Password123!",
                phone: "9876543251",
                bloodGroup: "A+",
                role: "user"
            });
            donorToken = donorAuth.token;
        });

        test("should fetch camp details by ID via GET /camps/:campId", async () => {
            const res = await request(`/camps/${campId}`);

            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.camp.name, "Limited Capacity Drive");
            assert.equal(res.body.camp.capacity, 2);
            assert.equal(res.body.camp.registrationCount, 0);
        });

        test("should check registration status for unregistered donor (404 / null)", async () => {
            const res = await request(`/camps/${campId}/registrations/me`, { token: donorToken });
            assert.equal(res.status, 404, "Unregistered donor returns 404");
        });

        test("should atomically register donor for camp and increment registrationCount", async () => {
            const regRes = await request(`/camps/${campId}/register`, {
                method: "POST",
                token: donorToken
            });

            assert.equal(regRes.status, 201, "Registration succeeds with 201 Created");
            assert.equal(regRes.body.success, true);
            assert.equal(regRes.body.data.registration.status, "registered");

            // Verify camp count incremented to 1
            const campRes = await request(`/camps/${campId}`);
            assert.equal(campRes.body.camp.registrationCount, 1);

            // Verify registrations/me now returns active registration
            const checkRes = await request(`/camps/${campId}/registrations/me`, { token: donorToken });
            assert.equal(checkRes.status, 200);
            assert.equal(checkRes.body.data.registration.status, "registered");
        });

        test("should reject duplicate registration for the same donor with 409 Conflict", async () => {
            await request(`/camps/${campId}/register`, { method: "POST", token: donorToken });

            const dupRes = await request(`/camps/${campId}/register`, {
                method: "POST",
                token: donorToken
            });

            assert.equal(dupRes.status, 409, "Duplicate registration must return 409 Conflict");
            assert.match(dupRes.body.message, /already registered/i);
        });

        test("should cancel camp registration and decrement registrationCount", async () => {
            await request(`/camps/${campId}/register`, { method: "POST", token: donorToken });

            const cancelRes = await request(`/camps/${campId}/register`, {
                method: "DELETE",
                token: donorToken
            });

            assert.equal(cancelRes.status, 200);
            assert.equal(cancelRes.body.success, true);

            // Verify camp count decremented back to 0
            const campRes = await request(`/camps/${campId}`);
            assert.equal(campRes.body.camp.registrationCount, 0);
        });
    });

    // ==========================================
    // 6. ORGANIZER WORKFLOW
    // ==========================================
    describe("6. Organizer Workflow", () => {
        let organizerToken;
        let donorToken;

        beforeEach(async () => {
            const orgAuth = await registerAndLogin({
                name: "Apex Healthcare Trust",
                email: "apex.org@redhope.test",
                password: "Password123!",
                phone: "9876543260",
                bloodGroup: "O+",
                role: "organizer"
            });
            organizerToken = orgAuth.token;

            const donorAuth = await registerAndLogin({
                name: "Anand Kumar",
                email: "anand@redhope.test",
                password: "Password123!",
                phone: "9876543261",
                bloodGroup: "B-",
                role: "user"
            });
            donorToken = donorAuth.token;
        });

        test("should allow organizer to create a new blood donation camp via POST /camps", async () => {
            const newCamp = {
                name: "Apex Community Blood Drive",
                description: "Full day voluntary blood camp",
                startDate: new Date(Date.now() + 86400000).toISOString(),
                endDate: new Date(Date.now() + 172800000).toISOString(),
                startTime: "09:00",
                endTime: "17:00",
                capacity: 75,
                location: {
                    address: "Sector 18 Community Center",
                    city: "Noida",
                    state: "Uttar Pradesh",
                    pincode: "201301",
                    coordinates: [77.3218, 28.5708]
                },
                status: "published"
            };

            const res = await request("/camps", {
                method: "POST",
                token: organizerToken,
                body: newCamp
            });

            assert.equal(res.status, 201);
            assert.equal(res.body.success, true);
            assert.equal(res.body.camp.name, newCamp.name);
            assert.equal(res.body.camp.capacity, 75);
        });

        test("should retrieve organizer's hosted camps via GET /camps?status=all", async () => {
            // Create a camp first
            await request("/camps", {
                method: "POST",
                token: organizerToken,
                body: {
                    name: "Hosted Camp One",
                    startDate: new Date(Date.now() + 86400000).toISOString(),
                    endDate: new Date(Date.now() + 172800000).toISOString(),
                    startTime: "09:00",
                    endTime: "17:00",
                    capacity: 50,
                    location: {
                        address: "Main Hall",
                        city: "Noida",
                        state: "Uttar Pradesh",
                        pincode: "201301",
                        coordinates: [77.3218, 28.5708]
                    },
                    status: "published"
                }
            });

            const res = await request("/camps?status=all", { token: organizerToken });
            assert.equal(res.status, 200);
            assert.equal(res.body.success, true);
            assert.ok(res.body.camps.length >= 1);
            assert.equal(res.body.camps[0].name, "Hosted Camp One");
        });

        test("should allow host organizer to view registered donors roster via GET /camps/:campId/registrations", async () => {
            // 1. Create camp
            const campRes = await request("/camps", {
                method: "POST",
                token: organizerToken,
                body: {
                    name: "Roster Test Camp",
                    startDate: new Date(Date.now() + 86400000).toISOString(),
                    endDate: new Date(Date.now() + 172800000).toISOString(),
                    startTime: "09:00",
                    endTime: "17:00",
                    capacity: 50,
                    location: {
                        address: "Hall 2",
                        city: "Noida",
                        state: "Uttar Pradesh",
                        pincode: "201301",
                        coordinates: [77.3218, 28.5708]
                    },
                    status: "published"
                }
            });
            const createdCampId = campRes.body.camp._id;

            // 2. Donor registers
            await request(`/camps/${createdCampId}/register`, {
                method: "POST",
                token: donorToken
            });

            // 3. Organizer views roster
            const rosterRes = await request(`/camps/${createdCampId}/registrations`, {
                token: organizerToken
            });

            assert.equal(rosterRes.status, 200);
            assert.equal(rosterRes.body.success, true);
            assert.equal(rosterRes.body.data.count, 1);
            assert.equal(rosterRes.body.data.registrations[0].user.name, "Anand Kumar");
            assert.equal(rosterRes.body.data.registrations[0].user.bloodGroup, "B-");
        });

        test("should allow organizer to update camp status (e.g. cancel camp)", async () => {
            const campRes = await request("/camps", {
                method: "POST",
                token: organizerToken,
                body: {
                    name: "Status Test Camp",
                    startDate: new Date(Date.now() + 86400000).toISOString(),
                    endDate: new Date(Date.now() + 172800000).toISOString(),
                    startTime: "09:00",
                    endTime: "17:00",
                    capacity: 50,
                    location: {
                        address: "Hall 3",
                        city: "Noida",
                        state: "Uttar Pradesh",
                        pincode: "201301",
                        coordinates: [77.3218, 28.5708]
                    },
                    status: "published"
                }
            });
            const createdCampId = campRes.body.camp._id;

            const updateRes = await request(`/camps/${createdCampId}`, {
                method: "PUT",
                token: organizerToken,
                body: { status: "cancelled" }
            });

            assert.equal(updateRes.status, 200);
            assert.equal(updateRes.body.camp.status, "cancelled");
        });
    });
});
