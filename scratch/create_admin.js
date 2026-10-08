const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config({ path: "c:/REDhope/REDhope/server/.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const user = require("c:/REDhope/REDhope/server/models/user");

async function main() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: "REDhope" });

    const adminEmail = "admin@redhope.com";
    const passwordPlain = "Admin123!";
    const hashedPassword = await bcrypt.hash(passwordPlain, 10);

    const adminDoc = await user.findOneAndUpdate(
        { email: adminEmail },
        {
            $set: {
                name: "REDhope Administrator",
                email: adminEmail,
                password: hashedPassword,
                phone: "9999999999",
                bloodGroup: "O+",
                role: "admin",
                emailNotifications: true
            }
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    console.log("Admin account successfully configured:", {
        email: adminDoc.email,
        role: adminDoc.role,
        id: adminDoc._id
    });

    await mongoose.connection.close();
}

main().catch(console.error);

