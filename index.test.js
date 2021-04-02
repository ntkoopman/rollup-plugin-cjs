const { rollup } = require("rollup");
const cjs = require("./index.js");
const prettier = require("prettier");
const { wrap } = require("jest-snapshot-serializer-raw");

function execute(code) {
  const output = (value) => value;
  return eval(code);
}

async function format(chunk) {
  return wrap(prettier.format(chunk.code, { filepath: chunk.fileName }));
}

async function parse(options) {
  let bundle = await rollup(options);
  let { output } = await bundle.generate({});
  await bundle.close();
  return output.find((item) => item.fileName === "entry.js");
}

function virtual(options) {
  return {
    resolveId(source) {
      if (source in options) return source;
    },
    load(source) {
      return options[source];
    },
  };
}

it(`import from '.esm'`, async () => {
  let chunk = await parse({
    input: "entry.js",
    plugins: [
      virtual({
        "entry.js": `import lib from ".esm"; output(lib);`,
        ".esm": `export default "default"`,
      }),
      cjs(),
    ],
  });
  expect(execute(chunk.code)).toEqual("default");
  expect(await format(chunk)).toMatchInlineSnapshot(`
    var lib = "default";

    output(lib);

  `);
});

it(`import from '.cjs'`, async () => {
  let chunk = await parse({
    input: "entry.js",
    plugins: [
      virtual({
        "entry.js": `import lib, {named} from ".cjs"; output({lib, named});`,
        ".cjs": `module.exports.default = "default"; module.exports.named = "named";`,
      }),
      cjs(),
    ],
  });
  expect(execute(chunk.code)).toMatchObject({
    lib: { default: "default", named: "named" },
    named: "named",
  });
  expect(await format(chunk)).toMatchInlineSnapshot(`
    function defaultExport(exports) {
      return exports.__esModule ? exports.default : exports;
    }

    let module = { exports: {} };
    module.exports.default = "default";
    module.exports.named = "named";
    var lib = /*#__PURE__*/ defaultExport(module.exports);
    const __çjs$synthetic__ = module.exports;

    output({ lib, named: __çjs$synthetic__.named });

  `);
});

it(`import from '.esModule'`, async () => {
  let chunk = await parse({
    input: "entry.js",
    plugins: [
      virtual({
        "entry.js": `import lib, { named } from ".esModule"; output({ lib, named });`,
        ".esModule": `
          module.exports = (function () {
            let e = {};
            Object.defineProperty(e, "__esModule", { value: !0 });
            e.default = "default";
            e.named = "named";
            return e;
          })();
        `,
      }),
      cjs(),
    ],
  });
  expect(execute(chunk.code)).toMatchObject({
    lib: "default",
    named: "named",
  });
  expect(await format(chunk)).toMatchInlineSnapshot(`
    function defaultExport(exports) {
      return exports.__esModule ? exports.default : exports;
    }

    let module = { exports: {} };
    module.exports = (function () {
      let e = {};
      Object.defineProperty(e, "__esModule", { value: !0 });
      e.default = "default";
      e.named = "named";
      return e;
    })();

    var lib = /*#__PURE__*/ defaultExport(module.exports);
    const __çjs$synthetic__ = module.exports;

    output({ lib, named: __çjs$synthetic__.named });

  `);
});

it(`require('.esm')`, async () => {
  let chunk = await parse({
    input: "entry.js",
    plugins: [
      virtual({
        "entry.js": `const lib = require(".esm"); output(lib);`,
        ".esm": `export default "default"`,
      }),
      cjs(),
    ],
  });

  let actual = execute(chunk.code);
  expect(actual).toMatchObject({ default: "default" });
  expect(await format(chunk)).toMatchInlineSnapshot(`
    function require(module) {
      return module.__çjs$exports__ || module;
    }

    var _esm = "default";

    var __çjs__esm__ = /*#__PURE__*/ Object.freeze({
      __proto__: null,
      default: _esm,
    });

    const lib = /*#__PURE__*/ require(__çjs__esm__);
    output(lib);

  `);
});

it(`require('.cjs')`, async () => {
  let chunk = await parse({
    input: "entry.js",
    plugins: [
      virtual({
        "entry.js": `const lib = require(".cjs"); output( lib );`,
        ".cjs": `exports.default = "default"`,
      }),
      cjs(),
    ],
  });
  expect(execute(chunk.code)).toMatchObject({ default: "default" });
  expect(await format(chunk)).toMatchInlineSnapshot(`
    function require(module) {
      return module.__çjs$exports__ || module;
    }
    function defaultExport(exports) {
      return exports.__esModule ? exports.default : exports;
    }

    let module = { exports: {} };
    let exports = module.exports;
    exports.default = "default";
    var _cjs = /*#__PURE__*/ defaultExport(module.exports);
    const __çjs$synthetic__ = module.exports;
    const __çjs$exports__ = module.exports;

    var __çjs__cjs__ = /*#__PURE__*/ Object.freeze(
      /*#__PURE__*/ Object.assign(
        /*#__PURE__*/ Object.create(null),
        __çjs$synthetic__,
        {
          default: _cjs,
          __çjs$exports__: __çjs$exports__,
        }
      )
    );

    const lib = /*#__PURE__*/ require(__çjs__cjs__);
    output(lib);

  `);
});

it(`require('.esModule')`, async () => {
  let chunk = await parse({
    input: "entry.js",
    plugins: [
      virtual({
        "entry.js": `output(require(".esModule"));`,
        ".esModule": `module.exports.__esModule = true; module.exports.default = "default"; module.exports.named = "named";`,
      }),
      cjs(),
    ],
  });
  expect(execute(chunk.code)).toMatchObject({
    __esModule: true,
    default: "default",
    named: "named",
  });
  expect(await format(chunk)).toMatchInlineSnapshot(`
    function require(module) {
      return module.__çjs$exports__ || module;
    }
    function defaultExport(exports) {
      return exports.__esModule ? exports.default : exports;
    }

    let module = { exports: {} };
    module.exports.__esModule = true;
    module.exports.default = "default";
    module.exports.named = "named";
    var _esModule = /*#__PURE__*/ defaultExport(module.exports);
    const __çjs$synthetic__ = module.exports;
    const __çjs$exports__ = module.exports;

    var __çjs__esModule__ = /*#__PURE__*/ Object.freeze(
      /*#__PURE__*/ Object.assign(
        /*#__PURE__*/ Object.create(null),
        __çjs$synthetic__,
        {
          default: _esModule,
          __çjs$exports__: __çjs$exports__,
        }
      )
    );

    output(/*#__PURE__*/ require(__çjs__esModule__));

  `);
});

it(`import * from '.cjs'`, async () => {
  let chunk = await parse({
    input: "entry.js",
    plugins: [
      virtual({
        "entry.js": `import * as lib from ".cjs"; output(lib)`,
        ".cjs": `module.exports.default = "default"; module.exports.named = "named";`,
      }),
      cjs(),
    ],
  });
  expect(execute(chunk.code)).toMatchObject({
    default: { default: "default", named: "named" },
    named: "named",
  });
  expect(await format(chunk)).toMatchInlineSnapshot(`
    function defaultExport(exports) {
      return exports.__esModule ? exports.default : exports;
    }

    let module = { exports: {} };
    module.exports.default = "default";
    module.exports.named = "named";
    var _cjs = /*#__PURE__*/ defaultExport(module.exports);
    const __çjs$synthetic__ = module.exports;
    const __çjs$exports__ = module.exports;

    var lib = /*#__PURE__*/ Object.freeze(
      /*#__PURE__*/ Object.assign(
        /*#__PURE__*/ Object.create(null),
        __çjs$synthetic__,
        {
          default: _cjs,
          __çjs$exports__: __çjs$exports__,
        }
      )
    );

    output(lib);

  `);
});

it(`import * from '.esm'`, async () => {
  let chunk = await parse({
    input: "entry.js",
    plugins: [
      virtual({
        "entry.js": `import * as lib from ".esm"; output(lib)`,
        ".esm": `export default "default"; export const named = "named";`,
      }),
      cjs(),
    ],
  });
  expect(execute(chunk.code)).toMatchObject({
    default: "default",
    named: "named",
  });
  expect(await format(chunk)).toMatchInlineSnapshot(`
    var _esm = "default";
    const named = "named";

    var lib = /*#__PURE__*/ Object.freeze({
      __proto__: null,
      default: _esm,
      named: named,
    });

    output(lib);

  `);
});

it(`import * from '.esModule'`, async () => {
  let chunk = await parse({
    input: "entry.js",
    plugins: [
      virtual({
        "entry.js": `import * as lib from ".esModule"; output(lib)`,
        ".esModule": `module.exports.__esModule = true; module.exports.default = "default"; module.exports.named = "named";`,
      }),
      cjs(),
    ],
  });
  expect(execute(chunk.code)).toMatchObject({
    default: "default",
    named: "named",
  });
  expect(await format(chunk)).toMatchInlineSnapshot(`
    function defaultExport(exports) {
      return exports.__esModule ? exports.default : exports;
    }

    let module = { exports: {} };
    module.exports.__esModule = true;
    module.exports.default = "default";
    module.exports.named = "named";
    var _esModule = /*#__PURE__*/ defaultExport(module.exports);
    const __çjs$synthetic__ = module.exports;
    const __çjs$exports__ = module.exports;

    var lib = /*#__PURE__*/ Object.freeze(
      /*#__PURE__*/ Object.assign(
        /*#__PURE__*/ Object.create(null),
        __çjs$synthetic__,
        {
          default: _esModule,
          __çjs$exports__: __çjs$exports__,
        }
      )
    );

    output(lib);

  `);
});
