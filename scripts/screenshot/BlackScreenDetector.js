var fs = require("fs")

function BlackScreenDetector() {}

BlackScreenDetector.prototype.detect = function (imagePath) {
  var png
  try {
    png = require("pngjs").PNG.sync.read(fs.readFileSync(imagePath))
  } catch (e) {
    return { status: "ERROR", error: "Failed to read PNG: " + e.message }
  }

  var width = png.width
  var height = png.height
  var data = png.data
  var totalPixels = width * height

  var blackPixels = 0
  var whitePixels = 0
  var colorBuckets = {}

  for (var i = 0; i < data.length; i += 16) {
    var r = data[i]
    var g = data[i + 1]
    var b = data[i + 2]
    var brightness = r + g + b

    if (brightness < 30) blackPixels++
    if (brightness > 735) whitePixels++

    var bucket = Math.floor(r / 32) + "_" + Math.floor(g / 32) + "_" + Math.floor(b / 32)
    colorBuckets[bucket] = (colorBuckets[bucket] || 0) + 1
  }

  var sampledPixels = Math.floor(totalPixels / 4)
  var blackRatio = blackPixels / sampledPixels
  var whiteRatio = whitePixels / sampledPixels

  var maxBucketCount = 0
  for (var key in colorBuckets) {
    if (colorBuckets.hasOwnProperty(key)) {
      if (colorBuckets[key] > maxBucketCount) maxBucketCount = colorBuckets[key]
    }
  }
  var dominantRatio = maxBucketCount / sampledPixels

  if (blackRatio > 0.95) return { status: "BLACK", blackRatio: blackRatio }
  if (whiteRatio > 0.95) return { status: "WHITE", whiteRatio: whiteRatio }
  if (dominantRatio > 0.90) return {
    status: "SUSPICIOUS",
    blackRatio: blackRatio,
    whiteRatio: whiteRatio,
    dominantRatio: dominantRatio
  }
  return {
    status: "OK",
    blackRatio: blackRatio,
    whiteRatio: whiteRatio,
    dominantRatio: dominantRatio
  }
}

module.exports = BlackScreenDetector