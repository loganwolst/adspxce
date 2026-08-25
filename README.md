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

- **Fixed Log out being far away on both mobile and desktop** — the
  earlier fix (pinning the sidebar with sticky positioning and pushing
  Log out to the bottom of a full-height column) was a fragile
  combination of several CSS mechanisms interacting, and it clearly
  wasn't holding up reliably, as this bug report showed. Replaced it
  with something much simpler: Log out no longer gets pushed anywhere
  at all — it just sits directly after the last nav item, with a
  divider line to mark it as separate. Nothing to scroll to reach it,
  regardless of screen size, since there's no "far edge" it's being
  pushed toward anymore.

- **Added the top-bar search you asked for**, placed exactly where you
  circled — a "Search user" / "Search company" toggle with live results
  as you type. Reuses the exact same minimal-preview safety principle
  as everywhere else in the social feature (name, role, photo only,
  nothing sensitive) — verified directly, including that unapproved
  advertisers correctly stay excluded from company search results.
  Worth being upfront about the one real tradeoff: this does mean
  someone can now find your name and photo without you having shared
  your code first (your wishlist stays fully protected either way,
  behind the same follow-approval system) — this is standard behaviour
  for this kind of feature, same as how Instagram itself works, not a
  new or unusual exposure.

- **Social profiles — profile picture, wishlist, followers/following**,
  Instagram-style. All regular user accounts are strictly private (not
  just private-by-default — the toggle to make one public has been
  removed from the dispatcher entirely, so it's genuinely unreachable
  even by calling the API directly, not just missing a button).
  Advertisers stay the exception — always followable immediately, since
  their identity is already public business info.
  - **Privacy was tested directly, not assumed**, since this is the
    most sensitive new surface area in the whole build: a stranger
    genuinely can't see a private wishlist; a pending follow request
    grants zero access until approved; a third unrelated party stays
    locked out throughout; and the safe "preview" data shown for
    followers/following contains only name, role, and photo — verified
    directly that email, balance, and trust score never leak into it.
  - Finding someone to follow works by their existing referral code
    (no new user directory built — deliberately, since a searchable
    list of everyone would be a bigger privacy surface than this
    feature needs) — and shows their photo *before* you send the
    request, specifically so you can confirm it's actually the right
    person when names collide.
  - Caught and fixed a real mistake of my own mid-build: an edit
    accidentally deleted an existing function's signature (the
    duplicate-identity-flag admin tool), which would have silently
    broken it. Found and fixed immediately via the export check.
  - Also caught a design flaw before it shipped: followers/following
    lists can't be computed from data the browser already has, since
    regular users never receive each other's full records — moved that
    computation server-side, where full visibility actually exists.

- **Refreshing now keeps you on whatever tab you're actually on**,
  instead of always dropping back to Dashboard — the current page is
  now reflected in the URL and read back on load. Verified the URL
  logic directly, including that it correctly coexists with the
  identity/payout return parameters from the Stripe flows without
  interfering with either.

- **Fixed Profile page kicking you back to Dashboard every time** — a
  real bug, not a misunderstanding. The `?identity=return` URL parameter
  (left behind after returning from Stripe's verification flow) was
  never being cleared, so it kept re-triggering the same status check
  and page reload every single time Profile loaded, for as long as
  verification status wasn't "verified." Since a fresh reload always
  defaults back to Dashboard, this looked exactly like being kicked off
  the page. Found the identical bug in the payout status check too (same
  pattern, `?payout=return`) — fixed both the same way: clear the URL
  parameter the moment it's read, so it can only ever fire once.

- **Identity verification is now mandatory to watch ads at all**, not
  optional — a real, defensible advertiser selling point (genuinely
  verified, real people, not just numbers), enforced server-side, not
  just a UI hint. Tested directly: blocked while unverified, blocked
  while verification is only "processing" (not yet complete), blocked
  on a failed verification, and correctly allowed the moment
  verification genuinely succeeds. The View Ads page now shows a clear
  upfront gate with a direct "Verify my identity" button rather than
  letting someone discover the requirement by clicking around and
  hitting errors.
  - **Worth knowing plainly**: this affects every existing tester
    immediately on deploy, including friends already using the app —
    none of them will have completed identity verification yet, since
    it didn't exist as a requirement until now. Worth giving them a
    heads-up before this goes live so it doesn't look like the app
    broke.
  - Also worth having ready for the eventual legal conversation: the
    specific justification for requiring ID just to watch a video is
    advertiser trust as a genuine product differentiator — a real,
    legitimate reason, but the kind of thing worth confirming
    proportionate under UK GDPR's data minimisation principle when that
    review happens.

- **Referral bonuses halved, and now only pay on genuine identity
  verification, not on watching one ad**: closes a real farming
  loophole — previously, someone could register fake accounts, watch a
  single ad on each, and collect bonuses repeatedly with no real
  friction. Identity verification (built earlier) is genuinely harder to
  fake, and ties directly into the duplicate-detection system already
  in place — verified this directly: a second account verifying with
  the *same* real identity as an existing one gets flagged as a
  duplicate and correctly earns nothing, while a first, genuine
  verification pays normally. Also confirmed this can't be double-paid
  by re-triggering the same result twice. New amounts: £1.00 to the
  referrer, £0.50 to the person who joined (both halved from before).
  Updated every place in the app that described the old "watch your
  first ad" trigger — found and fixed two separate spots with stale
  copy.

- **Fixed "1 people" grammar** — caught from your screenshot when the
  waitlist genuinely had exactly one person on it. Same issue existed
  in three places (the waitlist screen, the public login message, and
  the advertiser dashboard note) — fixed all three consistently.

- **Filled the space the demo box left with something genuinely useful**:
  a "How it works" mini-explainer (watch → verify → get paid) plus a
  real trust signal (real payments via Stripe) — everything stated is
  something actually built, not marketing copy for features that don't
  exist yet. Shows in both login and signup modes.

- **Removed the public "Demo accounts" box from the login screen** — a
  genuine security exposure now that the site is live and public
  (showing the admin login openly to any visitor was the most serious
  part of it). The accounts themselves still work exactly as before for
  your own testing — this only removes them from being displayed to
  the public.

- **Referral links now actually work as links**: previously the "copy
  invite message" just copied a bare code with no way for the recipient
  to know where to use it. Now generates a real URL
  (`adspxce.com/?ref=CODE`) — opening it lands straight on the signup
  form with the code already filled in, nothing to type or figure out.
  Verified the URL-parsing logic directly, including that it correctly
  ignores other query parameters that might be present. The bare code
  is still shown too, for anyone who'd rather type it in manually.

- **Fixed two places using red "warning" styling for content that isn't
  actually a warning** — the new Membership supply note and the
  profile-completion nudge were both using the danger-red component
  without overriding its colors, making informational and encouraging
  messages look like something was wrong. Switched both to neutral
  styling. Checked every other use of the same component for the same
  mistake — only these two had it.

- **Fixed a real bug you caught by testing precisely**: on your actual
  live database — which existed before the waitlist feature was ever
  built — `waitlistEnabled` was reading as `undefined`, since a brand-new
  field only gets its default value on a genuinely fresh database, never
  retroactively on one that already exists. `!!undefined` silently
  evaluates to `false`, so the entire gate was quietly off for every
  registration on your real site, no matter how far over capacity you
  were. Reproduced the exact scenario you saw (12 admitted, capacity 2,
  new signup sailed straight through) before fixing it, then confirmed
  the fix resolves that exact case. Checked the rest of the code for the
  same fragile pattern — only this one spot had it.

- **Added a "Waitlist" column to Admin → Users** — genuinely missing
  before this, and it caused real confusion: the existing "Status"
  column shows Active/Suspended, a completely different field from
  waitlist status, but easy to misread as answering "is this person
  waitlisted?" when it doesn't. Now shows directly, no need to
  cross-check the separate Waitlist page or log in as the account to
  find out.

- **Replaced the guessed "8 users per campaign" with a properly-derived
  formula**, grounded in each campaign's real economics rather than a
  flat number: every active campaign's actual daily budget ÷ its CPV
  gives genuine daily views deliverable, summed across all active
  campaigns, then divided by (Basic tier's daily cap × an admin-tunable
  safety multiplier, defaults to 4). A campaign with a bigger budget now
  genuinely contributes more capacity than a small one — verified
  directly that a £500/day campaign contributes roughly 500x more than
  a £3/day one, which the old flat ratio couldn't reflect at all.
  - Considered adding a hardcoded "at N campaigns, disable the waitlist
    entirely" rule — decided against it. This formula already scales
    toward effectively-unlimited capacity as real campaign supply grows,
    with no ceiling and no second number to maintain or get wrong.
  - Moved the capacity calculation itself server-side (exposed via
    `sanitizeDB`) so the client never has a second copy of this formula
    that could quietly drift out of sync with the real one.

- **Waitlist admission is now fully automatic** — no admin click needed.
  Capacity is a simple, transparent, admin-tunable formula (active
  campaigns × a "users per campaign" number, defaults to 8) — deliberately
  not a precise scientific model, since there isn't a single objectively
  correct ratio, just a clearly-labelled guideline you can adjust as you
  watch real usage. Two important design decisions, both verified
  directly with real tests:
  - **Registering while there's genuine room admits you immediately** —
    the waitlist only kicks in once real capacity is actually full, not
    unconditionally for everyone.
  - **Admission happens the instant a campaign goes active** — that's
    the exact moment new capacity appears, so anyone next in line gets
    in right then, in real time, not on a delay or a periodic check.
  - **Capacity shrinking (a campaign pausing or running out of budget)
    never revokes access already granted** — only pauses further
    admissions until capacity grows back. Verified this directly: paused
    a campaign that dropped capacity below the current admitted count,
    confirmed nobody already in got kicked back to the waitlist.
  - The manual "admit one" / "admit a batch" admin controls are kept as
    an explicit override for edge cases, not removed — automatic is now
    the primary path, not the only one.

- **Waitlist for new user signups**, so user growth stays matched to real
  ad supply instead of getting ahead of it:
  - Only regular users get waitlisted — advertiser signups are never
    affected, since more advertisers is exactly what solves the
    underlying problem.
  - Admin-toggleable (Configuration → "New signups"), defaults **on**.
  - A waitlisted account genuinely can't watch ads — enforced
    server-side, not just hidden in the UI — but sees an honest status
    screen with their real position and real current campaign count, not
    a fake "you'll hear from us soon" (no real email system exists yet,
    so that promise would've been dishonest).
  - Admin gets a dedicated Waitlist page — admit people one at a time or
    in a batch, oldest-first (fair, first-come).
  - The same real numbers (waitlist size, active campaigns) now show up
    as honest social proof in three places: the public login screen, the
    Membership page (context for the earning-ceiling figures), and the
    advertiser dashboard (a genuine reason for them to launch more
    campaigns — more supply means more people let in sooner).
  - Verified the whole lifecycle directly: existing accounts weren't
    retroactively caught by this, positions update live as people get
    admitted, the server-side block actually prevents earning (not just
    a UI hint), and the public aggregate numbers never expose anyone's
    individual identity.

- **Advisory CPV pricing recommendation** on campaign creation — factors
  in video length, whether it includes an end-of-video question (real,
  sourced industry data: interactive formats genuinely command a
  20-40% premium over passive views), and targeting specificity
  (narrower targeting is worth *more* per view, not less — the correct
  direction, matching how real ad platforms price it). Purely advisory,
  by design: the recommendation is shown, but advertisers still set
  their own price. Verified the calculation directly, including that
  the upper clamp genuinely engages rather than just happening not to
  be hit in normal cases.
  - Worth knowing: the "includes a question" checkbox affects the price
    recommendation now, but the actual on-screen question feature
    itself isn't built yet — flagged clearly in the UI so it's not
    mistaken for something live.
  - Also added: the ad platform currently uses one fixed 6-second
    verification timer for every campaign regardless of stated video
    length — the new "video length" field feeds pricing guidance, not
    the actual viewer-facing timer, which is a separate mechanic.

- **Found the actual root cause of the persistent bottom gap**: removing
  the centering fixed the top gap, but the container was still forced
  to `min-height: 100vh` — always at least a full screen tall, even
  when content is much shorter — so the leftover space just moved to
  the bottom instead of disappearing. Removed that forced minimum
  entirely on both the auth screen and the logged-in app shell, so they
  size to their actual content instead of always padding out to fill
  the screen. Also had to make sure the main content pane doesn't get
  dragged along by the sidebar's own explicit full-height sizing (a
  side effect of the earlier sticky-sidebar fix) — it now sizes to its
  own content independently, same as it should.

- **Fixed having to scroll the whole page just to reach "Log out"**: the
  sidebar nav had `flex: 1`, pushing Log out to the very bottom of the
  sidebar's height — reasonable on its own, but combined with a page
  that's only as tall as its actual content, "the bottom of the
  sidebar" meant "the bottom of the whole page," so a short page (like
  Admin Overview) required scrolling to reach it. Real fix, not just a
  workaround: the sidebar now pins itself to the visible screen
  (`position: sticky`, full viewport height, scrolls independently if
  its own contents ever exceed that) — Log out stays reachable without
  scrolling on every page, whether that page's content is short or long
  enough to need scrolling itself. Also checked the mobile layout
  specifically, since it turns the sidebar into a horizontal bar instead
  — made sure it doesn't inherit the desktop-only height/pinning.

- **Found the real cause of the top/bottom gap — it wasn't the zoom fix
  after all**: both the hero panel and the login panel had
  `justify-content: center`, vertically centering their content within
  the full-height container. That's exactly what produces equal gaps
  above and below whenever content is shorter than the screen — one of
  those rules was a leftover from an earlier fix that actually needed
  horizontal centering, not vertical, and I'd added vertical "for good
  measure" without it being asked for. Removed it — content now anchors
  naturally at the top instead of floating in the middle.

- **Fixed a gap top and bottom caused by the zoom fix itself**: applying
  `zoom` to `body` created a real mismatch — `body`'s own layout box
  stayed sized at the original (unzoomed) height as far as its parent
  (`html`) was concerned, while it rendered 1.4× bigger visually, so the
  page ended up taller than the viewport thought it was. Moved the zoom
  to `html` instead — the outermost level — which avoids that
  parent/child boundary mismatch entirely.

- **Scaled the whole app up (`zoom: 1.4`)** to match the size you
  preferred — you'd found it looked right at 150% browser zoom, so
  rather than manually rewriting hundreds of individual font-size and
  spacing values (error-prone, hard to keep consistent), baked that
  scale in site-wide as the new default at ordinary 100% zoom. If it
  needs nudging up or down, it's one number to tune, not a rewrite.
- **Stars now genuinely twinkle independently** rather than all fading
  in and out together — previously it was one shared animation across
  every dot, so however many stars there were, they all pulsed as a
  single unit. Split into 3 layers with staggered timing so different
  stars are visibly out of phase with each other. Also removed a
  redundant second starfield that lived specifically on the login
  panel — the main one already covers that whole area now that it's
  fixed to the full viewport, so having two overlapping layers wasn't
  adding anything, just complexity.

- **Fixed the "everything looks too small/spread out" issue**: a real bug,
  found the actual cause rather than guessing — the ledger box had
  `margin-top: auto`, which pushes it to the very bottom of its
  container. Harmless when the container was a small fixed height, but
  once it correctly filled the real screen height (previous fix), that
  same rule stretched the gap dramatically on a tall monitor. Removed
  the auto-margin and centered the hero content as one coherent block
  instead — looks consistent regardless of actual screen size now,
  rather than only looking right by accident at a specific zoom level.
- **Shooting stars rebuilt to be genuinely random**, not a few fixed
  paths repeating on a timer: real position, direction (all 360°, not
  just two preset diagonals — verified the transform math directly
  rather than assuming), distance, and timing are freshly randomized
  every single time one appears, so there's genuinely no way to predict
  where or when the next one shows up. Bigger, brighter, and travels
  further across the screen too. Still respects reduced-motion — for
  that preference, none get scheduled at all rather than just being
  hidden.

- **Fixed the gap at the bottom on tall screens**: the layout only ever
  guaranteed a *minimum* height (a fixed 640px), never told to actually
  fill the real screen — genuinely different bug from the earlier width
  ones, not a sign either of those fixes didn't work. Switched to a
  viewport-relative height so it always fills the actual screen,
  whatever size that is.
- **Twinkle turned up, and added occasional shooting stars** — three of
  them, staggered with different timings and paths so they don't all
  fire at once and feel more like something you might genuinely catch
  out of the corner of your eye than a scheduled effect. Both respect
  "reduce motion" system settings.

- **Fixed the login form sitting flush-left with dead space beside it on
  wide screens**: the previous width fix was actually correct — the layout
  really was filling the full window — but the right-hand panel (login
  form) had no centering at all, so on a wide screen its content just
  sat against the left edge of its own column with a large unstyled gap
  to the right. Now centers properly regardless of window width.

- **Fixed the app not filling the browser window on some setups**: the
  top-level layout containers (`#root`, `.root`, `.auth-shell`,
  `.app-shell`) had no explicit width set — normally that's fine since
  block elements default to filling their parent, but something in the
  cascade was letting it shrink instead. Made it explicit rather than
  relying on default behaviour, which removes the ambiguity either way.
- **The live ledger now actually feels live**: it continuously
  auto-scrolls (duplicated content looping seamlessly, a standard
  technique — not a real illusion trick, genuinely invisible where it
  loops), pauses on hover so it's actually readable if you want to look,
  and respects "reduce motion" system settings for anyone who's turned
  that on.
- **Twinkling stars now feel a bit more organic** — was a single uniform
  smooth pulse across the whole starfield; now has an irregular rhythm
  instead of one mechanical breathing motion. (Worth knowing: the
  twinkle animation already existed before this — if it wasn't visible
  before, that was almost certainly downstream of the width bug above,
  not something separately broken.)

- **Paid membership tiers now gate on real ad supply**: Upgraded/Gold stay
  fully visible (pricing, benefits, everything) but can't actually be
  purchased until there are enough active campaigns on the platform to
  make the extra daily views genuinely worth paying for — configurable at
  Admin → Configuration ("Min. active campaigns to unlock paid tiers",
  defaults to 5). **Enforced server-side**, not just a disabled button —
  the underlying action rejects the upgrade outright if the real count
  isn't there, so this can't be bypassed by calling the API directly.
  Downgrading back to the free tier is never blocked, for obvious reasons.
  Same principle as the earlier figures audit: don't let someone pay for
  something the platform can't actually deliver yet.

- **Fixed a white background showing below the app on some pages**:
  `html`/`body` had no background colour set at all — only the app's own
  content did — so if a page's content was shorter than the browser
  window, the browser's plain white default showed through underneath.
  Set the dark background directly on `html`/`body` so it always fills
  the full page regardless of content height or window size.

- **Fixed the recurring "site looks empty after an update" issue**: the
  server wasn't sending any cache instructions at all for the app's files,
  which left it up to browser/network heuristics whether an old, stale
  version got served after a deploy — exactly the "sometimes fine,
  sometimes broken" pattern that kept resurfacing. Fixed properly rather
  than papering over it: `index.html` now always re-fetches fresh (so a
  browser can never run yesterday's app), while the actual JS/CSS bundle
  files are safe to cache aggressively, since each build gives them a new
  content-hashed filename — an old cached filename simply can't be
  referenced by a fresh `index.html` anymore. Standard, correct pattern
  for this kind of app; shouldn't need "try a different browser" as a
  workaround going forward.

- **Duplicate-identity flags now actually do something**: a flagged account
  can no longer submit new withdrawal requests (verified directly — the
  request is rejected before any balance is touched), but ad-watching and
  earning stay completely open, and donations aren't affected either
  (money going to a charity doesn't personally benefit whoever's flagged,
  so there's no real reason to block it). Admin gets a **"Clear flag"**
  button once they've actually looked into it — without this, a false
  positive (which is genuinely what happened in testing — Stripe's
  test-mode data made two real, different demo accounts look identical)
  would leave someone permanently locked out with no way back in.

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
