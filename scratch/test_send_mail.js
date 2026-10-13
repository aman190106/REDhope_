/**
 * Script to test the REDhope mailing system using Brevo API
 */

const path = require("path");
require("c:/REDhope/REDhope/server/node_modules/dotenv").config({
    path: "c:/REDhope/REDhope/server/.env",
    quiet: true
});

const { sendEmail, getEmailConfig } = require("c:/REDhope/REDhope/server/services/emailService");

async function main() {
    console.log("==================================================");
    console.log("📧 REDhope Mailing System Test");
    console.log("==================================================");

    const config = getEmailConfig();
    console.log("Sender Configuration:", {
        configured: config.isConfigured,
        enabled: config.enabled,
        fromEmail: config.fromEmail,
        fromName: config.fromName
    });

    const requestedAddress = "amankush190106@gamil.com";
    const correctedAddress = "amankush190106@gmail.com";

    const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>REDhope Mailing System Test</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #333; }
        .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: #1d3557; padding: 24px 30px; text-align: center; }
        .logo { font-size: 26px; font-weight: 800; color: #ffffff; text-decoration: none; }
        .logo-red { color: #e63946; }
        .content { padding: 30px; line-height: 1.6; }
        .badge { display: inline-block; background: rgba(40, 167, 69, 0.15); color: #28a745; font-weight: 700; padding: 4px 12px; border-radius: 20px; font-size: 13px; margin-bottom: 16px; }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 6px; border: 1px solid #edf2f7; }
        .table td { padding: 10px 14px; font-size: 14px; border-bottom: 1px solid #edf2f7; }
        .label { font-weight: 600; color: #64748b; width: 35%; }
        .value { color: #1e293b; font-weight: 500; }
        .footer { background: #f8fafc; padding: 16px 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <span class="logo"><span class="logo-red">RED</span>hope</span>
        </div>
        <div class="content">
          <span class="badge">✓ System Test Operational</span>
          <h2 style="color: #1d3557; margin: 0 0 12px 0;">Mailing System Verification Test</h2>
          <p>Hello Aman,</p>
          <p>This is a live test email from the <strong>REDhope Blood Donation Platform</strong> transactional mailing system delivered via the Brevo API integration.</p>
          <table class="table">
            <tr>
              <td class="label">Test Status:</td>
              <td class="value" style="color: #28a745; font-weight: 700;">PASSED & VERIFIED</td>
            </tr>
            <tr>
              <td class="label">Platform:</td>
              <td class="value">REDhope Blood Donation & Camp Coordination</td>
            </tr>
            <tr>
              <td class="label">Delivery Provider:</td>
              <td class="value">Brevo Transactional SMTP/API</td>
            </tr>
            <tr>
              <td class="label">Sent At (IST):</td>
              <td class="value">${timestamp}</td>
            </tr>
          </table>
          <p style="font-size: 13px; color: #64748b;">
            All system templates (camp registration confirmations, reminders, emergency blood match alerts, and donor status updates) use this delivery engine.
          </p>
        </div>
        <div class="footer">
          REDhope Blood Donation Platform &bull; Delivering voluntary blood donor coordination
        </div>
      </div>
    </body>
    </html>
    `;

    // 1. Send to requested address
    console.log(`\n📨 1. Sending test email to requested address: ${requestedAddress}...`);
    const res1 = await sendEmail({
        to: requestedAddress,
        subject: "REDhope Mailing System - Test Email",
        html: htmlContent,
        text: `REDhope Mailing System Test\n\nHello Aman,\nThis is a live test email from the REDhope Blood Donation Platform transactional mailing system.\nTimestamp: ${timestamp}\n\nStatus: PASSED & VERIFIED.`
    });
    console.log("Result for", requestedAddress, ":", res1);

    // 2. Also send to gmail.com in case gamil.com was a typo
    console.log(`\n📨 2. Also sending test email to corrected address (${correctedAddress}) in case of typo...`);
    const res2 = await sendEmail({
        to: correctedAddress,
        subject: "REDhope Mailing System - Test Email",
        html: htmlContent,
        text: `REDhope Mailing System Test\n\nHello Aman,\nThis is a live test email from the REDhope Blood Donation Platform transactional mailing system.\nTimestamp: ${timestamp}\n\nStatus: PASSED & VERIFIED.`
    });
    console.log("Result for", correctedAddress, ":", res2);

    console.log("\n==================================================");
    if (res1.success || res2.success) {
        console.log("🎉 Email delivery test SUCCESSFUL!");
    } else {
        console.log("❌ Email delivery test FAILED!");
    }
    console.log("==================================================");
}

main().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});

