const bcrypt = require("bcryptjs");

/* =============================== HELPERS ================================ */

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const nowISO = () => new Date().toISOString();
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const effectiveDailyViews = (user) => (user.dailyViewsDate === todayStr() ? (user.dailyViewsUsed || 0) : 0);

/* ================================ SEED =================================== */

function seedDB() {
  const adminId = "admin_1";
  const u1 = "user_demo1";
  const u2 = "user_demo2";
  const adv1 = "adv_demo1";
  const camp1 = "camp_demo1";
  const camp2 = "camp_demo2";
  const prod1 = "prod_demo1";
  const prod2 = "prod_demo2";
  const hash = (p) => bcrypt.hashSync(p, 10);
  return {
    config: {
      cpvMin: 0.10, cpvMax: 0.30,
      membership: {
        basic: { views: 50, price: 0, sharePct: 40 },
        plus: { views: 75, price: 15, sharePct: 55 },
        premium: { views: 100, price: 25, sharePct: 70 },
      },
      advertiserSubscriptionPrice: 29, withdrawalMinimum: 25, trustAutoApproveThreshold: 80,
      loyaltyBonusDaysRequired: 4, loyaltyBonusAmount: 0.50, minCampaignsForUpgrade: 5, waitlistEnabled: true,
      waitlistSafetyMultiplier: 4,
    },
    users: {
      [adminId]: { id: adminId, role: "admin", name: "Admin", email: "admin@adspxce.test", passwordHash: hash("admin"), createdAt: nowISO() },
      [u1]: { id: u1, role: "user", name: "Jordan Blake", email: "jordan@demo.test", passwordHash: hash("demo"), membership: "basic", balance: 4.80, pendingWithdrawal: 0, totalEarned: 4.80, dailyViewsUsed: 3, dailyViewsDate: todayStr(), verified: true, suspended: false, profile: { interests: ["Outdoors", "Fitness"], ageRange: "25-34", region: "North West England" }, mutedAdvertisers: [], mutedInterests: [], referralCode: "JORDAN1", referredBy: null, referralBonusPaid: true, stripeConnectAccountId: null, stripeConnectOnboarded: false, lastLoyaltyBonusWeek: null, identityVerificationStatus: "none", identityVerificationSessionId: null, identityVerifiedAt: null, identityVerifiedName: null, identityFingerprint: null, identityDuplicateFlag: false, waitlisted: false, avatarDataUrl: null, profileVisibility: "private", wishlist: [], following: [], followRequestsReceived: [], createdAt: nowISO() },
      [u2]: { id: u2, role: "user", name: "Priya Shah", email: "priya@demo.test", passwordHash: hash("demo"), membership: "plus", balance: 18.20, pendingWithdrawal: 0, totalEarned: 42.10, dailyViewsUsed: 0, dailyViewsDate: todayStr(), verified: true, suspended: false, profile: { interests: ["Technology", "Finance"], ageRange: "25-34", region: "London" }, mutedAdvertisers: [], mutedInterests: [], referralCode: "PRIYA1", referredBy: null, referralBonusPaid: true, stripeConnectAccountId: null, stripeConnectOnboarded: false, lastLoyaltyBonusWeek: null, identityVerificationStatus: "none", identityVerificationSessionId: null, identityVerifiedAt: null, identityVerifiedName: null, identityFingerprint: null, identityDuplicateFlag: false, waitlisted: false, avatarDataUrl: null, profileVisibility: "private", wishlist: [], following: [], followRequestsReceived: [], createdAt: nowISO() },
      [adv1]: { id: adv1, role: "advertiser", name: "Morgan Lee", email: "morgan@brand.test", passwordHash: hash("demo"), company: "Northwind Outfitters", contact: "morgan@brand.test", advertiserStatus: "approved", advertiserBalance: 640.00, subscriptionActive: true, avatarDataUrl: null, createdAt: nowISO() },
    },
    campaigns: {
      [camp1]: { id: camp1, advertiserId: adv1, name: "Autumn Boot Launch", adTitle: "New Trailhead Boots — 20% Off", content: "Introducing our all-weather Trailhead boot line, built for the first frost.", destinationUrl: "https://example.com/boots", cpv: 0.20, totalBudget: 200, spent: 24, views: 120, dailyBudget: 50, targetAudience: "Outdoors, 25-45", geo: "United Kingdom", interestTags: ["Outdoors", "Fitness"], ageRange: "25-34", status: "active", createdAt: nowISO() },
      [camp2]: { id: camp2, advertiserId: adv1, name: "Loyalty App Signup", adTitle: "Join Northwind Rewards", content: "Sign up for Northwind Rewards and get early access to every seasonal drop.", destinationUrl: "https://example.com/rewards", cpv: 0.15, totalBudget: 120, spent: 9, views: 60, dailyBudget: 30, targetAudience: "All", geo: "United Kingdom", interestTags: [], ageRange: "All", status: "active", createdAt: nowISO() },
    },
    transactions: [],
    withdrawals: {},
    products: {
      [prod1]: { id: prod1, advertiserId: adv1, name: "Trailhead Boot — Storm Grey", description: "All-weather waterproof boot, the one from the Autumn Boot Launch campaign.", price: 89.99, stock: 40, category: "Footwear", status: "active", createdAt: nowISO() },
      [prod2]: { id: prod2, advertiserId: adv1, name: "Northwind Rewards Tote Bag", description: "Weatherproof canvas tote, exclusive to Rewards members.", price: 24.50, stock: 120, category: "Accessories", status: "active", createdAt: nowISO() },
    },
    orders: {},
    stripeEvents: {},
  };
}

/* ============================ MUTATION LOGIC ============================= */
/* Each function takes a draft db (mutable object) + args, mutates it in place,
   and returns {error} or {message, ...extra}. Applied inside store.withDB(). */

function doRegister(db, { role, name, email, passwordHash, company, contact, referralCode }) {
  const exists = Object.values(db.users).some((u) => u.email.toLowerCase() === (email || "").toLowerCase());
  if (exists) return { error: "An account with that email already exists." };
  if (!name || !email || !passwordHash) return { error: "Please fill in all required fields." };
  const id = uid(role === "advertiser" ? "adv" : "user");
  if (role === "advertiser") {
    if (!company) return { error: "Company name is required for advertiser accounts." };
    db.users[id] = { id, role: "advertiser", name, email, passwordHash, company, contact: contact || email, advertiserStatus: "pending", advertiserBalance: 0, subscriptionActive: false, avatarDataUrl: null, createdAt: nowISO() };
    return { message: "Advertiser account created — pending admin approval.", newId: id };
  }
  let referredBy = null;
  if (referralCode) {
    const referrer = Object.values(db.users).find((u) => u.role === "user" && u.referralCode === referralCode.trim().toUpperCase());
    if (referrer) referredBy = referrer.id;
  }
  // Only actually waitlist if real capacity is exhausted right now — someone
  // registering while there's genuine room gets straight in, automatically.
  const waitlisted = (db.config.waitlistEnabled ?? true) && admittedUserCount(db) >= waitlistCapacity(db);
  db.users[id] = {
    id, role: "user", name, email, passwordHash, membership: "basic", balance: 0, pendingWithdrawal: 0, totalEarned: 0,
    dailyViewsUsed: 0, dailyViewsDate: todayStr(), verified: false, suspended: false, waitlisted,
    profile: { interests: [], ageRange: null, region: "" }, mutedAdvertisers: [], mutedInterests: [],
    referralCode: generateReferralCode(db), referredBy, referralBonusPaid: false,
    stripeConnectAccountId: null, stripeConnectOnboarded: false, lastLoyaltyBonusWeek: null,
    identityVerificationStatus: "none", identityVerificationSessionId: null, identityVerifiedAt: null,
    identityVerifiedName: null, identityFingerprint: null, identityDuplicateFlag: false,
    avatarDataUrl: null, profileVisibility: "private", wishlist: [], following: [], followRequestsReceived: [], createdAt: nowISO(),
  };
  return {
    message: waitlisted
      ? "You're on the waitlist — we're growing advertiser supply and letting people in as we go."
      : "Account created. Welcome to adspXce.",
    newId: id,
  };
}

function doCompleteView(db, { userId, campaignId, attentionPassed, interruptions, variant }) {
  const user = db.users[userId];
  const campaign = db.campaigns[campaignId];
  if (!user || !campaign) return { error: "This advertisement is no longer available." };
  if (user.waitlisted) return { error: "You're still on the waitlist — hang tight, we're letting people in as advertiser supply grows." };
  if (user.identityVerificationStatus !== "verified") return { error: "Verify your identity first — every view on adspXce needs to be a genuine, verified person." };
  if (campaign.status !== "active") return { error: "This campaign is no longer active." };
  const cfg = db.config;
  const limit = cfg.membership[user.membership].views;
  const used = effectiveDailyViews(user);
  if (used >= limit) return { error: "You've reached your daily view limit for your membership tier." };
  const remaining = round2(campaign.totalBudget - campaign.spent);
  if (remaining < campaign.cpv - 0.0001) {
    campaign.status = "completed";
    return { error: "This campaign's budget was just exhausted." };
  }
  const usedVariant = campaign.variantB && variant === "B" ? "B" : "A";
  if (!attentionPassed) {
    db.transactions.unshift({
      id: uid("txn"), type: "AD_VIEW_FAILED", status: "REJECTED", timestamp: nowISO(),
      userId, advertiserId: campaign.advertiserId, campaignId, campaignName: campaign.name,
      interruptions: interruptions || 0, variant: usedVariant,
    });
    return { error: "Attention check missed — this view wasn't counted. Try again." };
  }
  const userShare = round2(campaign.cpv * (cfg.membership[user.membership].sharePct / 100));
  const platformShare = round2(campaign.cpv - userShare);
  campaign.spent = round2(campaign.spent + campaign.cpv);
  campaign.views = (campaign.views || 0) + 1;
  if (round2(campaign.totalBudget - campaign.spent) < 0.005) campaign.status = "completed";
  user.balance = round2(user.balance + userShare);
  user.totalEarned = round2(user.totalEarned + userShare);
  user.dailyViewsUsed = used + 1;
  user.dailyViewsDate = todayStr();
  db.transactions.unshift({
    id: uid("txn"), type: "AD_VIEW", status: "COMPLETED", timestamp: nowISO(),
    userId, advertiserId: campaign.advertiserId, campaignId, campaignName: campaign.name,
    cpv: campaign.cpv, userShare, platformShare, interruptions: interruptions || 0, variant: usedVariant,
  });
  maybePayLoyaltyBonus(db, userId);
  return { message: `You earned £${userShare.toFixed(2)}.` };
}

function doRequestWithdrawal(db, { userId, amount }) {
  const user = db.users[userId];
  const cfg = db.config;
  if (user.identityDuplicateFlag) {
    return { error: "Your account is flagged for review — withdrawals are paused until an admin looks into it. You can still watch ads as normal." };
  }
  if (!(amount > 0)) return { error: "Enter a valid amount." };
  if (amount < cfg.withdrawalMinimum) return { error: `Minimum withdrawal is £${cfg.withdrawalMinimum.toFixed(2)}.` };
  if (amount > user.balance) return { error: "Amount exceeds your available balance." };
  const trust = computeTrustScore(user, db.transactions);
  const threshold = cfg.trustAutoApproveThreshold ?? TRUST_AUTO_APPROVE_THRESHOLD;
  const autoApprove = trust !== null && trust >= threshold;
  const hasRealPayout = !!user.stripeConnectOnboarded;

  user.balance = round2(user.balance - amount);
  user.pendingWithdrawal = round2((user.pendingWithdrawal || 0) + amount);
  const wid = uid("wd");

  if (autoApprove && hasRealPayout) {
    // Funds are reserved, but NOT marked paid yet — a real Stripe transfer
    // must actually succeed first. The caller (server/index.js) attempts
    // that transfer, then reconciles via doMarkWithdrawalTransferred or
    // doFailRealWithdrawal.
    db.withdrawals[wid] = { id: wid, userId, amount: round2(amount), status: "processing", requestedAt: nowISO() };
    db.transactions.unshift({ id: uid("txn"), type: "WITHDRAWAL", status: "PENDING", timestamp: nowISO(), userId, amount: round2(amount), withdrawalId: wid });
    return { message: "Processing your payout…", needsRealTransfer: true, withdrawalId: wid, amount: round2(amount), userId };
  }

  if (autoApprove) {
    // No real payout set up yet — same instant-paid demo behaviour as before.
    user.pendingWithdrawal = round2(user.pendingWithdrawal - amount);
    db.withdrawals[wid] = { id: wid, userId, amount: round2(amount), status: "paid", requestedAt: nowISO(), resolvedAt: nowISO(), autoApproved: true };
    db.transactions.unshift({ id: uid("txn"), type: "WITHDRAWAL", status: "COMPLETED", timestamp: nowISO(), userId, amount: round2(amount), withdrawalId: wid });
    return { message: `Withdrawal of £${round2(amount).toFixed(2)} auto-approved — your trust score unlocked instant payout.` };
  }

  db.withdrawals[wid] = { id: wid, userId, amount: round2(amount), status: "pending", requestedAt: nowISO() };
  db.transactions.unshift({ id: uid("txn"), type: "WITHDRAWAL", status: "PENDING", timestamp: nowISO(), userId, amount: round2(amount), withdrawalId: wid });
  return { message: "Withdrawal requested. It's now pending review." };
}

function doResolveWithdrawal(db, { withdrawalId, approve }) {
  const w = db.withdrawals[withdrawalId];
  if (!w || w.status !== "pending") return { error: "Withdrawal already resolved." };
  const user = db.users[w.userId];

  if (approve && user.stripeConnectOnboarded) {
    w.status = "processing";
    return { message: "Processing payout…", needsRealTransfer: true, withdrawalId, amount: w.amount, userId: w.userId };
  }

  user.pendingWithdrawal = round2((user.pendingWithdrawal || 0) - w.amount);
  w.status = approve ? "paid" : "rejected";
  w.resolvedAt = nowISO();
  if (!approve) user.balance = round2(user.balance + w.amount);
  const txn = db.transactions.find((t) => t.withdrawalId === withdrawalId);
  if (txn) txn.status = approve ? "COMPLETED" : "REJECTED";
  return { message: approve ? "Withdrawal marked as paid." : "Withdrawal rejected and refunded to user balance." };
}

function doMarkWithdrawalTransferred(db, { withdrawalId, stripeTransferId }) {
  const w = db.withdrawals[withdrawalId];
  if (!w) return { error: "Withdrawal not found." };
  const user = db.users[w.userId];
  user.pendingWithdrawal = round2((user.pendingWithdrawal || 0) - w.amount);
  w.status = "paid";
  w.resolvedAt = nowISO();
  w.stripeTransferId = stripeTransferId;
  const txn = db.transactions.find((t) => t.withdrawalId === withdrawalId);
  if (txn) txn.status = "COMPLETED";
  return { message: "Payout completed." };
}

function doFailRealWithdrawal(db, { withdrawalId, reason }) {
  const w = db.withdrawals[withdrawalId];
  if (!w) return { error: "Withdrawal not found." };
  const user = db.users[w.userId];
  user.pendingWithdrawal = round2((user.pendingWithdrawal || 0) - w.amount);
  user.balance = round2(user.balance + w.amount); // refund — the transfer never actually happened
  w.status = "rejected";
  w.resolvedAt = nowISO();
  w.failureReason = reason || "Payout failed";
  const txn = db.transactions.find((t) => t.withdrawalId === withdrawalId);
  if (txn) txn.status = "REJECTED";
  return { message: "Payout couldn't be completed — your balance has been refunded.", failed: true };
}

function doSetStripeConnectAccount(db, { userId, stripeConnectAccountId }) {
  const user = db.users[userId];
  if (!user) return { error: "User not found." };
  user.stripeConnectAccountId = stripeConnectAccountId;
  return { message: "Payout account created." };
}

function doSetStripeConnectStatus(db, { stripeConnectAccountId, onboarded }) {
  const user = Object.values(db.users).find((u) => u.stripeConnectAccountId === stripeConnectAccountId);
  if (!user) return { error: "No matching account." };
  user.stripeConnectOnboarded = onboarded;
  return { message: "Payout status updated." };
}

/* ============================== IDENTITY VERIFICATION ======================= */
// Deliberately stores the minimum possible PII: no document numbers, no
// address, no date of birth in plain text — only a one-way hash (name + DOB)
// used purely to detect when the SAME real person verifies against a SECOND
// account. A match is flagged for admin review, never an automatic ban —
// consistent with the rest of the app's fraud-handling philosophy.

function identityFingerprint(firstName, lastName, dob) {
  const crypto = require("crypto");
  const normalized = `${(firstName || "").trim().toLowerCase()}|${(lastName || "").trim().toLowerCase()}|${dob || ""}`;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function doSetIdentitySession(db, { userId, sessionId }) {
  const user = db.users[userId];
  if (!user) return { error: "User not found." };
  user.identityVerificationSessionId = sessionId;
  user.identityVerificationStatus = "processing";
  return { message: "Verification started." };
}

function doApplyIdentityResult(db, { userId, status, firstName, lastName, dob }) {
  const user = db.users[userId];
  if (!user) return { error: "User not found." };

  if (status !== "verified") {
    user.identityVerificationStatus = status; // 'failed' or 'processing'
    return { message: `Identity verification: ${status}.` };
  }

  const fingerprint = firstName && lastName ? identityFingerprint(firstName, lastName, dob) : null;
  const duplicate = fingerprint
    ? Object.values(db.users).some((u) => u.id !== userId && u.identityFingerprint === fingerprint)
    : false;

  user.identityVerificationStatus = "verified";
  user.identityVerifiedAt = nowISO();
  user.identityVerifiedName = firstName && lastName ? `${firstName} ${lastName}` : null;
  user.identityFingerprint = fingerprint;
  user.identityDuplicateFlag = duplicate;

  // Referral bonus now only pays on genuine, non-duplicate identity
  // verification — not just watching one ad — specifically because that
  // was trivially farmable with fake accounts. A duplicate match means
  // this is the same real person as an existing account, so it's
  // deliberately excluded here even though verification itself succeeded.
  if (!duplicate) maybePayReferralBonus(db, userId);

  return { message: duplicate ? "Verified, but matches another account — flagged for review." : "Identity verified." };
}

/* ============================== SOCIAL PROFILE =============================== */
// The core rule for everything in this section: a regular user account is
// never exposed to anyone but themselves or an admin, UNLESS the account
// owner has explicitly made it public or explicitly approved a specific
// follower — and even then, only the fields deliberately meant to be
// shared (name, picture, wishlist) are ever exposed. Balance, email, trust
// score, and everything else stays fully private regardless.

const MAX_AVATAR_BASE64_BYTES = 180 * 1024;

function doSetAvatar(db, { userId, avatarDataUrl }) {
  const user = db.users[userId];
  if (!user) return { error: "User not found." };
  if (avatarDataUrl) {
    if (typeof avatarDataUrl !== "string" || !avatarDataUrl.startsWith("data:image/")) {
      return { error: "Please upload a valid image." };
    }
    const base64Part = avatarDataUrl.split(",")[1] || "";
    const approxBytes = base64Part.length * 0.75;
    if (approxBytes > MAX_AVATAR_BASE64_BYTES) {
      return { error: "Image is too large — please use a smaller photo." };
    }
  }
  user.avatarDataUrl = avatarDataUrl || null;
  return { message: avatarDataUrl ? "Profile picture updated." : "Profile picture removed." };
}

function doSetProfileVisibility(db, { userId, visibility }) {
  const user = db.users[userId];
  if (!user) return { error: "User not found." };
  if (visibility !== "public" && visibility !== "private") return { error: "Invalid visibility setting." };
  user.profileVisibility = visibility;
  return { message: `Profile set to ${visibility}.` };
}

function doToggleWishlist(db, { userId, productId }) {
  const user = db.users[userId];
  const product = db.products[productId];
  if (!user) return { error: "User not found." };
  if (!product) return { error: "Product not found." };
  if (!user.wishlist) user.wishlist = [];
  const idx = user.wishlist.indexOf(productId);
  if (idx >= 0) {
    user.wishlist.splice(idx, 1);
    return { message: "Removed from wishlist." };
  }
  user.wishlist.push(productId);
  return { message: "Added to wishlist." };
}

function doFollowAccount(db, { userId, targetId }) {
  const user = db.users[userId];
  const target = db.users[targetId];
  if (!user || !target) return { error: "Account not found." };
  if (userId === targetId) return { error: "You can't follow yourself." };
  if (!user.following) user.following = [];
  if (user.following.includes(targetId)) return { error: "Already following." };

  if (target.role === "advertiser" || target.profileVisibility === "public") {
    user.following.push(targetId);
    return { message: `Now following ${target.role === "advertiser" ? target.company : target.name}.` };
  }

  if (!target.followRequestsReceived) target.followRequestsReceived = [];
  if (target.followRequestsReceived.includes(userId)) return { error: "Follow request already sent." };
  target.followRequestsReceived.push(userId);
  return { message: "Follow request sent — they'll need to approve it." };
}

function doFollowByCode(db, { userId, code }) {
  const target = Object.values(db.users).find((u) => u.role === "user" && u.referralCode === (code || "").trim().toUpperCase());
  if (!target) return { error: "No account found with that code." };
  return doFollowAccount(db, { userId, targetId: target.id });
}

function doUnfollowAccount(db, { userId, targetId }) {
  const user = db.users[userId];
  if (!user) return { error: "User not found." };
  user.following = (user.following || []).filter((id) => id !== targetId);
  return { message: "Unfollowed." };
}

function doApproveFollowRequest(db, { userId, requesterId }) {
  const user = db.users[userId];
  const requester = db.users[requesterId];
  if (!user || !requester) return { error: "Account not found." };
  if (!(user.followRequestsReceived || []).includes(requesterId)) return { error: "No pending request from this account." };
  user.followRequestsReceived = user.followRequestsReceived.filter((id) => id !== requesterId);
  if (!requester.following) requester.following = [];
  if (!requester.following.includes(userId)) requester.following.push(userId);
  return { message: `Approved — ${requester.name} is now following you.` };
}

function doDenyFollowRequest(db, { userId, requesterId }) {
  const user = db.users[userId];
  if (!user) return { error: "Account not found." };
  user.followRequestsReceived = (user.followRequestsReceived || []).filter((id) => id !== requesterId);
  return { message: "Request denied." };
}

function doRemoveFollower(db, { userId, followerId }) {
  const follower = db.users[followerId];
  if (!follower) return { error: "Account not found." };
  follower.following = (follower.following || []).filter((id) => id !== userId);
  return { message: "Removed." };
}

// The single source of truth for what a given viewer is allowed to see of
// someone else's profile — deliberately separate from sanitizeDB, since
// that function is for your OWN full state, not a narrow, safe view of
// someone else's.
function getPublicProfile(db, targetId, viewerId) {
  const target = db.users[targetId];
  if (!target) return null;
  const viewer = viewerId ? db.users[viewerId] : null;
  const isSelf = viewerId === targetId;
  const isAdmin = !!(viewer && viewer.role === "admin");

  const followerCount = Object.values(db.users).filter((u) => (u.following || []).includes(targetId)).length;
  const followingCount = (target.following || []).length;

  const base = {
    id: target.id,
    role: target.role,
    name: target.role === "advertiser" ? target.company : target.name,
    avatarDataUrl: target.avatarDataUrl || null,
    followerCount,
    followingCount,
  };

  if (target.role === "advertiser") {
    return { ...base, advertiserStatus: target.advertiserStatus };
  }
  if (target.role !== "user") return null; // never expose admin accounts this way

  const isPublic = target.profileVisibility === "public";
  const viewerFollowsTarget = !!(viewer && (viewer.following || []).includes(targetId));
  const canSeeWishlist = isSelf || isAdmin || isPublic || viewerFollowsTarget;

  return {
    ...base,
    profileVisibility: target.profileVisibility,
    wishlist: canSeeWishlist ? (target.wishlist || []) : null,
    isFollowedByViewer: viewerFollowsTarget,
    hasPendingRequestFromViewer: !isSelf && (target.followRequestsReceived || []).includes(viewerId),
  };
}

function doClearIdentityFlag(db, { userId }) {
  const user = db.users[userId];
  if (!user) return { error: "User not found." };
  if (!user.identityDuplicateFlag) return { error: "This account isn't flagged." };
  user.identityDuplicateFlag = false;
  return { message: "Flag cleared — withdrawals unblocked." };
}

/* ================================= WAITLIST ================================= */
// Capacity is deliberately a simple, transparent, admin-tunable ratio
// (active campaigns x a "users per campaign" number) rather than a precise
// scientific model — there's no single objectively correct ratio, so this
// stays a clearly-labelled, adjustable guideline. Automatic admission only
// ever GRANTS access, never revokes it — if capacity later shrinks (a
// campaign runs out of budget), nobody already admitted loses access; the
// system just stops admitting new people until capacity grows again.

function waitlistedUsersOldestFirst(db) {
  return Object.values(db.users)
    .filter((u) => u.role === "user" && u.waitlisted)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

function admittedUserCount(db) {
  return Object.values(db.users).filter((u) => u.role === "user" && !u.waitlisted).length;
}

function waitlistCapacity(db) {
  const cfg = db.config;
  // Real economics, not a guessed flat number per campaign — a campaign
  // with a bigger daily budget or a lower CPV can genuinely support more
  // views per day, and this should reflect that directly.
  const totalDailySupply = Object.values(db.campaigns)
    .filter((c) => c.status === "active")
    .reduce((sum, c) => sum + (c.cpv > 0 ? c.dailyBudget / c.cpv : 0), 0);
  // Every newly-admitted user starts on Basic (paid tiers are separately
  // gated), so Basic's daily cap is the right worst-case-per-user figure.
  const basicDailyCap = cfg.membership.basic.views;
  const multiplier = cfg.waitlistSafetyMultiplier ?? 4;
  const perUserDemand = basicDailyCap * multiplier;
  if (perUserDemand <= 0) return 0;
  return Math.floor(totalDailySupply / perUserDemand);
}

// Call this any time active campaign supply might have just increased —
// admits as many oldest-waiting people as new capacity now allows.
function autoAdmitFromWaitlist(db) {
  const capacity = waitlistCapacity(db);
  let admitted = admittedUserCount(db);
  const queue = waitlistedUsersOldestFirst(db);
  let count = 0;
  for (const u of queue) {
    if (admitted >= capacity) break;
    u.waitlisted = false;
    admitted++;
    count++;
  }
  return count;
}

function doAdmitFromWaitlist(db, { userId }) {
  const user = db.users[userId];
  if (!user) return { error: "User not found." };
  if (!user.waitlisted) return { error: "This account isn't on the waitlist." };
  user.waitlisted = false;
  return { message: `${user.name} admitted from the waitlist.` };
}

function doAdmitWaitlistBatch(db, { count }) {
  const n = Math.max(0, parseInt(count, 10) || 0);
  const queue = waitlistedUsersOldestFirst(db);
  const toAdmit = queue.slice(0, n);
  toAdmit.forEach((u) => { u.waitlisted = false; });
  return { message: `Admitted ${toAdmit.length} of ${queue.length} waitlisted user(s).` };
}

function doUpgradeMembership(db, { userId, tier }) {
  const user = db.users[userId];
  const cfg = db.config;
  if (!cfg.membership[tier]) return { error: "Unknown membership tier." };
  if (user.membership === tier) return { error: "You're already on this plan." };
  if (cfg.membership[tier].price > 0) {
    const activeCampaigns = Object.values(db.campaigns).filter((c) => c.status === "active").length;
    const required = cfg.minCampaignsForUpgrade ?? 5;
    if (activeCampaigns < required) {
      return { error: `This tier unlocks once there are enough active campaigns to make the extra views worthwhile — ${activeCampaigns}/${required} so far.` };
    }
  }
  user.membership = tier;
  db.transactions.unshift({ id: uid("txn"), type: "MEMBERSHIP_PURCHASE", status: "COMPLETED", timestamp: nowISO(), userId, amount: cfg.membership[tier].price, tier });
  return { message: `Upgraded to ${tier[0].toUpperCase() + tier.slice(1)}.` };
}

function doAdvertiserSubscribe(db, { userId }) {
  const adv = db.users[userId];
  if (adv.advertiserStatus !== "approved") return { error: "Your advertiser account must be approved first." };
  adv.subscriptionActive = true;
  db.transactions.unshift({ id: uid("txn"), type: "SUBSCRIPTION", status: "COMPLETED", timestamp: nowISO(), userId, amount: db.config.advertiserSubscriptionPrice });
  return { message: "Subscription active." };
}

function doAdvertiserDeposit(db, { userId, amount }) {
  const adv = db.users[userId];
  if (!(amount > 0)) return { error: "Enter a valid deposit amount." };
  adv.advertiserBalance = round2(adv.advertiserBalance + amount);
  db.transactions.unshift({ id: uid("txn"), type: "DEPOSIT", status: "COMPLETED", timestamp: nowISO(), userId, amount: round2(amount) });
  return { message: `£${round2(amount).toFixed(2)} added to your advertising balance.` };
}

function doCreateCampaign(db, { userId, form }) {
  const adv = db.users[userId];
  const cfg = db.config;
  if (adv.advertiserStatus !== "approved") return { error: "Your advertiser account isn't approved yet." };
  if (!adv.subscriptionActive) return { error: "An active subscription is required to create campaigns." };
  if (!form || !form.name || !form.adTitle || !form.content || !form.destinationUrl) return { error: "Please complete all required fields." };
  const cpv = round2(parseFloat(form.cpv));
  if (!(cpv >= cfg.cpvMin && cpv <= cfg.cpvMax)) return { error: `CPV must be between £${cfg.cpvMin.toFixed(2)} and £${cfg.cpvMax.toFixed(2)}.` };
  const totalBudget = round2(parseFloat(form.totalBudget));
  if (!(totalBudget > 0)) return { error: "Enter a valid total budget." };
  if (totalBudget > adv.advertiserBalance) return { error: "Total budget exceeds your available advertising balance." };
  adv.advertiserBalance = round2(adv.advertiserBalance - totalBudget);
  const id = uid("camp");
  const interestTags = Array.isArray(form.interestTags) ? form.interestTags.filter((t) => INTEREST_TAGS.includes(t)) : [];
  const ageRange = AGE_RANGES.includes(form.ageRange) ? form.ageRange : "All";
  const variantB = (form.variantBTitle && form.variantBContent)
    ? { adTitle: form.variantBTitle, content: form.variantBContent }
    : null;
  db.campaigns[id] = {
    id, advertiserId: userId, name: form.name, adTitle: form.adTitle, content: form.content,
    destinationUrl: form.destinationUrl, cpv, totalBudget, spent: 0, views: 0,
    dailyBudget: round2(parseFloat(form.dailyBudget) || totalBudget),
    targetAudience: form.targetAudience || "All", geo: form.geo || "United Kingdom",
    interestTags, ageRange, variantB,
    videoLengthSeconds: form.videoLengthSeconds ? Math.max(1, parseInt(form.videoLengthSeconds, 10)) : null,
    hasQuestion: !!form.hasQuestion,
    status: "pending", createdAt: nowISO(),
  };
  db.transactions.unshift({ id: uid("txn"), type: "CAMPAIGN_RESERVE", status: "COMPLETED", timestamp: nowISO(), userId, campaignId: id, amount: totalBudget });
  return { message: "Campaign submitted for approval. Funds have been reserved.", newId: id };
}

function doSetCampaignStatus(db, { campaignId, status }) {
  const c = db.campaigns[campaignId];
  if (!c) return { error: "Campaign not found." };
  if (status === "rejected" && c.status !== "pending") return { error: "Only pending campaigns can be rejected." };
  if (status === "rejected") {
    const refund = round2(c.totalBudget - c.spent);
    db.users[c.advertiserId].advertiserBalance = round2(db.users[c.advertiserId].advertiserBalance + refund);
    db.transactions.unshift({ id: uid("txn"), type: "CAMPAIGN_REFUND", status: "COMPLETED", timestamp: nowISO(), userId: c.advertiserId, campaignId, amount: refund });
  }
  const wasActive = c.status === "active";
  c.status = status;
  if (!wasActive && status === "active") autoAdmitFromWaitlist(db);
  return { message: `Campaign marked as ${status}.` };
}

function doSetAdvertiserStatus(db, { userId, status }) {
  const adv = db.users[userId];
  if (!adv) return { error: "Advertiser not found." };
  adv.advertiserStatus = status;
  return { message: `Advertiser ${status}.` };
}

function doSetUserFlag(db, { userId, field, value }) {
  if (!["verified", "suspended"].includes(field)) return { error: "Invalid field." };
  const u = db.users[userId];
  if (!u) return { error: "User not found." };
  u[field] = value;
  return { message: "Updated." };
}

function doUpdateConfig(db, { patch }) {
  if (!patch || !patch.membership) return { error: "Invalid configuration payload." };
  if (patch.cpvMin >= patch.cpvMax) return { error: "CPV minimum must be less than CPV maximum." };
  const rates = Object.values(patch.membership).map((m) => m.sharePct);
  if (rates.some((r) => r < 0 || r >= 100)) return { error: "Tier earning rates must be between 0 and 100." };
  if (patch.trustAutoApproveThreshold !== undefined && (patch.trustAutoApproveThreshold < 0 || patch.trustAutoApproveThreshold > 100)) {
    return { error: "Trust score threshold must be between 0 and 100." };
  }
  if (patch.loyaltyBonusDaysRequired !== undefined && (patch.loyaltyBonusDaysRequired < 1 || patch.loyaltyBonusDaysRequired > 7)) {
    return { error: "Loyalty bonus days required must be between 1 and 7." };
  }
  if (patch.loyaltyBonusAmount !== undefined && patch.loyaltyBonusAmount < 0) {
    return { error: "Loyalty bonus amount can't be negative." };
  }
  if (patch.minCampaignsForUpgrade !== undefined && patch.minCampaignsForUpgrade < 0) {
    return { error: "Minimum campaigns can't be negative." };
  }
  if (patch.waitlistSafetyMultiplier !== undefined && patch.waitlistSafetyMultiplier <= 0) {
    return { error: "Safety multiplier must be greater than zero." };
  }
  db.config = { ...db.config, ...patch, membership: patch.membership };
  autoAdmitFromWaitlist(db); // the ratio itself changing can also increase capacity
  return { message: "Platform configuration saved." };
}

/* ============================== STORE (PRODUCTS) ========================== */

function doCreateProduct(db, { userId, form }) {
  const adv = db.users[userId];
  if (adv.advertiserStatus !== "approved") return { error: "Your advertiser account isn't approved yet." };
  if (!adv.subscriptionActive) return { error: "An active subscription is required to list products." };
  if (!form || !form.name || !form.description) return { error: "Please complete all required fields." };
  const price = round2(parseFloat(form.price));
  if (!(price > 0)) return { error: "Enter a valid price." };
  const stock = parseInt(form.stock, 10);
  if (!(stock >= 0)) return { error: "Enter a valid stock quantity." };
  const id = uid("prod");
  db.products[id] = {
    id, advertiserId: userId, name: form.name, description: form.description,
    price, stock, category: form.category || "General", status: "active", createdAt: nowISO(),
  };
  return { message: "Product listed in the store.", newId: id };
}

function doSetProductStatus(db, { userId, productId, status }) {
  const p = db.products[productId];
  if (!p) return { error: "Product not found." };
  if (p.advertiserId !== userId) return { error: "You can only manage your own products." };
  p.status = status;
  return { message: `Product marked ${status}.` };
}

function doRestockProduct(db, { userId, productId, addQty }) {
  const p = db.products[productId];
  if (!p) return { error: "Product not found." };
  if (p.advertiserId !== userId) return { error: "You can only manage your own products." };
  const qty = parseInt(addQty, 10);
  if (!(qty > 0)) return { error: "Enter a valid quantity to add." };
  p.stock = p.stock + qty;
  return { message: `Added ${qty} units of stock.` };
}

function doPurchaseProduct(db, { userId, productId, quantity, shippingAddress }) {
  const user = db.users[userId];
  const product = db.products[productId];
  if (!product || product.status !== "active") return { error: "This product isn't available right now." };
  const adv = db.users[product.advertiserId];
  if (!adv || adv.advertiserStatus !== "approved") return { error: "This store is currently unavailable." };
  const qty = parseInt(quantity, 10);
  if (!(qty > 0)) return { error: "Enter a valid quantity." };
  if (qty > product.stock) return { error: "Not enough stock available." };
  const addr = shippingAddress || {};
  if (!addr.name || !addr.line1 || !addr.city || !addr.postcode || !addr.country) {
    return { error: "Please complete your shipping address." };
  }
  const total = round2(product.price * qty);
  if (total > user.balance) return { error: "Insufficient wallet balance for this purchase." };

  user.balance = round2(user.balance - total);
  product.stock = product.stock - qty;
  user.savedAddress = addr;

  const orderId = uid("order");
  db.orders[orderId] = {
    id: orderId, userId, advertiserId: product.advertiserId, productId,
    productName: product.name, price: product.price, quantity: qty, total,
    shippingAddress: addr, status: "pending", carrier: null, trackingNumber: null,
    createdAt: nowISO(), updatedAt: nowISO(),
  };
  db.transactions.unshift({
    id: uid("txn"), type: "STORE_PURCHASE", status: "COMPLETED", timestamp: nowISO(),
    userId, advertiserId: product.advertiserId, productId, orderId, amount: total,
  });
  return { message: `Order placed — £${total.toFixed(2)} paid from your wallet.`, newId: orderId };
}

function doSetOrderStatus(db, { userId, orderId, status, carrier, trackingNumber }) {
  const order = db.orders[orderId];
  if (!order) return { error: "Order not found." };
  const actor = db.users[userId];
  const isAdmin = actor && actor.role === "admin";
  if (!isAdmin && order.advertiserId !== userId) return { error: "You can only manage orders for your own store." };
  if (status === "cancelled") {
    if (["shipped", "delivered", "cancelled"].includes(order.status)) {
      return { error: "This order can no longer be cancelled." };
    }
    const buyer = db.users[order.userId];
    buyer.balance = round2(buyer.balance + order.total);
    const product = db.products[order.productId];
    if (product) product.stock = product.stock + order.quantity;
    db.transactions.unshift({
      id: uid("txn"), type: "STORE_REFUND", status: "COMPLETED", timestamp: nowISO(),
      userId: order.userId, advertiserId: order.advertiserId, productId: order.productId, orderId, amount: order.total,
    });
  }
  order.status = status;
  if (carrier !== undefined) order.carrier = carrier;
  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
  order.updatedAt = nowISO();
  return { message: `Order marked ${status}.` };
}


/* ============================== TARGETING ================================= */

const INTEREST_TAGS = [
  "Outdoors", "Fitness", "Technology", "Fashion", "Food & Drink", "Gaming",
  "Travel", "Finance", "Home & Garden", "Beauty", "Sports", "Music & Entertainment",
];
const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];

function doUpdateProfile(db, { userId, profile }) {
  const user = db.users[userId];
  if (!user) return { error: "User not found." };
  const interests = Array.isArray(profile?.interests) ? profile.interests.filter((i) => INTEREST_TAGS.includes(i)) : [];
  const ageRange = AGE_RANGES.includes(profile?.ageRange) ? profile.ageRange : null;
  const region = (profile?.region || "").slice(0, 80);
  user.profile = { interests, ageRange, region };
  return { message: "Profile updated — you may start seeing more relevant ads." };
}

/* ============================== REFERRALS ================================== */

function generateReferralCode(db) {
  const existing = new Set(Object.values(db.users).map((u) => u.referralCode).filter(Boolean));
  let code;
  do { code = Math.random().toString(36).slice(2, 8).toUpperCase(); } while (existing.has(code));
  return code;
}

const REFERRAL_BONUS_REFERRER = 1.00;
const REFERRAL_BONUS_REFEREE = 0.50;

function maybePayReferralBonus(db, refereeId) {
  const referee = db.users[refereeId];
  if (!referee || !referee.referredBy || referee.referralBonusPaid) return;
  const referrer = db.users[referee.referredBy];
  if (!referrer) return;
  referrer.balance = round2(referrer.balance + REFERRAL_BONUS_REFERRER);
  referee.balance = round2(referee.balance + REFERRAL_BONUS_REFEREE);
  referee.referralBonusPaid = true;
  db.transactions.unshift({ id: uid("txn"), type: "REFERRAL_BONUS", status: "COMPLETED", timestamp: nowISO(), userId: referrer.id, amount: REFERRAL_BONUS_REFERRER, note: "referrer" });
  db.transactions.unshift({ id: uid("txn"), type: "REFERRAL_BONUS", status: "COMPLETED", timestamp: nowISO(), userId: refereeId, amount: REFERRAL_BONUS_REFEREE, note: "referee" });
}

/* ============================== LOYALTY BONUS =============================== */
// Deliberately NOT a punishing "streak" — missing a day never resets or costs
// anything already earned. It's a bonus for showing up across several
// distinct days within the current week, evaluated fresh each week with no
// memory of past weeks' shortfalls.

function getWeekAnchor(date) {
  const d = new Date(date || Date.now());
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function distinctActiveDaysThisWeek(db, userId, weekAnchor) {
  const weekStartMs = new Date(weekAnchor + "T00:00:00.000Z").getTime();
  const days = new Set();
  db.transactions.forEach((t) => {
    if (t.type === "AD_VIEW" && t.userId === userId && new Date(t.timestamp).getTime() >= weekStartMs) {
      days.add(t.timestamp.slice(0, 10));
    }
  });
  return days.size;
}

function maybePayLoyaltyBonus(db, userId) {
  const user = db.users[userId];
  const cfg = db.config;
  const daysRequired = cfg.loyaltyBonusDaysRequired ?? 4;
  const bonusAmount = cfg.loyaltyBonusAmount ?? 0.5;
  const weekAnchor = getWeekAnchor();
  if (user.lastLoyaltyBonusWeek === weekAnchor) return; // already paid for this week

  const activeDays = distinctActiveDaysThisWeek(db, userId, weekAnchor);
  if (activeDays >= daysRequired) {
    user.balance = round2(user.balance + bonusAmount);
    user.lastLoyaltyBonusWeek = weekAnchor;
    db.transactions.unshift({
      id: uid("txn"), type: "LOYALTY_BONUS", status: "COMPLETED", timestamp: nowISO(),
      userId, amount: bonusAmount, activeDays, weekAnchor,
    });
  }
}

/* ============================== TRUST SCORE ================================ */

const TRUST_AUTO_APPROVE_THRESHOLD = 80;

function computeTrustScore(user, transactions) {
  if (!user || user.role !== "user") return null;
  const accountAgeDays = (Date.now() - new Date(user.createdAt).getTime()) / 86400000;
  const ageScore = Math.min(accountAgeDays / 30, 1) * 30; // up to 30 pts, maxed at 30 days old

  const myViews = transactions.filter((t) => t.userId === user.id && (t.type === "AD_VIEW" || t.type === "AD_VIEW_FAILED"));
  const passed = myViews.filter((t) => t.type === "AD_VIEW").length;
  const total = myViews.length;
  const passRate = total > 0 ? passed / total : 0.5; // neutral default for brand-new accounts
  const passScore = passRate * 50; // up to 50 pts

  const verifiedScore = user.verified ? 10 : 0;
  const suspendedPenalty = user.suspended ? -100 : 0;
  const volumeScore = Math.min(passed / 20, 1) * 10; // up to 10 pts, maxed at 20 completed views

  return Math.max(0, Math.min(100, Math.round(ageScore + passScore + verifiedScore + volumeScore + suspendedPenalty)));
}

/* ============================== MUTE PREFERENCES ============================ */

function doSetMutePrefs(db, { userId, mutedAdvertisers, mutedInterests }) {
  const user = db.users[userId];
  if (!user) return { error: "User not found." };
  user.mutedAdvertisers = Array.isArray(mutedAdvertisers) ? mutedAdvertisers.filter((id) => db.users[id]?.role === "advertiser") : [];
  user.mutedInterests = Array.isArray(mutedInterests) ? mutedInterests.filter((t) => INTEREST_TAGS.includes(t)) : [];
  return { message: "Ad preferences updated." };
}

/* ============================== DONATIONS =================================== */

const CHARITIES = [
  { id: "food-bank", name: "UK Food Bank Network", description: "Emergency food supplies for families in crisis." },
  { id: "childrens-health", name: "Children's Health Fund", description: "Medical care access for children in low-income households." },
  { id: "ocean-cleanup", name: "Ocean Cleanup Initiative", description: "Removing plastic waste from rivers and oceans." },
];

function doDonate(db, { userId, amount, charityId }) {
  const user = db.users[userId];
  const charity = CHARITIES.find((c) => c.id === charityId);
  if (!charity) return { error: "Please select a valid charity." };
  if (!(amount > 0)) return { error: "Enter a valid amount." };
  if (amount > user.balance) return { error: "Amount exceeds your available balance." };
  user.balance = round2(user.balance - amount);
  db.transactions.unshift({ id: uid("txn"), type: "DONATION", status: "COMPLETED", timestamp: nowISO(), userId, amount: round2(amount), charityId, charityName: charity.name });
  return { message: `£${round2(amount).toFixed(2)} donated to ${charity.name}. Thank you.` };
}


/* ============================== STRIPE DEPOSITS ============================= */
// Webhooks are not guaranteed to arrive exactly once — Stripe explicitly
// retries on any non-2xx response, network hiccup, or timeout. This must be
// safe to call twice with the same session id without double-crediting.

function doRecordStripeDeposit(db, { userId, amount, stripeSessionId }) {
  if (!db.stripeEvents) db.stripeEvents = {};
  if (db.stripeEvents[stripeSessionId]) {
    return { message: "Already processed.", duplicate: true };
  }
  const user = db.users[userId];
  if (!user) return { error: "User not found for this deposit." };
  user.advertiserBalance = round2((user.advertiserBalance || 0) + amount);
  db.stripeEvents[stripeSessionId] = true;
  db.transactions.unshift({
    id: uid("txn"), type: "DEPOSIT", status: "COMPLETED", timestamp: nowISO(),
    userId, amount: round2(amount), stripeSessionId,
  });
  return { message: `£${amount.toFixed(2)} deposited via card.` };
}

module.exports = {
  seedDB, INTEREST_TAGS, AGE_RANGES, CHARITIES,
  doRegister, doCompleteView, doRequestWithdrawal, doResolveWithdrawal, doUpgradeMembership,
  doAdvertiserSubscribe, doAdvertiserDeposit, doCreateCampaign, doSetCampaignStatus,
  doSetAdvertiserStatus, doSetUserFlag, doUpdateConfig,
  doCreateProduct, doSetProductStatus, doRestockProduct, doPurchaseProduct, doSetOrderStatus,
  doUpdateProfile, doSetMutePrefs, doDonate, computeTrustScore, doRecordStripeDeposit,
  doMarkWithdrawalTransferred, doFailRealWithdrawal, doSetStripeConnectAccount, doSetStripeConnectStatus,
  getWeekAnchor, distinctActiveDaysThisWeek, maybePayLoyaltyBonus,
  doSetIdentitySession, doApplyIdentityResult, doClearIdentityFlag,
  doAdmitFromWaitlist, doAdmitWaitlistBatch, waitlistCapacity, admittedUserCount, autoAdmitFromWaitlist,
  doSetAvatar, doSetProfileVisibility, doToggleWishlist, doFollowAccount, doFollowByCode,
  doUnfollowAccount, doApproveFollowRequest, doDenyFollowRequest, doRemoveFollower, getPublicProfile,
};
