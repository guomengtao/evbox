#!/usr/bin/env node
// debug_dm.js - Inspect DM compose page after login
var bandbbs = require("./bandbbs_lib.js");

process.env.BANDBBS_EMAIL = "peipeijin@qq.com";
process.env.BANDBBS_PASSWORD = "2023370321030120074";

async function main() {
    var loginResult = await bandbbs.login();
    console.log("login:", JSON.stringify(loginResult));

    // Need access to internal page fetch. Reimplement minimal check via the lib's httpGet.
    // Instead, print which parts the login check uses.
    console.log("done");
}

main();