/** 内存速率限制器：按 key 滑动窗口计数，防爆破/刷接口 */
class RateLimiter {
  constructor() {
    this.buckets = new Map();
  }

  // 允许则返回 true；超限返回 false
  check(key, limit, windowMs) {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || now - b.start > windowMs) {
      this.buckets.set(key, { start: now, count: 1 });
      return true;
    }
    b.count += 1;
    if (b.count > limit) return false;
    return true;
  }

  reset(key) {
    this.buckets.delete(key);
  }
}

module.exports = { RateLimiter };
