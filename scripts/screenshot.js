var fs = require("fs")
var path = require("path")
var utils = require("./screenshot/utils")
var PageNavigator = require("./screenshot/PageNavigator")
var ReportGenerator = require("./screenshot/ReportGenerator")
var BlackScreenDetector = require("./screenshot/BlackScreenDetector")
var EmuShotCli = require("./screenshot/EmuShotCli")

var args = parseArgs(process.argv.slice(2))

if (args.help) {
  printHelp()
  process.exit(0)
}

var navigator = new PageNavigator(null, null)
navigator.verbose = args.verbose || false

var emu = new EmuShotCli({ verbose: args.verbose || false })
var detector = new BlackScreenDetector()
var reporter = new ReportGenerator()

var manifestPath = path.join(__dirname, "..", "build", "manifest.json")
var outputBase = path.resolve(args.output || path.join(__dirname, "..", "screenshots"))

run().then(function () {
  console.log("Done.")
  process.exit(0)
}).catch(function (err) {
  console.error("Fatal error: " + (err && err.message || err))
  process.exit(1)
})

process.on("SIGINT", function () {
  console.log("\nInterrupted.")
  emu.stop()
  process.exit(0)
})
process.on("SIGTERM", function () {
  emu.stop()
  process.exit(0)
})

async function run() {
  var version = getVersion()
  console.log("Version: " + version)
  console.log("Device:  " + args.device)
  console.log("Output:  " + outputBase)

  console.log("\nLoading manifest: " + manifestPath)
  var pages = navigator.loadManifest(manifestPath)
  console.log("Found " + pages.length + " pages:")
  console.log(navigator.summary())

  var targetPages = navigator.filterPages(args.pages)
  if (args.group) {
    targetPages = targetPages.filter(function (p) { return p.group === args.group })
  }
  if (targetPages.length !== pages.length) {
    console.log("\nFiltered to " + targetPages.length + " pages")
  }

  var mcpNav = null
  try {
    var VelaMCPClient = require("./screenshot/vela-mcp-client")
    var mcp = new VelaMCPClient()
    mcp.verbose = args.verbose || false
    await mcp.start(30000)
    mcpNav = mcp
    console.log("MCP connected: navigate routing enabled.")
  } catch (err) {
    console.log("MCP unavailable (" + err.message + "), using coordinate-based navigation.")
  }

  console.log("\nCold starting emulator via emu_shot.py...")
  emu.launch()

  var allResults = await runBaseline(targetPages, version, mcpNav)

  var reportDir = path.join(outputBase, args.device, version, "baseline")
  var report = reporter.generate(reportDir, {
    results: allResults,
    device: args.device,
    version: version,
    stateName: "baseline",
    totalPages: targetPages.length
  })
  reporter.printSummary(report)

  emu.stop()
}

async function runBaseline(pages, version, mcpNav) {
  var results = []
  var outputDir = path.join(outputBase, args.device, version, "baseline")

  console.log("\n=== Baseline Screenshots (" + pages.length + " pages) ===\n")

  for (var i = 0; i < pages.length; i++) {
    var page = pages[i]
    var startTime = Date.now()

    console.log("[" + (i + 1) + "/" + pages.length + "] " + page.name_cn + " (" + page.path + ")")

    try {
      var targetPath = page.path

      if (mcpNav) {
        console.log("  Navigating via MCP: " + targetPath)
        await mcpNav.navigate(targetPath)
        await utils.sleep(2000)
      } else {
        navigateByCoords(targetPath)
      }

      var filePath = buildOutputPath(outputDir, page, version)
      emu.shot(filePath)

      var detection = args.noBlackCheck ? { status: "OK" } : detector.detect(filePath)

      if (detection.status !== "OK") {
        console.log("  -> " + detection.status + " detected, retrying...")
        emu.tap(96, 485, 2)
        await utils.sleep(1500)

        if (mcpNav) {
          await mcpNav.navigate(targetPath)
          await utils.sleep(2000)
        }

        emu.shot(filePath)
        detection = detector.detect(filePath)
      }

      var result = {
        page: page.path,
        name_cn: page.name_cn,
        group: page.group,
        status: detection.status,
        file: path.relative(outputBase, filePath),
        duration_ms: Date.now() - startTime,
        retries: detection.status !== "OK" ? 1 : 0
      }

      if (detection.status !== "OK") {
        var failPath = filePath.replace(/\.png$/, "_FAILED.png")
        fs.renameSync(filePath, failPath)
        result.file = path.relative(outputBase, failPath)
        result.error = detection.status + " screen"
      }

      console.log("  -> " + detection.status + " " + result.duration_ms + "ms")
      results.push(result)
    } catch (err) {
      console.log("  -> ERROR: " + (err.message || err))
      results.push({
        page: page.path,
        name_cn: page.name_cn,
        group: page.group,
        status: "ERROR",
        error: err.message || "Unknown error",
        duration_ms: Date.now() - startTime,
        retries: 0
      })
    }
  }

  return results
}

function buildOutputPath(baseDir, page, version) {
  var group = utils.sanitizeFilename(page.group)
  var name = utils.sanitizeFilename(page.name_cn)
  var filename = name + "_" + version + ".png"
  var dir = path.join(baseDir, group)
  utils.ensureDir(dir)
  return path.join(dir, filename)
}

var COORD_MAP = {
  "pages/index": { desc: "home", tap: null },
  "pages/tools/index": { desc: "tools", tap: [48, 452] },
  "pages/settings/index": { desc: "settings", tap: [143, 452] }
}

function navigateByCoords(targetPath) {
  var entry = COORD_MAP[targetPath]
  if (!entry) {
    console.log("  No coordinate mapping for: " + targetPath + ", staying on current page")
    return
  }
  if (entry.tap) {
    console.log("  Tapping " + entry.desc + " at " + entry.tap[0] + "," + entry.tap[1])
    emu.tap(entry.tap[0], entry.tap[1], 0.12)
    utils.sleep(1500)
  } else {
    console.log("  On " + entry.desc + " page (no tap needed)")
  }
}

function getVersion() {
  if (args.rpk && fs.existsSync(args.rpk)) {
    var rpkName = path.basename(args.rpk, ".rpk")
    var vMatch = rpkName.match(/[\d]+\.[\d]+\.[\d]+/)
    if (vMatch) return vMatch[0]
    return rpkName
  }
  if (args.version && args.version !== "latest") {
    return args.version
  }
  var manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
  return manifest.versionName || manifest.version || "0.0.0"
}

function parseArgs(argv) {
  var result = {
    device: "xiaomi_band_10",
    version: "latest",
    rpk: null,
    output: null,
    pages: "all",
    group: null,
    retry: 2,
    timeout: 15000,
    noBlackCheck: false,
    skipSecondScreen: true,
    skipEditPages: false,
    states: null,
    themeFilter: null,
    consoleLog: false,
    verbose: false,
    help: false
  }

  for (var i = 0; i < argv.length; i++) {
    var arg = argv[i]
    switch (arg) {
      case "-d":
      case "--device":
        result.device = argv[++i] || "10pro"
        break
      case "-v":
      case "--version":
        result.version = argv[++i] || "latest"
        break
      case "-r":
      case "--rpk":
        result.rpk = argv[++i] || null
        break
      case "-o":
      case "--output":
        result.output = argv[++i] || null
        break
      case "-p":
      case "--pages":
        result.pages = argv[++i] || "all"
        break
      case "-g":
      case "--group":
        result.group = argv[++i] || null
        break
      case "-t":
      case "--timeout":
        result.timeout = parseInt(argv[++i]) || 15000
        break
      case "--retry":
        result.retry = parseInt(argv[++i]) || 2
        break
      case "--no-black-check":
        result.noBlackCheck = true
        break
      case "--skip-second-screen":
        result.skipSecondScreen = true
        break
      case "--skip-edit-pages":
        result.skipEditPages = true
        break
      case "--states":
        result.states = argv[++i] || null
        break
      case "--theme-filter":
        result.themeFilter = argv[++i] || null
        break
      case "--console-log":
        result.consoleLog = true
        break
      case "--verbose":
        result.verbose = true
        break
      case "-h":
      case "--help":
        result.help = true
        break
      default:
        if (arg.indexOf("--") === 0) {
          console.warn("Unknown option: " + arg)
        }
    }
  }

  return result
}

function printHelp() {
  console.log("Usage: node scripts/screenshot.js [options]")
  console.log("")
  console.log("Options:")
  console.log("  -d, --device <name>       Device model (default: 10pro)")
  console.log("  -v, --version <ver>       Version number (default: latest from manifest)")
  console.log("  -r, --rpk <path>          Path to .rpk file")
  console.log("  -o, --output <dir>        Output directory (default: screenshots/)")
  console.log("  -p, --pages <list>        Comma-separated page paths or 'all'")
  console.log("  -g, --group <name>        Filter by page group")
  console.log("  -t, --timeout <ms>        Page load timeout in ms (default: 15000)")
  console.log("  --retry <n>               Max retries per page (default: 2)")
  console.log("  --no-black-check          Skip black screen detection")
  console.log("  --skip-second-screen      Skip second screen capture (default: true)")
  console.log("  --skip-edit-pages         Skip pages that require preset data")
  console.log("  --verbose                 Verbose output")
  console.log("  -h, --help                Show help")
  console.log("")
  console.log("Core engine: emu_shot.py (ADB framebuffer)")
  console.log("Navigation: MCP (when available) or coordinate-based fallback")
  console.log("")
  console.log("Examples:")
  console.log("  node scripts/screenshot.js")
  console.log("  node scripts/screenshot.js --device 9 --pages pages/index")
  console.log("  node scripts/screenshot.js --verbose --no-black-check")
}