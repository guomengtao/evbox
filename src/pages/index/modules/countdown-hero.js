/**
 * 首页「倒数日大数字」模块
 *
 * 取值优先级：手动钉的那条 → 最近的未来项 → 全部已过时取最近过去的一条
 * 只在有可展示的条目时才占位（hasCountdown），无数据时首页布局与之前完全一致。
 */
var countdown = require("../../../data/countdown.js")

function init(instance) {
  instance.showCountdown = true
  instance.hasCountdown = false
  instance.cdBadge = ""
  instance.cdUnit = ""
  instance.cdTitle = ""
  instance.cdSubText = ""
  instance.cdPinned = false

  instance.loadCountdownHero = function() {
    var self = instance
    countdown.loadList(function(list) {
      var item = countdown.getHomeItem(list, new Date())
      if (!item) {
        self.hasCountdown = false
        return
      }
      var daysLeft = item.daysLeft
      self.hasCountdown = true
      self.cdTitle = item.title
      self.cdPinned = item.pinnedHome === true
      if (daysLeft > 0) {
        self.cdBadge = "" + daysLeft
        self.cdUnit = "天"
      } else if (daysLeft === 0) {
        self.cdBadge = "今天"
        self.cdUnit = ""
      } else {
        self.cdBadge = "已过"
        self.cdUnit = (-daysLeft) + "天"
      }
      if (item.repeat !== "none") {
        self.cdSubText = item.nextText || item.dateText
      } else if (item.nextText) {
        self.cdSubText = item.dateText + " · " + item.nextText
      } else {
        self.cdSubText = item.dateText
      }
    })
  }

  instance.openCountdown = function() {
    var router = require("@system.router")
    router.push({ uri: "/pages/countdown-manage" })
  }
}

module.exports = { init: init }
