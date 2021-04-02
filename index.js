const fs = require("fs").promises;
const MagicString = require("magic-string");
const { walk } = require("estree-walker");
const { createFilter, makeLegalIdentifier } = require("@rollup/pluginutils");

module.exports = function cjs(options = {}) {
  let config = {
    sourceMap: false,
    ...options,
  };
  let filter = createFilter(config.include, config.exclude);
  return {
    resolveId(source) {
      if (source === "rollup-plugin-cjs-compat/helper") return source;
    },

    load(source) {
      if (source === "rollup-plugin-cjs-compat/helper") {
        return `
          export function require(module) { return module.__çjs$exports__ || module; }
          export function defaultExport(exports) { return exports.__esModule ? exports.default : exports; }
        `;
      }
    },

    async transform(code, id) {
      if (!filter(id)) return;

      let ast = this.parse(code);

      // Do not convert esm files
      for (let node of ast.body) {
        switch (node.type) {
          case "ImportDeclaration":
          case "ExportDefaultDeclaration":
          case "ExportNamedDeclaration":
            return;
        }
      }

      let magicString = new MagicString(code);
      let imports = new Map();
      let exports = false;

      walk(ast, {
        enter(node) {
          if (
            node.type === "CallExpression" &&
            node.callee.type === "Identifier" &&
            node.callee.name === "require"
          ) {
            if (
              node.arguments.length !== 1 ||
              node.arguments[0].type !== "Literal"
            ) {
              throw new Error(`${id}: Unsupported usage of "require"`);
            }
            let pkg = node.arguments[0].value;
            let alias = `__çjs_${makeLegalIdentifier(pkg)}__`;
            imports.set(pkg, alias);
            magicString.overwrite(
              node.start,
              node.end,
              `/*#__PURE__*/__çjs$require__(${alias})`
            );
          } else if (node.type === "Identifier" && node.name === "exports") {
            exports = true;
          }
        },
      });

      // If there are no imports and exports, tell rollup that we didn't do anything
      if (!exports && imports.size === 0) {
        return null;
      }

      if (exports && !this.getModuleInfo(id).isEntry) {
        magicString.prepend(
          `let module = { exports: {} }; let exports = module.exports;\n`
        );
        magicString.append(
          `\nexport default /*#__PURE__*/__çjs$default__(module.exports);`
        );
        magicString.append(
          `\nexport const __çjs$synthetic__ = module.exports; export const __çjs$exports__ = module.exports;`
        );
      }

      for (let [pkg, alias] of imports.entries()) {
        magicString.prepend(`import * as ${alias} from '${pkg}';\n`);
      }

      magicString.prepend(
        `import {require as __çjs$require__, defaultExport as __çjs$default__} from "rollup-plugin-cjs-compat/helper";\n`
      );

      return {
        code: magicString.toString(),
        map: config.sourceMap ? magicString.generateMap() : null,
        syntheticNamedExports: "__çjs$synthetic__",
      };
    },
  };
};
