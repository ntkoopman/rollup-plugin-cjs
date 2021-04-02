const fs = require("fs").promises;
const MagicString = require("magic-string");
const { walk } = require("estree-walker");
const jsTokens = require("js-tokens");

function generateName(pkg) {
  return `__çjs_${pkg.replaceAll(/[^$a-zA-Z0-9]/g, "")}__`;
}

function guessType(code) {
  for (let token of jsTokens(code)) {
    if (token.type === "IdentifierName") {
      switch (token.value) {
        case "import":
        case "export":
          return "esm";
        case "exports":
        case "require":
          return "cjs";
      }
    }
  }
  return "unknown";
}

const cache = {};

async function guessImportType(source, importer) {
  let resolved = await this.resolve(source, importer, { skipSelf: true });
  if (!resolved) return "unknown";
  let file = resolved.id;
  let value = cache[file];
  if (value !== undefined) return value;
  try {
    let buffer = await fs.readFile(file);
    let code = buffer.toString();
    cache[file] = value = guessType(code);
  } catch (e) {
    cache[file] = value = "unknown";
    this.error(e);
  }
  return value;
}

async function transformModule(code, id, options) {
  let ast = this.parse(code);
  let magicString = new MagicString(code);
  let imports = {};

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
        let alias = generateName(pkg);
        imports[pkg] = alias;
        magicString.overwrite(node.start, node.end, alias);
      }
    },
  });

  magicString.prepend(
    `let module = {exports:{}}; let exports = module.exports;\n\n`
  );
  magicString.append(`\nexport default module.exports;`);

  for (let [pkg, alias] of Object.entries(imports)) {
    if ((await guessImportType.call(this, pkg, id)) === "cjs") {
      magicString.prepend(`import ${alias} from '${pkg}';\n`);
    } else {
      magicString.prepend(`import * as ${alias} from '${pkg}';\n`);
    }
  }

  return {
    code: magicString.toString(),
    map: options.sourceMap ? magicString.generateMap() : null,
  };
}

async function transformImports(code, id, options) {
  let ast = this.parse(code);
  let magicString = new MagicString(code);
  let changedImports = false;

  for (let node of ast.body) {
    if (node.type === "ImportDeclaration") {
      let pkg = node.source.value;

      // Skip `import 'x'`
      if (node.specifiers.length === 0) continue;
      // Skip `import * as x from 'x'`
      if (node.specifiers[0].type === "ImportNamespaceSpecifier") continue;
      // Skip non-commonjs imports
      if ((await guessImportType.call(this, pkg, id)) !== "cjs") continue;

      let alias = generateName(pkg);
      magicString.overwrite(
        node.start,
        node.end,
        `import ${alias} from '${pkg}';\n`
      );
      for (let specifier of node.specifiers) {
        if (specifier.type === "ImportDefaultSpecifier") {
          magicString.appendRight(
            node.end,
            `const ${specifier.local.name} = ${alias}.__esModule ? ${alias}.default : ${alias};\n`
          );
        } else if (specifier.type === "ImportSpecifier") {
          magicString.appendRight(
            node.end,
            `const ${specifier.local.name} = ${alias}.${specifier.imported.name};\n`
          );
        } else {
          throw new Error(`Unknown specifier type: ${specifier.type}`);
        }
      }

      changedImports = true;
    }
  }

  if (!changedImports) return null;

  return {
    code: magicString.toString(),
    map: options.sourceMap ? magicString.generateMap() : null,
  };
}

module.exports = function cjs(options = { sourceMap: false }) {
  return {
    async transform(code, id) {
      switch (guessType(code)) {
        case "esm":
          return await transformImports.call(this, code, id, options);
        case "cjs":
          return await transformModule.call(this, code, id, options);
      }
    },
  };
};
