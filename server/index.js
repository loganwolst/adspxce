const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

const logic = require("./logic");
const { withDB, readDB, createBackup, latestBackupInfo, DB_PATH } = require("./store");
const { setSessionCookie, clearSessionCookie, getUserIdFromReq } = require("./auth");
const { sanitizeDB } = require("./sanitize");
const { createRateLimiter } = require("./rateLimit");
const { getStripe } = require("./stripeClient");

const app = express();

// Railway (and most hosts) sit behind a reverse proxy — without this, every
// request looks like it comes from the proxy's IP, which would make rate
// limiting either useless (can't tell users apart) or actively broken
// (one user's traffic limits everyone).
app.set("trust proxy", 1);

// The Stripe webhook needs the RAW request body to verify its signature —
// if express.json() parses it first, verification breaks. This route-scoped
// raw parser must be registered before the global express.json() below.
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(cookieParser());

const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many login attempts. Please wait a few minutes and try again." });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, message: "Too many accounts created from this network. Please try again later." });
const apiLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 300, message: "Too many requests. Please slow down." });
app.use("/api", apiLimiter);

app.use((req, res, next) => {
  req.userId = getUserIdFromReq(req);
  next();
});

/* --------------------------- action registry ---------------------------- */
// "self"  -> caller must be logged in; payload.userId is force-set to the
//            authenticated user's id (client-supplied values are ignored).
// "admin" -> caller must be logged in AND have role === "admin".
const ACTIONS = {
  COMPLETE_VIEW: { fn: logic.doCompleteView, level: "self" },
  REQUEST_WITHDRAWAL: { fn: logic.doRequestWithdrawal, level: "self" },
  REQUEST_ADVERTISER_WITHDRAWAL: { fn: logic.doRequestAdvertiserWithdrawal, level: "self" },
  UPGRADE_MEMBERSHIP: { fn: logic.doUpgradeMembership, level: "self" },
  ADVERTISER_SUBSCRIBE: { fn: logic.doAdvertiserSubscribe, level: "self" },
  ADVERTISER_DEPOSIT: { fn: logic.doAdvertiserDeposit, level: "self" },
  CREATE_CAMPAIGN: { fn: logic.doCreateCampaign, level: "self" },
  RESOLVE_WITHDRAWAL: { fn: logic.doResolveWithdrawal, level: "admin" },
  SET_CAMPAIGN_STATUS: { fn: logic.doSetCampaignStatus, level: "admin" },
  SET_ADVERTISER_STATUS: { fn: logic.doSetAdvertiserStatus, level: "admin" },
  SET_USER_FLAG: { fn: logic.doSetUserFlag, level: "admin" },
  ADMIN_DELETE_USER: { fn: logic.doAdminDeleteUser, level: "admin" },
  UPDATE_CONFIG: { fn: logic.doUpdateConfig, level: "admin" },
  CLEAR_IDENTITY_FLAG: { fn: logic.doClearIdentityFlag, level: "admin" },
  SET_AVATAR: { fn: logic.doSetAvatar, level: "self" },
  TOGGLE_WISHLIST: { fn: logic.doToggleWishlist, level: "self" },
  FOLLOW_ACCOUNT: { fn: logic.doFollowAccount, level: "self" },
  FOLLOW_BY_CODE: { fn: logic.doFollowByCode, level: "self" },
  UNFOLLOW_ACCOUNT: { fn: logic.doUnfollowAccount, level: "self" },
  APPROVE_FOLLOW_REQUEST: { fn: logic.doApproveFollowRequest, level: "self" },
  DENY_FOLLOW_REQUEST: { fn: logic.doDenyFollowRequest, level: "self" },
  REMOVE_FOLLOWER: { fn: logic.doRemoveFollower, level: "self" },
  MARK_NOTIFICATION_READ: { fn: logic.doMarkNotificationRead, level: "self" },
  MARK_ALL_NOTIFICATIONS_READ: { fn: logic.doMarkAllNotificationsRead, level: "self" },
  ADMIT_FROM_WAITLIST: { fn: logic.doAdmitFromWaitlist, level: "admin" },
  ADMIT_WAITLIST_BATCH: { fn: logic.doAdmitWaitlistBatch, level: "admin" },
  CREATE_PRODUCT: { fn: logic.doCreateProduct, level: "self" },
  SET_PRODUCT_STATUS: { fn: logic.doSetProductStatus, level: "self" },
  ADMIN_SET_PRODUCT_STATUS: { fn: logic.doAdminSetProductStatus, level: "admin" },
  RESTOCK_PRODUCT: { fn: logic.doRestockProduct, level: "self" },
  GIFT_PRODUCT: { fn: logic.doGiftProduct, level: "self" },
  PURCHASE_PRODUCT: { fn: logic.doPurchaseProduct, level: "self" },
  SET_ORDER_STATUS: { fn: logic.doSetOrderStatus, level: "self" },
  UPDATE_PROFILE: { fn: logic.doUpdateProfile, level: "self" },
  SET_MUTE_PREFS: { fn: logic.doSetMutePrefs, level: "self" },
  DONATE: { fn: logic.doDonate, level: "self" },
};

/* -------------------------------- routes --------------------------------- */

app.get("/api/state", (req, res) => {
  const db = readDB();
  res.json({ db: sanitizeDB(db, req.userId), currentUserId: req.userId || null });
});

app.get("/api/profile/:targetId", (req, res) => {
  if (!req.userId) return res.status(401).json({ error: "Please log in." });
  const db = readDB();
  const profile = logic.getPublicProfile(db, req.params.targetId, req.userId);
  if (!profile) return res.status(404).json({ error: "Account not found." });
  res.json({ profile });
});

app.get("/api/lookup-code/:code", (req, res) => {
  if (!req.userId) return res.status(401).json({ error: "Please log in." });
  const db = readDB();
  const target = Object.values(db.users).find((u) => u.role === "user" && u.referralCode === (req.params.code || "").trim().toUpperCase());
  if (!target) return res.status(404).json({ error: "No account found with that code." });
  // Deliberately minimal — just enough to visually confirm this is the right
  // person before sending a follow request. Never email, balance, or anything else.
  res.json({ preview: { id: target.id, name: target.name, avatarDataUrl: target.avatarDataUrl || null } });
});

app.get("/api/campaign-analytics/:campaignId", (req, res) => {
  if (!req.userId) return res.status(401).json({ error: "Please log in." });
  const db = readDB();
  const analytics = logic.getCampaignAnalytics(db, req.params.campaignId, req.userId);
  if (analytics.error) return res.status(analytics.error.includes("own campaigns") ? 403 : 404).json(analytics);
  res.json({ analytics });
});

app.get("/api/search", (req, res) => {
  if (!req.userId) return res.status(401).json({ error: "Please log in." });
  const q = (req.query.q || "").trim().toLowerCase();
  const type = req.query.type === "advertiser" ? "advertiser" : "user";
  if (q.length < 2) return res.json({ results: [] });
  const db = readDB();
  const results = Object.values(db.users)
    .filter((u) => u.role === type)
    .filter((u) => (type === "advertiser" ? u.company : u.name).toLowerCase().includes(q))
    .filter((u) => type !== "advertiser" || u.advertiserStatus === "approved")
    .slice(0, 20)
    // Same minimal-preview principle as everywhere else — search results
    // are exactly as safe to show as a code lookup, never more.
    .map((u) => ({ id: u.id, name: type === "advertiser" ? u.company : u.name, avatarDataUrl: u.avatarDataUrl || null, role: u.role }));
  res.json({ results });
});

app.post("/api/auth/register", registerLimiter, async (req, res) => {
  const { role, name, email, password, company, contact, referralCode } = req.body || {};
  if (!password || String(password).length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters." });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const { db, result } = await withDB((draft) =>
    logic.doRegister(draft, { role, name, email, passwordHash, company, contact, referralCode })
  );
  if (result.error) return res.status(400).json({ error: result.error });
  setSessionCookie(res, result.newId);
  res.json({ message: result.message, db: sanitizeDB(db, result.newId), currentUserId: result.newId });
});

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const db = readDB();
  const user = Object.values(db.users).find(
    (u) => u.email.toLowerCase() === String(email || "").toLowerCase()
  );
  if (!user || !bcrypt.compareSync(String(password || ""), user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  if (user.suspended) return res.status(403).json({ error: "This account has been suspended." });
  setSessionCookie(res, user.id);
  res.json({ message: "Welcome back.", db: sanitizeDB(db, user.id), currentUserId: user.id });
});

app.post("/api/auth/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ message: "Logged out." });
});

async function attemptRealPayout({ withdrawalId, userId, amount }) {
  const stripe = getStripe();
  const preDb = readDB();
  const user = preDb.users[userId];
  if (!stripe || !user?.stripeConnectAccountId) {
    const { result } = await withDB((draft) => logic.doFailRealWithdrawal(draft, { withdrawalId, reason: "Payouts aren't available right now." }));
    return result;
  }
  try {
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100),
      currency: "gbp",
      destination: user.stripeConnectAccountId,
    });
    const { result } = await withDB((draft) => logic.doMarkWithdrawalTransferred(draft, { withdrawalId, stripeTransferId: transfer.id }));
    return result;
  } catch (e) {
    console.error("Stripe transfer failed:", e.message);
    const { result } = await withDB((draft) => logic.doFailRealWithdrawal(draft, { withdrawalId, reason: e.message }));
    return result;
  }
}

app.post("/api/action", async (req, res) => {
  const { type, payload } = req.body || {};
  const action = ACTIONS[type];
  if (!action) return res.status(400).json({ error: "Unknown action." });
  if (!req.userId) return res.status(401).json({ error: "Please log in." });

  const { db, result } = await withDB((draft) => {
    const actor = draft.users[req.userId];
    if (!actor) return { error: "Session expired — please log in again." };
    if (action.level === "admin" && actor.role !== "admin") {
      return { error: "Admin access required." };
    }
    const finalPayload = { ...(payload || {}) };
    if (action.level === "self") finalPayload.userId = req.userId;
    return action.fn(draft, finalPayload);
  });

  if (result.error) return res.status(400).json({ error: result.error });

  // Withdrawal actions may need a real Stripe transfer to complete before
  // we can report success — the funds were already reserved in the mutation
  // above, this just finishes the job (or cleanly refunds on failure).
  if (result.needsRealTransfer) {
    const finalResult = await attemptRealPayout({ withdrawalId: result.withdrawalId, userId: result.userId, amount: result.amount });
    if (finalResult.failed) return res.status(400).json({ error: finalResult.message, db: sanitizeDB(readDB(), req.userId) });
    return res.json({ message: finalResult.message, db: sanitizeDB(readDB(), req.userId) });
  }

  res.json({ message: result.message, db: sanitizeDB(db, req.userId), newId: result.newId });
});

/* -------------------------------- stripe ----------------------------------- */

const MIN_DEPOSIT_GBP = 5;
const MAX_DEPOSIT_GBP = 10000;

app.post("/api/stripe/create-deposit-session", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Payments aren't configured on this server yet." });
  if (!req.userId) return res.status(401).json({ error: "Please log in." });

  const db = readDB();
  const user = db.users[req.userId];
  if (!user || user.role !== "advertiser") return res.status(403).json({ error: "Only advertiser accounts can deposit funds." });
  if (user.advertiserStatus !== "approved") return res.status(403).json({ error: "Your advertiser account must be approved first." });

  const amount = parseFloat(req.body?.amount);
  if (!(amount >= MIN_DEPOSIT_GBP && amount <= MAX_DEPOSIT_GBP)) {
    return res.status(400).json({ error: `Enter an amount between £${MIN_DEPOSIT_GBP} and £${MAX_DEPOSIT_GBP}.` });
  }

  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "gbp",
          product_data: { name: "adspXce advertising balance top-up" },
          unit_amount: Math.round(amount * 100), // Stripe expects the smallest currency unit (pence)
        },
        quantity: 1,
      }],
      success_url: `${baseUrl}/?deposit=success`,
      cancel_url: `${baseUrl}/?deposit=cancelled`,
      client_reference_id: req.userId,
      metadata: { userId: req.userId, amount: amount.toFixed(2) },
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error("Stripe session creation failed:", e.message);
    res.status(500).json({ error: "Couldn't start checkout. Please try again." });
  }
});

app.post("/api/stripe/webhook", async (req, res) => {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) return res.status(503).send("Webhook not configured.");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], webhookSecret);
  } catch (e) {
    console.error("Stripe webhook signature verification failed:", e.message);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id || session.metadata?.userId;
    const amount = parseFloat(session.metadata?.amount);
    if (userId && amount > 0) {
      await withDB((draft) => logic.doRecordStripeDeposit(draft, { userId, amount, stripeSessionId: session.id }));
    }
  }

  if (event.type === "account.updated") {
    const account = event.data.object;
    const onboarded = !!(account.details_submitted && account.charges_enabled && account.payouts_enabled);
    await withDB((draft) => logic.doSetStripeConnectStatus(draft, { stripeConnectAccountId: account.id, onboarded }));
  }

  if (event.type === "identity.verification_session.verified" || event.type === "identity.verification_session.requires_input") {
    console.log(`Stripe Identity webhook received: ${event.type} for session ${event.data.object.id}`);
    const sessionObj = event.data.object;
    const preDb = readDB();
    const user = Object.values(preDb.users).find((u) => u.identityVerificationSessionId === sessionObj.id);
    if (!user) {
      console.error(`Stripe Identity webhook: no user found with session id ${sessionObj.id} — this session may predate the current database, or the session id wasn't saved correctly at verification-start time.`);
    }
    if (user) {
      try {
        let status = "processing";
        let firstName, lastName, dob;
        if (event.type === "identity.verification_session.verified") {
          // Webhook payloads don't reliably include expanded fields, so
          // re-retrieve the full session the same way the manual check
          // does, rather than trusting verified_outputs is already here.
          const fullSession = await stripe.identity.verificationSessions.retrieve(sessionObj.id, { expand: ["verified_outputs"] });
          status = "verified";
          firstName = fullSession.verified_outputs?.first_name;
          lastName = fullSession.verified_outputs?.last_name;
          dob = fullSession.verified_outputs?.dob
            ? `${fullSession.verified_outputs.dob.year}-${String(fullSession.verified_outputs.dob.month).padStart(2, "0")}-${String(fullSession.verified_outputs.dob.day).padStart(2, "0")}`
            : undefined;
        } else {
          status = "failed";
        }
        await withDB((draft) => logic.doApplyIdentityResult(draft, { userId: user.id, status, firstName, lastName, dob }));
        console.log(`Stripe Identity webhook: successfully applied status "${status}" to user ${user.id}`);
      } catch (e) {
        console.error("Stripe Identity webhook processing failed:", e.message);
      }
    }
  }

  res.json({ received: true });
});

app.post("/api/stripe/connect-onboard", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Payouts aren't configured on this server yet." });
  if (!req.userId) return res.status(401).json({ error: "Please log in." });

  const db = readDB();
  const user = db.users[req.userId];
  if (!user || (user.role !== "user" && user.role !== "advertiser")) return res.status(403).json({ error: "Only user or advertiser accounts can set up payouts." });

  try {
    let accountId = user.stripeConnectAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        email: user.email,
        capabilities: { transfers: { requested: true } },
      });
      accountId = account.id;
      await withDB((draft) => logic.doSetStripeConnectAccount(draft, { userId: req.userId, stripeConnectAccountId: accountId }));
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/?payout=refresh`,
      return_url: `${baseUrl}/?payout=return`,
      type: "account_onboarding",
    });
    res.json({ url: accountLink.url });
  } catch (e) {
    console.error("Stripe Connect onboarding failed:", e.message);
    res.status(500).json({ error: "Couldn't start payout setup. Please try again." });
  }
});

// Checks Stripe directly for the real, current onboarding status, rather
// than relying only on the account.updated webhook arriving — webhooks for
// connected-account events specifically require extra configuration in
// Stripe's dashboard that's easy to get wrong, so this is a more reliable
// fallback: call this whenever a user returns from onboarding, or on demand.
app.post("/api/stripe/connect-refresh", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Payouts aren't configured on this server yet." });
  if (!req.userId) return res.status(401).json({ error: "Please log in." });

  const preDb = readDB();
  const user = preDb.users[req.userId];
  if (!user || !user.stripeConnectAccountId) {
    return res.json({ db: sanitizeDB(preDb, req.userId), onboarded: false });
  }

  try {
    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
    const onboarded = !!(account.details_submitted && account.charges_enabled && account.payouts_enabled);
    const { db } = await withDB((draft) =>
      logic.doSetStripeConnectStatus(draft, { stripeConnectAccountId: user.stripeConnectAccountId, onboarded })
    );
    res.json({ db: sanitizeDB(db, req.userId), onboarded });
  } catch (e) {
    console.error("Stripe Connect status refresh failed:", e.message);
    res.status(500).json({ error: "Couldn't check payout status. Please try again." });
  }
});

app.post("/api/stripe/identity-start", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Identity verification isn't configured on this server yet." });
  if (!req.userId) return res.status(401).json({ error: "Please log in." });

  try {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      metadata: { userId: req.userId },
      options: { document: { require_matching_selfie: true } },
      return_url: `${baseUrl}/?identity=return`,
    });
    await withDB((draft) => logic.doSetIdentitySession(draft, { userId: req.userId, sessionId: session.id }));
    res.json({ url: session.url });
  } catch (e) {
    console.error("Stripe Identity session creation failed:", e.message);
    res.status(500).json({ error: "Couldn't start identity verification. Please try again." });
  }
});

// Checks Stripe directly for the real verification result, the same
// reliable pattern used for Connect payouts — don't depend solely on a
// webhook arriving, since that proved fragile with Connect's account-scoped
// events. Call this whenever a user returns from verification, or on demand.
app.post("/api/stripe/identity-refresh", async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: "Identity verification isn't configured on this server yet." });
  if (!req.userId) return res.status(401).json({ error: "Please log in." });

  const preDb = readDB();
  const user = preDb.users[req.userId];
  if (!user || !user.identityVerificationSessionId) {
    return res.json({ db: sanitizeDB(preDb, req.userId), status: "none" });
  }

  try {
    const session = await stripe.identity.verificationSessions.retrieve(
      user.identityVerificationSessionId,
      { expand: ["verified_outputs"] }
    );
    let status = "processing";
    let firstName, lastName, dob;
    if (session.status === "verified") {
      status = "verified";
      firstName = session.verified_outputs?.first_name;
      lastName = session.verified_outputs?.last_name;
      dob = session.verified_outputs?.dob
        ? `${session.verified_outputs.dob.year}-${String(session.verified_outputs.dob.month).padStart(2, "0")}-${String(session.verified_outputs.dob.day).padStart(2, "0")}`
        : undefined;
    } else if (session.status === "requires_input") {
      status = "failed";
    }
    const { db } = await withDB((draft) =>
      logic.doApplyIdentityResult(draft, { userId: req.userId, status, firstName, lastName, dob })
    );
    res.json({ db: sanitizeDB(db, req.userId), status });
  } catch (e) {
    console.error("Stripe Identity status refresh failed:", e.message);
    res.status(500).json({ error: "Couldn't check verification status. Please try again." });
  }
});

/* ------------------------------- backups ---------------------------------- */

function requireAdmin(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: "Please log in." });
  const db = readDB();
  const user = db.users[req.userId];
  if (!user || user.role !== "admin") return res.status(403).json({ error: "Admin access required." });
  next();
}

app.get("/api/admin/backup-status", requireAdmin, (req, res) => {
  res.json(latestBackupInfo());
});

app.get("/api/admin/export", requireAdmin, (req, res) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  res.download(DB_PATH, `adspxce-backup-${stamp}.json`);
});

// Automatic rolling backup: one on startup (covers redeploys), then every 6
// hours. Keeps the last 10 snapshots, oldest pruned automatically.
createBackup();
setInterval(createBackup, 6 * 60 * 60 * 1000);

/* ---------------------------- static frontend ----------------------------- */
// Without explicit headers here, whether a browser serves a stale copy of
// the app after a deploy is left to browser/network heuristics — which is
// exactly the "sometimes works, sometimes shows an old version" pattern
// this was causing. The fix: index.html must always be re-fetched fresh
// (it's what points the browser at the current JS bundle), while the
// bundle files themselves are safe to cache forever, since Vite gives each
// build's files a new content-hashed filename — an old cached filename
// simply won't be referenced by a fresh index.html anymore.

const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist, {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    } else {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
}));
app.get("*", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(path.join(clientDist, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`adspXce server listening on port ${PORT}`));
