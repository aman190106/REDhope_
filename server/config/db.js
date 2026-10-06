const mongoose = require("mongoose");
const dns = require("dns");

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const connectDB = async () => {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error("MongoDB connection string is missing. Set MONGODB_URI in server/.env.");
    }
    try {
        await mongoose.connect(mongoUri, {
            dbName: process.env.DB_NAME || "REDhope",
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000
        });
        console.log("MongoDB connected");
    } catch (error) {
        throw new Error(`MongoDB connection failed: ${error.message}`);
    }
};

module.exports = connectDB;
