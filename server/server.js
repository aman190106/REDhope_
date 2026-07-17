require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const logger = require("./middleware/loggerMiddleware");
const homeRoutes = require("./routes/homeRoutes");
const testRoutes = require("./routes/testRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(logger);

// Routes
app.use("/", homeRoutes);
app.use("/", testRoutes);

// Connect to MongoDB
connectDB();

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});