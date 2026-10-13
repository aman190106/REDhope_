/**
 * REDhope Responsive Email Templates
 * 
 * Provides branded, responsive HTML and plain-text templates for all notification events.
 */

function baseLayout({ title, heading, contentHtml, ctaText, ctaUrl }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #333333;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      background-color: #f4f6f8;
      padding: 30px 15px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      border: 1px solid #e5e7eb;
    }
    .header {
      background-color: #1d3557;
      padding: 24px 30px;
      text-align: center;
    }
    .logo {
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      text-decoration: none;
      letter-spacing: -0.5px;
    }
    .logo-red {
      color: #e63946;
    }
    .body {
      padding: 32px 30px;
    }
    .heading {
      color: #1d3557;
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 16px 0;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background-color: #f8fafc;
      border-radius: 6px;
      overflow: hidden;
      border: 1px solid #edf2f7;
    }
    .info-table td {
      padding: 10px 14px;
      font-size: 14px;
      border-bottom: 1px solid #edf2f7;
    }
    .info-label {
      font-weight: 600;
      color: #64748b;
      width: 35%;
    }
    .info-value {
      color: #1e293b;
      font-weight: 500;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      background-color: rgba(230, 57, 70, 0.12);
      color: #e63946;
      font-weight: 700;
      border-radius: 4px;
      font-size: 13px;
    }
    .cta-container {
      margin: 28px 0 16px 0;
      text-align: center;
    }
    .cta-btn {
      display: inline-block;
      background-color: #e63946;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #64748b;
    }
    .footer a {
      color: #e63946;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <span class="logo"><span class="logo-red">RED</span>hope</span>
      </div>
      <div class="body">
        <h2 class="heading">${heading}</h2>
        ${contentHtml}
        ${ctaText && ctaUrl ? `
        <div class="cta-container">
          <a href="${ctaUrl}" class="cta-btn">${ctaText}</a>
        </div>` : ""}
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0;">This email was sent by REDhope Blood Donation Platform.</p>
        <p style="margin: 0;">You can update your email notification preferences anytime in your Profile settings.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function formatDate(dateVal) {
    if (!dateVal) return "TBD";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

// ─────────────────────────────────────────────
// A. Camp Registration Confirmed
// ─────────────────────────────────────────────
function getCampRegistrationTemplate({ donorName, campName, startDate, endDate, location, address }) {
    const subject = "REDhope - Camp Registration Confirmed";
    const heading = "Registration Confirmed!";
    const venue = address || (location && location.address) || (location && location.city) || "Camp Venue";

    const contentHtml = `
      <p>Hello ${donorName || "Donor"},</p>
      <p>Thank you for registering to donate blood! Your registration for <strong>${campName}</strong> has been successfully confirmed.</p>
      <table class="info-table">
        <tr>
          <td class="info-label">Camp:</td>
          <td class="info-value">${campName}</td>
        </tr>
        <tr>
          <td class="info-label">Date:</td>
          <td class="info-value">${formatDate(startDate)}${endDate && endDate !== startDate ? ` - ${formatDate(endDate)}` : ""}</td>
        </tr>
        <tr>
          <td class="info-label">Location:</td>
          <td class="info-value">${venue}</td>
        </tr>
      </table>
      <p style="font-size: 13px; color: #64748b;">Please remember to drink plenty of fluids and get adequate rest prior to donation. Bring a valid photo ID to the venue.</p>
    `;

    const text = `REDhope - Camp Registration Confirmed\n\n` +
        `Hello ${donorName || "Donor"},\n\n` +
        `Your registration for ${campName} has been confirmed.\n` +
        `Camp: ${campName}\n` +
        `Date: ${formatDate(startDate)}\n` +
        `Location: ${venue}\n\n` +
        `Thank you for helping save lives!\nREDhope Team`;

    return {
        subject,
        html: baseLayout({ title: subject, heading, contentHtml }),
        text
    };
}

// ─────────────────────────────────────────────
// B. Camp Registration Cancelled
// ─────────────────────────────────────────────
function getCampRegistrationCancelledTemplate({ donorName, campName, location }) {
    const subject = "REDhope - Camp Registration Cancelled";
    const heading = "Registration Cancelled";
    const venue = (location && location.city) ? `${location.city}, ${location.state || ""}` : "the camp";

    const contentHtml = `
      <p>Hello ${donorName || "Donor"},</p>
      <p>Your registration for <strong>${campName}</strong> (${venue}) has been cancelled as requested.</p>
      <p>If this was a mistake, or if your plans change, you can register for another upcoming blood donation camp anytime through REDhope.</p>
    `;

    const text = `REDhope - Camp Registration Cancelled\n\n` +
        `Hello ${donorName || "Donor"},\n\n` +
        `Your registration for ${campName} has been cancelled.\n` +
        `You can find more blood donation camps on REDhope at any time.\n\n` +
        `REDhope Team`;

    return {
        subject,
        html: baseLayout({ title: subject, heading, contentHtml }),
        text
    };
}

// ─────────────────────────────────────────────
// C. Camp Update
// ─────────────────────────────────────────────
function getCampUpdateTemplate({ donorName, campName, startDate, startTime, endTime, address }) {
    const subject = "REDhope - Camp Details Updated";
    const heading = "Camp Schedule Updated";

    const contentHtml = `
      <p>Hello ${donorName || "Donor"},</p>
      <p>The organizers of <strong>${campName}</strong> have updated the camp schedule or location details.</p>
      <table class="info-table">
        <tr>
          <td class="info-label">Camp:</td>
          <td class="info-value">${campName}</td>
        </tr>
        <tr>
          <td class="info-label">Date:</td>
          <td class="info-value">${formatDate(startDate)}</td>
        </tr>
        ${startTime ? `
        <tr>
          <td class="info-label">Time:</td>
          <td class="info-value">${startTime}${endTime ? ` - ${endTime}` : ""}</td>
        </tr>` : ""}
        ${address ? `
        <tr>
          <td class="info-label">Venue:</td>
          <td class="info-value">${address}</td>
        </tr>` : ""}
      </table>
      <p>Please review the updated details above. We look forward to seeing you there!</p>
    `;

    const text = `REDhope - Camp Details Updated\n\n` +
        `Hello ${donorName || "Donor"},\n\n` +
        `The schedule or venue for ${campName} has been updated.\n` +
        `Camp: ${campName}\n` +
        `Date: ${formatDate(startDate)}\n` +
        (startTime ? `Time: ${startTime} - ${endTime}\n` : "") +
        (address ? `Venue: ${address}\n` : "") +
        `\nREDhope Team`;

    return {
        subject,
        html: baseLayout({ title: subject, heading, contentHtml }),
        text
    };
}

// ─────────────────────────────────────────────
// D. Camp Cancellation (Organizer Cancelled Camp)
// ─────────────────────────────────────────────
function getCampCancelledTemplate({ donorName, campName }) {
    const subject = "REDhope - Camp Cancelled";
    const heading = "Blood Donation Camp Cancelled";

    const contentHtml = `
      <p>Hello ${donorName || "Donor"},</p>
      <p>We regret to inform you that <strong>${campName}</strong> has been cancelled by the organizers.</p>
      <p>Your registration has been automatically voided. We apologize for any inconvenience caused.</p>
      <p>Please check REDhope for other upcoming blood donation camps in your area.</p>
    `;

    const text = `REDhope - Camp Cancelled\n\n` +
        `Hello ${donorName || "Donor"},\n\n` +
        `We regret to inform you that ${campName} has been cancelled by the organizers.\n` +
        `Your registration has been automatically cancelled.\n` +
        `Please explore other blood donation camps near you on REDhope.\n\n` +
        `REDhope Team`;

    return {
        subject,
        html: baseLayout({ title: subject, heading, contentHtml }),
        text
    };
}

// ─────────────────────────────────────────────
// E. Camp Reminder (24 Hours Prior)
// ─────────────────────────────────────────────
function getCampReminderTemplate({ donorName, campName, startDate, startTime, address, city }) {
    const subject = "REDhope - Blood Donation Camp Reminder";
    const heading = "Upcoming Donation Camp Reminder";
    const venue = address ? `${address}${city ? `, ${city}` : ""}` : (city || "Camp Venue");

    const contentHtml = `
      <p>Hello ${donorName || "Donor"},</p>
      <p>This is a friendly reminder that you are registered for <strong>${campName}</strong>, starting in approximately 24 hours.</p>
      <table class="info-table">
        <tr>
          <td class="info-label">Camp:</td>
          <td class="info-value">${campName}</td>
        </tr>
        <tr>
          <td class="info-label">Date:</td>
          <td class="info-value">${formatDate(startDate)}</td>
        </tr>
        ${startTime ? `
        <tr>
          <td class="info-label">Time:</td>
          <td class="info-value">${startTime}</td>
        </tr>` : ""}
        <tr>
          <td class="info-label">Venue:</td>
          <td class="info-value">${venue}</td>
        </tr>
      </table>
      <p style="font-size: 13px; color: #64748b;">Tip: Stay well hydrated, eat a healthy meal before donating, and carry your government ID.</p>
    `;

    const text = `REDhope - Blood Donation Camp Reminder\n\n` +
        `Hello ${donorName || "Donor"},\n\n` +
        `Reminder: You are registered for ${campName} tomorrow!\n` +
        `Date: ${formatDate(startDate)}\n` +
        (startTime ? `Time: ${startTime}\n` : "") +
        `Venue: ${venue}\n\n` +
        `Thank you for donating blood!\nREDhope Team`;

    return {
        subject,
        html: baseLayout({ title: subject, heading, contentHtml }),
        text
    };
}

// ─────────────────────────────────────────────
// F. Blood Requirement / Blood Match Alert
// ─────────────────────────────────────────────
function getBloodMatchTemplate({ donorName, bloodGroup, urgency, unitsNeeded, city }) {
    const subject = "REDhope - Blood Requirement Alert";
    const heading = "Urgent Blood Requirement";

    const contentHtml = `
      <p>Hello ${donorName || "Donor"},</p>
      <p>A patient or hospital in your vicinity has an urgent requirement for compatible blood donors.</p>
      <table class="info-table">
        <tr>
          <td class="info-label">Required Group:</td>
          <td class="info-value"><span class="badge">${bloodGroup}</span></td>
        </tr>
        ${unitsNeeded ? `
        <tr>
          <td class="info-label">Units Needed:</td>
          <td class="info-value">${unitsNeeded} unit(s)</td>
        </tr>` : ""}
        ${urgency ? `
        <tr>
          <td class="info-label">Urgency:</td>
          <td class="info-value" style="text-transform: capitalize; color: #e63946; font-weight: 700;">${urgency}</td>
        </tr>` : ""}
        ${city ? `
        <tr>
          <td class="info-label">Location:</td>
          <td class="info-value">${city}</td>
        </tr>` : ""}
      </table>
      <p>Your blood group is compatible. If you are available and medically eligible, please log in to REDhope to respond or contact the coordination center.</p>
    `;

    const text = `REDhope - Blood Requirement Alert\n\n` +
        `Hello ${donorName || "Donor"},\n\n` +
        `An urgent blood requirement matching your blood group has been posted:\n` +
        `Blood Group: ${bloodGroup}\n` +
        (unitsNeeded ? `Units Needed: ${unitsNeeded}\n` : "") +
        (urgency ? `Urgency: ${urgency}\n` : "") +
        (city ? `Location: ${city}\n` : "") +
        `\nLog in to REDhope to review details.\nREDhope Team`;

    return {
        subject,
        html: baseLayout({ title: subject, heading, contentHtml }),
        text
    };
}

// ─────────────────────────────────────────────
// G. Donation Eligibility Reminder
// ─────────────────────────────────────────────
function getDonationReminderTemplate({ donorName, nextEligibleDate }) {
    const subject = "REDhope - You May Be Eligible to Donate Again";
    const heading = "You're Eligible to Donate!";

    const contentHtml = `
      <p>Hello ${donorName || "Donor"},</p>
      <p>Good news! According to your donation history, your 90-day medical interval has elapsed and you may now be eligible to donate blood again.</p>
      <table class="info-table">
        <tr>
          <td class="info-label">Status:</td>
          <td class="info-value"><span class="badge" style="background-color: rgba(40,167,69,0.12); color: #28a745;">Eligible</span></td>
        </tr>
        ${nextEligibleDate ? `
        <tr>
          <td class="info-label">Eligible Since:</td>
          <td class="info-value">${formatDate(nextEligibleDate)}</td>
        </tr>` : ""}
      </table>
      <p>Your contribution can save up to three lives. Check out nearby upcoming donation camps and schedule your next visit!</p>
    `;

    const text = `REDhope - You May Be Eligible to Donate Again\n\n` +
        `Hello ${donorName || "Donor"},\n\n` +
        `Good news! You have completed the 90-day medical interval and are eligible to donate blood again.\n` +
        `Find blood donation camps near you on REDhope.\n\n` +
        `REDhope Team`;

    return {
        subject,
        html: baseLayout({ title: subject, heading, contentHtml }),
        text
    };
}

// ─────────────────────────────────────────────
// H. Donation Recorded / Completed
// ─────────────────────────────────────────────
function getDonationRecordedTemplate({ donorName, campName, donationDate, units, bloodGroup }) {
    const subject = "REDhope - Donation Recorded";
    const heading = "Blood Donation Verified!";

    const contentHtml = `
      <p>Hello ${donorName || "Donor"},</p>
      <p>Thank you for your generous gift of life! Your blood donation has been officially verified and recorded.</p>
      <table class="info-table">
        <tr>
          <td class="info-label">Camp:</td>
          <td class="info-value">${campName || "Blood Donation Camp"}</td>
        </tr>
        <tr>
          <td class="info-label">Donation Date:</td>
          <td class="info-value">${formatDate(donationDate || new Date())}</td>
        </tr>
        <tr>
          <td class="info-label">Units Donated:</td>
          <td class="info-value">${units || 1} unit(s)</td>
        </tr>
        ${bloodGroup ? `
        <tr>
          <td class="info-label">Blood Group:</td>
          <td class="info-value"><span class="badge">${bloodGroup}</span></td>
        </tr>` : ""}
      </table>
      <p>Your donation record has been added to your profile. The medical eligibility counter has been synchronized accordingly.</p>
      <p style="font-weight: 600; color: #1d3557;">On behalf of the patients and families you helped today, thank you!</p>
    `;

    const text = `REDhope - Donation Recorded\n\n` +
        `Hello ${donorName || "Donor"},\n\n` +
        `Thank you for donating blood!\n` +
        `Your donation has been verified:\n` +
        `Camp: ${campName || "Blood Donation Camp"}\n` +
        `Date: ${formatDate(donationDate || new Date())}\n` +
        `Units: ${units || 1}\n\n` +
        `Thank you for being a hero!\nREDhope Team`;

    return {
        subject,
        html: baseLayout({ title: subject, heading, contentHtml }),
        text
    };
}

// ─────────────────────────────────────────────
// I. Nearby Camp Available Alert
// ─────────────────────────────────────────────
function getNearbyCampAlertTemplate({ donorName, campName, startDate, endDate, startTime, endTime, address, city, distanceKm, campId }) {
    const subject = `REDhope - Blood Donation Camp Available Near You: ${campName}`;
    const heading = "Blood Donation Camp Near You!";
    const venue = address ? `${address}${city ? `, ${city}` : ""}` : (city || "Camp Venue");
    const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",")[0].trim() : "http://localhost:5173";
    const ctaUrl = campId ? `${frontendUrl}/camps/${campId}` : `${frontendUrl}/camps`;

    const contentHtml = `
      <p>Hello ${donorName || "Donor"},</p>
      <p>A new voluntary blood donation drive has been scheduled near your area. Every donation can save up to three lives.</p>
      <table class="info-table">
        <tr>
          <td class="info-label">Camp Name:</td>
          <td class="info-value"><strong>${campName}</strong></td>
        </tr>
        <tr>
          <td class="info-label">Date:</td>
          <td class="info-value">${formatDate(startDate)}${endDate && endDate !== startDate ? ` - ${formatDate(endDate)}` : ""}</td>
        </tr>
        ${startTime ? `
        <tr>
          <td class="info-label">Timings:</td>
          <td class="info-value">${startTime}${endTime ? ` - ${endTime}` : ""}</td>
        </tr>` : ""}
        <tr>
          <td class="info-label">Venue:</td>
          <td class="info-value">${venue}</td>
        </tr>
        ${distanceKm !== undefined && distanceKm !== null ? `
        <tr>
          <td class="info-label">Proximity:</td>
          <td class="info-value"><span class="badge" style="background-color: rgba(59, 130, 246, 0.12); color: #2563eb;">Approx. ${Math.round(distanceKm)} km away</span></td>
        </tr>` : ""}
      </table>
      <p style="font-size: 13px; color: #64748b;">
        Walk-ins and advance registrations are welcome. Register online in advance to confirm your slot and avoid waiting time.
      </p>
    `;

    const text = `REDhope - Blood Donation Camp Near You: ${campName}\n\n` +
        `Hello ${donorName || "Donor"},\n\n` +
        `A blood donation camp has been scheduled near you:\n` +
        `Camp: ${campName}\n` +
        `Date: ${formatDate(startDate)}\n` +
        (startTime ? `Time: ${startTime} - ${endTime}\n` : "") +
        `Venue: ${venue}\n` +
        (distanceKm !== undefined && distanceKm !== null ? `Distance: Approx. ${Math.round(distanceKm)} km\n` : "") +
        `\nView camp details and register: ${ctaUrl}\n\n` +
        `REDhope Blood Donation Platform`;

    return {
        subject,
        html: baseLayout({
            title: subject,
            heading,
            contentHtml,
            ctaText: "View Camp & Register",
            ctaUrl
        }),
        text
    };
}

module.exports = {
    getCampRegistrationTemplate,
    getCampRegistrationCancelledTemplate,
    getCampUpdateTemplate,
    getCampCancelledTemplate,
    getCampReminderTemplate,
    getBloodMatchTemplate,
    getDonationReminderTemplate,
    getDonationRecordedTemplate,
    getNearbyCampAlertTemplate
};

