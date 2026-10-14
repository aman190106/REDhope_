const fs = require("fs");

function polishFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");

  // Hero background and layout
  content = content.replace(
    'className="hero hero-compact"',
    'className="hero hero-compact landing-page border-b border-[var(--landing-border)]"'
  );

  // Body section background
  content = content.replace(
    'style={{ backgroundColor: "var(--background)", minHeight: "60vh" }}',
    'className="landing-page relative" style={{ backgroundColor: "var(--landing-bg)", minHeight: "60vh", paddingTop: 40, paddingBottom: 70 }}'
  );

  // Grid background
  content = content.replace(
    '<section className="features"',
    '<div className="pointer-events-none absolute inset-0 landing-grid-bg opacity-10" aria-hidden="true" />\n      <section className="features"'
  );

  // General colors & styling
  content = content.replace(/className=\"form-section\"/g, 'className="landing-panel"');
  content = content.replace(/className=\"btn\"/g, 'className="btn-landing-primary"');
  content = content.replace(/className=\"btn btn-outline\"/g, 'className="btn-landing-ghost"');

  // Adjust typical text labels to be premium-friendly
  content = content.replace(/color: "var\(--secondary\)"/g, 'color: "var(--landing-text)"');
  content = content.replace(/color: "var\(--gray\)"/g, 'color: "var(--landing-muted)"');
  content = content.replace(/backgroundColor: "white"/g, 'backgroundColor: "var(--landing-surface)"');
  content = content.replace(/background: "white"/g, 'background: "var(--landing-surface)"');

  // Inputs
  content = content.replace(
    /<input/g,
    '<input className="field mt-1.5 bg-white/5 border-[var(--landing-border)] text-[var(--landing-text)] focus:border-[var(--landing-crimson)] focus:ring-[var(--landing-glow)]"'
  );
  content = content.replace(
    /<select/g,
    '<select className="field mt-1.5 bg-white/5 border-[var(--landing-border)] text-[var(--landing-text)] focus:border-[var(--landing-crimson)] focus:ring-[var(--landing-glow)]"'
  );

  fs.writeFileSync(filePath, content, "utf8");
  console.log("Successfully polished: " + filePath);
}

polishFile("REDhope/src/routes/profile.tsx");
