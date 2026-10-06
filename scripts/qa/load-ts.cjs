// Isolated TypeScript execution: project source, explicit mocks, and the pinned offline calendar only.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const trustedOfflineModules = { 'korean-lunar-calendar': require('korean-lunar-calendar') };

function createLoader(mocks = {}, globals = {}) {
  const cache = new Map();
  function load(filename) {
    const file = path.resolve(root, filename);
    if (cache.has(file)) return cache.get(file).exports;
    const exports = {};
    const context = vm.createContext({
      exports, module: { exports }, Error, SyntaxError, TypeError,
      console: { warn() {}, error() {} },
      ...globals,
      require(specifier) {
        if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
        if (Object.hasOwn(trustedOfflineModules, specifier)) return trustedOfflineModules[specifier];
        const resolved = specifier.startsWith('@/') ? path.join(root, specifier.slice(2))
          : specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : null;
        if (!resolved || !resolved.startsWith(root + path.sep)) throw new Error(`Unmocked dependency: ${specifier}`);
        return load(resolved.endsWith('.ts') ? resolved : resolved + '.ts');
      },
    });
    cache.set(file, { exports, context });
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    vm.runInContext(compiled, context, { filename: file, timeout: 2000 });
    return exports;
  }
  return {
    load,
    run(filename, expression, timeout = 1000) {
      load(filename);
      return vm.runInContext(expression, cache.get(path.resolve(root, filename)).context, { timeout });
    },
  };
}
module.exports = { createLoader };
