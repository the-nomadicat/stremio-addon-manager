import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(scriptDir, '..')
const packageFiles = [
  path.join(projectDir, 'package.json'),
  path.join(projectDir, 'src-capacitor', 'package.json'),
].filter(file => fs.existsSync(file))

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n')
}

function incrementPatchVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) {
    throw new Error(`Unsupported version format: ${version}`)
  }

  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3]) + 1}`
}

const rootPackage = readJson(path.join(projectDir, 'package.json'))
const nextVersion = incrementPatchVersion(rootPackage.version)
for (const file of packageFiles) {
  const json = readJson(file)
  json.version = nextVersion
  writeJson(file, json)
}
process.stdout.write(nextVersion + '\n')
