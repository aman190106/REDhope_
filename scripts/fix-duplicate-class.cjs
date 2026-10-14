const fs = require("fs");

function fixFile(path) {
  let c = fs.readFileSync(path, "utf8");
  c = c.replace(
    'className="features" className="landing-page relative"',
    'className="features landing-page relative"'
  );
  fs.writeFileSync(path, c, "utf8");
  console.log("Fixed " + path);
}

fixFile("src/routes/camps/$campId.tsx");
fixFile("src/routes/profile.tsx");
