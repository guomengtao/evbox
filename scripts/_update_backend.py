import re

# ============================
# File 1: lib/bandbbs.js - Add reward pool functions
# ============================
bandbbs_path = '/Users/Banner/Documents/guomengtao/ev/app-auth/lib/bandbbs.js'
with open(bandbbs_path, 'r', encoding='utf-8') as f:
    s = f.read()

# New reward pool functions to insert before module.exports
new_funcs = r'''
// ── 7) Reward Pool Management ──

// Get/set reward DM template
async function getRewardTemplate(redis) {
    var tpl = await redis.get(REDIS_PREFIX + "reward:template");
    return tpl || "Thank you for your 5-star review! Here is a free EV Schedule Pro as a gift. Click the link to claim on Aifadian:";
}

async function saveRewardTemplate(redis, template) {
    await redis.set(REDIS_PREFIX + "reward:template", template);
    return { success: true };
}

// Import reward links: each line is one afdian redeem URL
async function importRewardLinks(redis, linksText) {
    if (!linksText || !linksText.trim()) {
        return { success: false, error: "no links provided" };
    }
    var lines = linksText.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l; });
    if (!lines.length) {
        return { success: false, error: "no valid links found" };
    }

    var imported = 0;
    var skipped = 0;
    var errors = [];

    for (var i = 0; i < lines.length; i++) {
        var link = lines[i];
        var codeMatch = link.match(/\/redeem\/([a-zA-Z0-9]+)/);
        if (!codeMatch) {
            errors.push("Line " + (i + 1) + ": invalid redeem URL format - " + link.substring(0, 60));
            continue;
        }
        var couponCode = codeMatch[1];

        var existing = await redis.hget(REDIS_PREFIX + "reward:pool", couponCode);
        if (existing) {
            skipped++;
            continue;
        }

        var goSlug = "evpro-" + couponCode;
        var goUrl = "https://evbox.cc/go/" + goSlug;

        var goEntry = {
            target_url: link,
            enabled: true,
            name_zh: "EV Pro Reward " + couponCode.substring(0, 8),
            name_en: "EV Pro Reward " + couponCode.substring(0, 8),
            note: "Auto-generated from reward pool import"
        };
        var goStore = {};
        goStore[goSlug] = JSON.stringify(goEntry);
        await redis.hset("go:mapping", goStore);

        var rewardEntry = {
            couponCode: couponCode,
            redeemUrl: link,
            goSlug: goSlug,
            goUrl: goUrl,
            assigned: false,
            assignedTo: null,
            assignedFor: null,
            assignedAt: null,
            resourceId: null,
            reviewStars: null,
            reviewContent: null,
            claimed: false,
            claimedAt: null
        };
        var store = {};
        store[couponCode] = JSON.stringify(rewardEntry);
        await redis.hset(REDIS_PREFIX + "reward:pool", store);

        imported++;
    }

    return {
        success: true,
        imported: imported,
        skipped: skipped,
        errors: errors,
        total: imported + skipped
    };
}

// Get reward pool stats
async function getRewardPoolStats(redis) {
    var pool = await redis.hgetall(REDIS_PREFIX + "reward:pool");
    pool = pool || {};
    var total = Object.keys(pool).length;
    var assigned = 0;
    var claimed = 0;
    for (var k in pool) {
        if (!pool.hasOwnProperty(k)) continue;
        try {
            var entry = JSON.parse(pool[k]);
            if (entry.assigned) assigned++;
            if (entry.claimed) claimed++;
        } catch (e) {}
    }
    return {
        success: true,
        data: {
            total: total,
            assigned: assigned,
            claimed: claimed,
            remaining: total - assigned
        }
    };
}

// Get reward distribution log
async function getRewardLog(redis, resourceId, statusFilter, limit) {
    var n = limit || 100;
    var pool = await redis.hgetall(REDIS_PREFIX + "reward:pool");
    pool = pool || {};

    var entries = [];
    var keys = Object.keys(pool);
    for (var i = 0; i < keys.length; i++) {
        try {
            var entry = JSON.parse(pool[keys[i]]);
            if (!entry.assigned) continue;
            entries.push(entry);
        } catch (e) {}
    }

    if (resourceId) {
        entries = entries.filter(function(e) { return String(e.resourceId) === String(resourceId); });
    }
    if (statusFilter === "claimed") {
        entries = entries.filter(function(e) { return e.claimed; });
    } else if (statusFilter === "unclaimed") {
        entries = entries.filter(function(e) { return !e.claimed; });
    }

    entries.sort(function(a, b) { return (b.assignedAt || "").localeCompare(a.assignedAt || ""); });

    return {
        success: true,
        data: entries.slice(0, n)
    };
}

// Send rewards for a specific resource using pool links
async function sendRewards(redis, resourceId, testMode) {
    if (!resourceId) return { success: false, error: "missing resourceId" };

    var configs = await getConfig(redis);
    var cfg = null;
    for (var i = 0; i < configs.length; i++) {
        if (configs[i].resourceId === resourceId) { cfg = configs[i]; break; }
    }
    if (!cfg) return { success: false, error: "resource not configured: " + resourceId };

    var reviews = await redis.hgetall(REDIS_PREFIX + "reviews:" + resourceId);
    reviews = reviews || {};
    var rewarded = await redis.hgetall(REDIS_PREFIX + "rewarded:" + resourceId);
    rewarded = rewarded || {};

    var pool = await redis.hgetall(REDIS_PREFIX + "reward:pool");
    pool = pool || {};

    var availableLinks = [];
    var poolKeys = Object.keys(pool);
    for (var j = 0; j < poolKeys.length; j++) {
        try {
            var pe = JSON.parse(pool[poolKeys[j]]);
            if (!pe.assigned) availableLinks.push({ key: poolKeys[j], entry: pe });
        } catch (e) {}
    }

    var eligible = [];
    var reviewKeys = Object.keys(reviews);
    for (var k = 0; k < reviewKeys.length; k++) {
        try {
            var rv = JSON.parse(reviews[reviewKeys[k]]);
            var stars = rv.stars;
            if (typeof stars === "string") stars = (stars.match(/★/g) || []).length;
            if (Number(stars) >= 5 && !rewarded[rv.username]) {
                eligible.push({ key: reviewKeys[k], review: rv });
            }
        } catch (e) {}
    }

    if (!eligible.length) {
        return { success: true, sent: 0, skipped: 0, errors: 0, message: "no eligible 5-star unrewarded reviews" };
    }

    if (!availableLinks.length) {
        return { success: false, error: "no available reward links in pool", notEnough: eligible.length };
    }

    var template = await getRewardTemplate(redis);
    var sentCount = 0;
    var skippedCount = 0;
    var errorCount = 0;

    for (var r = 0; r < eligible.length; r++) {
        if (r >= availableLinks.length) {
            skippedCount = eligible.length - r;
            break;
        }

        var el = eligible[r];
        var linkItem = availableLinks[r];
        var reviewer = el.review;
        var couponEntry = linkItem.entry;

        var dmTitle = "Thanks for your 5-star review!";
        var dmMessage = template + "\\n" + couponEntry.goUrl;

        var recipient = testMode ? TEST_RECIPIENT : reviewer.username;

        try {
            var dmResult = await sendDm(recipient, dmTitle, dmMessage);
            if (dmResult.success) {
                couponEntry.assigned = true;
                couponEntry.assignedTo = reviewer.username;
                couponEntry.assignedFor = el.key;
                couponEntry.assignedAt = new Date().toISOString();
                couponEntry.resourceId = resourceId;
                couponEntry.reviewStars = reviewer.stars;
                couponEntry.reviewContent = (reviewer.content || "").substring(0, 100);
                if (testMode) {
                    couponEntry.testMode = true;
                }
                var poolStore = {};
                poolStore[linkItem.key] = JSON.stringify(couponEntry);
                await redis.hset(REDIS_PREFIX + "reward:pool", poolStore);

                var rewardRecord = {
                    dm_sent_at: new Date().toISOString(),
                    conv_id: dmResult.conversationId,
                    conv_url: dmResult.conversationUrl,
                    test_mode: testMode,
                    actual_recipient: reviewer.username,
                    coupon_code: couponEntry.couponCode,
                    go_url: couponEntry.goUrl
                };
                var storeReward = {};
                storeReward[reviewer.username] = JSON.stringify(rewardRecord);
                await redis.hset(REDIS_PREFIX + "rewarded:" + resourceId, storeReward);

                sentCount++;
            } else {
                errorCount++;
            }
        } catch (e) {
            errorCount++;
        }
    }

    if (eligible.length > availableLinks.length) {
        return {
            success: true,
            sent: sentCount,
            skipped: 0,
            errors: errorCount,
            notEnough: eligible.length - availableLinks.length
        };
    }

    return {
        success: true,
        sent: sentCount,
        skipped: skippedCount,
        errors: errorCount
    };
}
'''

# Find the module.exports block and insert new functions before it
exports_start = s.rfind('module.exports = {')
if exports_start < 0:
    print("ERROR: module.exports not found in bandbbs.js")
else:
    # Find the line before module.exports (the deleteConfig function end)
    # Find deleteConfig function
    delete_config_idx = s.rfind('async function deleteConfig', 0, exports_start)
    if delete_config_idx < 0:
        print("ERROR: deleteConfig not found")
    else:
        # Find the closing } of deleteConfig (the one right before module.exports)
        # Simplest: find the return / closing of deleteConfig
        # Look for "return { deleted: true };" then "}"
        dc_return = s.rfind('return { deleted: true }', delete_config_idx, exports_start)
        # Find the next } after the return
        dc_close = s.find('\n}', dc_return) if dc_return > 0 else -1
        # Actually, deleteConfig ends at the line with just `}` right before the empty line
        # Let's find the pattern: `\n}\n\nmodule.exports`
        dc_end = s.rfind('\n}\n\nmodule.exports', delete_config_idx, exports_start + len('module.exports = {') + 5)
        if dc_end >= 0:
            insert_pos = dc_end + 2  # after `\n}`
            new_s = s[:insert_pos] + '\n' + new_funcs + '\n' + s[insert_pos:]
            
            # Add new exports to module.exports
            old_exports = '    deleteConfig: deleteConfig,\n    BASE_URL: BASE_URL,'
            new_exports = '    deleteConfig: deleteConfig,\n    getRewardTemplate: getRewardTemplate,\n    saveRewardTemplate: saveRewardTemplate,\n    importRewardLinks: importRewardLinks,\n    getRewardPoolStats: getRewardPoolStats,\n    getRewardLog: getRewardLog,\n    sendRewards: sendRewards,\n    BASE_URL: BASE_URL,'
            new_s = new_s.replace(old_exports, new_exports)
            
            with open(bandbbs_path, 'w', encoding='utf-8') as f:
                f.write(new_s)
            print("OK: bandbbs.js updated")
        else:
            print("ERROR: could not find deleteConfig end pattern")

# ============================
# File 2: api/admin/catalog.js - Add reward pool API ops
# ============================
catalog_path = '/Users/Banner/Documents/guomengtao/ev/app-auth/api/admin/catalog.js'
with open(catalog_path, 'r', encoding='utf-8') as f:
    cs = f.read()

# Add op auth checks
old_auth = 'if (op === "send-dm" || op === "config-save" || op === "config-delete" || op === "poll" || op === "single-poll") {'
new_auth = 'if (op === "send-dm" || op === "config-save" || op === "config-delete" || op === "poll" || op === "single-poll" || op === "send-rewards" || op === "reward-pool-import" || op === "reward-pool-save-template") {'
cs = cs.replace(old_auth, new_auth)

# Add new ops to the switch statement, before the default case
old_default = '      default:\n        return res.status(400).json({ success: false, error: "unknown op: " + op });'
new_ops = '''      case "send-rewards":
        rid = query.resourceId || body.resourceId || "";
        if (!rid) return res.status(400).json({ success: false, error: "missing resourceId" });
        result = await bandbbs.sendRewards(require("../../lib/redis"), rid, TEST_MODE);
        return res.json(result);
      case "reward-pool-import":
        var linksText = body.links || "";
        result = await bandbbs.importRewardLinks(require("../../lib/redis"), linksText);
        return res.json(result);
      case "reward-pool-stats":
        result = await bandbbs.getRewardPoolStats(require("../../lib/redis"));
        return res.json(result);
      case "reward-log":
        var logResourceId = query.resourceId || "";
        var logStatus = query.status || "";
        result = await bandbbs.getRewardLog(require("../../lib/redis"), logResourceId, logStatus);
        return res.json(result);
      case "reward-pool-save-template":
        var tpl = body.template || "";
        result = await bandbbs.saveRewardTemplate(require("../../lib/redis"), tpl);
        return res.json(result);
      case "reward-pool-get-template":
        result = await bandbbs.getRewardTemplate(require("../../lib/redis"));
        return res.json({ success: true, template: result });
      default:
        return res.status(400).json({ success: false, error: "unknown op: " + op });'''

cs = cs.replace(old_default, new_ops)

with open(catalog_path, 'w', encoding='utf-8') as f:
    f.write(cs)
print("OK: catalog.js updated")

print("All backend updates complete!")