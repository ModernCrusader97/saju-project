import type { Plugin } from "vite";

// Vinext Link caches the dynamically imported navigation module namespace.
// Vite's client default drops its facade and the named navigation functions.
// The bundler options hook keeps those exports through the supported Plugin API.
export function preserveClientModuleExports(): Plugin {
  return {
    name: "saju:preserve-client-module-exports",
    apply: "build",
    applyToEnvironment(environment) {
      return environment.name === "client";
    },
    options(inputOptions) {
      return { ...inputOptions, preserveEntrySignatures: "strict" };
    },
  };
}
