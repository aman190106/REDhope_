const mongoose = require("mongoose");
const user = require("../models/user");

const emailRegex = /^\S+@\S+\.\S+$/;
const phoneRegex = /^[6-9]\d{9}$/;

const sanitizeUser = (createdUser) => {
    const userObject = createdUser.toObject();
    delete userObject.password;
    return userObject;
};

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

        const newuser = await user.create({
            name,
            email,
            password,
            phone,
            bloodGroup
        });

        return res.status(201).json({
            success: true,
            message: "user Registration",
            data: sanitizeUser(newuser)
        });
    } catch (error) {
        console.log(error);

        if (error.code === 11000) {
            const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0];
            const message = duplicateField === "phone"
                ? "phone number already exist"
                : "mail id already exist";

            return res.status(400).json({
                success: false,
                message
            });
        }

        return res.status(500).json({
            success: false,
            message: "internal server error"
        });
    }
};

const getAllUsers = async (req, res) => {
    try {
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

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "invalid user id"
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

module.exports = {
    registerUser,
    getAllUsers,
    getUserById
};
