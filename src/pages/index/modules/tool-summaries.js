/**
 * 首页「图文模式」的工具摘要取数
 *
 * 设计约束（见 doc/胶囊屏首页美化设计-三模式.md）：
 * - 只读现有 storage / 模块，不新造数据结构
 * - 任一来源取不到 → 该工具摘要为空，UI 直接不渲染那一行（绝不显示"未知/加载中"）
 */
var countdown = require("../../../data/countdown.js")
var lunar = require("../../../lib/lunar.js")

function parseArr(data) {
  if (!data) return []
  var arr = []
  try {
    arr = JSON.parse(data)
  } catch (e) {
    arr = []
  }
  return arr && arr.length ? arr : []
}

function readStorage(key, cb) {
  var storage = require("@system.storage")
  storage.get({
    key: key,
    success: function(data) {
      cb(data)
    },
    fail: function() {
      cb(null)
    }
  })
}

var TASKS = [
  {
    id: "countdown",
    run: function(next) {
      countdown.loadList(function(list) {
        var item = countdown.getHomeItem(list, new Date())
        next(item ? (item.title + " · " + item.daysText) : "")
      })
    }
  },
  {
    id: "lunar",
    run: function(next) {
      var now = new Date()
      var l = lunar.solarToLunar(now.getFullYear(), now.getMonth() + 1, now.getDate())
      if (!l) {
        next("")
        return
      }
      var fest = lunar.lunarFestival(l) || lunar.solarFestival(now.getMonth() + 1, now.getDate())
      next(lunar.formatLunar(l) + (fest ? " · " + fest : ""))
    }
  },
  {
    id: "calculator",
    run: function(next) {
      readStorage("calc_history", function(data) {
        var arr = parseArr(data)
        next(arr.length ? ("上次 " + arr[0].result) : "")
      })
    }
  },
  {
    id: "qrcode",
    run: function(next) {
      readStorage("qrcode_items_list", function(data) {
        var arr = parseArr(data)
        next(arr.length ? (arr.length + " 个") : "")
      })
    }
  },
  {
    id: "vibrate",
    run: function(next) {
      readStorage("vibration_presets", function(data) {
        var arr = parseArr(data)
        next(arr.length ? (arr.length + " 个方案") : "")
      })
    }
  },
  {
    id: "backup",
    run: function(next) {
      readStorage("backup_list", function(data) {
        var arr = parseArr(data)
        next(arr.length ? (arr.length + " 份备份") : "")
      })
    }
  },
  {
    id: "device",
    run: function(next) {
      var device = require("@system.device")
      device.getInfo({
        success: function(info) {
          var parts = []
          if (info && info.brand) parts.push(info.brand)
          if (info && info.model) parts.push(info.model)
          next(parts.join(" "))
        },
        fail: function() {
          next("")
        }
      })
    }
  },
  {
    // v3 首页默认推荐「一言」需要的当日一句。同 daily-quote 页用同一取句函数，
    // 保证首页 teaser 与点进去看到的正文是同一句（按日确定性）。
    id: "quote",
    run: function(next) {
      var quotes = require("../../../data/daily-quotes.js")
      var text = ""
      try {
        text = quotes.quoteOfDay(new Date(), 0) || ""
      } catch (e) {
        text = ""
      }
      next(text)
    }
  }
]

/** 一次性取全部摘要：callback({ toolId: "摘要文案" }) */
function getAll(callback) {
  var out = {}
  var total = TASKS.length
  var finished = 0
  var done = false

  // 兜底：device.getInfo 等系统 API 在某些 guest 上既不 success 也不 fail，
  // 会让整批摘要永远不回调（首页 v3 将因此只剩空卡名）。
  // 1.5s 后强制结算已拿到的部分，缺的按「取不到就不渲染那行」处理。
  var guard = setTimeout(function() {
    if (done) return
    done = true
    callback(out)
  }, 1500)

  function tick() {
    finished++
    if (finished >= total && !done) {
      done = true
      try { clearTimeout(guard) } catch (e) {}
      callback(out)
    }
  }

  if (total === 0) {
    done = true
    try { clearTimeout(guard) } catch (e) {}
    callback(out)
    return
  }

  for (var i = 0; i < TASKS.length; i++) {
    (function(task) {
      var settled = false
      task.run(function(text) {
        if (settled) return
        settled = true
        if (text) out[task.id] = text
        tick()
      })
    })(TASKS[i])
  }
}

module.exports = {
  getAll: getAll
}
