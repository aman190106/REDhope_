const fs = require("fs");
let c = fs.readFileSync("REDhope/src/routes/__root.tsx", "utf8");
c = c.replace(
  '<div className=\\\"min-h-screen flex flex-col\\\"><Outlet /></div>',
  '<div className="min-h-screen flex flex-col"><Outlet /></div>'
);
fs.writeFileSync("REDhope/src/routes/__root.tsx", c, "utf8");
console.log("Fixed __root.tsx");
