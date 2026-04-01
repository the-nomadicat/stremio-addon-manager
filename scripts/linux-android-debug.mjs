import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const javaHome = resolveJavaHome()

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
    env: {
      ...process.env,
      ...(javaHome ? {
        JAVA_HOME: javaHome,
        PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
      } : {}),
      ...(options.env ?? {}),
    },
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
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

  return candidates.find(candidate => existsSync(candidate)) ?? ''
}

const linuxInstallEnv = {
  npm_config_omit: '',
  npm_config_include: 'dev',
  NODE_ENV: 'development',
}

run('npm', ['install', '--no-package-lock'], { env: linuxInstallEnv })
run('npm', ['install', '--no-save', '@esbuild/linux-x64', '@rollup/rollup-linux-x64-gnu'], { env: linuxInstallEnv })
run('npm', ['rebuild', 'esbuild'])
run('npx', ['vite', 'build'])
run('node', ['node_modules/@capacitor/cli/bin/capacitor', 'sync', 'android'])
run('chmod', ['+x', './gradlew'], { cwd: 'android' })
run('./gradlew', ['assembleDebug'], { cwd: 'android' })
run('node', ['scripts/copy-android-debug-apk.mjs'])
