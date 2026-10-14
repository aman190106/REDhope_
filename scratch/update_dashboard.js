const fs = require('fs');
let code = fs.readFileSync('src/routes/dashboard.tsx', 'utf8');

const returnIdx = code.indexOf('  return (\n    <AppLayout');
if (returnIdx === -1) {
  // Check with \r\n
  const crlfIdx = code.indexOf('  return (\r\n    <AppLayout');
  console.log('crlfIdx:', crlfIdx);
}
console.log('returnIdx:', returnIdx);

const newReturn = `  return (
    <AppLayout activeNav="dashboard">
      <div className="max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <p className="text-red-600 text-xs font-bold uppercase tracking-wider">DONOR DASHBOARD</p>
            <h1 className="text-3xl font-bold text-slate-900 mt-1">Welcome back, {user.name}</h1>
            <p className="text-slate-600 text-sm mt-1">Your private donation overview · verified donor record</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleAvailability}
              disabled={togglingStatus}
              className={\`px-3 py-1.5 rounded-lg text-xs font-bold border transition \${
                isAvailable ? "border-green-300 bg-green-50 text-green-700" : "border-slate-300 bg-white text-slate-600"
              }\`}
            >
              <i className={\`fas fa-toggle-\${isAvailable ? "on text-green-600" : "off"} mr-1.5\`} />
              <span>{isAvailable ? "Available for Calls" : "Unavailable"}</span>
            </button>
            <Link to="/profile" className="btn-secondary text-xs">
              Profile
            </Link>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 mt-6">
          <Link to="/matching" className="btn-primary">
            Find Blood
          </Link>
          <Link to="/camps" className="btn-secondary">
            Find Camps
          </Link>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="metric">
            <p className="text-xs text-slate-500 font-medium">Blood group</p>
            <p className="text-2xl font-bold mt-1 text-slate-900">{user.bloodGroup || "O+"}</p>
            <span className={\`badge \${isMedicallyEligible ? "badge-green" : "badge-amber"} mt-2\`}>
              {isMedicallyEligible ? "Eligible" : "Cooldown"}
            </span>
          </div>

          <div className="metric">
            <p className="text-xs text-slate-500 font-medium">Total donations</p>
            <p className="text-2xl font-bold mt-1 text-slate-900">{completedDonationsCount}</p>
            <p className="text-xs text-slate-500 mt-2">Verified donations</p>
          </div>

          <div className="metric">
            <p className="text-xs text-slate-500 font-medium">Lives potentially helped</p>
            <p className="text-2xl font-bold mt-1 text-slate-900">{completedDonationsCount * 3}</p>
            <p className="text-xs text-slate-500 mt-2">Educational estimate</p>
          </div>

          <div className="metric">
            <p className="text-xs text-slate-500 font-medium">Next eligible date</p>
            <p className="text-lg font-bold mt-1 text-slate-900">
              {eligibility?.nextEligibleDate ? formatDate(eligibility.nextEligibleDate) : "Eligible Today"}
            </p>
            <p className="text-xs text-slate-500 mt-2">Subject to screening</p>
          </div>
        </div>

        {/* Middle Section: Upcoming Camps & Health Screening Widget */}
        <div className="grid lg:grid-cols-3 gap-5 mt-6">
          {/* Upcoming Camps Panel */}
          <section className="panel p-5 lg:col-span-2 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-900 text-lg">Upcoming camps</h2>
              <Link to="/camps" className="text-red-600 font-bold text-xs hover:underline">
                Explore all drives &rarr;
              </Link>
            </div>

            {loadingData ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                <i className="fas fa-spinner fa-spin mr-2" /> Loading camps...
              </div>
            ) : campsRegistered.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm mb-3">You have not registered for any upcoming camps.</p>
                <Link to="/camps" className="btn-secondary text-xs">
                  Browse Donation Camps
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {campsRegistered.map((reg) => (
                  <div
                    key={reg._id}
                    className="flex justify-between items-center border-b border-slate-100 pb-3 last:border-none last:pb-0"
                  >
                    <div>
                      <b className="text-slate-900 text-sm">{reg.camp?.name || "Community Drive"}</b>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(reg.camp?.startDate)} · {reg.camp?.location?.city || "Local Venue"}
                      </p>
                    </div>
                    <span className="badge badge-green">Registered</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Health Screening Widget Panel */}
          <aside className="panel p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-slate-900 text-lg">Health screening</h2>
                <span className={\`badge \${isMedicallyEligible ? "badge-green" : "badge-amber"}\`}>
                  {isMedicallyEligible ? "Valid" : "Review due"}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                Update your health questionnaire and upload private medical documents before attending your next drive.
              </p>
            </div>
            <Link to="/health-screening" className="btn-secondary mt-5 w-full text-center">
              Open screening
            </Link>
          </aside>
        </div>

        {/* Lower Section: Recent Donations & Notifications */}
        <div className="grid lg:grid-cols-2 gap-5 mt-6">
          {/* Recent Donations Panel */}
          <section className="panel p-5 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-900 text-lg">Recent donations</h2>
              <Link to="/donations" className="text-red-600 font-bold text-xs hover:underline">
                View history &rarr;
              </Link>
            </div>

            {donations.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                No verified donation records found.
              </div>
            ) : (
              <div className="space-y-3">
                {donations.slice(0, 3).map((d) => (
                  <div key={d._id} className="text-sm text-slate-600 flex justify-between items-center border-b border-slate-100 pb-2.5 last:border-none">
                    <span>
                      {formatDate(d.donationDate)} · {d.camp?.name || "Donation Camp"}
                    </span>
                    <span className="badge badge-green capitalize">{d.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Notifications Panel */}
          <section className="panel p-5 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-slate-900 text-lg">Notifications</h2>
              <Link to="/notifications" className="text-red-600 font-bold text-xs hover:underline">
                All alerts &rarr;
              </Link>
            </div>
            <div className="space-y-3 text-sm">
              <p className="text-slate-700">
                <span className="badge badge-amber mr-2">Status</span>
                Your donation availability is updated and synchronized.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
                Your location is shared only approximately when you choose to be discoverable in donor matching.
              </p>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
`;

const targetIdx = code.indexOf('  return (\r\n    <AppLayout pageTitle="Donor Dashboard">');
if (targetIdx !== -1) {
  const updated = code.substring(0, targetIdx) + newReturn;
  fs.writeFileSync('src/routes/dashboard.tsx', updated);
  console.log('Successfully updated dashboard.tsx via CRLF match');
} else {
  const lfIdx = code.indexOf('  return (\n    <AppLayout pageTitle="Donor Dashboard">');
  if (lfIdx !== -1) {
    const updated = code.substring(0, lfIdx) + newReturn;
    fs.writeFileSync('src/routes/dashboard.tsx', updated);
    console.log('Successfully updated dashboard.tsx via LF match');
  } else {
    console.error('Could not find return statement in dashboard.tsx');
  }
}

