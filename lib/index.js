const fs = require('fs')
const path = require('path')

const execa = require('execa')
const useTmpDir = require('@m59/use-tmp-dir')
const terser = require('terser')

async function downloadAndPackageModule(name, options={fromBin: false}) {
  await useTmpDir(async tempDir => {
    await downloadModule(tempDir, name)
    await packageModule(tempDir, options)
  })
}

async function downloadModule(dir, name) {
  try {
    await execa('npm', ['install', '--global-style', name], {cwd: dir})
  } catch (error) {
    throw new Error('Failed to install module:\n' + error.stderr)
  }
}

async function packageModule(parentDir, options) {
  const modulesDir = path.join(parentDir, 'node_modules')
  const ignoreFiles = ['.bin', '.package-lock.json']
  const dirs = fs.readdirSync(modulesDir).filter((d) => !ignoreFiles.includes(d))
  if (dirs.length !== 1)
    throw new Error(`Multiple modules installed while there should only be one: ${dirs}`)
  const moduleName = dirs[0]
  const moduleDir = path.join(modulesDir, moduleName)
  const packageJson = JSON.parse(fs.readFileSync(path.join(moduleDir, 'package.json')))
  if (options.fromBin) {
    if (!packageJson.bin)
      throw new Error('package.json file does not have "bin" field')
    if (typeof packageJson.bin === 'string') {
      await packageFile(packageJson, moduleDir, moduleName, path.join(moduleDir, packageJson.bin))
    } else if (typeof packageJson.bin === 'object') {
      for (const name in packageJson.bin)
        await packageFile(packageJson, moduleDir, name, path.join(moduleDir, packageJson.bin[name]))
    } else {
      throw new Error(`Unrecognized "bin" field: ${packageJson.bin}`)
    }
  } else {
    await packageFile(packageJson, moduleDir, moduleName, require.resolve(moduleDir))
  }
}

async function packageFile(packageJson, dir, name, file) {
  const content = await runBrowserify(name, file)
  const result = await terser.minify(content)
  if (result.error)
    throw new Error(`Failed to minify code: ${result.error.message}`)
  const finalContent = await addInfo(packageJson, dir, result.code)
  fs.writeFileSync(name + '.js', finalContent)
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

async function addInfo(packageJson, dir, content) {
  let license = `License: ${packageJson.license}`
  const possibleLicenses = ['LICENSE', 'license', 'License', 'License.md']
  for (const l of possibleLicenses) {
    const p = path.join(dir, l)
    if (fs.existsSync(p))
      license = fs.readFileSync(p).toString()
  }
  license = license.split('\n').map(l => ('// ' + l).trim()).join('\n')
  const comment = `// ${packageJson._id}\n//\n${license}\n`
  return comment + content
}

module.exports = {downloadAndPackageModule}
