# rollup-plugin-cjs

Converts CommonJS files to ES modules in a way that's compatible with `__esModule` files.

Unlike `@rollup/plugin-commonjs`, this plugin will check for the existence of `__esModule` at
runtime, which should improve compatibility with packages in the wild.

# Usage

This plugin should replace `@rollup/plugin-commonjs`:

```js
import cjs from "rollup-plugin-cjs";

export default {
  input: "src/index.js",
  output: {
    dir: "output",
  },
  plugins: [cjs()],
};
```

# Current limitations

- Importing using a re-assigned `require` (e.g. `(function(r){r('lib')})(require)`) will not work.
- No tree-shaking for CommonJS.
- When using `import * as lib from 'commonjs-lib` the imported values are not live.
- Dynamic `require` is not supported.

All of these could be fixed, they are just not implemented at the moment.
