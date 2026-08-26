import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Home, Eye, Wallet, ArrowUpRight, Megaphone, Settings, Users, ShieldCheck,
  LogOut, Plus, Check, X, Clock, TrendingUp, CreditCard, Building2,
  AlertCircle, PauseCircle, PlayCircle, Ban, ChevronRight, Sparkles, Lock,
  ShoppingBag, Package, Gift, Heart, UserPlus, Camera, Search, Bell, MoreVertical,
} from "lucide-react";

/* ============================== CONSTANTS ============================== */

const VIEW_SECONDS = 6;

const STATUS_COLORS = {
  active: "#52E3C2", pending: "#D4AF5A", approved: "#52E3C2", paused: "#D4AF5A",
  completed: "#9A9CA6", rejected: "#F0796B", suspended: "#F0796B", draft: "#7C7E86", removed: "#F0796B",
};

const TIER_LABELS = { basic: "Basic", plus: "Upgraded", premium: "Gold" };
const INTEREST_TAGS = [
  "Outdoors", "Fitness", "Technology", "Fashion", "Food & Drink", "Gaming",
  "Travel", "Finance", "Home & Garden", "Beauty", "Sports", "Music & Entertainment",
];
const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];

/* =============================== HELPERS ================================ */

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n) => `£${round2(n || 0).toFixed(2)}`;
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch (e) { return iso; }
};
const effectiveDailyViews = (user) => (user.dailyViewsDate === todayStr() ? (user.dailyViewsUsed || 0) : 0);

/* ============================== UI ATOMS ================================= */

function Badge({ status }) {
  const c = STATUS_COLORS[status] || "#9498C4";
  return (
    <span className="badge" style={{ color: c, background: `${c}17`, borderColor: `${c}40` }}>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub, tone }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone ? { color: tone } : undefined}>{value}</div>
      {sub ? <div className="stat-sub">{sub}</div> : null}
    </div>
  );
}

function Toast({ toasts }) {
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === "error" ? <AlertCircle size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  const Icon = icon || Sparkles;
  return (
    <div className="empty-state">
      <Icon size={22} />
      <div className="empty-title">{title}</div>
      {sub ? <div className="empty-sub">{sub}</div> : null}
    </div>
  );
}

/* ============================== AD VIEWER ================================= */

const CHALLENGE_EMOJI = [
  { emoji: "⭐", name: "star" }, { emoji: "🌙", name: "moon" }, { emoji: "☀️", name: "sun" },
  { emoji: "🍀", name: "clover" }, { emoji: "🔥", name: "fire" }, { emoji: "💧", name: "droplet" },
  { emoji: "🌈", name: "rainbow" }, { emoji: "⚡", name: "lightning bolt" }, { emoji: "🎯", name: "target" },
  { emoji: "🍎", name: "apple" }, { emoji: "🎈", name: "balloon" }, { emoji: "🐝", name: "bee" },
];

function buildChallenge() {
  const target = CHALLENGE_EMOJI[Math.floor(Math.random() * CHALLENGE_EMOJI.length)];
  const distractors = CHALLENGE_EMOJI.filter((e) => e !== target);
  const cells = [target, target, target];
  while (cells.length < 9) cells.push(distractors[Math.floor(Math.random() * distractors.length)]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return { target, cells };
}

function HumanVerifyChallenge({ onPass }) {
  const [challenge, setChallenge] = useState(buildChallenge);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState(false);

  const toggle = (idx) => setSelected((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));

  const verify = () => {
    const correctIndexes = challenge.cells.map((c, i) => (c === challenge.target ? i : null)).filter((i) => i !== null);
    const isMatch = selected.length === correctIndexes.length && correctIndexes.every((i) => selected.includes(i));
    if (isMatch) {
      onPass();
    } else {
      setError(true);
      setChallenge(buildChallenge());
      setSelected([]);
    }
  };

  return (
    <div className="verify-challenge">
      <div className="verify-title"><ShieldCheck size={14} aria-hidden="true" /> Human verification — select all the {challenge.target.name}s</div>
      {error && <div className="inline-warning"><AlertCircle size={14} aria-hidden="true" /> Not quite — here's a new one.</div>}
      <div className="verify-grid" role="group" aria-label={`Select all the ${challenge.target.name} icons`}>
        {challenge.cells.map((cell, i) => (
          <button
            type="button" key={i}
            className={selected.includes(i) ? "verify-cell active" : "verify-cell"}
            aria-pressed={selected.includes(i)}
            aria-label={`${cell.name}${selected.includes(i) ? ", selected" : ""}`}
            onClick={() => toggle(i)}
          >{cell.emoji}</button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-block" onClick={verify} disabled={selected.length === 0}>Verify</button>
    </div>
  );
}

function AdViewerModal({ campaign, variant, rewardAmount, onClose, onComplete }) {
  const displayTitle = variant === "B" && campaign.variantB ? campaign.variantB.adTitle : campaign.adTitle;
  const displayContent = variant === "B" && campaign.variantB ? campaign.variantB.content : campaign.content;
  const [progress, setProgress] = useState(0);
  const [interrupted, setInterrupted] = useState(false);
  const [interruptions, setInterruptions] = useState(0);
  const [done, setDone] = useState(false);
  const [checkVisible, setCheckVisible] = useState(false);
  const [checkClicked, setCheckClicked] = useState(false);
  const [checkExpired, setCheckExpired] = useState(false);
  const [humanVerified, setHumanVerified] = useState(false);
  const startRef = useRef(Date.now());
  const checkPointRef = useRef(35 + Math.random() * 40); // appears somewhere in 35–75% of the timer
  const checkShownRef = useRef(false);
  const checkTimeoutRef = useRef(null);

  const restart = () => {
    startRef.current = Date.now();
    checkPointRef.current = 35 + Math.random() * 40;
    checkShownRef.current = false;
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    setProgress(0);
    setDone(false);
    setInterrupted(false);
    setCheckVisible(false);
    setCheckClicked(false);
    setCheckExpired(false);
    setHumanVerified(false);
  };

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, ((Date.now() - startRef.current) / (VIEW_SECONDS * 1000)) * 100);
        if (next >= checkPointRef.current && !checkShownRef.current) {
          checkShownRef.current = true;
          setCheckVisible(true);
          checkTimeoutRef.current = setTimeout(() => {
            setCheckVisible(false);
            setCheckExpired(true);
          }, 2500);
        }
        if (next >= 100) setDone(true);
        return next;
      });
    }, 100);
    return () => { clearInterval(id); if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current); };
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && !done) {
        setInterrupted(true);
        setInterruptions((n) => n + 1);
        startRef.current = Date.now() - progress * (VIEW_SECONDS * 10);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [progress, done]);

  const handleCheckClick = () => {
    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    setCheckClicked(true);
    setCheckVisible(false);
  };

  const missed = checkExpired && !checkClicked;
  const readyToClaim = done && checkClicked;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <div className="modal-eyebrow">Verified advertisement</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="ad-frame">
          <div className="ad-frame-title">{displayTitle}</div>
          <div className="ad-frame-body">{displayContent}</div>
          <div className="ad-frame-cta">{campaign.destinationUrl}</div>
          {checkVisible && (
            <button type="button" className="attention-check" onClick={handleCheckClick}>
              <ShieldCheck size={14} /> Tap to confirm you're watching
            </button>
          )}
        </div>
        {interrupted && !done && (
          <div className="inline-warning">
            <AlertCircle size={14} /> Timer paused — stay on this tab to complete verification.
          </div>
        )}
        {missed && (
          <div className="inline-warning">
            <AlertCircle size={14} /> Attention check missed — this view won't be counted.
          </div>
        )}
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="modal-meta">
          <span>{missed ? "Not verified" : readyToClaim && !humanVerified ? "One more step" : done ? "Viewing requirement met" : `Verifying… ${Math.ceil((100 - progress) / (100 / VIEW_SECONDS))}s left`}</span>
          <span>Reward on completion: <strong>{money(rewardAmount)}</strong></span>
        </div>
        {missed ? (
          <button className="btn btn-primary btn-block" onClick={restart}>Try again</button>
        ) : readyToClaim && !humanVerified ? (
          <HumanVerifyChallenge onPass={() => setHumanVerified(true)} />
        ) : (
          <button className="btn btn-primary btn-block" disabled={!readyToClaim || !humanVerified} onClick={() => onComplete(campaign.id, { attentionPassed: checkClicked, interruptions }, variant)}>
            {readyToClaim && humanVerified ? "Claim reward" : "Watching…"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================ AUTH ==================================== */

function LedgerTicker({ txns }) {
  const rows = txns.length ? txns.slice(0, 6) : [];
  // A seamless infinite scroll: render the rows twice back-to-back, then
  // animate the wrapper up by exactly 50% of its height — the moment that
  // finishes, the second copy sits exactly where the first one started, so
  // the loop point is invisible. Duration scales with row count so the
  // scroll speed feels consistent regardless of how many rows there are.
  const canScroll = rows.length >= 3;
  const duration = Math.max(rows.length * 2.5, 6);

  return (
    <div className="ticker">
      <div className="ticker-head">Live ledger</div>
      {rows.length === 0 && <div className="ticker-empty">No verified views yet today.</div>}
      {rows.length > 0 && (
        <div className="ticker-viewport">
          <div className={canScroll ? "ticker-scroll" : ""} style={canScroll ? { animationDuration: `${duration}s` } : undefined}>
            {rows.map((t, i) => (
              <div key={`a-${i}`} className="ticker-row">
                <span className="ticker-type">{t.type.replace("_", " ")}</span>
                <span className="ticker-amt">{money(t.amount ?? 0)}</span>
              </div>
            ))}
            {canScroll && rows.map((t, i) => (
              <div key={`b-${i}`} className="ticker-row" aria-hidden="true">
                <span className="ticker-type">{t.type.replace("_", " ")}</span>
                <span className="ticker-amt">{money(t.amount ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ShootingStars() {
  const [stars, setStars] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return; // don't even schedule anything for this preference

    let timeoutId;
    function scheduleNext() {
      const delay = 3500 + Math.random() * 6000; // roughly every 3.5-9.5s, genuinely irregular
      timeoutId = setTimeout(() => {
        const id = idRef.current++;
        const star = {
          id,
          top: Math.random() * 85, // vh% — anywhere across most of the screen
          left: Math.random() * 100, // vw%
          angle: Math.random() * 360, // truly any direction
          distance: 420 + Math.random() * 520, // px — a real cross-screen streak, not a short flick
          duration: 1.3 + Math.random() * 1.1, // seconds — long enough to actually catch
        };
        setStars((prev) => [...prev, star]);
        setTimeout(() => setStars((prev) => prev.filter((s) => s.id !== id)), star.duration * 1000 + 300);
        scheduleNext();
      }, delay);
    }
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div className="shooting-stars" aria-hidden="true">
      {stars.map((s) => (
        <span
          key={s.id}
          className="shooting-star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            "--angle": `${s.angle}deg`,
            "--distance": `${s.distance}px`,
            "--duration": `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function WaitlistScreen({ user, db, onLogout }) {
  const activeCampaigns = db.activeCampaignCount ?? 0;
  const waitlistCount = db.waitlistCount ?? 0;
  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="hero-watermark">X</div>
        <div className="auth-brand"><span className="brand-mark">adspXce</span></div>
        <div className="hero-eyebrow">You're on the list</div>
        <h1>Hey {user.name.split(" ")[0]}, you're #{user.waitlistPosition ?? "—"} in line.</h1>
        <p>
          Admission happens automatically, in real time, tied to how many advertisers we actually have —
          so when you do get in, there's genuinely enough to watch, not the same handful of ads on repeat.
          The instant there's enough room, you're in — no one has to review or approve it.
        </p>
        <div className="auth-hero-facts">
          <div><Megaphone size={16} /> {activeCampaigns} active campaign{activeCampaigns === 1 ? "" : "s"} right now</div>
          <div><Clock size={16} /> {waitlistCount} {waitlistCount === 1 ? "person" : "people"} waiting alongside you</div>
        </div>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Just log in again any time to check whether you've moved up.
        </p>
      </div>
      <div className="auth-panel">
        <button className="btn btn-ghost" onClick={onLogout}><LogOut size={15} /> Log out</button>
      </div>
    </div>
  );
}

function AuthScreen({ db, onLogin, onRegister }) {
  const [initialRef] = useState(() => new URLSearchParams(window.location.search).get("ref") || "");
  const [mode, setMode] = useState(initialRef ? "register" : "login");
  const [role, setRole] = useState("user");
  const [form, setForm] = useState({ name: "", email: "", password: "", company: "", contact: "", referralCode: initialRef });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="hero-watermark">X</div>
        <div className="auth-brand"><span className="brand-mark">adspXce</span></div>
        <div className="hero-eyebrow">Free to join</div>
        <h1>Join adspXce — get paid for verified attention.</h1>
        <p>Advertisers pay for verified attention. Users are rewarded for theirs. Every view is logged, priced and settled on an auditable ledger.</p>
        <div className="auth-hero-facts">
          <div><TrendingUp size={16} /> CPV from {money(db.config.cpvMin)}–{money(db.config.cpvMax)}</div>
          <div><ShieldCheck size={16} /> Higher tiers earn a better rate on every view</div>
          {db.waitlistCount > 0 && <div><Clock size={16} /> {db.waitlistCount} {db.waitlistCount === 1 ? "person" : "people"} already waiting to join</div>}
        </div>
        <LedgerTicker txns={db.publicLedger || []} />
      </div>

      <div className="auth-panel">
        <div className="auth-tabs">
          <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>Log in</button>
          <button className={mode === "register" ? "tab active" : "tab"} onClick={() => setMode("register")}>Create account</button>
        </div>

        {mode === "login" ? (
          <form
            className="auth-form"
            onSubmit={(e) => { e.preventDefault(); onLogin(form.email, form.password); }}
          >
            <label>Email<input className="input" type="email" value={form.email} onChange={set("email")} required /></label>
            <label>Password<input className="input" type="password" value={form.password} onChange={set("password")} required /></label>
            <button className="btn btn-primary btn-block" type="submit">Log in</button>
          </form>
        ) : (
          <form
            className="auth-form"
            onSubmit={(e) => { e.preventDefault(); onRegister({ role, ...form }); }}
          >
            <div className="role-toggle">
              <button type="button" className={role === "user" ? "role-btn active" : "role-btn"} onClick={() => setRole("user")}>
                <Eye size={14} /> I'm a user
              </button>
              <button type="button" className={role === "advertiser" ? "role-btn active" : "role-btn"} onClick={() => setRole("advertiser")}>
                <Megaphone size={14} /> I'm an advertiser
              </button>
            </div>
            <label>Full name<input className="input" value={form.name} onChange={set("name")} required /></label>
            <label>Email<input className="input" type="email" value={form.email} onChange={set("email")} required /></label>
            <label>Password<input className="input" type="password" value={form.password} onChange={set("password")} required /></label>
            {role === "advertiser" && (
              <>
                <label>Company<input className="input" value={form.company} onChange={set("company")} required /></label>
                <label>Contact email<input className="input" value={form.contact} onChange={set("contact")} placeholder="Defaults to account email" /></label>
              </>
            )}
            {role === "user" && (
              <label>Referral code (optional)<input className="input" value={form.referralCode || ""} onChange={set("referralCode")} placeholder="Got one from a friend?" /></label>
            )}
            <button className="btn btn-primary btn-block" type="submit">
              {role === "advertiser" ? "Apply as advertiser" : "Create account"}
            </button>
            {role === "advertiser" && <div className="form-note"><Lock size={12} /> Advertiser accounts require admin approval before campaigns can run.</div>}
          </form>
        )}
        <div className="trust-strip">
          <div className="trust-strip-title">How it works</div>
          <div className="trust-step"><Eye size={14} /> Watch a short, real advertisement</div>
          <div className="trust-step"><ShieldCheck size={14} /> Pass a quick verification check</div>
          <div className="trust-step"><Wallet size={14} /> Get paid — real payments via Stripe</div>
        </div>
      </div>
    </div>
  );
}

/* ============================ USER PAGES ================================== */

function getWeekAnchorClient(date) {
  const d = new Date(date || Date.now());
  const day = d.getUTCDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function UserDashboard({ user, db }) {
  const cfg = db.config;
  const limit = cfg.membership[user.membership].views;
  const used = effectiveDailyViews(user);
  const myTxns = db.transactions.filter((t) => t.userId === user.id);
  const todayEarnings = myTxns.filter((t) => t.type === "AD_VIEW" && t.timestamp.slice(0, 10) === todayStr()).reduce((s, t) => s + t.userShare, 0);

  const weekAnchor = getWeekAnchorClient();
  const weekStartMs = new Date(weekAnchor + "T00:00:00.000Z").getTime();
  const activeDaysThisWeek = new Set(
    myTxns.filter((t) => t.type === "AD_VIEW" && new Date(t.timestamp).getTime() >= weekStartMs).map((t) => t.timestamp.slice(0, 10))
  ).size;
  const daysRequired = cfg.loyaltyBonusDaysRequired ?? 4;
  const bonusEarnedThisWeek = user.lastLoyaltyBonusWeek === weekAnchor;

  return (
    <div>
      <div className="page-head">
        <h2>Welcome back, {user.name.split(" ")[0]}</h2>
        <p>Here's where your account stands right now.</p>
      </div>
      <div className="stat-grid">
        <StatCard label="Balance" value={money(user.balance)} />
        <StatCard label="Today's views" value={`${used} / ${limit}`} />
        <StatCard label="Today's earnings" value={money(todayEarnings)} tone="#52E3C2" />
        <StatCard label="Total earned" value={money(user.totalEarned)} />
        <StatCard label="Pending withdrawal" value={money(user.pendingWithdrawal || 0)} />
        <StatCard label="Membership" value={TIER_LABELS[user.membership]} sub={`${limit} views/day`} />
      </div>
      <div className="card">
        <div className="card-title">Loyalty bonus</div>
        {bonusEarnedThisWeek ? (
          <p className="muted" style={{ fontSize: 12.5 }}>
            <Check size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} color="#52E3C2" /> Earned this week — nice one. Resets fresh next week.
          </p>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
              Watch ads on {daysRequired} different days this week for a £{(cfg.loyaltyBonusAmount ?? 0.5).toFixed(2)} bonus —
              you're on {Math.min(activeDaysThisWeek, daysRequired)}/{daysRequired}. No pressure if you miss a day — it just resets next week, nothing lost.
            </p>
            <div className="progress-track thin"><div className="progress-fill" style={{ width: `${Math.min(100, (activeDaysThisWeek / daysRequired) * 100)}%` }} /></div>
          </>
        )}
      </div>
      <div className="card">
        <div className="card-title">Recent activity</div>
        <TxnTable txns={myTxns.slice(0, 8)} perspective="user" db={db} viewerId={user.id} />
      </div>
    </div>
  );
}

function EarningsChart({ buckets }) {
  const max = Math.max(...buckets.map((b) => b.total), 0.01);
  const barW = buckets.length > 0 ? Math.max(600 / buckets.length - 6, 4) : 0;
  const chartH = 140;
  const showEveryLabel = buckets.length <= 14;
  return (
    <svg width="100%" viewBox={`0 0 640 ${chartH + 30}`} role="img" aria-label="Earnings over time">
      {buckets.map((b, i) => {
        const h = (b.total / max) * (chartH - 10);
        const x = i * (640 / buckets.length) + 3;
        return (
          <g key={b.key}>
            <rect x={x} y={chartH - h} width={barW} height={Math.max(h, 1)} rx="3" fill="var(--accent)" opacity={b.total > 0 ? 1 : 0.15} />
            {(showEveryLabel || i % Math.ceil(buckets.length / 8) === 0) && (
              <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize="10" fill="var(--ink-soft)">{b.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const ACTIVITY_PERIODS = [
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
];

function bucketEarningsByDay(txns, days) {
  const now = new Date();
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({ key, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), total: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  txns.forEach((t) => {
    const key = t.timestamp.slice(0, 10);
    if (byKey[key]) byKey[key].total = round2(byKey[key].total + t.userShare);
  });
  return buckets;
}

function formatDuration(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `${hrs}h ${remMins}m`;
  if (mins > 0) return `${mins}m ${totalSeconds % 60}s`;
  return `${totalSeconds}s`;
}

function UserActivity({ user, db }) {
  const [periodKey, setPeriodKey] = useState("7");
  const period = ACTIVITY_PERIODS.find((p) => p.key === periodKey);
  const myViews = db.transactions.filter((t) => t.type === "AD_VIEW" && t.userId === user.id);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period.days);
  const inPeriod = myViews.filter((t) => new Date(t.timestamp) >= cutoff);

  const earned = inPeriod.reduce((s, t) => s + t.userShare, 0);
  const viewCount = inPeriod.length;
  const watchSeconds = viewCount * VIEW_SECONDS;
  const buckets = bucketEarningsByDay(inPeriod, period.days);

  const allTimeSeconds = myViews.length * VIEW_SECONDS;

  return (
    <div>
      <div className="page-head"><h2>Activity</h2><p>Your watch time and earnings — private to you, no one else sees this.</p></div>
      <div className="chip-row" style={{ marginBottom: 18 }}>
        {ACTIVITY_PERIODS.map((p) => (
          <button key={p.key} className={periodKey === p.key ? "chip active" : "chip"} onClick={() => setPeriodKey(p.key)}>{p.label}</button>
        ))}
      </div>
      <div className="stat-grid">
        <StatCard label={`Earned — last ${period.label}`} value={money(earned)} tone="#52E3C2" />
        <StatCard label="Ads watched" value={viewCount} />
        <StatCard label="Watch time" value={formatDuration(watchSeconds)} />
        <StatCard label="All-time watch time" value={formatDuration(allTimeSeconds)} sub={`${myViews.length} ads total`} />
      </div>
      <div className="card">
        <div className="card-title">Earnings over the last {period.label}</div>
        {earned > 0 ? <EarningsChart buckets={buckets} /> : <EmptyState icon={TrendingUp} title="No earnings in this period yet" sub="Watch a few ads and this graph fills in." />}
      </div>
    </div>
  );
}


/*
  Decides both WHICH eligible ads a user sees and in what ORDER, combining:
   1. Stated interests    — explicit signal from the Profile page
   2. Viewing history      — implicit signal: tags of ads they've actually
                              watched before (behaviour weighs more than a
                              one-off profile checkbox)
   3. Advertiser bid (CPV) — higher-paying campaigns get a natural boost,
                              same principle real ad auctions use
   4. Recency decay        — an ad you watched an hour ago drops in rank so
                              the feed doesn't repeat itself
   5. Exploration noise     — a small random nudge so untargeted / newer
                              campaigns aren't permanently buried under
                              whatever scored highest first
  Hard rule (unchanged): a campaign with explicit targeting that doesn't
  match the user's age range is excluded outright, not just down-ranked —
  interest tags are a soft signal, age range is a hard gate.
*/
function rankCampaignsForUser(liveCampaigns, user, db) {
  const cfg = db.config;
  const profile = user.profile || { interests: [], ageRange: null };
  const mutedAdvertisers = user.mutedAdvertisers || [];
  const mutedInterests = user.mutedInterests || [];

  const ageOk = (c) => !c.ageRange || c.ageRange === "All" || c.ageRange === profile.ageRange;
  const notMuted = (c) => !mutedAdvertisers.includes(c.advertiserId) && !(c.interestTags || []).some((t) => mutedInterests.includes(t));
  const eligible = liveCampaigns.filter((c) => ageOk(c) && notMuted(c));

  // Build a learned-affinity map from this user's own completed views —
  // db.transactions already arrives pre-filtered to just their records.
  const myPastViews = db.transactions.filter((t) => t.type === "AD_VIEW" && t.userId === user.id);
  const affinity = {};
  myPastViews.forEach((t) => {
    const camp = db.campaigns[t.campaignId];
    (camp?.interestTags || []).forEach((tag) => { affinity[tag] = (affinity[tag] || 0) + 1; });
  });
  const cpvSpan = Math.max(cfg.cpvMax - cfg.cpvMin, 0.0001);

  const scored = eligible.map((c) => {
    const tags = c.interestTags || [];
    const statedOverlap = tags.filter((t) => profile.interests.includes(t));
    const learnedOverlap = tags.reduce((s, t) => s + (affinity[t] || 0), 0);

    let score = statedOverlap.length * 35;
    score += Math.min(learnedOverlap, 5) * 8;
    score += tags.length === 0 ? 12 : 0; // untargeted campaigns still get a fair baseline
    score += ((c.cpv - cfg.cpvMin) / cpvSpan) * 20; // advertiser value signal

    const lastView = myPastViews.filter((t) => t.campaignId === c.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    if (lastView) {
      const hoursSince = (Date.now() - new Date(lastView.timestamp).getTime()) / 3600000;
      if (hoursSince < 1) score -= 25;
      else if (hoursSince < 6) score -= 12;
      else if (hoursSince < 24) score -= 5;
    }

    score += Math.random() * 6; // exploration noise

    return { campaign: c, score, matchedTags: statedOverlap };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function UserAds({ user, db, run, pushToast }) {
  const [active, setActive] = useState(null);
  const [activeVariant, setActiveVariant] = useState("A");
  const [startingIdentity, setStartingIdentity] = useState(false);
  const cfg = db.config;
  const limit = cfg.membership[user.membership].views;
  const used = effectiveDailyViews(user);
  const atLimit = used >= limit;
  const profile = user.profile || { interests: [], ageRange: null };
  const liveCampaigns = Object.values(db.campaigns).filter((c) => c.status === "active" && round2(c.totalBudget - c.spent) >= c.cpv - 0.0001);
  const ranked = useMemo(() => rankCampaignsForUser(liveCampaigns, user, db), [db, user.id]);
  const hiddenCount = liveCampaigns.length - ranked.length;
  const profileIncomplete = !profile.ageRange && profile.interests.length === 0;

  const startIdentityVerification = async () => {
    setStartingIdentity(true);
    try {
      const res = await fetch("/api/stripe/identity-start", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.error) { pushToast(data.error || "Couldn't start verification.", "error"); setStartingIdentity(false); return; }
      window.location.href = data.url;
    } catch (err) {
      pushToast("Couldn't reach the verification server.", "error");
      setStartingIdentity(false);
    }
  };

  const complete = async (campaignId, verification, variant) => {
    const res = await run('COMPLETE_VIEW', { campaignId, attentionPassed: verification.attentionPassed, interruptions: verification.interruptions, variant });
    setActive(null);
    if (res.error) pushToast(res.error, "error"); else pushToast(res.message, "success");
  };

  const muteAdvertiser = async (advertiserId) => {
    const next = Array.from(new Set([...(user.mutedAdvertisers || []), advertiserId]));
    const r = await run('SET_MUTE_PREFS', { mutedInterests: user.mutedInterests || [], mutedAdvertisers: next });
    pushToast(r.message || r.error, r.error ? "error" : "success");
  };

  const startViewing = (c) => {
    setActiveVariant(c.variantB && Math.random() < 0.5 ? "B" : "A");
    setActive(c);
  };

  const tierRate = cfg.membership[user.membership].sharePct;

  if (user.identityVerificationStatus !== "verified") {
    return (
      <div>
        <div className="page-head"><h2>Available advertisements</h2></div>
        <div className="card">
          <div className="card-title">Verify your identity to start watching ads</div>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Every view on adspXce needs to come from a real, verified person — that's what makes the targeting
            genuine for advertisers, not just numbers. Takes a couple of minutes, using Stripe's ID check. We
            never see or store your ID document, only the verified result.
          </p>
          {user.identityVerificationStatus === "processing" ? (
            <p className="muted" style={{ fontSize: 12.5 }}>
              Your verification is already in progress — head to <strong>Profile</strong> to check its status or finish it up.
            </p>
          ) : (
            <button className="btn btn-primary" onClick={startIdentityVerification} disabled={startingIdentity}>
              {startingIdentity ? "Redirecting…" : user.identityVerificationStatus === "failed" ? "Try again" : "Verify my identity"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h2>Available advertisements</h2>
        <p>{atLimit ? "You've used all your views for today — come back tomorrow or upgrade for more." : `${limit - used} views remaining today.`}</p>
      </div>
      {profileIncomplete && ranked.length > 0 && (
        <div className="inline-warning" style={{ marginBottom: 16, background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>
          <AlertCircle size={14} /> Complete your Profile to move better-matched — and often higher-paying — ads to the top of your feed.
        </div>
      )}
      {ranked.length === 0 ? (
        <EmptyState icon={Eye} title="No campaigns available right now" sub="New verified ads are added as advertisers launch campaigns." />
      ) : (
        <div className="ad-grid">
          {ranked.map(({ campaign: c, matchedTags }) => {
            const reward = round2(c.cpv * (tierRate / 100));
            const advCompany = db.users[c.advertiserId]?.company;
            return (
              <div key={c.id} className="ad-card">
                <div className="ad-card-top">
                  {matchedTags.length > 0 ? (
                    <span className="badge" style={{ color: "#E8C468", background: "#E8C46817", borderColor: "#E8C46840" }}>
                      Matched: {matchedTags.join(", ")}
                    </span>
                  ) : (
                    <span className="badge" style={{ color: "#52E3C2", background: "#52E3C217", borderColor: "#52E3C240" }}>Verified ad</span>
                  )}
                  <span className="ad-card-reward">+{money(reward)}</span>
                </div>
                <div className="ad-card-title">{c.adTitle}</div>
                <div className="ad-card-desc">{c.content}</div>
                <button className="btn btn-primary btn-block" disabled={atLimit} onClick={() => startViewing(c)}>
                  {atLimit ? "Daily limit reached" : "Start viewing"}
                </button>
                {advCompany && (
                  <button type="button" className="mute-link" onClick={() => muteAdvertiser(c.advertiserId)}>
                    <Ban size={11} /> Mute {advCompany}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {active && (
        <AdViewerModal
          campaign={active}
          variant={activeVariant}
          rewardAmount={round2(active.cpv * (tierRate / 100))}
          onClose={() => setActive(null)}
          onComplete={complete}
        />
      )}
    </div>
  );
}

function UserMembership({ user, db, run, pushToast }) {
  const cfg = db.config;
  const tiers = ["basic", "plus", "premium"];
  const [billing, setBilling] = useState("monthly");
  // "Up to" must mean an actual, unbeatable ceiling — using the platform's
  // maximum CPV, not the average, so this number can never be exceeded by
  // a real user's ad-view earnings.
  const maxCpv = cfg.cpvMax;
  const activeCampaigns = Object.values(db.campaigns).filter((c) => c.status === "active").length;
  const campaignsRequired = cfg.minCampaignsForUpgrade ?? 5;
  const supplyReady = activeCampaigns >= campaignsRequired;

  return (
    <div>
      <div className="page-head"><h2>Membership</h2><p>Higher tiers unlock more verified views — and a higher monthly earning ceiling.</p></div>
      <div className="inline-warning" style={{ marginBottom: 16, fontSize: 12.5, background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>
        The figures below are genuine ceilings, not typical outcomes — how close you get depends on real ad
        supply. Right now there {activeCampaigns === 1 ? "is" : "are"} <strong style={{ color: "var(--ink)" }}>{activeCampaigns} active campaign{activeCampaigns === 1 ? "" : "s"}</strong>,
        and we're growing that deliberately alongside how many people we let in.
      </div>
      <div className="plan-grid">
        {tiers.map((t) => {
          const isCurrent = user.membership === t;
          const plan = cfg.membership[t];
          const locked = plan.price > 0 && !supplyReady;
          const monthlyCap = Math.round(plan.views * maxCpv * (plan.sharePct / 100) * 30);
          const yearlyPrice = round2(plan.price * 10);
          const displayPrice = plan.price === 0 ? "Free" : billing === "monthly" ? `${money(plan.price)}` : `${money(yearlyPrice / 12)}`;
          return (
            <div key={t} className={isCurrent ? "plan-card current" : "plan-card"}>
              {isCurrent && <div className="plan-current-tag">Current plan</div>}
              <div className="plan-name">{TIER_LABELS[t]}</div>
              {plan.price > 0 && (
                <div className="billing-toggle">
                  <button type="button" className={billing === "monthly" ? "bt active" : "bt"} onClick={() => setBilling("monthly")}>Monthly</button>
                  <button type="button" className={billing === "yearly" ? "bt active" : "bt"} onClick={() => setBilling("yearly")}>Yearly</button>
                </div>
              )}
              <div className="plan-price">{displayPrice}</div>
              {plan.price > 0 && <div className="plan-price-sub">Every month{billing === "yearly" ? `, billed ${money(yearlyPrice)} yearly` : ""}</div>}
              <div className="plan-views">Watch up to {plan.views} videos a day</div>
              {locked && (
                <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
                  Unlocks once there are enough active campaigns to make the extra views worthwhile — {activeCampaigns}/{campaignsRequired} so far.
                </div>
              )}
              <button
                className={isCurrent ? "btn btn-ghost btn-block" : "btn btn-primary btn-block"}
                disabled={isCurrent || locked}
                onClick={async () => { const r = await run('UPGRADE_MEMBERSHIP', { tier: t }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}
              >
                {isCurrent ? "Active" : locked ? "Not yet available" : "Sign up"}
              </button>
              <div className="plan-divider" />
              <ul className="plan-bullets">
                <li>Watch up to {plan.views} verified videos a day</li>
                <li>Earn up to {money(monthlyCap)} a month</li>
                <li>Withdraw anytime, above the {money(cfg.withdrawalMinimum)} minimum</li>
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CHARITIES = [
  { id: "food-bank", name: "UK Food Bank Network", description: "Emergency food supplies for families in crisis." },
  { id: "childrens-health", name: "Children's Health Fund", description: "Medical care access for children in low-income households." },
  { id: "ocean-cleanup", name: "Ocean Cleanup Initiative", description: "Removing plastic waste from rivers and oceans." },
];

function UserWithdraw({ user, db, run, pushToast }) {
  const [mode, setMode] = useState("withdraw");
  const [amount, setAmount] = useState("");
  const [charityId, setCharityId] = useState(CHARITIES[0].id);
  const myWithdrawals = Object.values(db.withdrawals).filter((w) => w.userId === user.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const trust = user.trustScore;
  const threshold = db.config.trustAutoApproveThreshold ?? 80;
  const autoApproveEligible = trust !== null && trust !== undefined && trust >= threshold;
  const [settingUpPayout, setSettingUpPayout] = useState(false);

  const startPayoutSetup = async () => {
    setSettingUpPayout(true);
    try {
      const res = await fetch("/api/stripe/connect-onboard", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.error) { pushToast(data.error || "Couldn't start payout setup.", "error"); setSettingUpPayout(false); return; }
      window.location.href = data.url;
    } catch (err) {
      pushToast("Couldn't reach the payment server.", "error");
      setSettingUpPayout(false);
    }
  };

  const [checkingStatus, setCheckingStatus] = useState(false);
  const checkPayoutStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch("/api/stripe/connect-refresh", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.error) { pushToast(data.error || "Couldn't check payout status.", "error"); setCheckingStatus(false); return; }
      if (data.onboarded) {
        pushToast("Payout setup confirmed — reloading…", "success");
        setTimeout(() => window.location.reload(), 800);
      } else {
        pushToast("Stripe shows setup isn't fully complete yet.", "error");
        setCheckingStatus(false);
      }
    } catch (err) {
      pushToast("Couldn't reach the payment server.", "error");
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("payout") === "return") {
      window.history.replaceState({}, "", window.location.pathname);
      if (!user.stripeConnectOnboarded) checkPayoutStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (mode === "withdraw") {
      const r = await run('REQUEST_WITHDRAWAL', { amount: parseFloat(amount) });
      pushToast(r.message || r.error, r.error ? "error" : "success");
      if (!r.error) setAmount("");
    } else {
      const r = await run('DONATE', { amount: parseFloat(amount), charityId });
      pushToast(r.message || r.error, r.error ? "error" : "success");
      if (!r.error) setAmount("");
    }
  };

  return (
    <div>
      <div className="page-head"><h2>Withdraw</h2><p>Move eligible earnings to your verified payout method — or send them straight to a cause.</p></div>
      {user.identityDuplicateFlag && (
        <div className="inline-warning" style={{ marginBottom: 16 }}>
          <AlertCircle size={14} /> Your account is flagged for review — withdrawals are paused until an admin looks into it. You can still watch ads as normal.
        </div>
      )}
      <div className="stat-grid">
        <StatCard label="Withdrawable balance" value={money(user.balance)} tone="#52E3C2" />
        <StatCard label="Pending withdrawal" value={money(user.pendingWithdrawal || 0)} />
        <StatCard label="Minimum withdrawal" value={money(db.config.withdrawalMinimum)} />
        {trust !== null && trust !== undefined && (
          <StatCard label="Trust score" value={`${trust}/100`} sub={autoApproveEligible ? "Instant withdrawals unlocked" : "Build history for instant payouts"} tone={autoApproveEligible ? "#52E3C2" : undefined} />
        )}
      </div>
      {!user.stripeConnectOnboarded && (
        <div className="card">
          <div className="card-title">Set up real payouts</div>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Right now, withdrawals here are demo-only. To actually receive money, verify your identity with our payment
            processor (Stripe) once — takes a couple of minutes, and after that every withdrawal pays out for real.
          </p>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={startPayoutSetup} disabled={settingUpPayout}>
              {settingUpPayout ? "Redirecting…" : "Set up real payouts"}
            </button>
            {user.stripeConnectAccountId && (
              <button className="btn btn-ghost" onClick={checkPayoutStatus} disabled={checkingStatus}>
                {checkingStatus ? "Checking…" : "I've already completed setup — check status"}
              </button>
            )}
          </div>
        </div>
      )}
      {user.stripeConnectOnboarded && (
        <div className="inline-warning" style={{ background: "var(--accent-soft)", color: "var(--accent)", marginBottom: 16 }}>
          <Check size={14} /> Real payouts are set up — withdrawals below will pay out to your real bank account.
        </div>
      )}
      <div className="card">
        <div className="billing-toggle" style={{ marginBottom: 16 }}>
          <button type="button" className={mode === "withdraw" ? "bt active" : "bt"} onClick={() => setMode("withdraw")}>Withdraw to bank</button>
          <button type="button" className={mode === "donate" ? "bt active" : "bt"} onClick={() => setMode("donate")}>Donate to charity</button>
        </div>
        {mode === "withdraw" ? (
          <>
            <div className="card-title">Request a withdrawal</div>
            <form className="inline-form" onSubmit={submit}>
              <input className="input" type="number" step="0.01" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <button className="btn btn-primary" type="submit" disabled={user.identityDuplicateFlag}><ArrowUpRight size={15} /> Request withdrawal</button>
            </form>
          </>
        ) : (
          <>
            <div className="card-title">Choose a cause</div>
            <div className="camp-grid" style={{ marginBottom: 14 }}>
              {CHARITIES.map((c) => (
                <button
                  type="button" key={c.id}
                  className="camp-card" style={{ textAlign: "left", cursor: "pointer", borderColor: charityId === c.id ? "var(--accent)" : undefined }}
                  onClick={() => setCharityId(c.id)}
                >
                  <div className="camp-card-top"><span className="camp-card-name">{c.name}</span>{charityId === c.id && <Check size={15} color="#52E3C2" />}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{c.description}</div>
                </button>
              ))}
            </div>
            <form className="inline-form" onSubmit={submit}>
              <input className="input" type="number" step="0.01" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <button className="btn btn-primary" type="submit">Donate</button>
            </form>
          </>
        )}
      </div>
      <div className="card">
        <div className="card-title">Withdrawal history</div>
        {myWithdrawals.length === 0 ? <EmptyState icon={Wallet} title="No withdrawals yet" /> : (
          <table className="table">
            <thead><tr><th>Requested</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {myWithdrawals.map((w) => (
                <tr key={w.id}><td>{fmtDate(w.requestedAt)}</td><td className="mono">{money(w.amount)}</td><td><Badge status={w.status} /></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============================== REFERRALS (USER) =============================== */

function UserReferrals({ user, db }) {
  const referrerBonuses = db.transactions.filter((t) => t.type === "REFERRAL_BONUS" && t.userId === user.id && t.note === "referrer");
  const totalEarned = referrerBonuses.reduce((s, t) => s + t.amount, 0);
  const referralLink = `${window.location.origin}/?ref=${user.referralCode}`;
  const shareText = `Join adspXce and get paid to watch verified ads — sign up with my link and your code is filled in automatically: ${referralLink}`;

  return (
    <div>
      <div className="page-head"><h2>Referrals</h2><p>Invite a friend — you both get a bonus once they verify their identity.</p></div>
      <div className="stat-grid">
        <StatCard label="Friends referred" value={referrerBonuses.length} />
        <StatCard label="Earned from referrals" value={money(totalEarned)} tone="#52E3C2" />
      </div>
      <div className="card">
        <div className="card-title">Your referral link</div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
          Anyone who opens this link lands straight on the signup form with your code already filled in —
          nothing for them to type or figure out.
        </p>
        <div className="referral-code" style={{ fontSize: 13, wordBreak: "break-all" }}>{referralLink}</div>
        <button
          className="btn btn-primary"
          style={{ marginTop: 10 }}
          onClick={() => { navigator.clipboard?.writeText(referralLink); }}
        >
          Copy link
        </button>
        <div className="card-title" style={{ marginTop: 20 }}>Your referral code</div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Only needed if someone types it in manually instead of using your link.</p>
        <div className="referral-code">{user.referralCode}</div>
        <button
          className="btn btn-ghost"
          style={{ marginTop: 10 }}
          onClick={() => { navigator.clipboard?.writeText(shareText); }}
        >
          Copy invite message
        </button>
      </div>
      {user.referredBy && (
        <div className="card">
          <div className="card-title">You were referred</div>
          <p className="muted" style={{ fontSize: 12.5 }}>You joined using a friend's code — your welcome bonus is credited once you verify your identity.</p>
        </div>
      )}
    </div>
  );
}

/* ============================== PROFILE (USER) =============================== */

function ViewProfile({ targetId, db, run, pushToast, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/profile/${targetId}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok) { pushToast(data.error || "Couldn't load profile.", "error"); onClose(); return; }
        setProfile(data.profile);
      } catch (e) {
        pushToast("Couldn't reach the server.", "error");
        onClose();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  const follow = async () => {
    const r = await run('FOLLOW_ACCOUNT', { targetId });
    pushToast(r.message || r.error, r.error ? "error" : "success");
    if (!r.error) setProfile((p) => ({ ...p, isFollowedByViewer: true }));
  };
  const unfollow = async () => {
    const r = await run('UNFOLLOW_ACCOUNT', { targetId });
    pushToast(r.message || r.error, r.error ? "error" : "success");
    if (!r.error) setProfile((p) => ({ ...p, isFollowedByViewer: false, wishlist: null }));
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        {loading || !profile ? (
          <div className="loading-mark" style={{ fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar dataUrl={profile.avatarDataUrl} name={profile.name} size={56} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{profile.name}</div>
                  {profile.role === "advertiser" && <div className="muted" style={{ fontSize: 12 }}>Advertiser</div>}
                </div>
              </div>
              <button className="btn-mini" onClick={onClose}><X size={14} /></button>
            </div>
            <div className="profile-stats-row">
              <div className="profile-stat"><strong>{profile.wishlist ? profile.wishlist.length : "—"}</strong><span>Wishlist</span></div>
              <div className="profile-stat"><strong>{profile.followerCount}</strong><span>Followers</span></div>
              <div className="profile-stat"><strong>{profile.followingCount}</strong><span>Following</span></div>
            </div>
            {profile.id !== undefined && (
              profile.isFollowedByViewer ? (
                <button className="btn btn-ghost btn-block" onClick={unfollow}>Following — tap to unfollow</button>
              ) : profile.hasPendingRequestFromViewer ? (
                <button className="btn btn-ghost btn-block" disabled>Request pending</button>
              ) : (
                <button className="btn btn-primary btn-block" onClick={follow}><UserPlus size={14} /> {profile.role === "advertiser" ? "Follow" : "Request to follow"}</button>
              )
            )}
            <div className="card-title" style={{ marginTop: 18 }}>Wishlist</div>
            {profile.wishlist === null ? (
              <p className="muted" style={{ fontSize: 12.5 }}>This account is private — follow to see their wishlist once approved.</p>
            ) : profile.wishlist.length === 0 ? (
              <p className="muted" style={{ fontSize: 12.5 }}>Nothing on their wishlist yet.</p>
            ) : (
              <WishlistGrid productIds={profile.wishlist} db={db} readOnly />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Avatar({ dataUrl, name, size = 40 }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return dataUrl ? (
    <img src={dataUrl} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.4, color: "var(--ink-soft)", flexShrink: 0 }}>
      {initial}
    </div>
  );
}

function WishlistGrid({ productIds, db, onRemove, readOnly }) {
  return (
    <div className="wishlist-grid">
      {productIds.map((pid) => {
        const p = db.products?.[pid];
        if (!p) return null;
        return (
          <div key={pid} className="wishlist-tile">
            <div className="wishlist-tile-name">{p.name}</div>
            <div className="wishlist-tile-price">{money(p.price)}</div>
            {!readOnly && (
              <button className="btn-mini danger" onClick={() => onRemove(pid)} style={{ marginTop: 6 }}>Remove</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UserNotifications({ user, run, pushToast }) {
  const notifications = user.notifications || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = async (id) => {
    await run('MARK_NOTIFICATION_READ', { notificationId: id });
  };

  return (
    <div>
      <div className="page-head">
        <h2>Notifications</h2>
        <p>Follow requests, approvals, and wishlist restocks — anything worth knowing about.</p>
      </div>
      {unreadCount > 0 && (
        <button className="btn btn-ghost" style={{ marginBottom: 14 }} onClick={async () => { const r = await run('MARK_ALL_NOTIFICATIONS_READ', {}); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>
          Mark all as read
        </button>
      )}
      <div className="card">
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="Nothing yet" sub="Follow requests, approvals, and restock alerts will show up here." />
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="follower-row" onClick={() => !n.read && markRead(n.id)} style={{ cursor: n.read ? "default" : "pointer", opacity: n.read ? 0.6 : 1 }}>
              <div className="follower-row-info">
                {!n.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
                <div>
                  <div style={{ fontSize: 13 }}>{n.message}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{fmtDate(n.createdAt)}</div>
                </div>
              </div>
              {n.type === "follow_request" && (user.followRequestsReceived || []).includes(n.relatedId) && (
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-mini" onClick={async () => { const r = await run('APPROVE_FOLLOW_REQUEST', { requesterId: n.relatedId }); pushToast(r.message || r.error, r.error ? "error" : "success"); markRead(n.id); }}>Approve</button>
                  <button className="btn-mini danger" onClick={async () => { const r = await run('DENY_FOLLOW_REQUEST', { requesterId: n.relatedId }); pushToast(r.message || r.error, r.error ? "error" : "success"); markRead(n.id); }}>Deny</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function UserProfile({ user, db, run, pushToast }) {
  const existing = user.profile || {};
  const [interests, setInterests] = useState(existing.interests || []);
  const [ageRange, setAgeRange] = useState(existing.ageRange || "");
  const [region, setRegion] = useState(existing.region || "");
  const [mutedInterests, setMutedInterests] = useState(user.mutedInterests || []);

  const [socialTab, setSocialTab] = useState("wishlist");
  const [findCode, setFindCode] = useState("");
  const [findResult, setFindResult] = useState(null);
  const [findLoading, setFindLoading] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { pushToast("Please choose an image file.", "error"); return; }
    setUploadingAvatar(true);
    // Real photos are typically several MB — far too large to store raw.
    // Resize to a sensible display size and re-encode as JPEG, so this
    // works reliably regardless of how large the original photo is.
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 400;
      let { width, height } = img;
      if (width > height && width > MAX_DIM) { height = Math.round(height * (MAX_DIM / width)); width = MAX_DIM; }
      else if (height >= width && height > MAX_DIM) { width = Math.round(width * (MAX_DIM / height)); height = MAX_DIM; }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", 0.82);
      const r = await run('SET_AVATAR', { avatarDataUrl: compressed });
      pushToast(r.message || r.error, r.error ? "error" : "success");
      setUploadingAvatar(false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      pushToast("Couldn't read that image.", "error");
      setUploadingAvatar(false);
    };
    img.src = objectUrl;
  };

  const findByCode = async () => {
    if (!findCode.trim()) return;
    setFindLoading(true);
    setFindResult(null);
    try {
      const res = await fetch(`/api/lookup-code/${encodeURIComponent(findCode.trim())}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { pushToast(data.error || "No account found.", "error"); setFindLoading(false); return; }
      setFindResult(data.preview);
    } catch (e) {
      pushToast("Couldn't reach the server.", "error");
    } finally {
      setFindLoading(false);
    }
  };

  const sendFollowRequest = async () => {
    if (!findResult) return;
    const r = await run('FOLLOW_ACCOUNT', { targetId: findResult.id });
    pushToast(r.message || r.error, r.error ? "error" : "success");
    if (!r.error) { setFindResult(null); setFindCode(""); }
  };

  const followers = user.followersPreview || [];
  const pendingRequests = user.pendingRequestsPreview || [];
  const following = user.followingPreview || [];

  const toggleInterest = (tag) => {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };
  const toggleMutedInterest = (tag) => {
    setMutedInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const save = async (e) => {
    e.preventDefault();
    const r = await run('UPDATE_PROFILE', { profile: { interests, ageRange, region } });
    pushToast(r.message || r.error, r.error ? "error" : "success");
  };

  const [startingIdentity, setStartingIdentity] = useState(false);
  const startIdentityVerification = async () => {
    setStartingIdentity(true);
    try {
      const res = await fetch("/api/stripe/identity-start", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.error) { pushToast(data.error || "Couldn't start verification.", "error"); setStartingIdentity(false); return; }
      window.location.href = data.url;
    } catch (err) {
      pushToast("Couldn't reach the verification server.", "error");
      setStartingIdentity(false);
    }
  };

  const [checkingIdentity, setCheckingIdentity] = useState(false);
  const checkIdentityStatus = async () => {
    setCheckingIdentity(true);
    try {
      const res = await fetch("/api/stripe/identity-refresh", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.error) { pushToast(data.error || "Couldn't check verification status.", "error"); setCheckingIdentity(false); return; }
      if (data.status === "verified") {
        pushToast("Identity verified — reloading…", "success");
        setTimeout(() => window.location.reload(), 800);
      } else if (data.status === "failed") {
        pushToast("Verification wasn't successful. You can try again.", "error");
        setTimeout(() => window.location.reload(), 800);
      } else {
        pushToast("Still processing — check back in a moment.", "error");
        setCheckingIdentity(false);
      }
    } catch (err) {
      pushToast("Couldn't reach the verification server.", "error");
      setCheckingIdentity(false);
    }
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("identity") === "return") {
      // Clear the param immediately — otherwise it stays in the URL forever
      // and re-triggers this same check (and reload) every single time the
      // page loads again, which looks exactly like being kicked off the page.
      window.history.replaceState({}, "", window.location.pathname);
      if (user.identityVerificationStatus !== "verified") checkIdentityStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveMutePrefs = async (nextMutedInterests, nextMutedAdvertisers) => {
    const r = await run('SET_MUTE_PREFS', { mutedInterests: nextMutedInterests, mutedAdvertisers: nextMutedAdvertisers });
    pushToast(r.message || r.error, r.error ? "error" : "success");
  };

  const unmuteAdvertiser = (advId) => {
    const next = (user.mutedAdvertisers || []).filter((id) => id !== advId);
    saveMutePrefs(mutedInterests, next);
  };

  return (
    <div>
      <div className="page-head"><h2>Profile</h2><p>Tell us a bit about yourself so we can match you with more relevant — and often higher-paying — ads.</p></div>

      <div className="card">
        <div className="profile-header-row">
          <div className="avatar-upload-row" style={{ marginBottom: 0 }}>
            <label className="avatar-upload-btn">
              <Avatar dataUrl={user.avatarDataUrl} name={user.name} size={64} />
              <input type="file" accept="image/*" onChange={handleAvatarFile} disabled={uploadingAvatar} />
            </label>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>{uploadingAvatar ? "Uploading…" : "Tap your photo to change it"}</div>
            </div>
          </div>

          {user.identityVerificationStatus === "verified" ? (
            <div className="identity-pill verified"><Check size={13} /> Verified</div>
          ) : (
            <button
              className={`identity-pill ${user.identityVerificationStatus === "processing" ? "processing" : "unverified"}`}
              onClick={user.identityVerificationStatus === "processing" ? checkIdentityStatus : startIdentityVerification}
              disabled={startingIdentity || checkingIdentity}
            >
              <AlertCircle size={13} />
              {startingIdentity ? "Redirecting…" : checkingIdentity ? "Checking…" : user.identityVerificationStatus === "processing" ? "Verification pending — tap to check" : user.identityVerificationStatus === "failed" ? "Verification failed — tap to retry" : "Not verified — required to watch ads"}
            </button>
          )}

          <div className="profile-menu-wrap">
            <button className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-label="More" aria-expanded={menuOpen}>
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="profile-menu-dropdown">
                <button
                  className="profile-menu-item"
                  onClick={() => { setAboutOpen((o) => !o); setMenuOpen(false); }}
                >
                  {aboutOpen ? "Hide" : "Tell us more about yourself"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="profile-stats-row">
          <button type="button" className={socialTab === "wishlist" ? "profile-stat active" : "profile-stat"} onClick={() => setSocialTab("wishlist")}><strong>{(user.wishlist || []).length}</strong><span>Wishlist</span></button>
          <button type="button" className={socialTab === "followers" ? "profile-stat active" : "profile-stat"} onClick={() => setSocialTab("followers")}><strong>{followers.length}</strong><span>Followers</span></button>
          <button type="button" className={socialTab === "following" ? "profile-stat active" : "profile-stat"} onClick={() => setSocialTab("following")}><strong>{following.length}</strong><span>Following</span></button>
        </div>

        <div className="card-title">Find someone to follow</div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Enter their referral code — same code they'd share with you for referrals.</p>
        <div className="inline-form">
          <input className="input" placeholder="e.g. JORDAN1" value={findCode} onChange={(e) => setFindCode(e.target.value)} />
          <button className="btn btn-ghost" type="button" onClick={findByCode} disabled={findLoading}>{findLoading ? "Looking…" : "Find"}</button>
        </div>
        {findResult && (
          <div className="follower-row" style={{ marginTop: 10 }}>
            <div className="follower-row-info">
              <Avatar dataUrl={findResult.avatarDataUrl} name={findResult.name} size={36} />
              <span>{findResult.name}</span>
            </div>
            <button className="btn-mini" onClick={sendFollowRequest}><UserPlus size={13} /> Request to follow</button>
          </div>
        )}

        {socialTab === "wishlist" && (
          (user.wishlist || []).length === 0 ? (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>Nothing yet — add items from the Store and they'll show up here.</p>
          ) : (
            <div style={{ marginTop: 14 }}>
              <WishlistGrid
                productIds={user.wishlist}
                db={db}
                onRemove={async (pid) => { const r = await run('TOGGLE_WISHLIST', { productId: pid }); if (r.error) pushToast(r.error, "error"); }}
              />
            </div>
          )
        )}

        {socialTab === "followers" && (
          <div style={{ marginTop: 14 }}>
            {pendingRequests.length > 0 && (
              <>
                <div className="card-title">Pending requests</div>
                {pendingRequests.map((p) => (
                  <div key={p.id} className="follower-row">
                    <div className="follower-row-info"><Avatar dataUrl={p.avatarDataUrl} name={p.name} size={36} /><span>{p.name}</span></div>
                    <div className="row-actions">
                      <button className="btn-mini" onClick={async () => { const r = await run('APPROVE_FOLLOW_REQUEST', { requesterId: p.id }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>Approve</button>
                      <button className="btn-mini danger" onClick={async () => { const r = await run('DENY_FOLLOW_REQUEST', { requesterId: p.id }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>Deny</button>
                    </div>
                  </div>
                ))}
              </>
            )}
            <div className="card-title" style={{ marginTop: pendingRequests.length > 0 ? 14 : 0 }}>Followers</div>
            {followers.length === 0 ? <p className="muted" style={{ fontSize: 12.5 }}>No one yet.</p> : followers.map((f) => (
              <div key={f.id} className="follower-row">
                <div className="follower-row-info" style={{ cursor: "pointer" }} onClick={() => setViewingId(f.id)}><Avatar dataUrl={f.avatarDataUrl} name={f.name} size={36} /><span>{f.name}</span></div>
                <button className="btn-mini danger" onClick={async () => { const r = await run('REMOVE_FOLLOWER', { followerId: f.id }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {socialTab === "following" && (
          <div style={{ marginTop: 14 }}>
            {following.length === 0 ? <p className="muted" style={{ fontSize: 12.5 }}>Not following anyone yet.</p> : following.map((f) => (
              <div key={f.id} className="follower-row">
                <div className="follower-row-info" style={{ cursor: "pointer" }} onClick={() => setViewingId(f.id)}><Avatar dataUrl={f.avatarDataUrl} name={f.name} size={36} /><span>{f.name}</span></div>
                <button className="btn-mini danger" onClick={async () => { const r = await run('UNFOLLOW_ACCOUNT', { targetId: f.id }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>Unfollow</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingId && <ViewProfile targetId={viewingId} db={db} run={run} pushToast={pushToast} onClose={() => setViewingId(null)} />}

      {aboutOpen && (
      <form className="card" onSubmit={save}>
        <div className="card-title">Age range</div>
        <div className="chip-row">
          {AGE_RANGES.map((r) => (
            <button type="button" key={r} className={ageRange === r ? "chip active" : "chip"} aria-pressed={ageRange === r} onClick={() => setAgeRange(r)}>{r}</button>
          ))}
        </div>
        <div className="card-title" style={{ marginTop: 20 }}>Region</div>
        <input className="input" style={{ maxWidth: 320 }} placeholder="e.g. Greater Manchester" value={region} onChange={(e) => setRegion(e.target.value)} />
        <div className="card-title" style={{ marginTop: 20 }}>Interests</div>
        <p className="muted" style={{ marginTop: -8, marginBottom: 12, fontSize: 12.5 }}>Pick as many as apply — this is what advertisers use to target relevant campaigns to you.</p>
        <div className="chip-row">
          {INTEREST_TAGS.map((tag) => (
            <button type="button" key={tag} className={interests.includes(tag) ? "chip active" : "chip"} aria-pressed={interests.includes(tag)} onClick={() => toggleInterest(tag)}>{tag}</button>
          ))}
        </div>
        <button className="btn btn-primary" type="submit" style={{ marginTop: 22 }}><Check size={15} /> Save profile</button>
      </form>
      )}

      {aboutOpen && (
      <div className="card">
        <div className="card-title">Ad preferences</div>
        <p className="muted" style={{ marginTop: -8, marginBottom: 12, fontSize: 12.5 }}>Categories you'd rather not see ads for. These are hard-excluded, not just down-ranked.</p>
        <div className="chip-row">
          {INTEREST_TAGS.map((tag) => (
            <button type="button" key={tag} className={mutedInterests.includes(tag) ? "chip active" : "chip"} aria-pressed={mutedInterests.includes(tag)} onClick={() => toggleMutedInterest(tag)}>{tag}</button>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => saveMutePrefs(mutedInterests, user.mutedAdvertisers || [])}>Save mute preferences</button>

        {(user.mutedAdvertisers || []).length > 0 && (
          <>
            <div className="card-title" style={{ marginTop: 20 }}>Muted advertisers</div>
            <div className="chip-row">
              {(user.mutedAdvertisers || []).map((advId) => (
                <span key={advId} className="chip active" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {db.users[advId]?.company || "Unknown"}
                  <button type="button" className="icon-btn" style={{ padding: 0 }} onClick={() => unmuteAdvertiser(advId)}><X size={12} /></button>
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}

/* ============================== STORE (USER) =============================== */

function CheckoutModal({ product, adv, maxBalance, onClose, onConfirm, savedAddress }) {
  const [qty, setQty] = useState(1);
  const [addr, setAddr] = useState(savedAddress || { name: "", line1: "", line2: "", city: "", postcode: "", country: "United Kingdom" });
  const set = (k) => (e) => setAddr((a) => ({ ...a, [k]: e.target.value }));
  const total = round2(product.price * qty);
  const insufficient = total > maxBalance;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-head">
          <div className="modal-eyebrow">Checkout — {adv.company}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="ad-frame">
          <div className="ad-frame-title">{product.name}</div>
          <div className="ad-frame-body">{product.description}</div>
        </div>
        <form
          className="stack-form"
          onSubmit={(e) => { e.preventDefault(); onConfirm({ quantity: qty, shippingAddress: addr }); }}
        >
          <label>Quantity<input className="input" type="number" min="1" max={product.stock} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(product.stock, parseInt(e.target.value, 10) || 1)))} /></label>
          <div className="card-title" style={{ marginTop: 6 }}>Shipping address</div>
          <label>Full name<input className="input" value={addr.name} onChange={set("name")} required /></label>
          <label>Address line 1<input className="input" value={addr.line1} onChange={set("line1")} required /></label>
          <label>Address line 2 (optional)<input className="input" value={addr.line2} onChange={set("line2")} /></label>
          <label>City<input className="input" value={addr.city} onChange={set("city")} required /></label>
          <div className="form-row-2">
            <label>Postcode<input className="input" value={addr.postcode} onChange={set("postcode")} required /></label>
            <label>Country<input className="input" value={addr.country} onChange={set("country")} required /></label>
          </div>
          <div className="modal-meta">
            <span>Total</span>
            <span><strong>{money(total)}</strong></span>
          </div>
          {insufficient && <div className="inline-warning"><AlertCircle size={14} /> Insufficient wallet balance for this order.</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={insufficient}>Confirm purchase — {money(total)}</button>
        </form>
      </div>
    </div>
  );
}

function GiftModal({ product, user, run, pushToast, onClose }) {
  const [code, setCode] = useState("");
  const [recipient, setRecipient] = useState(null);
  const [looking, setLooking] = useState(false);
  const [sending, setSending] = useState(false);

  const lookup = async () => {
    if (!code.trim()) return;
    setLooking(true);
    setRecipient(null);
    try {
      const res = await fetch(`/api/lookup-code/${encodeURIComponent(code.trim())}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { pushToast(data.error || "No account found.", "error"); setLooking(false); return; }
      if (data.preview.id === user.id) { pushToast("That's your own code — gift something to a friend instead.", "error"); setLooking(false); return; }
      setRecipient(data.preview);
    } catch (e) {
      pushToast("Couldn't reach the server.", "error");
    } finally {
      setLooking(false);
    }
  };

  const send = async () => {
    if (!recipient) return;
    setSending(true);
    const r = await run('GIFT_PRODUCT', { recipientId: recipient.id, productId: product.id, quantity: 1 });
    pushToast(r.message || r.error, r.error ? "error" : "success");
    setSending(false);
    if (!r.error) onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-head">
          <div className="modal-eyebrow">Gift — {product.name}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <p className="muted" style={{ fontSize: 12.5 }}>
          Enter their referral code — same code they'd share with you for referrals. It ships straight to
          their own saved address; you'll never see it, and they'll never see what you paid.
        </p>
        <div className="inline-form">
          <input className="input" placeholder="e.g. JORDAN1" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn btn-ghost" type="button" onClick={lookup} disabled={looking}>{looking ? "Looking…" : "Find"}</button>
        </div>
        {recipient && (
          <div className="follower-row" style={{ marginTop: 10 }}>
            <div className="follower-row-info">
              <Avatar dataUrl={recipient.avatarDataUrl} name={recipient.name} size={36} />
              <span>{recipient.name}</span>
            </div>
          </div>
        )}
        {recipient && (
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={send} disabled={sending}>
            <Gift size={15} /> {sending ? "Sending…" : `Send for ${money(product.price)}`}
          </button>
        )}
      </div>
    </div>
  );
}

function UserStore({ user, db, run, pushToast }) {
  const [query, setQuery] = useState("");
  const [checkoutProduct, setCheckoutProduct] = useState(null);
  const [giftProduct, setGiftProduct] = useState(null);

  const products = Object.values(db.products || {}).filter((p) => {
    if (p.status !== "active" || p.stock <= 0) return false;
    const adv = db.users[p.advertiserId];
    if (!adv || adv.advertiserStatus !== "approved") return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.name.toLowerCase().includes(q) || adv.company.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q);
  });

  const confirmPurchase = async ({ quantity, shippingAddress }) => {
    const r = await run('PURCHASE_PRODUCT', { productId: checkoutProduct.id, quantity, shippingAddress });
    pushToast(r.message || r.error, r.error ? "error" : "success");
    if (!r.error) setCheckoutProduct(null);
  };

  return (
    <div>
      <div className="page-head"><h2>Store</h2><p>Spend your wallet balance directly with the brands you're watching ads for.</p></div>
      <div className="card">
        <input className="input" placeholder="Search by product, category, or company — e.g. Northwind" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {products.length === 0 ? (
        <EmptyState icon={Wallet} title="No products match" sub="Try a different search, or check back as more advertisers join the store." />
      ) : (
        <div className="ad-grid">
          {products.map((p) => {
            const adv = db.users[p.advertiserId];
            const wishlisted = (user.wishlist || []).includes(p.id);
            return (
              <div key={p.id} className="ad-card">
                <div className="ad-card-top">
                  <span className="badge" style={{ color: "#E8C468", background: "#E8C46817", borderColor: "#E8C46840" }}>{adv.company}</span>
                  <button
                    className="wishlist-toggle"
                    aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    aria-pressed={wishlisted}
                    onClick={async () => { const r = await run('TOGGLE_WISHLIST', { productId: p.id }); if (r.error) pushToast(r.error, "error"); }}
                  >
                    <Heart size={16} fill={wishlisted ? "#F0796B" : "none"} color={wishlisted ? "#F0796B" : "currentColor"} />
                  </button>
                </div>
                <div className="ad-card-title">{p.name}</div>
                <div className="ad-card-desc">{p.description}</div>
                <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
                  {p.stock} in stock{p.wishlistCount > 0 ? ` · ${p.wishlistCount} ${p.wishlistCount === 1 ? "person wants" : "people want"} this` : ""}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span className="ad-card-reward">{money(p.price)}</span>
                </div>
                <button className="btn btn-primary btn-block" onClick={() => setCheckoutProduct(p)}>Buy with wallet</button>
                <button className="btn btn-ghost btn-block" style={{ marginTop: 6 }} onClick={() => setGiftProduct(p)}><Gift size={14} /> Send as a gift</button>
              </div>
            );
          })}
        </div>
      )}
      {giftProduct && (
        <GiftModal
          product={giftProduct}
          user={user}
          run={run}
          pushToast={pushToast}
          onClose={() => setGiftProduct(null)}
        />
      )}
      {checkoutProduct && (
        <CheckoutModal
          product={checkoutProduct}
          adv={db.users[checkoutProduct.advertiserId]}
          maxBalance={user.balance}
          savedAddress={user.savedAddress}
          onClose={() => setCheckoutProduct(null)}
          onConfirm={confirmPurchase}
        />
      )}
    </div>
  );
}

function UserOrders({ user, db }) {
  const orders = Object.values(db.orders || {}).filter((o) => o.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div>
      <div className="page-head"><h2>My orders</h2><p>Everything you've bought with your wallet balance.</p></div>
      {orders.length === 0 ? <EmptyState icon={Wallet} title="No orders yet" sub="Purchases from the Store will show up here with tracking once they ship." /> : (
        <div className="camp-grid">
          {orders.map((o) => {
            const adv = db.users[o.advertiserId];
            return (
              <div key={o.id} className="camp-card">
                <div className="camp-card-top">
                  <span className="camp-card-name">{o.productName}</span>
                  <Badge status={o.status} />
                </div>
                <div className="muted">{adv ? adv.company : "Unknown seller"} · Qty {o.quantity}</div>
                <div className="camp-stats-row">
                  <div><span className="muted">Total</span> {money(o.total)}</div>
                  <div><span className="muted">Ordered</span> {fmtDate(o.createdAt)}</div>
                </div>
                {o.trackingNumber && <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{o.carrier || "Courier"}: {o.trackingNumber}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ========================= ADVERTISER PAGES ================================ */

function AdvertiserGate({ adv, children }) {
  if (adv.advertiserStatus === "pending") {
    return <EmptyState icon={Clock} title="Application pending review" sub="An administrator will review your business details shortly. You'll gain access to campaigns once approved." />;
  }
  if (adv.advertiserStatus === "rejected") {
    return <EmptyState icon={Ban} title="Application not approved" sub="Contact support if you believe this was a mistake." />;
  }
  if (adv.advertiserStatus === "suspended") {
    return <EmptyState icon={Ban} title="Account suspended" sub="Your advertiser account has been suspended by an administrator." />;
  }
  return children;
}

function AdvertiserDashboard({ adv, db }) {
  const campaigns = Object.values(db.campaigns).filter((c) => c.advertiserId === adv.id);
  const txns = db.transactions.filter((t) => t.userId === adv.id || t.advertiserId === adv.id);
  const totalSpend = campaigns.reduce((s, c) => s + c.spent, 0);
  const totalViews = campaigns.reduce((s, c) => s + c.views, 0);
  // Still-locked budget — pending/active/paused campaigns haven't given
  // their unspent portion back yet, so it's committed, not free.
  const committedBudget = round2(
    campaigns
      .filter((c) => ["pending", "active", "paused"].includes(c.status))
      .reduce((s, c) => s + (c.totalBudget - c.spent), 0)
  );
  const totalAccountValue = round2(adv.advertiserBalance + committedBudget);

  return (
    <AdvertiserGate adv={adv}>
      <div className="page-head"><h2>{adv.company}</h2><p>Advertiser overview and campaign performance.</p></div>
      <div className="stat-grid">
        <StatCard label="Total account value" value={money(totalAccountValue)} sub="Free + committed to campaigns" tone="#52E3C2" />
        <StatCard label="Free balance" value={money(adv.advertiserBalance)} sub="Available to withdraw" />
        <StatCard label="Committed to campaigns" value={money(committedBudget)} sub="Runs its course, not withdrawable yet" />
        <StatCard label="Active campaigns" value={campaigns.filter((c) => c.status === "active").length} />
        <StatCard label="Total spend" value={money(totalSpend)} />
        <StatCard label="Total verified views" value={totalViews} />
        <StatCard label="Subscription" value={adv.subscriptionActive ? "Active" : "Inactive"} tone={adv.subscriptionActive ? "#52E3C2" : "#F0796B"} />
      </div>
      {db.waitlistCount > 0 && (
        <div className="inline-warning" style={{ background: "var(--accent-soft)", color: "var(--accent)", marginBottom: 16 }}>
          <Users size={14} /> <strong>{db.waitlistCount} {db.waitlistCount === 1 ? "person" : "people"}</strong> {db.waitlistCount === 1 ? "is" : "are"} waiting to join and start watching ads — we're deliberately
          admitting them as advertiser supply grows, so more active campaigns from you means more real people let in sooner.
        </div>
      )}
      <div className="card">
        <div className="card-title">Recent billing</div>
        <TxnTable txns={txns.slice(0, 8)} perspective="advertiser" db={db} viewerId={adv.id} />
      </div>
    </AdvertiserGate>
  );
}

function AdvertiserWithdraw({ adv, db, run, pushToast }) {
  const [amount, setAmount] = useState("");
  const [settingUpPayout, setSettingUpPayout] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const myWithdrawals = Object.values(db.withdrawals).filter((w) => w.userId === adv.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const startPayoutSetup = async () => {
    setSettingUpPayout(true);
    try {
      const res = await fetch("/api/stripe/connect-onboard", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.error) { pushToast(data.error || "Couldn't start payout setup.", "error"); setSettingUpPayout(false); return; }
      window.location.href = data.url;
    } catch (err) {
      pushToast("Couldn't reach the payment server.", "error");
      setSettingUpPayout(false);
    }
  };

  const checkPayoutStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch("/api/stripe/connect-refresh", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok || data.error) { pushToast(data.error || "Couldn't check payout status.", "error"); setCheckingStatus(false); return; }
      if (data.onboarded) {
        pushToast("Payout setup confirmed — reloading…", "success");
        setTimeout(() => window.location.reload(), 800);
      } else {
        pushToast("Stripe shows setup isn't fully complete yet.", "error");
        setCheckingStatus(false);
      }
    } catch (err) {
      pushToast("Couldn't reach the payment server.", "error");
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("payout") === "return") {
      window.history.replaceState({}, "", window.location.pathname);
      if (!adv.stripeConnectOnboarded) checkPayoutStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const r = await run('REQUEST_ADVERTISER_WITHDRAWAL', { amount: parseFloat(amount) });
    pushToast(r.message || r.error, r.error ? "error" : "success");
    if (!r.error) setAmount("");
  };

  return (
    <AdvertiserGate adv={adv}>
      <div className="page-head"><h2>Withdraw</h2><p>Get back any balance that isn't currently committed to a running campaign.</p></div>
      <div className="inline-warning" style={{ marginBottom: 16, background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}>
        Money committed to an active or pending campaign runs its course and can't be withdrawn early —
        only balance that was never allocated to a campaign is available here.
      </div>
      <div className="stat-grid">
        <StatCard label="Available to withdraw" value={money(adv.advertiserBalance)} tone="#52E3C2" />
        <StatCard label="Pending withdrawal" value={money(adv.advertiserPendingWithdrawal || 0)} />
      </div>
      {!adv.stripeConnectOnboarded && (
        <div className="card">
          <div className="card-title">Set up a payout destination</div>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            One-time setup via Stripe — same process users go through for their own payouts.
          </p>
          <div className="row-actions">
            <button className="btn btn-primary" onClick={startPayoutSetup} disabled={settingUpPayout}>
              {settingUpPayout ? "Redirecting…" : "Set up payouts"}
            </button>
            {adv.stripeConnectAccountId && (
              <button className="btn btn-ghost" onClick={checkPayoutStatus} disabled={checkingStatus}>
                {checkingStatus ? "Checking…" : "I've already completed setup — check status"}
              </button>
            )}
          </div>
        </div>
      )}
      {adv.stripeConnectOnboarded && (
        <div className="inline-warning" style={{ background: "var(--accent-soft)", color: "var(--accent)", marginBottom: 16 }}>
          <Check size={14} /> Payouts are set up — withdrawals below pay out to your real bank account.
        </div>
      )}
      <div className="card">
        <div className="card-title">Request a withdrawal</div>
        <form className="inline-form" onSubmit={submit}>
          <input className="input" type="number" step="0.01" min="0" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn btn-primary" type="submit"><ArrowUpRight size={15} /> Request withdrawal</button>
        </form>
      </div>
      <div className="card">
        <div className="card-title">History</div>
        {myWithdrawals.length === 0 ? <EmptyState icon={Wallet} title="No withdrawals yet" /> : (
          <table className="table">
            <thead><tr><th>Requested</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {myWithdrawals.map((w) => (
                <tr key={w.id}><td>{fmtDate(w.requestedAt)}</td><td className="mono">{money(w.amount)}</td><td><Badge status={w.status} /></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdvertiserGate>
  );
}

function AdvertiserBilling({ adv, db, run, pushToast }) {
  const [deposit, setDeposit] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  const startCardDeposit = async (e) => {
    e.preventDefault();
    setRedirecting(true);
    try {
      const res = await fetch("/api/stripe/create-deposit-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amount: parseFloat(cardAmount) }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        pushToast(data.error || "Couldn't start checkout.", "error");
        setRedirecting(false);
        return;
      }
      window.location.href = data.url; // hand off to Stripe's hosted checkout page
    } catch (err) {
      pushToast("Couldn't reach the payment server.", "error");
      setRedirecting(false);
    }
  };

  return (
    <AdvertiserGate adv={adv}>
      <div className="page-head"><h2>Billing</h2><p>Subscription unlocks the platform. Your advertising budget pays for views.</p></div>
      <div className="two-col">
        <div className="card">
          <div className="card-title">Platform subscription</div>
          <p className="muted">{money(db.config.advertiserSubscriptionPrice)}/month for campaign creation, analytics and audience targeting.</p>
          <button
            className={adv.subscriptionActive ? "btn btn-ghost btn-block" : "btn btn-primary btn-block"}
            disabled={adv.subscriptionActive}
            onClick={async () => { const r = await run('ADVERTISER_SUBSCRIBE', {}); pushToast(r.message || r.error, r.error ? "error" : "success"); }}
          >
            {adv.subscriptionActive ? "Subscription active" : `Subscribe — ${money(db.config.advertiserSubscriptionPrice)}/mo`}
          </button>
        </div>
        <div className="card">
          <div className="card-title">Deposit via card</div>
          <p className="muted">Real payment via Stripe (test mode until this goes live) — reserves budget for your campaigns.</p>
          <form className="inline-form" onSubmit={startCardDeposit}>
            <input className="input" type="number" step="0.01" min="5" placeholder="Amount (min £5)" value={cardAmount} onChange={(e) => setCardAmount(e.target.value)} />
            <button className="btn btn-primary" type="submit" disabled={redirecting}><CreditCard size={15} /> {redirecting ? "Redirecting…" : "Pay with card"}</button>
          </form>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Demo top-up</div>
        <p className="muted">Instant, no real charge — for testing the platform without a card.</p>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await run('ADVERTISER_DEPOSIT', { amount: parseFloat(deposit) });
            pushToast(r.message || r.error, r.error ? "error" : "success");
            if (!r.error) setDeposit("");
          }}
        >
          <input className="input" type="number" step="0.01" min="0" placeholder="Amount" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          <button className="btn btn-ghost" type="submit">Add demo funds</button>
        </form>
      </div>
    </AdvertiserGate>
  );
}

function recommendCPV({ cpvMin, cpvMax, videoLengthSeconds, hasQuestion, interestTags, ageRange }) {
  let price = cpvMin;
  const baselineLength = 15; // a fair "default" reference length
  const length = videoLengthSeconds ? parseInt(videoLengthSeconds, 10) : baselineLength;
  const lengthDiff = Math.max(0, length - baselineLength);
  // Longer videos demand more attention, but not linearly — capped at +40% for double-length or beyond.
  const lengthMultiplier = 1 + Math.min(lengthDiff / baselineLength, 1) * 0.4;
  price *= lengthMultiplier;
  // Real, sourced industry data: interactive/engaged formats command a genuine 20-40% premium.
  if (hasQuestion) price *= 1.3;
  // Narrower targeting reaches more relevant people, which is worth more per view, not less.
  const isTargeted = (interestTags && interestTags.length > 0) || (ageRange && ageRange !== "All");
  if (isTargeted) price *= 1.15;
  price = Math.max(cpvMin, Math.min(cpvMax, price));
  return Math.round(price * 100) / 100;
}

function CampaignForm({ cfg, onSubmit }) {
  const [form, setForm] = useState({ name: "", adTitle: "", content: "", destinationUrl: "", cpv: cfg.cpvMin.toFixed(2), totalBudget: "", dailyBudget: "", targetAudience: "", geo: "United Kingdom" });
  const [interestTags, setInterestTags] = useState([]);
  const [ageRange, setAgeRange] = useState("All");
  const [videoLengthSeconds, setVideoLengthSeconds] = useState("15");
  const [hasQuestion, setHasQuestion] = useState(false);
  const [abTest, setAbTest] = useState(false);
  const [variantBTitle, setVariantBTitle] = useState("");
  const [variantBContent, setVariantBContent] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleInterest = (tag) => setInterestTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  const recommended = useMemo(
    () => recommendCPV({ cpvMin: cfg.cpvMin, cpvMax: cfg.cpvMax, videoLengthSeconds, hasQuestion, interestTags, ageRange }),
    [cfg.cpvMin, cfg.cpvMax, videoLengthSeconds, hasQuestion, interestTags, ageRange]
  );
  return (
    <form className="stack-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, interestTags, ageRange, videoLengthSeconds, hasQuestion, variantBTitle: abTest ? variantBTitle : "", variantBContent: abTest ? variantBContent : "" }); }}>
      <label>Campaign name<input className="input" value={form.name} onChange={set("name")} required /></label>
      <label>Advertisement title<input className="input" value={form.adTitle} onChange={set("adTitle")} required /></label>
      <label>Advertisement content<textarea className="input" rows={3} value={form.content} onChange={set("content")} required /></label>
      <label>Destination URL<input className="input" value={form.destinationUrl} onChange={set("destinationUrl")} placeholder="https://" required /></label>
      <div className="form-row">
        <label>CPV ({money(cfg.cpvMin)}–{money(cfg.cpvMax)})<input className="input" type="number" step="0.01" min={cfg.cpvMin} max={cfg.cpvMax} value={form.cpv} onChange={set("cpv")} required /></label>
        <label>Total budget<input className="input" type="number" step="0.01" min="0" value={form.totalBudget} onChange={set("totalBudget")} required /></label>
      </div>
      <div className="inline-warning" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 12.5 }}>
        Recommended CPV based on this campaign's details: <strong>{money(recommended)}</strong> — just a guide, you can still set any price in range.
        <button type="button" className="btn-mini" style={{ marginLeft: 10 }} onClick={() => setForm((f) => ({ ...f, cpv: recommended.toFixed(2) }))}>Use this</button>
      </div>
      <div className="form-row">
        <label>Video length (seconds)<input className="input" type="number" min="1" value={videoLengthSeconds} onChange={(e) => setVideoLengthSeconds(e.target.value)} /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
          <input type="checkbox" checked={hasQuestion} onChange={(e) => setHasQuestion(e.target.checked)} />
          Includes an end-of-video question
        </label>
      </div>
      {hasQuestion && <p className="muted" style={{ marginTop: -8, fontSize: 12 }}>Reflected in pricing now — the actual on-screen question feature is coming soon, not live in viewer sessions yet.</p>}
      <div className="form-row">
        <label>Daily budget (optional)<input className="input" type="number" step="0.01" min="0" value={form.dailyBudget} onChange={set("dailyBudget")} /></label>
        <label>Geographic target<input className="input" value={form.geo} onChange={set("geo")} /></label>
      </div>
      <label>Target audience (description)<input className="input" value={form.targetAudience} onChange={set("targetAudience")} placeholder="e.g. Outdoors, 25-45" /></label>
      <div className="card-title" style={{ marginTop: 4 }}>Audience targeting</div>
      <p className="muted" style={{ marginTop: -8, marginBottom: 4, fontSize: 12.5 }}>Only shown to users whose profile matches — leave age as "All" and interests empty to reach everyone.</p>
      <label>Age range<select className="input" value={ageRange} onChange={(e) => setAgeRange(e.target.value)}>
        <option value="All">All ages</option>
        {AGE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select></label>
      <div className="chip-row">
        {INTEREST_TAGS.map((tag) => (
          <button type="button" key={tag} className={interestTags.includes(tag) ? "chip active" : "chip"} aria-pressed={interestTags.includes(tag)} onClick={() => toggleInterest(tag)}>{tag}</button>
        ))}
      </div>
      <div className="card-title" style={{ marginTop: 10 }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, cursor: "pointer" }}>
          <input type="checkbox" checked={abTest} onChange={(e) => setAbTest(e.target.checked)} />
          Run an A/B test
        </label>
      </div>
      {abTest && (
        <>
          <p className="muted" style={{ marginTop: -8, marginBottom: 4, fontSize: 12.5 }}>Half of viewers see this Variant B instead — compare performance on the Verification page.</p>
          <label>Variant B title<input className="input" value={variantBTitle} onChange={(e) => setVariantBTitle(e.target.value)} required={abTest} /></label>
          <label>Variant B content<textarea className="input" rows={3} value={variantBContent} onChange={(e) => setVariantBContent(e.target.value)} required={abTest} /></label>
        </>
      )}
      <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 10 }}><Plus size={15} /> Submit for approval</button>
    </form>
  );
}

function AdvertiserCampaigns({ adv, db, run, pushToast }) {
  const [creating, setCreating] = useState(false);
  const [analyticsFor, setAnalyticsFor] = useState(null);
  const campaigns = Object.values(db.campaigns).filter((c) => c.advertiserId === adv.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <AdvertiserGate adv={adv}>
      <div className="page-head-row">
        <div><h2>Campaigns</h2><p>Create and monitor your advertising campaigns.</p></div>
        <button className="btn btn-primary" onClick={() => setCreating((v) => !v)}>
          <Plus size={15} /> {creating ? "Close" : "New campaign"}
        </button>
      </div>
      {creating && (
        <div className="card">
          <div className="card-title">New campaign</div>
          <CampaignForm
            cfg={db.config}
            onSubmit={async (form) => {
              const r = await run('CREATE_CAMPAIGN', { form });
              pushToast(r.message || r.error, r.error ? "error" : "success");
              if (!r.error) setCreating(false);
            }}
          />
        </div>
      )}
      {campaigns.length === 0 ? <EmptyState icon={Megaphone} title="No campaigns yet" sub="Create your first campaign to start reaching verified users." /> : (
        <div className="camp-grid">
          {campaigns.map((c) => (
            <div key={c.id} className="camp-card">
              <div className="camp-card-top">
                <span className="camp-card-name">{c.name}</span>
                <Badge status={c.status} />
              </div>
              <div className="camp-card-title">{c.adTitle}</div>
              <div className="camp-stats-row">
                <div><span className="muted">CPV</span> {money(c.cpv)}</div>
                <div><span className="muted">Views</span> {c.views}</div>
                <div><span className="muted">Spent</span> {money(c.spent)} / {money(c.totalBudget)}</div>
              </div>
              {(c.ageRange && c.ageRange !== "All") || (c.interestTags && c.interestTags.length > 0) ? (
                <div className="chip-row" style={{ marginTop: 8 }}>
                  {c.ageRange && c.ageRange !== "All" && <span className="chip">{c.ageRange}</span>}
                  {(c.interestTags || []).map((t) => <span key={t} className="chip">{t}</span>)}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Untargeted — shown to all users</div>
              )}
              <div className="progress-track thin"><div className="progress-fill" style={{ width: `${Math.min(100, (c.spent / c.totalBudget) * 100)}%` }} /></div>
              {c.views > 0 && (
                <button className="btn-mini" style={{ marginTop: 10 }} onClick={() => setAnalyticsFor(c)}>
                  <TrendingUp size={13} /> View analytics
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {analyticsFor && <CampaignAnalyticsModal campaign={analyticsFor} onClose={() => setAnalyticsFor(null)} pushToast={pushToast} />}
    </AdvertiserGate>
  );
}

function CampaignAnalyticsModal({ campaign, onClose, pushToast }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/campaign-analytics/${campaign.id}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok) { pushToast(data.error || "Couldn't load analytics.", "error"); onClose(); return; }
        setAnalytics(data.analytics);
      } catch (e) {
        pushToast("Couldn't reach the server.", "error");
        onClose();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-head">
          <div className="modal-eyebrow">Analytics — {campaign.name}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {loading || !analytics ? (
          <div className="loading-mark" style={{ fontSize: 14 }}>Loading…</div>
        ) : (
          <>
            <div className="stat-grid">
              <StatCard label="Total views" value={analytics.totalViews} tone="#52E3C2" />
              <StatCard label="Attention pass rate" value={analytics.attentionPassRate !== null ? `${analytics.attentionPassRate}%` : "—"} />
            </div>

            {analytics.hasVariantB && (
              <div className="card">
                <div className="card-title">Variant A vs B</div>
                <table className="table">
                  <thead><tr><th>Variant</th><th>Views</th><th>Pass rate</th></tr></thead>
                  <tbody>
                    <tr><td>A</td><td>{analytics.variantSummary.A.views}</td><td>{analytics.variantSummary.A.passRate !== null ? `${analytics.variantSummary.A.passRate}%` : "—"}</td></tr>
                    <tr><td>B</td><td>{analytics.variantSummary.B.views}</td><td>{analytics.variantSummary.B.passRate !== null ? `${analytics.variantSummary.B.passRate}%` : "—"}</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="card">
              <div className="card-title">Viewer age range</div>
              {Object.entries(analytics.ageBreakdown).every(([, v]) => v === 0) ? (
                <p className="muted" style={{ fontSize: 12.5 }}>No age data available for these viewers yet.</p>
              ) : (
                <table className="table">
                  <tbody>
                    {Object.entries(analytics.ageBreakdown).filter(([, v]) => v > 0).map(([range, count]) => (
                      <tr key={range}><td>{range}</td><td className="mono">{count}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {analytics.targetedInterests.length > 0 && (
              <div className="card">
                <div className="card-title">Interest targeting match</div>
                <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
                  Targeting: {analytics.targetedInterests.join(", ")}
                </p>
                <div className="stat-grid">
                  <StatCard label="Matched interest" value={analytics.interestOverlapCount} tone="#52E3C2" />
                  <StatCard label="No overlap" value={analytics.interestNoOverlapCount} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProductForm({ onSubmit }) {
  const [form, setForm] = useState({ name: "", description: "", price: "", stock: "", category: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form className="stack-form" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <label>Product name<input className="input" value={form.name} onChange={set("name")} required /></label>
      <label>Description<textarea className="input" rows={3} value={form.description} onChange={set("description")} required /></label>
      <div className="form-row">
        <label>Price (£)<input className="input" type="number" step="0.01" min="0" value={form.price} onChange={set("price")} required /></label>
        <label>Starting stock<input className="input" type="number" min="0" value={form.stock} onChange={set("stock")} required /></label>
        <label>Category<input className="input" value={form.category} onChange={set("category")} placeholder="e.g. Footwear" /></label>
      </div>
      <button className="btn btn-primary btn-block" type="submit"><Plus size={15} /> List product</button>
    </form>
  );
}

function AdvertiserProducts({ adv, db, run, pushToast }) {
  const [creating, setCreating] = useState(false);
  const products = Object.values(db.products || {}).filter((p) => p.advertiserId === adv.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <AdvertiserGate adv={adv}>
      <div className="page-head-row">
        <div><h2>Products</h2><p>Let users spend earned wallet balance directly on what you sell.</p></div>
        <button className="btn btn-primary" onClick={() => setCreating((v) => !v)}><Plus size={15} /> {creating ? "Close" : "New product"}</button>
      </div>
      {creating && (
        <div className="card">
          <div className="card-title">New product</div>
          <ProductForm
            onSubmit={async (form) => {
              const r = await run('CREATE_PRODUCT', { form });
              pushToast(r.message || r.error, r.error ? "error" : "success");
              if (!r.error) setCreating(false);
            }}
          />
        </div>
      )}
      {products.length === 0 ? <EmptyState icon={Wallet} title="No products listed yet" /> : (
        <div className="camp-grid">
          {products.map((p) => (
            <div key={p.id} className="camp-card">
              <div className="camp-card-top">
                <span className="camp-card-name">{p.name}</span>
                <Badge status={p.status} />
              </div>
              <div className="camp-card-title">{p.description}</div>
              <div className="camp-stats-row">
                <div><span className="muted">Price</span> {money(p.price)}</div>
                <div><span className="muted">Stock</span> {p.stock}</div>
                <div><span className="muted">Category</span> {p.category}</div>
                <div><span className="muted">Wishlisted by</span> {p.wishlistCount || 0}</div>
              </div>
              <div className="row-actions" style={{ marginTop: 10 }}>
                <button
                  className="btn-mini"
                  onClick={async () => { const r = await run('RESTOCK_PRODUCT', { productId: p.id, addQty: 20 }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}
                >+20 stock</button>
                {p.status === "active"
                  ? <button className="btn-mini danger" onClick={async () => { const r = await run('SET_PRODUCT_STATUS', { productId: p.id, status: "inactive" }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>Deactivate</button>
                  : <button className="btn-mini" onClick={async () => { const r = await run('SET_PRODUCT_STATUS', { productId: p.id, status: "active" }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>Activate</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdvertiserGate>
  );
}

function AdvertiserOrders({ adv, db, run, pushToast }) {
  const orders = Object.values(db.orders || {}).filter((o) => o.advertiserId === adv.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [trackingDraft, setTrackingDraft] = useState({});

  const setDraft = (orderId, field) => (e) => setTrackingDraft((d) => ({ ...d, [orderId]: { ...d[orderId], [field]: e.target.value } }));

  const ship = async (orderId) => {
    const draft = trackingDraft[orderId] || {};
    const r = await run('SET_ORDER_STATUS', { orderId, status: "shipped", carrier: draft.carrier || "", trackingNumber: draft.trackingNumber || "" });
    pushToast(r.message || r.error, r.error ? "error" : "success");
  };
  const setStatus = async (orderId, status) => {
    const r = await run('SET_ORDER_STATUS', { orderId, status });
    pushToast(r.message || r.error, r.error ? "error" : "success");
  };

  return (
    <AdvertiserGate adv={adv}>
      <div className="page-head"><h2>Orders</h2><p>Fulfil orders placed against your store — real names and addresses, handle with care.</p></div>
      {orders.length === 0 ? <EmptyState icon={Wallet} title="No orders yet" /> : (
        <div className="camp-grid">
          {orders.map((o) => (
            <div key={o.id} className="camp-card">
              <div className="camp-card-top">
                <span className="camp-card-name">{o.productName} × {o.quantity}</span>
                <Badge status={o.status} />
              </div>
              <div className="muted">{o.shippingAddress.name}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>
                {o.shippingAddress.line1}{o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ""}, {o.shippingAddress.city}, {o.shippingAddress.postcode}, {o.shippingAddress.country}
              </div>
              <div className="camp-stats-row" style={{ marginTop: 8 }}>
                <div><span className="muted">Total</span> {money(o.total)}</div>
                <div><span className="muted">Ordered</span> {fmtDate(o.createdAt)}</div>
              </div>
              {["pending", "processing"].includes(o.status) && (
                <div className="row-actions" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  {o.status === "pending" && <button className="btn-mini" onClick={() => setStatus(o.id, "processing")}>Mark processing</button>}
                  <input className="input" placeholder="Carrier" style={{ maxWidth: 110 }} onChange={setDraft(o.id, "carrier")} />
                  <input className="input" placeholder="Tracking #" style={{ maxWidth: 140 }} onChange={setDraft(o.id, "trackingNumber")} />
                  <button className="btn-mini" onClick={() => ship(o.id)}>Mark shipped</button>
                  <button className="btn-mini danger" onClick={() => setStatus(o.id, "cancelled")}>Cancel & refund</button>
                </div>
              )}
              {o.status === "shipped" && (
                <div className="row-actions" style={{ marginTop: 10 }}>
                  <button className="btn-mini" onClick={() => setStatus(o.id, "delivered")}>Mark delivered</button>
                </div>
              )}
              {o.trackingNumber && <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>{o.carrier || "Courier"}: {o.trackingNumber}</div>}
            </div>
          ))}
        </div>
      )}
    </AdvertiserGate>
  );
}

function AdvertiserVerification({ adv, db }) {
  const campaigns = Object.values(db.campaigns).filter((c) => c.advertiserId === adv.id);
  const txns = db.transactions.filter((t) => t.advertiserId === adv.id && (t.type === "AD_VIEW" || t.type === "AD_VIEW_FAILED"));

  const rows = campaigns.map((c) => {
    const campTxns = txns.filter((t) => t.campaignId === c.id);
    const passed = campTxns.filter((t) => t.type === "AD_VIEW").length;
    const failed = campTxns.filter((t) => t.type === "AD_VIEW_FAILED").length;
    const attempts = passed + failed;
    const passRate = attempts ? Math.round((passed / attempts) * 100) : null;
    const interruptions = campTxns.reduce((s, t) => s + (t.interruptions || 0), 0);
    return { c, attempts, passed, failed, passRate, interruptions };
  });

  const totalAttempts = rows.reduce((s, r) => s + r.attempts, 0);
  const totalPassed = rows.reduce((s, r) => s + r.passed, 0);
  const overallRate = totalAttempts ? Math.round((totalPassed / totalAttempts) * 100) : null;

  return (
    <AdvertiserGate adv={adv}>
      <div className="page-head"><h2>Verification</h2><p>Proof that the views you're paying for are real, attentive people.</p></div>
      <div className="stat-grid">
        <StatCard label="Total view attempts" value={totalAttempts} />
        <StatCard label="Passed verification" value={totalPassed} tone="#52E3C2" />
        <StatCard label="Overall pass rate" value={overallRate === null ? "—" : `${overallRate}%`} />
      </div>
      <div className="card">
        <div className="card-title">By campaign</div>
        {rows.length === 0 ? <EmptyState icon={ShieldCheck} title="No verification data yet" /> : (
          <table className="table">
            <thead><tr><th>Campaign</th><th>Attempts</th><th>Passed</th><th>Failed</th><th>Pass rate</th><th>Tab interruptions</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.c.id}>
                  <td>{r.c.name}</td>
                  <td className="mono">{r.attempts}</td>
                  <td className="mono">{r.passed}</td>
                  <td className="mono">{r.failed}</td>
                  <td className="mono">{r.passRate === null ? "—" : `${r.passRate}%`}</td>
                  <td className="mono">{r.interruptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {campaigns.some((c) => c.variantB) && (
        <div className="card">
          <div className="card-title">A/B tests</div>
          {campaigns.filter((c) => c.variantB).map((c) => {
            const campTxns = txns.filter((t) => t.campaignId === c.id);
            const forVariant = (v) => {
              const vTxns = campTxns.filter((t) => (t.variant || "A") === v);
              const passed = vTxns.filter((t) => t.type === "AD_VIEW").length;
              const attempts = vTxns.length;
              return { attempts, passed, rate: attempts ? Math.round((passed / attempts) * 100) : null };
            };
            const a = forVariant("A");
            const b = forVariant("B");
            return (
              <div key={c.id} style={{ marginBottom: 16 }}>
                <div className="card-title" style={{ fontSize: 13 }}>{c.name}</div>
                <table className="table">
                  <thead><tr><th>Variant</th><th>Title</th><th>Attempts</th><th>Passed</th><th>Pass rate</th></tr></thead>
                  <tbody>
                    <tr><td>A</td><td>{c.adTitle}</td><td className="mono">{a.attempts}</td><td className="mono">{a.passed}</td><td className="mono">{a.rate === null ? "—" : `${a.rate}%`}</td></tr>
                    <tr><td>B</td><td>{c.variantB.adTitle}</td><td className="mono">{b.attempts}</td><td className="mono">{b.passed}</td><td className="mono">{b.rate === null ? "—" : `${b.rate}%`}</td></tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </AdvertiserGate>
  );
}

/* ============================== ADMIN PAGES ================================ */

function AdminOverview({ db }) {
  const txns = db.transactions;
  const platformRevenue = txns.filter((t) => t.type === "AD_VIEW").reduce((s, t) => s + t.platformShare, 0);
  const userRewards = txns.filter((t) => t.type === "AD_VIEW").reduce((s, t) => s + t.userShare, 0);
  const advertiserSpend = txns.filter((t) => t.type === "AD_VIEW").reduce((s, t) => s + t.cpv, 0);
  const subscriptionRevenue = txns.filter((t) => t.type === "SUBSCRIPTION").reduce((s, t) => s + t.amount, 0);
  const membershipRevenue = txns.filter((t) => t.type === "MEMBERSHIP_PURCHASE").reduce((s, t) => s + t.amount, 0);
  const deposits = txns.filter((t) => t.type === "DEPOSIT").reduce((s, t) => s + t.amount, 0);
  // Real costs that leave the platform's own pocket — these credit user
  // balances directly and were never actually subtracted from revenue
  // anywhere before, which meant "platform revenue" was overstating what's
  // genuinely left over.
  const referralBonusesPaid = txns.filter((t) => t.type === "REFERRAL_BONUS").reduce((s, t) => s + t.amount, 0);
  const loyaltyBonusesPaid = txns.filter((t) => t.type === "LOYALTY_BONUS").reduce((s, t) => s + t.amount, 0);
  const pendingWithdrawals = Object.values(db.withdrawals).filter((w) => w.status === "pending");
  const pendingAdvertisers = Object.values(db.users).filter((u) => u.role === "advertiser" && u.advertiserStatus === "pending");
  const pendingCampaigns = Object.values(db.campaigns).filter((c) => c.status === "pending");
  const totalUsers = Object.values(db.users).filter((u) => u.role === "user").length;
  const totalPlatformRevenue = platformRevenue + subscriptionRevenue + membershipRevenue;
  const netPlatformPosition = round2(totalPlatformRevenue - referralBonusesPaid - loyaltyBonusesPaid);
  const orders = Object.values(db.orders || {});
  const storeGMV = orders.reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter((o) => ["pending", "processing"].includes(o.status));

  return (
    <div>
      <div className="page-head"><h2>Platform overview</h2><p>Real-time snapshot of adspXce's marketplace.</p></div>
      <div className="stat-grid">
        <StatCard label="Net platform position" value={money(netPlatformPosition)} sub="Revenue minus referral & loyalty bonuses paid" tone="#52E3C2" />
        <StatCard label="Total platform revenue" value={money(totalPlatformRevenue)} sub="Before bonus payouts, below" />
        <StatCard label="Referral bonuses paid" value={money(referralBonusesPaid)} />
        <StatCard label="Loyalty bonuses paid" value={money(loyaltyBonusesPaid)} />
        <StatCard label="User rewards paid" value={money(userRewards)} sub="Already excluded from revenue above" />
        <StatCard label="Advertiser spend" value={money(advertiserSpend)} />
        <StatCard label="Subscription revenue" value={money(subscriptionRevenue)} />
        <StatCard label="Registered users" value={totalUsers} />
        <StatCard label="Advertiser deposits" value={money(deposits)} />
        <StatCard label="Store orders" value={orders.length} />
        <StatCard label="Store GMV" value={money(storeGMV)} />
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-title">Needs review</div>
          <div className="review-row"><span>Pending advertiser applications</span><strong>{pendingAdvertisers.length}</strong></div>
          <div className="review-row"><span>Pending campaign approvals</span><strong>{pendingCampaigns.length}</strong></div>
          <div className="review-row"><span>Pending withdrawals</span><strong>{pendingWithdrawals.length}</strong></div>
          <div className="review-row"><span>Orders awaiting fulfilment</span><strong>{pendingOrders.length}</strong></div>
        </div>
        <div className="card">
          <div className="card-title">Recent ledger activity</div>
          <TxnTable txns={txns.slice(0, 6)} perspective="admin" compact db={db} />
        </div>
      </div>
    </div>
  );
}

function AdminWaitlist({ db, run, pushToast }) {
  const allUsers = Object.values(db.users).filter((u) => u.role === "user");
  const waitlisted = allUsers.filter((u) => u.waitlisted).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const admittedCount = allUsers.length - waitlisted.length;
  const capacity = db.waitlistCapacity ?? 0;
  const roomLeft = Math.max(0, capacity - admittedCount);
  const [batchCount, setBatchCount] = useState("5");

  return (
    <div>
      <div className="page-head"><h2>Waitlist</h2><p>Admits automatically based on real ad supply — the moment a new campaign goes active, the next people in line get in.</p></div>
      <div className="stat-grid">
        <StatCard label="Waiting" value={waitlisted.length} />
        <StatCard label="Admitted" value={admittedCount} />
        <StatCard label="Current capacity" value={capacity} sub={`Based on real budgets across ${db.activeCampaignCount ?? 0} active campaigns`} tone="#52E3C2" />
        <StatCard label="Room right now" value={roomLeft} sub={roomLeft > 0 ? "Should already be empty below" : "At capacity"} />
      </div>
      {waitlisted.length > 0 && (
        <div className="card">
          <div className="card-title">Manual override — admit a batch anyway</div>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
            This happens automatically as campaigns go active — use this only if you want to let people in ahead
            of that, e.g. for a special case. Admits the longest-waiting people first.
          </p>
          <div className="inline-form">
            <input className="input" type="number" min="1" max={waitlisted.length} value={batchCount} onChange={(e) => setBatchCount(e.target.value)} />
            <button className="btn btn-primary" onClick={async () => { const r = await run('ADMIT_WAITLIST_BATCH', { count: parseInt(batchCount, 10) }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>
              Admit next {batchCount}
            </button>
          </div>
        </div>
      )}
      <div className="card">
        <table className="table">
          <thead><tr><th>Position</th><th>Name</th><th>Email</th><th>Joined queue</th><th></th></tr></thead>
          <tbody>
            {waitlisted.length === 0 && (
              <tr><td colSpan={5}><EmptyState icon={Clock} title="No one's waiting" sub="Every registered user is fully admitted right now." /></td></tr>
            )}
            {waitlisted.map((u, i) => (
              <tr key={u.id}>
                <td className="mono">#{i + 1}</td>
                <td>{u.name}</td>
                <td className="muted">{u.email}</td>
                <td className="muted">{fmtDate(u.createdAt)}</td>
                <td>
                  <button className="btn-mini" onClick={async () => { const r = await run('ADMIT_FROM_WAITLIST', { userId: u.id }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>
                    Admit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminUsers({ db, run, pushToast }) {
  const users = Object.values(db.users).filter((u) => u.role === "user").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div>
      <div className="page-head"><h2>Users</h2><p>Verification, suspension and earnings oversight.</p></div>
      <div className="card">
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Membership</th><th>Balance</th><th>Trust</th><th>ID Verified</th><th>Verified</th><th>Waitlist</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td className="muted">{u.email}</td>
              <td>{TIER_LABELS[u.membership]}</td>
              <td className="mono">{money(u.balance)}</td>
              <td className="mono">{u.trustScore ?? "—"}</td>
              <td>
                {u.identityVerificationStatus === "verified" ? (
                  u.identityDuplicateFlag
                    ? <span style={{ color: "#FF7A7A", fontWeight: 700, fontSize: 11.5 }}>⚠ Duplicate?</span>
                    : <Check size={15} color="#52E3C2" />
                ) : (
                  <span className="muted" style={{ fontSize: 11.5 }}>{u.identityVerificationStatus === "processing" ? "Processing" : u.identityVerificationStatus === "failed" ? "Failed" : "—"}</span>
                )}
              </td>
              <td>{u.verified ? <Check size={15} color="#52E3C2" /> : <span className="muted">No</span>}</td>
              <td>{u.waitlisted ? <span style={{ color: "#E8C468", fontWeight: 700, fontSize: 11.5 }}>Waiting</span> : <span className="muted" style={{ fontSize: 11.5 }}>Admitted</span>}</td>
              <td>{u.suspended ? <Badge status="suspended" /> : <Badge status="active" />}</td>
              <td className="row-actions">
                {!u.verified && <button className="btn-mini" onClick={async () => { const r = await run('SET_USER_FLAG', { userId: u.id, field: "verified", value: true }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>Verify</button>}
                {u.identityDuplicateFlag && <button className="btn-mini" onClick={async () => { const r = await run('CLEAR_IDENTITY_FLAG', { userId: u.id }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>Clear flag</button>}
                <button className="btn-mini danger" onClick={async () => { const r = await run('SET_USER_FLAG', { userId: u.id, field: "suspended", value: !u.suspended }); pushToast(r.message || r.error, r.error ? "error" : "success"); }}>
                  {u.suspended ? "Unsuspend" : "Suspend"}
                </button>
                {!u.deleted && (
                  <button
                    className="btn-mini danger"
                    onClick={async () => {
                      if (u.balance > 0 || (u.pendingWithdrawal || 0) > 0) {
                        pushToast(`${u.name} has an unresolved balance and can't be deleted until it's resolved.`, "error");
                        return;
                      }
                      const confirmed = window.confirm(`Permanently delete ${u.name}? If they've ever watched an ad or earned anything, their personal data is scrubbed but the financial record stays for accurate reporting — this can't be undone either way.`);
                      if (!confirmed) return;
                      const r = await run('ADMIN_DELETE_USER', { userId: u.id });
                      pushToast(r.message || r.error, r.error ? "error" : "success");
                    }}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function AdminAdvertisers({ db, run, pushToast }) {
  const advs = Object.values(db.users).filter((u) => u.role === "advertiser").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const act = async (userId, status) => { const r = await run('SET_ADVERTISER_STATUS', { userId, status }); pushToast(r.message || r.error, r.error ? "error" : "success"); };
  return (
    <div>
      <div className="page-head"><h2>Advertisers</h2><p>Business verification and account status.</p></div>
      <div className="camp-grid">
        {advs.map((a) => (
          <div key={a.id} className="camp-card">
            <div className="camp-card-top">
              <span className="camp-card-name"><Building2 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />{a.company}</span>
              <Badge status={a.advertiserStatus} />
            </div>
            <div className="muted">{a.name} · {a.contact}</div>
            <div className="camp-stats-row">
              <div><span className="muted">Balance</span> {money(a.advertiserBalance)}</div>
              <div><span className="muted">Subscription</span> {a.subscriptionActive ? "Active" : "Inactive"}</div>
            </div>
            <div className="row-actions" style={{ marginTop: 10 }}>
              {a.advertiserStatus === "pending" && <>
                <button className="btn-mini" onClick={() => act(a.id, "approved")}>Approve</button>
                <button className="btn-mini danger" onClick={() => act(a.id, "rejected")}>Reject</button>
              </>}
              {a.advertiserStatus === "approved" && <button className="btn-mini danger" onClick={() => act(a.id, "suspended")}>Suspend</button>}
              {a.advertiserStatus === "suspended" && <button className="btn-mini" onClick={() => act(a.id, "approved")}>Reinstate</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminProducts({ db, run, pushToast }) {
  const products = Object.values(db.products || {}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const act = async (productId, status) => { const r = await run('ADMIN_SET_PRODUCT_STATUS', { productId, status }); pushToast(r.message || r.error, r.error ? "error" : "success"); };

  return (
    <div>
      <div className="page-head"><h2>Products</h2><p>Every product listed across all advertisers — remove anything that isn't fit for the Store.</p></div>
      {products.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No products listed yet" />
      ) : (
        <div className="camp-grid">
          {products.map((p) => {
            const adv = db.users[p.advertiserId];
            return (
              <div key={p.id} className="camp-card">
                <div className="camp-card-top">
                  <span className="camp-card-name">{p.name}</span>
                  <Badge status={p.status} />
                </div>
                <div className="muted">{adv ? adv.company : "Unknown advertiser"}</div>
                <div className="camp-card-title">{p.description}</div>
                <div className="camp-stats-row">
                  <div><span className="muted">Price</span> {money(p.price)}</div>
                  <div><span className="muted">Stock</span> {p.stock}</div>
                  <div><span className="muted">Wishlisted by</span> {p.wishlistCount || 0}</div>
                </div>
                <div className="row-actions" style={{ marginTop: 10 }}>
                  {p.status !== "removed" ? (
                    <button
                      className="btn-mini danger"
                      onClick={() => { if (window.confirm(`Remove "${p.name}"? The advertiser won't be able to reactivate it themselves.`)) act(p.id, "removed"); }}
                    >
                      <Ban size={13} /> Remove
                    </button>
                  ) : (
                    <button className="btn-mini" onClick={() => act(p.id, "active")}><PlayCircle size={13} /> Restore</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminCampaigns({ db, run, pushToast }) {
  const campaigns = Object.values(db.campaigns).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const act = async (campaignId, status) => { const r = await run('SET_CAMPAIGN_STATUS', { campaignId, status }); pushToast(r.message || r.error, r.error ? "error" : "success"); };
  return (
    <div>
      <div className="page-head"><h2>Campaigns</h2><p>Approve, pause or suspend advertising campaigns.</p></div>
      <div className="camp-grid">
        {campaigns.map((c) => {
          const adv = db.users[c.advertiserId];
          return (
            <div key={c.id} className="camp-card">
              <div className="camp-card-top">
                <span className="camp-card-name">{c.name}</span>
                <Badge status={c.status} />
              </div>
              <div className="muted">{adv ? adv.company : "Unknown advertiser"}</div>
              <div className="camp-card-title">{c.adTitle}</div>
              <div className="camp-stats-row">
                <div><span className="muted">CPV</span> {money(c.cpv)}</div>
                <div><span className="muted">Views</span> {c.views}</div>
                <div><span className="muted">Spent</span> {money(c.spent)} / {money(c.totalBudget)}</div>
              </div>
              {(c.ageRange && c.ageRange !== "All") || (c.interestTags && c.interestTags.length > 0) ? (
                <div className="chip-row" style={{ marginTop: 8 }}>
                  {c.ageRange && c.ageRange !== "All" && <span className="chip">{c.ageRange}</span>}
                  {(c.interestTags || []).map((t) => <span key={t} className="chip">{t}</span>)}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>Untargeted — shown to all users</div>
              )}
              <div className="row-actions" style={{ marginTop: 10 }}>
                {c.status === "pending" && <>
                  <button className="btn-mini" onClick={() => act(c.id, "active")}><PlayCircle size={13} /> Approve</button>
                  <button className="btn-mini danger" onClick={() => act(c.id, "rejected")}><X size={13} /> Reject</button>
                </>}
                {c.status === "active" && <button className="btn-mini" onClick={() => act(c.id, "paused")}><PauseCircle size={13} /> Pause</button>}
                {c.status === "paused" && <button className="btn-mini" onClick={() => act(c.id, "active")}><PlayCircle size={13} /> Resume</button>}
                {["active", "paused"].includes(c.status) && <button className="btn-mini danger" onClick={() => act(c.id, "suspended")}><Ban size={13} /> Suspend</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminWithdrawals({ db, run, pushToast }) {
  const withdrawals = Object.values(db.withdrawals).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const act = async (withdrawalId, approve) => { const r = await run('RESOLVE_WITHDRAWAL', { withdrawalId, approve }); pushToast(r.message || r.error, r.error ? "error" : "success"); };
  return (
    <div>
      <div className="page-head"><h2>Withdrawals</h2><p>Review and release pending payouts.</p></div>
      <div className="card">
      <table className="table">
        <thead><tr><th>User</th><th>Amount</th><th>Requested</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {withdrawals.map((w) => {
            const u = db.users[w.userId];
            return (
              <tr key={w.id}>
                <td>{u ? u.name : "—"}</td>
                <td className="mono">{money(w.amount)}</td>
                <td className="muted">{fmtDate(w.requestedAt)}</td>
                <td><Badge status={w.status} /></td>
                <td className="row-actions">
                  {w.status === "pending" && <>
                    <button className="btn-mini" onClick={() => act(w.id, true)}>Mark paid</button>
                    <button className="btn-mini danger" onClick={() => act(w.id, false)}>Reject</button>
                  </>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function AdminConfig({ db, run, pushToast }) {
  const [form, setForm] = useState({
    cpvMin: db.config.cpvMin, cpvMax: db.config.cpvMax,
    advertiserSubscriptionPrice: db.config.advertiserSubscriptionPrice, withdrawalMinimum: db.config.withdrawalMinimum,
    trustAutoApproveThreshold: db.config.trustAutoApproveThreshold ?? 80,
    loyaltyBonusDaysRequired: db.config.loyaltyBonusDaysRequired ?? 4, loyaltyBonusAmount: db.config.loyaltyBonusAmount ?? 0.5,
    minCampaignsForUpgrade: db.config.minCampaignsForUpgrade ?? 5,
    waitlistEnabled: db.config.waitlistEnabled ?? true,
    waitlistSafetyMultiplier: db.config.waitlistSafetyMultiplier ?? 4,
    basicViews: db.config.membership.basic.views, basicRate: db.config.membership.basic.sharePct,
    plusViews: db.config.membership.plus.views, plusPrice: db.config.membership.plus.price, plusRate: db.config.membership.plus.sharePct,
    premiumViews: db.config.membership.premium.views, premiumPrice: db.config.membership.premium.price, premiumRate: db.config.membership.premium.sharePct,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const patch = {
      cpvMin: parseFloat(form.cpvMin), cpvMax: parseFloat(form.cpvMax),
      advertiserSubscriptionPrice: parseFloat(form.advertiserSubscriptionPrice), withdrawalMinimum: parseFloat(form.withdrawalMinimum),
      trustAutoApproveThreshold: parseFloat(form.trustAutoApproveThreshold),
      loyaltyBonusDaysRequired: parseInt(form.loyaltyBonusDaysRequired, 10), loyaltyBonusAmount: parseFloat(form.loyaltyBonusAmount),
      minCampaignsForUpgrade: parseInt(form.minCampaignsForUpgrade, 10),
      waitlistEnabled: !!form.waitlistEnabled,
      waitlistSafetyMultiplier: parseFloat(form.waitlistSafetyMultiplier),
      membership: {
        basic: { views: parseInt(form.basicViews, 10), price: 0, sharePct: parseFloat(form.basicRate) },
        plus: { views: parseInt(form.plusViews, 10), price: parseFloat(form.plusPrice), sharePct: parseFloat(form.plusRate) },
        premium: { views: parseInt(form.premiumViews, 10), price: parseFloat(form.premiumPrice), sharePct: parseFloat(form.premiumRate) },
      },
    };
    const r = await run('UPDATE_CONFIG', { patch });
    pushToast(r.message || r.error, r.error ? "error" : "success");
  };

  return (
    <div>
      <div className="page-head"><h2>Platform configuration</h2><p>These values drive every calculation across the marketplace. Earning rates are internal — never shown to users as a percentage.</p></div>
      <form className="card" onSubmit={save}>
        <div className="card-title">Pricing</div>
        <div className="form-row">
          <label>CPV minimum<input className="input" type="number" step="0.01" value={form.cpvMin} onChange={set("cpvMin")} /></label>
          <label>CPV maximum<input className="input" type="number" step="0.01" value={form.cpvMax} onChange={set("cpvMax")} /></label>
          <label>Advertiser subscription/mo<input className="input" type="number" step="0.01" value={form.advertiserSubscriptionPrice} onChange={set("advertiserSubscriptionPrice")} /></label>
        </div>
        <div className="card-title" style={{ marginTop: 18 }}>Memberships & earning rates</div>
        <div className="form-row">
          <label>Basic — views/day<input className="input" type="number" value={form.basicViews} onChange={set("basicViews")} /></label>
          <label>Basic — earning rate (%)<input className="input" type="number" step="1" value={form.basicRate} onChange={set("basicRate")} /></label>
        </div>
        <div className="form-row">
          <label>Upgraded — views/day<input className="input" type="number" value={form.plusViews} onChange={set("plusViews")} /></label>
          <label>Upgraded — price/mo<input className="input" type="number" step="0.01" value={form.plusPrice} onChange={set("plusPrice")} /></label>
          <label>Upgraded — earning rate (%)<input className="input" type="number" step="1" value={form.plusRate} onChange={set("plusRate")} /></label>
        </div>
        <div className="form-row">
          <label>Gold — views/day<input className="input" type="number" value={form.premiumViews} onChange={set("premiumViews")} /></label>
          <label>Gold — price/mo<input className="input" type="number" step="0.01" value={form.premiumPrice} onChange={set("premiumPrice")} /></label>
          <label>Gold — earning rate (%)<input className="input" type="number" step="1" value={form.premiumRate} onChange={set("premiumRate")} /></label>
        </div>
        <div className="card-title" style={{ marginTop: 18 }}>Withdrawals</div>
        <div className="form-row">
          <label>Minimum withdrawal<input className="input" type="number" step="0.01" value={form.withdrawalMinimum} onChange={set("withdrawalMinimum")} /></label>
          <label>Trust score for instant payout<input className="input" type="number" step="1" min="0" max="100" value={form.trustAutoApproveThreshold} onChange={set("trustAutoApproveThreshold")} /></label>
        </div>
        <div className="card-title" style={{ marginTop: 18 }}>Loyalty bonus</div>
        <div className="form-row">
          <label>Days active required per week<input className="input" type="number" step="1" min="1" max="7" value={form.loyaltyBonusDaysRequired} onChange={set("loyaltyBonusDaysRequired")} /></label>
          <label>Bonus amount<input className="input" type="number" step="0.01" min="0" value={form.loyaltyBonusAmount} onChange={set("loyaltyBonusAmount")} /></label>
        </div>
        <div className="card-title" style={{ marginTop: 18 }}>Membership supply gate</div>
        <div className="form-row">
          <label>Min. active campaigns to unlock paid tiers<input className="input" type="number" step="1" min="0" value={form.minCampaignsForUpgrade} onChange={set("minCampaignsForUpgrade")} /></label>
        </div>
        <div className="card-title" style={{ marginTop: 18 }}>New signups</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <input type="checkbox" checked={form.waitlistEnabled} onChange={(e) => setForm((f) => ({ ...f, waitlistEnabled: e.target.checked }))} />
          Automatically admit new signups based on real ad supply, waitlisting the rest
        </label>
        <div className="form-row" style={{ marginTop: 10 }}>
          <label>Variety safety multiplier<input className="input" type="number" step="0.5" min="0.5" value={form.waitlistSafetyMultiplier} onChange={set("waitlistSafetyMultiplier")} /></label>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Capacity is calculated from real campaign budgets, not a guessed number per campaign — every active
          campaign's actual daily budget ÷ its CPV gives real daily views deliverable, summed across all of them,
          then divided by (Basic tier's daily cap × this multiplier). Higher multiplier = more buffer for variety,
          but a lower capacity right now. The moment a new campaign goes active, anyone next in line is admitted
          automatically, in real time — no manual approval needed. Advertiser signups are never waitlisted. You can
          still manually admit or batch-admit from the Waitlist page any time, as an override.
        </p>
        <button className="btn btn-primary" type="submit" style={{ marginTop: 14 }}><Settings size={15} /> Save configuration</button>
      </form>
      <AdminBackups />
    </div>
  );
}

function AdminBackups() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/backup-status", { credentials: "include" });
        if (res.ok) setStatus(await res.json());
      } catch (e) {
        // Non-critical — just leave status unset if this fails.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="card">
      <div className="card-title">Backups</div>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
        Automatic snapshots run every 6 hours (last 10 kept). Download a copy periodically too — an automatic backup on the same server doesn't protect against losing the whole server.
      </p>
      {!loading && status && (
        <div className="review-row">
          <span>Snapshots on this server</span>
          <strong>{status.count}{status.latest ? ` — most recent ${fmtDate(status.latest)}` : ""}</strong>
        </div>
      )}
      <a className="btn btn-primary" style={{ marginTop: 12, display: "inline-flex" }} href="/api/admin/export">
        <Package size={15} /> Download full backup
      </a>
    </div>
  );
}

function AdminLedger({ db }) {
  return (
    <div>
      <div className="page-head"><h2>Ledger</h2><p>Every financial movement on the platform, most recent first.</p></div>
      <div className="card"><TxnTable txns={db.transactions} perspective="admin" db={db} /></div>
    </div>
  );
}

/* ================================ TXN TABLE ================================ */

function describeTxn(t, db, viewerId) {
  const viewerIsAdvertiser = viewerId && t.advertiserId === viewerId && t.userId !== viewerId;
  switch (t.type) {
    case "AD_VIEW":
      if (viewerIsAdvertiser) return { label: `Ad view charge — ${t.campaignName || "campaign"}`, amount: `-${money(t.cpv)}`, tone: "#FF7A7A" };
      return { label: `Ad view — ${t.campaignName || "campaign"}`, amount: `+${money(t.userShare)}`, tone: "#52E3C2" };
    case "WITHDRAWAL": return { label: "Withdrawal", amount: `-${money(t.amount)}`, tone: "#FF7A7A" };
    case "ADVERTISER_WITHDRAWAL": return { label: "Withdrawal", amount: `-${money(t.amount)}`, tone: "#FF7A7A" };
    case "MEMBERSHIP_PURCHASE": return { label: `Membership → ${TIER_LABELS[t.tier] || t.tier}`, amount: t.amount ? money(t.amount) : "Free", tone: "#9498C4" };
    case "SUBSCRIPTION": return { label: "Advertiser subscription", amount: `-${money(t.amount)}`, tone: "#FF7A7A" };
    case "DEPOSIT": return { label: "Advertising deposit", amount: `+${money(t.amount)}`, tone: "#52E3C2" };
    case "CAMPAIGN_RESERVE": return { label: "Campaign budget reserved", amount: `-${money(t.amount)}`, tone: "#FF7A7A" };
    case "CAMPAIGN_REFUND": return { label: "Campaign budget refunded", amount: `+${money(t.amount)}`, tone: "#52E3C2" };
    case "AD_VIEW_FAILED": return { label: `Attention check missed — ${t.campaignName || "campaign"}`, amount: "£0.00", tone: "#FF7A7A" };
    case "STORE_PURCHASE":
      if (viewerIsAdvertiser) return { label: "Store sale", amount: `+${money(t.amount)}`, tone: "#52E3C2" };
      return { label: "Store purchase", amount: `-${money(t.amount)}`, tone: "#FF7A7A" };
    case "GIFT_PURCHASE":
      if (viewerIsAdvertiser) return { label: "Gift sale", amount: `+${money(t.amount)}`, tone: "#52E3C2" };
      if (viewerId === t.giftedBy) return { label: `Gift sent to ${t.recipientName || "a friend"}`, amount: `-${money(t.amount)}`, tone: "#FF7A7A" };
      return { label: `Gift from ${t.giftedByName || "a friend"}`, amount: "£0.00", tone: "#52E3C2" };
    case "STORE_REFUND":
      if (viewerIsAdvertiser) return { label: "Store sale reversed (refund)", amount: `-${money(t.amount)}`, tone: "#FF7A7A" };
      return { label: "Store order refunded", amount: `+${money(t.amount)}`, tone: "#52E3C2" };
    case "REFERRAL_BONUS": return { label: t.note === "referrer" ? "Referral bonus — friend joined" : "Referral welcome bonus", amount: `+${money(t.amount)}`, tone: "#52E3C2" };
    case "LOYALTY_BONUS": return { label: `Loyalty bonus — active ${t.activeDays} days this week`, amount: `+${money(t.amount)}`, tone: "#52E3C2" };
    case "DONATION": return { label: `Donated to ${t.charityName || "charity"}`, amount: `-${money(t.amount)}`, tone: "#FF7A7A" };
    default: return { label: t.type, amount: money(t.amount || 0), tone: "#9498C4" };
  }
}

function TxnTable({ txns, perspective, compact, db, viewerId }) {
  if (!txns.length) return <EmptyState icon={Clock} title="No transactions yet" />;
  return (
    <table className="table">
      <thead><tr><th>When</th><th>Type</th>{perspective === "admin" && !compact && <th>Account</th>}<th>Amount</th><th>Status</th></tr></thead>
      <tbody>
        {txns.map((t) => {
          const d = describeTxn(t, db, viewerId);
          return (
            <tr key={t.id}>
              <td className="muted">{fmtDate(t.timestamp)}</td>
              <td>{d.label}</td>
              {perspective === "admin" && !compact && <td className="muted">{t.userId}</td>}
              <td className="mono" style={{ color: d.tone }}>{d.amount}</td>
              <td><Badge status={(t.status || "completed").toLowerCase()} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ================================= SHELL =================================== */

const NAV = {
  user: [
    { key: "dashboard", label: "Dashboard", icon: Home },
    { key: "ads", label: "View ads", icon: Eye },
    { key: "activity", label: "Activity", icon: TrendingUp },
    { key: "store", label: "Store", icon: ShoppingBag },
    { key: "orders", label: "My orders", icon: Package },
    { key: "profile", label: "Profile", icon: Users },
    { key: "notifications", label: "Notifications", icon: Bell },
    { key: "referrals", label: "Referrals", icon: Gift },
    { key: "membership", label: "Membership", icon: Sparkles },
    { key: "withdraw", label: "Withdraw", icon: Wallet },
  ],
  advertiser: [
    { key: "dashboard", label: "Dashboard", icon: Home },
    { key: "campaigns", label: "Campaigns", icon: Megaphone },
    { key: "verification", label: "Verification", icon: ShieldCheck },
    { key: "products", label: "Products", icon: ShoppingBag },
    { key: "orders", label: "Orders", icon: Package },
    { key: "billing", label: "Billing", icon: CreditCard },
    { key: "withdraw", label: "Withdraw", icon: Wallet },
  ],
  admin: [
    { key: "dashboard", label: "Overview", icon: Home },
    { key: "users", label: "Users", icon: Users },
    { key: "waitlist", label: "Waitlist", icon: Clock },
    { key: "advertisers", label: "Advertisers", icon: Building2 },
    { key: "campaigns", label: "Campaigns", icon: Megaphone },
    { key: "products", label: "Products", icon: ShoppingBag },
    { key: "withdrawals", label: "Withdrawals", icon: Wallet },
    { key: "ledger", label: "Ledger", icon: Clock },
    { key: "config", label: "Configuration", icon: Settings },
  ],
};

function TopSearch({ db, run, pushToast }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("user");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewingId, setViewingId] = useState(null);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&type=${type}`, { credentials: "include" });
        const data = await res.json();
        setResults(data.results || []);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, type]);

  return (
    <div className="topbar-search">
      <button className="topbar-search-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Search size={15} /> Search
      </button>
      {open && (
        <div className="topbar-search-panel">
          <div className="chip-row" style={{ marginBottom: 8 }}>
            <button type="button" className={type === "user" ? "chip active" : "chip"} onClick={() => setType("user")}>Search user</button>
            <button type="button" className={type === "advertiser" ? "chip active" : "chip"} onClick={() => setType("advertiser")}>Search company</button>
          </div>
          <input className="input" placeholder={type === "user" ? "Search by name…" : "Search by company…"} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          <div className="topbar-search-results">
            {loading && <div className="muted" style={{ fontSize: 12, padding: 8 }}>Searching…</div>}
            {!loading && query.trim().length >= 2 && results.length === 0 && <div className="muted" style={{ fontSize: 12, padding: 8 }}>No matches.</div>}
            {results.map((r) => (
              <div key={r.id} className="follower-row" style={{ cursor: "pointer" }} onClick={() => { setViewingId(r.id); setOpen(false); }}>
                <div className="follower-row-info"><Avatar dataUrl={r.avatarDataUrl} name={r.name} size={32} /><span>{r.name}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {viewingId && <ViewProfile targetId={viewingId} db={db} run={run} pushToast={pushToast} onClose={() => setViewingId(null)} />}
    </div>
  );
}

function Shell({ user, db, run, pushToast, onLogout }) {
  const [page, setPage] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("page");
    return fromUrl && NAV[user.role].some((n) => n.key === fromUrl) ? fromUrl : "dashboard";
  });
  const nav = NAV[user.role];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", page);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, [page]);

  let content;
  if (user.role === "user") {
    if (page === "dashboard") content = <UserDashboard user={db.users[user.id]} db={db} />;
    else if (page === "ads") content = <UserAds user={db.users[user.id]} db={db} run={run} pushToast={pushToast} />;
    else if (page === "activity") content = <UserActivity user={db.users[user.id]} db={db} />;
    else if (page === "store") content = <UserStore user={db.users[user.id]} db={db} run={run} pushToast={pushToast} />;
    else if (page === "orders") content = <UserOrders user={db.users[user.id]} db={db} />;
    else if (page === "profile") content = <UserProfile user={db.users[user.id]} db={db} run={run} pushToast={pushToast} />;
    else if (page === "notifications") content = <UserNotifications user={db.users[user.id]} run={run} pushToast={pushToast} />;
    else if (page === "referrals") content = <UserReferrals user={db.users[user.id]} db={db} />;
    else if (page === "membership") content = <UserMembership user={db.users[user.id]} db={db} run={run} pushToast={pushToast} />;
    else if (page === "withdraw") content = <UserWithdraw user={db.users[user.id]} db={db} run={run} pushToast={pushToast} />;
  } else if (user.role === "advertiser") {
    const adv = db.users[user.id];
    if (page === "dashboard") content = <AdvertiserDashboard adv={adv} db={db} />;
    else if (page === "campaigns") content = <AdvertiserCampaigns adv={adv} db={db} run={run} pushToast={pushToast} />;
    else if (page === "verification") content = <AdvertiserVerification adv={adv} db={db} />;
    else if (page === "products") content = <AdvertiserProducts adv={adv} db={db} run={run} pushToast={pushToast} />;
    else if (page === "orders") content = <AdvertiserOrders adv={adv} db={db} run={run} pushToast={pushToast} />;
    else if (page === "billing") content = <AdvertiserBilling adv={adv} db={db} run={run} pushToast={pushToast} />;
    else if (page === "withdraw") content = <AdvertiserWithdraw adv={adv} db={db} run={run} pushToast={pushToast} />;
  } else if (user.role === "admin") {
    if (page === "dashboard") content = <AdminOverview db={db} />;
    else if (page === "users") content = <AdminUsers db={db} run={run} pushToast={pushToast} />;
    else if (page === "waitlist") content = <AdminWaitlist db={db} run={run} pushToast={pushToast} />;
    else if (page === "advertisers") content = <AdminAdvertisers db={db} run={run} pushToast={pushToast} />;
    else if (page === "campaigns") content = <AdminCampaigns db={db} run={run} pushToast={pushToast} />;
    else if (page === "products") content = <AdminProducts db={db} run={run} pushToast={pushToast} />;
    else if (page === "withdrawals") content = <AdminWithdrawals db={db} run={run} pushToast={pushToast} />;
    else if (page === "ledger") content = <AdminLedger db={db} />;
    else if (page === "config") content = <AdminConfig db={db} run={run} pushToast={pushToast} />;
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <aside className="sidebar">
        <div className="brand-mark small">adspXce</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => {
            const Icon = n.icon;
            const unread = n.key === "notifications" ? (db.users[user.id]?.notifications || []).filter((x) => !x.read).length : 0;
            return (
              <button key={n.key} className={page === n.key ? "nav-btn active" : "nav-btn"} onClick={() => setPage(n.key)} aria-current={page === n.key ? "page" : undefined}>
                <Icon size={16} aria-hidden="true" /> {n.label}
                {unread > 0 && <span className="nav-badge">{unread > 9 ? "9+" : unread}</span>}
              </button>
            );
          })}
        </nav>
        <button className="nav-btn logout" onClick={onLogout}><LogOut size={16} aria-hidden="true" /> Log out</button>
      </aside>
      <main className="main" id="main-content" tabIndex={-1}>
        <div className="topbar">
          <div className="topbar-role">{user.role === "advertiser" ? "Advertiser" : user.role === "admin" ? "Administrator" : "User"} account</div>
          <TopSearch db={db} run={run} pushToast={pushToast} />
          <div className="topbar-name">{user.name}</div>
        </div>
        <div className="page">{content}</div>
      </main>
    </div>
  );
}

/* ================================== APP ===================================== */


/* ================================== APP ===================================== */

async function apiCall(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) return { error: data.error || "Something went wrong. Please try again." };
  return data;
}

export default function App() {
  const [db, setDb] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((text, kind = "success") => {
    if (!text) return;
    const id = uid("toast");
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/state", { credentials: "include" });
        const data = await res.json();
        setDb(data.db);
        setCurrentUserId(data.currentUserId);
      } catch (e) {
        pushToast("Couldn't reach the server. Please refresh.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [pushToast]);

  // Generic action dispatcher: mirrors the old client-side `run(mutatorFn)`,
  // but now the mutation actually happens server-side, authorized per-action.
  const run = useCallback(async (type, payload) => {
    const data = await apiCall("/api/action", { type, payload });
    if (data.error) return { error: data.error };
    setDb(data.db);
    return { message: data.message, newId: data.newId };
  }, []);

  const handleLogin = async (email, password) => {
    const data = await apiCall("/api/auth/login", { email, password });
    if (data.error) { pushToast(data.error, "error"); return; }
    setDb(data.db);
    setCurrentUserId(data.currentUserId);
  };

  const handleRegister = async (payload) => {
    const data = await apiCall("/api/auth/register", payload);
    if (data.error) { pushToast(data.error, "error"); return; }
    setDb(data.db);
    setCurrentUserId(data.currentUserId);
    pushToast(data.message, "success");
  };

  const handleLogout = async () => {
    await apiCall("/api/auth/logout", {});
    setCurrentUserId(null);
  };

  if (loading || !db) {
    return (
      <div className="loading-screen">
        <GlobalStyle />
        <span className="star-layer layer-1" aria-hidden="true" />
        <span className="star-layer layer-2" aria-hidden="true" />
        <span className="star-layer layer-3" aria-hidden="true" />
        <div className="loading-mark">adspXce</div>
      </div>
    );
  }

  const currentUser = currentUserId ? db.users[currentUserId] : null;

  return (
    <div className="root">
      <GlobalStyle />
      <span className="star-layer layer-1" aria-hidden="true" />
      <span className="star-layer layer-2" aria-hidden="true" />
      <span className="star-layer layer-3" aria-hidden="true" />
      <ShootingStars />
      {currentUser && currentUser.waitlisted ? (
        <WaitlistScreen user={currentUser} db={db} onLogout={handleLogout} />
      ) : currentUser ? (
        <Shell user={currentUser} db={db} run={run} pushToast={pushToast} onLogout={handleLogout} />
      ) : (
        <AuthScreen db={db} onLogin={handleLogin} onRegister={handleRegister} />
      )}
      <Toast toasts={toasts} />
    </div>
  );
}

/* =============================== GLOBAL STYLE ================================ */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

      :root {
        --bg: #05060F; --surface: #10122A; --surface-2: #171A3D; --ink: #F1F1FB; --ink-soft: #9498C4;
        --line: #262A55; --accent: #52E3C2; --accent-soft: rgba(82,227,194,0.16);
        --gold: #E8C468; --gold-soft: rgba(232,196,104,0.15); --danger: #FF7A7A; --danger-soft: rgba(255,122,122,0.14);
        --pill: #F2F1FF; --pill-ink: #08091E;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); }
      html { zoom: 1.4; }
      #root { min-height: 100%; width: 100%; }
      .root, .loading-screen { position: relative; font-family: 'Inter', sans-serif; color: var(--ink); background: var(--bg); min-height: 100%; width: 100%; overflow-x: hidden; }
      .root::before, .loading-screen::before {
        content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
        background:
          radial-gradient(1100px 640px at 8% -8%, rgba(82,227,194,0.07), transparent 55%),
          radial-gradient(900px 620px at 96% 8%, rgba(232,196,104,0.05), transparent 55%),
          radial-gradient(1000px 700px at 40% 115%, rgba(82,227,194,0.05), transparent 55%);
      }
      .root > .star-layer, .loading-screen > .star-layer {
        position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.55;
        animation: twinkle 9s ease-in-out infinite;
      }
      .star-layer.layer-1 {
        animation-delay: -1s;
        background-image:
          radial-gradient(1.5px 1.5px at 5% 12%, #fff, transparent),
          radial-gradient(2px 2px at 33% 22%, #fff, transparent),
          radial-gradient(1px 1px at 58% 35%, #fff, transparent),
          radial-gradient(1.5px 1.5px at 81% 52%, #fff, transparent),
          radial-gradient(1px 1px at 62% 5%, #fff, transparent);
      }
      .star-layer.layer-2 {
        animation-delay: -4s;
        background-image:
          radial-gradient(1px 1px at 14% 48%, #fff, transparent),
          radial-gradient(1px 1px at 41% 60%, #fff, transparent),
          radial-gradient(2px 2px at 66% 70%, #fff, transparent),
          radial-gradient(1px 1px at 89% 85%, #fff, transparent),
          radial-gradient(1.5px 1.5px at 3% 65%, #fff, transparent);
      }
      .star-layer.layer-3 {
        animation-delay: -7s;
        background-image:
          radial-gradient(1px 1px at 22% 78%, #fff, transparent),
          radial-gradient(1.5px 1.5px at 50% 90%, #fff, transparent),
          radial-gradient(1px 1px at 74% 15%, #fff, transparent),
          radial-gradient(1px 1px at 95% 30%, #fff, transparent);
      }
      .root > *, .loading-screen > * { position: relative; z-index: 1; }
      .root > .star-layer, .loading-screen > .star-layer { z-index: 0; position: fixed; }
      .mono { font-family: 'IBM Plex Mono', monospace; }
      h1, h2 { font-family: 'Space Grotesk', sans-serif; margin: 0; }
      p { color: var(--ink-soft); line-height: 1.5; }
      button { font-family: inherit; cursor: pointer; }
      input, textarea { font-family: inherit; }

      .loading-screen { display: flex; align-items: center; justify-content: center; min-height: 480px; }
      .loading-mark { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: 0.08em; font-size: 15px; color: var(--ink-soft); }

      /* ---------- Auth ---------- */
      .auth-shell { display: grid; grid-template-columns: 1.1fr 1fr; width: 100%; }
      @media (max-width: 860px) { .auth-shell { grid-template-columns: 1fr; } }
      .auth-hero {
        position: relative; overflow: hidden;
        background:
          radial-gradient(900px 480px at 105% -10%, rgba(82,227,194,0.14), transparent 60%),
          radial-gradient(700px 420px at -10% 105%, rgba(232,196,104,0.08), transparent 60%),
          linear-gradient(180deg, #05060F, #090B1E 60%, #060811);
        color: #EFF4F2; padding: 44px 40px; display: flex; flex-direction: column; gap: 16px;
      }
      .auth-hero > * { position: relative; z-index: 1; }
      @keyframes twinkle { 0%, 100% { opacity: 0.28; } 28% { opacity: 1; } 52% { opacity: 0.45; } 78% { opacity: 0.95; } }
      .root > .shooting-stars { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
      .shooting-star {
        position: absolute; width: 3px; height: 3px; background: #fff; border-radius: 50%;
        box-shadow: 0 0 12px 2px rgba(255,255,255,0.9), 0 0 26px 7px rgba(130,227,194,0.3);
        transform: rotate(var(--angle)) translateX(0); animation: shoot-random var(--duration) ease-out forwards;
      }
      .shooting-star::before {
        content: ''; position: absolute; top: 50%; right: 0; width: 160px; height: 2px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9)); transform: translateY(-50%);
      }
      @keyframes shoot-random {
        0% { opacity: 0; transform: rotate(var(--angle)) translateX(0); }
        8% { opacity: 1; }
        88% { opacity: 1; }
        100% { opacity: 0; transform: rotate(var(--angle)) translateX(var(--distance)); }
      }
      .brand-mark { font-family: 'Space Grotesk', sans-serif; font-weight: 700; letter-spacing: 0; font-size: 19px; position: relative; z-index: 1; }
      .brand-mark.small { padding: 22px 22px 10px; font-size: 17px; color: var(--ink); }
      .hero-watermark { position: absolute; top: -60px; right: -20px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 420px; line-height: 1; color: rgba(82,227,194,0.05); user-select: none; pointer-events: none; z-index: 0; }
      .hero-eyebrow { position: relative; z-index: 1; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); }
      .auth-hero h1 { position: relative; z-index: 1; font-size: 34px; line-height: 1.15; font-weight: 800; max-width: 440px; letter-spacing: -0.01em; }
      .auth-hero p { position: relative; z-index: 1; color: #A9B3AF; max-width: 420px; font-size: 14px; }
      .auth-hero-facts { display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #DCEAE5; }
      .auth-hero-facts div { display: flex; align-items: center; gap: 8px; }
      .ticker { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 14px 16px; }
      .ticker-head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #8FA69F; margin-bottom: 8px; }
      .ticker-empty { font-size: 12px; color: #8FA69F; }
      .ticker-viewport { max-height: 168px; overflow: hidden; position: relative; -webkit-mask-image: linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent); mask-image: linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent); }
      .ticker-scroll { animation-name: ticker-scroll; animation-timing-function: linear; animation-iteration-count: infinite; }
      .ticker-scroll:hover { animation-play-state: paused; }
      @keyframes ticker-scroll { from { transform: translateY(0); } to { transform: translateY(-50%); } }
      @media (prefers-reduced-motion: reduce) { .ticker-scroll { animation: none; } }
      .ticker-row { display: flex; justify-content: space-between; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; padding: 4px 0; border-top: 1px dashed rgba(255,255,255,0.1); }
      .ticker-row:first-child { border-top: none; }
      .ticker-type { color: #C7D6D1; text-transform: capitalize; }
      .ticker-amt { color: #52E3C2; }

      .auth-panel { padding: 44px 44px; display: flex; flex-direction: column; align-items: center; }
      .auth-tabs { display: flex; gap: 4px; background: var(--line); border-radius: 10px; padding: 4px; margin-bottom: 26px; width: fit-content; }
      .tab { border: none; background: transparent; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--ink-soft); }
      .tab.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(16,21,27,0.08); }
      .auth-form { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 380px; }
      .auth-form label { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
      .role-toggle { display: flex; gap: 8px; margin-bottom: 4px; }
      .role-btn { flex: 1; border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 9px 10px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); display: flex; align-items: center; justify-content: center; gap: 6px; }
      .role-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
      .form-note { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--ink-soft); }
      .trust-strip { margin-top: 22px; padding: 14px 16px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; width: 100%; max-width: 380px; }
      .trust-strip-title { font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; font-size: 10.5px; color: var(--ink-soft); margin-bottom: 10px; }
      .trust-step { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink); padding: 4px 0; }
      .trust-step svg { color: var(--accent); flex-shrink: 0; }

      /* ---------- Inputs / Buttons ---------- */
      .input { border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; font-size: 13.5px; background: var(--surface); color: var(--ink); width: 100%; }
      .input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
      button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
        outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px;
      }
      .skip-link { position: absolute; left: -9999px; top: 0; z-index: 200; background: var(--pill); color: var(--pill-ink); padding: 10px 16px; border-radius: 8px; font-weight: 700; font-size: 13px; }
      .skip-link:focus { left: 16px; top: 16px; }
      textarea.input { resize: vertical; }
      .btn { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 8px; padding: 10px 16px; font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 7px; transition: opacity .15s; }
      .btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .btn-primary { background: var(--pill); border-color: var(--pill); color: var(--pill-ink); border-radius: 100px; }
      .btn-primary:hover:not(:disabled) { opacity: 0.88; }
      .btn-ghost { background: var(--surface); }
      .btn-block { width: 100%; }
      .icon-btn { border: none; background: transparent; color: var(--ink-soft); padding: 4px; border-radius: 6px; }
      .icon-btn:hover { background: var(--line); }
      .btn-mini { border: 1px solid var(--line); background: var(--surface); border-radius: 6px; padding: 6px 10px; font-size: 11.5px; font-weight: 600; color: var(--ink); display: inline-flex; align-items: center; gap: 4px; }
      .btn-mini.danger { color: var(--danger); border-color: #EFC9C4; }
      .btn-mini:hover { background: var(--bg); }

      /* ---------- Shell ---------- */
      .app-shell { display: grid; grid-template-columns: 220px 1fr; width: 100%; }
      @media (max-width: 760px) { .app-shell { grid-template-columns: 1fr; } .sidebar { flex-direction: row; overflow-x: auto; overflow-y: visible; position: static; height: auto; } .sidebar nav { flex-direction: row; } }
      .sidebar {
        background: radial-gradient(320px 200px at 0% 0%, rgba(82,227,194,0.05), transparent 60%), var(--surface);
        border-right: 1px solid var(--line); display: flex; flex-direction: column; padding-bottom: 16px;
      }
      .sidebar nav { display: flex; flex-direction: column; gap: 2px; padding: 6px 12px; }
      .nav-btn { display: flex; align-items: center; gap: 10px; border: none; background: transparent; padding: 10px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--ink-soft); text-align: left; }
      .nav-btn:hover { background: var(--bg); }
      .nav-btn.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
      .nav-btn.logout { margin: 10px 12px 0; padding-top: 14px; border-top: 1px solid var(--line); color: var(--danger); }
      .nav-badge { margin-left: auto; background: var(--danger); color: white; font-size: 10.5px; font-weight: 700; border-radius: 100px; padding: 1px 6px; }
      .main { align-self: start; min-width: 0; }
      .topbar {
        display: flex; align-items: center; justify-content: space-between; padding: 18px 32px; border-bottom: 1px solid var(--line);
        background: radial-gradient(420px 160px at 100% 0%, rgba(232,196,104,0.04), transparent 65%), var(--surface);
      }
      .topbar-role { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); }
      .topbar-name { font-weight: 600; font-size: 13.5px; }
      .topbar-search { position: relative; }
      .topbar-search-toggle { display: flex; align-items: center; gap: 6px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 100px; padding: 7px 14px; font-size: 12.5px; color: var(--ink-soft); cursor: pointer; }
      .topbar-search-toggle:hover { color: var(--ink); }
      .topbar-search-panel { position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); width: 320px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px; box-shadow: 0 12px 32px rgba(0,0,0,0.4); z-index: 30; }
      .topbar-search-results { max-height: 260px; overflow-y: auto; margin-top: 8px; }
      .page { padding: 28px 32px 60px; }
      .page-head { margin-bottom: 22px; }
      .page-head h2 { font-size: 21px; margin-bottom: 4px; }
      .page-head p { font-size: 13px; margin: 0; }
      .page-head-row { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 22px; gap: 12px; }
      .page-head-row h2 { font-size: 21px; margin-bottom: 4px; }
      .page-head-row p { font-size: 13px; margin: 0; }

      /* ---------- Stat cards ---------- */
      .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
      .stat-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }
      .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); margin-bottom: 8px; }
      .stat-value { font-family: 'IBM Plex Mono', monospace; font-size: 21px; font-weight: 600; }
      .stat-sub { font-size: 11.5px; color: var(--ink-soft); margin-top: 4px; }

      /* ---------- Cards / tables ---------- */
      .card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 20px 22px; margin-bottom: 18px; }
      .card-title { font-weight: 600; font-size: 14px; margin-bottom: 14px; }
      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
      @media (max-width: 720px) { .two-col { grid-template-columns: 1fr; } }
      .table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .table th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); padding: 8px 10px; border-bottom: 1px solid var(--line); }
      .table td { padding: 10px 10px; border-bottom: 1px solid var(--line); }
      .table tr:last-child td { border-bottom: none; }
      .muted { color: var(--ink-soft); }
      .row-actions { display: flex; gap: 6px; flex-wrap: wrap; }

      .badge { display: inline-block; padding: 3px 9px; border-radius: 100px; font-size: 10.5px; font-weight: 600; text-transform: capitalize; border: 1px solid; }

      .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 44px 20px; color: var(--ink-soft); text-align: center; background: var(--surface); border: 1px dashed var(--line); border-radius: 12px; }
      .empty-title { font-weight: 600; color: var(--ink); font-size: 14px; }
      .empty-sub { font-size: 12.5px; max-width: 320px; }

      /* ---------- Ads ---------- */
      .ad-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
      .ad-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
      .ad-card-top { display: flex; justify-content: space-between; align-items: center; }
      .ad-card-reward { font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: var(--gold); font-size: 13px; }
      .ad-card-title { font-weight: 600; font-size: 14px; }
      .ad-card-desc { font-size: 12.5px; color: var(--ink-soft); flex: 1; }
      .mute-link { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: var(--ink-soft); font-size: 11px; padding: 2px 0; margin-top: 6px; align-self: flex-start; }
      .mute-link:hover { color: var(--danger); }
      .referral-code { font-family: 'IBM Plex Mono', monospace; font-size: 28px; font-weight: 600; letter-spacing: 0.08em; color: var(--accent); background: var(--surface-2); border: 1px dashed var(--line); border-radius: 10px; padding: 16px; text-align: center; }

      .modal-overlay { position: fixed; inset: 0; background: rgba(9,13,17,0.6); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
      .wishlist-toggle { background: transparent; border: none; padding: 4px; cursor: pointer; display: flex; align-items: center; color: var(--ink-soft); }
      .profile-stats-row { display: flex; gap: 24px; padding: 14px 0; margin: 14px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
      .profile-stat { display: flex; flex-direction: column; align-items: center; background: transparent; border: none; cursor: pointer; padding: 4px 8px; border-radius: 8px; color: var(--ink); }
      .profile-stat.active { background: var(--accent-soft); }
      .profile-stat strong { font-size: 16px; }
      .profile-stat span { font-size: 11px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.04em; }
      .wishlist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
      .wishlist-tile { background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 10px; text-align: center; }
      .wishlist-tile-name { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
      .wishlist-tile-price { font-size: 12px; color: var(--accent); font-family: 'IBM Plex Mono', monospace; }
      .avatar-upload-row { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
      .profile-header-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
      .identity-pill { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 100px; border: none; white-space: nowrap; }
      .identity-pill.verified { background: var(--accent-soft); color: var(--accent); }
      .identity-pill.unverified { background: var(--danger-soft); color: var(--danger); cursor: pointer; }
      .identity-pill.processing { background: rgba(232,196,104,0.15); color: #E8C468; cursor: pointer; }
      .profile-menu-wrap { position: relative; }
      .profile-menu-dropdown { position: absolute; top: calc(100% + 6px); right: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 6px; min-width: 200px; box-shadow: 0 12px 32px rgba(0,0,0,0.4); z-index: 30; }
      .profile-menu-item { display: block; width: 100%; text-align: left; background: transparent; border: none; padding: 9px 10px; border-radius: 6px; font-size: 13px; color: var(--ink); cursor: pointer; }
      .profile-menu-item:hover { background: var(--surface-2); }
      .avatar-upload-btn { position: relative; cursor: pointer; }
      .avatar-upload-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
      .follower-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-top: 1px dashed var(--line); }
      .follower-row:first-child { border-top: none; }
      .follower-row-info { display: flex; align-items: center; gap: 10px; }
      .modal { background: var(--surface); border-radius: 14px; padding: 22px; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
      .modal-head { display: flex; justify-content: space-between; align-items: center; }
      .modal-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-soft); font-weight: 700; }
      .ad-frame { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 18px; }
      .ad-frame-title { font-weight: 700; font-size: 15.5px; margin-bottom: 8px; }
      .ad-frame-body { font-size: 13px; color: var(--ink-soft); margin-bottom: 10px; }
      .ad-frame-cta { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: var(--accent); }
      .attention-check {
        margin-top: 12px; display: inline-flex; align-items: center; gap: 6px; border: none; border-radius: 100px;
        background: var(--pill); color: var(--pill-ink); font-size: 12px; font-weight: 700; padding: 8px 14px;
        animation: pulseCheck 0.9s ease-in-out infinite;
      }
      @keyframes pulseCheck { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(82,227,194,0.5); } 50% { transform: scale(1.04); box-shadow: 0 0 0 6px rgba(82,227,194,0); } }
      .chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .chip { border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-soft); border-radius: 100px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; }
      .chip.active { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
      .verify-challenge { display: flex; flex-direction: column; gap: 10px; }
      .verify-title { font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 6px; color: var(--ink); }
      .verify-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .verify-cell { aspect-ratio: 1; border: 1px solid var(--line); background: var(--surface-2); border-radius: 10px; font-size: 24px; display: flex; align-items: center; justify-content: center; }
      .verify-cell.active { border-color: var(--accent); background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent); }
      .inline-warning { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--danger); background: var(--danger-soft); padding: 8px 10px; border-radius: 8px; }
      .progress-track { height: 8px; background: var(--line); border-radius: 100px; overflow: hidden; }
      .progress-track.thin { height: 5px; margin-top: 8px; }
      .progress-fill { height: 100%; background: var(--accent); transition: width .1s linear; }
      .modal-meta { display: flex; justify-content: space-between; font-size: 12px; color: var(--ink-soft); }

      /* ---------- Plans ---------- */
      .plan-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
      .plan-card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 22px; position: relative; }
      .plan-card.current { border-color: var(--accent); }
      .plan-current-tag { position: absolute; top: -10px; left: 18px; background: var(--accent); color: #06110D; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.05em; }
      .plan-name { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 16px; margin-bottom: 12px; }
      .billing-toggle { display: inline-flex; background: var(--surface-2); border-radius: 100px; padding: 3px; margin-bottom: 14px; }
      .bt { border: none; background: transparent; color: var(--ink-soft); font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 100px; }
      .bt.active { background: var(--pill); color: var(--pill-ink); }
      .plan-price { font-family: 'IBM Plex Mono', monospace; font-size: 26px; font-weight: 600; margin-bottom: 2px; }
      .plan-price-sub { font-size: 11.5px; color: var(--ink-soft); margin-bottom: 10px; }
      .plan-views { font-size: 12.5px; color: var(--ink-soft); margin-bottom: 16px; }
      .plan-divider { height: 1px; background: var(--line); margin: 18px 0 14px; }
      .plan-bullets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
      .plan-bullets li { font-size: 12.5px; color: var(--ink-soft); padding-left: 20px; position: relative; }
      .plan-bullets li::before { content: '✓'; position: absolute; left: 0; color: var(--accent); font-weight: 700; }

      /* ---------- Forms ---------- */
      .inline-form { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
      .inline-form .input { max-width: 220px; }
      .stack-form { display: flex; flex-direction: column; gap: 12px; }
      .stack-form label, .auth-form label { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); }
      .form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
      @media (max-width: 640px) { .form-row { grid-template-columns: 1fr; } }
      .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

      /* ---------- Campaign cards ---------- */
      .camp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
      .camp-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
      .camp-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
      .camp-card-name { font-weight: 700; font-size: 13.5px; }
      .camp-card-title { font-size: 12.5px; color: var(--ink-soft); margin-bottom: 10px; }
      .camp-stats-row { display: flex; justify-content: space-between; font-size: 12px; gap: 8px; }

      .review-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
      .review-row:last-child { border-bottom: none; }

      /* ---------- Toasts ---------- */
      .toast-wrap { position: fixed; bottom: 18px; right: 18px; display: flex; flex-direction: column; gap: 8px; z-index: 100; }
      .toast { display: flex; align-items: center; gap: 8px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink); padding: 10px 14px; border-radius: 10px; font-size: 12.5px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); max-width: 300px; }
      .toast.error { background: var(--danger-soft); border-color: rgba(240,121,107,0.4); color: #FFD9D3; }
    `}</style>
  );
}
