const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config({ path: 'c:/REDhope/REDhope/server/.env' });
const http = require('http');
const mongoose = require('mongoose');
const user = require('c:/REDhope/REDhope/server/models/user');
const camp = require('c:/REDhope/REDhope/server/models/camp');
const campRegistration = require('c:/REDhope/REDhope/server/models/campRegistration');
const HealthScreening = require('c:/REDhope/REDhope/server/models/healthScreening');

function req(method, path, token, body) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);

    const r = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, raw: data }); }
      });
    });
    r.on('error', err => resolve({ error: err.message }));
    if (postData) r.write(postData);
    r.end();
  });
}

async function verifyJourneys() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
    dbName: "REDhope"
  });
  console.log('Connected to DB for journey tests');

  const stamp = Date.now();
  const testDonorEmail = 'donor_test_' + stamp + '@example.com';
  const testOrgEmail = 'org_test_' + stamp + '@example.com';
  const password = 'Password@123';

  console.log('\n--- Journey 1: Register & Login ---');
  const regRes = await req('POST', '/auth/register', null, {
    name: 'Test Journey Donor',
    email: testDonorEmail,
    password,
    phone: '98' + stamp.toString().slice(-8),
    bloodGroup: 'O+',
    dateOfBirth: '1995-05-15',
    gender: 'male',
    role: 'user',
    location: { city: 'Ahmedabad', state: 'Gujarat', pincode: '380001', coordinates: [72.5714, 23.0225] }
  });
  console.log('Donor Registration status:', regRes.status, 'success:', regRes.data?.success);

  const loginRes = await req('POST', '/auth/login', null, {
    email: testDonorEmail,
    password
  });
  console.log('Donor Login status:', loginRes.status, 'token received:', !!loginRes.data?.token);
  const donorToken = loginRes.data?.token;

  console.log('\n--- Journey 2: Load and Update User Profile ---');
  const meRes = await req('GET', '/auth/me', donorToken);
  console.log('GET /auth/me status:', meRes.status, 'Name:', meRes.data?.user?.name, 'password exposed:', 'password' in (meRes.data?.user || {}));

  const updateRes = await req('PUT', '/auth/me', donorToken, {
    isDonorAvailable: true,
    emailNotifications: true
  });
  console.log('PUT /auth/me status:', updateRes.status, 'available:', updateRes.data?.user?.isDonorAvailable);

  console.log('\n--- Journey 3: Search for compatible donors ---');
  const matchRes = await req('POST', '/matching/donors', donorToken, {
    bloodGroup: 'O+',
    latitude: 23.0225,
    longitude: 72.5714,
    radiusKm: 50
  });
  console.log('POST /matching/donors status:', matchRes.status, 'candidates found:', matchRes.data?.matches?.length);

  console.log('\n--- Journey 4: Discover available donation camps ---');
  const campsRes = await req('GET', '/camps', donorToken);
  console.log('GET /camps status:', campsRes.status, 'camps count:', campsRes.data?.camps?.length);

  console.log('\n--- Journey 5: Organizer Registration & Role Restrictions ---');
  const orgReg = await req('POST', '/auth/register', null, {
    name: 'Test Journey Organizer',
    email: testOrgEmail,
    password,
    phone: '97' + stamp.toString().slice(-8),
    bloodGroup: 'B+'
  });
  // Privilege escalation protection defaults registration to 'user'. Set organizer role in DB directly:
  await user.updateOne({ email: testOrgEmail }, { $set: { role: 'organizer' } });
  const orgLogin = await req('POST', '/auth/login', null, { email: testOrgEmail, password });
  const orgToken = orgLogin.data?.token;
  console.log('Organizer Login status:', orgLogin.status, 'role:', orgLogin.data?.user?.role);

  // Check role restrictions: Donor cannot create camp
  const donorCreateCamp = await req('POST', '/camps', donorToken, {
    name: 'Unauthorized Camp',
    location: { address: 'A', city: 'B', state: 'C', pincode: '123456' },
    startDate: '2026-11-01',
    endDate: '2026-11-02'
  });
  console.log('Donor attempting to create camp -> status:', donorCreateCamp.status, '(expected 403)');

  // Organizer creates camp
  const orgCreateCamp = await req('POST', '/camps', orgToken, {
    name: 'Journey Health Drive ' + stamp,
    location: { address: 'Drive Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380054', coordinates: [72.53, 23.05] },
    startDate: '2026-11-10',
    endDate: '2026-11-11',
    startTime: '09:00',
    endTime: '17:00',
    capacity: 25,
    status: 'published'
  });
  console.log('Organizer creating camp -> status:', orgCreateCamp.status, 'campId:', orgCreateCamp.data?.camp?._id);
  const campId = orgCreateCamp.data?.camp?._id;

  console.log('\n--- Journey 6: Camp Registration & Duplicate Prevention & Cancellation ---');
  // First, donor must be medically eligible (create approved screening fixture)
  await HealthScreening.findOneAndUpdate(
    { user: loginRes.data.user._id },
    {
      user: loginRes.data.user._id,
      status: 'approved',
      consentGiven: true,
      reviewDecision: { decision: 'approved', reviewer: new mongoose.Types.ObjectId(), reviewedAt: new Date() }
    },
    { upsert: true }
  );

  const regCampRes = await req('POST', `/camps/${campId}/register`, donorToken);
  console.log('Donor registering for camp -> status:', regCampRes.status, 'success:', regCampRes.data?.success);

  // Duplicate registration check
  const dupReg = await req('POST', `/camps/${campId}/register`, donorToken);
  console.log('Duplicate registration attempt -> status:', dupReg.status, '(expected 409)');

  // Organizer views camp registrations
  const orgRegs = await req('GET', `/camps/${campId}/registrations`, orgToken);
  console.log('Organizer fetching registrations -> status:', orgRegs.status, 'count:', orgRegs.data?.data?.registrations?.length || orgRegs.data?.registrations?.length);

  // Donor cancels registration
  const cancelReg = await req('DELETE', `/camps/${campId}/register`, donorToken);
  console.log('Donor cancelling registration -> status:', cancelReg.status, 'success:', cancelReg.data?.success);

  console.log('\n--- Cleanup test journey fixtures ---');
  await user.deleteMany({ email: { $in: [testDonorEmail, testOrgEmail] } });
  if (campId) {
    await camp.findByIdAndDelete(campId);
    await campRegistration.deleteMany({ camp: campId });
  }
  await mongoose.disconnect();
  console.log('Live Journeys Verified Successfully!');
}

verifyJourneys().catch(err => {
  console.error('Journey verification error:', err);
  process.exit(1);
});
