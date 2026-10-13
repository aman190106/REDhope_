/**
 * Test script: Dispatch nearby camp notification email to "aastha aman ke biwi"
 */

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("c:/REDhope/REDhope/server/node_modules/dotenv").config({
    path: "c:/REDhope/REDhope/server/.env",
    quiet: true
});

const mongoose = require("c:/REDhope/REDhope/server/node_modules/mongoose");
const user = require("c:/REDhope/REDhope/server/models/user");
const camp = require("c:/REDhope/REDhope/server/models/camp");
const notification = require("c:/REDhope/REDhope/server/models/notification");
const { notifyNearbyDonorsForCamp } = require("c:/REDhope/REDhope/server/services/campNotificationService");
const { getNearbyCampAlertTemplate } = require("c:/REDhope/REDhope/server/templates/emailTemplates");
const { sendEmail } = require("c:/REDhope/REDhope/server/services/emailService");

async function main() {
    console.log("==================================================");
    console.log("🚀 Testing Nearby Camp Alert to: 'aastha aman ke biwi'");
    console.log("==================================================\n");

    await mongoose.connect(process.env.MONGODB_URI, { dbName: "REDhope" });
    console.log("Connected to MongoDB.");

    // 1. Locate user in MongoDB
    const targetUser = await user.findOne({ name: { $regex: /aastha/i } });
    if (!targetUser) {
        console.error("❌ Target user 'aastha' not found in MongoDB!");
        process.exit(1);
    }

    console.log("✅ Target User located:", {
        id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        phone: targetUser.phone,
        bloodGroup: targetUser.bloodGroup,
        emailNotifications: targetUser.emailNotifications
    });

    // 2. Locate or prepare a published camp in Ahmedabad
    let publishedCamp = await camp.findOne({
        status: "published",
        "location.city": "Ahmedabad"
    });

    if (!publishedCamp) {
        publishedCamp = await camp.findOne({ status: "published" });
    }

    console.log("✅ Camp for Alert:", {
        id: publishedCamp._id.toString(),
        name: publishedCamp.name,
        city: publishedCamp.location?.city,
        startDate: publishedCamp.startDate,
        timings: `${publishedCamp.startTime} - ${publishedCamp.endTime}`
    });

    // 3. Ensure target user has location set to Ahmedabad so geospatial and city matching picks her up
    await user.updateOne(
        { _id: targetUser._id },
        {
            $set: {
                "location.type": "Point",
                "location.coordinates": [72.5714, 23.0225],
                "location.city": "Ahmedabad",
                "location.state": "Gujarat",
                "location.pincode": "380001",
                isEligible: true,
                emailNotifications: true
            }
        }
    );
    console.log("✅ Ensured donor coordinates and city are synchronized with camp.");

    // 4. Generate the personalized nearby camp template
    const emailPayload = getNearbyCampAlertTemplate({
        donorName: targetUser.name,
        campName: publishedCamp.name,
        startDate: publishedCamp.startDate,
        endDate: publishedCamp.endDate,
        startTime: publishedCamp.startTime,
        endTime: publishedCamp.endTime,
        address: publishedCamp.location?.address,
        city: publishedCamp.location?.city,
        distanceKm: 2.4, // 2.4 km away
        campId: publishedCamp._id.toString()
    });

    console.log(`\n📧 Dispatching live Brevo email to ${targetUser.name} (${targetUser.email})...`);
    console.log(`Subject: "${emailPayload.subject}"`);

    // 5. Send the live email via Brevo
    const emailResult = await sendEmail({
        to: {
            email: targetUser.email,
            name: targetUser.name
        },
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text
    });

    console.log("\n📬 Brevo API Delivery Result:", emailResult);

    // 6. Also run the automated notifyNearbyDonorsForCamp service function
    console.log("\n🔄 Testing notifyNearbyDonorsForCamp service function...");
    const serviceResult = await notifyNearbyDonorsForCamp(publishedCamp, { radiusKm: 30 });
    console.log("Service batch result:", serviceResult);

    // Check in-app notification in DB
    const notif = await notification.findOne({
        user: targetUser._id
    }).sort({ createdAt: -1 });

    console.log("\n🔔 Latest In-App Notification in DB for", targetUser.name, ":", {
        id: notif?._id,
        title: notif?.title,
        message: notif?.message,
        eventKey: notif?.eventKey,
        createdAt: notif?.createdAt
    });

    await mongoose.disconnect();

    console.log("\n==================================================");
    if (emailResult.success) {
        console.log("🎉 SUCCESS: Email successfully sent to 'aastha aman ke biwi'!");
    } else {
        console.log("❌ FAILED to send email:", emailResult.error);
    }
    console.log("==================================================");
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});

