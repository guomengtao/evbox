#!/usr/bin/env node
// run_bandbbs_dm.js - Test DM send and write results to a file
var fs = require("fs");
var bandbbs = require("./bandbbs_lib.js");
var os = require("os");

process.env.BANDBBS_EMAIL = "peipeijin@qq.com";
process.env.BANDBBS_PASSWORD = "2023370321030120074";

var outPath = process.env.BANDBBS_RESULT_FILE || "/Users/Banner/Documents/guomengtao/ev/evbox/bandbbs_dm_result.json";

function log(s) { console.log(s); }

async function run() {
    var output = { timestamp: new Date().toISOString(), steps: {} };

    // Step 1: login
    log("Step 1: login...");
    output.steps.login = await bandbbs.login();
    log("login.success = " + output.steps.login.success);

    // Step 2: send DM
    log("Step 2: sendDm...");
    output.steps.dm = await bandbbs.sendDm(
        process.env.BANDBBS_DM_TO || "peipeijin",
        process.env.BANDBBS_DM_TITLE || "Test Reward DM",
        process.env.BANDBBS_DM_BODY || "Fast startup my friend. Hope you like it."
    );
    log("dm.success = " + output.steps.dm.success + " conversationId = " + (output.steps.dm.conversationId || ""));

    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    log("RESULT WROTE to " + outPath);
}

run().catch(function(e) {
    fs.writeFileSync(outPath, JSON.stringify({ fatal: e.message, stack: e.stack }, null, 2));
    console.error("FATAL: " + e.message);
});