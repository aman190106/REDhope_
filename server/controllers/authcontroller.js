const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const user = require("../models/user");

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
        const { name, email, password, phone, bloodGroup } = req.body;

        if (!name || !email || !password || !phone || !bloodGroup) {
            return res.status(400).json({
                success: false,
                message: "all fields are required"
            });
        }

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "invalid email format"
            });
        }

        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "invalid phone number"
            });
        }

        const normalizedBloodGroup = bloodGroup.toUpperCase().trim();
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

        const newUser = await user.create({
            name,
            email,
            password: hashedPassword,
            phone,
            bloodGroup: normalizedBloodGroup
        });

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

        const foundUser = await user.findOne({ email });
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

        if (password !== undefined) {
            updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
        }

        const updatedUser = await user.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
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
                message: "access denied"
            });
        }

        const users = await user.find().select("-password");

        return res.status(200).json({
            success: true,
            count: users.length,
            users
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

        // Admin-only fields
        if (role !== undefined && isAdmin(req)) updateData.role = role;
        if (isEligible !== undefined && isAdmin(req)) updateData.isEligible = isEligible;
        if (lastDonationDate !== undefined && isAdmin(req)) updateData.lastDonationDate = lastDonationDate;

        if (password !== undefined) {
            updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
        }

        const updatedUser = await user.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
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
