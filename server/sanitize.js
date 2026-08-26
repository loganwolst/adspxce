const { computeTrustScore, waitlistCapacity } = require("./logic");

const PUBLIC_LEDGER_LIMIT = 20;

// A genuinely anonymous activity feed for the logged-out/marketing screen.
// No user id, advertiser id, campaign id, or campaign name — ever. Someone
// inspecting network traffic gets exactly the same three fields a logged-out
// visitor sees on screen: what kind of event it was, how much, and when.
function buildPublicLedger(db) {
  return db.transactions
    .filter((t) => t.type === "AD_VIEW")
    .slice(0, PUBLIC_LEDGER_LIMIT)
    .map((t) => ({ type: t.type, amount: t.userShare, timestamp: t.timestamp }));
}

function sanitizeDB(db, viewerId) {
  const viewer = viewerId ? db.users[viewerId] : null;
  const isAdmin = viewer && viewer.role === "admin";

  const users = {};
  const previewOf = (u) => ({ id: u.id, name: u.role === "advertiser" ? u.company : u.name, role: u.role, avatarDataUrl: u.avatarDataUrl || null });
  for (const [id, u] of Object.entries(db.users)) {
    if (id === viewerId || isAdmin) {
      // Full record for yourself (or an admin) — just strip the password hash.
      const { passwordHash, ...full } = u;
      if (u.role === "user") {
        full.trustScore = computeTrustScore(u, db.transactions);
        if (u.waitlisted) {
          // How many OTHER waitlisted users signed up earlier — a live,
          // honest position, not a stored number that could go stale as
          // people ahead of you get admitted.
          full.waitlistPosition = 1 + Object.values(db.users).filter(
            (o) => o.role === "user" && o.waitlisted && o.id !== id && o.createdAt < u.createdAt
          ).length;
        }
        if (id === viewerId) {
          // Follower/following lists need cross-referencing every other
          // account, which only the server can safely do — regular users
          // never receive each other's full records, so this can't be
          // computed client-side. Minimal safe fields only, same as any
          // other public-profile preview.
          full.followersPreview = Object.values(db.users)
            .filter((o) => o.role === "user" && (o.following || []).includes(id))
            .map(previewOf);
          full.followingPreview = (u.following || []).map((fid) => db.users[fid]).filter(Boolean).map(previewOf);
          full.pendingRequestsPreview = (u.followRequestsReceived || []).map((rid) => db.users[rid]).filter(Boolean).map(previewOf);
        }
      }
      users[id] = full;
    } else if (u.role === "advertiser") {
      // Other people only ever need to know an advertiser's public storefront
      // identity (to render campaign/product cards) — never their email,
      // balance, contact info, or anything else.
      users[id] = { id: u.id, role: u.role, company: u.company, advertiserStatus: u.advertiserStatus };
    }
    // Regular "user"-role accounts are never exposed to anyone but themselves or an admin.
  }

  // Orders contain real names and home addresses — only the buyer, the
  // advertiser fulfilling it, or an admin should ever see one.
  const orders = {};
  for (const [id, o] of Object.entries(db.orders || {})) {
    if (isAdmin || o.userId === viewerId || o.advertiserId === viewerId) {
      orders[id] = o;
    }
  }

  // Transactions are financial records — earnings, withdrawals, purchases.
  // Only the person on either side of a transaction (or an admin) sees them
  // with any identifying detail attached.
  const transactions = isAdmin
    ? db.transactions
    : db.transactions.filter((t) => t.userId === viewerId || t.advertiserId === viewerId);

  // Aggregate demand signal — how many people want a product, never who.
  // Safe to attach to every product regardless of viewer, same principle
  // as every other count-only figure elsewhere (waitlist size, follower
  // counts): the number is public, the identities behind it never are.
  const wishlistCounts = {};
  Object.values(db.users).forEach((u) => {
    if (u.role !== "user") return;
    (u.wishlist || []).forEach((pid) => { wishlistCounts[pid] = (wishlistCounts[pid] || 0) + 1; });
  });
  const products = Object.fromEntries(
    Object.entries(db.products || {}).map(([id, p]) => [id, { ...p, wishlistCount: wishlistCounts[id] || 0 }])
  );

  return {
    ...db, users, orders, transactions, products, publicLedger: buildPublicLedger(db),
    waitlistCount: Object.values(db.users).filter((u) => u.role === "user" && u.waitlisted).length,
    activeCampaignCount: Object.values(db.campaigns).filter((c) => c.status === "active").length,
    waitlistCapacity: waitlistCapacity(db),
  };
}

module.exports = { sanitizeDB };
