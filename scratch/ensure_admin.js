const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const path = require("path");
require(path.join(__dirname, "../server/node_modules/dotenv")).config({ path: path.join(__dirname, "../server/.env") });
const mongoose = require(path.join(__dirname, "../server/node_modules/mongoose"));
const bcrypt = require(path.join(__dirname, "../server/node_modules/bcrypt"));
const user = require(path.join(__dirname, "../server/models/user"));

async function syncAdminToDb(dbName, email, password) {
    const conn = await mongoose.createConnection(process.env.MONGODB_URI, { dbName }).asPromise();
    const UserModel = conn.model("user", user.schema);
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const adminDoc = await UserModel.findOneAndUpdate(
        { email },
        {
            $set: {
                name: "REDhope Administrator",
                email,
                password: hashedPassword,
                phone: "9999999999",
                bloodGroup: "O+",
                role: "admin",
                isEligible: true,
                emailNotifications: true
            }
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    
    console.log(`[${dbName}] Admin configured successfully:`, {
        email: adminDoc.email,
        role: adminDoc.role,
        id: adminDoc._id
    });
    
    await conn.close();
}

async function main() {
    const adminEmail = "admin@redhope.com";
    const password = "admin123";

    console.log(`Ensuring admin account '${adminEmail}' with password '${password}'...`);
    
    // Seed both the local/main db and staging db
    await syncAdminToDb("REDhope", adminEmail, password);
    await syncAdminToDb("REDhope_staging", adminEmail, password);
    
    console.log("All databases updated!");
}

main().catch(console.error);

