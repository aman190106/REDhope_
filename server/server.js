const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
const express = require("express");
const connectDB = require("./config/db");
const logger = require("./middleware/loggerMiddleware");
const homeRoutes = require("./routes/homeRoutes");
const authRoutes = require("./routes/authRoutes");
const eligibilityRoutes = require("./routes/eligibilityRoutes");
const campRoutes = require("./routes/campRoutes");
const testRoutes = require("./routes/testRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(logger);

// Routes
app.use("/", homeRoutes);
app.use("/auth", authRoutes);
app.use("/eligibility", eligibilityRoutes);
app.use("/camps", campRoutes);
app.use("/", testRoutes);

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
