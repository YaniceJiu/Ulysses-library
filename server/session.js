const crypto = require('crypto');

const COOKIE_NAME = 'mcwt_session';

function createSessionAuth(secret) {
  function issue(user) {
    const payload = Buffer.from(JSON.stringify({
      id: user.id,
      username: user.username,
      role: user.role,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return payload + '.' + signature;
  }

  function read(token) {
    try {
      const [payload, signature, ...extra] = String(token || '').split('.');
      if (!payload || !signature || extra.length) return null;
      const expected = crypto.createHmac('sha256', secret).update(payload).digest();
      const received = Buffer.from(signature, 'base64url');
      if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
      const user = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (!user.id || !user.username || !['player', 'admin'].includes(user.role) || Date.now() >= user.exp) return null;
      return user;
    } catch {
      return null;
    }
  }

  return { issue, read };
}

function cookieToken(header) {
  const pair = String(header || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(COOKIE_NAME + '='));
  if (!pair) return '';
  try { return decodeURIComponent(pair.slice(COOKIE_NAME.length + 1)); }
  catch { return ''; }
}

function setSessionCookie(res, token, secure) {
  res.setHeader('Set-Cookie',
    COOKIE_NAME + '=' + encodeURIComponent(token) +
    '; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000' + (secure ? '; Secure' : ''));
}

function clearSessionCookie(res, secure) {
  res.setHeader('Set-Cookie',
    COOKIE_NAME + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + (secure ? '; Secure' : ''));
}

module.exports = { createSessionAuth, cookieToken, setSessionCookie, clearSessionCookie, COOKIE_NAME };
