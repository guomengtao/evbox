#!/usr/bin/env node
// bandbbs_test.js — End-to-end test for BandBBS integration
// Tests: login → fetch reviews → send test DM

var bandbbs = require("./bandbbs_lib.js");

// Set credentials from the .env in app-auth
process.env.BANDBBS_EMAIL = "peipeijin@qq.com";
process.env.BANDBBS_PASSWORD = "2023370321030120074";

var TEST_RESOURCE_ID = "7828";
var TEST_DM_RECIPIENT = "peipeijin";
var TEST_DM_TITLE = "Integration Test " + new Date().toISOString().slice(0, 19);
var TEST_DM_BODY = "This is an automated test of the BandBBS integration pipeline.";

async function run() {
    var results = { login: null, reviews: null, dm: null };
    var startTime = Date.now();

    // ── Step 1: Login ──
    console.log("━━━ Step 1: Login ━━━");
    try {
        results.login = await bandbbs.login();
        console.log("Login result:", JSON.stringify(results.login, null, 2));
        if (!results.login.success) {
            console.error("LOGIN FAILED — aborting test");
            summary(results, startTime);
            return;
        }
        console.log("✅ Login OK");
    } catch (e) {
        console.error("Login exception:", e.message);
        summary(results, startTime);
        return;
    }

    // ── Step 2: Fetch Reviews ──
    console.log("\n━━━ Step 2: Fetch Reviews (resource " + TEST_RESOURCE_ID + ") ━━━");
    try {
        results.reviews = await bandbbs.fetchReviews(TEST_RESOURCE_ID);
        var total = results.reviews ? results.reviews.length : 0;
        console.log("Reviews fetched:", total);
        if (total > 0) {
            console.log("First review:", JSON.stringify(results.reviews[0], null, 2));
            console.log("Last review:", JSON.stringify(results.reviews[total - 1], null, 2));
        }
        console.log("✅ FetchReviews OK (" + total + " reviews)");
    } catch (e) {
        console.error("FetchReviews exception:", e.message);
        results.reviews = { error: e.message };
    }

    // ── Step 3: Send Test DM ──
    console.log("\n━━━ Step 3: Send Test DM ━━━");
    console.log("Recipient:", TEST_DM_RECIPIENT);
    console.log("Title:", TEST_DM_TITLE);
    console.log("Body:", TEST_DM_BODY);
    try {
        results.dm = await bandbbs.sendDm(TEST_DM_RECIPIENT, TEST_DM_TITLE, TEST_DM_BODY);
        console.log("DM result:", JSON.stringify(results.dm, null, 2));
        if (results.dm.success) {
            console.log("✅ SendDM OK (conversationId: " + results.dm.conversationId + ")");
        } else {
            console.log("❌ SendDM failed:", results.dm.error);
        }
    } catch (e) {
        console.error("SendDM exception:", e.message);
        results.dm = { error: e.message };
    }

    summary(results, startTime);
}

function summary(results, startTime) {
    var duration = Date.now() - startTime;
    console.log("\n" + "=".repeat(50));
    console.log("TEST SUMMARY (" + duration + "ms)");
    console.log("=".repeat(50));
    console.log("Login:          " + (results.login && results.login.success ? "✅ PASS" : "❌ FAIL"));
    console.log("FetchReviews:   " + (results.reviews && Array.isArray(results.reviews) ? "✅ PASS (" + results.reviews.length + " reviews)" : "❌ FAIL"));
    console.log("SendDM:         " + (results.dm && results.dm.success ? "✅ PASS" : "❌ FAIL"));
    console.log("=".repeat(50));

    if (results.dm && results.dm.success) {
        console.log("\n🎉 All tests passed! The BandBBS integration pipeline is working.");
        console.log("Next: deploy to Vercel and test the cron-based poll+reward flow.");
    } else {
        console.log("\n⚠️  Some tests failed. Check the output above for details.");
    }
}

run().catch(function(e) {
    console.error("Fatal error:", e);
    process.exit(1);
});