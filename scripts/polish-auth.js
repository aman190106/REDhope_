const fs = require("fs");

function polishFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");

  // 1. Root container
  content = content.replace(
    'className="min-h-screen flex flex-col bg-slate-50"',
    'className="landing-page min-h-screen flex flex-col relative overflow-hidden"'
  );

  // 2. Navbar and Footer themes
  content = content.replace("<Navbar />", "<Navbar theme=\"premium\" />");
  content = content.replace("<Footer />", "<Footer theme=\"premium\" />");

  // 3. Main layout additions (grid background and relative z-index)
  if (!content.includes("landing-grid-bg")) {
    content = content.replace(
      "<Navbar theme=\"premium\" />",
      "<Navbar theme=\"premium\" />\n\n      <div className=\"pointer-events-none absolute inset-0 landing-grid-bg opacity-20\" aria-hidden=\"true\" />"
    );
    content = content.replace(
      "<main className=\"flex-1",
      "<main className=\"relative z-[1] flex-1"
    );
  }

  // 4. Panel styling
  content = content.replace(/className=\"panel/g, 'className="landing-panel');
  
  // 5. Buttons
  content = content.replace(/className=\"btn-primary/g, 'className="btn-landing-primary');
  
  // 6. Typography & Brand colors
  content = content.replace(/text-slate-900/g, 'text-[var(--landing-text)]');
  content = content.replace(/text-slate-800/g, 'text-[var(--landing-text)]');
  content = content.replace(/text-slate-600/g, 'text-[var(--landing-muted)]');
  content = content.replace(/text-slate-500/g, 'text-[var(--landing-dim)]');
  
  // 7. Forms
  content = content.replace(
    /className=\"field mt-1\"/g,
    'className="field mt-1.5 bg-white/5 border-[var(--landing-border)] text-[var(--landing-text)] focus:border-[var(--landing-crimson)] focus:ring-[var(--landing-glow)]"'
  );

  // 8. Logo variant
  content = content.replace("<RedHopeLogo size=\"lg\" />", "<RedHopeLogo size=\"lg\" variant=\"dark\" />");

  // 9. Specific fixes for borders and cards
  content = content.replace(/border-slate-200/g, 'border-[var(--landing-border)]');
  content = content.replace(/border-slate-100/g, 'border-[var(--landing-border)]');
  content = content.replace(/bg-white/g, 'bg-transparent');

  fs.writeFileSync(filePath, content, "utf8");
  console.log("Successfully polished: " + filePath);
}

polishFile("REDhope/src/routes/login.tsx");
polishFile("REDhope/src/routes/register.tsx");
