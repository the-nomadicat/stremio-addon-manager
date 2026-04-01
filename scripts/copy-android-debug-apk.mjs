import fs from 'node:fs'
import path from 'node:path'

const projectDir = process.cwd()
const packageJson = JSON.parse(
  fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'),
)

const version = packageJson.version || '0.0.0'
const sourceApk =
  process.env.ANDROID_APK_SOURCE ||
  path.join(projectDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

if (!fs.existsSync(sourceApk)) {
  console.error(`APK source not found: ${sourceApk}`)
  process.exit(1)
}

const defaultDestDir =
  process.env.ANDROID_APK_DEST_DIR ||
  '/mount/dropbox/Apps/StremioAddonManager'

fs.mkdirSync(defaultDestDir, { recursive: true })

const destinationPath = path.join(
  defaultDestDir,
  `StremioAddonManager ${version}.apk`,
)

fs.copyFileSync(sourceApk, destinationPath)

const stats = fs.statSync(destinationPath)
console.log(`Copied APK: ${destinationPath}`)
console.log(`Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`)
