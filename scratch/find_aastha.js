const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
require("c:/REDhope/REDhope/server/node_modules/dotenv").config({
    path: "c:/REDhope/REDhope/server/.env",
    quiet: true
});
const mongoose = require("c:/REDhope/REDhope/server/node_modules/mongoose");
const user = require("c:/REDhope/REDhope/server/models/user");

async function search() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: "REDhope" });
    const users = await user.find({ name: { $regex: /aastha/i } }).select("-password");
    console.log("Matches found for 'aastha':", JSON.stringify(users, null, 2));
    
    // Also search for biwi or any recent users if not found
    if (users.length === 0) {
        const biwiUsers = await user.find({ name: { $regex: /biwi/i } }).select("-password");
        console.log("Matches found for 'biwi':", JSON.stringify(biwiUsers, null, 2));
        
        const allUsers = await user.find().select("name email phone bloodGroup role location").limit(20);
        console.log("Sample users in DB:", JSON.stringify(allUsers, null, 2));
    }

    await mongoose.disconnect();
}

search().catch(console.error);

