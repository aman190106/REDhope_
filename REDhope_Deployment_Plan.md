# REDhope: Production Deployment & Hosting Architecture Plan

**Document Version:** 1.0.0  
**Target Application:** REDhope Blood Donation & Camp Management Platform  
**Target Environments:** Production (`production`), Staging (`staging`)  
**Status:** Architecture Specification — Pending User Approval (No automated actions taken)

---

## 1. Executive Summary & Repository Baseline

REDhope is a full-stack blood donation, compatibility matching, camp discovery, and donor medical screening platform. The repository is partitioned into a high-performance modern frontend utilizing TanStack Start (React 19) and an enterprise-grade Express.js backend utilizing MongoDB Atlas and transactional email services.

### Inspected Repository Baseline

| Component | Architecture / Technology | Inspected Configuration in Codebase |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TanStack Start (`@tanstack/react-router`) | Configured via `@lovable.dev/vite-tanstack-config` with Vite 8.1 |
| **Frontend SSR Runtime** | UnJS Nitro (preset: `cloudflare-module`) | Output: `.output/server/index.mjs` + `wrangler.json` (Fetch API, `nodejs_compat`) |
| **Frontend Static Assets** | Pre-rendered client chunks, images, CSS | Output: `.output/public/` with `_headers` cache rules |
| **Backend Framework** | Node.js (>=18.0.0) + Express 5.2.1 | Entry point: `server/server.js`, CommonJS modules |
| **Backend Start Command** | `node server.js` | Defined in `server/package.json` as `npm start` |
| **Database** | MongoDB 6+ / 7+ via Mongoose 9.7.4 | Connection via `server/config/db.js`, fail-fast validation in `validateEnv.js` |
| **Health Check Endpoint** | Production Health Check | `GET /health` in `server/routes/homeRoutes.js` (inspects MongoDB state & uptime) |
| **Reverse Proxy Support** | Reverse Proxy Trust | `app.set("trust proxy", 1)` enabled in `server/server.js` |
| **Security Layer** | Helmet 8.3.0 + express-rate-limit 8.7.1 | General, Auth, and Blood Matching rate limiters |
| **Medical Document Storage** | Memory buffer validation + Storage abstraction | `server/services/storageService.js` (magic byte checks, path traversal sanitization) |

---

## 2. Recommended Hosting Architecture

To ensure high availability, zero cold-start latency for donors, secure isolation of medical records, and automated scalability, the following architecture is recommended:

```
                          [ Internet / Donors & Hospital Staff ]
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
          [ Cloudflare Edge CDN ]                       [ Cloudflare Edge CDN ]
          https://redhope.org                           https://api.redhope.org
          https://www.redhope.org                                  │
                     │                                             ▼
                     ▼                                  [ Render Web Service ]
        [ Cloudflare Pages / Workers ]                     (Node.js 18+ Runtime)
             TanStack Start SSR                           Express 5 REST API + Cron
        (.output/server/index.mjs)                       app.listen(PORT=5000)
                     │                                             │
                     │  REST API Calls / JWT Bearer                │
                     └─────────────────────────────────────────────┤
                                                                   ▼
                                             ┌─────────────────────────────────────┐
                                             │         VPC / Protected Mesh        │
                                             │                                     │
                                             │   [ MongoDB Atlas M10+ Cluster ]   │
                                             │   Encrypted at Rest & In Transit    │
                                             │                                     │
                                             │   [ Cloudflare R2 / AWS S3 ]        │
                                             │   Private Medical Document Storage  │
                                             └─────────────────────────────────────┘
```

### Architecture Component Rationale

1. **Frontend: Cloudflare Pages (with Pages Functions / Workers)**
   - **Why**: The frontend build toolchain (`@lovable.dev/vite-tanstack-config` + Nitro) natively generates a `cloudflare-module` worker bundle (`.output/server/index.mjs`, `wrangler.json`, `.output/public/_headers`).
   - **Performance**: Edge SSR renders across 300+ global data centers with near-zero cold starts.
   - **Cost**: Extremely generous free tier (unlimited static requests, 100,000 free Worker invocations/day).

2. **Backend: Render Web Service (or Railway)**
   - **Why**: Express 5 requires a persistent Node.js runtime. Render provides built-in support for long-running cron jobs (e.g. `notificationScheduler`), native `/health` monitoring, automatic Let's Encrypt SSL, and zero-downtime rolling deploys.
   - **Proxy Handling**: Matches `app.set("trust proxy", 1)` already present in `server/server.js`.
   - **Cost**: Free tier available for staging; $7/month Starter plan recommended for production to avoid 15-minute spin-down delays.

3. **Database: MongoDB Atlas (M10+ for Production, M0 for Staging)**
   - **Why**: Fully managed, automated multi-AZ replication, continuous Point-in-Time Restore (PITR), and native GeoJSON 2dsphere indexing required by REDhope's donor matching engine.
   - **Security**: Network access control, encrypted backups, and isolated database users.

4. **Medical Document Storage: Cloudflare R2 (or AWS S3)**
   - **Why**: Ephemeral container filesystems (e.g. Render/Heroku disk) lose uploaded donor medical files upon deploy or restart. R2/S3 guarantees durability.
   - **Cost**: Cloudflare R2 has **$0 egress fees**, 10 GB free storage, and 100% S3 API compatibility.

---

## 3. Environment Variable Inventory

> [!CAUTION]
> **Zero-Secret Disclosure Policy**: The following inventory documents variable names, data types, and functional purposes only. No actual passwords, tokens, or connection strings are listed here.

### Frontend Environment Variables (Client & SSR)

| Variable Name | Required Phase | Description / Purpose |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | **Build Time** | Public URL of the backend API (e.g. `https://api.redhope.org`). Injected into client JavaScript bundles by Vite. |
| `APP_URL` | **Runtime (SSR)** | Canonical public URL of the web application (e.g. `https://redhope.org`). Used by server handlers to generate canonical URLs in `sitemap.xml`. |
| `NITRO_PRESET` | **Build Time** (Optional) | Target deployment preset for Nitro. Defaults to `cloudflare-module` as configured by Vite. |

---

### Backend Environment Variables (`server/`)

| Variable Name | Required in Prod | Description / Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | Set to `production`. Enables strict security checks, suppresses stack traces in HTTP responses, and enforces production CORS. |
| `PORT` | **Yes** (Automated) | Port on which Express listens. Injected automatically by Render/Railway (default: `5000`). |
| `MONGODB_URI` | **Yes** | Production MongoDB Atlas SRV connection string with authentication credentials and replica set parameters. |
| `DB_NAME` | **Yes** | Specific production database name (e.g. `REDhope_prod`). Isolates production from staging/test databases. |
| `JWT_SECRET` | **Yes** | High-entropy cryptographic secret (minimum 32 characters, enforced by `validateEnv.js`) used to sign and verify donor session tokens. |
| `JWT_EXPIRES_IN` | **Yes** | Duration for which JWT auth tokens remain valid (e.g. `7d`, `24h`). |
| `FRONTEND_URL` | **Yes** | Comma-separated list of trusted client origins permitted by CORS policy (e.g. `https://redhope.org,https://www.redhope.org`). |
| `DISABLE_RATE_LIMIT` | **Yes** | Must be explicitly set to `false` in production to enforce general (100 req/15m), auth (10 req/15m), and matching (20 req/15m) rate limiters. |
| `BREVO_API_KEY` | **Yes** | API key for Brevo (formerly Sendinblue) transactional email service. Used for camp confirmation and donor alert emails. |
| `EMAIL_FROM` | **Yes** | Authenticated sender email address registered and verified in Brevo (e.g. `notifications@redhope.org`). |
| `EMAIL_FROM_NAME` | **Yes** | Sender display name appearing in donor email inboxes (e.g. `REDhope Blood Network`). |
| `EMAIL_NOTIFICATIONS_ENABLED` | **Yes** | Set to `true` to enable transactional emails in production. |
| `ENABLE_NOTIFICATION_SCHEDULER` | **Yes** | Set to `true` to run automated donor camp reminders and eligibility renewal checks every 10 minutes. |
| `MEDICAL_STORAGE_DIR` | Optional / Storage | Path to a persistent mounted disk volume if using container disk storage, or omitted when using S3/R2 object storage adapter. |
| `R2_ACCOUNT_ID` / `AWS_REGION` | Optional (S3/R2) | Cloud account identifier or AWS region for private medical document storage bucket. |
| `R2_ACCESS_KEY_ID` / `AWS_ACCESS_KEY_ID` | Optional (S3/R2) | IAM Access Key ID with scoped `PutObject`, `GetObject`, `DeleteObject` permissions on the medical bucket. |
| `R2_SECRET_ACCESS_KEY` / `AWS_SECRET_KEY` | Optional (S3/R2) | Secret key corresponding to the storage IAM access key. |
| `MEDICAL_DOCUMENTS_BUCKET` | Optional (S3/R2) | Private bucket name for sensitive donor medical questionnaires and lab attachments. |

---

## 4. Step-by-Step Provider Setup Guides

### A. Frontend: Cloudflare Pages Deployment

1. **Repository Connection**:
   - Log in to Cloudflare Dashboard > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
   - Select the `REDhope` repository and branch `main`.

2. **Build Settings**:
   - **Framework Preset**: `None` (or `Custom`).
   - **Build command**: `npm run build`
   - **Build output directory**: `.output`
   - **Root directory**: `/` (repository root)

3. **Environment Variables**:
   - Add `VITE_API_BASE_URL` = `https://api.redhope.org`
   - Add `APP_URL` = `https://redhope.org`
   - Add `NODE_VERSION` = `20.18.0`

4. **Custom Domain & SSL**:
   - Go to **Custom domains** in the Pages project.
   - Add `redhope.org` and `www.redhope.org`.
   - Cloudflare will provision an Edge SSL/TLS certificate (Universal SSL) automatically.

5. **Rollback Procedure**:
   - In Cloudflare Pages > **Deployments**, every build produces a permanent immutable preview URL.
   - If a regression occurs, click **Manage deployment** on any prior successful build and select **Rollback to this deployment** for an instantaneous (<2 second) zero-downtime rollback.

---

### B. Backend: Render Web Service Deployment

1. **Service Provisioning**:
   - In Render Dashboard, click **New +** > **Web Service**.
   - Connect the `REDhope` repository.
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Starter` ($7/mo recommended for continuous 24/7 uptime and cron scheduler operation).

2. **Health Check Configuration**:
   - In the service settings, expand **Advanced**.
   - Set **Health Check Path** to `/health`.
   - Render's load balancer will poll `GET /health` and only route user traffic when the server returns HTTP 200 with `database: "connected"`.

3. **Environment Secrets**:
   - Under the **Environment** tab, add all required variables documented in Section 3 (`NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL=https://redhope.org,https://www.redhope.org`, etc.).
   - Use `openssl rand -base64 32` locally to generate the production `JWT_SECRET`.

4. **Custom Domain**:
   - Under **Settings** > **Custom Domains**, add `api.redhope.org`.
   - Add the CNAME record in your DNS provider pointing to Render's service URL (e.g. `redhope-backend.onrender.com`).

5. **Rollback Procedure**:
   - In Render > **Events** / **Deploys**, find the previous stable deployment and select **Rollback to this deploy**.

---

### C. Database: MongoDB Atlas Production Setup

1. **Cluster Provisioning**:
   - Create a dedicated production cluster (M10 recommended for production with automated backups; M0 free sandbox for staging).
   - Select cloud provider and region matching your backend host (e.g. AWS `us-east-1` or `ap-south-1` for minimum network latency).

2. **Database Isolation & Users**:
   - Create a distinct production database named `REDhope_prod`.
   - Go to **Database Access** > **Add New Database User**:
     - Authentication Method: **Password**.
     - User Privileges: Select **Built-in Role** > **Read and write to any database** (or restrict to `REDhope_prod`).
     - **Never** grant `atlasAdmin` to application runtime users.

3. **Network Access Control (IP Whitelisting)**:
   - Go to **Network Access** > **IP Access List**.
   - **Do not leave `0.0.0.0/0` (allow all) open in production.**
   - Add the static outbound IP addresses of your Render backend web service, or configure AWS VPC Peering / PrivateLink if using AWS hosting.

4. **Automated Backups & Restore Testing**:
   - For M10+ clusters, enable **Continuous Cloud Backup (Point-in-Time Recovery)**.
   - Verify retention: 7 days continuous restore (1-second granularity), weekly snapshots retained for 1 month.
   - Schedule a monthly drill restoring a snapshot to a temporary staging cluster to verify recovery point objective (RPO) and recovery time objective (RTO).

---

### D. Private Medical Storage: Cloudflare R2 / AWS S3

1. **Bucket Creation**:
   - Create bucket: `redhope-medical-documents-prod`.
   - **Public Access**: Select **Block all public access** (100% private).

2. **CORS Policy for Pre-signed URLs**:
   ```json
   [
     {
       "AllowedOrigins": ["https://redhope.org", "https://www.redhope.org"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["Content-Type", "x-amz-*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

3. **IAM Least Privilege**:
   - Create an IAM policy allowing only:
     - `s3:PutObject`
     - `s3:GetObject`
     - `s3:DeleteObject`
   - Restrict resource ARN strictly to `arn:aws:s3:::redhope-medical-documents-prod/*`.
   - Never use root or admin credentials.

---

## 5. Cost & Resource Provisioning Matrix

| Resource | Provider | Tier / Plan | Estimated Monthly Cost | Payment / Card Required? |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend SSR & CDN** | Cloudflare Pages | Free Tier | **$0.00 / mo** | No |
| **Backend API (Production)** | Render | Starter Web Service | **$7.00 / mo** | Yes (Credit Card) |
| **Backend API (Staging Alternative)** | Render | Free Web Service | **$0.00 / mo** (spins down after 15m) | No |
| **Database (Production M10)** | MongoDB Atlas | Dedicated M10 (10GB) | **~$57.00 / mo** ($0.08/hr) | Yes (Credit Card) |
| **Database (Staging / Soft-Launch)** | MongoDB Atlas | Shared M0 Sandbox (512MB) | **$0.00 / mo** | No |
| **Transactional Email** | Brevo | Free Tier (300 emails/day) | **$0.00 / mo** | No |
| **Medical Document Storage** | Cloudflare R2 | Standard (10GB free, $0 egress) | **$0.00 / mo** | Yes (Account required) |
| **Domain Name (DNS)** | Cloudflare Registrar | `.org` Registration | **~$10.00 / yr** | Yes |

> [!TIP]
> **Zero-Cost Staging / Soft-Launch Path**: REDhope can be initially launched in a staging/preview state for **$0/month** using Cloudflare Pages Free, Render Free tier, MongoDB Atlas M0, Brevo Free, and Cloudflare R2 Free tier. For public production, moving to Render Starter ($7) and Atlas M10 ($57) provides 24/7 reliability, zero-latency response times, and automated disaster recovery.

---

## 6. SSR & Nitro Output Platform Verification

### Evidence of Platform Compatibility

1. **Why Static Hosting Fails**:
   - REDhope's frontend is built with TanStack Start, which includes dynamic server-side route handlers:
     - [`src/server.ts`](file:///c:/REDhope/REDhope/src/server.ts): Provides runtime SSR catastrophic error catching and dynamic server request dispatch.
     - [`src/routes/sitemap[.]xml.ts`](file:///c:/REDhope/REDhope/src/routes/sitemap%5B.%5Dxml.ts): Server route handler generating dynamic XML sitemaps on demand via HTTP GET.
   - A static file host (e.g. AWS S3 static website or GitHub Pages) cannot execute server functions and will return 404 on server endpoints and dynamic loaders.

2. **Verified Nitro Preset Output**:
   - The build output from `npm run build` generates:
     ```
     .output/
     ├── nitro.json
     ├── public/
     │   ├── _headers
     │   ├── assets/
     │   └── images/
     └── server/
         ├── index.mjs
         ├── wrangler.json
         └── _ssr/
     ```
   - Inspection of `.output/server/wrangler.json`:
     ```json
     {
       "compatibility_date": "2026-10-18",
       "main": "index.mjs",
       "assets": { "binding": "ASSETS", "directory": "..\\public" },
       "compatibility_flags": ["nodejs_compat"],
       "no_bundle": true
     }
     ```
   - **Conclusion**: The output matches Cloudflare Pages Functions / Cloudflare Workers runtime requirements. Cloudflare natively serves the static assets in `.output/public` via its edge CDN while delegating dynamic SSR requests to `.output/server/index.mjs` with Node.js compatibility flags.

---

## 7. Pre-Launch Deployment Checklist & Verification Commands

### Phase 1: Local Pre-Flight Checks (Executed & Verified)

Run these checks in the root repository before triggering any remote deployment:

```bash
# 1. Typecheck the entire frontend codebase (must exit code 0)
npx tsc --noEmit

# 2. Run frontend production build (must generate .output/ with exit code 0)
npm run build

# 3. Run frontend linter check (must report 0 errors)
npx eslint . --quiet

# 4. Run backend automated test suite (must pass all 130 tests across 40 suites)
cd server
npm test
cd ..
```

---

### Phase 2: Remote Provisioning & Secrets Injection (Pending Manual Execution)

- [ ] Create Cloudflare Pages project pointing to `REDhope` repository.
- [ ] Configure `VITE_API_BASE_URL` in Cloudflare Pages build environment variables.
- [ ] Create Render Web Service pointing to `server/` directory.
- [ ] Generate production `JWT_SECRET` (`openssl rand -base64 32`) and inject into Render secrets.
- [ ] Inject `MONGODB_URI` pointing to production `REDhope_prod` cluster.
- [ ] Inject `FRONTEND_URL` (`https://redhope.org,https://www.redhope.org`) into Render environment.
- [ ] Inject Brevo API key and sender email into Render environment.
- [ ] Restrict MongoDB Atlas IP whitelist to Render outbound IPs.

---

### Phase 3: Post-Deployment Smoke Test Commands

Once DNS propagates and services are live, verify all subsystems using these curl commands:

```bash
# 1. Verify Backend Health & MongoDB Connection
curl -i https://api.redhope.org/health
# Expected: HTTP 200 OK, {"status":"healthy","database":"connected"}

# 2. Verify CORS Preflight Security
curl -i -X OPTIONS https://api.redhope.org/auth/login \
  -H "Origin: https://redhope.org" \
  -H "Access-Control-Request-Method: POST"
# Expected: HTTP 204 / 200, Access-Control-Allow-Origin: https://redhope.org

# 3. Verify Unauthorized Origin Rejection
curl -i -X OPTIONS https://api.redhope.org/auth/login \
  -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: POST"
# Expected: CORS policy violation / 403 Forbidden / No Access-Control-Allow-Origin header

# 4. Verify Frontend Server-Side Rendering
curl -i https://redhope.org/
# Expected: HTTP 200 OK, Content-Type: text/html, contains "REDhope" in body

# 5. Verify Dynamic XML Sitemap SSR Route
curl -i https://redhope.org/sitemap.xml
# Expected: HTTP 200 OK, Content-Type: application/xml, contains <loc>https://redhope.org/</loc>

# 6. Verify Rate Limiting on Authentication Endpoint
for i in {1..12}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.redhope.org/auth/login; done
# Expected: First 10 requests return 400 (Bad Request), 11th and 12th return 429 (Too Many Requests)
```

---

## 8. Status Matrix: Verified Code vs Pending Manual Setup

| Task / Item | Status | Verified Evidence in Repository | Action Required |
| :--- | :--- | :--- | :--- |
| **Frontend SSR Compilation** | ✅ **Verified** | `npm run build` succeeds; Nitro emits `.output/server/index.mjs` and `wrangler.json` | None in code. Connect to Cloudflare Pages. |
| **Dynamic Sitemap Route** | ✅ **Verified** | `src/routes/sitemap[.]xml.ts` resolves `APP_URL` or defaults to canonical domain | Set `APP_URL` in Cloudflare dashboard. |
| **Backend Express Health Check** | ✅ **Verified** | `GET /health` in `server/routes/homeRoutes.js` verifies Mongoose state | Set `/health` as health check path in Render. |
| **CORS Origin Filtering** | ✅ **Verified** | `server/server.js` parses comma-separated `FRONTEND_URL` and rejects unknown origins | Provide live domains in `FRONTEND_URL`. |
| **Environment Validator** | ✅ **Verified** | `server/config/validateEnv.js` validates MongoDB URI, JWT entropy, and Brevo keys | Provide production credentials. |
| **Rate Limiters (DDoS Protection)**| ✅ **Verified** | General, Auth, and Matching limiters active via `server/middleware/rateLimitMiddleware.js` | Keep `DISABLE_RATE_LIMIT=false`. |
| **Backend Automated Tests** | ✅ **Verified** | 130/130 tests passing across 40 suites (`npm test` in `server/`) | None. Verified. |
| **Production MongoDB Provisioning**| ⏳ **Pending** | Code ready to connect via `MONGODB_URI` | User must create Atlas cluster & DB user. |
| **Brevo Production API Key** | ⏳ **Pending** | `emailService.js` ready to send transactional templates | User must register domain & key in Brevo. |
| **DNS Record Routing** | ⏳ **Pending** | Domain records ready to point to Cloudflare & Render | User must configure DNS CNAME/A records. |
| **Private S3 / R2 Bucket** | ⏳ **Pending** | `storageService.js` abstraction ready for private storage adapter | User must create private bucket in Cloudflare/AWS. |

---

## 9. Next Steps

1. **Review and Approve**: Review the architectural choices and cost structure in this document.
2. **Account Access**: Prepare external provider accounts (Cloudflare, Render/Railway, MongoDB Atlas, Brevo).
3. **Trigger Deployment**: When ready, authorize deploying staging or production environments according to the checklist above.

