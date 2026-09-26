#!/usr/bin/env node
/**
 * 通过 GitHub REST API 把当前工作区镜像推送上去。
 *
 * 背景：本机 **github.com:443 被墙**（TCP 直接超时），普通 git push（https / ssh）
 * 都不可用；而 `api.github.com` 可达。因此改用 Git Data API：
 *
 *   git ls-files（跟踪 + 未忽略的未跟踪文件）
 *     → POST /git/blobs   逐个上传
 *     → POST /git/trees   组装完整目录树
 *     → POST /git/commits 造一个提交（parent = 远端当前 HEAD）
 *     → PATCH /git/refs/heads/<branch> 移动分支
 *
 * 用法：
 *   node scripts/gh-api-push.js                    # 用最近一次 commit message
 *   node scripts/gh-api-push.js -m "feat: xxx"     # 自定义提交信息
 *   node scripts/gh-api-push.js --dry-run          # 只统计，不推送
 *   node scripts/gh-api-push.js --force            # 允许非快进（覆盖远端分支）
 *
 * 凭据：优先 env GITHUB_TOKEN / GH_TOKEN，否则走 `gh auth token`（keyring）。
 */
const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const API = "https://api.github.com"
const CONCURRENCY = 6
const ROOT = path.resolve(__dirname, "..")

function sh(cmd, opts) {
  return execSync(cmd, Object.assign({ cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }, opts || {})).trim()
}

function parseArgs(argv) {
  const args = { message: "", dryRun: false, force: false, branch: "main" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "-m" || a === "--message") args.message = argv[++i] || ""
    else if (a === "--dry-run") args.dryRun = true
    else if (a === "--force") args.force = true
    else if (a === "--branch") args.branch = argv[++i] || "main"
  }
  return args
}

function getToken() {
  const env = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (env) return env
  try {
    return sh("gh auth token")
  } catch (e) {
    throw new Error("拿不到 GitHub token：请先 `gh auth login`，或设置 GITHUB_TOKEN 环境变量")
  }
}

function getRepo() {
  const url = sh("git remote get-url origin")
  // 支持 https://github.com/owner/repo.git 与 ssh://git@host/owner/repo.git
  const m = url.match(/[/:]([^/:]+)\/([^/]+?)(?:\.git)?$/)
  if (!m) throw new Error("无法从 origin 解析 owner/repo：" + url)
  return { owner: m[1], repo: m[2] }
}

function listFiles() {
  // 跟踪的 + 未被 .gitignore 忽略的（等价于 git add -A 会加的内容）
  const out = sh("git ls-files --cached --others --exclude-standard -z")
  const files = out.split("\0").filter(Boolean)
  // 取文件 mode（100644 / 100755）
  const modeMap = {}
  sh("git ls-files -s -z").split("\0").filter(Boolean).forEach((line) => {
    const tab = line.indexOf("\t")
    if (tab < 0) return
    const meta = line.slice(0, tab).split(" ")
    modeMap[line.slice(tab + 1)] = meta[0]
  })
  return files.map((p) => ({ path: p, mode: modeMap[p] === "100755" ? "100755" : "100644" }))
}

async function api(token, method, endpoint, body) {
  const res = await fetch(API + endpoint, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "evbox-api-push"
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch (e) {
    json = { raw: text }
  }
  if (!res.ok) {
    const err = new Error("GitHub API " + method + " " + endpoint + " 失败: " + res.status + " " + (json && json.message ? json.message : text))
    err.status = res.status
    err.body = json
    throw err
  }
  return json
}

async function pool(items, worker, size) {
  const results = new Array(items.length)
  let next = 0
  async function run() {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i], i)
    }
  }
  await Promise.all(new Array(Math.min(size, items.length)).fill(0).map(run))
  return results
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { owner, repo } = getRepo()
  const token = args.dryRun ? "" : getToken()
  const files = listFiles()

  const totalBytes = files.reduce((n, f) => n + fs.statSync(path.join(ROOT, f.path)).size, 0)
  console.log(`仓库：${owner}/${repo}    分支：${args.branch}`)
  console.log(`待推送：${files.length} 个文件，${(totalBytes / 1024 / 1024).toFixed(2)} MB`)

  if (args.dryRun) {
    console.log("\n--dry-run，仅统计，不上传。最大的 5 个文件：")
    files
      .map((f) => ({ path: f.path, size: fs.statSync(path.join(ROOT, f.path)).size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)
      .forEach((f) => console.log(`  ${(f.size / 1024).toFixed(1)} KB  ${f.path}`))
    return
  }

  // 1) 上传 blobs
  let done = 0
  const shas = await pool(
    files,
    async (f) => {
      const buf = fs.readFileSync(path.join(ROOT, f.path))
      const json = await api(token, "POST", `/repos/${owner}/${repo}/git/blobs`, {
        content: buf.toString("base64"),
        encoding: "base64"
      })
      done++
      if (done % 40 === 0 || done === files.length) process.stdout.write(`\r  已上传 ${done}/${files.length}`)
      return json.sha
    },
    CONCURRENCY
  )
  process.stdout.write("\n")

  // 2) 组装目录树
  const tree = files.map((f, i) => ({ path: f.path, mode: f.mode, type: "blob", sha: shas[i] }))
  const treeRes = await api(token, "POST", `/repos/${owner}/${repo}/git/trees`, { tree })
  console.log("目录树：" + treeRes.sha)

  // 3) 取远端当前 HEAD 作为 parent
  let parentSha = null
  try {
    const ref = await api(token, "GET", `/repos/${owner}/${repo}/git/ref/heads/${args.branch}`)
    parentSha = ref.object.sha
  } catch (e) {
    if (e.status !== 404) throw e
  }

  // 4) 创建提交
  const message = args.message || sh("git log -1 --pretty=%B") || "chore: 通过 API 同步"
  const commit = await api(token, "POST", `/repos/${owner}/${repo}/git/commits`, {
    message,
    tree: treeRes.sha,
    parents: parentSha ? [parentSha] : []
  })
  console.log("提交：" + commit.sha)
  console.log("  标题：" + message.split("\n")[0])

  // 5) 移动分支
  const refBody = { sha: commit.sha, force: !!args.force }
  try {
    if (parentSha) {
      await api(token, "PATCH", `/repos/${owner}/${repo}/git/refs/heads/${args.branch}`, refBody)
    } else {
      await api(token, "POST", `/repos/${owner}/${repo}/git/refs`, {
        ref: "refs/heads/" + args.branch,
        sha: commit.sha
      })
    }
  } catch (e) {
    if (e.status === 422 && !args.force) {
      throw new Error("分支不是快进更新（远端有其他提交）。确认无误后可加 --force 覆盖：" + e.message)
    }
    throw e
  }

  // 6) 同步本地远端引用，保持 git status 干净
  try {
    sh(`git update-ref refs/remotes/origin/${args.branch} ${commit.sha}`)
  } catch (e) {
    /* 本地引用更新失败不影响推送结果 */
  }

  console.log(`\n推送成功 → https://github.com/${owner}/${repo}/commit/${commit.sha}`)
}

main().catch((e) => {
  console.error("\n推送失败：" + (e.message || e))
  process.exit(1)
})
