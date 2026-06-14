# Windows Server — HTTP (LAN) deployment

Yes, the app works over **plain HTTP** on a Windows Server for users on your network. `npm run dev` and `npm run start` both bind to `0.0.0.0:4782` so other devices can connect.

## Login redirect loop (most common issue)

If login succeeds but you are sent back to `/login`, the session cookie was not saved. This usually happens when:

1. **`npm run start` (production)** was used **without** `AUTH_SECURE_COOKIES="false"` on HTTP, or
2. **`APP_URL`** does not match what users type in the browser (e.g. env has `http://192.168.1.50:4782` but users open `http://WIN-SERVER:4782`).

### Fix — server `.env`

```env
AUTH_TRUST_HOST="true"
AUTH_SECURE_COOKIES="false"
APP_URL="http://YOUR_SERVER_IP:4782"
ALLOWED_ORIGINS="YOUR_SERVER_IP:4782,WIN-SERVER-NAME:4782"
PORT="4782"
HOSTNAME="0.0.0.0"
AUTH_SECRET="long-random-secret"
```

Replace `YOUR_SERVER_IP` with the server’s LAN IP. `APP_URL` must match the address users use in the browser.

After changing `.env`:

```powershell
npm run build
pm2 restart quality-audit
```

## First-time setup on the server

```powershell
cd C:\path\to\quality-audit
copy deploy\windows-http.env.example .env
# Edit .env with your database URL, APP_URL, AUTH_SECRET

npm install
npm run db:migrate:deploy
npm run db:seed
npm run build
pm2 start deploy/ecosystem.config.cjs
pm2 save
```

## PM2 commands

```powershell
pm2 logs quality-audit
pm2 restart quality-audit
pm2 status
```

## Allow other devices to connect

1. App listens on **0.0.0.0:4782** (all interfaces) — already set in `npm run start`.
2. **Windows Firewall**: allow inbound TCP **4782** (or your `PORT`).
3. Users open: `http://SERVER_IP:4782` (same host as `APP_URL`).

## Dev vs production on the server

| Command           | Use case                          |
|-------------------|-----------------------------------|
| `npm run dev`     | Local development only            |
| `npm run start`   | Production (use with PM2)         |

For production, always run `npm run build` before `npm run start`.

## HTTPS later

When you add HTTPS (nginx / IIS reverse proxy), set:

```env
APP_URL="https://audit.yourcompany.com"
AUTH_SECURE_COOKIES="true"
```

See `deploy/nginx.conf.example`.

## Pages fail or Audit form won't open (`/forms/audit`)

Works on your PC with `npm run dev` but fails at `http://10.80.80.221:4782` usually means one of these:

### 1. Build was done on another PC without server `.env`

Server Actions only allow origins from `next.config.ts` at **build time**. On the **server**, set `.env` then rebuild:

```env
APP_URL="http://10.80.80.221:4782"
ALLOWED_ORIGINS="10.80.80.221:4782"
AUTH_TRUST_HOST="true"
AUTH_SECURE_COOKIES="false"
```

```powershell
npm run build
pm2 restart quality-audit
```

Do **not** copy only the `.next` folder from your laptop unless that build used the same `APP_URL`.

### 2. Login session missing (redirect to `/login`)

Same as above — set `AUTH_SECURE_COOKIES="false"` for HTTP and match `APP_URL` to `http://10.80.80.221:4782`.

### 3. Audit page shows 404

Database on the server may be missing templates. On the server:

```powershell
npm run db:migrate:deploy
npm run db:seed
```

### 4. Check PM2 logs for errors

```powershell
pm2 logs quality-audit --lines 50
```

Look for `Invalid origin`, database connection errors, or `Unauthorized`.

### 5. Always use the same URL

Open the app as **`http://10.80.80.221:4782`** everywhere (bookmark, audit links, login). Mixing `localhost` on the server with `10.80.80.221` on other devices breaks cookies and Server Actions.
