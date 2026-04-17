#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const isWin = process.platform === 'win32'
const command = isWin ? "powershell" : "node"
const args = isWin ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/deploy-android.ps1"] : ["scripts/linux-android-debug.mjs"]

const result = spawnSync(command, args, {
  stdio: 'inherit',
  shell: false,
})

if (result.error) throw result.error
process.exit(result.status ?? 0)
