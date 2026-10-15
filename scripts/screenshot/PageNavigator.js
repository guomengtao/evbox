var fs = require("fs")
var presets = require("./page-presets")

function PageNavigator(mcpClient, adbClient) {
  this.mcp = mcpClient
  this.adb = adbClient || null
  this.pages = []
  this.verbose = false
  this.useAdbFallback = false
}

PageNavigator.prototype.loadManifest = function (manifestPath) {
  var manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
  var router = manifest.router
  if (!router || !router.pages) {
    throw new Error("Invalid manifest: missing router.pages")
  }

  var pages = router.pages
  this.pages = []

  var pageKeys = Object.keys(pages)
  for (var i = 0; i < pageKeys.length; i++) {
    var key = pageKeys[i]
    var page = pages[key]
    var preset = presets.getPreset(key)
    this.pages.push({
      path: key,
      component: page.component || key.replace("pages/", ""),
      group: page.group || "Other",
      name_cn: page.name_cn || key,
      requiresPreset: preset !== null && preset.script !== null,
      presetScript: preset ? preset.script : null
    })
  }

  return this.pages
}

PageNavigator.prototype.getPages = function () {
  return this.pages
}

PageNavigator.prototype.filterPages = function (filter) {
  if (!filter || filter === "all") return this.pages.slice()

  var result = []
  var filterPages = filter.split(",")
  var allGroups = {}
  for (var i = 0; i < this.pages.length; i++) {
    var pg = this.pages[i]
    if (!allGroups[pg.group]) {
      allGroups[pg.group] = { key: pg.group, count: 0 }
    }
    allGroups[pg.group].count++
  }

  for (var j = 0; j < filterPages.length; j++) {
    var f = filterPages[j].trim()
    var matched = false

    for (var k = 0; k < this.pages.length; k++) {
      if (this.pages[k].path === f || this.pages[k].name_cn === f) {
        result.push(this.pages[k])
        matched = true
      }
    }

    if (!matched) {
      if (allGroups[f]) {
        for (var l = 0; l < this.pages.length; l++) {
          if (this.pages[l].group === f) {
            result.push(this.pages[l])
          }
        }
        matched = true
      }
    }

    if (!matched) {
      console.warn("[PageNavigator] No pages matched filter: " + f)
    }
  }

  return result
}

PageNavigator.prototype.getGroups = function () {
  var groups = {}
  for (var i = 0; i < this.pages.length; i++) {
    var g = this.pages[i].group
    if (!groups[g]) groups[g] = []
    groups[g].push(this.pages[i])
  }
  return groups
}

PageNavigator.prototype.summary = function () {
  var groups = this.getGroups()
  var lines = []
  var groupKeys = Object.keys(groups).sort()
  for (var i = 0; i < groupKeys.length; i++) {
    var g = groupKeys[i]
    lines.push("  " + g + " (" + groups[g].length + " pages)")
  }
  return lines.join("\n")
}

PageNavigator.prototype.navigateTo = function (pagePath) {
  var self = this
  if (self.useAdbFallback || !self.mcp) {
    // adb 模式无 MCP 路由：复位到首页（保证可达的状态，通常仅首页可稳定截取）
    if (self.adb) {
      if (self.verbose) console.log("  [AdbNav] cold-start reset (no MCP route to " + pagePath + ")")
      return self.adb.coldStart(8).then(function () { return null })
    }
    return Promise.resolve(null)
  }
  return this.mcp.navigate(pagePath)
}

PageNavigator.prototype.injectPreset = function (pagePath) {
  if (this.useAdbFallback || !this.mcp) {
    if (this.verbose) console.log("  [AdbNav] preset skipped (MCP/exec unavailable)")
    return Promise.resolve()
  }
  var preset = presets.getPreset(pagePath)
  if (preset && preset.script) {
    if (this.verbose) console.log("  [Preset] Injecting data for " + pagePath)
    return this.mcp.executeScript(preset.script)
  }
  return Promise.resolve()
}

PageNavigator.prototype.injectStateScript = function (script) {
  if (!script) return Promise.resolve()
  if (this.useAdbFallback || !this.mcp) {
    if (this.verbose) console.log("  [AdbNav] state script skipped (MCP/exec unavailable)")
    return Promise.resolve()
  }
  return this.mcp.executeScript(script)
}

module.exports = PageNavigator