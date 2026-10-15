var fs = require("fs")
var path = require("path")
var utils = require("./utils")

function ReportGenerator() {}

ReportGenerator.prototype.generate = function (outputDir, options) {
  var results = options.results || []
  var device = options.device || "unknown"
  var version = options.version || "latest"
  var stateName = options.stateName || "baseline"
  var totalPages = options.totalPages || results.length

  var successCount = 0
  var failedCount = 0
  var skippedCount = 0
  var blackScreenCount = 0

  for (var i = 0; i < results.length; i++) {
    var r = results[i]
    if (r.status === "OK") successCount++
    else if (r.status === "SKIPPED") skippedCount++
    else {
      failedCount++
      if (r.status === "BLACK" || r.status === "WHITE") blackScreenCount++
    }
  }

  var report = {
    tool: "vela-screenshot",
    timestamp: new Date().toISOString(),
    device: device,
    version: version,
    state: stateName,
    totalPages: totalPages,
    successCount: successCount,
    failedCount: failedCount,
    skippedCount: skippedCount,
    blackScreenCount: blackScreenCount,
    results: results
  }

  utils.ensureDir(outputDir)
  var reportPath = path.join(outputDir, "report.json")
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  return report
}

ReportGenerator.prototype.printSummary = function (report) {
  console.log("")
  console.log("========================================")
  console.log("  Screenshot Report")
  console.log("========================================")
  console.log("  Device:      " + report.device)
  console.log("  Version:     " + report.version)
  console.log("  State:       " + report.state)
  console.log("  Total:       " + report.totalPages)
  console.log("  OK:          " + report.successCount)
  console.log("  Failed:      " + report.failedCount)
  console.log("  BlackScreen: " + report.blackScreenCount)
  console.log("  Skipped:     " + report.skippedCount)
  console.log("========================================")

  if (report.failedCount > 0) {
    console.log("")
    console.log("  Failed pages:")
    for (var i = 0; i < report.results.length; i++) {
      var r = report.results[i]
      if (r.status !== "OK" && r.status !== "SKIPPED") {
        console.log("    - " + r.name_cn + " (" + r.page + ") [" + r.status + "] " + (r.error || ""))
      }
    }
  }
  console.log("")
}

module.exports = ReportGenerator