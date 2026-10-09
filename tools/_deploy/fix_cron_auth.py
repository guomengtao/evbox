#!/usr/bin/env python3
"""Fix catalog.js to allow cron-based poll with CRON_SECRET bypass."""
TARGET = '/Users/Banner/Documents/guomengtao/ev/app-auth/api/admin/catalog.js'

with open(TARGET, 'r') as f:
    content = f.read()

OLD = """  if (op === "send-dm" || op === "config-save" || op === "config-delete" || op === "poll") {
    try {
      var auth = require("../../lib/auth");
      var a = auth.requireAuth(req);
      if (!a || !a.authorized) return res.status(401).json({ success: false, error: "unauthorized" });
    } catch (e) {}
  }"""

NEW = """  var isCronCall = (query.cron === "1" || query.cron === "true");
  var cronSecret = process.env.CRON_SECRET || "";

  if (op === "send-dm" || op === "config-save" || op === "config-delete" || op === "poll") {
    // Allow cron calls with valid CRON_SECRET
    if (isCronCall && cronSecret) {
      var cronAuth = req.headers.authorization || req.headers.Authorization || "";
      if (cronAuth !== "Bearer " + cronSecret) {
        return res.status(401).json({ success: false, error: "unauthorized cron" });
      }
    } else {
      try {
        var auth = require("../../lib/auth");
        var a = auth.requireAuth(req);
        if (!a || !a.authorized) return res.status(401).json({ success: false, error: "unauthorized" });
      } catch (e) {}
    }
  }"""

if OLD in content:
    content = content.replace(OLD, NEW)
    with open(TARGET, 'w') as f:
        f.write(content)
    print('OK: catalog.js updated with cron auth bypass')
else:
    print('FAIL: old string not found')