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
    'style={{ backgroundColor: "var(--background)", minHeight: "65vh", paddingTop: 40, paddingBottom: 70 }}',
    'className="landing-page relative" style={{ backgroundColor: "var(--landing-bg)", minHeight: "65vh", paddingTop: 40, paddingBottom: 70 }}'
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
  content = content.replace(/color: "#6c757d"/g, 'color: "var(--landing-dim)"');
  content = content.replace(/backgroundColor: "var\(--background\)"/g, 'backgroundColor: "var(--landing-surface)"');
  content = content.replace(/borderTop: "1px solid var\(--light-gray\)"/g, 'borderTop: "1px solid var(--landing-border)"');

  // Forms inside inline auth
  content = content.replace(
    /type=\"email\"/g,
    'type="email" className="field mt-1.5 bg-white/5 border-[var(--landing-border)] text-[var(--landing-text)] focus:border-[var(--landing-crimson)] focus:ring-[var(--landing-glow)]"'
  );
  content = content.replace(
    /type=\"password\"/g,
    'type="password" className="field mt-1.5 bg-white/5 border-[var(--landing-border)] text-[var(--landing-text)] focus:border-[var(--landing-crimson)] focus:ring-[var(--landing-glow)]"'
  );

  fs.writeFileSync(filePath, content, "utf8");
  console.log("Successfully polished: " + filePath);
}

polishFile("REDhope/src/routes/camps/$campId.tsx");
