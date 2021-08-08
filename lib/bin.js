#!/usr/bin/env node

const {downloadAndPackageModule} = require('./index')

if (process.argv.length < 3) {
  console.log('Usage: standmo module[@version]...')
  process.exit(2)
}

for (const arg of process.argv.slice(2)) {
  downloadAndPackageModule(arg).catch(error => {
    console.error(error)
    process.exit(1)
  })
}
