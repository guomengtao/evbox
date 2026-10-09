/**
 * lib/bandbbs.js unit test (mock redis)
 * Run: node /Users/Banner/Documents/guomengtao/ev/evbox/test-bandbbs.js
 */
const path = require('path');

const BB = '/Users/Banner/Documents/guomengtao/ev/app-auth/lib/bandbbs.js';
const bb = require(BB);

const REDIS_PREFIX = 'bandbbs:';
let pass = 0;
const fails = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fails.push(name); console.log('FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

function makeRedis(seed) {
  const store = {};
  const lists = {};
  if (seed) {
    for (const k of Object.keys(seed)) {
      const obj = seed[k];
      const kv = {};
      for (const f of Object.keys(obj)) kv[f] = typeof obj[f] === 'string' ? obj[f] : JSON.stringify(obj[f]);
      store[k] = kv;
    }
  }
  return {
    _getStore: () => store,
    _getLists: () => lists,
    hget: async (key, field) => (store[key] || {})[field],
    hgetall: async (key) => store[key] || {},
    hset: async (key, obj) => { store[key] = Object.assign({}, store[key] || {}, obj); return 1; },
    hdel: async (key, field) => { if (store[key]) delete store[key][field]; return 1; },
    lpush: async (key, val) => { lists[key] = lists[key] || []; lists[key].unshift(val); return lists[key].length; },
    lrange: async (key, start, stop) => {
      const arr = lists[key] || [];
      const s = start < 0 ? Math.max(0, arr.length + start) : start;
      const e = stop < 0 ? arr.length + stop : stop;
      return arr.slice(s, Math.min(arr.length - 1, e) + 1);
    },
    ltrim: async (key, s, e) => {
      const arr = lists[key] || [];
      const ns = s < 0 ? Math.max(0, arr.length + s) : s;
      const ne = e < 0 ? arr.length + e : e;
      lists[key] = arr.slice(ns, Math.min(arr.length - 1, ne) + 1);
      return 1;
    },
  };
}

const configHash = () => REDIS_PREFIX + 'resource:config';

(async () => {
  // 1. saveConfig / getConfig / deleteConfig
  {
    const redis = makeRedis();
    const saved = await bb.saveConfig(redis, '7828', { title: 'My Resource' });
    check('saveConfig enabled defaults true', saved && saved.enabled === true, JSON.stringify(saved));
    check('saveConfig keeps custom title', saved && saved.title === 'My Resource', saved && saved.title);
    check('saveConfig sets resourceId', saved && saved.resourceId === '7828', saved && saved.resourceId);
    check('saveConfig writes hset', !!redis._getStore()[configHash()]['7828']);

    const configs = await bb.getConfig(redis);
    check('getConfig returns 1', Array.isArray(configs) && configs.length === 1, configs.length);
    check('getConfig injects resourceId', configs[0] && configs[0].resourceId === '7828');

    await bb.deleteConfig(redis, '7828');
    const after = await bb.getConfig(redis);
    check('deleteConfig empties list', Array.isArray(after) && after.length === 0, after.length);
  }

  // 2. getConfig skips corrupted JSON
  {
    const redis = makeRedis({ [configHash()]: { bad: 'not-json{', good: JSON.stringify({ title: 'x' }) } });
    const configs = await bb.getConfig(redis);
    const ids = configs.map((c) => c.resourceId);
    check('getConfig skips bad JSON', configs.length === 1 && ids[0] === 'good', JSON.stringify(ids));
  }

  // 3. getPollLogs parses stored JSON entries, preserves order
  {
    const redis = makeRedis();
    const entryA = { at: '2026-01-01T00:00:00Z', mode: 'manual', resources: [{ resourceId: '7828' }], newReviews: 2, rewardsSent: 1 };
    const entryB = { at: '2026-01-02T00:00:00Z', mode: 'cron', resources: [{ resourceId: '7830' }], newReviews: 4, rewardsSent: 3 };
    await redis.lpush('bandbbs:poll-log', JSON.stringify(entryA));
    await redis.lpush('bandbbs:poll-log', JSON.stringify(entryB)); // pushed first => ends up first (newest)

    const logs = await bb.getPollLogs(redis, 50);
    check('getPollLogs parses entries', Array.isArray(logs) && logs.length === 2, logs.length);
    check('getPollLogs keeps order (newest first)', logs[0].mode === 'cron' && logs[1].mode === 'manual', logs.map((l) => l.mode).join(','));
    check('getPollLogs has rewardsSent', logs[0].rewardsSent === 3);
    check('getPollLogs has resources', logs[1].resources[0].resourceId === '7828');

    const one = await bb.getPollLogs(redis, 1);
    check('getPollLogs limit works', one.length === 1, one.length);
  }

  // 4. getPollLogs tolerates corrupted JSON entries
  {
    const redis = makeRedis();
    await redis.lpush('bandbbs:poll-log', 'not-json{');
    await redis.lpush('bandbbs:poll-log', JSON.stringify({ mode: 'manual', resources: [] }));
    const logs = await bb.getPollLogs(redis, 50);
    check('getPollLogs skips bad entries', logs.length === 1 && logs[0].mode === 'manual', logs.length);
  }

  // 5. getResourceDetail decorates reward status, sorted desc
  {
    const seed = {};
    seed[REDIS_PREFIX + 'resource:config'] = { 7828: JSON.stringify({ title: 'T' }) };
    seed[REDIS_PREFIX + 'reviews:7828'] = {
      u1: JSON.stringify({ username: 'u1', rating: 5, time: '2026-01-01', content: 'a' }),
      u2: JSON.stringify({ username: 'u2', rating: 3, time: '2026-02-01', content: 'b' }),
    };
    seed[REDIS_PREFIX + 'rewarded:7828'] = { u1: JSON.stringify({ sentAt: '2026-01-02' }) };
    const redis = makeRedis(seed);
    const detail = await bb.getResourceDetail(redis, '7828');
    check('detail success', detail && detail.success === true);
    check('detail desc order (new first)', detail.data.reviews[0].username === 'u2', detail.data.reviews.map((r) => r.username).join(','));
    const u1 = detail.data.reviews.find((r) => r.username === 'u1');
    const u2 = detail.data.reviews.find((r) => r.username === 'u2');
    check('detail u1 rewarded true', u1 && u1.rewarded === true);
    check('detail u2 rewarded false', u2 && u2.rewarded === false);
    check('detail rewardedCount', detail.data.rewardedCount === 1);
    check('detail keeps rating', u1 && u1.rating === 5);
    check('detail keeps content', u2 && u2.content === 'b');
  }

  // 6. getResourceDetail unknown resource
  {
    const redis = makeRedis();
    const r = await bb.getResourceDetail(redis, '9999');
    check('unknown resource returns error', r && r.success === false && /not configured/.test(r.error), JSON.stringify(r));
  }

  // 7. getStats rollup
  {
    const seed = {};
    seed[REDIS_PREFIX + 'resource:config'] = {
      7828: JSON.stringify({ title: 'A', enabled: true, lastPollAt: '2026-01-01' }),
      7830: JSON.stringify({ title: 'B', enabled: true, lastPollAt: '2026-01-02' }),
    };
    seed[REDIS_PREFIX + 'reviews:7828'] = { r1: JSON.stringify({ username: 'x', time: '2026-01-01' }) };
    seed[REDIS_PREFIX + 'rewarded:7828'] = { r1: JSON.stringify({}) };
    const redis = makeRedis(seed);
    const stats = await bb.getStats(redis);
    check('stats 2 resources', Array.isArray(stats.resources) && stats.resources.length === 2, stats.resources.length);
    check('stats totalReviews', stats.totalReviews === 1, stats.totalReviews);
    check('stats totalRewarded', stats.totalRewarded === 1, stats.totalRewarded);
    check('stats latest lastPoll', stats.lastPoll === '2026-01-02', stats.lastPoll);
    check('stats recentReviews', stats.resources[0].recentReviews.length === 1);
  }

  // 8. exports BASE_URL
  check('exports BASE_URL', typeof bb.BASE_URL === 'string' && bb.BASE_URL.length > 0);

  console.log('\n--- RESULT ---');
  console.log(fails.length === 0 ? 'ALL PASSED' : fails.length + ' FAILED', '(' + pass + ' passed)');
  process.exit(fails.length === 0 ? 0 : 1);
})();