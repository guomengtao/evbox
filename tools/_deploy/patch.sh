#!/bin/bash
set -e

# 1) Patch catalog.js
cat > /Users/Banner/Documents/guomengtao/ev/app-auth/api/admin/catalog.js << 'CATEOF'
// api/admin/catalog.js
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
CATEOF

echo "catalog.js patched"

# 2) Patch vercel.json
cat > /Users/Banner/Documents/guomengtao/ev/app-auth/vercel.json << 'VEOF'
{
  "rewrites": [
    { "source": "/", "destination": "/index.html" },
    { "source": "/go/:slug", "destination": "/api/go?slug=:slug" },
    { "source": "/go/:slug/", "destination": "/api/go?slug=:slug" },
    { "source": "/dl/:file", "destination": "/api/go?dl=:file" },
    { "source": "/my-ip", "destination": "/my-ip.html" },
    { "source": "/ip", "destination": "/my-ip.html" },
    { "source": "/ev-login", "destination": "/ev-login.html" },
    { "source": "/feedback", "destination": "/feedback.html" },
    { "source": "/feedback/", "destination": "/feedback.html" },
    { "source": "/evbox", "destination": "/evbox.html" },
    { "source": "/evbox/", "destination": "/evbox.html" }
  ],
  "redirects": [
    { "source": "/api/notify/ack", "destination": "/api/feedback?kind=ack", "permanent": false },
    { "source": "/api/admin/go-links", "destination": "/api/admin/catalog?kind=go", "permanent": false },
    { "source": "/api/admin/products", "destination": "/api/admin/catalog?kind=products", "permanent": false },
    { "source": "/api/admin/health", "destination": "/api/admin/catalog?kind=health", "permanent": false },
    { "source": "/api/afdian/webhook", "destination": "/api/afdian?kind=webhook", "permanent": false },
    { "source": "/api/afdian/query-orders", "destination": "/api/afdian?kind=query", "permanent": false },
    { "source": "/pages.html", "destination": "/ui-gallery-9.html", "permanent": true },
    { "source": "/pages", "destination": "/ui-gallery-9.html", "permanent": true },
    { "source": "/pages/", "destination": "/ui-gallery-9.html", "permanent": true },
    { "source": "/api/oauth/login", "destination": "/api/oauth", "permanent": false },
    { "source": "/api/oauth/callback", "destination": "/api/oauth", "permanent": false }
  ],
  "crons": [
    {
      "path": "/api/afdian?kind=query",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/admin/catalog?kind=health&section=backup&cron=1",
      "schedule": "0 4 * * *"
    },
    {
      "path": "/api/admin/catalog?kind=health&section=sync&cron=1",
      "schedule": "0 5 * * *"
    },
    {
      "path": "/api/admin/catalog?kind=bandbbs&op=poll&cron=1",
      "schedule": "0 */12 * * *"
    }
  ]
}
VEOF

echo "vercel.json patched"

# 3) Copy bandbbs_lib.js to lib/bandbbs.js
cp /Users/Banner/Documents/guomengtao/ev/evbox/scripts/bandbbs_lib.js /Users/Banner/Documents/guomengtao/ev/app-auth/lib/bandbbs.js
echo "bandbbs.js copied"

# 4) Patch admin-health.js - add default task
python3 << 'PYEOF'
p = '/Users/Banner/Documents/guomengtao/ev/app-auth/lib/admin-health.js'
with open(p, 'r') as f:
    content = f.read()
new_task = '\n  {\n    id: "bandbbs-poll",\n    name: "BandBBS Review Collect & Reward",\n    description: "Poll BandBBS resource reviews every 12h and send reward DMs for new reviews",\n    schedule: "0 */12 * * *",\n    enabled: true,\n    vercelPath: "/api/admin/catalog?kind=bandbbs&op=poll&cron=1",\n    createdAt: Date.now(),\n    updatedAt: Date.now(),\n  },'
idx = content.rfind('  ];')
if idx > 0:
    content = content[:idx] + new_task + '\n' + content[idx:]
    with open(p, 'w') as f:
        f.write(content)
    print('admin-health.js patched OK')
else:
    print('ERROR: could not find closing bracket')
PYEOF

echo ""
echo "=== ALL DONE ==="