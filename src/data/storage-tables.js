var tables = [
  {
    key: "appTheme",
    desc: "应用主题设置",
    columns: ["value"],
    type: "value"
  },
  {
    key: "baseFontSize",
    desc: "用户选择的字体大小 (28|36|48|62|76)",
    columns: ["value"],
    type: "value"
  },
  {
    key: "userNickname",
    desc: "用户昵称",
    columns: ["value"],
    type: "value"
  },
  {
    key: "vibrationStyle",
    desc: "震动样式设置",
    columns: ["value"],
    type: "value"
  },
  {
    key: "vibration_presets",
    desc: "自定义震动方案",
    columns: ["name", "pattern", "repeat"],
    type: "array"
  },
  {
    key: "qrcode_text",
    desc: "二维码生成文本",
    columns: ["value"],
    type: "value"
  },
  {
    key: "countdownDays",
    desc: "倒数日列表（公历/农历 + 重复规则 + 钉首页大数字）",
    columns: ["id", "title", "calendar", "date", "lunar", "repeat", "enabled", "pinnedHome"],
    type: "array"
  },
  {
    key: "calc_history",
    desc: "计算器历史记录（最近 20 条）",
    columns: ["expr", "result"],
    type: "array"
  },
  {
    key: "homepage_settings",
    desc: "首页设置（含工具显示模式 icon|list|rich）",
    columns: ["showTime", "showPinnedBar", "showCountdown", "toolViewMode", "timeFormat"],
    type: "object"
  },
  {
    key: "homepage_template",
    desc: "首页模板选择",
    columns: ["value"],
    type: "value"
  },
  {
    key: "premium_unlocked",
    desc: "高级功能解锁状态",
    columns: ["value"],
    type: "value"
  },
  {
    key: "pinned_pages",
    desc: "钉在首页的页面列表",
    columns: ["name", "uri"],
    type: "array"
  },
  {
    key: "auth_data",
    desc: "激活认证数据",
    columns: ["activated", "activationDate", "expiryDate", "deviceId", "isTrial"],
    type: "object"
  },
  {
    key: "master_usage",
    desc: "主激活码使用记录",
    columns: ["code", "usedCount", "lastUsed"],
    type: "object"
  },
  {
    key: "used_codes",
    desc: "已使用的激活码列表",
    columns: ["value"],
    type: "array"
  },
  {
    key: "used_redeem",
    desc: "已使用的兑换码",
    columns: ["value"],
    type: "array"
  },
  {
    key: "data_backup",
    desc: "数据备份",
    columns: ["settings", "backupTime"],
    type: "object"
  },
  {
    key: "last_backup_time",
    desc: "上次备份时间",
    columns: ["value"],
    type: "value"
  },
  {
    key: "background_running_config",
    desc: "后台运行配置",
    columns: ["enabled", "interval", "lastRun"],
    type: "object"
  }
]

module.exports = tables
