const { rollup } = require("rollup");
const cjs = require("./index.js");
const prettier = require("prettier");
const { wrap } = require("jest-snapshot-serializer-raw");

function execute(code) {
  const output = (value) => value;
  return eval(code);
}

function format(chunk) {
  return wrap(prettier.format(chunk.code, { filepath: chunk.fileName }));
}

async function parse(options) {
  let bundle = await rollup(options);
  let { output } = await bundle.generate({});
  await bundle.close();
  return output.find((item) => item.fileName === "entry.js");
}

it("basic", async () => {
  let chunk = await parse({
    input: "test/basic/entry.js",
    plugins: [cjs()],
  });
  expect(format(chunk)).toMatchInlineSnapshot(`
    let module = { exports: {} };
    module.exports.default = "default";
    module.exports.named = "named";

    var __çjs_lib__ = module.exports;

    const lib = __çjs_lib__;
    const named = __çjs_lib__.named;

    output({ default: lib.default, named });

  `);
  expect(execute(chunk.code)).toStrictEqual({
    default: "default",
    named: "named",
  });
});

it("dynamic", async () => {
  let chunk = await parse({
    input: "test/dynamic/entry.js",
    plugins: [cjs()],
  });
  expect(format(chunk)).toMatchInlineSnapshot(`
    let module = { exports: {} };
    module.exports = (function () {
      let e = {};
      Object.defineProperty(e, "__esModule", { value: !0 });
      e.default = "default";
      e.named = "named";
      return e;
    })();

    var __çjs_lib__ = module.exports;

    const lib = __çjs_lib__.__esModule ? __çjs_lib__.default : __çjs_lib__;
    const named = __çjs_lib__.named;

    output({ default: lib, named });

  `);
  expect(execute(chunk.code)).toStrictEqual({
    default: "default",
    named: "named",
  });
});
