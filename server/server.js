
require("dotenv").config();
process.env.PORT
process.env.MONGODB_URL
const connectDB=require("./config/db")
const express = require("express");
const logger = require("./middleware/loggerMiddleware");
const homeRoutes = require("./routes/homeRoutes");
const testRoutes=require("./routes/testRoutes");
const app = express();
const PORT = 5000;
console.log(process.env.PORT);
// before exectucuting anything logger get called
app.use(express.json());
app.use(logger);
app.use("/", homeRoutes);
app.use("/",testRoutes);
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});