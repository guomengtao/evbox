var PAGE_PRESETS = {
  "pages/activation": {
    script: [
      "var s = require('@app-module/system.storage');",
      "s.set({",
      "  key: 'auth_data',",
      "  value: JSON.stringify({",
      "    installTime: Date.now(),",
      "    isActivated: true,",
      "    isPermanent: true,",
      "    expireAt: null,",
      "    activatedAt: Date.now(),",
      "    trialDays: 7,",
      "    productId: '0001',",
      "    history: []",
      "  })",
      "});"
    ].join("\n")
  },
  "pages/homepage-settings": {
    script: [
      "var s = require('@app-module/system.storage');",
      "s.set({",
      "  key: 'homepage_settings',",
      "  value: JSON.stringify({",
      "    showCountdown: true,",
      "    showCalculator: true,",
      "    showQuote: true,",
      "    showLunar: true,",
      "    showQuickAdd: true",
      "  })",
      "});"
    ].join("\n")
  },
  "pages/pinned-pages": {
    script: [
      "var s = require('@app-module/system.storage');",
      "s.set({",
      "  key: 'pinned_pages',",
      "  value: JSON.stringify([",
      "    {name:'Calculator',uri:'pages/calculator'},",
      "    {name:'Countdown',uri:'pages/countdown-manage'},",
      "    {name:'QRCode',uri:'pages/qrcode-generator'}",
      "  ])",
      "});"
    ].join("\n")
  },
  "pages/backup-restore": {
    script: [
      "var s = require('@app-module/system.storage');",
      "s.set({",
      "  key: 'allCourses',",
      "  value: JSON.stringify([{",
      "    scheduleName:'Demo Schedule',",
      "    courses: [",
      "      {id:'1',name:'Math',teacher:'Zhang',location:'Room101',day:1,startTime:8,endTime:9,weeks:'1-16',color:'#7ec8e3',notes:''},",
      "      {id:'2',name:'English',teacher:'Li',location:'Room202',day:2,startTime:10,endTime:11,weeks:'1-16',color:'#7ec8a0',notes:''}",
      "    ],",
      "    createdAt: new Date().toISOString(),",
      "    updatedAt: new Date().toISOString()",
      "  }])",
      "});",
      "s.set({ key: 'scheduleNames', value: JSON.stringify(['Demo Schedule']) });",
      "s.set({ key: 'currentScheduleIndex', value: '0' });"
    ].join("\n")
  },
  "pages/calculator": {
    script: null
  },
  "pages/countdown-manage": {
    script: [
      "var s = require('@app-module/system.storage');",
      "s.set({",
      "  key: 'countdown_list',",
      "  value: JSON.stringify([",
      "    {id:'1',title:'New Year',targetDate:'2027-01-01',type:'annual',desc:'Happy New Year!'},",
      "    {id:'2',title:'Birthday',targetDate:'2027-06-15',type:'once',desc:'My birthday'}",
      "  ])",
      "});"
    ].join("\n")
  },
  "pages/qrcode-generator": {
    script: [
      "var s = require('@app-module/system.storage');",
      "s.set({ key: 'qrcode_text', value: 'https://example.com/evbox' });"
    ].join("\n")
  },
  "pages/template-picker": {
    script: null
  },
  "pages/settings": {
    script: [
      "var s = require('@app-module/system.storage');",
      "s.set({ key: 'baseFontSize', value: '36' });",
      "s.set({ key: 'userNickname', value: 'User' });",
      "s.set({ key: 'premium_unlocked', value: 'true' });"
    ].join("\n")
  }
}

var DATA_STATES = {
  "homepage-settings": {
    "empty": [
      "var s = require('@app-module/system.storage');",
      "s.set({",
      "  key: 'homepage_settings',",
      "  value: JSON.stringify({",
      "    showCountdown: false,",
      "    showCalculator: false,",
      "    showQuote: false,",
      "    showLunar: false,",
      "    showQuickAdd: false",
      "  })",
      "});"
    ].join("\n"),
    "full": [
      "var s = require('@app-module/system.storage');",
      "s.set({",
      "  key: 'homepage_settings',",
      "  value: JSON.stringify({",
      "    showCountdown: true,",
      "    showCalculator: true,",
      "    showQuote: true,",
      "    showLunar: true,",
      "    showQuickAdd: true",
      "  })",
      "});"
    ].join("\n")
  },
  "backup-restore": {
    "empty": [
      "var s = require('@app-module/system.storage');",
      "s.set({ key: 'allCourses', value: '[]' });",
      "s.set({ key: 'scheduleNames', value: '[]' });"
    ].join("\n"),
    "full": [
      "var s = require('@app-module/system.storage');",
      "s.set({",
      "  key: 'allCourses',",
      "  value: JSON.stringify([{",
      "    scheduleName:'Demo',",
      "    courses: [",
      "      {id:'1',name:'Math',teacher:'Mr.Zhang',location:'101',day:1,startTime:8,endTime:9,weeks:'1-16',color:'#7ec8e3',notes:''},",
      "      {id:'2',name:'Physics',teacher:'Ms.Wang',location:'201',day:1,startTime:10,endTime:11,weeks:'1-16',color:'#b07ec8',notes:''},",
      "      {id:'3',name:'English',teacher:'Mr.Li',location:'302',day:2,startTime:8,endTime:10,weeks:'1-16',color:'#7ec8a0',notes:''}",
      "    ],",
      "    createdAt: new Date().toISOString(),",
      "    updatedAt: new Date().toISOString()",
      "  }])",
      "});",
      "s.set({ key: 'scheduleNames', value: JSON.stringify(['Demo']) });",
      "s.set({ key: 'currentScheduleIndex', value: '0' });"
    ].join("\n")
  },
  "pinned-pages": {
    "empty": "require('@app-module/system.storage').set({key:'pinned_pages',value:'[]'});",
    "full": [
      "var s = require('@app-module/system.storage');",
      "s.set({",
      "  key: 'pinned_pages',",
      "  value: JSON.stringify([",
      "    {name:'Calculator',uri:'pages/calculator'},",
      "    {name:'Countdown',uri:'pages/countdown-manage'},",
      "    {name:'QRCode',uri:'pages/qrcode-generator'},",
      "    {name:'Lunar',uri:'pages/lunar-calendar'},",
      "    {name:'Quote',uri:'pages/daily-quote'}",
      "  ])",
      "});"
    ].join("\n")
  },
  "countdown-manage": {
    "empty": "require('@app-module/system.storage').set({key:'countdown_list',value:'[]'});",
    "full": [
      "var s = require('@app-module/system.storage');",
      "s.set({",
      "  key: 'countdown_list',",
      "  value: JSON.stringify([",
      "    {id:'1',title:'New Year',targetDate:'2027-01-01',type:'annual',desc:'Happy New Year!'},",
      "    {id:'2',title:'Spring Festival',targetDate:'2027-01-29',type:'annual',desc:''},",
      "    {id:'3',title:'Birthday',targetDate:'2027-06-15',type:'once',desc:'My birthday'},",
      "    {id:'4',title:'Valentine',targetDate:'2027-02-14',type:'annual',desc:''},",
      "    {id:'5',title:'Exam',targetDate:'2027-03-20',type:'once',desc:'Final exam'},",
      "  ])",
      "});"
    ].join("\n")
  }
}

var THEMES = [
  { key: "blue", name: "DeepSpaceBlue" },
  { key: "green", name: "JadeGreen" },
  { key: "red", name: "CoralRed" },
  { key: "dark", name: "NightBlack" },
  { key: "gray", name: "SpaceGray" },
  { key: "purple", name: "PurplePhantom" },
  { key: "light", name: "MorningWhite" },
  { key: "warm", name: "WarmBeige" },
  { key: "forest", name: "ForestGreen" }
]

function themeScript(themeKey) {
  return [
    "var s = require('@app-module/system.storage');",
    "s.set({ key: 'appTheme', value: '" + themeKey + "' });"
  ].join("\n")
}

var KEY_PAGES_FOR_THEME = [
  "pages/index",
  "pages/tools",
  "pages/settings",
  "pages/homepage-settings",
  "pages/calculator",
  "pages/countdown-manage",
  "pages/activation",
  "pages/template-picker"
]

function getPreset(pagePath) {
  return PAGE_PRESETS[pagePath] || null
}

function getDataStates(pagePath) {
  return DATA_STATES[pagePath] || null
}

function getThemeList() {
  return THEMES
}

function getKeyPagesForTheme() {
  return KEY_PAGES_FOR_THEME
}

function makeThemeScript(themeKey) {
  return themeScript(themeKey)
}

module.exports = {
  PAGE_PRESETS: PAGE_PRESETS,
  DATA_STATES: DATA_STATES,
  THEMES: THEMES,
  KEY_PAGES_FOR_THEME: KEY_PAGES_FOR_THEME,
  getPreset: getPreset,
  getDataStates: getDataStates,
  getThemeList: getThemeList,
  getKeyPagesForTheme: getKeyPagesForTheme,
  makeThemeScript: makeThemeScript
}