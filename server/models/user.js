const mongoose = require("mongoose");

const VALID_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const VALID_ROLES = ["user", "organizer", "admin"];
const VALID_GENDERS = ["male", "female", "other", "prefer_not_to_say"];

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: [true, "name is required"],
        trim: true,
        minlength: [2, "name must be at least 2 characters"]
    },

    email: {
        type: String,
        required: [true, "email is required"],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, "invalid email format"]
    },

    password: {
        type: String,
        required: [true, "password is required"]
    },

    phone: {
        type: String,
        required: [true, "phone number is required"],
        unique: true,
        trim: true,
        match: [/^[6-9]\d{9}$/, "invalid phone number"]
    },

    bloodGroup: {
        type: String,
        required: [true, "blood group is required"],
        enum: {
            values: VALID_BLOOD_GROUPS,
            message: "invalid blood group"
        },
        uppercase: true,
        trim: true
    },

    role: {
        type: String,
        enum: {
            values: VALID_ROLES,
            message: "invalid role"
        },
        default: "user"
    },

    // --- Profile Details ---
    dateOfBirth: {
        type: Date,
        validate: {
            validator: function(dob) {
                if (!dob) return true;
                const today = new Date();
                const birthDate = new Date(dob);
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                return age >= 18;
            },
            message: "donor must be at least 18 years old"
        }
    },

    gender: {
        type: String,
        enum: {
            values: VALID_GENDERS,
            message: "invalid gender"
        },
        default: "prefer_not_to_say"
    },

    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: undefined
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            validate: {
                validator: function(coords) {
                    if (!coords || coords.length === 0) return true;
                    if (coords.length !== 2) return false;
                    const [lng, lat] = coords;
                    return typeof lng === "number" && typeof lat === "number" &&
                           lng >= -180 && lng <= 180 &&
                           lat >= -90 && lat <= 90;
                },
                message: "coordinates must be valid [longitude, latitude] numbers"
            },
            default: undefined
        },
        city: {
            type: String,
            trim: true
        },
        state: {
            type: String,
            trim: true
        },
        pincode: {
            type: String,
            trim: true,
            validate: {
                validator: function(pin) {
                    if (!pin) return true;
                    return /^[1-9][0-9]{5}$/.test(pin);
                },
                message: "invalid Indian pincode format"
            }
        }
    },

    isDonorAvailable: {
        type: Boolean,
        default: true
    },

    lastDonationDate: {
        type: Date,
        default: null
    },

    isEligible: {
        type: Boolean,
        default: false
    },

    eligibilityStatus: {
        type: String,
        enum: ["ineligible", "pending", "eligible", "deferred"],
        default: "ineligible"
    },

    emailNotifications: {
        type: Boolean,
        default: true
    },

    notificationRadiusKm: {
        type: Number,
        default: 25,
        min: [1, "radius must be at least 1 km"],
        max: [200, "radius cannot exceed 200 km"]
    }

}, {
    timestamps: true
});

// Sparse geospatial index on location.coordinates so null/undefined locations are ignored
userSchema.index({ "location.coordinates": "2dsphere" }, { sparse: true });

// Compound index for blood matching queries
userSchema.index({ bloodGroup: 1, isDonorAvailable: 1, isEligible: 1 });
userSchema.index({ eligibilityStatus: 1 });

const user = mongoose.model("user", userSchema);

module.exports = user;
