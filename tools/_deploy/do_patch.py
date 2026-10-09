#!/usr/bin/env python3
"""BandBBS Integration - Patch script for app-auth project."""
import sys, json

AUTH = '/Users/Banner/Documents/guomengtao/ev/app-auth'

# ── 1) catalog.js ──
catalog_path = AUTH + '/api/admin/catalog.js'
catalog_new = """// api/admin/catalog.js
var goLinks = require("../../lib/admin-go-links.js");
var products = require("../../lib/admin-products.js");
var health = require("../../lib/admin-health.js");
var bandbbs = require("../../lib/bandbbs.js");

module.exports = async (req, res) => {
  var kind = (req.query && req.query.kind) || "";
  if (kind === "go") return goLinks(req, res);
  if (kind === "products") return products(req, res);
  if (kind === "health") return health(req, res);
  if (kind === "bandbbs") return handleBandBBS(req, res);
  return res.status(404).json({ success: false, error: "unknown kind: " + kind });
};

async function handleBandBBS(req, res) {
  var query = (req && req.query) || {};
  var body = (req && req.body) || {};
  var op = query.op || "stats";

  if (op === "send-dm" || op === "config-save" || op === "config-delete" || op === "poll") {
    try {
      var auth = require("../../lib/auth");
      var a = auth.requireAuth(req);
      if (!a || !a.authorized) return res.status(401).json({ success: false, error: "unauthorized" });
    } catch (e) {}
  }

  try {
    var redis, result, ids, rid, title;
    switch (op) {
      case "stats":
        result = await bandbbs.getStats(require("../../lib/redis"));
        return res.json({ success: true, data: result });
      case "poll":
        ids = null;
        if (query.resources) ids = String(query.resources).split(",").filter(function(s) { return s; });
        result = await bandbbs.pollAndReward(require("../../lib/redis"), ids);
        return res.json(result);
      case "send-dm":
        if (!body.recipient || !body.title || !body.message) {
          return res.status(400).json({ success: false, error: "missing recipient/title/message" });
        }
        result = await bandbbs.sendDm(body.recipient, body.title, body.message);
        return res.json(result);
      case "config":
        result = await bandbbs.getConfig(require("../../lib/redis"));
        return res.json({ success: true, data: result });
      case "config-save":
        rid = query.resourceId || body.resourceId || "";
        title = body.title || "";
        if (!rid) return res.status(400).json({ success: false, error: "missing resourceId" });
        result = await bandbbs.saveConfig(require("../../lib/redis"), rid, { title: title, enabled: true });
        return res.json({ success: true, data: result });
      case "config-delete":
        rid = query.resourceId || "";
        if (!rid) return res.status(400).json({ success: false, error: "missing resourceId" });
        await bandbbs.deleteConfig(require("../../lib/redis"), rid);
        return res.json({ success: true });
      default:
        return res.status(400).json({ success: false, error: "unknown op: " + op });
    }
  } catch (e) {
    console.error("[bandbbs] error:", e);
    return res.status(500).json({ success: false, error: e.message || String(e) });
  }
}
"""

with open(catalog_path, 'w') as f:
    f.write(catalog_new)
print("catalog.js: written")

# ── 2) vercel.json ──
vercel_path = AUTH + '/vercel.json'
with open(vercel_path, 'r') as f:
    vercel = json.load(f)
# Add bandbbs cron
vercel['crons'].append({
    "path": "/api/admin/catalog?kind=bandbbs&op=poll&cron=1",
    "schedule": "0 */12 * * *"
})
with open(vercel_path, 'w') as f:
    json.dump(vercel, f, indent=2, ensure_ascii=False)
print("vercel.json: updated with bandbbs cron")

# ── 3) admin-health.js ──
health_path = AUTH + '/lib/admin-health.js'
with open(health_path, 'r') as f:
    content = f.read()

new_task = '''
  {
    id: "bandbbs-poll",
    name: "BandBBS Review Collect & Reward",
    description: "Poll BandBBS resource reviews every 12h and send reward DMs for new reviews",
    schedule: "0 */12 * * *",
    enabled: true,
    vercelPath: "/api/admin/catalog?kind=bandbbs&op=poll&cron=1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },'''

idx = content.rfind('  ];')
if idx > 0:
    content = content[:idx] + new_task + '\n' + content[idx:]
    with open(health_path, 'w') as f:
        f.write(content)
    print("admin-health.js: bandbbs-poll task added")
else:
    print("ERROR: Could not find closing bracket in admin-health.js")
    sys.exit(1)

print("\nAll patches applied successfully!")