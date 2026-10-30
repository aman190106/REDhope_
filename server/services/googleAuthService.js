/**
 * REDhope Google OAuth & ID Token Verification Service
 * 
 * Verifies Google ID tokens cryptographically using google-auth-library.
 * Validates signature, issuer, audience (GOOGLE_CLIENT_ID), and expiry.
 * Never exposes Google client secrets in frontend code.
 */

const { OAuth2Client } = require("google-auth-library");

let mockGoogleVerifier = null;

/**
 * Allows automated test suites to mock Google ID token verification without network calls.
 * 
 * @param {Function|null} mockFn - (idToken) => Promise<{ sub, email, emailVerified, name, picture }>
 */
function setMockGoogleVerifier(mockFn) {
    mockGoogleVerifier = mockFn;
}

/**
 * Cryptographically verifies a Google ID token.
 * 
 * @param {string} idToken
 * @returns {Promise<{ sub: string, email: string, emailVerified: boolean, name: string, picture: string }>}
 */
async function verifyGoogleIdToken(idToken) {
    if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
        throw new Error("Google ID token is required.");
    }

    // 1. Mock interceptor for test environments
    if (mockGoogleVerifier && typeof mockGoogleVerifier === "function") {
        return await mockGoogleVerifier(idToken.trim());
    }

    // 2. Validate Google Client ID configuration
    const clientId = process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.trim() : "";
    if (!clientId) {
        throw new Error("GOOGLE_CLIENT_ID is not configured on the server.");
    }

    const client = new OAuth2Client(clientId);

    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken.trim(),
            audience: clientId
        });

        const payload = ticket.getPayload();
        if (!payload) {
            throw new Error("Empty payload from Google token verification.");
        }

        const issuer = payload.iss;
        if (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") {
            throw new Error(`Untrusted token issuer: ${issuer}`);
        }

        if (!payload.sub) {
            throw new Error("Missing subject identifier (sub) in Google token.");
        }

        if (!payload.email) {
            throw new Error("Missing email in Google token.");
        }

        return {
            sub: payload.sub,
            email: payload.email.toLowerCase().trim(),
            emailVerified: Boolean(payload.email_verified),
            name: payload.name ? payload.name.trim() : "",
            picture: payload.picture || ""
        };
    } catch (err) {
        // Safe sanitization: never leak internal stack details to caller
        const message = err.message || "Invalid Google ID token.";
        const safeError = new Error(
            message.includes("Token used too late")
                ? "Google ID token has expired."
                : message.includes("Wrong recipient")
                ? "Google token audience mismatch."
                : message
        );
        safeError.statusCode = 401;
        throw safeError;
    }
}

module.exports = {
    verifyGoogleIdToken,
    setMockGoogleVerifier
};

