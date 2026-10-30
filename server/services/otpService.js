const crypto = require("crypto");
const EmailOtp = require("../models/emailOtp");
const user = require("../models/user");
const emailService = require("./emailService");
const { getOtpVerificationTemplate } = require("../templates/emailTemplates");

const OTP_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

// Secret salt for hashing OTPs (prevents rainbow table attacks)
function getOtpSecret() {
    return process.env.OTP_SECRET || process.env.JWT_SECRET || "redhope_otp_secure_pepper_2026";
}

/**
 * Generates a cryptographically strong 6-digit numeric OTP.
 */
function generateOtp() {
    return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Computes a secure SHA-256 hash of an OTP string.
 */
function hashOtp(otp) {
    return crypto
        .createHmac("sha256", getOtpSecret())
        .update(otp.trim())
        .digest("hex");
}

/**
 * Validates a submitted OTP against a stored hash using timing-safe comparison.
 */
function compareOtp(submittedOtp, storedHash) {
    if (!submittedOtp || !storedHash) return false;
    const computedHash = hashOtp(submittedOtp);
    const hashBuf = Buffer.from(computedHash, "utf8");
    const storedBuf = Buffer.from(storedHash, "utf8");
    if (hashBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, storedBuf);
}

/**
 * Creates and delivers a single-use OTP.
 * Supports resend cooldown, attempt tracking, and secure hashing.
 */
async function createAndSendOtp({ email, name, purpose = "registration", registrationData = null }) {
    const cleanEmail = email.toLowerCase().trim();

    // 1. Check existing record for resend cooldown
    const existingRecord = await EmailOtp.findOne({ email: cleanEmail, purpose });
    if (existingRecord) {
        const elapsedMs = Date.now() - new Date(existingRecord.lastSentAt).getTime();
        const cooldownMs = RESEND_COOLDOWN_SECONDS * 1000;
        if (elapsedMs < cooldownMs) {
            const retryAfterSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
            return {
                success: false,
                rateLimited: true,
                retryAfterSeconds,
                message: `Please wait ${retryAfterSeconds} seconds before requesting a new verification code.`
            };
        }
    }

    // 2. Generate and hash OTP
    const plainOtp = generateOtp();
    const otpHash = hashOtp(plainOtp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // 3. Upsert OTP record
    const updatePayload = {
        email: cleanEmail,
        otpHash,
        purpose,
        attempts: 0,
        maxAttempts: MAX_ATTEMPTS,
        lastSentAt: new Date(),
        expiresAt
    };

    if (registrationData) {
        updatePayload.registrationData = registrationData;
    }

    await EmailOtp.findOneAndUpdate(
        { email: cleanEmail, purpose },
        { $set: updatePayload },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 4. Send branded transactional email
    const template = getOtpVerificationTemplate({
        name,
        otp: plainOtp,
        expiryMinutes: OTP_EXPIRY_MINUTES,
        purpose
    });

    const emailResult = await emailService.sendEmail({
        to: cleanEmail,
        subject: template.subject,
        html: template.html,
        text: template.text
    });

    // In test environment only: allow test suite to retrieve OTP for verification assertions
    const debugOtp = process.env.NODE_ENV === "test" ? plainOtp : undefined;

    return {
        success: true,
        cooldownSeconds: RESEND_COOLDOWN_SECONDS,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        emailSent: emailResult.success,
        _testOtp: debugOtp
    };
}

/**
 * Verifies an OTP code and consumes it if valid.
 */
async function verifyAndConsumeOtp({ email, otp, purpose = "registration" }) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = typeof otp === "string" ? otp.trim() : String(otp || "").trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
        return {
            valid: false,
            reason: "invalid_format",
            message: "Verification code must be 6 digits."
        };
    }

    const record = await EmailOtp.findOne({ email: cleanEmail, purpose });

    if (!record) {
        return {
            valid: false,
            reason: "not_found",
            message: "Verification code has expired or was not requested. Please request a new code."
        };
    }

    // Check expiry
    if (new Date() > new Date(record.expiresAt)) {
        await EmailOtp.deleteOne({ _id: record._id });
        return {
            valid: false,
            reason: "expired",
            message: "Verification code has expired. Please request a new code."
        };
    }

    // Check attempt limit
    if (record.attempts >= record.maxAttempts) {
        await EmailOtp.deleteOne({ _id: record._id });
        return {
            valid: false,
            reason: "max_attempts_exceeded",
            message: "Too many failed attempts. This code is now invalid. Please request a new one."
        };
    }

    // Verify hash
    const isMatch = compareOtp(cleanOtp, record.otpHash);
    if (!isMatch) {
        record.attempts += 1;
        await record.save();
        const remainingAttempts = Math.max(0, record.maxAttempts - record.attempts);
        return {
            valid: false,
            reason: "mismatch",
            attemptsLeft: remainingAttempts,
            message: remainingAttempts > 0
                ? `Invalid verification code. ${remainingAttempts} attempts remaining.`
                : "Too many failed attempts. Please request a new verification code."
        };
    }

    // Single-use guarantee: consume and remove record
    const registrationData = record.registrationData ? record.registrationData.toObject() : null;
    await EmailOtp.deleteOne({ _id: record._id });

    return {
        valid: true,
        registrationData
    };
}

/**
 * Safe database migration helper:
 * Ensures all pre-existing user documents without an explicit isEmailVerified field
 * are set to isEmailVerified: true so existing users are never locked out.
 */
async function ensureEmailVerificationMigration() {
    try {
        const result = await user.updateMany(
            { isEmailVerified: { $exists: false } },
            { $set: { isEmailVerified: true, emailVerifiedAt: new Date(), authProvider: "local" } }
        );
        if (result.modifiedCount > 0) {
            console.log(`[AUTH MIGRATION] Migrated ${result.modifiedCount} pre-existing user accounts to isEmailVerified: true`);
        }
    } catch (err) {
        console.error("[AUTH MIGRATION ERROR] Failed to run email verification migration:", err.message);
    }
}

module.exports = {
    createAndSendOtp,
    verifyAndConsumeOtp,
    ensureEmailVerificationMigration,
    hashOtp,
    compareOtp,
    RESEND_COOLDOWN_SECONDS,
    OTP_EXPIRY_MINUTES,
    MAX_ATTEMPTS
};

