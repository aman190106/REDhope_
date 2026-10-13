const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
require("c:/REDhope/REDhope/server/node_modules/dotenv").config({
    path: "c:/REDhope/REDhope/server/.env",
    quiet: true
});
const mongoose = require("c:/REDhope/REDhope/server/node_modules/mongoose");
const camp = require("c:/REDhope/REDhope/server/models/camp");

async function checkCamps() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: "REDhope" });
    const camps = await camp.find({ status: "published" }).limit(5);
    console.log("Published Camps in DB:", JSON.stringify(camps, null, 2));
    await mongoose.disconnect();
}

checkCamps().catch(console.error);

