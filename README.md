# rollup-plugin-cjs-compat

Converts CommonJS files to ES modules in a way that's compatible with `__esModule` files.

Unlike `@rollup/plugin-commonjs`, this plugin will check for the existence of `__esModule` at
runtime. This will improve compatibility, but the downside is that tree-shaking will not work for
CommonJS files.

# Usage

This plugin should replace `@rollup/plugin-commonjs`:

```js
import cjs from "rollup-plugin-cjs-compat";

export default {
  input: "src/index.js",
  output: {
    dir: "output",
    format: "cjs",
  },
  plugins: [cjs()],
};
```
