#!/usr/bin/env node
// debug_login.js — Debug BandBBS login response
var https = require("https");
var url = require("url");

process.env.BANDBBS_EMAIL = "peipeijin@qq.com";
process.env.BANDBBS_PASSWORD = "2023370321030120074";

var BASE_URL = "https://www.bandbbs.cn";
var UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var agent = new https.Agent({ rejectUnauthorized: false });
var cookieJar = "";

function httpGet(theUrl) {
    return new Promise(function(resolve, reject) {
        var u = url.parse(theUrl);
        var opts = {
            hostname: u.hostname, port: u.port, path: u.path, method: "GET",
            agent: agent,
            headers: { "User-Agent": UA, "Cookie": cookieJar }
        };
        var req = https.request(opts, function(res) {
            var c = res.headers["set-cookie"];
            if (c) cookieJar = mergeJar(cookieJar, c);
            var body = "";
            res.on("data", function(d) { body += d; });
            res.on("end", function() {
                resolve({ body: body, statusCode: res.statusCode, headers: res.headers });
            });
        });
        req.on("error", reject);
        req.end();
    });
}

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

function extractToken(html) {
    var m = html.match(/name="_xfToken"\s+value="([^"]+)"/);
    return m ? m[1] : null;
}

async function main() {
    // Step 1: GET login page
    console.log("=== GET /login ===");
    var loginPage = await httpGet(BASE_URL + "/login");
    console.log("Status:", loginPage.statusCode);
    console.log("Cookie:", cookieJar.slice(0, 200));
    var token = extractToken(loginPage.body);
    console.log("CSRF Token:", token);
    
    // Step 2: POST login
    console.log("\n=== POST /login/login ===");
    var postData = new URLSearchParams({
        login: process.env.BANDBBS_EMAIL,
        password: process.env.BANDBBS_PASSWORD,
        _xfToken: token || "",
        _xfRedirect: "/",
        remember: "1",
    }).toString();

    var u2 = url.parse(BASE_URL + "/login/login");
    var postPromise = new Promise(function(resolve, reject) {
        var req = https.request({
            hostname: u2.hostname, port: u2.port, path: u2.path, method: "POST",
            agent: agent,
            headers: {
                "User-Agent": UA,
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(postData),
                "Cookie": cookieJar,
                "Referer": BASE_URL + "/login",
            }
        }, function(res) {
            var c = res.headers["set-cookie"];
            if (c) cookieJar = mergeJar(cookieJar, c);
            var body = "";
            res.on("data", function(d) { body += d; });
            res.on("end", function() {
                resolve({ body: body, statusCode: res.statusCode, headers: res.headers });
            });
        });
        req.on("error", reject);
        req.write(postData);
        req.end();
    });

    var result = await postPromise;
    console.log("Status:", result.statusCode);
    console.log("Location:", result.headers.location || "(none)");
    console.log("Set-Cookie:", (result.headers["set-cookie"] || "").toString().slice(0, 200));
    console.log("Body length:", result.body.length);
    console.log("Body preview:", result.body.slice(0, 1000));
    console.log("Has data-logged-in:", result.body.indexOf('data-logged-in="true"') !== -1);
    console.log("Cookie now:", cookieJar.slice(0, 200));

    // Step 3: Follow redirect if present
    if (result.headers.location) {
        console.log("\n=== Following redirect to:", result.headers.location, "===");
        var u3 = url.parse(result.headers.location);
        var followPromise = new Promise(function(resolve, reject) {
            var req = https.request({
                hostname: u3.hostname || u2.hostname,
                port: u3.port || u2.port,
                path: u3.path || result.headers.location,
                method: "GET",
                agent: agent,
                headers: { "User-Agent": UA, "Cookie": cookieJar, "Referer": BASE_URL + "/login/login" }
            }, function(res) {
                var c2 = res.headers["set-cookie"];
                if (c2) { if (Array.isArray(c2)) c2 = c2.join("; "); cookieJar = mergeJar(cookieJar, c2); }
                var body2 = "";
                res.on("data", function(d) { body2 += d; });
                res.on("end", function() {
                    resolve({ body: body2, statusCode: res.statusCode, headers: res.headers });
                });
            });
            req.on("error", reject);
            req.end();
        });
        var redirect = await followPromise;
        console.log("Status:", redirect.statusCode);
        console.log("Body length:", redirect.body.length);
        console.log("Has data-logged-in:", redirect.body.indexOf('data-logged-in="true"') !== -1);
        console.log("Has logout link:", redirect.body.indexOf("logout") !== -1);
        console.log("Title:", (redirect.body.match(/<title>([^<]+)<\/title>/) || [])[1] || "none");
        console.log("Cookie now:", cookieJar.slice(0, 200));
    }
}

main().catch(function(e) { console.error(e); });