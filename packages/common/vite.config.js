"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vite_1 = require("vite");
var path_1 = require("path");
var vite_plugin_dts_1 = require("vite-plugin-dts");
// https://vitejs.dev/config/
exports.default = (0, vite_1.defineConfig)({
  build: {
    lib: {
      entry: (0, path_1.resolve)(__dirname, "src/index.ts"),
      formats: ["es"],
    },
  },
  resolve: { alias: { src: (0, path_1.resolve)("src/") } },
  plugins: [(0, vite_plugin_dts_1.default)()],
});
