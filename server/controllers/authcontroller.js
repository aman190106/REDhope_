const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const user = require("../models/user");
const HealthScreening = require("../models/healthScreening");

const SALT_ROUNDS = 10;

const emailRegex = /^\S+@\S+\.\S+$/;
const phoneRegex = /^[6-9]\d{9}$/;
const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const sanitizeUser = (doc) => {
    const obj = doc.toObject ? doc.toObject() : { ...doc };
    delete obj.password;
    return obj;
};

const isAdmin = (req) => req.user && req.user.role === "admin";

const isSelf = (req, id) => req.user && req.user.id === id.toString();

// ─────────────────────────────────────────────
// POST /auth/register
// ─────────────────────────────────────────────

const registerUser = async (req, res) => {
    try {
        const { name, email, password, phone, bloodGroup, role, isDonorAvailable } = req.body;

        if (!name || !email || !password || !phone || !bloodGroup) {
            return res.status(400).json({
                success: false,
                message: "all fields are required"
            });
        }

        if (typeof password !== "string" || password.trim().length < 6) {
            return res.status(400).json({
                success: false,
                message: "password must be at least 6 characters"
            });
        }

        if (typeof email !== "string" || !emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "invalid email format"
            });
        }

        if (typeof phone !== "string" || !phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "invalid phone number"
            });
        }

        const normalizedBloodGroup = typeof bloodGroup === "string" ? bloodGroup.toUpperCase().trim() : "";
        if (!VALID_BLOOD_GROUPS.includes(normalizedBloodGroup)) {
            return res.status(400).json({
                success: false,
                message: "invalid blood group"
            });
        }

        const existingEmailUser = await user.findOne({ email });
        if (existingEmailUser) {
            return res.status(400).json({
                success: false,
                message: "mail id already exist"
            });
        }

        const existingPhoneUser = await user.findOne({ phone });
        if (existingPhoneUser) {
            return res.status(400).json({
                success: false,
                message: "phone number already exist"
            });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const userPayload = {
            name,
            email,
            password: hashedPassword,
            phone,
            bloodGroup: normalizedBloodGroup
        };

        if (role === "organizer") {
            userPayload.role = "organizer";
        }
        if (typeof isDonorAvailable === "boolean") {
            userPayload.isDonorAvailable = isDonorAvailable;
        }

        const newUser = await user.create(userPayload);

        return res.status(201).json({
            success: true,
            message: "user registered successfully",
            data: sanitizeUser(newUser)
        });
    } catch (error) {
        console.log(error);

        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];
            const message = duplicateField === "phone"
                ? "phone number already exist"
                : "mail id already exist";

            return res.status(400).json({ success: false, message });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "email and password are required"
            });
        }

        if (typeof email !== "string" || typeof password !== "string") {
            return res.status(400).json({
                success: false,
                message: "invalid input format"
            });
        }

        const foundUser = await user.findOne({ email: email.trim() });
        if (!foundUser) {
            return res.status(401).json({
                success: false,
                message: "invalid credentials"
            });
        }

        const isMatch = await bcrypt.compare(password, foundUser.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "invalid credentials"
            });
        }

        const jwtSecret = process.env.JWT_SECRET;
        const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";

        if (!jwtSecret) {
            console.error("JWT_SECRET is not set");
            return res.status(500).json({
                success: false,
                message: "internal server error"
            });
        }

        const token = jwt.sign(
            {
                id: foundUser._id,
                email: foundUser.email,
                role: foundUser.role
            },
            jwtSecret,
            { expiresIn: jwtExpiresIn }
        );

        return res.status(200).json({
            success: true,
            message: "login successful",
            token,
            user: sanitizeUser(foundUser)
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// GET /auth/me
// ─────────────────────────────────────────────

const getMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const foundUser = await user.findById(userId).select("-password");

        if (!foundUser) {
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }

        return res.status(200).json({
            success: true,
            user: foundUser
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// PUT /auth/me
// ─────────────────────────────────────────────

const updateMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const existingUser = await user.findById(userId);

        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }

        const {
            name,
            email,
            phone,
            bloodGroup,
            password,
            dateOfBirth,
            gender,
            location,
            isDonorAvailable,
            emailNotifications,
            notificationRadiusKm,
            role,
            isEligible,
            lastDonationDate
        } = req.body;

        // Disallow modification of system/admin fields by normal user
        if (role !== undefined) {
            return res.status(403).json({
                success: false,
                message: "you cannot change your role"
            });
        }

        if (isEligible !== undefined) {
            return res.status(403).json({
                success: false,
                message: "you cannot modify eligibility status directly"
            });
        }

        if (lastDonationDate !== undefined) {
            return res.status(403).json({
                success: false,
                message: "you cannot modify last donation date directly"
            });
        }

        if (email !== undefined) {
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "invalid email format"
                });
            }

            const emailExists = await user.findOne({ email, _id: { $ne: userId } });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: "mail id already exist"
                });
            }
        }

        if (phone !== undefined) {
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: "invalid phone number"
                });
            }

            const phoneExists = await user.findOne({ phone, _id: { $ne: userId } });
            if (phoneExists) {
                return res.status(400).json({
                    success: false,
                    message: "phone number already exist"
                });
            }
        }

        if (bloodGroup !== undefined) {
            const normalized = bloodGroup.toUpperCase().trim();
            if (!VALID_BLOOD_GROUPS.includes(normalized)) {
                return res.status(400).json({
                    success: false,
                    message: "invalid blood group"
                });
            }
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup.toUpperCase().trim();
        if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
        if (gender !== undefined) updateData.gender = gender;
        if (location !== undefined) {
            const locData = { ...location };
            if (locData.coordinates && locData.coordinates.length > 0) {
                locData.type = "Point";
            }
            updateData.location = locData;
        }
        if (isDonorAvailable !== undefined) updateData.isDonorAvailable = isDonorAvailable;
        if (emailNotifications !== undefined) updateData.emailNotifications = Boolean(emailNotifications);
        if (notificationRadiusKm !== undefined) {
            const parsedRadius = Number(notificationRadiusKm);
            if (!Number.isFinite(parsedRadius) || parsedRadius < 1 || parsedRadius > 200) {
                return res.status(400).json({
                    success: false,
                    message: "notification radius must be a number between 1 and 200 km"
                });
            }
            updateData.notificationRadiusKm = Math.round(parsedRadius);
        }

        if (password !== undefined) {
            if (typeof password !== "string" || password.trim().length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "password must be at least 6 characters"
                });
            }
            updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
        }

        const updatedUser = await user.findByIdAndUpdate(
            userId,
            updateData,
            { returnDocument: "after", runValidators: true }
        ).select("-password");

        return res.status(200).json({
            success: true,
            message: "profile updated",
            user: updatedUser
        });
    } catch (error) {
        console.log(error);

        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];
            const message = duplicateField === "phone"
                ? "phone number already exist"
                : "mail id already exist";

            return res.status(400).json({ success: false, message });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// GET /users (admin only)
// ─────────────────────────────────────────────

const getAllUsers = async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: "access denied: administrative access required"
            });
        }

        const {
            page = 1,
            limit = 15,
            search = "",
            role = "",
            bloodGroup = "",
            isEligible = "",
            screeningStatus = "",
            sortBy = "createdAt",
            sortOrder = "desc"
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
        const skip = (pageNum - 1) * limitNum;

        const query = {};

        if (role && role !== "all") {
            query.role = role;
        }

        if (bloodGroup && bloodGroup !== "all") {
            query.bloodGroup = bloodGroup.toUpperCase().trim();
        }

        if (isEligible !== undefined && isEligible !== "" && isEligible !== "all") {
            query.isEligible = isEligible === "true" || isEligible === true;
        }

        if (search && search.trim()) {
            const trimmed = search.trim();
            if (mongoose.Types.ObjectId.isValid(trimmed)) {
                query.$or = [
                    { _id: new mongoose.Types.ObjectId(trimmed) },
                    { name: { $regex: trimmed, $options: "i" } },
                    { email: { $regex: trimmed, $options: "i" } }
                ];
            } else {
                const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                query.$or = [
                    { name: { $regex: escaped, $options: "i" } },
                    { email: { $regex: escaped, $options: "i" } },
                    { phone: { $regex: escaped, $options: "i" } }
                ];
            }
        }

        // If screeningStatus filter is requested
        if (screeningStatus && screeningStatus !== "all") {
            if (screeningStatus === "none" || screeningStatus === "not_submitted") {
                const screenedUserIds = await HealthScreening.distinct("user");
                query._id = { $nin: screenedUserIds };
            } else {
                const matchingUserIds = await HealthScreening.find({ status: screeningStatus }).distinct("user");
                query._id = { $in: matchingUserIds };
            }
        }

        // Build sort object
        const sortObj = {};
        const allowedSortFields = ["createdAt", "name", "email", "bloodGroup", "isEligible", "lastDonationDate"];
        const field = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
        sortObj[field] = sortOrder === "asc" ? 1 : -1;

        const totalUsers = await user.countDocuments(query);
        const rawUsers = await user.find(query)
            .select("-password")
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Attach latest screening & calculated age for each user
        const userIds = rawUsers.map((u) => u._id);
        const screenings = await HealthScreening.find({ user: { $in: userIds } })
            .select("_id user status preliminaryFlags submittedAt reviewerDecision createdAt")
            .sort({ createdAt: -1 })
            .lean();

        const screeningByUser = {};
        for (const sc of screenings) {
            const uId = sc.user.toString();
            if (!screeningByUser[uId]) {
                screeningByUser[uId] = sc;
            }
        }

        const enrichedUsers = rawUsers.map((u) => {
            const uId = u._id.toString();
            const sc = screeningByUser[uId] || null;

            let age = null;
            if (u.dateOfBirth) {
                const bDate = new Date(u.dateOfBirth);
                if (!isNaN(bDate.getTime())) {
                    const today = new Date();
                    age = today.getFullYear() - bDate.getFullYear();
                    const m = today.getMonth() - bDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < bDate.getDate())) {
                        age--;
                    }
                }
            }

            return {
                ...u,
                age,
                screening: sc
                    ? {
                          _id: sc._id,
                          status: sc.status,
                          flagsCount: sc.preliminaryFlags?.length || 0,
                          submittedAt: sc.submittedAt,
                          reviewerDecision: sc.reviewerDecision?.decision || null,
                          reviewedAt: sc.reviewerDecision?.reviewedAt || null
                      }
                    : null
            };
        });

        return res.status(200).json({
            success: true,
            count: totalUsers,
            users: enrichedUsers,
            data: {
                users: enrichedUsers,
                pagination: {
                    total: totalUsers,
                    page: pageNum,
                    limit: limitNum,
                    pages: Math.ceil(totalUsers / limitNum) || 1
                }
            }
        });
    } catch (error) {
        console.error("Error in getAllUsers:", error);
        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// GET /users/:id (self or admin)
// ─────────────────────────────────────────────

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid user id"
            });
        }

        if (!isSelf(req, id) && !isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: "access denied"
            });
        }

        const foundUser = await user.findById(id).select("-password");

        if (!foundUser) {
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }

        return res.status(200).json({
            success: true,
            user: foundUser
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// PUT /users/:id (self or admin; role/eligibility admin only)
// ─────────────────────────────────────────────

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid user id"
            });
        }

        if (!isSelf(req, id) && !isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: "access denied"
            });
        }

        const existingUser = await user.findById(id);
        if (!existingUser) {
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }

        const {
            name,
            email,
            phone,
            bloodGroup,
            password,
            dateOfBirth,
            gender,
            location,
            isDonorAvailable,
            emailNotifications,
            notificationRadiusKm,
            role,
            isEligible,
            lastDonationDate
        } = req.body;

        // Disallow normal users from modifying role, isEligible, or lastDonationDate
        if (role !== undefined && !isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: "you cannot change your role"
            });
        }

        if (isEligible !== undefined && !isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: "you cannot modify eligibility status directly"
            });
        }

        if (lastDonationDate !== undefined && !isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: "you cannot modify last donation date directly"
            });
        }

        if (email !== undefined) {
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "invalid email format"
                });
            }

            const emailExists = await user.findOne({ email, _id: { $ne: id } });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: "mail id already exist"
                });
            }
        }

        if (phone !== undefined) {
            if (!phoneRegex.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: "invalid phone number"
                });
            }

            const phoneExists = await user.findOne({ phone, _id: { $ne: id } });
            if (phoneExists) {
                return res.status(400).json({
                    success: false,
                    message: "phone number already exist"
                });
            }
        }

        if (bloodGroup !== undefined) {
            const normalized = bloodGroup.toUpperCase().trim();
            if (!VALID_BLOOD_GROUPS.includes(normalized)) {
                return res.status(400).json({
                    success: false,
                    message: "invalid blood group"
                });
            }
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (bloodGroup !== undefined) updateData.bloodGroup = bloodGroup.toUpperCase().trim();
        if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
        if (gender !== undefined) updateData.gender = gender;
        if (location !== undefined) {
            const locData = { ...location };
            if (locData.coordinates && locData.coordinates.length > 0) {
                locData.type = "Point";
            }
            updateData.location = locData;
        }
        if (isDonorAvailable !== undefined) updateData.isDonorAvailable = isDonorAvailable;
        if (emailNotifications !== undefined) updateData.emailNotifications = Boolean(emailNotifications);
        if (notificationRadiusKm !== undefined) {
            const parsedRadius = Number(notificationRadiusKm);
            if (!Number.isFinite(parsedRadius) || parsedRadius < 1 || parsedRadius > 200) {
                return res.status(400).json({
                    success: false,
                    message: "notification radius must be a number between 1 and 200 km"
                });
            }
            updateData.notificationRadiusKm = Math.round(parsedRadius);
        }

        // Admin-only fields
        if (role !== undefined && isAdmin(req)) updateData.role = role;
        if (isEligible !== undefined && isAdmin(req)) updateData.isEligible = isEligible;
        if (lastDonationDate !== undefined && isAdmin(req)) updateData.lastDonationDate = lastDonationDate;

        if (password !== undefined) {
            if (typeof password !== "string" || password.trim().length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "password must be at least 6 characters"
                });
            }
            updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
        }

        const updatedUser = await user.findByIdAndUpdate(
            id,
            updateData,
            { returnDocument: "after", runValidators: true }
        ).select("-password");

        return res.status(200).json({
            success: true,
            message: "user updated",
            user: updatedUser
        });
    } catch (error) {
        console.log(error);

        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];
            const message = duplicateField === "phone"
                ? "phone number already exist"
                : "mail id already exist";

            return res.status(400).json({ success: false, message });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

// ─────────────────────────────────────────────
// DELETE /users/:id (self or admin)
// ─────────────────────────────────────────────

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid user id"
            });
        }

        if (!isSelf(req, id) && !isAdmin(req)) {
            return res.status(403).json({
                success: false,
                message: "access denied"
            });
        }

        const deletedUser = await user.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({
                success: false,
                message: "user not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "user deleted successfully"
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
    updateMe,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser
};
