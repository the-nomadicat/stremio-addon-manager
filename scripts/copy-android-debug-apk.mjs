import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'

const TAILDRIVE_BASE = 'http://100.100.100.100:8080/atkins.email@gmail.com/zephyrusg16/dropboxapps'
const projectDir = process.cwd()
const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'))
const version = packageJson.version || '0.0.0'
const appName = 'StremioAddonManager'
const sourceApk =
  process.env.ANDROID_APK_SOURCE ||
  path.join(projectDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

if (!fs.existsSync(sourceApk)) {
  console.error(`APK source not found: ${sourceApk}`)
  process.exit(1)
}

if (process.platform !== 'win32') {
  const uploaded = copyViaWebDav(sourceApk, appName, version)
  if (uploaded) {
    console.log(`Uploaded APK via TailDrive WebDAV: ${appName} ${version}.apk`)
    process.exit(0)
  }
  console.log('TailDrive WebDAV unavailable, falling back to local path...')
}

const destDir = process.env.ANDROID_APK_DEST_DIR || resolveDefaultDestDir(appName)
fs.mkdirSync(destDir, { recursive: true })

const destinationPath = path.join(destDir, `${appName} ${version}.apk`)
fs.copyFileSync(sourceApk, destinationPath)

const stats = fs.statSync(destinationPath)
console.log(`Copied APK: ${destinationPath}`)
console.log(`Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`)

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

function resolveDefaultDestDir(name) {
  for (const base of [
    '/mount/dropbox/Apps',
    '/mnt/c/Users/conta/Dropbox/Apps',
    '/mnt/d/Dropbox/Apps',
    '/mnt/c/Users/m_ack/Dropbox/Apps',
  ]) {
    if (!fs.existsSync(base)) {
      continue
    }

    const destination = path.join(base, name)
    fs.mkdirSync(destination, { recursive: true })
    return destination
  }

  return path.join(os.tmpdir(), name)
}
