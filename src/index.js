const fs = require('fs')
const path = require('path')

const execa = require('execa')
const useTmpDir = require('@m59/use-tmp-dir')
const terser = require('terser')

async function downloadAndPackageModule(name) {
  await useTmpDir(async tempDir => {
    await downloadModule(tempDir, name)
    await packageModule(tempDir)
  })
}

async function downloadModule(dir, name) {
  try {
    await execa('npm', ['install', '--global-style', name], {cwd: dir})
  } catch (error) {
    throw new Error('Failed to install module:\n' + error.stderr)
  }
}

async function packageModule(parentDir) {
  const modulesDir = path.join(parentDir, 'node_modules')
  const dirs = fs.readdirSync(modulesDir).filter((d) => d !== '.bin')
  if (dirs.length !== 1)
    throw new Error(`Multiple modules installed while there should only be one: ${dirs}`)
  const moduleName = dirs[0]
  const moduleDir = path.join(modulesDir, moduleName)
  const content = await runBrowserify(moduleName, require.resolve(moduleDir))
  const result = terser.minify(content)
  if (result.error)
    throw new Error(`Failed to minify code: ${result.error.message}`)
  const finalContent = await addInfo(moduleDir, result.code)
  fs.writeFileSync(moduleName + '.js', finalContent)
}

async function runBrowserify(moduleName, moduleFile) {
  try {
    const {stdout} = await execa('browserify', [
      '--standalone', moduleName,
      '--node',
      '--ignore-missing',
      moduleFile,
    ])
    return stdout
  } catch (error) {
    throw new Error('Failed to browserify module:\n' + error.stderr)
  }
}

async function addInfo(moduleDir, content) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(moduleDir, 'package.json')))
  let license = `License: ${packageJson.license}`
  const possibleLicenses = ['LICENSE', 'license', 'License', 'License.md']
  for (const l of possibleLicenses) {
    const p = path.join(moduleDir, l)
    if (fs.existsSync(p))
      license = fs.readFileSync(p).toString()
  }
  license = license.split('\n').map(l => ('// ' + l).trim()).join('\n')
  const comment = `// ${packageJson._id}\n//\n${license}\n`
  return comment + content
}

module.exports = {downloadAndPackageModule}
