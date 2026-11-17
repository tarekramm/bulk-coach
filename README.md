# 90-Day Bulk Coach — iPhone PWA

A personalized workout, nutrition and progress tracker. Works offline and stores records in iPhone local storage. Designed for a **single personal user**, with editable workouts, exercises, foods, reminders, and custom measurement fields.

## Status
- **Implemented in browser:** dashboard, 4-day upper/lower plan, set logging with double-progression guidance, meals/macros, weights/chart, measurements, custom tracking fields, export/import JSON, Home Screen PWA.
- **Not yet activated:** Cloudflare Pages production deployment; Cloudflare Access and D1 cloud synchronization; scheduled push delivery.
- **Important:** until Cloudflare D1 is configured, all user data stays in the same iPhone browser profile. Export backups regularly.

## Cloudflare deployment
1. In Cloudflare Dashboard > Workers & Pages > Create > Pages > Connect to Git, choose **tarekramm/bulk-coach**, production branch **main**. Select no framework, build command empty, output directory **/** (repository root). If Pages' Git UI disallows root output, set a build command that copies static files to `public/` and use `public` as output, copying `functions/` alongside as required for Pages Functions.
2. In D1, create database `bulk-coach`, and run `schema.sql` against it.
3. Bind D1 to Pages > Settings > Bindings as variable **DB**.
4. **Before using D1, protect both `bulk.tarekramadan.com` and the project's `*.pages.dev` preview/production host via Cloudflare Access policies**. The API requires the trusted `Cf-Access-Authenticated-User-Email` header, which only provides authorization when traffic is gated by Access. Never expose /api/state to public writes. Ensure Pages preview and any alternate hosts cannot bypass Access.
5. In Pages > Custom domains, add `bulk.tarekramadan.com`, confirm the required DNS record and HTTPS.
6. Launch on iPhone Safari and choose Share > Add to Home Screen.

## Notifications
Reminder entries can be added/edited/deleted in the app, but these are schedules, **not yet delivered notifications**. To activate notifications, set up a OneSignal web push application for the custom HTTPS domain, put its *public app ID only* in `config.js` as `pushAppId` and deploy a secure Cloudflare Worker scheduled trigger to send notifications according to each user's schedule. Never put OneSignal REST API keys in client-side code. Push on iPhone requires iOS 16.4+, a Home Screen installed PWA and opt-in.

## Security and limitations
- Cloudflare Access must be enforced on every domain serving the API before D1 can be used safely.
- Since the app is offline-first, edits on two devices simultaneously may conflict; sync rejects some older state writes with HTTP 409.
- Fitness targets are starting estimates, not medical advice.
- The first implementation logs individual sets and supports editing exercise prescriptions. It does not yet have integrated progress-photo storage.
- No Supabase is used.
- No secrets in GitHub; restrict repo access.

## Future additions
The **Customize** tab supports editing/adding/deleting exercises, foods/recipes, reminder schedules, and numeric custom fields. Other components can be added by updating this repository.
