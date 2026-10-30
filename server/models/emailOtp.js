const mongoose = require("mongoose");

const emailOtpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },

    otpHash: {
        type: String,
        required: true
    },

    purpose: {
        type: String,
        enum: ["registration", "account_linking", "email_verification"],
        default: "registration"
    },

    // Pre-hashed registration data stored securely until email OTP is confirmed.
    // Plain text passwords are NEVER stored in this model.
    registrationData: {
        name: { type: String, trim: true },
        passwordHash: { type: String },
        phone: { type: String, trim: true },
        bloodGroup: { type: String, trim: true },
        role: { type: String, enum: ["user", "organizer"], default: "user" },
        isDonorAvailable: { type: Boolean, default: true }
    },

    attempts: {
        type: Number,
        default: 0
    },

    maxAttempts: {
        type: Number,
        default: 5
    },

    lastSentAt: {
        type: Date,
        default: Date.now
    },

    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // MongoDB TTL index automatically removes expired OTP records
    }
}, {
    timestamps: true
});

emailOtpSchema.index({ email: 1, purpose: 1 });

const EmailOtp = mongoose.model("EmailOtp", emailOtpSchema);

module.exports = EmailOtp;

