#!/usr/bin/env node
// Small runner to execute TypeScript seed using ts-node with CommonJS transpilation
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'CommonJS' },
  skipProject: true,
})
require('./seed.ts')

