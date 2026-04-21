import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const projectDir = process.cwd()
const packageJsonPath = path.join(projectDir, 'package.json')
const TAILDRIVE_BASE = 'http://100.100.100.100:8080/atkins.email@gmail.com/zephyrusg16/dropboxapps'
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const appName = packageJson.productName || 'StremioAddonManager'
const apkSource = path.join(projectDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
const dropboxDir = resolveDropboxDir(appName)
const javaHome = resolveJavaHome()

function resolveDropboxDir(appName) {
  const base = [
    '/mount/dropbox/Apps',
    '/mnt/c/Users/conta/Dropbox/Apps',
    '/mnt/d/Dropbox/Apps',
    '/mnt/c/Users/m_ack/Dropbox/Apps',
  ].find(candidate => fs.existsSync(candidate))

  if (!base) {
    return null
  }

  return path.join(base, appName)
}

function resolveJavaHome() {
  const candidates = [
    '/usr/lib/jvm/msopenjdk-21-amd64',
    '/usr/lib/jvm/java-21-openjdk-amd64',
    '/usr/lib/jvm/java-21-openjdk',
    '/opt/java/openjdk-21',
    '/usr/lib/jvm/java-17-openjdk-amd64',
    '/usr/lib/jvm/java-17-openjdk',
    '/usr/lib/jvm/default-java',
  ]

  return candidates.find(candidate => fs.existsSync(candidate)) ?? ''
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    cwd: options.cwd ?? projectDir,
    env: {
      ...process.env,
      ...(javaHome ? {
        JAVA_HOME: javaHome,
        PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
      } : {}),
      ...(options.env ?? {}),
    },
  })

  if (result.error) {
    throw result.error
  }

  if ((result.status ?? 0) !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

function bumpVersion() {
  const result = spawnSync('npm', ['version', 'patch', '--no-git-tag-version'], {
    cwd: projectDir,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    throw new Error('Version bump failed: ' + (result.stderr || result.stdout).trim())
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  if (!packageJson.version) {
    throw new Error(`No version found in ${packageJsonPath}`)
  }

  return packageJson.version
}

function copyViaWebDav(sourcePath, name, version) {
  const fileName = `${name} ${version}.apk`
  const dirUrl = `${TAILDRIVE_BASE}/${encodeURIComponent(name)}/`
  const fileUrl = `${TAILDRIVE_BASE}/${encodeURIComponent(name)}/${encodeURIComponent(fileName)}`
  spawnSync('curl', ['-s', '-o', '/dev/null', '-X', 'MKCOL', '--connect-timeout', '5', dirUrl])
  const result = spawnSync(
    'curl',
    ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-T', sourcePath, '--connect-timeout', '5', '--max-time', '120', fileUrl],
    { encoding: 'utf8' },
  )
  if (result.error || result.status !== 0) {
    console.warn('[TailDrive] curl error:', result.error?.message ?? 'exit ' + result.status)
    return false
  }
  const statusCode = parseInt(result.stdout, 10)
  if (statusCode < 200 || statusCode >= 300) {
    console.warn('[TailDrive] HTTP', statusCode)
    return false
  }
  return true
}

function copyApk(version) {
  const fileName = appName + ' ' + version + '.apk'
  const sizeMb = (fs.statSync(apkSource).size / 1024 / 1024).toFixed(2)

  // Primary: always copy to project APKs/ folder
  const apksDir = path.join(projectDir, 'APKs')
  fs.mkdirSync(apksDir, { recursive: true })
  const apksDest = path.join(apksDir, fileName)
  fs.copyFileSync(apkSource, apksDest)
  console.log('Built APK (-> APKs/): ' + fileName + ' (' + sizeMb + ' MB)')

  // Optional: try TailDrive — skip silently if unavailable
  if (process.platform !== 'win32') {
    console.log('[TailDrive] Uploading APK...')
    const uploaded = copyViaWebDav(apkSource, appName, version)
    if (uploaded) console.log('[TailDrive] Upload successful.')
    else console.warn('[TailDrive] Not available — APK saved to APKs/ folder.')
  }
}

const linuxInstallEnv = {
  npm_config_omit: '',
  npm_config_include: 'dev',
  NODE_ENV: 'development',
}

function needsInstall(dir) {
  const nodeModules = path.join(dir, 'node_modules')
  if (!fs.existsSync(nodeModules)) return true
  const nmMtime = fs.statSync(nodeModules).mtimeMs
  // Only check package-lock.json — package.json changes on every version bump
  // but that doesn't require reinstalling deps
  const lockFile = path.join(dir, 'package-lock.json')
  if (!fs.existsSync(lockFile)) return true
  return fs.statSync(lockFile).mtimeMs > nmMtime
}

function installDependencies(dir) {
  if (!needsInstall(dir)) {
    console.log('Dependencies up to date, skipping install in ' + path.basename(dir))
    return
  }
  run('npm', ['install', '--include=dev', '--no-package-lock'], {
    cwd: dir,
    env: { NODE_ENV: 'development', npm_config_include: 'dev' }
  })
}

const appVersion = bumpVersion()

installDependencies(projectDir)
run('npm', ['install', '--no-save', '--force', '@esbuild/linux-x64', '@rollup/rollup-linux-x64-gnu'], { env: linuxInstallEnv })
run('npm', ['rebuild', 'esbuild'])
run('npx', ['vite', 'build'])
run('node', ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android'])
run('chmod', ['+x', './gradlew'], { cwd: 'android' })
run('./gradlew', ['assembleDebug'], { cwd: 'android' })
copyApk(appVersion)
