const jwt = require("jsonwebtoken");

const SECRET = process.env.SESSION_SECRET || "adspxce-dev-secret-change-me-in-production";
const COOKIE_NAME = "adspxce_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function setSessionCookie(res, userId) {
  const token = jwt.sign({ uid: userId }, SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_MS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function getUserIdFromReq(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, SECRET);
    return payload.uid || null;
  } catch (e) {
    return null;
  }
}

module.exports = { setSessionCookie, clearSessionCookie, getUserIdFromReq };
