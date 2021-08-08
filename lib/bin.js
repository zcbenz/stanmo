#!/usr/bin/env node

const {downloadAndPackageModule} = require('./index')

if (process.argv.length < 3) {
  console.log('Usage: standmo [--bin] module[@version]...')
  process.exit(2)
}

const fromBin = process.argv.includes('--bin')

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--'))
    continue
  downloadAndPackageModule(arg, {fromBin}).catch(error => {
    console.error(error)
    process.exit(1)
  })
}
