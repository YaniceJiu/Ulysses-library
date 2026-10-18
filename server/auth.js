/** 管理员认证：密码登录签发 HMAC token，常量时间比较防时序攻击 */
const crypto = require('crypto');

function makeAuth(config) {
  const secret = config.authSecret || 'mc-walkthrough-secret';

  function tokenFor(name) {
    const payload = JSON.stringify({ name, exp: Date.now() + 24 * 3600 * 1000 });
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(payload).toString('base64url') + '.' + sig;
  }

  function verify(token) {
    try {
      const parts = String(token || '').split('.');
      if (parts.length !== 2) return false;
      const [b64, sig] = parts;
      const payload = Buffer.from(b64, 'base64url').toString('utf-8');
      const expect = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const a = Buffer.from(sig);
      const b = Buffer.from(expect);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
      const data = JSON.parse(payload);
      return Date.now() < data.exp;
    } catch (e) {
      return false;
    }
  }

  // 成功返回 token，失败返回 null
  function login(password) {
    const a = Buffer.from(String(password || ''), 'utf-8');
    const b = Buffer.from(String(config.adminPassword || ''), 'utf-8');
    if (a.length !== b.length) return null;
    return crypto.timingSafeEqual(a, b) ? tokenFor('admin') : null;
  }

  return { login, verify };
}

module.exports = { makeAuth };
