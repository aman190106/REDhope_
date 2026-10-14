/**
 * Test notifyNearbyDonorsForCamp with a camp organized by someone else
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

async function main() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: "REDhope" });

    const aastha = await user.findOne({ name: { $regex: /aastha/i } });
    console.log("Aastha ID:", aastha._id.toString());

    // Create a disposable test camp organized by a different organizer
    const otherOrganizer = new mongoose.Types.ObjectId();
    const testCamp = await camp.create({
        name: "Gujarat Mega Blood Drive 2026",
        description: "Community blood donation initiative",
        organizer: otherOrganizer,
        location: {
            address: "Sardar Patel Stadium Road",
            city: "Ahmedabad",
            state: "Gujarat",
            pincode: "380014",
            type: "Point",
            coordinates: [72.565, 23.038] // Near Ahmedabad center
        },
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        startTime: "09:00",
        endTime: "17:00",
        capacity: 50,
        registrationCount: 0,
        status: "published"
    });

    console.log("Created published camp by different organizer:", testCamp._id.toString());

    // Trigger nearby donor alert
    const result = await notifyNearbyDonorsForCamp(testCamp, { radiusKm: 30 });
    console.log("Nearby donor batch result:", result);

    // Verify in-app notification for Aastha
    const notif = await notification.findOne({
        user: aastha._id,
        "metadata.campId": testCamp._id.toString()
    });
    console.log("Created notification for Aastha:", {
        id: notif?._id,
        title: notif?.title,
        eventKey: notif?.eventKey
    });

    // Cleanup disposable camp
    await camp.findByIdAndDelete(testCamp._id);
    if (notif) await notification.findByIdAndDelete(notif._id);

    await mongoose.disconnect();
}

main().catch(console.error);

