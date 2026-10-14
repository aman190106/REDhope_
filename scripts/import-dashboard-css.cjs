const fs = require("fs");
let css = fs.readFileSync("REDhope/src/styles.css", "utf8");
if (!css.includes("dashboard-premium.css")) {
  css = css.replace(
    '@import "./styles/landing.css";',
    '@import "./styles/landing.css";\n@import "./styles/dashboard-premium.css";'
  );
  fs.writeFileSync("REDhope/src/styles.css", css, "utf8");
  console.log("Successfully imported dashboard-premium.css");
} else {
  console.log("Already imported");
}
