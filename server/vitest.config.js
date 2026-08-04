// 后端测试配置（node:sqlite 无需编译，纯 Node 运行）
const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    // 后端源码为 CommonJS，测试用 .mjs 以便使用 top-level await 与动态 import
    include: ['tests/**/*.test.mjs'],
    // 每个测试文件使用独立临时库，避免污染真实数据
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/index.js', 'src/migrate.js']
    }
  }
});
