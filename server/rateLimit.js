// Small dependency-free rate limiter. No external package — this is simple
// enough to hand-verify, and it's one less thing that can go wrong with a
// fresh `npm install` on a new host.
//
// Note: this uses in-memory storage, which is correct and sufficient for a
// single server instance (which is what this app runs as). If this is ever
// scaled to multiple instances behind a load balancer, this would need to
// move to a shared store (e.g. Redis) since each instance would otherwise
// track its own separate counts.

function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Periodically sweep expired entries so this map doesn't grow forever.
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, Math.max(windowMs, 60000));
  if (sweepInterval.unref) sweepInterval.unref(); // don't keep the process alive just for this

  function middleware(req, res, next) {
    const key = req.ip || "unknown";
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: message || "Too many requests. Please try again shortly." });
    }
    next();
  }

  // Exposed for testing — not used by the app itself.
  middleware._hits = hits;

  return middleware;
}

module.exports = { createRateLimiter };
