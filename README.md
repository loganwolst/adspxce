# adspXce — MVP

A real, deployable full-stack build of adspXce: Express + a JSON-file data
store on the backend, React (Vite) on the frontend. This replaces the
in-browser demo — passwords are now hashed (bcrypt), sessions are real
signed cookies (JWT), and every privileged action (admin approvals,
suspensions, config changes) is checked **server-side**, not just hidden in
the UI.

## What's inside

```
server/           Express API
  index.js        Routes: auth, generic action dispatcher, static hosting
  logic.js        All business rules (ported straight from the MVP demo)
  store.js        Persists state to server/data/db.json (auto-seeded on first run)
  auth.js         JWT cookie session helpers
  sanitize.js     Strips password hashes and PII based on who's asking
client/           React + Vite frontend
  src/App.jsx     Same UI as the demo, now talking to the real API
package.json      Root scripts (build client, start server)
```

## Since the last build

- **Identity verification (Stripe Identity, test mode)**: users can optionally
  verify with a real ID document + selfie check on their Profile page.
  Deliberately minimal on data collected: **no document images, no address,
  no raw date of birth are ever stored** — only a one-way hash of
  name+DOB, used purely to detect the same real person registering a
  second account. A match is **flagged for admin review, never an
  automatic ban** (visible on Admin → Users as "⚠ Duplicate?"), consistent
  with how the rest of the app handles suspected fraud. This is **not
  currently required for anything** — signup, viewing ads, and
  withdrawing all still work without it. Whether and when to make it
  mandatory is exactly the kind of question the legal review should
  answer, not something to decide in code.
  - Learned from the Connect payout debugging session: this checks Stripe
    **directly on demand** rather than depending on a webhook arriving —
    same reliable pattern that actually got Connect working, applied from
    the start this time instead of after a detour.
  - One-time setup step, same shape as Connect's: Stripe requires you to
    activate Identity once per account before the API will work — flagging
    this upfront this time (Dashboard → Settings → Identity → accept
    terms), since discovering it via an error message once already was
    enough for one build.

- **Figures audit**: found and fixed one real accuracy issue — the
  Membership page's "Earn up to £X a month" was computed using the
  *average* CPV across the platform's range, not the maximum. That meant
  a user could genuinely exceed the number labeled "up to," which makes
  it not actually a ceiling despite the label. Fixed to use the true
  maximum CPV, so the displayed figure is now a genuine, unbeatable
  ceiling (it changed the numbers — they went *up*, since the old figures
  were accidentally conservative, not inflated). Swept the rest of the
  app for similar issues and found nothing else stale or hardcoded —
  every other number on the site is computed live from real config/data.
- **Loyalty bonus**: users get a small bonus (default £0.50, both
  configurable at Admin → Configuration) for watching ads on 4+ different
  days within the current week. Deliberately **not** a punishing streak —
  missing a day never resets anything or costs money already earned, it
  just quietly doesn't hit the threshold that week and tries again fresh
  the next. The Dashboard shows encouraging progress ("you're on 3/4"),
  never "you missed it" framing. Verified with real execution across
  several scenarios: correctly withheld below the threshold, correctly
  paid exactly once per qualifying week (not double-paid by extra views
  the same week), and correctly resets clean the following week.

- **Real payouts (Stripe Connect Express, test mode)**: users can now set up
  real payout accounts and actually get paid via a real Stripe transfer,
  not just a ledger entry. Decisions made and built accordingly: **the
  platform absorbs Stripe's payout fees** (users always receive the full
  amount they request), and **trust-score instant payout still applies to
  real money** (unchanged behaviour — the trust threshold is now
  admin-configurable at Config → "Trust score for instant payout" so it can
  be tightened without a redeploy if needed).
  - **How it works**: a withdrawal always reserves the funds immediately
    (deducted from balance) exactly as before. If the user hasn't set up
    real payouts yet, nothing changed — same instant-paid demo behaviour.
    If they have, the withdrawal sits as "processing" while a real Stripe
    transfer is attempted; only on confirmed success does it become "paid".
    **On any failure, the reservation is fully and automatically reversed**
    — balance restored, nothing lost, nothing double-paid.
  - **This reconciliation logic was tested directly**, not just written and
    trusted: verified the mock path is completely unaffected, verified a
    real-payout-eligible withdrawal correctly withholds "paid" status until
    transfer confirmation, verified a successful transfer finalizes
    correctly, and — most importantly — verified a *failed* transfer
    refunds the exact right amount with the ledger left in a consistent
    state. Money safety was the priority here.
  - **Nice side effect**: Stripe's Express onboarding collects real identity
    information as part of enabling payouts, which is a genuine (if
    partial) step toward the "one real person, one account" enforcement
    flagged earlier — it only applies to people who actually try to
    withdraw, not everyone at signup, but it's real coverage where it
    matters most.
  - **What's still gating this from being real**: same as deposits — this
    needs live Stripe keys and, more importantly, the legal review to have
    actually landed before flipping from test to live keys. The code is
    ready; the decision to switch it on for real money isn't a code change.

- **Stripe deposits (test mode)**: advertisers can now pay real card
  charges — via Stripe's hosted Checkout, not a custom card form, so no
  card details ever touch this server directly — to top up their
  advertising balance. The existing instant "demo top-up" still works
  unchanged, so testers without a card can keep using it. Two things
  worth understanding about this piece specifically:
  - **Idempotency is real, not assumed.** Stripe explicitly does not
    guarantee a webhook arrives exactly once — it retries on any failure
    or timeout. Sent the same webhook event twice against a running
    instance and confirmed the second delivery is a safe no-op, not a
    double-credit. This is the single most important thing to get right
    in a payments integration, so it was worth verifying directly rather
    than trusting the code by inspection.
  - **This is the one piece I couldn't fully test end-to-end.** Everything
    else in this app has been verified by actually running it in a real
    Node process. Stripe's *own* API behavior — whether a Checkout Session
    actually gets created correctly, whether a real webhook signature
    verifies — can only be tested against a real Stripe account, which
    needs your keys. Follow the setup steps below and test with Stripe's
    documented test card numbers before trusting this with real money.

### Setting up Stripe

1. Create a free account at [stripe.com](https://stripe.com) if you don't
   have one. Everything below uses **test mode** (toggle top-right of the
   Stripe dashboard) — no real charges, no business verification needed yet.
2. Dashboard → Developers → API keys → copy the **Secret key** (starts
   `sk_test_`). Add it as `STRIPE_SECRET_KEY` in Railway's Variables tab.
3. Dashboard → Developers → Webhooks → Add endpoint → URL:
   `https://adspxce.com/api/stripe/webhook` → select **both**
   `checkout.session.completed` (deposits) and `account.updated` (payout
   onboarding status) → save, then copy the **Signing
   secret** (starts `whsec_`) → add as `STRIPE_WEBHOOK_SECRET` in Railway.
4. Redeploy (any new commit triggers this). Log in as an approved
   advertiser (morgan@brand.test), go to Billing → "Pay with card", and
   pay using Stripe's test card `4242 4242 4242 4242`, any future expiry,
   any 3-digit CVC. Confirm the balance updates.
5. To test payouts: log in as a user (jordan@demo.test), go to Withdraw →
   "Set up real payouts" → complete Stripe's test-mode onboarding (any
   fake test details work — Stripe's onboarding flow explains this in test
   mode) → once it redirects back, request a withdrawal and confirm it
   goes through to "paid" rather than the old instant-demo behaviour.
6. Real charges only start once you switch to **live mode** keys — a
   deliberate, separate step, not something that happens by accident.

### Setting up Identity verification

1. Stripe Dashboard (test mode) → **Settings → Identity** → accept the
   terms and fill in the basic details Stripe asks for. This is a
   one-time platform activation, required before the API will work at
   all — same shape as the Connect activation step above.
2. No new environment variables needed — it reuses `STRIPE_SECRET_KEY`.
3. Test it: log in as any user → Profile → "Verify my identity" → Stripe's
   test-mode flow lets you use placeholder document photos (it explains
   this on screen) → once it redirects back, the app checks the result
   directly rather than waiting on a webhook.

### What's still to build for payments

- ~~Real payouts to users~~ — **done.** Stripe Connect payouts are built,
  tested, and have actually completed a real (test-mode) transfer
  end-to-end. What's left here isn't code — it's the legal review, and
  then switching from test to live keys when that's cleared.

- **Rate limiting**: now that this is publicly reachable, login (10
  attempts/15 min), registration (10/hour), and the API generally (300/5 min)
  are all rate-limited per IP, hand-built and tested rather than an
  unverified dependency. `app.set("trust proxy", 1)` is required for this
  to correctly identify real client IPs behind Railway's proxy — without
  it, rate limiting would either not work or (worse) throttle everyone
  together as if they were one user.
- **Backups**: two layers. An automatic rolling snapshot runs every 6 hours
  (on startup too, covering redeploys), keeping the last 10 and pruning
  older ones — protects against corruption or a bad bug wiping data. An
  admin-only "Download full backup" button (Admin → Configuration) gives
  you an actual off-server copy — the rolling snapshots alone don't help
  if the whole server/volume is ever lost, only a copy you actually hold
  does.

- **Referral program**: every user gets a unique code (Profile → Referrals).
  Sharing it and having a friend sign up pays both sides a bonus (£2
  referrer / £1 referee) the moment the friend completes their first ad
  view — verified this only fires once, not on every subsequent view.
- **Ad preferences**: mute a specific advertiser (one click from any ad
  card) or whole interest categories (Profile page). These are hard
  exclusions in the ranking algorithm, not just down-ranked.
- **Trust score & reduced friction**: a real 0–100 score from account age,
  verification pass rate, and view history. At 80+, withdrawal requests
  skip the pending-review queue and pay out instantly — genuinely reduces
  friction for established, honest accounts rather than just being a
  vanity number.
- **A/B testing for advertisers**: a campaign can carry an optional
  Variant B creative; each view randomly gets A or B, and the Verification
  page shows a side-by-side pass-rate comparison.
- **Donate instead of withdraw**: the Withdraw page now has a toggle to
  send balance straight to one of a few fixed charities instead of a bank
  payout.
- **Accessibility pass**: keyboard focus is now clearly visible everywhere
  (tuned for the dark theme, not just relying on browser defaults), toasts
  are announced to screen readers, there's a skip-to-content link, toggle
  buttons expose their state via `aria-pressed`, and the human-verification
  challenge's icons have real accessible names instead of being emoji-only.
  Worth being honest about the ceiling here: the verification challenge
  itself is still fundamentally a visual task — genuinely solving that for
  blind users would need an alternate (e.g. audio) challenge path, which
  is a bigger piece of work than this pass covers.

- **Anonymous public ledger, fixed properly**: the front-page "Live ledger"
  ticker was accidentally broken by the privacy fix above (it read the same
  per-viewer-filtered transaction list, so a logged-out visitor got nothing).
  Now backed by a dedicated `publicLedger` — computed server-side with
  *only* `{ type, amount, timestamp }`, no user id, campaign id, or any
  other identifying field ever included, for anyone, logged in or not.
  Verified this isn't just a UI convention: inspected the raw object the
  server sends and confirmed no identifying key exists in it at all.
- **Personal Activity page**: a private "Activity" tab shows your own
  watch time and earnings over a selectable period (7/30/90 days), plus
  all-time totals, with a real bar-chart graph of daily earnings — built
  as plain SVG rather than adding an untested charting dependency, and the
  day-bucketing math was verified against known inputs before shipping.
  Only ever visible to the account it belongs to.

- **Ad ranking algorithm**: what a user sees, and in what order, is now
  decided by a real scoring function (`rankCampaignsForUser` in
  `client/src/App.jsx`) combining stated interests (from Profile), *learned*
  interests (tags of ads they've actually watched before — behaviour counts
  more than a one-off checkbox), advertiser CPV, a recency penalty so the
  feed doesn't repeat itself, and a small random factor so lower-scoring
  campaigns aren't permanently buried. Age-range targeting is still a hard
  gate (excluded outright); interest tags are a soft ranking signal. Ads
  that matched a stated interest show a "Matched: Outdoors, Fitness" badge
  so it's visibly working, not a black box.
- **Broader privacy hardening**: while wiring the algorithm to real user
  data, found that the server was sending *every* user's name, email,
  balance, and full transaction history to *every* other logged-in
  account — a gap left over from an earlier pass that only locked down
  passwords and shipping addresses. Fixed properly: a regular user's
  account is now only ever visible to themselves or an admin; other people
  only see the public storefront info they actually need (an advertiser's
  company name and approval status). Transactions are filtered the same
  way — you only ever receive records you're actually a party to.

- **In-app store**: advertisers list products; users search/browse and buy
  with their wallet balance. Orders carry a real shipping address and a
  full status lifecycle (pending → processing → shipped → delivered, with
  carrier/tracking number), fulfilled by the advertiser from their **Orders**
  page. 100% of a sale goes to the advertiser — adspXce takes no cut.
- **Attention-check verification**: while watching an ad, a "tap to confirm
  you're watching" button appears at a random moment and must be clicked
  within ~2.5 seconds, or the view isn't counted (no reward, no charge —
  logged for the advertiser instead as a failed attempt). Advertisers see
  pass/fail rates per campaign on their **Verification** page.
- **PII protection**: shipping addresses are real names and home addresses.
  The server now sanitizes the database differently *per viewer* — only a
  buyer, the advertiser fulfilling their order, or an admin can ever see an
  order's address. No one else, even other logged-in users, can see it.
- **Human verification (second gate)**: after the in-video attention-check,
  a short "select all the matching icons" challenge must be solved before
  a view can be claimed. Worth knowing: this is a real deterrent against
  casual/unsophisticated bots and gives advertisers a visible verification
  step, but it isn't equivalent to a hosted CAPTCHA service (e.g. Google
  reCAPTCHA) — a determined attacker could still script around a purely
  client-side check. That's a bigger integration for later if fraud
  becomes a real problem.
- **Profile & ad targeting**: users can fill in an age range, region, and
  interest tags on their new **Profile** page. Advertisers pick the same
  tags/age range when creating a campaign; campaigns with targeting set
  only show to matching users (untargeted campaigns still reach everyone).
  Deliberately kept to non-sensitive, industry-standard targeting
  dimensions — no gender, health, or other sensitive categories.

## Running it locally

You'll need [Node.js](https://nodejs.org) 18+ installed.

```bash
# from the project root
npm install
npm run build        # builds the React app into client/dist
npm start             # starts the server on http://localhost:3000
```

Open `http://localhost:3000` — the demo accounts from before still work
(admin@adspxce.test / admin, jordan@demo.test / demo, etc.), or register a
fresh one. Data is saved to `server/data/db.json` and survives restarts.

**For active frontend development** (hot reload while you tweak the UI),
run these in two terminals instead:
```bash
npm run dev:server    # terminal 1 — API on :3000
npm run dev:client    # terminal 2 — Vite dev server on :5173, proxies /api to :3000
```

## Deploying it live

This needs a host that runs a persistent Node process (not a static host —
there's a real backend here). Two good, low-effort options:

### Option A — Railway (recommended, simplest persistent storage)
1. Push this project to a GitHub repo.
2. On [railway.app](https://railway.app), create a new project from that repo.
3. Add a **Volume** mounted at `/app/server/data` — this is what makes your
   data (users, campaigns, transactions) survive redeploys.
4. Set an environment variable `SESSION_SECRET` to a long random string
   (see `.env.example`).
5. Railway auto-detects the build (`npm run build`) and start
   (`npm start`) commands from `package.json`. Deploy, then open the URL
   Railway gives you.

### Option B — Render
1. Push to GitHub, create a new **Web Service** on
   [render.com](https://render.com) pointing at the repo.
2. Build command: `npm run build`  ·  Start command: `npm start`
3. Add environment variable `SESSION_SECRET`.
4. For data to survive redeploys, attach a **Disk** at `server/data`
   (Render's disks are a paid add-on — a free-tier deploy will still work
   great for testing, it just resets `db.json` on each redeploy/restart).

Either way — check each provider's current free-tier terms before
committing, they change fairly often.

### Before this is a real, live-money product
This build is a big step up from the in-browser demo, but it's still an
MVP checkpoint, not launch-ready. Before real users and real money:
- Swap the JSON file for a proper database (Postgres) once you have more
  than a handful of concurrent users
- Integrate a real payment provider (Stripe Connect is the natural fit for
  paying users out) instead of the mock deposit/withdraw flow
- Get the legal/financial/regulatory review flagged at the very start of
  this project — UK e-money, KYC/AML and consumer protection rules apply
  once real money moves
- Add real identity verification for the "one account per person" rule
- Real store orders only physically ship once a real advertiser is signed
  up and actually fulfilling from their Orders page — the code is ready,
  but nothing ships itself
- Real email delivery for verification/password reset (currently mocked)

Happy to help with any of these next.
