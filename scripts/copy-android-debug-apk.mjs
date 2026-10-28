import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const TAILDRIVE_BASE = process.env.TAILDRIVE_BASE || ''
const projectDir = process.cwd()
const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'))
const version = packageJson.version || '0.0.0'
const appName = 'Stremio Addon Manager'
const sourceApk =
  process.env.ANDROID_APK_SOURCE ||
  path.join(projectDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

if (!fs.existsSync(sourceApk)) {
  console.error(`APK source not found: ${sourceApk}`)
  process.exit(1)
}

const fileName = `${appName} ${version}.apk`
const outputDir = process.env.ANDROID_APK_DEST_DIR || path.join(projectDir, 'APKs')
fs.mkdirSync(outputDir, { recursive: true })
fs.copyFileSync(sourceApk, path.join(outputDir, fileName))
const apps = resolveDropboxApps()
if (apps) {
  const destination = path.join(apps, appName, fileName)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(sourceApk, destination)
  console.log('Copied APK to Dropbox: ' + destination)
} else if (TAILDRIVE_BASE && copyViaWebDav(sourceApk, appName, version)) {
  console.log('Copied APK to Dropbox via Taildrive: ' + fileName)
} else {
  throw new Error('Dropbox APK delivery failed; the build is not fully delivered')
}

function copyViaWebDav(sourcePath, name, buildVersion) {
  const fileName = `${name} ${buildVersion}.apk`
  const dirUrl = `${TAILDRIVE_BASE}/${encodeURIComponent(name)}/`
  const fileUrl = `${TAILDRIVE_BASE}/${encodeURIComponent(name)}/${encodeURIComponent(fileName)}`
  spawnSync('curl', ['-s', '-o', '/dev/null', '-X', 'MKCOL', '--connect-timeout', '5', dirUrl])
  const result = spawnSync(
    'curl',
    ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-T', sourcePath, '--connect-timeout', '5', '--max-time', '120', fileUrl],
    { encoding: 'utf8' },
  )
  if (result.error || result.status !== 0) {
    return false
  }
  const statusCode = parseInt(result.stdout, 10)
  return statusCode >= 200 && statusCode < 300
}

function resolveDropboxApps() {
  if (process.env.DROPBOX_APPS_DIR) {
    if (!fs.existsSync(process.env.DROPBOX_APPS_DIR)) throw new Error('Configured Dropbox Apps directory is unavailable')
    return process.env.DROPBOX_APPS_DIR
  }
  if (process.platform === 'win32') {
    const infoPath = path.join(process.env.LOCALAPPDATA || '', 'Dropbox', 'info.json')
    if (fs.existsSync(infoPath)) {
      const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'))
      const account = info.personal || info.business
      const apps = account?.path && path.join(account.path, 'Apps')
      if (apps && fs.existsSync(apps)) return apps
    }
  }
  return ['/mount/dropbox/Apps', '/mnt/d/Dropbox/Apps', '/mnt/c/Users/conta/Dropbox/Apps', '/mnt/c/Users/m_ack/Dropbox/Apps'].find(base => fs.existsSync(base)) || null
}
