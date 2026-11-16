// The shared core (packages/core) is plain TypeScript outside this folder:
// let Metro watch it and resolve its dependencies from here.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
const core = path.resolve(__dirname, '../../packages/core')
config.watchFolders = [...(config.watchFolders ?? []), core]
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]
config.resolver.unstable_enableSymlinks = true
module.exports = config
