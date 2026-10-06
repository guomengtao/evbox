#!/usr/bin/env node
// debug_dm_page.js - Fetch DM compose page after login
var https = require("https");
var url = require("url");

process.env.BANDBBS_EMAIL = "peipeijin@qq.com";
process.env.BANDBBS_PASSWORD = "2023370321030120074";

var BASE_URL = "https://www.bandbbs.cn";
var UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var agent = new https.Agent({ rejectUnauthorized: false });
var cookieJar = "";

function mergeJar(old, sc) {
    if (!sc) return old;
    var arr = old ? old.split("; ").filter(Boolean) : [];
    var list = Array.isArray(sc) ? sc : [sc];
    list.forEach(function(cookieStr) {
        var firstPart = cookieStr.split(";")[0].trim();
        var eq = firstPart.indexOf("=");
        if (eq > 0) {
            var key = firstPart.substring(0, eq);
            arr = arr.filter(function(c) { return !c.startsWith(key + "="); });
            arr.push(key + "=" + firstPart.substring(eq + 1));
        }
    });
    return arr.join("; ");
}

function httpGet(theUrl, referer) {
    return new Promise(function(resolve, reject) {
        var u = url.parse(theUrl);
        var opts = {
            hostname: u.hostname, port: u.port, path: u.path, method: "GET",
            agent: agent,
            headers: { "User-Agent": UA, "Cookie": cookieJar }
        };
        if (referer) opts.headers["Referer"] = referer;
        var req = https.request(opts, function(res) {
            var c = res.headers["set-cookie"];
            if (c) cookieJar = mergeJar(cookieJar, c);
            var body = "";
            res.on("data", function(d) { body += d; });
            res.on("end", function() { resolve({ body: body, statusCode: res.statusCode, headers: res.headers }); });
        });
        req.on("error", reject);
        req.end();
    });
}

function httpPost(theUrl, data, referer) {
    return new Promise(function(resolve, reject) {
        var u = url.parse(theUrl);
        var postData = new URLSearchParams(data).toString();
        var opts = {
            hostname: u.hostname, port: u.port, path: u.path, method: "POST",
            agent: agent,
            headers: {
                "User-Agent": UA,
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(postData),
                "Cookie": cookieJar,
                "Referer": referer || BASE_URL + "/direct-messages/add",
            }
        };
        var req = https.request(opts, function(res) {
            var c = res.headers["set-cookie"];
            if (c) cookieJar = mergeJar(cookieJar, c);
            var body = "";
            res.on("data", function(d) { body += d; });
            res.on("end", function() { resolve({ body: body, statusCode: res.statusCode, headers: res.headers }); });
        });
        req.on("error", reject);
        req.write(postData);
        req.end();
    });
}

function extractToken(html) {
    var m = html.match(/name="_xfToken"\s+value="([^"]+)"/);
    return m ? m[1] : null;
}

async function main() {
    // Login
    var loginPage = await httpGet(BASE_URL + "/login");
    var token = extractToken(loginPage.body);
    var result = await httpPost(BASE_URL + "/login/login", {
        login: process.env.BANDBBS_EMAIL,
        password: process.env.BANDBBS_PASSWORD,
        _xfToken: token,
        _xfRedirect: "/",
        remember: "1",
    }, BASE_URL + "/login");
    if (result.headers.location) {
        await httpGet(result.headers.location, BASE_URL + "/login/login");
    }
    console.log("After login, cookieJar contains xf_user:", cookieJar.indexOf("xf_user") !== -1);

    // Fetch DM page
    var dm = await httpGet(BASE_URL + "/direct-messages/add");

    var logPath = "/Users/Banner/Documents/guomengtao/ev/evbox/scripts/dm_page.log";
    var fs = require("fs");
    var out = [
        "After login, cookieJar contains xf_user: " + (cookieJar.indexOf("xf_user") !== -1),
        "DM page status: " + dm.statusCode,
        "DM page title: " + ((dm.body.match(/<title>([^<]+)<\/title>/) || [])[1] || "(none)"),
        "DM contains data-logged-in=true: " + (dm.body.indexOf('data-logged-in="true"') !== -1),
        "DM body length: " + dm.body.length,
        "DM csrf: " + (extractToken(dm.body) || "(none)"),
        "DM snippet: " + dm.body.slice(0, 300).replace(/\n/g, " ")
    ];
    fs.writeFileSync(logPath, out.join("\n"));
    console.log("WROTE " + logPath);
}

main().catch(function(e) { console.error("Error:", e.message); });