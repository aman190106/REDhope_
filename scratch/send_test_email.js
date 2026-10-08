const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config({ path: "c:/REDhope/REDhope/server/.env" });
const { sendEmail } = require("c:/REDhope/REDhope/server/services/emailService");

async function main() {
    const toEmail = process.env.EMAIL_FROM || "aman1805techie@gmail.com";
    console.log(`Sending live test email to: ${toEmail}...`);

    const result = await sendEmail({
        to: toEmail,
        subject: "REDhope - Live Brevo Email Verification",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #e63946; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">REDhope</h1>
                    <p style="margin: 5px 0 0 0; font-size: 14px;">Email Delivery Verification</p>
                </div>
                <div style="padding: 24px; color: #333333; line-height: 1.6;">
                    <h2 style="color: #1d3557; margin-top: 0;">It Works!</h2>
                    <p>Your <strong>Brevo API</strong> email configuration in REDhope is active and delivering emails successfully.</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                        <tr>
                            <td style="padding: 8px; border: 1px solid #eee; background: #fafafa; font-weight: bold;">Sender:</td>
                            <td style="padding: 8px; border: 1px solid #eee;">${process.env.EMAIL_FROM}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #eee; background: #fafafa; font-weight: bold;">Status:</td>
                            <td style="padding: 8px; border: 1px solid #eee; color: #28a745; font-weight: bold;">Connected & Verified</td>
                        </tr>
                    </table>
                    <p>Whenever donors register for camps, cancel registrations, or receive blood match alerts, emails will be delivered automatically.</p>
                </div>
                <div style="background: #f8f9fa; padding: 12px; text-align: center; font-size: 12px; color: #6c757d; border-top: 1px solid #eee;">
                    REDhope Blood Donation Platform
                </div>
            </div>
        `,
        text: "REDhope Email Verification: Your Brevo API email integration is working successfully!"
    });

    console.log("Email Delivery Result:", JSON.stringify(result, null, 2));
}

main();
