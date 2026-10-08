/**
 * REDhope Email Service
 * 
 * Delivers transactional emails via the Brevo HTTP API.
 * Never logs or exposes the BREVO_API_KEY.
 * Never crashes the host application on delivery failures.
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Optional mock sender for automated testing
let mockEmailSender = null;

/**
 * Allows automated test suites to mock Brevo API calls without sending real emails.
 * 
 * @param {Function|null} mockFn - (emailPayload) => Promise<{ success: boolean, messageId?: string, error?: string }>
 */
function setMockEmailSender(mockFn) {
    mockEmailSender = mockFn;
}

/**
 * Sends a transactional email using the Brevo HTTP API.
 * 
 * @param {Object} params
 * @param {string|{ email: string, name?: string }} params.to - Recipient email address or object
 * @param {string} params.subject - Email subject line
 * @param {string} [params.html] - HTML body
 * @param {string} [params.text] - Plain text fallback
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, skipped?: boolean }>}
 */
async function sendEmail({ to, subject, html, text }) {
    // 1. Check if email notifications are globally enabled
    if (process.env.EMAIL_NOTIFICATIONS_ENABLED === "false") {
        return {
            success: false,
            skipped: true,
            reason: "EMAIL_NOTIFICATIONS_ENABLED is set to false"
        };
    }

    // 2. Validate API key and sender configuration
    const apiKey = process.env.BREVO_API_KEY ? process.env.BREVO_API_KEY.trim() : "";
    if (!apiKey) {
        return {
            success: false,
            error: "BREVO_API_KEY is not configured"
        };
    }

    const senderEmail = process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : "";
    if (!senderEmail) {
        return {
            success: false,
            error: "EMAIL_FROM is not configured"
        };
    }

    const senderName = process.env.EMAIL_FROM_NAME ? process.env.EMAIL_FROM_NAME.trim() : "REDhope";

    // 3. Validate recipient
    let recipientEmail = "";
    let recipientName = "";

    if (typeof to === "string") {
        recipientEmail = to.trim();
    } else if (to && typeof to === "object" && to.email) {
        recipientEmail = to.email.trim();
        recipientName = to.name ? to.name.trim() : "";
    }

    if (!recipientEmail || !/^\S+@\S+\.\S+$/.test(recipientEmail)) {
        return {
            success: false,
            error: "invalid recipient email address"
        };
    }

    // 4. Validate subject & content
    if (!subject || typeof subject !== "string" || !subject.trim()) {
        return {
            success: false,
            error: "subject is required"
        };
    }

    const cleanSubject = subject.trim();
    const htmlContent = typeof html === "string" && html.trim() ? html.trim() : undefined;
    const textContent = typeof text === "string" && text.trim()
        ? text.trim()
        : htmlContent
        ? htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : "";

    if (!htmlContent && !textContent) {
        return {
            success: false,
            error: "html or text content is required"
        };
    }

    const payload = {
        sender: {
            name: senderName,
            email: senderEmail
        },
        to: [
            recipientName
                ? { email: recipientEmail, name: recipientName }
                : { email: recipientEmail }
        ],
        subject: cleanSubject,
        ...(htmlContent ? { htmlContent } : {}),
        ...(textContent ? { textContent } : {})
    };

    // 5. Test mock interceptor (prevents real emails during automated tests)
    if (mockEmailSender && typeof mockEmailSender === "function") {
        try {
            return await mockEmailSender(payload);
        } catch (mockErr) {
            return {
                success: false,
                error: mockErr.message || "mock error"
            };
        }
    }

    // 6. Invoke Brevo HTTP API
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(BREVO_API_URL, {
            method: "POST",
            headers: {
                "accept": "application/json",
                "api-key": apiKey,
                "content-type": "application/json"
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        let data;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (response.ok && (response.status === 201 || response.status === 200)) {
            return {
                success: true,
                messageId: data && data.messageId ? data.messageId : undefined
            };
        }

        const safeErrorMessage = data && (data.message || data.code)
            ? `Brevo API error: ${data.message || data.code}`
            : `Brevo API HTTP status ${response.status}`;

        console.error(`Email delivery failed for ${recipientEmail}: ${safeErrorMessage}`);

        return {
            success: false,
            error: safeErrorMessage,
            statusCode: response.status
        };

    } catch (networkErr) {
        const safeNetworkError = networkErr.name === "AbortError"
            ? "Brevo API request timed out"
            : (networkErr.message || "Network error communicating with Brevo");

        console.error(`Email delivery network error for ${recipientEmail}: ${safeNetworkError}`);

        return {
            success: false,
            error: safeNetworkError
        };
    }
}

/**
 * Retrieves non-sensitive configuration status for diagnostics.
 * NEVER exposes the actual BREVO_API_KEY.
 */
function getEmailConfig() {
    const isConfigured = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim());
    const enabled = process.env.EMAIL_NOTIFICATIONS_ENABLED !== "false" &&
                    process.env.EMAIL_NOTIFICATIONS_ENABLED !== false;
    const fromEmail = process.env.EMAIL_FROM || "aman1805techie@gmail.com";
    const fromName = process.env.EMAIL_FROM_NAME || "REDhope";

    return {
        isConfigured,
        enabled,
        fromEmail,
        fromName
    };
}

module.exports = {
    sendEmail,
    getEmailConfig,
    setMockEmailSender
};
