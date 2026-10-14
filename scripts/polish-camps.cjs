const fs = require("fs");

function polishFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");

  // Root container
  content = content.replace(
    'className="min-h-screen flex flex-col bg-slate-50"',
    'className="landing-page min-h-screen flex flex-col relative overflow-hidden"'
  );

  // Navbar/Footer
  content = content.replace("<Navbar />", "<Navbar theme=\"premium\" />");
  content = content.replace("<Footer />", "<Footer theme=\"premium\" />");

  // Grid background
  if (!content.includes("landing-grid-bg")) {
    content = content.replace(
      "<Navbar theme=\"premium\" />",
      "<Navbar theme=\"premium\" />\n\n      <div className=\"pointer-events-none absolute inset-0 landing-grid-bg opacity-10\" aria-hidden=\"true\" />"
    );
    content = content.replace(
      '<main className="flex-1',
      '<main className="relative z-[1] flex-1'
    );
  }

  // Panel, Buttons, etc
  content = content.replace(/className=\"panel/g, 'className="landing-panel');
  content = content.replace(/className=\"btn-primary/g, 'className="btn-landing-primary');
  content = content.replace(/className=\"btn-secondary/g, 'className="btn-landing-ghost');
  
  // Colors
  content = content.replace(/text-slate-900/g, 'text-[var(--landing-text)]');
  content = content.replace(/text-slate-800/g, 'text-[var(--landing-text)]');
  content = content.replace(/text-slate-700/g, 'text-[var(--landing-muted)]');
  content = content.replace(/text-slate-600/g, 'text-[var(--landing-muted)]');
  content = content.replace(/text-slate-500/g, 'text-[var(--landing-dim)]');
  content = content.replace(/text-slate-400/g, 'text-[var(--landing-dim)]');

  // Fields
  content = content.replace(
    /className=\"field mt-1\"/g,
    'className="field mt-1.5 bg-white/5 border-[var(--landing-border)] text-[var(--landing-text)] focus:border-[var(--landing-crimson)] focus:ring-[var(--landing-glow)]"'
  );

  // Borders & Backgrounds
  content = content.replace(/border-slate-200/g, 'border-[var(--landing-border)]');
  content = content.replace(/bg-white/g, 'bg-transparent');
  content = content.replace('bg-red-600 text-white', 'bg-[var(--landing-crimson)] text-white');

  fs.writeFileSync(filePath, content, "utf8");
  console.log("Successfully polished: " + filePath);
}

polishFile("REDhope/src/routes/camps/index.tsx");
