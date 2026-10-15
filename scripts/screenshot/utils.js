var fs = require("fs")
var path = require("path")

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms)
  })
}

async function retry(fn, options) {
  var maxRetries = (options && options.retries) || 3
  var delayMs = (options && options.delayMs) || 2000
  var onRetry = (options && options.onRetry) || null
  var lastError = null

  for (var i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < maxRetries) {
        if (onRetry) onRetry(i + 1, maxRetries, err)
        await sleep(delayMs)
      }
    }
  }
  throw lastError
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function findLatestRpk(distDir) {
  if (!fs.existsSync(distDir)) return null

  var files = fs.readdirSync(distDir)
    .filter(function (f) { return f.endsWith(".rpk") })
    .map(function (f) {
      var fullPath = path.join(distDir, f)
      var stat = fs.statSync(fullPath)
      return { name: f, path: fullPath, mtime: stat.mtimeMs }
    })
    .sort(function (a, b) { return b.mtime - a.mtime })

  return files.length > 0 ? files[0].path : null
}

function sanitizeFilename(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .substring(0, 100)
}

function formatTimestamp() {
  var now = new Date()
  var y = now.getFullYear()
  var m = String(now.getMonth() + 1).padStart(2, "0")
  var d = String(now.getDate()).padStart(2, "0")
  var h = String(now.getHours()).padStart(2, "0")
  var min = String(now.getMinutes()).padStart(2, "0")
  var s = String(now.getSeconds()).padStart(2, "0")
  return y + m + d + "T" + h + min + s
}

module.exports = {
  sleep: sleep,
  retry: retry,
  ensureDir: ensureDir,
  findLatestRpk: findLatestRpk,
  sanitizeFilename: sanitizeFilename,
  formatTimestamp: formatTimestamp
}