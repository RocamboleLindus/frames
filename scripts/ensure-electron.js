const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const electronRoot = path.join(__dirname, '..', 'node_modules', 'electron')
const dist = path.join(electronRoot, 'dist')
const expected = require(path.join(electronRoot, 'package.json')).version

function platformBinary() {
  if (process.platform === 'win32') return 'electron.exe'
  if (process.platform === 'darwin') return 'Electron.app/Contents/MacOS/Electron'
  return 'electron'
}

function isReady() {
  try {
    const binary = platformBinary()
    const version = fs.readFileSync(path.join(dist, 'version'), 'utf8').trim().replace(/^v/, '')
    const pointer = fs.readFileSync(path.join(electronRoot, 'path.txt'), 'utf8').trim()
    return version === expected && pointer === binary && fs.existsSync(path.join(dist, binary))
  } catch {
    return false
  }
}

async function main() {
  if (isReady()) return
  const { downloadArtifact } = require('@electron/get')
  const zipPath = await downloadArtifact({
    version: expected,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch,
    checksums: require(path.join(electronRoot, 'checksums.json'))
  })
  fs.mkdirSync(dist, { recursive: true })
  execFileSync('tar', ['-xf', zipPath, '-C', dist], { stdio: 'inherit' })
  fs.writeFileSync(path.join(electronRoot, 'path.txt'), platformBinary())
  if (!isReady()) throw new Error('Electron did not finish extracting.')
  console.log('Electron runtime ready')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
