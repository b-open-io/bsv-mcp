#!/usr/bin/env bun
// @bun

// scripts/local-mcp-launcher.ts
import { spawn } from "child_process";
import { existsSync as existsSync2, lstatSync as lstatSync2, mkdirSync as mkdirSync2, realpathSync } from "fs";
import { homedir as homedir2, tmpdir } from "os";
import {
  basename,
  dirname,
  isAbsolute as isAbsolute2,
  join as join2,
  relative,
  resolve as resolve2
} from "path";
import { fileURLToPath } from "url";

// utils/accounts.ts
import {
  chmodSync,
  closeSync,
  existsSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeSync
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function joinValues(array, separator = "|") {
  return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}

class Cached {
  constructor(getter) {
    this._getter = getter;
    this._value = undefined;
  }
  get value() {
    const getter = this._getter;
    if (getter !== undefined) {
      this._value = getter();
      this._getter = undefined;
    }
    return this._value;
  }
}
function cached(getter) {
  return new Cached(getter);
}
function nullish(input) {
  return input === null || input === undefined;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function rawShape(def) {
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  return desc?.get ? desc.get.raw : desc?.value;
}
function sourceShape(schema) {
  return rawShape(schema._zod.def) ?? schema._zod.def.shape;
}
function deferProp(target, key, getter) {
  Object.defineProperty(target, key, {
    get() {
      const value = getter();
      assignProp(this, key, value);
      return value;
    },
    enumerable: true,
    configurable: true
  });
}
function putProp(target, key, value) {
  if (key in target)
    assignProp(target, key, value);
  else
    target[key] = value;
}
function mirrorShape(target, source, keys, wrap) {
  const raw = sourceShape(source);
  for (const key of keys) {
    const desc = Object.getOwnPropertyDescriptor(raw, key);
    if (!desc.enumerable)
      continue;
    if (desc.get) {
      deferProp(target, key, () => {
        const value = source._zod.def.shape[key];
        return wrap ? wrap(value, key) : value;
      });
    } else
      putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
  }
}
function mirrorProps(target, source) {
  for (const key of Reflect.ownKeys(source)) {
    const desc = Object.getOwnPropertyDescriptor(source, key);
    if (!desc.enumerable)
      continue;
    if (desc.get)
      deferProp(target, key, () => source[key]);
    else
      putProp(target, key, desc.value);
  }
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
  return JSON.stringify(str);
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
var allowsEval = /* @__PURE__ */ cached(() => {
  if (globalConfig.jitless) {
    return false;
  }
  if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
    return false;
  }
  try {
    const F = Function;
    new F("");
    return true;
  } catch (_) {
    return false;
  }
});
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === undefined)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  if (o instanceof Map)
    return new Map(o);
  if (o instanceof Set)
    return new Set(o);
  return o;
}
var propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== undefined) {
    if (params?.error !== undefined)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function stringifyPrimitive(value) {
  if (typeof value === "bigint")
    return value.toString() + "n";
  if (typeof value === "string")
    return `"${value}"`;
  return `${value}`;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin !== undefined && shape[k]._zod.optout === "optional";
  });
}
var NUMBER_FORMAT_RANGES = /* @__PURE__ */ (() => ({
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-340282346638528860000000000000000000000, 340282346638528860000000000000000000000],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
}))();
var BIGINT_FORMAT_RANGES = {
  int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
  uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const newShape = {};
  mirrorShape(newShape, schema, maskedKeys(schema, mask));
  return clone(schema, mergeDefs(currDef, { shape: newShape, checks: [] }));
}
function maskedKeys(schema, mask) {
  const raw = sourceShape(schema);
  const keys = [];
  for (const key of Reflect.ownKeys(mask)) {
    if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) {
      throw new Error(`Unrecognized key: "${String(key)}"`);
    }
    if (mask[key])
      keys.push(key);
  }
  return keys;
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const omitted = new Set(maskedKeys(schema, mask));
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
  return clone(schema, mergeDefs(currDef, { shape: newShape, checks: [] }));
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    const existingShape = sourceShape(schema);
    for (const key of Reflect.ownKeys(shape)) {
      if (Object.getOwnPropertyDescriptor(existingShape, key) !== undefined) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function extended(schema, shape) {
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
  mirrorProps(newShape, shape);
  return newShape;
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function merge(a, b) {
  if (!b?._zod?.def) {
    throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
  }
  if (a._zod.def.checks?.length) {
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  }
  const newShape = {};
  mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
  mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
  const def = mergeDefs(a._zod.def, {
    shape: newShape,
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: b._zod.def.checks ?? []
  });
  return clone(a, def);
}
function partial(Class, schema, mask, name = "partial") {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
  }
  const selected = mask ? new Set(maskedKeys(schema, mask)) : undefined;
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class && ((value, key) => selected && !selected.has(key) ? value : new Class({ type: "optional", innerType: value })));
  return clone(schema, mergeDefs(schema._zod.def, { shape: newShape, checks: [] }));
}
function required(Class, schema, mask) {
  const selected = mask ? new Set(maskedKeys(schema, mask)) : undefined;
  const newShape = {};
  mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => selected && !selected.has(key) ? value : new Class({ type: "nonoptional", innerType: value }));
  return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex;i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex;i < x.issues.length; i++) {
    if (x.issues[i]?.continue === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path, issues) {
  return issues.map((iss) => {
    var _a;
    (_a = iss).path ?? (_a.path = []);
    iss.path.unshift(path);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function attachSchema(issues, start, inst) {
  var _a;
  for (let i = start;i < issues.length; i++) {
    (_a = issues[i]).schema ?? (_a.schema = inst);
  }
}
function finalizeIssue(iss, ctx, config) {
  var _a;
  const traits = iss.inst?._zod?.traits;
  if (traits?.has("$ZodType")) {
    if (traits.has("$ZodCheck"))
      (_a = iss).schema ?? (_a.schema = iss.inst);
    else
      iss.schema = iss.inst;
  }
  const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : undefined;
  const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
  const full = {};
  for (const k of Object.keys(iss)) {
    if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__")
      continue;
    full[k] = iss[k];
  }
  full.path ?? (full.path = []);
  full.message = message;
  if (ctx?.reportInput) {
    full.input = iss.input;
  }
  return full;
}
var highSurrogate = /[\uD800-\uDBFF]/;
function codePointLength(str) {
  const units = str.length;
  if (!highSurrogate.test(str))
    return units;
  let count = units;
  for (let i = 0;i < units - 1; i++) {
    if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
      count--;
      i++;
    }
  }
  return count;
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function parsedType(data) {
  const t = typeof data;
  switch (t) {
    case "number": {
      return Number.isNaN(data) ? "nan" : "number";
    }
    case "object": {
      if (data === null) {
        return "null";
      }
      if (Array.isArray(data)) {
        return "array";
      }
      const obj = data;
      if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) {
        return obj.constructor.name;
      }
    }
  }
  return t;
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
function members(proto, table) {
  for (const key in table) {
    const desc = Object.getOwnPropertyDescriptor(table, key);
    if (desc.get)
      Object.defineProperty(proto, key, { ...desc, enumerable: false });
    else
      defineBound(proto, key, desc.value);
  }
  for (const sym of Object.getOwnPropertySymbols(table)) {
    defineBound(proto, sym, table[sym]);
  }
}
function own(inst, key, value, enumerable = true) {
  Object.defineProperty(inst, key, { configurable: true, writable: true, enumerable, value });
  return value;
}
function hide(inst, key, value) {
  return own(inst, key, value, false);
}
function derived(computes, table) {
  for (const key in computes) {
    const compute = computes[key];
    Object.defineProperty(table, key, {
      configurable: true,
      enumerable: true,
      get() {
        return own(this, key, compute(this));
      },
      set(value) {
        own(this, key, value);
      }
    });
  }
  return table;
}
function defineBound(proto, key, fn) {
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      return this == null ? fn : own(this, key, fn.bind(this));
    },
    set(value) {
      own(this, key, value);
    }
  });
}
function claim(inst, sentinel) {
  const proto = Object.getPrototypeOf(inst);
  return sentinel in proto ? undefined : proto;
}
var installing;
var broke = false;
var breaker = {
  configurable: true,
  get() {
    broke = true;
    return;
  }
};
function defineLazyInternal(inst, key, compute) {
  const proto = Object.getPrototypeOf(inst._zod);
  if (key in proto && installing !== inst._zod) {
    installing = undefined;
    return;
  }
  installing = inst._zod;
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      Object.defineProperty(this, key, breaker);
      const outer = broke;
      broke = false;
      try {
        const value = compute(this);
        if (broke)
          delete this[key];
        else
          Object.defineProperty(this, key, { configurable: true, writable: true, value });
        broke = broke || outer;
        return value;
      } catch (err) {
        delete this[key];
        broke = broke || outer;
        throw err;
      }
    },
    set(value) {
      Object.defineProperty(this, key, { configurable: true, writable: true, value });
    }
  });
}
function installLazyProp(inst, key, make, enumerable) {
  const proto = claim(inst, key);
  if (!proto)
    return;
  Object.defineProperty(proto, key, {
    configurable: true,
    get() {
      const desc = { configurable: true, writable: true, enumerable, value: undefined };
      Object.defineProperty(this, key, desc);
      desc.value = make(this);
      Object.defineProperty(this, key, desc);
      return desc.value;
    },
    set(value) {
      Object.defineProperty(this, key, { configurable: true, writable: true, enumerable, value });
    }
  });
}
var CONSTANT_CATCH = "~constantCatch";
function constantCatch(value) {
  const fn = () => value;
  fn[CONSTANT_CATCH] = true;
  return fn;
}

// node_modules/zod/v4/core/core.js
var _a;
var _zodDesc = { value: undefined, enumerable: false };
var _E = "captureStackTrace" in Error ? Error : null;
function newError(Definition) {
  const E = _E;
  if (E) {
    const saved = E.stackTraceLimit;
    if (typeof saved === "number") {
      try {
        E.stackTraceLimit = 0;
      } catch {
        _E = null;
        return new Definition;
      }
      try {
        return new Definition;
      } finally {
        E.stackTraceLimit = saved;
      }
    }
  }
  return new Definition;
}
function $constructor(name, initializer, proto, params) {
  const zodProto = {};
  function Internals(def) {
    this.def = def;
    this.constr = _;
    this.traits = new Set;
  }
  Internals.prototype = zodProto;
  const protoMembers = proto;
  const initialized = protoMembers && new WeakSet;
  function init(inst, def) {
    if (!inst._zod) {
      _zodDesc.value = new Internals(def);
      try {
        Object.defineProperty(inst, "_zod", _zodDesc);
      } finally {
        _zodDesc.value = undefined;
      }
    }
    if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer(inst, def);
    if (initialized) {
      const own = Object.getPrototypeOf(inst);
      const ctorProto = inst._zod.constr.prototype;
      let up = own;
      while (up && up !== ctorProto)
        up = Object.getPrototypeOf(up);
      const target = up ?? own;
      if (!initialized.has(target)) {
        initialized.add(target);
        members(target, protoMembers);
      }
    }
    const proto = _.prototype;
    for (const k in proto) {
      if (!Object.prototype.hasOwnProperty.call(proto, k))
        continue;
      if (!(k in inst)) {
        inst[k] = proto[k].bind(inst);
      }
    }
  }
  const Parent = params?.Parent ?? Object;

  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    const inst = params?.Parent ? newError(Definition) : this;
    init(inst, def);
    const deferred = inst._zod.deferred;
    if (deferred) {
      for (const fn of deferred) {
        fn();
      }
      inst._zod.deferred = undefined;
    }
    const pp = globalThis.__zod_globalConfig?.postProcessor;
    if (pp)
      pp(inst);
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
class $ZodAsyncError extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
}

class $ZodEncodeError extends Error {
  constructor(name) {
    super(`Encountered unidirectional transform during encode: ${name}`);
    this.name = "ZodEncodeError";
  }
}
(_a = globalThis).__zod_globalConfig ?? (_a.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}
// node_modules/zod/v4/core/errors.js
function _getMessage() {
  const internals = this._zod;
  internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
  return internals.message;
}
function _setMessage(value) {
  this._zod.message = value;
}
var _messageDesc = {
  get: _getMessage,
  set: _setMessage,
  enumerable: true,
  configurable: true
};
var _issuesDesc = { value: undefined, enumerable: false };
var _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
var initializer = (inst, def) => {
  inst.name = "$ZodError";
  _issuesDesc.value = def;
  Object.defineProperty(inst, "issues", _issuesDesc);
  _issuesDesc.value = undefined;
  Object.defineProperty(inst, "message", _messageDesc);
  const proto = Object.getPrototypeOf(inst);
  if (!_installedToString.has(proto)) {
    _installedToString.add(proto);
    Object.defineProperty(proto, "toString", {
      configurable: true,
      enumerable: false,
      get() {
        const value = () => this.message;
        Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
        return value;
      },
      set(value) {
        Object.defineProperty(this, "toString", { value, configurable: true, writable: true });
      }
    });
  }
};
var $ZodError = $constructor("$ZodError", initializer);
var $ZodRealError = $constructor("$ZodError", initializer, undefined, {
  Parent: Error
});
function node(obj, key, make) {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) {
    if (key === "__proto__") {
      Object.defineProperty(obj, key, { value: make(), writable: true, enumerable: true, configurable: true });
    } else {
      obj[key] = make();
    }
  }
  return obj[key];
}
function flattenError(error, mapper = (issue) => issue.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error.issues) {
    if (sub.path.length > 0) {
      node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error, mapper = (issue) => issue.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error, path = []) => {
    for (const issue of error.issues) {
      if (issue.code === "invalid_union" && issue.errors.length) {
        issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
      } else if (issue.code === "invalid_key") {
        processError({ issues: issue.issues }, [...path, ...issue.path]);
      } else if (issue.code === "invalid_element") {
        processError({ issues: issue.issues }, [...path, ...issue.path]);
      } else {
        const fullpath = [...path, ...issue.path];
        if (fullpath.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < fullpath.length) {
            const el = fullpath[i];
            const terminal = i === fullpath.length - 1;
            if (el === "_errors") {
              if (terminal)
                curr._errors.push(mapper(issue));
              i++;
              continue;
            }
            if (!Object.prototype.hasOwnProperty.call(curr, el)) {
              Object.defineProperty(curr, el, {
                value: { _errors: [] },
                enumerable: true,
                writable: true,
                configurable: true
              });
            }
            const node = curr[el];
            if (terminal) {
              node._errors.push(mapper(issue));
            }
            curr = node;
            i++;
          }
        }
      }
    }
  };
  processError(error);
  return fieldErrors;
}

// node_modules/zod/v4/core/parse.js
function finalizeParams(callee, params) {
  return { callee: params?.callee ?? callee, Err: params?.Err };
}
var _parse = (_Err) => {
  const fn = (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
      throw new $ZodAsyncError;
    }
    if (result.issues.length) {
      const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, _params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
};
var _parseAsync = (_Err) => {
  const fn = async (schema, value, _ctx, params) => {
    const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
      result = await result;
    if (result.issues.length) {
      const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
      captureStackTrace(e, params?.callee ?? fn);
      throw e;
    }
    return result.value;
  };
  return fn;
};
var _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError;
  }
  return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
};
function failure(Err, issues, ctx) {
  let error;
  return {
    success: false,
    get error() {
      if (!error) {
        error = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
        issues = undefined;
        ctx = undefined;
      }
      return error;
    },
    set error(e) {
      error = e;
      issues = undefined;
      ctx = undefined;
    }
  };
}
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? failure(_Err, result.issues, ctx) : { success: true, data: result.value };
};
var COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
var COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
var validate = (schema, value, _ctx) => {
  const validator = schema._zod.bag.validator;
  if (validator !== undefined) {
    if (validator(value) !== COMPILE_INVALID)
      return true;
    if (validator.definite === true && _ctx === undefined)
      return false;
  }
  return validateFallback(schema, value, _ctx);
};
function validateFallback(schema, value, _ctx) {
  const ctx = _ctx ? { ..._ctx, async: false, abortEarly: true } : { async: false, abortEarly: true };
  const fallbackRun = schema._zod.bag.fallbackRun;
  let result;
  if (fallbackRun) {
    ctx[COMPILE_FALLBACK] = true;
    result = fallbackRun({ value, issues: [] }, ctx);
  } else {
    result = schema._zod.run({ value, issues: [] }, ctx);
  }
  if (result instanceof Promise) {
    throw new $ZodAsyncError;
  }
  return result.issues.length === 0;
}
var validateAsync = async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true, abortEarly: true } : { async: true, abortEarly: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length === 0;
};
var _encode = (_Err) => {
  const parse = _parse(_Err);
  const fn = (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return parse(schema, value, ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _decode = (_Err) => {
  const parse = _parse(_Err);
  const fn = (schema, value, _ctx, _params) => {
    return parse(schema, value, _ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _encodeAsync = (_Err) => {
  const parseAsync = _parseAsync(_Err);
  const fn = async (schema, value, _ctx, _params) => {
    const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
    return await parseAsync(schema, value, ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _decodeAsync = (_Err) => {
  const parseAsync = _parseAsync(_Err);
  const fn = async (schema, value, _ctx, _params) => {
    return await parseAsync(schema, value, _ctx, finalizeParams(fn, _params));
  };
  return fn;
};
var _safeEncode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParse(_Err)(schema, value, ctx);
};
var _safeDecode = (_Err) => (schema, value, _ctx) => {
  return _safeParse(_Err)(schema, value, _ctx);
};
var _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value, ctx);
};
var _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _safeParseAsync(_Err)(schema, value, _ctx);
};
// node_modules/zod/v4/core/regexes.js
var cuid = /^[cC][0-9a-z]{6,}$/;
var cuid2 = /^[0-9a-z]+$/;
var ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
var xid = /^[0-9a-vA-V]{20}$/;
var ksuid = /^[A-Za-z0-9]{27}$/;
var nanoid = /^[a-zA-Z0-9_-]{21}$/;
function nanoidOfLength(length) {
  return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
}
var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
var guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
var uuid = (version) => {
  if (!version)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
var email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
var _emoji = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
function emoji() {
  return new RegExp(_emoji, "u");
}
var ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
var cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
var cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
var base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
var httpProtocol = /^https?$/;
var e164 = /^\+[1-9]\d{6,14}$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
function anchor(source) {
  return new RegExp(`^${source}$`);
}
var date = /* @__PURE__ */ anchor(dateSource);
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
  const opts = ["Z"];
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const qualified = `${timeSource({ precision: args.precision, seconds: true })}(?:${opts.join("|")})`;
  const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var anyString = /^[\s\S]{0,}$/;
var lowercase = /^[^A-Z]*$/;
var uppercase = /^[^a-z]*$/;

// node_modules/zod/v4/core/checks.js
var $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a = inst._zod).onattach ?? (_a.onattach = []);
});
var _whenHasLength = (payload) => {
  const val = payload.value;
  return !nullish(val) && val.length !== undefined;
};
var $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a;
  $ZodCheck.init(inst, def);
  (_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units > def.maximum ? codePointLength(input) : units;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a;
  $ZodCheck.init(inst, def);
  (_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a;
  $ZodCheck.init(inst, def);
  (_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
  inst._zod.check = (payload) => {
    const input = payload.value;
    const units = input.length;
    const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a, _b;
  $ZodCheck.init(inst, def);
  if (def.pattern)
    (_a = inst._zod).check ?? (_a.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {});
});
var $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
  def.pattern ?? (def.pattern = lowercase);
  $ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
  def.pattern ?? (def.pattern = uppercase);
  $ZodCheckStringFormat.init(inst, def);
});
var $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
  $ZodCheck.init(inst, def);
  const escapedRegex = escapeRegex(def.includes);
  const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
  def.pattern = pattern;
  inst._zod.check = (payload) => {
    if (payload.value.includes(def.includes, def.position))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: def.includes,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.check = (payload) => {
    if (payload.value.startsWith(def.prefix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: def.prefix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.check = (payload) => {
    if (payload.value.endsWith(def.suffix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: def.suffix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    payload.value = def.tx(payload.value);
  };
});

// node_modules/zod/v4/core/doc.js
class Doc {
  constructor(args = [], closed = {}) {
    this.content = [];
    this.indent = 0;
    this.args = args;
    this.closed = closed;
  }
  indented(fn) {
    this.indent += 1;
    try {
      fn(this);
    } finally {
      this.indent -= 1;
    }
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split(`
`).filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const content = this?.content ?? [``];
    const factory = new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {
${content.join(`
`)}
};`);
    return factory(...Object.values(this.closed));
  }
}

// node_modules/zod/v4/core/versions.js
var version = {
  major: 4,
  minor: 6,
  patch: 1
};

// node_modules/zod/v4/core/schemas.js
var $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const defChecks = inst._zod.def.checks;
  const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a = inst._zod).deferred ?? (_a.deferred = []);
    inst._zod.deferred?.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks, ctx) => {
      if (payload.memo)
        return payload;
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks) {
        if (ch._zod.def.when) {
          if (explicitlyAborted(payload))
            continue;
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && ctx?.async === false) {
          throw new $ZodAsyncError;
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            attachSchema(payload.issues, currLen, inst);
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          attachSchema(payload.issues, currLen, inst);
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError;
        return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary) => {
            return handleCanaryResult(canary, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError;
        return result.then((result) => runChecks(result, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
}, {
  get "~standard"() {
    return hide(this, "~standard", standardProps(this));
  },
  set "~standard"(value) {
    own(this, "~standard", value);
  }
});
var toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
async function validateAsync2(inst, value) {
  const ctx = { async: true };
  return toStandardResult(await inst._zod.run({ value, issues: [] }, ctx), ctx);
}
function standardProps(inst) {
  return {
    validate: (value) => {
      const ctx = { async: false };
      try {
        const r = inst._zod.run({ value, issues: [] }, ctx);
        if (!(r instanceof Promise))
          return toStandardResult(r, ctx);
      } catch (_) {}
      return validateAsync2(inst, value);
    },
    vendor: "zod",
    version: 1
  };
}
var $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = def.pattern ?? anyString;
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_) {}
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
var $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
var $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
  def.pattern ?? (def.pattern = guid);
  $ZodStringFormat.init(inst, def);
});
var $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
  if (def.version) {
    const versionMap = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    };
    const v = versionMap[def.version];
    if (v === undefined)
      throw new Error(`Invalid UUID version: "${def.version}"`);
    def.pattern ?? (def.pattern = uuid(v));
  } else
    def.pattern ?? (def.pattern = uuid());
  $ZodStringFormat.init(inst, def);
});
var $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
  def.pattern ?? (def.pattern = email);
  $ZodStringFormat.init(inst, def);
});
var URL_BAD_FORMAT = 1;
var URL_UNPARSEABLE = 2;
function parseURLObject(trimmed, def) {
  if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) {
    return URL_BAD_FORMAT;
  }
  try {
    return new URL(trimmed);
  } catch {
    return URL_UNPARSEABLE;
  }
}
var asciiTabOrNewline = /[\t\n\r]/g;
function stripTabAndNewline(value) {
  return value.replace(asciiTabOrNewline, "");
}
function urlHostnameOk(url, hostname) {
  hostname.lastIndex = 0;
  return hostname.test(url.hostname);
}
function urlProtocolOk(url, protocol) {
  protocol.lastIndex = 0;
  return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
}
var $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    try {
      const trimmed = payload.value.trim();
      const url = parseURLObject(trimmed, def);
      if (url === URL_BAD_FORMAT) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid URL format",
          input: payload.value,
          inst,
          continue: !def.abort
        });
        return;
      }
      if (url === URL_UNPARSEABLE) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          input: payload.value,
          inst,
          continue: !def.abort
        });
        return;
      }
      if (def.hostname && !urlHostnameOk(url, def.hostname)) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid hostname",
          pattern: def.hostname.source,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
      if (def.protocol && !urlProtocolOk(url, def.protocol)) {
        payload.issues.push({
          code: "invalid_format",
          format: "url",
          note: "Invalid protocol",
          pattern: def.protocol.source,
          input: payload.value,
          inst,
          continue: !def.abort
        });
      }
      payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
  def.pattern ?? (def.pattern = emoji());
  $ZodStringFormat.init(inst, def);
});
var $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
  if (def.length !== undefined && (!Number.isInteger(def.length) || def.length < 1))
    throw new Error(`Invalid nanoid length: ${def.length}`);
  def.pattern ?? (def.pattern = def.length === undefined ? nanoid : nanoidOfLength(def.length));
  $ZodStringFormat.init(inst, def);
});
var $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
  def.pattern ?? (def.pattern = cuid);
  $ZodStringFormat.init(inst, def);
});
var $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
  def.pattern ?? (def.pattern = cuid2);
  $ZodStringFormat.init(inst, def);
});
var $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
  def.pattern ?? (def.pattern = ulid);
  $ZodStringFormat.init(inst, def);
});
var $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
  def.pattern ?? (def.pattern = xid);
  $ZodStringFormat.init(inst, def);
});
var $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
  def.pattern ?? (def.pattern = ksuid);
  $ZodStringFormat.init(inst, def);
});
var $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
  def.pattern ?? (def.pattern = datetime(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
  def.pattern ?? (def.pattern = date);
  $ZodStringFormat.init(inst, def);
});
var $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
  def.pattern ?? (def.pattern = time(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
  def.pattern ?? (def.pattern = duration);
  $ZodStringFormat.init(inst, def);
});
var $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
  def.pattern ?? (def.pattern = ipv4);
  $ZodStringFormat.init(inst, def);
});
var ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
function isValidIPv6(value) {
  if (!ipv6Alphabet.test(value))
    return false;
  try {
    new URL(`http://[${value}]`);
    return true;
  } catch {
    return false;
  }
}
var $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
  def.pattern ?? (def.pattern = ipv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (!isValidIPv6(payload.value)) {
      payload.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv4);
  $ZodStringFormat.init(inst, def);
});
function isValidCIDRv6(value) {
  const parts = value.split("/");
  if (parts.length !== 2)
    return false;
  const [address, prefix] = parts;
  if (!prefix)
    return false;
  const prefixNum = Number(prefix);
  if (`${prefixNum}` !== prefix)
    return false;
  if (prefixNum < 0 || prefixNum > 128)
    return false;
  return isValidIPv6(address);
}
var $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (!isValidCIDRv6(payload.value)) {
      payload.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
function isValidBase64(data) {
  if (data === "")
    return true;
  if (/\s/.test(data))
    return false;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
var base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
var $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
  def.pattern ?? (def.pattern = base64Charset);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidBase64(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var base64urlCharset = /^[A-Za-z0-9_-]*$/;
function isValidBase64URL(data) {
  if (!base64urlCharset.test(data))
    return false;
  const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return isValidBase64(padded);
}
var $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
  def.pattern ?? (def.pattern = base64urlCharset);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidBase64URL(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
  def.pattern ?? (def.pattern = e164);
  $ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
var $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidJWT(payload.value, def.alg))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
var $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    payload.issues.push({
      expected: "never",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
var $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  const memo = globalConfig.memoizer;
  memo?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
    const proms = [];
    const abortEarly = ctx?.abortEarly;
    for (let i = 0;i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result) => handleArrayResult(result, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
        if (abortEarly && result.issues.length !== 0 && aborted(result))
          break;
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
function handlePropertyResult(result, final, key, input, optin, optout) {
  const isPresent = key in input;
  const isOptionalOut = optout === "optional";
  if (!isPresent && isOptionalOut && optin === "optional") {
    return;
  }
  if (result.issues.length) {
    if (optin !== undefined && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (!isPresent && optin === undefined) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: undefined,
        path: [key]
      });
    }
    return;
  }
  if (result.value === undefined) {
    if (isPresent) {
      final.value[key] = undefined;
    }
  } else {
    final.value[key] = result.value;
  }
}
var NO_SYMBOL_KEYS = [];
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  const ownSymbols = Object.getOwnPropertySymbols(def.shape);
  const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
  const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
  for (const k of allKeys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    allKeys,
    symbolKeys,
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const optin = _catchall.optin;
  const optout = _catchall.optout;
  let seen = 0;
  for (const key in input) {
    if (abortEarly && payload.issues.length !== seen) {
      if (aborted(payload, seen))
        break;
      seen = payload.issues.length;
    }
    if (keySet.has(key))
      continue;
    if (key === "__proto__") {
      if (t === "never")
        unrecognized.push(key);
      continue;
    }
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
    } else {
      handlePropertyResult(r, payload, key, input, optin, optout);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst,
      continue: true
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
var $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  const sh = desc?.get ? desc.get.raw : def.shape ?? {};
  if (sh) {
    const get = () => {
      const newSh = { ...sh };
      Object.defineProperty(def, "shape", { value: newSh });
      get.raw = newSh;
      return newSh;
    };
    get.raw = sh;
    Object.defineProperty(def, "shape", { get });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazyInternal(inst, "propValues", (zod) => {
    const shape = zod.def.shape;
    const propValues = {};
    for (const key in shape) {
      const field = shape[key]._zod;
      if (field.values) {
        if (!Object.prototype.hasOwnProperty.call(propValues, key)) {
          assignProp(propValues, key, new Set);
        }
        for (const v of field.values)
          propValues[key].add(v);
        if (field.optin !== undefined)
          propValues[key].add(undefined);
      }
    }
    return propValues;
  });
  const isObject2 = isObject;
  const catchall = def.catchall;
  let value;
  const memo = globalConfig.memoizer;
  memo?.attach(inst);
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject2(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
    const proms = [];
    const shape = value.shape;
    const abortEarly = ctx?.abortEarly;
    let seen = payload.issues.length;
    for (const key of value.allKeys) {
      if (abortEarly && payload.issues.length !== seen) {
        if (aborted(payload, seen))
          break;
        seen = payload.issues.length;
      }
      if (key === "__proto__")
        continue;
      const el = shape[key];
      const optin = el._zod.optin;
      const optout = el._zod.optout;
      const r = el._zod.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
      } else {
        handlePropertyResult(r, payload, key, input, optin, optout);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
  };
});
var $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
  $ZodObject.init(inst, def);
  const superParse = inst._zod.parse;
  const _normalized = cached(() => normalizeDef(def));
  const memo = globalConfig.memoizer;
  const generateFastpass = (shape) => {
    const normalized = _normalized.value;
    const syms = normalized.symbolKeys;
    const doc = new Doc(["payload", "ctx"], { shape, inst, memo, syms });
    const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
    const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
    doc.write(`const input = payload.value;`);
    const ids = Object.create(null);
    let counter = 0;
    for (const key of normalized.allKeys) {
      ids[key] = `key_${counter++}`;
    }
    doc.write(memo ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
    for (const key of normalized.allKeys) {
      if (key === "__proto__")
        continue;
      const id = ids[key];
      const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
      const isPresent = `${k} in input`;
      const schema = shape[key];
      const optin = schema?._zod?.optin;
      const isOptionalIn = optin !== undefined;
      const isOptionalOut = schema?._zod?.optout === "optional";
      doc.write(`const ${id} = ${parseStr(k)};`);
      if (isOptionalIn && isOptionalOut) {
        const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
        doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
      } else if (!isOptionalIn) {
        doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
      } else {
        doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        
        if (${id}.value === undefined) {
          if (${isPresent}) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
      }
    }
    doc.write(`payload.value = newResult;`);
    doc.write(`return payload;`);
    return doc.compile();
  };
  let fastpass;
  const isObject2 = isObject;
  const jit = !globalConfig.jitless;
  const allowsEval2 = allowsEval;
  const fastEnabled = jit && allowsEval2.value;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject2(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
      if (!fastpass)
        fastpass = generateFastpass(def.shape);
      payload = fastpass(payload, ctx);
      if (!catchall)
        return payload;
      return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
    }
    return superParse(payload, ctx);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
var $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== undefined) ? "optional" : undefined);
  defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : undefined);
  defineLazyInternal(inst, "values", (zod) => {
    if (zod.def.options.every((o) => o._zod.values)) {
      return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return;
  });
  defineLazyInternal(inst, "pattern", (zod) => {
    if (zod.def.options.every((o) => o._zod.pattern)) {
      const patterns = zod.def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return;
  });
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results) => {
      return handleUnionResults(results, payload, inst, ctx);
    });
  };
});
var $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    const left = def.left._zod.run({ value: input, issues: [] }, ctx);
    const right = def.right._zod.run({ value: input, issues: [] }, ctx);
    const async = left instanceof Promise || right instanceof Promise;
    if (async) {
      return Promise.all([left, right]).then(([left, right]) => {
        return handleIntersectionResults(payload, left, right);
      });
    }
    return handleIntersectionResults(payload, left, right);
  };
});
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    if (Object.prototype.hasOwnProperty.call(newObj, "__proto__"))
      delete newObj.__proto__;
    for (const key of sharedKeys) {
      if (key === "__proto__")
        continue;
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0;index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  const unrecKeys = new Map;
  let unrecIssue;
  const keyIssues = new Map;
  const collect = (iss, side) => {
    let keys;
    if (iss.code === "unrecognized_keys" && !iss.path?.length) {
      unrecIssue ?? (unrecIssue = iss);
      keys = iss.keys;
    } else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
      const k = String(iss.path[0]);
      if (!keyIssues.has(k))
        keyIssues.set(k, iss);
      keys = [k];
    } else {
      return false;
    }
    for (const k of keys) {
      if (!unrecKeys.has(k))
        unrecKeys.set(k, {});
      unrecKeys.get(k)[side] = true;
    }
    return true;
  };
  for (const iss of left.issues) {
    if (!collect(iss, "l"))
      result.issues.push(iss);
  }
  for (const iss of right.issues) {
    if (!collect(iss, "r"))
      result.issues.push(iss);
  }
  const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
  if (bothKeys.length) {
    const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
    if (aggregated.length)
      result.issues.push({ ...unrecIssue, keys: aggregated });
    for (const k of bothKeys) {
      if (!aggregated.includes(k) && keyIssues.has(k))
        result.issues.push(keyIssues.get(k));
    }
  }
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    if (aborted(result))
      return result;
    throw new Error(`Unmergable intersection. Error path: ` + `${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
var $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values = getEnumValues(def.entries);
  const valuesSet = new Set(values);
  inst._zod.values = valuesSet;
  defineLazyInternal(inst, "pattern", (zod) => {
    const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
    return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
  });
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  const values = new Set(def.values);
  inst._zod.values = values;
  defineLazyInternal(inst, "pattern", (zod) => {
    const vals = zod.def.values;
    return new RegExp(vals.length ? `^(${vals.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$` : "^[^\\s\\S]$");
  });
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (values.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: def.values,
      input,
      inst
    });
    return payload;
  };
});
var $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  globalConfig.memoizer?.guard(inst);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    const _out = def.transform(payload.value, payload);
    if (ctx.async) {
      const output = _out instanceof Promise ? _out : Promise.resolve(_out);
      return output.then((output) => {
        payload.value = output;
        return payload;
      });
    }
    if (_out instanceof Promise) {
      throw new $ZodAsyncError;
    }
    payload.value = _out;
    return payload;
  };
});
function handleOptionalResult(payload, result) {
  payload.value = result.issues.length ? undefined : result.value;
  return payload;
}
var $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
  inst._zod.optout = "optional";
  defineLazyInternal(inst, "values", (zod) => {
    const values = zod.def.innerType._zod.values;
    return values ? new Set([...values, undefined]) : undefined;
  });
  defineLazyInternal(inst, "pattern", (zod) => {
    const pattern = zod.def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : undefined;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === undefined) {
      if (def.innerType._zod.optin !== "defaulted")
        return payload;
      const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
      if (result instanceof Promise)
        return result.then((result) => handleOptionalResult(payload, result));
      return handleOptionalResult(payload, result);
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
  inst._zod.parse = (payload, ctx) => {
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
  defineLazyInternal(inst, "pattern", (zod) => {
    const pattern = zod.def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : undefined;
  });
  defineLazyInternal(inst, "values", (zod) => {
    return zod.def.innerType._zod.values ? new Set([...zod.def.innerType._zod.values, null]) : undefined;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "defaulted";
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === undefined) {
      payload.value = def.defaultValue;
      return payload;
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result) => handleDefaultResult(result, def));
    }
    return handleDefaultResult(result, def);
  };
});
function handleDefaultResult(payload, def) {
  if (payload.value === undefined) {
    payload.value = def.defaultValue;
  }
  return payload;
}
var $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "defaulted";
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === undefined) {
      payload.value = def.defaultValue;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => {
    const v = zod.def.innerType._zod.values;
    return v ? new Set([...v].filter((x) => x !== undefined)) : undefined;
  });
  inst._zod.parse = (payload, ctx) => {
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result) => handleNonOptionalResult(result, inst));
    }
    return handleNonOptionalResult(result, inst);
  };
});
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === undefined) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
function handleCatchResult(payload, result, def, ctx) {
  if (!result.issues.length) {
    payload.value = result.value;
    if (result.memo)
      payload.memo = true;
    return payload;
  }
  payload.value = def.catchValue({
    ...result,
    value: payload.value,
    error: {
      issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
    },
    input: payload.value
  });
  return payload;
}
var $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run({ value: payload.value, issues: [] }, ctx);
    if (result instanceof Promise) {
      return result.then((result) => handleCatchResult(payload, result, def, ctx));
    }
    return handleCatchResult(payload, result, def, ctx);
  };
});
var $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
  defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
  defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right) => handlePipeResult(right, def.in, ctx));
      }
      return handlePipeResult(right, def.in, ctx);
    }
    const left = def.in._zod.run(payload, ctx);
    if (left instanceof Promise) {
      return left.then((left) => handlePipeResult(left, def.out, ctx));
    }
    return handlePipeResult(left, def.out, ctx);
  };
});
function handlePipeResult(left, next, ctx) {
  if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
var $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
  defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
  defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
  defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then(handleReadonlyResult);
    }
    return handleReadonlyResult(result);
  };
});
function handleReadonlyResult(payload) {
  if (!payload.memo)
    payload.value = Object.freeze(payload.value);
  return payload;
}
var $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r) => handleRefineResult(r, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      path: [...inst._zod.def.path ?? []],
      continue: !inst._zod.def.abort
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}
function handlePropertiesResult(result, payload, key) {
  if (result.issues.length) {
    payload.issues.push(...prefixIssues(key, result.issues));
  }
}
var $ZodProperties = /* @__PURE__ */ $constructor("$ZodProperties", (inst, def) => {
  $ZodType.init(inst, def);
  $ZodCheck.init(inst, def);
  const memo = globalConfig.memoizer;
  memo?.attach(inst);
  let entries;
  const runShape = (payload, ctx) => {
    entries ?? (entries = Reflect.ownKeys(def.shape).map((key) => [key, def.shape[key]]));
    const input = payload.value;
    let proms;
    for (const [key, schema] of entries) {
      const result = schema._zod.run({ value: input[key], issues: [] }, ctx);
      if (result instanceof Promise) {
        proms ?? (proms = []);
        proms.push(result.then((result) => handlePropertiesResult(result, payload, key)));
      } else {
        handlePropertiesResult(result, payload, key);
      }
    }
    if (proms)
      return Promise.all(proms).then(() => {
        return;
      });
    return;
  };
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (input === null || typeof input !== "object" && typeof input !== "function") {
      payload.issues.push({ expected: "object", code: "invalid_type", input, inst });
      return payload;
    }
    if (ctx.direction === "backward")
      ctx = { ...ctx, direction: "forward" };
    if (memo)
      memo.alloc(inst, payload, input, ctx);
    const result = runShape(payload, ctx);
    return result instanceof Promise ? result.then(() => payload) : payload;
  };
  inst._zod.check = (payload) => {
    if (payload.value == null) {
      payload.issues.push({ expected: "object", code: "invalid_type", input: payload.value, inst });
      return;
    }
    return runShape(payload, {});
  };
}, {
  *[Symbol.iterator]() {
    yield this;
  }
});
// node_modules/zod/v4/core/memoizer.js
class $ZodCyclicError extends Error {
  constructor() {
    super(`Cannot parse a reference cycle that closes through a transform`);
    this.name = "ZodCyclicError";
  }
}
var STATE = "~memo";
var NO_ISSUES = [];
function isRef(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}
function cloneIssues(issues) {
  return issues.map((iss) => iss.path ? { ...iss, path: iss.path.slice() } : { ...iss });
}
var recursive = /* @__PURE__ */ new WeakMap;
var NONE = 0;
var ASSUMED = 1;
var PROVEN = 2;
function isRecursive(inst, stack, resolve) {
  const cached = recursive.get(inst);
  if (cached !== undefined)
    return cached ? PROVEN : NONE;
  if (stack.has(inst))
    return PROVEN;
  stack.add(inst);
  let result = NONE;
  const check = (child) => {
    if (result !== PROVEN && child?._zod) {
      const answer = isRecursive(child, stack, resolve);
      if (answer > result)
        result = answer;
    }
  };
  const shape = (sh, spread) => {
    let answer = NONE;
    for (const key of Reflect.ownKeys(sh)) {
      const desc = Object.getOwnPropertyDescriptor(sh, key);
      if (spread && !desc.enumerable)
        continue;
      const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
      if (child > answer)
        answer = child;
    }
    return answer;
  };
  const merge = (answer) => {
    if (answer > result)
      result = answer;
  };
  const def = inst._zod.def;
  const kind = def.type;
  switch (kind) {
    case "object": {
      const raw = rawShape(def);
      merge(raw ? shape(raw, true) : ASSUMED);
      check(def.catchall);
      break;
    }
    case "properties":
      merge(shape(def.shape, false));
      break;
    case "array":
      check(def.element);
      break;
    case "tuple":
      for (const el of def.items)
        check(el);
      check(def.rest);
      break;
    case "record":
    case "map":
      check(def.keyType);
      check(def.valueType);
      break;
    case "set":
      check(def.valueType);
      break;
    case "union":
      for (const el of def.options)
        check(el);
      break;
    case "intersection":
      check(def.left);
      check(def.right);
      break;
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "catch":
    case "readonly":
    case "nonoptional":
    case "promise":
    case "success":
      check(def.innerType);
      break;
    case "pipe":
      check(def.in);
      check(def.out);
      break;
    case "function":
      check(def.input);
      check(def.output);
      break;
    case "lazy": {
      const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : undefined);
      merge(inner ? isRecursive(inner, stack, false) : ASSUMED);
      break;
    }
    case "template_literal":
    case "string":
    case "number":
    case "int":
    case "boolean":
    case "bigint":
    case "symbol":
    case "undefined":
    case "null":
    case "void":
    case "never":
    case "any":
    case "unknown":
    case "date":
    case "nan":
    case "enum":
    case "literal":
    case "file":
    case "transform":
    case "custom":
      break;
    default: {
      for (const key in def) {
        const desc = Object.getOwnPropertyDescriptor(def, key);
        if (!desc || desc.get)
          continue;
        const value = desc.value;
        if (!value || typeof value !== "object")
          continue;
        if (value._zod)
          check(value);
        else if (Array.isArray(value))
          for (const el of value)
            check(el);
      }
    }
  }
  stack.delete(inst);
  return settle(inst, result);
}
function settle(inst, answer) {
  if (answer !== ASSUMED)
    recursive.set(inst, answer === PROVEN);
  return answer;
}
function bucketFor(state, inst) {
  let bucket = state.buckets.get(inst);
  if (!bucket) {
    bucket = new WeakMap;
    state.buckets.set(inst, bucket);
  }
  return bucket;
}
var handoff;
var open = [];
var memo = {
  alloc(_inst, payload, empty) {
    const bucket = handoff;
    if (!bucket)
      return empty;
    handoff = undefined;
    const entry = { value: empty, issues: null };
    bucket.set(payload.value, entry);
    open.push(entry);
    return empty;
  },
  guard(inst) {
    var _a;
    (_a = inst._zod).deferred ?? (_a.deferred = []);
    inst._zod.deferred.push(() => {
      const base = inst._zod.parse;
      const wrapped = (payload, ctx) => {
        if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value))
          throw new $ZodCyclicError;
        return base(payload, ctx);
      };
      inst._zod.parse = wrapped;
      if (inst._zod.run === base)
        inst._zod.run = wrapped;
    });
  },
  attach(inst) {
    var _a;
    let isRecursiveInst;
    let rechecked = false;
    let lastCtx;
    let lastBucket;
    (_a = inst._zod).deferred ?? (_a.deferred = []);
    inst._zod.deferred.push(() => {
      const base = inst._zod.parse;
      const wrapped = (payload, ctx) => {
        if (isRecursiveInst === undefined) {
          const walked = isRecursive(inst, new Set, false);
          if (walked === NONE) {
            inst._zod.parse = base;
            if (inst._zod.run === wrapped)
              inst._zod.run = base;
            return base(payload, ctx);
          }
          if (walked === PROVEN || rechecked)
            isRecursiveInst = true;
          else
            rechecked = true;
        }
        const input = payload.value;
        if (!isRef(input))
          return base(payload, ctx);
        let state = ctx[STATE];
        if (!state) {
          state = { buckets: new WeakMap, backEdges: undefined };
          ctx[STATE] = state;
        }
        let bucket;
        if (lastCtx === ctx) {
          bucket = lastBucket;
        } else {
          bucket = bucketFor(state, inst);
          lastCtx = ctx;
          lastBucket = bucket;
        }
        const hit = bucket.get(input);
        if (hit) {
          payload.value = hit.value;
          if (hit.issues) {
            if (hit.issues.length)
              payload.issues.push(...cloneIssues(hit.issues));
          } else {
            payload.memo = true;
            state.backEdges ?? (state.backEdges = new WeakSet);
            state.backEdges.add(hit.value);
          }
          return payload;
        }
        handoff = bucket;
        const depth = open.length;
        const result = base(payload, ctx);
        handoff = undefined;
        const entry = open.length > depth ? open.pop() : undefined;
        if (result instanceof Promise) {
          return result.then((r) => {
            if (entry)
              entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
            return r;
          });
        }
        if (entry)
          entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
        return result;
      };
      inst._zod.parse = wrapped;
      if (inst._zod.run === base)
        inst._zod.run = wrapped;
    });
  }
};
function memoizer() {
  return memo;
}
function isBackEdge(ctx, value) {
  const backEdges = ctx[STATE]?.backEdges;
  return backEdges !== undefined && isRef(value) && backEdges.has(value);
}
// node_modules/zod/v4/locales/en.js
var error = () => {
  const Sizable = {
    string: { unit: "characters", verb: "to have" },
    file: { unit: "bytes", verb: "to have" },
    array: { unit: "items", verb: "to have" },
    set: { unit: "items", verb: "to have" },
    map: { unit: "entries", verb: "to have" }
  };
  function getSizing(origin) {
    return Sizable[origin] ?? null;
  }
  const FormatDictionary = {
    regex: "input",
    email: "email address",
    url: "URL",
    emoji: "emoji",
    uuid: "UUID",
    uuidv4: "UUIDv4",
    uuidv6: "UUIDv6",
    nanoid: "nanoid",
    guid: "GUID",
    cuid: "cuid",
    cuid2: "cuid2",
    ulid: "ULID",
    xid: "XID",
    ksuid: "KSUID",
    datetime: "ISO datetime",
    date: "ISO date",
    time: "ISO time",
    duration: "ISO duration",
    ipv4: "IPv4 address",
    ipv6: "IPv6 address",
    mac: "MAC address",
    cidrv4: "IPv4 range",
    cidrv6: "IPv6 range",
    base64: "base64-encoded string",
    base64url: "base64url-encoded string",
    json_string: "JSON string",
    e164: "E.164 number",
    credit_card: "credit card number",
    iban: "IBAN",
    jwt: "JWT",
    template_literal: "input"
  };
  const TypeDictionary = {
    nan: "NaN"
  };
  function getTypeName(type, input) {
    if (type === "number" && typeof input === "number" && !Number.isFinite(input)) {
      return String(input);
    }
    return TypeDictionary[type] ?? type;
  }
  return (issue) => {
    switch (issue.code) {
      case "invalid_type": {
        const expected = getTypeName(issue.expected);
        const receivedType = parsedType(issue.input);
        const received = getTypeName(receivedType, issue.input);
        return `Invalid input: expected ${expected}, received ${received}`;
      }
      case "invalid_value":
        if (issue.values.length === 1)
          return `Invalid input: expected ${stringifyPrimitive(issue.values[0])}`;
        return `Invalid option: expected one of ${joinValues(issue.values, "|")}`;
      case "too_big": {
        const adj = issue.exact ? "exactly " : issue.inclusive ? "<=" : "<";
        const sizing = getSizing(issue.origin);
        if (sizing)
          return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
        return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
      }
      case "too_small": {
        const adj = issue.exact ? "exactly " : issue.inclusive ? ">=" : ">";
        const sizing = getSizing(issue.origin);
        if (sizing) {
          return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
        }
        return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
      }
      case "invalid_format": {
        const _issue = issue;
        if (_issue.format === "starts_with") {
          return `Invalid string: must start with "${_issue.prefix}"`;
        }
        if (_issue.format === "ends_with")
          return `Invalid string: must end with "${_issue.suffix}"`;
        if (_issue.format === "includes")
          return `Invalid string: must include "${_issue.includes}"`;
        if (_issue.format === "regex")
          return `Invalid string: must match pattern ${_issue.pattern}`;
        return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${issue.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${joinValues(issue.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${issue.origin}`;
      case "invalid_union":
        if (issue.options && Array.isArray(issue.options) && issue.options.length > 0) {
          const opts = issue.options.map((o) => `'${o}'`).join(" | ");
          return `Invalid discriminator value. Expected ${opts}`;
        }
        if (issue.inclusive === false) {
          return "Invalid input: more than one option matched";
        }
        return "Invalid input";
      case "invalid_element":
        return `Invalid value in ${issue.origin}`;
      default:
        return `Invalid input`;
    }
  };
};
function en_default() {
  return {
    localeError: error()
  };
}
// node_modules/zod/v4/core/registries.js
var _a2;
class $ZodRegistry {
  constructor() {
    this._map = new WeakMap;
    this._idmap = new Map;
  }
  add(schema, ..._meta) {
    const meta = _meta[0];
    this._map.set(schema, meta);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.set(meta.id, schema);
    }
    return this;
  }
  clear() {
    this._map = new WeakMap;
    this._idmap = new Map;
    return this;
  }
  remove(schema) {
    const meta = this._map.get(schema);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.delete(meta.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : undefined;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
}
function registry() {
  return new $ZodRegistry;
}
(_a2 = globalThis).__zod_globalRegistry ?? (_a2.__zod_globalRegistry = registry());
var globalRegistry = globalThis.__zod_globalRegistry;
// node_modules/zod/v4/core/api.js
function _string(Class, params) {
  return new Class({
    type: "string",
    ...normalizeParams(params)
  });
}
function _email(Class, params) {
  return new Class({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _guid(Class, params) {
  return new Class({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _uuid(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _uuidv4(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
function _uuidv6(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
function _uuidv7(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
function _url(Class, params) {
  return new Class({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _emoji2(Class, params) {
  return new Class({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _nanoid(Class, params) {
  return new Class({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cuid(Class, params) {
  return new Class({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cuid2(Class, params) {
  return new Class({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ulid(Class, params) {
  return new Class({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _xid(Class, params) {
  return new Class({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ksuid(Class, params) {
  return new Class({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ipv4(Class, params) {
  return new Class({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _ipv6(Class, params) {
  return new Class({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cidrv4(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _cidrv6(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _base64(Class, params) {
  return new Class({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _base64url(Class, params) {
  return new Class({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _e164(Class, params) {
  return new Class({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _jwt(Class, params) {
  return new Class({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
function _isoDateTime(Class, params) {
  return new Class({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
function _isoDate(Class, params) {
  return new Class({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
function _isoTime(Class, params) {
  return new Class({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
function _isoDuration(Class, params) {
  return new Class({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
function _unknown(Class) {
  return new Class({
    type: "unknown"
  });
}
function _never(Class, params) {
  return new Class({
    type: "never",
    ...normalizeParams(params)
  });
}
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
function _normalize(form) {
  return _overwrite((input) => input.normalize(form));
}
function _trim() {
  return _overwrite((input) => input.trim());
}
function _toLowerCase() {
  return _overwrite((input) => input.toLowerCase());
}
function _toUpperCase() {
  return _overwrite((input) => input.toUpperCase());
}
function _slugify() {
  return _overwrite((input) => slugify(input));
}
function _array(Class, element, params) {
  return new Class({
    type: "array",
    element,
    ...normalizeParams(params)
  });
}
function _refine(Class, fn, _params) {
  const schema = new Class({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
function _superRefine(fn, params) {
  const ch = _check((payload) => {
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(issue(issue2, payload.value, ch._zod.def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        if (!("input" in _issue))
          _issue.input = payload.value;
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  }, params);
  return ch;
}
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}
// node_modules/zod/v4/core/to-json-schema.js
function assignProps(target, ...sources) {
  for (const source of sources) {
    for (const key of Reflect.ownKeys(source)) {
      if (Object.prototype.propertyIsEnumerable.call(source, key)) {
        assignProp(target, key, source[key]);
      }
    }
  }
  return target;
}
function initializeContext(params) {
  let target = params?.target ?? "draft-2020-12";
  if (target === "draft-4")
    target = "draft-04";
  if (target === "draft-7")
    target = "draft-07";
  return {
    processors: params.processors ?? {},
    metadataRegistry: params?.metadata ?? globalRegistry,
    target,
    unrepresentable: params?.unrepresentable ?? "throw",
    override: params?.override ?? (() => {}),
    io: params?.io ?? "output",
    counter: 0,
    seen: new Map,
    sharedDefsExtractedFor: undefined,
    sharedEmitDoneFor: undefined,
    cycles: params?.cycles ?? "ref",
    reused: params?.reused ?? "inline",
    intersections: [],
    deferred: [],
    external: params?.external ?? undefined
  };
}
function handleUnrepresentable(schema, ctx, json, params, message) {
  const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({ zodSchema: schema, path: params.path, message }) : ctx.unrepresentable;
  if (result === "any")
    return false;
  if (result === undefined || result === "throw")
    throw new Error(message);
  Object.assign(json, result);
  return true;
}
function processSchema(schema, ctx, _params = { path: [], schemaPath: [] }) {
  var _a;
  const def = schema._zod.def;
  const seen = ctx.seen.get(schema);
  if (seen) {
    seen.count++;
    const isCycle = _params.schemaPath.includes(schema);
    if (isCycle) {
      seen.cycle = _params.path;
    }
    return seen.schema;
  }
  const result = { schema: {}, count: 1, cycle: undefined, path: _params.path };
  ctx.seen.set(schema, result);
  ctx.sharedDefsExtractedFor = undefined;
  ctx.sharedEmitDoneFor = undefined;
  const overrideSchema = schema._zod.toJSONSchema?.();
  if (overrideSchema) {
    result.schema = overrideSchema;
  } else {
    const params = {
      ..._params,
      schemaPath: [..._params.schemaPath, schema],
      path: _params.path
    };
    if (schema._zod.processJSONSchema) {
      schema._zod.processJSONSchema(ctx, result.schema, params);
    } else {
      const _json = result.schema;
      const processor = ctx.processors[def.type];
      if (!processor) {
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
      }
      processor(schema, ctx, _json, params);
    }
    const parent = schema._zod.parent;
    if (parent) {
      if (!result.ref)
        result.ref = parent;
      processSchema(parent, ctx, params);
      ctx.seen.get(parent).isParent = true;
    }
  }
  const meta = ctx.metadataRegistry.get(schema);
  if (meta)
    assignProps(result.schema, meta);
  if (ctx.io === "input" && isTransforming(schema)) {
    delete result.schema.examples;
    delete result.schema.default;
  }
  if (ctx.io === "input" && "_prefault" in result.schema)
    (_a = result.schema).default ?? (_a.default = result.schema._prefault);
  delete result.schema._prefault;
  const _result = ctx.seen.get(schema);
  return _result.schema;
}
function encodeJSONPointerSegment(segment) {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function extractDefs(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external)
    return;
  const idToSchema = new Map;
  for (const entry of ctx.seen.entries()) {
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      const existing = idToSchema.get(id);
      if (existing && existing !== entry[0]) {
        throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      }
      idToSchema.set(id, entry[0]);
    }
  }
  const makeURI = (entry) => {
    const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
    if (ctx.external) {
      const externalId = ctx.external.registry.get(entry[0])?.id;
      const uriGenerator = ctx.external.uri ?? ((id) => id);
      if (externalId) {
        return { ref: uriGenerator(externalId) };
      }
      const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
      entry[1].defId = id;
      return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}` };
    }
    const uriPrefix = `#`;
    const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
    if (entry[1] === root && !entry[1].schema.id) {
      return { ref: uriPrefix };
    }
    const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
    return { defId, ref: defUriPrefix + encodeJSONPointerSegment(defId) };
  };
  const extractToDef = (entry) => {
    if (entry[1].schema.$ref) {
      return;
    }
    const seen = entry[1];
    const { ref, defId } = makeURI(entry);
    seen.def = { ...seen.schema };
    if (defId)
      seen.defId = defId;
    const schema = seen.schema;
    for (const key in schema) {
      delete schema[key];
    }
    schema.$ref = ref;
  };
  if (ctx.cycles === "throw") {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.cycle) {
        throw new Error("Cycle detected: " + `#/${seen.cycle?.join("/")}/<root>` + '\n\nSet the `cycles` parameter to `"ref"` to resolve cyclical schemas with defs.');
      }
    }
  }
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (schema === entry[0]) {
      extractToDef(entry);
      continue;
    }
    if (ctx.external) {
      const ext = ctx.external.registry.get(entry[0])?.id;
      if (schema !== entry[0] && ext) {
        extractToDef(entry);
        continue;
      }
    }
    const id = ctx.metadataRegistry.get(entry[0])?.id;
    if (id) {
      extractToDef(entry);
      continue;
    }
    if (seen.cycle) {
      extractToDef(entry);
      continue;
    }
    if (seen.count > 1) {
      if (ctx.reused === "ref") {
        extractToDef(entry);
      }
    }
  }
  if (ctx.external)
    ctx.sharedDefsExtractedFor = ctx.external;
}
function compactTypeUnion(schema) {
  const options = schema.anyOf;
  if (!Array.isArray(options) || options.length === 0 || schema.type !== undefined)
    return;
  const types = [];
  for (const option of options) {
    if (!option || typeof option !== "object")
      return;
    compactTypeUnion(option);
    const keys = Object.keys(option);
    if (keys.length !== 1 || keys[0] !== "type")
      return;
    const type = option.type;
    for (const member of Array.isArray(type) ? type : [type]) {
      if (typeof member !== "string")
        return;
      if (!types.includes(member))
        types.push(member);
    }
  }
  delete schema.anyOf;
  schema.type = types.length === 1 ? types[0] : types;
}
var FOLDABLE_KEYS = new Set(["type", "properties", "required", "additionalProperties"]);
var UNION_KEYS = ["oneOf", "anyOf"];
function undeclaredConstraint(member) {
  const extra = member.additionalProperties;
  if (extra === undefined || extra === false || typeof extra !== "object" || extra === null)
    return null;
  return Object.keys(extra).length ? extra : null;
}
function foldObjects(members) {
  const objects = [];
  for (const member of members) {
    if (typeof member !== "object" || member.type !== "object")
      return null;
    for (const key in member) {
      if (!FOLDABLE_KEYS.has(key))
        return null;
    }
    objects.push(member);
  }
  const properties = {};
  const required = new Set;
  for (const object of objects) {
    for (const key in object.properties) {
      if (Object.prototype.hasOwnProperty.call(properties, key))
        continue;
      const parts = [];
      for (const other of objects) {
        const part = other.properties?.[key] ?? undeclaredConstraint(other);
        if (part === null || part === undefined)
          continue;
        if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part)))
          parts.push(part);
      }
      const merged = parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts };
      assignProp(properties, key, merged);
    }
    for (const key of object.required ?? [])
      required.add(key);
  }
  const folded = { type: "object", properties };
  if (required.size)
    folded.required = [...required];
  if (objects.every((object) => object.additionalProperties === false)) {
    folded.additionalProperties = false;
  } else {
    const constraints = [];
    for (const object of objects) {
      const constraint = undeclaredConstraint(object);
      if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint)))
        constraints.push(constraint);
    }
    if (constraints.length === 1)
      folded.additionalProperties = constraints[0];
    else if (constraints.length > 1)
      folded.additionalProperties = { allOf: constraints };
  }
  return folded;
}
function foldIntersection(json) {
  const allOf = json.allOf;
  if (!Array.isArray(allOf) || allOf.length < 2)
    return;
  for (const key of FOLDABLE_KEYS)
    if (key in json)
      return;
  const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
  let folded = null;
  if (!unions.length) {
    folded = foldObjects(allOf);
  } else {
    const union = unions[0];
    const keyword = UNION_KEYS.find((k) => Array.isArray(union[k]));
    if (Object.keys(union).length !== 1)
      return;
    const rest = allOf.filter((m) => m !== union);
    const branches = union[keyword].map((branch) => foldObjects([...rest, branch]));
    if (branches.some((b) => !b))
      return;
    folded = { [keyword]: branches };
  }
  if (!folded)
    return;
  delete json.allOf;
  assignProps(json, folded);
}
function finalize(ctx, schema) {
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const flattenRef = (zodSchema) => {
    const seen = ctx.seen.get(zodSchema);
    if (seen.ref === null)
      return;
    const schema = seen.def ?? seen.schema;
    const _cached = { ...schema };
    const ref = seen.ref;
    seen.ref = null;
    if (ref) {
      flattenRef(ref);
      const refSeen = ctx.seen.get(ref);
      const refSchema = refSeen.schema;
      if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
        schema.allOf = schema.allOf ?? [];
        schema.allOf.push(refSchema);
      } else {
        assignProps(schema, refSchema);
      }
      assignProps(schema, _cached);
      const isParentRef = zodSchema._zod.parent === ref;
      if (isParentRef) {
        for (const key in schema) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (!(key in _cached)) {
            delete schema[key];
          }
        }
      }
      if (refSchema.$ref && refSeen.def) {
        for (const key in schema) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) {
            delete schema[key];
          }
        }
      }
    }
    const parent = zodSchema._zod.parent;
    if (parent && parent !== ref) {
      flattenRef(parent);
      const parentSeen = ctx.seen.get(parent);
      if (parentSeen?.schema.$ref) {
        schema.$ref = parentSeen.schema.$ref;
        if (parentSeen.def) {
          for (const key in schema) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) {
              delete schema[key];
            }
          }
        }
      }
    }
    ctx.override({
      zodSchema,
      jsonSchema: schema,
      path: seen.path ?? []
    });
  };
  if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
    for (const entry of [...ctx.seen.entries()].reverse()) {
      flattenRef(entry[0]);
    }
    if (ctx.target !== "openapi-3.0") {
      for (const entry of ctx.seen.entries()) {
        compactTypeUnion(entry[1].def ?? entry[1].schema);
      }
    }
    for (const rewrite of ctx.deferred)
      rewrite();
    if (ctx.intersections.length) {
      const carriers = new Map;
      for (const seen of ctx.seen.values()) {
        for (const json of [seen.schema, seen.def]) {
          const allOf = json?.allOf;
          if (!Array.isArray(allOf))
            continue;
          const existing = carriers.get(allOf);
          if (existing)
            existing.push(json);
          else
            carriers.set(allOf, [json]);
        }
      }
      for (const allOf of ctx.intersections) {
        for (const json of carriers.get(allOf) ?? [])
          foldIntersection(json);
      }
    }
  }
  const result = {};
  if (ctx.target === "draft-2020-12") {
    result.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (ctx.target === "draft-07") {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (ctx.target === "draft-04") {
    result.$schema = "http://json-schema.org/draft-04/schema#";
  } else if (ctx.target === "openapi-3.0") {}
  if (ctx.external?.uri) {
    const id = ctx.external.registry.get(schema)?.id;
    if (!id)
      throw new Error("Schema is missing an `id` property");
    result.$id = ctx.external.uri(id);
  }
  assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
  const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
  if (rootMetaId !== undefined && result.id === rootMetaId)
    delete result.id;
  const defs = ctx.external?.defs ?? {};
  if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.def && seen.defId) {
        if (seen.def.id === seen.defId)
          delete seen.def.id;
        assignProp(defs, seen.defId, seen.def);
      }
    }
  }
  if (ctx.external)
    ctx.sharedEmitDoneFor = ctx.external;
  if (ctx.external) {} else {
    if (Object.keys(defs).length > 0) {
      if (ctx.target === "draft-2020-12") {
        result.$defs = defs;
      } else {
        result.definitions = defs;
      }
    }
  }
  try {
    const finalized = JSON.parse(JSON.stringify(result));
    Object.defineProperty(finalized, "~standard", {
      value: {
        ...schema["~standard"],
        jsonSchema: {
          input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
          output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
        }
      },
      enumerable: false,
      writable: false
    });
    return finalized;
  } catch (_err) {
    throw new Error("Error converting schema to JSON.");
  }
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: new Set };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const def = _schema._zod.def;
  if (def.type === "transform")
    return true;
  if (def.type === "array")
    return isTransforming(def.element, ctx);
  if (def.type === "set")
    return isTransforming(def.valueType, ctx);
  if (def.type === "lazy")
    return isTransforming(def.getter(), ctx);
  if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") {
    return isTransforming(def.innerType, ctx);
  }
  if (def.type === "intersection") {
    return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
  }
  if (def.type === "record" || def.type === "map") {
    return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
  }
  if (def.type === "pipe") {
    if (_schema._zod.traits.has("$ZodCodec"))
      return true;
    return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
  }
  if (def.type === "object") {
    for (const key in def.shape) {
      if (isTransforming(def.shape[key], ctx))
        return true;
    }
    return false;
  }
  if (def.type === "union") {
    for (const option of def.options) {
      if (isTransforming(option, ctx))
        return true;
    }
    return false;
  }
  if (def.type === "tuple") {
    for (const item of def.items) {
      if (isTransforming(item, ctx))
        return true;
    }
    if (def.rest && isTransforming(def.rest, ctx))
      return true;
    return false;
  }
  return false;
}
var createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
  const ctx = initializeContext({ ...params, processors });
  processSchema(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
var createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
  const { libraryOptions, target } = params ?? {};
  const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
  processSchema(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
// node_modules/zod/v4/core/json-schema-processors.js
var narrowMin = (agg, key, value) => {
  if (agg[key] === undefined || value > agg[key])
    agg[key] = value;
};
var narrowMax = (agg, key, value) => {
  if (agg[key] === undefined || value < agg[key])
    agg[key] = value;
};
var narrowBoth = (agg, value) => {
  narrowMin(agg, "minimum", value);
  narrowMax(agg, "maximum", value);
};
var addDivisor = (agg, value) => {
  agg.multipleOf ?? (agg.multipleOf = []);
  if (!agg.multipleOf.includes(value))
    agg.multipleOf.push(value);
};
var addPattern = (agg, pattern) => {
  agg.patterns ?? (agg.patterns = new Set);
  agg.patterns.add(pattern);
};
var intersectMime = (agg, mime) => {
  agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
};
var setFormat = (agg, format) => {
  agg.format = format;
  if (format.includes("int"))
    agg.isInt = true;
};
var minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
var maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
var formatContributor = (ranges) => (agg, def) => {
  setFormat(agg, def.format);
  const [minimum, maximum] = ranges[def.format];
  narrowMin(agg, "minimum", minimum);
  narrowMax(agg, "maximum", maximum);
};
var contributors = {
  greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
  less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
  multiple_of: (agg, def) => addDivisor(agg, def.value),
  number_format: formatContributor(NUMBER_FORMAT_RANGES),
  bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
  min_length: minContributor,
  max_length: maxContributor,
  length_equals: (agg, def) => narrowBoth(agg, def.length),
  min_size: minContributor,
  max_size: maxContributor,
  size_equals: (agg, def) => narrowBoth(agg, def.size),
  string_format: (agg, def) => {
    setFormat(agg, def.format);
    if (def.pattern)
      addPattern(agg, def.pattern);
    if (def.format === "base64" || def.format === "base64url")
      agg.contentEncoding = def.format;
    if (def.local || def.precision === -1)
      agg.laxFormat = true;
  },
  mime_type: (agg, def) => intersectMime(agg, def.mime)
};
function aggregateChecks(schema) {
  const agg = {};
  const def = schema._zod.def;
  const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
  for (const ch of list)
    contributors[ch._zod.def.check]?.(agg, ch._zod.def);
  const bag = schema._zod.bag;
  if (bag.minimum !== undefined)
    narrowMin(agg, "minimum", bag.minimum);
  if (bag.exclusiveMinimum !== undefined)
    narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
  if (bag.maximum !== undefined)
    narrowMax(agg, "maximum", bag.maximum);
  if (bag.exclusiveMaximum !== undefined)
    narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
  if (bag.multipleOf !== undefined)
    addDivisor(agg, bag.multipleOf);
  if (bag.format !== undefined) {
    agg.format ?? (agg.format = bag.format);
    if (bag.format.includes("int"))
      agg.isInt = true;
  }
  if (bag.mime)
    intersectMime(agg, bag.mime);
  for (const pattern of bag.patterns ?? [])
    addPattern(agg, pattern);
  return agg;
}
var formatMap = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
};
var exactPatterns = new Map([
  [base64Charset, base64],
  [base64urlCharset, base64url]
]);
var exactPattern = (p) => exactPatterns.get(p) ?? p;
var stringProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  json.type = "string";
  const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
  if (typeof minimum === "number")
    json.minLength = minimum;
  if (typeof maximum === "number")
    json.maxLength = maximum;
  if (format) {
    json.format = formatMap[format] ?? format;
    if (json.format === "")
      delete json.format;
    if (format === "time" || laxFormat) {
      delete json.format;
    }
  }
  if (contentEncoding)
    json.contentEncoding = contentEncoding;
  if (patterns && patterns.size > 0) {
    const patternList = [...patterns].map(exactPattern);
    if (patternList.length === 1)
      json.pattern = patternList[0].source;
    else if (patternList.length > 1) {
      json.allOf = [
        ...patternList.map((regex) => ({
          ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
          pattern: regex.source
        }))
      ];
    }
  }
};
var neverProcessor = (_schema, _ctx, json, _params) => {
  json.not = {};
};
var unknownProcessor = (_schema, _ctx, _json, _params) => {};
var enumProcessor = (schema, _ctx, json, _params) => {
  const def = schema._zod.def;
  const values = getEnumValues(def.entries);
  if (values.length === 0) {
    json.not = {};
    return;
  }
  if (values.every((v) => typeof v === "number"))
    json.type = "number";
  if (values.every((v) => typeof v === "string"))
    json.type = "string";
  json.enum = values;
};
var literalProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  if (def.values.length === 0) {
    json.not = {};
    return;
  }
  const vals = [];
  for (const val of def.values) {
    if (val === undefined) {
      if (handleUnrepresentable(schema, ctx, json, params, "Literal `undefined` cannot be represented in JSON Schema"))
        return;
    } else if (typeof val === "bigint") {
      if (handleUnrepresentable(schema, ctx, json, params, "BigInt literals cannot be represented in JSON Schema"))
        return;
      vals.push(Number(val));
    } else {
      vals.push(val);
    }
  }
  if (vals.length === 0) {} else if (vals.length === 1) {
    const val = vals[0];
    json.type = val === null ? "null" : typeof val;
    if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
      json.enum = [val];
    } else {
      json.const = val;
    }
  } else {
    if (vals.every((v) => typeof v === "number"))
      json.type = "number";
    if (vals.every((v) => typeof v === "string"))
      json.type = "string";
    if (vals.every((v) => typeof v === "boolean"))
      json.type = "boolean";
    if (vals.every((v) => v === null))
      json.type = "null";
    json.enum = vals;
  }
};
var customProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
};
var transformProcessor = (schema, ctx, json, params) => {
  handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
};
var arrayProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const { minimum, maximum } = aggregateChecks(schema);
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
  json.type = "array";
  json.items = processSchema(def.element, ctx, {
    ...params,
    path: [...params.path, "items"]
  });
};
function inputOptin(schema) {
  const def = schema._zod.def;
  if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) {
    return inputOptin(def.out);
  }
  if (def.type === "catch") {
    return inputOptin(def.innerType);
  }
  return schema._zod.optin;
}
var objectProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const shape = def.shape;
  const symbolKeys = Object.getOwnPropertySymbols(shape);
  if (symbolKeys.length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) {
    return;
  }
  json.type = "object";
  json.properties = {};
  for (const key in shape) {
    assignProp(json.properties, key, processSchema(shape[key], ctx, {
      ...params,
      path: [...params.path, "properties", key]
    }));
  }
  const allKeys = new Set(Object.keys(shape));
  const requiredKeys = new Set([...allKeys].filter((key) => {
    const field = def.shape[key];
    if (ctx.io === "input") {
      return inputOptin(field) === undefined;
    } else {
      return field._zod.optout === undefined;
    }
  }));
  if (requiredKeys.size > 0) {
    json.required = Array.from(requiredKeys);
  }
  if (def.catchall?._zod.def.type === "never") {
    json.additionalProperties = false;
  } else if (!def.catchall) {
    if (ctx.io === "output")
      json.additionalProperties = false;
  } else if (def.catchall) {
    json.additionalProperties = processSchema(def.catchall, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
};
var unionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const isExclusive = def.inclusive === false;
  const options = def.options.map((x, i) => processSchema(x, ctx, {
    ...params,
    path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
  }));
  if (isExclusive) {
    json.oneOf = options;
  } else {
    json.anyOf = options;
  }
};
var intersectionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const a = processSchema(def.left, ctx, {
    ...params,
    path: [...params.path, "allOf", 0]
  });
  const b = processSchema(def.right, ctx, {
    ...params,
    path: [...params.path, "allOf", 1]
  });
  const isSimpleIntersection = (val) => ("allOf" in val) && Object.keys(val).length === 1;
  const allOf = [
    ...isSimpleIntersection(a) ? a.allOf : [a],
    ...isSimpleIntersection(b) ? b.allOf : [b]
  ];
  json.allOf = allOf;
  ctx.intersections.push(allOf);
};
var pendingRecords = new WeakMap;
var nullableProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const inner = processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  if (ctx.target === "openapi-3.0") {
    seen.ref = def.innerType;
    json.nullable = true;
  } else {
    json.anyOf = [inner, { type: "null" }];
  }
};
var nonoptionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
var UNREPRESENTABLE_DEFAULT = Symbol();
function serializeDefaultValue(value, schema, ctx, json, params) {
  let unrepresentable = false;
  const serialized = JSON.stringify(value, (_, val) => {
    if (typeof val !== "bigint")
      return val;
    unrepresentable = true;
    return null;
  });
  if (!unrepresentable)
    return JSON.parse(serialized);
  handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
  return UNREPRESENTABLE_DEFAULT;
}
var defaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
  if (value !== UNREPRESENTABLE_DEFAULT)
    json.default = value;
};
var prefaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  if (ctx.io !== "input")
    return;
  const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
  if (value !== UNREPRESENTABLE_DEFAULT)
    json._prefault = value;
};
var catchProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  let catchValue;
  try {
    catchValue = def.catchValue(undefined);
  } catch {
    handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
    return;
  }
  json.default = catchValue;
};
var pipeProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  const inIsTransform = def.in._zod.traits.has("$ZodTransform");
  const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
  processSchema(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
var readonlyProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.readOnly = true;
};
var optionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  processSchema(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
// node_modules/zod/v4/classic/errors.js
var _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function _lazyMethod(proto, key, make) {
  Object.defineProperty(proto, key, {
    configurable: true,
    enumerable: false,
    get() {
      const value = make(this);
      Object.defineProperty(this, key, { value, configurable: true, writable: true });
      return value;
    },
    set(value) {
      Object.defineProperty(this, key, { value, configurable: true, writable: true });
    }
  });
}
var initializer2 = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  const proto = Object.getPrototypeOf(inst);
  if (_installedErrorProtos.has(proto))
    return;
  _installedErrorProtos.add(proto);
  _lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
  _lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
  _lazyMethod(proto, "addIssue", (self) => (issue) => {
    self.issues.push(issue);
    self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
  });
  _lazyMethod(proto, "addIssues", (self) => (issues) => {
    self.issues.push(...issues);
    self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
  });
  Object.defineProperty(proto, "isEmpty", {
    configurable: true,
    enumerable: false,
    get() {
      return this.issues.length === 0;
    }
  });
};
var ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer2, undefined, {
  Parent: Error
});

// node_modules/zod/v4/classic/parse.js
var parse2 = /* @__PURE__ */ _parse(ZodRealError);
var parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
var safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
var safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
var encode = /* @__PURE__ */ _encode(ZodRealError);
var decode = /* @__PURE__ */ _decode(ZodRealError);
var encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
var decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
var safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
var safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
var safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
var safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);

// node_modules/zod/v4/classic/schemas.js
function _ensureDefaultLocale() {
  if (!globalConfig.localeError)
    config(en_default());
}
function _ensureDefaultMemoizer() {
  if (!globalConfig.memoizer)
    config({ memoizer: memoizer() });
}
var ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
  _ensureDefaultLocale();
  $ZodType.init(inst, def);
  inst.def = def;
  inst.type = def.type;
  return inst;
}, {
  check(...chks) {
    const def = this.def;
    return this.clone(mergeDefs(def, {
      checks: [
        ...def.checks ?? [],
        ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
      ]
    }), { parent: true });
  },
  with(...chks) {
    return this.check(...chks);
  },
  clone(def, params) {
    return clone(this, def, params);
  },
  brand() {
    return this;
  },
  register(reg, meta) {
    reg.add(this, meta);
    return this;
  },
  refine(check, params) {
    return this.check(refine(check, params));
  },
  superRefine(refinement, params) {
    return this.check(superRefine(refinement, params));
  },
  overwrite(fn) {
    return this.check(_overwrite(fn));
  },
  optional() {
    return optional(this);
  },
  exactOptional() {
    return exactOptional(this);
  },
  nullable() {
    return nullable(this);
  },
  nullish() {
    return optional(nullable(this));
  },
  nonoptional(params) {
    return nonoptional(this, params);
  },
  array() {
    return array(this);
  },
  or(arg) {
    return union([this, arg]);
  },
  and(arg) {
    return intersection(this, arg);
  },
  transform(tx) {
    return pipe(this, transform(tx));
  },
  default(d) {
    return _default(this, d);
  },
  prefault(d) {
    return prefault(this, d);
  },
  catch(params) {
    return _catch(this, params);
  },
  pipe(target) {
    return pipe(this, target);
  },
  readonly() {
    return readonly(this);
  },
  describe(description) {
    const cl = this.clone();
    globalRegistry.add(cl, { description });
    return cl;
  },
  meta(...args) {
    if (args.length === 0)
      return globalRegistry.get(this);
    const cl = this.clone();
    globalRegistry.add(cl, args[0]);
    return cl;
  },
  isOptional() {
    return this.safeParse(undefined).success;
  },
  isNullable() {
    return this.safeParse(null).success;
  },
  apply(fn, ...args) {
    return args.length === 0 ? fn(this) : fn(this, ...args);
  },
  get "~standard"() {
    return hide(this, "~standard", {
      ...standardProps(this),
      jsonSchema: {
        input: createStandardJSONSchemaMethod(this, "input"),
        output: createStandardJSONSchemaMethod(this, "output")
      }
    });
  },
  set "~standard"(value) {
    own(this, "~standard", value);
  },
  parse: function _parse(data, params) {
    return parse2(this, data, params, { callee: _parse });
  },
  parseAsync: async function _parseAsync(data, params) {
    return await parseAsync(this, data, params, { callee: _parseAsync });
  },
  safeParse(data, params) {
    return safeParse(this, data, params);
  },
  async safeParseAsync(data, params) {
    return safeParseAsync(this, data, params);
  },
  get spa() {
    return this?.safeParseAsync;
  },
  set spa(value) {
    own(this, "spa", value);
  },
  validate(data, params) {
    return validate(this, data, params);
  },
  validateAsync(data, params) {
    return validateAsync(this, data, params);
  },
  encode: function _encode(data, params) {
    return encode(this, data, params, { callee: _encode });
  },
  decode: function _decode(data, params) {
    return decode(this, data, params, { callee: _decode });
  },
  encodeAsync: async function _encodeAsync(data, params) {
    return await encodeAsync(this, data, params, { callee: _encodeAsync });
  },
  decodeAsync: async function _decodeAsync(data, params) {
    return await decodeAsync(this, data, params, { callee: _decodeAsync });
  },
  safeEncode(data, params) {
    return safeEncode(this, data, params);
  },
  safeDecode(data, params) {
    return safeDecode(this, data, params);
  },
  async safeEncodeAsync(data, params) {
    return safeEncodeAsync(this, data, params);
  },
  async safeDecodeAsync(data, params) {
    return safeDecodeAsync(this, data, params);
  },
  toJSONSchema(params) {
    return createToJSONSchemaMethod(this, {})(params);
  },
  get description() {
    return globalRegistry.get(this)?.description;
  },
  get _def() {
    return this._zod.def;
  }
});
var _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
}, /* @__PURE__ */ derived({
  format: (inst) => aggregateChecks(inst).format ?? null,
  minLength: (inst) => aggregateChecks(inst).minimum ?? null,
  maxLength: (inst) => aggregateChecks(inst).maximum ?? null
}, {
  regex(...args) {
    return this.check(_regex(...args));
  },
  includes(...args) {
    return this.check(_includes(...args));
  },
  startsWith(...args) {
    return this.check(_startsWith(...args));
  },
  endsWith(...args) {
    return this.check(_endsWith(...args));
  },
  min(...args) {
    return this.check(_minLength(...args));
  },
  max(...args) {
    return this.check(_maxLength(...args));
  },
  length(...args) {
    return this.check(_length(...args));
  },
  nonempty(...args) {
    return this.check(_minLength(1, ...args));
  },
  lowercase(params) {
    return this.check(_lowercase(params));
  },
  uppercase(params) {
    return this.check(_uppercase(params));
  },
  trim() {
    return this.check(_trim());
  },
  normalize(...args) {
    return this.check(_normalize(...args));
  },
  toLowerCase() {
    return this.check(_toLowerCase());
  },
  toUpperCase() {
    return this.check(_toUpperCase());
  },
  slugify() {
    return this.check(_slugify());
  }
}));
var ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  _ZodString.init(inst, def);
}, {
  email(params) {
    return this.check(_email(ZodEmail, params));
  },
  url(params) {
    return this.check(_url(ZodURL, params));
  },
  jwt(params) {
    return this.check(_jwt(ZodJWT, params));
  },
  emoji(params) {
    return this.check(_emoji2(ZodEmoji, params));
  },
  guid(params) {
    return this.check(_guid(ZodGUID, params));
  },
  uuid(params) {
    return this.check(_uuid(ZodUUID, params));
  },
  uuidv4(params) {
    return this.check(_uuidv4(ZodUUID, params));
  },
  uuidv6(params) {
    return this.check(_uuidv6(ZodUUID, params));
  },
  uuidv7(params) {
    return this.check(_uuidv7(ZodUUID, params));
  },
  nanoid(params) {
    return this.check(_nanoid(ZodNanoID, params));
  },
  cuid(params) {
    return this.check(_cuid(ZodCUID, params));
  },
  cuid2(params) {
    return this.check(_cuid2(ZodCUID2, params));
  },
  ulid(params) {
    return this.check(_ulid(ZodULID, params));
  },
  base64(params) {
    return this.check(_base64(ZodBase64, params));
  },
  base64url(params) {
    return this.check(_base64url(ZodBase64URL, params));
  },
  xid(params) {
    return this.check(_xid(ZodXID, params));
  },
  ksuid(params) {
    return this.check(_ksuid(ZodKSUID, params));
  },
  ipv4(params) {
    return this.check(_ipv4(ZodIPv4, params));
  },
  ipv6(params) {
    return this.check(_ipv6(ZodIPv6, params));
  },
  cidrv4(params) {
    return this.check(_cidrv4(ZodCIDRv4, params));
  },
  cidrv6(params) {
    return this.check(_cidrv6(ZodCIDRv6, params));
  },
  e164(params) {
    return this.check(_e164(ZodE164, params));
  },
  datetime(params) {
    return this.check(_isoDateTime(ZodISODateTime, params));
  },
  date(params) {
    return this.check(_isoDate(ZodISODate, params));
  },
  time(params) {
    return this.check(_isoTime(ZodISOTime, params));
  },
  duration(params) {
    return this.check(_isoDuration(ZodISODuration, params));
  }
});
function string2(params) {
  return _string(ZodString, params);
}
var ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  _ZodString.init(inst, def);
});
var ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
  $ZodISODateTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
  $ZodISODate.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
  $ZodISOTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
  $ZodISODuration.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
  $ZodEmail.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
  $ZodGUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
  $ZodUUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
  $ZodEmoji.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
  $ZodNanoID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
  $ZodCUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
  $ZodCUID2.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
  $ZodULID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
  $ZodXID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
  $ZodKSUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
  $ZodIPv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
  $ZodIPv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
  $ZodCIDRv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
  $ZodCIDRv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
  $ZodBase64.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
  $ZodBase64URL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
  $ZodE164.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
  $ZodJWT.init(inst, def);
  ZodStringFormat.init(inst, def);
});
var ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor(inst, ctx, json, params);
});
function unknown() {
  return _unknown(ZodUnknown);
}
var ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
  $ZodNever.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
  return _never(ZodNever, params);
}
var ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodArray.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
  inst.element = def.element;
}, {
  min(n, params) {
    return this.check(_minLength(n, params));
  },
  nonempty(params) {
    return this.check(_minLength(1, params));
  },
  max(n, params) {
    return this.check(_maxLength(n, params));
  },
  length(n, params) {
    return this.check(_length(n, params));
  },
  unwrap() {
    return this.element;
  }
});
function array(element, params) {
  return _array(ZodArray, element, params);
}
var ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodObjectJIT.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
  installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
}, {
  keyof() {
    return _enum(Object.keys(this._zod.def.shape));
  },
  catchall(catchall) {
    return this.clone(mergeDefs(this._zod.def, { catchall }));
  },
  passthrough() {
    return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
  },
  loose() {
    return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
  },
  strict() {
    return this.clone(mergeDefs(this._zod.def, { catchall: never() }));
  },
  strip() {
    return this.clone(mergeDefs(this._zod.def, { catchall: undefined }));
  },
  extend(incoming) {
    return extend(this, incoming);
  },
  safeExtend(incoming) {
    return safeExtend(this, incoming);
  },
  merge(other) {
    return merge(this, other);
  },
  pick(mask) {
    return pick(this, mask);
  },
  omit(mask) {
    return omit(this, mask);
  },
  partial(...args) {
    return partial(ZodOptional, this, args[0]);
  },
  exactPartial(...args) {
    return partial(ZodExactOptional, this, args[0], "exactPartial");
  },
  required(...args) {
    return required(ZodNonOptional, this, args[0]);
  }
});
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...normalizeParams(params)
  };
  return new ZodObject(def);
}
var ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
  inst.options = def.options;
});
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...normalizeParams(params)
  });
}
var ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
  $ZodIntersection.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
var ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
  inst.enum = def.entries;
  inst.options = [...inst._zod.values];
  const keys = new Set(Object.keys(def.entries));
  inst.extract = (values, params) => {
    const newEntries = {};
    for (const value of values) {
      if (keys.has(value)) {
        newEntries[value] = def.entries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
  inst.exclude = (values, params) => {
    const newEntries = { ...def.entries };
    for (const value of values) {
      if (keys.has(value)) {
        delete newEntries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
});
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
var ZodLiteral = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
  $ZodLiteral.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json, params);
  inst.values = new Set(def.values);
  Object.defineProperty(inst, "value", {
    get() {
      if (def.values.length > 1) {
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      }
      return def.values[0];
    }
  });
});
function literal(value, params) {
  return new ZodLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...normalizeParams(params)
  });
}
var ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
  _ensureDefaultMemoizer();
  $ZodTransform.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
  inst._zod.parse = (payload, _ctx) => {
    if (_ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    payload.addIssue = (issue2) => {
      if (typeof issue2 === "string") {
        payload.issues.push(issue(issue2, payload.value, def));
      } else {
        const _issue = issue2;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        if (!("input" in _issue))
          _issue.input = payload.value;
        _issue.inst ?? (_issue.inst = inst);
        payload.issues.push(issue(_issue));
      }
    };
    const output = def.transform(payload.value, payload);
    if (output instanceof Promise) {
      return output.then((output) => {
        payload.value = output;
        return payload;
      });
    }
    payload.value = output;
    return payload;
  };
});
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
var ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
var ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
  $ZodExactOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
  return new ZodExactOptional({
    type: "optional",
    innerType
  });
}
var ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
var ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
  $ZodDefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
var ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
  $ZodPrefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
var ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
  $ZodNonOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...normalizeParams(params)
  });
}
var ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
  $ZodCatch.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
  });
}
var ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
  $ZodPipe.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
  inst.in = def.in;
  inst.out = def.out;
});
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
  });
}
var ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
  $ZodReadonly.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
var ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
  return _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
  return _superRefine(fn, params);
}
// utils/accounts.ts
var accountNameSchema = string2().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, "Use 1–64 lowercase letters, digits, underscores or hyphens");
var remote = string2().url().refine((s) => {
  const u = new URL(s);
  return !u.username && !u.password && !u.search && !u.hash && (u.protocol === "https:" || u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname));
});
var compressedPublicKeySchema = string2().regex(/^0[23][0-9a-fA-F]{64}$/, "Invalid compressed public key");
var nonEmptyStringSchema = string2().min(1);
var vaultPaymentSchema = object({
  entryId: nonEmptyStringSchema,
  publicKey: compressedPublicKeySchema
}).strict();
var vaultHdSchema = object({
  entryId: nonEmptyStringSchema,
  expectedXpub: nonEmptyStringSchema
}).strict();
var embeddedVaultBindingSchema = object({
  version: literal(1),
  contract: literal("embedded-roots-v1"),
  vaultId: nonEmptyStringSchema,
  payment: vaultPaymentSchema,
  identity: vaultPaymentSchema.optional(),
  hd: vaultHdSchema.optional()
}).strict();
var vaultBindingHistoryItemSchema = object({
  binding: embeddedVaultBindingSchema,
  changedAt: string2().datetime()
}).strict();
var accountConfigSchema = object({
  chain: _enum(["main", "test"]),
  storageIdentityKey: string2().min(1).max(200),
  activeRemote: remote.optional(),
  backups: array(remote).optional(),
  address: string2().regex(/^[123mn][1-9A-HJ-NP-Za-km-z]{24,40}$/).optional(),
  depositPrefix: _enum(["mcp", "1sat"]).default("mcp"),
  vaultBinding: embeddedVaultBindingSchema.optional(),
  vaultBindingHistory: array(vaultBindingHistoryItemSchema).optional()
}).strict();
function accountsRoot() {
  const base = join(homedir(), ".bsv-mcp");
  regularPath(base, true);
  return join(base, "accounts");
}
function accountName(value = process.env.BSV_MCP_ACCOUNT ?? "default") {
  return accountNameSchema.parse(value);
}
function accountDir(name = accountName(), root = accountsRoot()) {
  return join(root, accountName(name));
}
function regularPath(file, directory = false) {
  if (!existsSync(file))
    return;
  const stat = lstatSync(file);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile()))
    throw new Error("Account path must be a regular file or directory, not a link");
}
function readAccount(name = accountName(), root = accountsRoot()) {
  regularPath(root, true);
  const dir = accountDir(name, root);
  regularPath(dir, true);
  const file = join(dir, "config.json");
  regularPath(file);
  if (!existsSync(file))
    return;
  try {
    return accountConfigSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    throw new Error(`Invalid account configuration at ${file}`);
  }
}

// utils/externalWalletConfig.ts
import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";

// node_modules/@bsv/sdk/dist/esm/src/primitives/BigNumber.js
var BufferCtor = globalThis.Buffer;
var CAN_USE_BUFFER = BufferCtor != null && typeof BufferCtor.from === "function";
var HEX_CHAR_TO_VALUE = new Int8Array(256).fill(-1);
for (let i = 0;i < 10; i++) {
  HEX_CHAR_TO_VALUE[48 + i] = i;
}
for (let i = 0;i < 6; i++) {
  HEX_CHAR_TO_VALUE[65 + i] = 10 + i;
  HEX_CHAR_TO_VALUE[97 + i] = 10 + i;
}

class BigNumber {
  static zeros = [
    "",
    "0",
    "00",
    "000",
    "0000",
    "00000",
    "000000",
    "0000000",
    "00000000",
    "000000000",
    "0000000000",
    "00000000000",
    "000000000000",
    "0000000000000",
    "00000000000000",
    "000000000000000",
    "0000000000000000",
    "00000000000000000",
    "000000000000000000",
    "0000000000000000000",
    "00000000000000000000",
    "000000000000000000000",
    "0000000000000000000000",
    "00000000000000000000000",
    "000000000000000000000000",
    "0000000000000000000000000"
  ];
  static groupSizes = [
    0,
    0,
    25,
    16,
    12,
    11,
    10,
    9,
    8,
    8,
    7,
    7,
    7,
    7,
    6,
    6,
    6,
    6,
    6,
    6,
    6,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5,
    5
  ];
  static groupBases = [
    0,
    0,
    33554432,
    43046721,
    16777216,
    48828125,
    60466176,
    40353607,
    16777216,
    43046721,
    1e7,
    19487171,
    35831808,
    62748517,
    7529536,
    11390625,
    16777216,
    24137569,
    34012224,
    47045881,
    64000000,
    4084101,
    5153632,
    6436343,
    7962624,
    9765625,
    11881376,
    14348907,
    17210368,
    20511149,
    24300000,
    28629151,
    33554432,
    39135393,
    45435424,
    52521875,
    60466176
  ];
  static wordSize = 26;
  static WORD_SIZE_BIGINT = BigInt(BigNumber.wordSize);
  static WORD_MASK = (1n << BigNumber.WORD_SIZE_BIGINT) - 1n;
  static MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
  static MIN_SAFE_INTEGER_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);
  static MAX_IMULN_ARG = 67108864 - 1;
  static MAX_NUMBER_CONSTRUCTOR_MAG_BIGINT = (1n << 53n) - 1n;
  static MAX_NOMINAL_WORD_LENGTH = 1048576;
  _magnitude = 0n;
  _sign = 0;
  _nominalWordLength = 1;
  red = null;
  get negative() {
    return this._sign;
  }
  set negative(val) {
    this.assert(val === 0 || val === 1, "Negative property must be 0 or 1");
    const newSign = val === 1 ? 1 : 0;
    if (this._magnitude === 0n) {
      this._sign = 0;
    } else {
      this._sign = newSign;
    }
  }
  get _computedWordsArray() {
    if (this._magnitude === 0n)
      return [0];
    const arr = [];
    let temp = this._magnitude;
    while (temp > 0n) {
      arr.push(Number(temp & BigNumber.WORD_MASK));
      temp >>= BigNumber.WORD_SIZE_BIGINT;
    }
    return arr.length > 0 ? arr : [0];
  }
  get words() {
    if (!Number.isSafeInteger(this._nominalWordLength) || this._nominalWordLength < 1 || this._nominalWordLength > BigNumber.MAX_NOMINAL_WORD_LENGTH) {
      throw new Error("BigNumber word length exceeds the supported limit");
    }
    const computed = this._computedWordsArray;
    if (this._nominalWordLength <= computed.length) {
      return computed;
    }
    const paddedWords = Array.from({ length: this._nominalWordLength }).fill(0);
    for (let i = 0;i < computed.length; i++) {
      paddedWords[i] = computed[i];
    }
    return paddedWords;
  }
  set words(newWords) {
    const oldSign = this._sign;
    let newMagnitude = 0n;
    const len = newWords.length > 0 ? newWords.length : 1;
    for (let i = len - 1;i >= 0; i--) {
      const wordVal = newWords[i] ?? 0;
      newMagnitude = newMagnitude << BigNumber.WORD_SIZE_BIGINT | BigInt(wordVal & Number(BigNumber.WORD_MASK));
    }
    this._magnitude = newMagnitude;
    this._sign = oldSign;
    this._nominalWordLength = len;
    this.normSign();
  }
  get length() {
    return Math.max(1, this._nominalWordLength);
  }
  static isBN(num) {
    if (num instanceof BigNumber)
      return true;
    return num !== null && typeof num === "object" && num.constructor?.wordSize === BigNumber.wordSize && Array.isArray(num.words);
  }
  static max(left, right) {
    return left.cmp(right) > 0 ? left : right;
  }
  static min(left, right) {
    return left.cmp(right) < 0 ? left : right;
  }
  constructor(number = 0, base = 10, endian = "be") {
    number ??= 0;
    if (typeof number === "bigint") {
      this._initializeState(number < 0n ? -number : number, number < 0n ? 1 : 0);
      this.normSign();
      return;
    }
    const baseIsEndian = base === "le" || base === "be";
    const effectiveBase = baseIsEndian ? 10 : base;
    const effectiveEndian = baseIsEndian ? base : endian;
    if (typeof number === "number") {
      this.initNumber(number, effectiveEndian);
      return;
    }
    if (Array.isArray(number)) {
      this.initArray(number, effectiveEndian);
      return;
    }
    if (typeof number === "string") {
      this._initFromString(number, effectiveBase, effectiveEndian);
      return;
    }
    if (number !== 0) {
      this.assert(false, "Unsupported input type for BigNumber constructor");
    } else {
      this._initializeState(0n, 0);
    }
  }
  _initFromString(number, effectiveBase, effectiveEndian) {
    if (effectiveBase === "hex")
      effectiveBase = 16;
    this.assert(typeof effectiveBase === "number" && effectiveBase === Math.trunc(effectiveBase) && effectiveBase >= 2 && effectiveBase <= 36, "Base must be an integer between 2 and 36");
    const originalNumberStr = number.toString().replace(/\s+/g, "");
    let start = 0;
    let sign = 0;
    if (originalNumberStr.startsWith("-")) {
      start++;
      sign = 1;
    } else if (originalNumberStr.startsWith("+")) {
      start++;
    }
    const numStr = originalNumberStr.substring(start);
    if (numStr.length === 0) {
      this._initializeState(0n, sign === 1 && originalNumberStr.startsWith("-") ? 1 : 0);
      this.normSign();
      return;
    }
    if (effectiveBase === 16) {
      this._initFromHexString(numStr, sign, effectiveEndian);
    } else {
      this._initFromNonHexString(numStr, effectiveBase, sign, effectiveEndian);
    }
  }
  _initFromHexString(numStr, sign, effectiveEndian) {
    if (effectiveEndian === "le") {
      const bytes = [];
      let hexStr = numStr;
      if (hexStr.length % 2 !== 0)
        hexStr = "0" + hexStr;
      for (let i = 0;i < hexStr.length; i += 2) {
        const byteHex = hexStr.substring(i, i + 2);
        const byteVal = Number.parseInt(byteHex, 16);
        if (Number.isNaN(byteVal))
          throw new Error("Invalid character in " + hexStr);
        bytes.push(byteVal);
      }
      this.initArray(bytes, "le");
      this._sign = sign;
      this.normSign();
    } else {
      let tempMagnitude;
      try {
        tempMagnitude = BigInt("0x" + numStr);
      } catch {
        throw new Error("Invalid character in " + numStr);
      }
      this._initializeState(tempMagnitude, sign);
      this.normSign();
    }
  }
  _initFromNonHexString(numStr, base, sign, effectiveEndian) {
    try {
      this._parseBaseString(numStr, base);
      this._sign = sign;
      this.normSign();
      if (effectiveEndian === "le") {
        const currentSign = this._sign;
        this.initArray(this.toArray("be"), "le");
        this._sign = currentSign;
        this.normSign();
      }
    } catch (err) {
      const error = err;
      if (error.message.includes("Invalid character in string") || error.message.includes("Invalid digit for base") || error.message.startsWith("Invalid character:")) {
        throw new Error("Invalid character");
      }
      throw error;
    }
  }
  _bigIntToStringInBase(num, base) {
    if (num === 0n)
      return "0";
    if (base < 2 || base > 36)
      throw new Error("Base must be between 2 and 36");
    const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
    let result = "";
    let currentNum = num > 0n ? num : -num;
    const bigBase = BigInt(base);
    while (currentNum > 0n) {
      result = digits[Number(currentNum % bigBase)] + result;
      currentNum /= bigBase;
    }
    return result;
  }
  _parseBaseString(numberStr, base) {
    this._magnitude = 0n;
    const bigBase = BigInt(base);
    let groupSize = BigNumber.groupSizes[base];
    let groupBaseBigInt = BigInt(BigNumber.groupBases[base]);
    if (groupSize === 0 || groupBaseBigInt === 0n) {
      groupSize = Math.floor(Math.log(67108863) / Math.log(base));
      if (groupSize === 0)
        groupSize = 1;
      groupBaseBigInt = bigBase ** BigInt(groupSize);
    }
    let currentPos = 0;
    const totalLen = numberStr.length;
    let firstChunkLen = totalLen % groupSize;
    if (firstChunkLen === 0 && totalLen > 0)
      firstChunkLen = groupSize;
    if (firstChunkLen > 0) {
      const chunkStr = numberStr.substring(currentPos, currentPos + firstChunkLen);
      this._magnitude = BigInt(this._parseBaseWord(chunkStr, base));
      currentPos += firstChunkLen;
    }
    while (currentPos < totalLen) {
      const chunkStr = numberStr.substring(currentPos, currentPos + groupSize);
      const wordVal = BigInt(this._parseBaseWord(chunkStr, base));
      this._magnitude = this._magnitude * groupBaseBigInt + wordVal;
      currentPos += groupSize;
    }
    this._finishInitialization();
  }
  _parseBaseWord(str, base) {
    let r = 0;
    for (let i = 0;i < str.length; i++) {
      const charCode = str.codePointAt(i);
      let digitVal;
      if (charCode >= 48 && charCode <= 57)
        digitVal = charCode - 48;
      else if (charCode >= 65 && charCode <= 90)
        digitVal = charCode - 65 + 10;
      else if (charCode >= 97 && charCode <= 122)
        digitVal = charCode - 97 + 10;
      else
        throw new Error("Invalid character: " + str[i]);
      if (digitVal >= base)
        throw new Error("Invalid character");
      r = r * base + digitVal;
    }
    return r;
  }
  _initializeState(magnitude, sign) {
    this._magnitude = magnitude;
    this._sign = magnitude === 0n ? 0 : sign;
    this._finishInitialization();
  }
  _finishInitialization() {
    if (this._magnitude === 0n) {
      this._nominalWordLength = 1;
      this._sign = 0;
    } else {
      const bitLen = this._magnitude.toString(2).length;
      this._nominalWordLength = Math.max(1, Math.ceil(bitLen / BigNumber.wordSize));
    }
  }
  assert(val, msg = "Assertion failed") {
    if (!val)
      throw new Error(msg);
  }
  initNumber(number, endian = "be") {
    this.assert(BigInt(Math.abs(number)) <= BigNumber.MAX_NUMBER_CONSTRUCTOR_MAG_BIGINT, "The number is larger than 2 ^ 53 (unsafe)");
    this.assert(number % 1 === 0, "Number must be an integer for BigNumber conversion");
    this._initializeState(BigInt(Math.abs(number)), number < 0 ? 1 : 0);
    if (endian === "le") {
      const currentSign = this._sign;
      const beBytes = this.toArray("be");
      this.initArray(beBytes, "le");
      this._sign = currentSign;
      this.normSign();
    }
    return this;
  }
  initArray(bytes, endian) {
    if (bytes.length === 0) {
      this._initializeState(0n, 0);
      return this;
    }
    let magnitude = 0n;
    if (endian === "be") {
      for (const byte of bytes)
        magnitude = magnitude << 8n | BigInt(byte & 255);
    } else {
      for (let i = bytes.length - 1;i >= 0; i--)
        magnitude = magnitude << 8n | BigInt(bytes[i] & 255);
    }
    this._initializeState(magnitude, 0);
    return this;
  }
  copy(dest) {
    dest._magnitude = this._magnitude;
    dest._sign = this._sign;
    dest._nominalWordLength = this._nominalWordLength;
    dest.red = this.red;
  }
  static move(dest, src) {
    dest._magnitude = src._magnitude;
    dest._sign = src._sign;
    dest._nominalWordLength = src._nominalWordLength;
    dest.red = src.red;
  }
  clone() {
    const r = new BigNumber(0n);
    this.copy(r);
    return r;
  }
  expand(size) {
    this.assert(Number.isSafeInteger(size) && size >= 0 && size <= BigNumber.MAX_NOMINAL_WORD_LENGTH, "Expand size must be a non-negative safe integer within the supported word limit");
    this._nominalWordLength = Math.max(this._nominalWordLength, size, 1);
    return this;
  }
  strip() {
    this._finishInitialization();
    return this.normSign();
  }
  normSign() {
    if (this._magnitude === 0n) {
      this._sign = 0;
    }
    return this;
  }
  inspect() {
    return (this.red === null ? "<BN: " : "<BN-R: ") + this.toString(16) + ">";
  }
  _getMinimalHex() {
    if (this._magnitude === 0n)
      return "0";
    return this._magnitude.toString(16);
  }
  _toHexString(padding) {
    let hexStr = this._getMinimalHex();
    if (padding > 1) {
      if (hexStr !== "0" && hexStr.length % 2 !== 0) {
        hexStr = "0" + hexStr;
      }
      while (hexStr.length % padding !== 0) {
        hexStr = "0" + hexStr;
      }
    }
    return (this.isNeg() ? "-" : "") + hexStr;
  }
  toString(base = 10, padding = 1) {
    if (base === 16 || base === "hex") {
      return this._toHexString(padding);
    }
    if (typeof base !== "number" || base < 2 || base > 36 || base % 1 !== 0)
      throw new Error("Base should be an integer between 2 and 36");
    return this.toBaseString(base, padding);
  }
  toBaseString(base, padding) {
    if (this._magnitude === 0n) {
      return BigNumber._paddedZero(padding);
    }
    let groupSize = BigNumber.groupSizes[base];
    let groupBaseBigInt = BigInt(BigNumber.groupBases[base]);
    if (groupSize === 0 || groupBaseBigInt === 0n) {
      groupSize = Math.floor(Math.log(Number.MAX_SAFE_INTEGER) / Math.log(base));
      if (groupSize === 0)
        groupSize = 1;
      groupBaseBigInt = BigInt(base) ** BigInt(groupSize);
    }
    let out = "";
    let tempMag = this._magnitude;
    while (tempMag > 0n) {
      const remainder = tempMag % groupBaseBigInt;
      tempMag /= groupBaseBigInt;
      const chunkStr = this._bigIntToStringInBase(remainder, base);
      out = (tempMag > 0n ? this._zeroPaddedChunk(chunkStr, groupSize) : chunkStr) + out;
    }
    if (padding > 0) {
      while (out.length < padding)
        out = "0" + out;
    }
    return (this._sign === 1 ? "-" : "") + out;
  }
  static _paddedZero(padding) {
    let out = "0";
    if (padding > 1) {
      while (out.length < padding)
        out = "0" + out;
    }
    return out;
  }
  _zeroPaddedChunk(chunkStr, groupSize) {
    const zerosToPrepend = groupSize - chunkStr.length;
    if (zerosToPrepend <= 0)
      return chunkStr;
    if (zerosToPrepend < BigNumber.zeros.length)
      return BigNumber.zeros[zerosToPrepend] + chunkStr;
    return "0".repeat(zerosToPrepend) + chunkStr;
  }
  toNumber() {
    const val = this._getSignedValue();
    if (val > BigNumber.MAX_SAFE_INTEGER_BIGINT || val < BigNumber.MIN_SAFE_INTEGER_BIGINT)
      throw new Error("Number can only safely store up to 53 bits");
    return Number(val);
  }
  toBigInt() {
    return this._getSignedValue();
  }
  toJSON() {
    const hex = this._getMinimalHex();
    return (this.isNeg() ? "-" : "") + hex;
  }
  toArrayLikeGeneric(res, isLE) {
    let tempMag = this._magnitude;
    let position = isLE ? 0 : res.length - 1;
    const increment = isLE ? 1 : -1;
    for (const _byte of res) {
      if (tempMag === 0n && position >= 0 && position < res.length) {
        res[position] = 0;
      } else if (position >= 0 && position < res.length) {
        res[position] = Number(tempMag & 0xffn);
      } else {
        break;
      }
      tempMag >>= 8n;
      position += increment;
    }
  }
  toArray(endian = "be", length) {
    this.strip();
    const actualByteLength = this.byteLength();
    const reqLength = length ?? Math.max(1, actualByteLength);
    this.assert(actualByteLength <= reqLength, "byte array longer than desired length");
    this.assert(reqLength > 0, "Requested array length <= 0");
    const res = Array.from({ length: reqLength }).fill(0);
    if (this._magnitude === 0n && reqLength > 0)
      return res;
    if (this._magnitude === 0n && reqLength === 0)
      return [];
    this.toArrayLikeGeneric(res, endian === "le");
    return res;
  }
  bitLength() {
    if (this._magnitude === 0n) {
      return 0;
    }
    return this._magnitude.toString(2).length;
  }
  static toBitArray(num) {
    const len = num.bitLength();
    if (len === 0)
      return [];
    const w = Array.from({ length: len });
    const mag = num._magnitude;
    for (let bit = 0;bit < len; bit++) {
      w[bit] = (mag >> BigInt(bit) & 1n) === 0n ? 0 : 1;
    }
    return w;
  }
  toBitArray() {
    return BigNumber.toBitArray(this);
  }
  zeroBits() {
    if (this._magnitude === 0n)
      return 0;
    let c = 0;
    let t = this._magnitude;
    while ((t & 1n) === 0n && t !== 0n) {
      c++;
      t >>= 1n;
    }
    return c;
  }
  byteLength() {
    if (this._magnitude === 0n) {
      return 0;
    }
    return Math.ceil(this.bitLength() / 8);
  }
  _getSignedValue() {
    return this._sign === 1 ? -this._magnitude : this._magnitude;
  }
  _setValueFromSigned(sVal) {
    if (sVal < 0n) {
      this._magnitude = -sVal;
      this._sign = 1;
    } else {
      this._magnitude = sVal;
      this._sign = 0;
    }
    this._finishInitialization();
    this.normSign();
  }
  toTwos(width) {
    this.assert(width >= 0);
    const Bw = BigInt(width);
    let v = this._getSignedValue();
    if (this._sign === 1 && this._magnitude !== 0n)
      v = (1n << Bw) + v;
    const m = (1n << Bw) - 1n;
    v &= m;
    const r = new BigNumber(0n);
    r._initializeState(v, 0);
    return r;
  }
  fromTwos(width) {
    this.assert(width >= 0);
    const Bw = BigInt(width);
    const m = this._magnitude;
    if (width > 0 && (m >> Bw - 1n & 1n) !== 0n && this._sign === 0) {
      const sVal = m - (1n << Bw);
      const r = new BigNumber(0n);
      r._setValueFromSigned(sVal);
      return r;
    }
    return this.clone();
  }
  isNeg() {
    return this._sign === 1 && this._magnitude !== 0n;
  }
  neg() {
    return this.clone().ineg();
  }
  ineg() {
    if (this._magnitude !== 0n) {
      this._sign = this._sign === 1 ? 0 : 1;
    }
    return this;
  }
  _iuop(num, op, isXor = false) {
    const newMag = op(this._magnitude, num._magnitude);
    let targetNominalLength = this._nominalWordLength;
    if (isXor)
      targetNominalLength = Math.max(this.length, num.length);
    this._magnitude = newMag;
    this._finishInitialization();
    if (isXor)
      this._nominalWordLength = Math.max(this._nominalWordLength, targetNominalLength);
    return this.strip();
  }
  iuor(num) {
    return this._iuop(num, (a, b) => a | b);
  }
  iuand(num) {
    return this._iuop(num, (a, b) => a & b);
  }
  iuxor(num) {
    return this._iuop(num, (a, b) => a ^ b, true);
  }
  _iop(num, op, isXor = false) {
    this.assert(this._sign === 0 && num._sign === 0);
    return this._iuop(num, op, isXor);
  }
  ior(num) {
    return this._iop(num, (a, b) => a | b);
  }
  iand(num) {
    return this._iop(num, (a, b) => a & b);
  }
  ixor(num) {
    return this._iop(num, (a, b) => a ^ b, true);
  }
  _uop_new(num, opName) {
    if (this.length >= num.length) {
      return this.clone()[opName](num);
    }
    return num.clone()[opName](this);
  }
  or(num) {
    this.assert(this._sign === 0 && num._sign === 0);
    return this._uop_new(num, "iuor");
  }
  uor(num) {
    return this._uop_new(num, "iuor");
  }
  and(num) {
    this.assert(this._sign === 0 && num._sign === 0);
    return this._uop_new(num, "iuand");
  }
  uand(num) {
    return this._uop_new(num, "iuand");
  }
  xor(num) {
    this.assert(this._sign === 0 && num._sign === 0);
    return this._uop_new(num, "iuxor");
  }
  uxor(num) {
    return this._uop_new(num, "iuxor");
  }
  inotn(width) {
    this.assert(typeof width === "number" && width >= 0);
    const Bw = BigInt(width);
    const m = (1n << Bw) - 1n;
    this._magnitude = ~this._magnitude & m;
    const wfw = width === 0 ? 1 : Math.ceil(width / BigNumber.wordSize);
    this._nominalWordLength = Math.max(1, wfw);
    this.strip();
    this._nominalWordLength = Math.max(this._nominalWordLength, Math.max(1, wfw));
    return this;
  }
  notn(width) {
    return this.clone().inotn(width);
  }
  setn(bit, val) {
    this.assert(typeof bit === "number" && bit >= 0);
    const Bb = BigInt(bit);
    if (val === 1 || val === true)
      this._magnitude |= 1n << Bb;
    else
      this._magnitude &= ~(1n << Bb);
    const wnb = Math.floor(bit / BigNumber.wordSize) + 1;
    this._nominalWordLength = Math.max(this._nominalWordLength, wnb);
    this._finishInitialization();
    return this.strip();
  }
  iadd(num) {
    this._setValueFromSigned(this._getSignedValue() + num._getSignedValue());
    return this;
  }
  add(num) {
    const r = new BigNumber(0n);
    r._setValueFromSigned(this._getSignedValue() + num._getSignedValue());
    return r;
  }
  isub(num) {
    this._setValueFromSigned(this._getSignedValue() - num._getSignedValue());
    return this;
  }
  sub(num) {
    const r = new BigNumber(0n);
    r._setValueFromSigned(this._getSignedValue() - num._getSignedValue());
    return r;
  }
  mul(num) {
    const r = new BigNumber(0n);
    r._magnitude = this._magnitude * num._magnitude;
    r._sign = r._magnitude === 0n ? 0 : this._sign ^ num._sign;
    r._nominalWordLength = this.length + num.length;
    r.red = null;
    return r.normSign();
  }
  imul(num) {
    this._magnitude *= num._magnitude;
    this._sign = this._magnitude === 0n ? 0 : this._sign ^ num._sign;
    this._nominalWordLength = this.length + num.length;
    this.red = null;
    return this.normSign();
  }
  imuln(num) {
    this.assert(typeof num === "number", "Assertion failed");
    this.assert(Math.abs(num) <= BigNumber.MAX_IMULN_ARG, "Assertion failed");
    this._setValueFromSigned(this._getSignedValue() * BigInt(num));
    return this;
  }
  muln(num) {
    return this.clone().imuln(num);
  }
  sqr() {
    const r = new BigNumber(0n);
    r._magnitude = this._magnitude * this._magnitude;
    r._sign = 0;
    r._nominalWordLength = this.length * 2;
    r.red = null;
    return r;
  }
  isqr() {
    this._magnitude *= this._magnitude;
    this._sign = 0;
    this._nominalWordLength = this.length * 2;
    this.red = null;
    return this;
  }
  pow(num) {
    this.assert(num._sign === 0, "Exponent for pow must be non-negative");
    if (num.isZero())
      return new BigNumber(1n);
    const res = new BigNumber(1n);
    const currentBase = this.clone();
    const exp = num.clone();
    const baseIsNegative = currentBase.isNeg();
    const expIsOdd = exp.isOdd();
    if (baseIsNegative)
      currentBase.ineg();
    while (!exp.isZero()) {
      if (exp.isOdd()) {
        res.imul(currentBase);
      }
      currentBase.isqr();
      exp.iushrn(1);
    }
    if (baseIsNegative && expIsOdd) {
      res.ineg();
    }
    return res;
  }
  static normalizeNonNegativeBigInt(value, label) {
    if (typeof value === "number") {
      if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0)
        throw new Error(`${label} must be a non-negative integer`);
      return BigInt(value);
    }
    if (value < 0n)
      throw new Error(`${label} must be a non-negative integer`);
    return value;
  }
  iushln(bits) {
    const normalizedBits = BigNumber.normalizeNonNegativeBigInt(bits, "Shift bits");
    if (normalizedBits === 0n)
      return this;
    this._magnitude <<= normalizedBits;
    this._finishInitialization();
    return this.strip();
  }
  ishln(bits) {
    this.assert(this._sign === 0, "ishln requires positive number");
    return this.iushln(bits);
  }
  iushrn(bits, hint, extended) {
    const normalizedBits = BigNumber.normalizeNonNegativeBigInt(bits, "Shift bits");
    if (normalizedBits === 0n) {
      if (extended != null)
        extended._initializeState(0n, 0);
      return this;
    }
    if (extended != null) {
      const m = (1n << normalizedBits) - 1n;
      const sOut = this._magnitude & m;
      extended._initializeState(sOut, 0);
    }
    this._magnitude >>= normalizedBits;
    this._finishInitialization();
    return this.strip();
  }
  ishrn(bits, hint, extended) {
    this.assert(this._sign === 0, "ishrn requires positive number");
    return this.iushrn(bits, hint, extended);
  }
  shln(bits) {
    return this.clone().ishln(bits);
  }
  ushln(bits) {
    return this.clone().iushln(bits);
  }
  shrn(bits) {
    return this.clone().ishrn(bits);
  }
  ushrn(bits) {
    return this.clone().iushrn(bits);
  }
  testn(bit) {
    this.assert(typeof bit === "number" && bit >= 0);
    return (this._magnitude >> BigInt(bit) & 1n) !== 0n;
  }
  imaskn(bits) {
    this.assert(typeof bits === "number" && bits >= 0);
    this.assert(this._sign === 0, "imaskn works only with positive numbers");
    const Bb = BigInt(bits);
    const m = Bb === 0n ? 0n : (1n << Bb) - 1n;
    this._magnitude &= m;
    const wfm = bits === 0 ? 1 : Math.max(1, Math.ceil(bits / BigNumber.wordSize));
    this._nominalWordLength = wfm;
    this._finishInitialization();
    this._nominalWordLength = Math.max(this._nominalWordLength, wfm);
    return this.strip();
  }
  maskn(bits) {
    return this.clone().imaskn(bits);
  }
  iaddn(num) {
    this.assert(typeof num === "number");
    this.assert(Math.abs(num) <= BigNumber.MAX_IMULN_ARG, "num is too large");
    this._setValueFromSigned(this._getSignedValue() + BigInt(num));
    return this;
  }
  _iaddn(num) {
    return this.iaddn(num);
  }
  isubn(num) {
    this.assert(typeof num === "number");
    this.assert(Math.abs(num) <= BigNumber.MAX_IMULN_ARG, "Assertion failed");
    this._setValueFromSigned(this._getSignedValue() - BigInt(num));
    return this;
  }
  addn(num) {
    return this.clone().iaddn(num);
  }
  subn(num) {
    return this.clone().isubn(num);
  }
  iabs() {
    this._sign = 0;
    return this;
  }
  abs() {
    return this.clone().iabs();
  }
  divmod(num, mode, positive) {
    this.assert(!num.isZero(), "Division by zero");
    if (this.isZero()) {
      const z = new BigNumber(0n);
      return { div: mode === "mod" ? null : z, mod: mode === "div" ? null : z };
    }
    const tV = this._getSignedValue();
    const nV = num._getSignedValue();
    const dV = mode !== "mod" ? tV / nV : null;
    const mV = this._computeMod(tV, nV, mode, positive);
    return { div: this._bigNumberFromSigned(dV), mod: this._bigNumberFromSigned(mV) };
  }
  _computeMod(tV, nV, mode, positive) {
    if (mode === "div")
      return null;
    let mV = tV % nV;
    if (positive === true && mV < 0n)
      mV += nV < 0n ? -nV : nV;
    return mV;
  }
  _bigNumberFromSigned(v) {
    if (v === null)
      return null;
    const r = new BigNumber(0n);
    r._setValueFromSigned(v);
    return r;
  }
  div(num) {
    return this.divmod(num, "div", false).div;
  }
  mod(num) {
    return this.divmod(num, "mod", false).mod;
  }
  umod(num) {
    return this.divmod(num, "mod", true).mod;
  }
  divRound(num) {
    this.assert(!num.isZero());
    const tV = this._getSignedValue();
    const nV = num._getSignedValue();
    let d = tV / nV;
    const m = tV % nV;
    if (m === 0n) {
      const r = new BigNumber(0n);
      r._setValueFromSigned(d);
      return r;
    }
    const absM = m < 0n ? -m : m;
    const absNV = nV < 0n ? -nV : nV;
    if (absM * 2n >= absNV) {
      if (tV > 0n && nV > 0n || tV < 0n && nV < 0n) {
        d += 1n;
      } else {
        d -= 1n;
      }
    }
    const r = new BigNumber(0n);
    r._setValueFromSigned(d);
    return r;
  }
  modrn(numArg) {
    this.assert(numArg !== 0, "Division by zero in modrn");
    const absDivisor = BigInt(Math.abs(numArg));
    if (absDivisor === 0n)
      throw new Error("Division by zero in modrn");
    const remainderMag = this._magnitude % absDivisor;
    return numArg < 0 ? Number(-remainderMag) : Number(remainderMag);
  }
  idivn(num) {
    this.assert(num !== 0);
    this.assert(Math.abs(num) <= BigNumber.MAX_IMULN_ARG, "num is too large");
    this._setValueFromSigned(this._getSignedValue() / BigInt(num));
    return this;
  }
  divn(num) {
    return this.clone().idivn(num);
  }
  egcd(p) {
    this.assert(p._sign === 0, "p must not be negative");
    this.assert(!p.isZero(), "p must not be zero");
    let uV = this._getSignedValue();
    let vV = p._magnitude;
    let a = 1n;
    let pa = 0n;
    let b = 0n;
    let pb = 1n;
    while (vV !== 0n) {
      const q = uV / vV;
      let t = vV;
      vV = uV % vV;
      uV = t;
      t = pa;
      pa = a - q * pa;
      a = t;
      t = pb;
      pb = b - q * pb;
      b = t;
    }
    const ra = new BigNumber(0n);
    ra._setValueFromSigned(a);
    const rb = new BigNumber(0n);
    rb._setValueFromSigned(b);
    const rg = new BigNumber(0n);
    rg._initializeState(uV < 0n ? -uV : uV, 0);
    return { a: ra, b: rb, gcd: rg };
  }
  gcd(num) {
    let u = this._magnitude;
    let v = num._magnitude;
    if (u === 0n) {
      const r = new BigNumber(0n);
      r._setValueFromSigned(v);
      return r.iabs();
    }
    if (v === 0n) {
      const r = new BigNumber(0n);
      r._setValueFromSigned(u);
      return r.iabs();
    }
    while (v !== 0n) {
      const t = u % v;
      u = v;
      v = t;
    }
    const res = new BigNumber(0n);
    res._initializeState(u, 0);
    return res;
  }
  invm(num) {
    this.assert(!num.isZero() && num._sign === 0, "Modulus for invm must be positive and non-zero");
    const eg = this.egcd(num);
    if (!eg.gcd.eqn(1)) {
      throw new Error("Inverse does not exist (numbers are not coprime).");
    }
    return eg.a.umod(num);
  }
  isEven() {
    return this._magnitude % 2n === 0n;
  }
  isOdd() {
    return this._magnitude % 2n === 1n;
  }
  andln(num) {
    this.assert(num >= 0);
    return Number(this._magnitude & BigInt(num));
  }
  bincn(bit) {
    this.assert(typeof bit === "number" && bit >= 0);
    const BVal = 1n << BigInt(bit);
    this._setValueFromSigned(this._getSignedValue() + BVal);
    return this;
  }
  isZero() {
    return this._magnitude === 0n;
  }
  cmpn(num) {
    this.assert(Math.abs(num) <= BigNumber.MAX_IMULN_ARG, "Number is too big");
    const tV = this._getSignedValue();
    const nV = BigInt(num);
    if (tV < nV) {
      return -1;
    }
    if (tV > nV) {
      return 1;
    }
    return 0;
  }
  cmp(num) {
    const tV = this._getSignedValue();
    const nV = num._getSignedValue();
    if (tV < nV) {
      return -1;
    }
    if (tV > nV) {
      return 1;
    }
    return 0;
  }
  ucmp(num) {
    if (this._magnitude < num._magnitude) {
      return -1;
    }
    if (this._magnitude > num._magnitude) {
      return 1;
    }
    return 0;
  }
  gtn(num) {
    return this.cmpn(num) === 1;
  }
  gt(num) {
    return this.cmp(num) === 1;
  }
  gten(num) {
    return this.cmpn(num) >= 0;
  }
  gte(num) {
    return this.cmp(num) >= 0;
  }
  ltn(num) {
    return this.cmpn(num) === -1;
  }
  lt(num) {
    return this.cmp(num) === -1;
  }
  lten(num) {
    return this.cmpn(num) <= 0;
  }
  lte(num) {
    return this.cmp(num) <= 0;
  }
  eqn(num) {
    return this.cmpn(num) === 0;
  }
  eq(num) {
    return this.cmp(num) === 0;
  }
  toRed(ctx) {
    this.assert(this.red == null, "Already a number in reduction context");
    this.assert(this._sign === 0, "toRed works only with positives");
    return ctx.convertTo(this).forceRed(ctx);
  }
  fromRed() {
    this.assert(this.red, "fromRed works only with numbers in reduction context");
    return this.red.convertFrom(this);
  }
  forceRed(ctx) {
    this.red = ctx;
    return this;
  }
  redAdd(num) {
    this.assert(this.red, "redAdd works only with red numbers");
    return this.red.add(this, num);
  }
  redIAdd(num) {
    this.assert(this.red, "redIAdd works only with red numbers");
    return this.red.iadd(this, num);
  }
  redSub(num) {
    this.assert(this.red, "redSub works only with red numbers");
    return this.red.sub(this, num);
  }
  redISub(num) {
    this.assert(this.red, "redISub works only with red numbers");
    return this.red.isub(this, num);
  }
  redShl(num) {
    this.assert(this.red, "redShl works only with red numbers");
    return this.red.shl(this, num);
  }
  redMul(num) {
    this.assert(this.red, "redMul works only with red numbers");
    this.red.verify2(this, num);
    return this.red.mul(this, num);
  }
  redIMul(num) {
    this.assert(this.red, "redIMul works only with red numbers");
    this.red.verify2(this, num);
    return this.red.imul(this, num);
  }
  redSqr() {
    this.assert(this.red, "redSqr works only with red numbers");
    this.red.verify1(this);
    return this.red.sqr(this);
  }
  redISqr() {
    this.assert(this.red, "redISqr works only with red numbers");
    this.red.verify1(this);
    return this.red.isqr(this);
  }
  redSqrt() {
    this.assert(this.red, "redSqrt works only with red numbers");
    this.red.verify1(this);
    return this.red.sqrt(this);
  }
  redInvm() {
    this.assert(this.red, "redInvm works only with red numbers");
    this.red.verify1(this);
    return this.red.invm(this);
  }
  redNeg() {
    this.assert(this.red, "redNeg works only with red numbers");
    this.red.verify1(this);
    return this.red.neg(this);
  }
  redPow(num) {
    this.assert(this.red != null && num.red == null, "redPow(normalNum)");
    this.red.verify1(this);
    return this.red.pow(this, num);
  }
  static fromHex(hex, endian) {
    let eE = "be";
    if (endian === "little" || endian === "le")
      eE = "le";
    return new BigNumber(hex, 16, eE);
  }
  toHex(byteLength = 0) {
    if (this.isZero() && byteLength === 0)
      return "";
    let hexStr = this._getMinimalHex();
    if (hexStr !== "0" && hexStr.length % 2 !== 0) {
      hexStr = "0" + hexStr;
    }
    const minChars = byteLength * 2;
    while (hexStr.length < minChars) {
      hexStr = "0" + hexStr;
    }
    return (this.isNeg() ? "-" : "") + hexStr;
  }
  static fromJSON(str) {
    return new BigNumber(str, 16);
  }
  static fromNumber(n) {
    return new BigNumber(n);
  }
  static fromString(str, base) {
    return new BigNumber(str, base);
  }
  static fromSm(bytes, endian = "big") {
    if (bytes.length === 0)
      return new BigNumber(0n);
    const beBytes = bytes.slice();
    if (endian === "little") {
      beBytes.reverse();
    }
    let sign = 0;
    if (beBytes.length > 0 && (beBytes[0] & 128) !== 0) {
      sign = 1;
      beBytes[0] &= 127;
    }
    let hexStr;
    if (CAN_USE_BUFFER) {
      hexStr = BufferCtor.from(beBytes).toString("hex");
    } else {
      hexStr = "";
      for (const byte of beBytes) {
        hexStr += byte < 16 ? "0" + byte.toString(16) : byte.toString(16);
      }
    }
    const magnitude = hexStr.length === 0 ? 0n : BigInt("0x" + hexStr);
    const r = new BigNumber(0n);
    r._initializeState(magnitude, sign);
    return r;
  }
  toSm(endian = "big") {
    if (this._magnitude === 0n) {
      return this._sign === 1 ? [128] : [];
    }
    let hex = this._getMinimalHex();
    if (hex.length % 2 !== 0)
      hex = "0" + hex;
    const byteLen = hex.length / 2;
    const bytes = Array.from({ length: byteLen });
    for (let i = 0, j = 0;i < hex.length; i += 2) {
      const high = HEX_CHAR_TO_VALUE[hex.codePointAt(i)];
      const low = HEX_CHAR_TO_VALUE[hex.codePointAt(i + 1)];
      bytes[j++] = (high & 15) << 4 | low & 15;
    }
    let result;
    if (this._sign === 1) {
      if ((bytes[0] & 128) === 0) {
        result = bytes.slice();
        result[0] |= 128;
      } else {
        result = [128, ...bytes];
      }
    } else if ((bytes[0] & 128) === 0) {
      result = bytes.slice();
    } else {
      result = [0, ...bytes];
    }
    return endian === "little" ? result.reverse() : result;
  }
  static fromBits(bits, strict = false) {
    const nSize = bits >>> 24;
    const nWordCompact = bits & 8388607;
    const isNegativeFromBit = (bits & 8388608) !== 0;
    if (strict && isNegativeFromBit) {
      throw new Error("negative bit set");
    }
    if (nSize === 0 && nWordCompact === 0) {
      if (isNegativeFromBit && strict)
        throw new Error("negative bit set for zero value");
      return new BigNumber(0n);
    }
    const bn = new BigNumber(nWordCompact);
    if (nSize <= 3) {
      bn.iushrn((3 - nSize) * 8);
    } else {
      bn.iushln((nSize - 3) * 8);
    }
    if (isNegativeFromBit) {
      bn.ineg();
    }
    return bn;
  }
  toBits() {
    this.strip();
    if (this.isZero() && !this.isNeg())
      return 0;
    const isActualNegative = this.isNeg();
    const bnAbs = this.abs();
    let mB = bnAbs.toArray("be");
    let firstNonZeroIdx = 0;
    while (firstNonZeroIdx < mB.length - 1 && mB[firstNonZeroIdx] === 0) {
      firstNonZeroIdx++;
    }
    mB = mB.slice(firstNonZeroIdx);
    let nSize = mB.length;
    let nWordNum;
    if (nSize === 0) {
      nWordNum = 0;
    } else if (nSize <= 3) {
      nWordNum = 0;
      for (let i = 0;i < nSize; i++) {
        nWordNum = nWordNum << 8 | mB[i];
      }
    } else {
      nWordNum = mB[0] << 16 | mB[1] << 8 | mB[2];
    }
    if ((nWordNum & 8388608) !== 0 && nSize <= 255) {
      nWordNum >>>= 8;
      nSize++;
    }
    let b = nSize << 24 | nWordNum;
    if (isActualNegative)
      b |= 8388608;
    return b >>> 0;
  }
  static fromScriptNum(num, requireMinimal = false, maxNumSize) {
    if (maxNumSize !== undefined && num.length > maxNumSize)
      throw new Error("script number overflow");
    if (num.length === 0)
      return new BigNumber(0n);
    if (requireMinimal) {
      if ((num.at(-1) & 127) === 0) {
        if (num.length <= 1 || (num.at(-2) & 128) === 0) {
          throw new Error("non-minimally encoded script number");
        }
      }
    }
    return BigNumber.fromSm(num, "little");
  }
  toScriptNum() {
    return this.toSm("little");
  }
  _invmp(p) {
    this.assert(p._sign === 0, "p must not be negative for _invmp");
    this.assert(!p.isZero(), "p must not be zero for _invmp");
    const a = this.umod(p);
    const exp = p.subn(2);
    if (a.red !== null) {
      return a.redPow(exp);
    }
    let result = new BigNumber(1n);
    let base = a.clone();
    const e = exp.clone();
    while (!e.isZero()) {
      if (e.isOdd())
        result = result.mul(base).umod(p);
      base = base.sqr().umod(p);
      e.iushrn(1);
    }
    return result;
  }
  mulTo(num, out) {
    out._magnitude = this._magnitude * num._magnitude;
    out._sign = out._magnitude === 0n ? 0 : this._sign ^ num._sign;
    out._nominalWordLength = this.length + num.length;
    out.red = null;
    out.normSign();
    return out;
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/Mersenne.js
class Mersenne {
  name;
  p;
  k;
  n;
  tmp;
  constructor(name, p) {
    this.name = name;
    this.p = new BigNumber(p, 16);
    this.n = this.p.bitLength();
    this.k = new BigNumber(BigInt(1)).iushln(this.n).isub(this.p);
    this.tmp = this._tmp();
  }
  _tmp() {
    const tmp = new BigNumber(BigInt(0));
    const requiredWords = Math.ceil(this.n / BigNumber.wordSize);
    tmp.expand(Math.max(1, requiredWords));
    return tmp;
  }
  ireduce(num) {
    const r = num;
    let rlen;
    do {
      this.split(r, this.tmp);
      this.imulK(r);
      r.iadd(this.tmp);
      rlen = r.bitLength();
    } while (rlen > this.n);
    const cmp = rlen < this.n ? -1 : r.ucmp(this.p);
    if (cmp === 0) {
      r.words = [0];
    } else if (cmp > 0) {
      r.isub(this.p);
    }
    r.strip();
    return r;
  }
  split(input, out) {
    input.iushrn(this.n, 0, out);
  }
  imulK(num) {
    return num.imul(this.k);
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/K256.js
class K256 extends Mersenne {
  constructor() {
    super("k256", "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f");
  }
  split(input, output) {
    const mask = 4194303;
    const inputWords = input.words;
    const inputNominalLength = input.length;
    const outLen = Math.min(inputNominalLength, 9);
    const tempOutputWords = Array.from({ length: outLen + (inputNominalLength > 9 ? 1 : 0) }, () => 0);
    for (let i = 0;i < outLen; i++) {
      tempOutputWords[i] = inputWords[i];
    }
    let currentOutputWordCount = outLen;
    if (inputNominalLength <= 9) {
      const finalOutputWords = Array.from({ length: currentOutputWordCount }, () => 0);
      for (let i = 0;i < currentOutputWordCount; ++i)
        finalOutputWords[i] = tempOutputWords[i];
      output.words = finalOutputWords;
      input.words = [0];
      return;
    }
    let prev = inputWords[9];
    tempOutputWords[currentOutputWordCount++] = prev & mask;
    const finalOutputWords = Array.from({ length: currentOutputWordCount }, () => 0);
    for (let i = 0;i < currentOutputWordCount; ++i)
      finalOutputWords[i] = tempOutputWords[i];
    output.words = finalOutputWords;
    const tempInputNewWords = Array.from({ length: Math.max(1, inputNominalLength - 9) }, () => 0);
    let currentInputNewWordCount = 0;
    for (let i = 10;i < inputNominalLength; i++) {
      const next = Math.trunc(inputWords[i]);
      if (currentInputNewWordCount < tempInputNewWords.length) {
        tempInputNewWords[currentInputNewWordCount++] = (next & mask) << 4 | prev >>> 22;
      }
      prev = next;
    }
    prev >>>= 22;
    if (currentInputNewWordCount < tempInputNewWords.length) {
      tempInputNewWords[currentInputNewWordCount++] = prev;
    } else if (prev !== 0 && tempInputNewWords.length > 0) {}
    const finalInputNewWords = Array.from({ length: currentInputNewWordCount }, () => 0);
    for (let i = 0;i < currentInputNewWordCount; ++i)
      finalInputNewWords[i] = tempInputNewWords[i];
    input.words = finalInputNewWords;
  }
  imulK(num) {
    const currentWords = num.words;
    const originalNominalLength = num.length;
    const newNominalLength = originalNominalLength + 2;
    const tempWords = Array.from({ length: newNominalLength }, () => 0);
    for (let i = 0;i < originalNominalLength; i++) {
      tempWords[i] = currentWords[i];
    }
    let lo = 0;
    for (let i = 0;i < newNominalLength; i++) {
      const w = Math.trunc(tempWords[i]);
      lo += w * 977;
      tempWords[i] = lo & 67108863;
      lo = w * 64 + Math.trunc(lo / 67108864);
    }
    num.words = tempWords;
    return num;
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/ReductionContext.js
class ReductionContext {
  prime;
  m;
  constructor(m) {
    if (m === "k256") {
      const prime = new K256;
      this.m = prime.p;
      this.prime = prime;
    } else {
      this.assert(m.gtn(1), "modulus must be greater than 1");
      this.m = m;
      this.prime = null;
    }
  }
  assert(val, msg = "Assertion failed") {
    if (!val)
      throw new Error(msg);
  }
  verify1(a) {
    this.assert(a.negative === 0, "red works only with positives");
    this.assert(a.red, "red works only with red numbers");
  }
  verify2(a, b) {
    this.assert((a.negative | b.negative) === 0, "red works only with positives");
    this.assert(a.red != null && a.red === b.red, "red works only with red numbers");
  }
  imod(a) {
    if (this.prime != null)
      return this.prime.ireduce(a).forceRed(this);
    BigNumber.move(a, a.umod(this.m).forceRed(this));
    return a;
  }
  neg(a) {
    if (a.isZero()) {
      return a.clone();
    }
    return this.m.sub(a).forceRed(this);
  }
  add(a, b) {
    this.verify2(a, b);
    const res = a.clone();
    res.iadd(b);
    res.isub(this.m);
    if (res.isNeg()) {
      res.iadd(this.m);
    }
    return res;
  }
  iadd(a, b) {
    this.verify2(a, b);
    a.iadd(b);
    a.isub(this.m);
    if (a.isNeg()) {
      a.iadd(this.m);
    }
    return a;
  }
  sub(a, b) {
    this.verify2(a, b);
    const res = a.sub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res.forceRed(this);
  }
  isub(a, b) {
    this.verify2(a, b);
    const res = a.isub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res;
  }
  shl(a, num) {
    this.verify1(a);
    return this.imod(a.ushln(num));
  }
  imul(a, b) {
    this.verify2(a, b);
    return this.imod(a.imul(b));
  }
  mul(a, b) {
    this.verify2(a, b);
    return this.imod(a.mul(b));
  }
  isqr(a) {
    return this.imul(a, a.clone());
  }
  sqr(a) {
    return this.mul(a, a);
  }
  sqrt(a) {
    if (a.isZero())
      return a.clone();
    const mod3 = this.m.andln(3);
    this.assert(mod3 % 2 === 1);
    if (mod3 === 3) {
      const pow = this.m.add(new BigNumber(1)).iushrn(2);
      return this.pow(a, pow);
    }
    const q = this.m.subn(1);
    let s = 0;
    while (!q.isZero() && q.andln(1) === 0) {
      s++;
      q.iushrn(1);
    }
    this.assert(!q.isZero());
    const one = new BigNumber(1).toRed(this);
    const nOne = one.redNeg();
    const lpow = this.m.subn(1).iushrn(1);
    const zl = this.m.bitLength();
    const z = new BigNumber(2 * zl * zl).toRed(this);
    while (this.pow(z, lpow).cmp(nOne) !== 0) {
      z.redIAdd(nOne);
    }
    let c = this.pow(z, q);
    let r = this.pow(a, q.addn(1).iushrn(1));
    let t = this.pow(a, q);
    let m = s;
    while (t.cmp(one) !== 0) {
      let tmp = t;
      let i = 0;
      while (tmp.cmp(one) !== 0) {
        tmp = tmp.redSqr();
        i++;
      }
      this.assert(i < m);
      const b = this.pow(c, new BigNumber(1).iushln(m - i - 1));
      r = r.redMul(b);
      c = b.redSqr();
      t = t.redMul(c);
      m = i;
    }
    return r;
  }
  invm(a) {
    const inv = a._invmp(this.m);
    if (inv.negative !== 0) {
      inv.negative = 0;
      return this.imod(inv).redNeg();
    } else {
      return this.imod(inv);
    }
  }
  pow(a, num) {
    this.verify1(a);
    if (num.isZero())
      return new BigNumber(1).toRed(this);
    let result = new BigNumber(1).toRed(this);
    const base = a.clone();
    const bits = num.bitLength();
    for (let i = bits - 1;i >= 0; i--) {
      result = this.sqr(result);
      if (num.testn(i)) {
        result = this.mul(result, base);
      }
    }
    return result;
  }
  convertTo(num) {
    const r = num.umod(this.m);
    return r === num ? r.clone() : r;
  }
  convertFrom(num) {
    const res = num.clone();
    res.red = null;
    return res;
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/MontgomoryMethod.js
class MontgomoryMethod extends ReductionContext {
  shift;
  r;
  r2;
  rinv;
  minv;
  constructor(m) {
    super(m);
    this.shift = this.m.bitLength();
    if (this.shift % 26 !== 0) {
      this.shift += 26 - this.shift % 26;
    }
    this.r = new BigNumber(1).iushln(this.shift);
    this.r2 = this.imod(this.r.sqr());
    this.rinv = this.r._invmp(this.m);
    this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
    this.minv = this.minv.umod(this.r);
    this.minv = this.r.sub(this.minv);
  }
  convertTo(num) {
    return this.imod(num.ushln(this.shift));
  }
  convertFrom(num) {
    const r = this.imod(num.mul(this.rinv));
    r.red = null;
    return r;
  }
  imul(a, b) {
    if (a.isZero() || b.isZero()) {
      a.words[0] = 0;
      a.length = 1;
      return a;
    }
    const t = a.imul(b);
    const c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    const u = t.isub(c).iushrn(this.shift);
    let res = u;
    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }
    return res.forceRed(this);
  }
  mul(a, b) {
    if (a.isZero() || b.isZero())
      return new BigNumber(0).forceRed(this);
    const t = a.mul(b);
    const c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    const u = t.isub(c).iushrn(this.shift);
    let res = u;
    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }
    return res.forceRed(this);
  }
  invm(a) {
    const res = this.imod(a._invmp(this.m).mul(this.r2));
    return res.forceRed(this);
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/hex.js
var PURE_HEX_REGEX = /^[0-9a-fA-F]*$/;
function assertValidHex(msg) {
  if (typeof msg !== "string") {
    throw new TypeError("Invalid hex string");
  }
  if (msg.length === 0)
    return;
  if (!PURE_HEX_REGEX.test(msg)) {
    throw new Error("Invalid hex string");
  }
}
function normalizeHex(msg) {
  assertValidHex(msg);
  if (msg.length === 0)
    return "";
  let normalized = msg.toLowerCase();
  if (normalized.length % 2 !== 0) {
    normalized = "0" + normalized;
  }
  return normalized;
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/Hash.js
var assert = (expression, message = "Hash assertion failed") => {
  if (!expression) {
    throw new Error(message);
  }
};

class BaseHash {
  pending = null;
  pendingTotal = 0;
  blockSize;
  outSize;
  endian;
  _delta8;
  _delta32;
  padLength;
  hmacStrength;
  constructor(blockSize, outSize, hmacStrength, padLength) {
    this.blockSize = blockSize;
    this.outSize = outSize;
    this.hmacStrength = hmacStrength;
    this.padLength = padLength / 8;
    this.endian = "big";
    this._delta8 = this.blockSize / 8;
    this._delta32 = this.blockSize / 32;
  }
  _update(_msg, _start) {
    throw new Error("Not implemented");
  }
  _digest() {
    throw new Error("Not implemented");
  }
  _digestHex() {
    throw new Error("Not implemented");
  }
  update(msg, enc) {
    msg = toArray(msg, enc);
    if (this.pending == null) {
      this.pending = msg;
    } else {
      this.pending = this.pending.concat(msg);
    }
    this.pendingTotal += msg.length;
    if (this.pending.length >= this._delta8) {
      msg = this.pending;
      const r = msg.length % this._delta8;
      this.pending = msg.slice(msg.length - r, msg.length);
      if (this.pending.length === 0) {
        this.pending = null;
      }
      msg = join32(msg, 0, msg.length - r, this.endian);
      for (let i = 0;i < msg.length; i += this._delta32) {
        this._update(msg, i);
      }
    }
    return this;
  }
  digest() {
    this.update(this._pad());
    assert(this.pending === null);
    return this._digest();
  }
  digestHex() {
    this.update(this._pad());
    assert(this.pending === null);
    return this._digestHex();
  }
  _pad() {
    const len = this.pendingTotal;
    if (!Number.isSafeInteger(len) || len < 0) {
      throw new Error("Message too long for this hash function");
    }
    const bytes = this._delta8;
    const k = bytes - (len + this.padLength) % bytes;
    const res = Array.from({ length: k + this.padLength });
    res[0] = 128;
    let i;
    for (i = 1;i < k; i++) {
      res[i] = 0;
    }
    const lengthBytes = this.padLength;
    const maxBits = 1n << BigInt(lengthBytes * 8);
    let totalBits = BigInt(len) * 8n;
    if (totalBits >= maxBits) {
      throw new Error("Message too long for this hash function");
    }
    if (this.endian === "big") {
      const lenArray = Array.from({ length: lengthBytes });
      for (let b = lengthBytes - 1;b >= 0; b--) {
        lenArray[b] = Number(totalBits & 0xffn);
        totalBits >>= 8n;
      }
      for (let b = 0;b < lengthBytes; b++) {
        res[i++] = lenArray[b];
      }
    } else {
      for (let b = 0;b < lengthBytes; b++) {
        res[i++] = Number(totalBits & 0xffn);
        totalBits >>= 8n;
      }
    }
    return res;
  }
}
function appendUtf8CodeUnit(msg, i, out) {
  const c = msg.codePointAt(i);
  if (c < 128) {
    out.push(c);
    return i;
  }
  if (c < 2048) {
    out.push(c >> 6 | 192, c & 63 | 128);
    return i;
  }
  if (c > 65535) {
    out.push(c >> 18 | 240, c >> 12 & 63 | 128, c >> 6 & 63 | 128, c & 63 | 128);
    return i + 1;
  }
  out.push(c >> 12 | 224, c >> 6 & 63 | 128, c & 63 | 128);
  return i;
}
function utf8StringToArray(msg) {
  const res = [];
  let i = 0;
  while (i < msg.length) {
    const lastConsumed = appendUtf8CodeUnit(msg, i, res);
    i = lastConsumed + 1;
  }
  return res;
}
function hexStringToArray(msg) {
  assertValidHex(msg);
  const normalized = normalizeHex(msg);
  const res = [];
  for (let i = 0;i < normalized.length; i += 2) {
    res.push(Number.parseInt(normalized[i] + normalized[i + 1], 16));
  }
  return res;
}
function numberArrayToByteArray(msg) {
  const res = [];
  for (let i = 0;i < msg.length; i++) {
    res[i] = Math.trunc(msg[i]);
  }
  return res;
}
function toArray(msg, enc) {
  if (Array.isArray(msg)) {
    return msg.slice();
  }
  if (!msg) {
    return [];
  }
  if (typeof msg === "string") {
    return enc === "hex" ? hexStringToArray(msg) : utf8StringToArray(msg);
  }
  return numberArrayToByteArray(msg);
}
function htonl(w) {
  return swapBytes32(w);
}
function toHex32(msg, endian) {
  let res = "";
  for (let w of msg) {
    if (endian === "little") {
      w = htonl(w);
    }
    res += zero8(w.toString(16));
  }
  return res;
}
function zero8(word) {
  if (word.length === 7) {
    return "0" + word;
  } else if (word.length === 6) {
    return "00" + word;
  } else if (word.length === 5) {
    return "000" + word;
  } else if (word.length === 4) {
    return "0000" + word;
  } else if (word.length === 3) {
    return "00000" + word;
  } else if (word.length === 2) {
    return "000000" + word;
  } else if (word.length === 1) {
    return "0000000" + word;
  } else {
    return word;
  }
}
var BufferCtor2 = typeof globalThis === "undefined" ? undefined : globalThis.Buffer;
var CAN_USE_BUFFER2 = BufferCtor2 != null && typeof BufferCtor2.from === "function";
var HEX_DIGITS = "0123456789abcdef";
var HEX_BYTE_STRINGS = Array.from({ length: 256 });
for (let i = 0;i < HEX_BYTE_STRINGS.length; i++) {
  HEX_BYTE_STRINGS[i] = HEX_DIGITS[i >> 4 & 15] + HEX_DIGITS[i & 15];
}
function bytesToHex(data) {
  if (CAN_USE_BUFFER2) {
    return BufferCtor2.from(data).toString("hex");
  }
  const out = Array.from({ length: data.length });
  for (let i = 0;i < data.length; i++)
    out[i] = HEX_BYTE_STRINGS[data[i]];
  return out.join("");
}
var NODE_CRYPTO = (() => {
  const processLike = typeof globalThis === "undefined" ? undefined : globalThis.process;
  const getBuiltinModule = processLike?.getBuiltinModule;
  if (typeof getBuiltinModule === "function") {
    try {
      const crypto = getBuiltinModule.call(processLike, "node:crypto");
      if (crypto != null)
        return crypto;
    } catch {}
  }
  return;
})();
function toHashBytes(msg, enc) {
  if (msg instanceof Uint8Array) {
    return msg;
  }
  if (Array.isArray(msg)) {
    return new Uint8Array(msg);
  }
  return Uint8Array.from(toArray(msg, enc));
}
function toHashKeyBytes(key) {
  return typeof key === "string" ? toHashBytes(key, "hex") : toHashBytes(key);
}
function updateNativeOrFallback(native, fallback, data) {
  if (native != null) {
    native.update(data);
  } else if (fallback != null) {
    fallback.update(data);
  }
}
function digestNativeOrFallback(native, fallback) {
  if (native != null)
    return Array.from(native.digest());
  if (fallback != null)
    return Array.from(fallback.digest());
  return [];
}
function digestHexNativeOrFallback(native, fallback) {
  if (native != null)
    return native.digest("hex");
  if (fallback != null)
    return bytesToHex(fallback.digest());
  return "";
}
function createNodeHash(algorithm) {
  const createHash = NODE_CRYPTO?.createHash;
  if (typeof createHash !== "function")
    return;
  try {
    return createHash(algorithm);
  } catch {
    return;
  }
}
function createNodeHmac(algorithm, keyBytes) {
  const createHmac = NODE_CRYPTO?.createHmac;
  if (typeof createHmac !== "function")
    return;
  try {
    return createHmac(algorithm, keyBytes);
  } catch {
    return;
  }
}
function digestWithNodeHash(algorithm, msg, enc) {
  const hash = createNodeHash(algorithm);
  if (hash == null)
    return;
  hash.update(toHashBytes(msg, enc));
  return hash.digest();
}
function digestWithNodeHmac(algorithm, key, msg, enc) {
  const hmac = createNodeHmac(algorithm, toHashKeyBytes(key));
  if (hmac == null)
    return;
  hmac.update(toHashBytes(msg, enc));
  return hmac.digest();
}
function join32(msg, start, end, endian) {
  const len = end - start;
  assert(len % 4 === 0);
  const res = Array.from({ length: len / 4 });
  for (let i = 0, k = start;i < res.length; i++, k += 4) {
    let w;
    if (endian === "big") {
      w = msg[k] << 24 | msg[k + 1] << 16 | msg[k + 2] << 8 | msg[k + 3];
    } else {
      w = msg[k + 3] << 24 | msg[k + 2] << 16 | msg[k + 1] << 8 | msg[k];
    }
    res[i] = w >>> 0;
  }
  return res;
}
function split32(msg, endian) {
  const res = Array.from({ length: msg.length * 4 });
  for (let i = 0, k = 0;i < msg.length; i++, k += 4) {
    const m = msg[i];
    if (endian === "big") {
      res[k] = m >>> 24;
      res[k + 1] = m >>> 16 & 255;
      res[k + 2] = m >>> 8 & 255;
      res[k + 3] = m & 255;
    } else {
      res[k + 3] = m >>> 24;
      res[k + 2] = m >>> 16 & 255;
      res[k + 1] = m >>> 8 & 255;
      res[k] = m & 255;
    }
  }
  return res;
}
function rotr32(w, b) {
  return w >>> b | w << 32 - b;
}
function rotl32(w, b) {
  return w << b | w >>> 32 - b;
}
function sum32(a, b) {
  return a + b >>> 0;
}
function SUM32_3(a, b, c) {
  return a + b + c >>> 0;
}
function SUM32_4(a, b, c, d) {
  return a + b + c + d >>> 0;
}
function SUM32_5(a, b, c, d, e) {
  return a + b + c + d + e >>> 0;
}
function ch32(x, y, z) {
  return x & y ^ ~x & z;
}
function maj32(x, y, z) {
  return x & y ^ x & z ^ y & z;
}
function S0_256(x) {
  return rotr32(x, 2) ^ rotr32(x, 13) ^ rotr32(x, 22);
}
function S1_256(x) {
  return rotr32(x, 6) ^ rotr32(x, 11) ^ rotr32(x, 25);
}
function G0_256(x) {
  return rotr32(x, 7) ^ rotr32(x, 18) ^ x >>> 3;
}
function G1_256(x) {
  return rotr32(x, 17) ^ rotr32(x, 19) ^ x >>> 10;
}
var r = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  7,
  4,
  13,
  1,
  10,
  6,
  15,
  3,
  12,
  0,
  9,
  5,
  2,
  14,
  11,
  8,
  3,
  10,
  14,
  4,
  9,
  15,
  8,
  1,
  2,
  7,
  0,
  6,
  13,
  11,
  5,
  12,
  1,
  9,
  11,
  10,
  0,
  8,
  12,
  4,
  13,
  3,
  7,
  15,
  14,
  5,
  6,
  2,
  4,
  0,
  5,
  9,
  7,
  12,
  2,
  10,
  14,
  1,
  3,
  8,
  11,
  6,
  15,
  13
];
var rh = [
  5,
  14,
  7,
  0,
  9,
  2,
  11,
  4,
  13,
  6,
  15,
  8,
  1,
  10,
  3,
  12,
  6,
  11,
  3,
  7,
  0,
  13,
  5,
  10,
  14,
  15,
  8,
  12,
  4,
  9,
  1,
  2,
  15,
  5,
  1,
  3,
  7,
  14,
  6,
  9,
  11,
  8,
  12,
  2,
  10,
  0,
  4,
  13,
  8,
  6,
  4,
  1,
  3,
  11,
  15,
  0,
  5,
  12,
  2,
  13,
  9,
  7,
  10,
  14,
  12,
  15,
  10,
  4,
  1,
  5,
  8,
  7,
  6,
  2,
  13,
  14,
  0,
  3,
  9,
  11
];
var s = [
  11,
  14,
  15,
  12,
  5,
  8,
  7,
  9,
  11,
  13,
  14,
  15,
  6,
  7,
  9,
  8,
  7,
  6,
  8,
  13,
  11,
  9,
  7,
  15,
  7,
  12,
  15,
  9,
  11,
  7,
  13,
  12,
  11,
  13,
  6,
  7,
  14,
  9,
  13,
  15,
  14,
  8,
  13,
  6,
  5,
  12,
  7,
  5,
  11,
  12,
  14,
  15,
  14,
  15,
  9,
  8,
  9,
  14,
  5,
  6,
  8,
  6,
  5,
  12,
  9,
  15,
  5,
  11,
  6,
  8,
  13,
  12,
  5,
  12,
  13,
  14,
  11,
  8,
  5,
  6
];
var sh = [
  8,
  9,
  9,
  11,
  13,
  15,
  15,
  5,
  7,
  7,
  8,
  11,
  14,
  14,
  12,
  6,
  9,
  13,
  15,
  7,
  12,
  8,
  9,
  11,
  7,
  7,
  12,
  7,
  6,
  15,
  13,
  11,
  9,
  7,
  15,
  11,
  8,
  6,
  6,
  14,
  12,
  13,
  5,
  14,
  13,
  13,
  7,
  5,
  15,
  5,
  8,
  11,
  14,
  14,
  6,
  14,
  6,
  9,
  12,
  9,
  12,
  5,
  15,
  8,
  8,
  5,
  12,
  9,
  12,
  5,
  14,
  6,
  8,
  13,
  6,
  5,
  15,
  13,
  11,
  11
];
function f(j, x, y, z) {
  if (j <= 15) {
    return x ^ y ^ z;
  } else if (j <= 31) {
    return x & y | ~x & z;
  } else if (j <= 47) {
    return (x | ~y) ^ z;
  } else if (j <= 63) {
    return x & z | y & ~z;
  } else {
    return x ^ (y | ~z);
  }
}
function K(j) {
  if (j <= 15) {
    return 0;
  } else if (j <= 31) {
    return 1518500249;
  } else if (j <= 47) {
    return 1859775393;
  } else if (j <= 63) {
    return 2400959708;
  } else {
    return 2840853838;
  }
}
function Kh(j) {
  if (j <= 15) {
    return 1352829926;
  } else if (j <= 31) {
    return 1548603684;
  } else if (j <= 47) {
    return 1836072691;
  } else if (j <= 63) {
    return 2053994217;
  } else {
    return 0;
  }
}

class RIPEMD160 extends BaseHash {
  h;
  constructor() {
    super(512, 160, 192, 64);
    this.endian = "little";
    this.h = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
    this.endian = "little";
  }
  _update(msg, start) {
    let A = this.h[0];
    let B = this.h[1];
    let C = this.h[2];
    let D = this.h[3];
    let E = this.h[4];
    let Ah = A;
    let Bh = B;
    let Ch = C;
    let Dh = D;
    let Eh = E;
    let T;
    for (let j = 0;j < 80; j++) {
      T = sum32(rotl32(SUM32_4(A, f(j, B, C, D), msg[r[j] + start], K(j)), s[j]), E);
      A = E;
      E = D;
      D = rotl32(C, 10);
      C = B;
      B = T;
      T = sum32(rotl32(SUM32_4(Ah, f(79 - j, Bh, Ch, Dh), msg[rh[j] + start], Kh(j)), sh[j]), Eh);
      Ah = Eh;
      Eh = Dh;
      Dh = rotl32(Ch, 10);
      Ch = Bh;
      Bh = T;
    }
    T = SUM32_3(this.h[1], C, Dh);
    this.h[1] = SUM32_3(this.h[2], D, Eh);
    this.h[2] = SUM32_3(this.h[3], E, Ah);
    this.h[3] = SUM32_3(this.h[4], A, Bh);
    this.h[4] = SUM32_3(this.h[0], B, Ch);
    this.h[0] = T;
  }
  _digest() {
    return split32(this.h, "little");
  }
  _digestHex() {
    return toHex32(this.h, "little");
  }
}
class SHA256HMAC {
  h;
  native;
  blockSize = 64;
  outSize = 32;
  constructor(key) {
    const k = toHashKeyBytes(key);
    this.native = createNodeHmac("sha256", k);
    if (this.native == null) {
      this.h = new HMAC(sha256Fast, k);
    }
  }
  update(msg, enc) {
    updateNativeOrFallback(this.native, this.h, toHashBytes(msg, enc));
    return this;
  }
  digest() {
    return digestNativeOrFallback(this.native, this.h);
  }
  digestHex() {
    return digestHexNativeOrFallback(this.native, this.h);
  }
}
function sha256Bytes(msg, enc) {
  const native = digestWithNodeHash("sha256", msg, enc);
  if (native != null)
    return native;
  return new FastSHA256().update(toHashBytes(msg, enc)).digest();
}
function ripemd160Bytes(msg, enc) {
  return digestWithNodeHash("ripemd160", msg, enc);
}
var sha256 = (msg, enc) => {
  return Array.from(sha256Bytes(msg, enc));
};
var hash256 = (msg, enc) => {
  return Array.from(sha256Bytes(sha256Bytes(msg, enc)));
};
var hash160 = (msg, enc) => {
  const first = sha256Bytes(msg, enc);
  const native = ripemd160Bytes(first);
  if (native != null)
    return Array.from(native);
  return new RIPEMD160().update(first).digest();
};
var sha256hmac = (key, msg, enc) => {
  const native = digestWithNodeHmac("sha256", key, msg, enc);
  if (native != null)
    return Array.from(native);
  return new SHA256HMAC(key).update(msg, enc).digest();
};
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber(n) {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error(`positive integer expected, got ${n}`);
  }
}
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length)) {
    const lens = lengths.join(",");
    throw new Error(`Uint8Array expected of length ${lens}, got length=${b.length}`);
  }
}
function ahash(h) {
  if (typeof h !== "function" || typeof h.create !== "function") {
    throw new TypeError("Hash should be wrapped by utils.createHasher");
  }
  anumber(h.outputLen);
  anumber(h.blockLen);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed === true)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished === true) {
    throw new Error("Hash#digest() has already been called");
  }
}
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error(`digestInto() expects output buffer of length at least ${min}`);
  }
}
function clean(...arrays) {
  for (const arr of arrays)
    arr.fill(0);
}
function createView(arr) {
  return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
}
function toBytes(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
class Hash {
}
function createHasher(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
var U32_MASK64 = BigInt(2 ** 32 - 1);
var _32n = BigInt(32);
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  const Ah = new Uint32Array(len);
  const Al = new Uint32Array(len);
  for (let i = 0;i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    Ah[i] = h;
    Al[i] = l;
  }
  return [Ah, Al];
}
var shrSH = (h, _l, s) => h >>> s;
var shrSL = (h, l, s) => h << 32 - s | l >>> s;
var rotrSH = (h, l, s) => h >>> s | l << 32 - s;
var rotrSL = (h, l, s) => h << 32 - s | l >>> s;
var rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
var rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
function add(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l / 2 ** 32 | 0) | 0, l: l | 0 };
}
var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
var add3H = (low, Ah, Bh, Ch) => Math.trunc(Ah + Bh + Ch + Math.trunc(low / 2 ** 32));
var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
var add4H = (low, Ah, Bh, Ch, Dh) => Math.trunc(Ah + Bh + Ch + Dh + Math.trunc(low / 2 ** 32));
var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;

class HashMD extends Hash {
  blockLen;
  outputLen;
  padOffset;
  isLE;
  buffer;
  view;
  finished = false;
  length = 0;
  pos = 0;
  destroyed = false;
  constructor(blockLen, outputLen, padOffset, isLE) {
    super();
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0;pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (;blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos;i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4 !== 0)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0;i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to ??= new this.constructor;
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen !== 0)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
}
function setBigUint64(view, byteOffset, value, isLE) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE ? 4 : 0;
  const l = isLE ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE);
  view.setUint32(byteOffset + l, wl, isLE);
}
var SHA256_IV = Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);
var K2562 = Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = new Uint32Array(64);

class FastSHA256 extends HashMD {
  A = SHA256_IV[0] | 0;
  B = SHA256_IV[1] | 0;
  C = SHA256_IV[2] | 0;
  D = SHA256_IV[3] | 0;
  E = SHA256_IV[4] | 0;
  F = SHA256_IV[5] | 0;
  G = SHA256_IV[6] | 0;
  H = SHA256_IV[7] | 0;
  constructor(outputLen = 32) {
    super(64, outputLen, 8, false);
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  set(...[A, B, C, D, E, F, G, H]) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0;i < 16; i++, offset += 4) {
      SHA256_W[i] = view.getUint32(offset);
    }
    for (let i = 16;i < 64; i++) {
      const w15 = SHA256_W[i - 15];
      const w2 = SHA256_W[i - 2];
      const s0 = G0_256(w15);
      const s1 = G1_256(w2);
      SHA256_W[i] = sum32(sum32(s0, SHA256_W[i - 7]), sum32(s1, SHA256_W[i - 16]));
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0;i < 64; i++) {
      const T1 = SUM32_5(H, S1_256(E), ch32(E, F, G), K2562[i], SHA256_W[i]);
      const T2 = sum32(S0_256(A), maj32(A, B, C));
      H = G;
      G = F;
      F = E;
      E = sum32(D, T1);
      D = C;
      C = B;
      B = A;
      A = sum32(T1, T2);
    }
    this.A = sum32(this.A, A);
    this.B = sum32(this.B, B);
    this.C = sum32(this.C, C);
    this.D = sum32(this.D, D);
    this.E = sum32(this.E, E);
    this.F = sum32(this.F, F);
    this.G = sum32(this.G, G);
    this.H = sum32(this.H, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    clean(this.buffer);
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
  }
}
var sha256Fast = createHasher(() => new FastSHA256);
var SHA512_IV = Uint32Array.from([
  1779033703,
  4089235720,
  3144134277,
  2227873595,
  1013904242,
  4271175723,
  2773480762,
  1595750129,
  1359893119,
  2917565137,
  2600822924,
  725511199,
  528734635,
  4215389547,
  1541459225,
  327033209
]);
var K512 = (() => split([
  "0x428a2f98d728ae22",
  "0x7137449123ef65cd",
  "0xb5c0fbcfec4d3b2f",
  "0xe9b5dba58189dbbc",
  "0x3956c25bf348b538",
  "0x59f111f1b605d019",
  "0x923f82a4af194f9b",
  "0xab1c5ed5da6d8118",
  "0xd807aa98a3030242",
  "0x12835b0145706fbe",
  "0x243185be4ee4b28c",
  "0x550c7dc3d5ffb4e2",
  "0x72be5d74f27b896f",
  "0x80deb1fe3b1696b1",
  "0x9bdc06a725c71235",
  "0xc19bf174cf692694",
  "0xe49b69c19ef14ad2",
  "0xefbe4786384f25e3",
  "0x0fc19dc68b8cd5b5",
  "0x240ca1cc77ac9c65",
  "0x2de92c6f592b0275",
  "0x4a7484aa6ea6e483",
  "0x5cb0a9dcbd41fbd4",
  "0x76f988da831153b5",
  "0x983e5152ee66dfab",
  "0xa831c66d2db43210",
  "0xb00327c898fb213f",
  "0xbf597fc7beef0ee4",
  "0xc6e00bf33da88fc2",
  "0xd5a79147930aa725",
  "0x06ca6351e003826f",
  "0x142929670a0e6e70",
  "0x27b70a8546d22ffc",
  "0x2e1b21385c26c926",
  "0x4d2c6dfc5ac42aed",
  "0x53380d139d95b3df",
  "0x650a73548baf63de",
  "0x766a0abb3c77b2a8",
  "0x81c2c92e47edaee6",
  "0x92722c851482353b",
  "0xa2bfe8a14cf10364",
  "0xa81a664bbc423001",
  "0xc24b8b70d0f89791",
  "0xc76c51a30654be30",
  "0xd192e819d6ef5218",
  "0xd69906245565a910",
  "0xf40e35855771202a",
  "0x106aa07032bbd1b8",
  "0x19a4c116b8d2d0c8",
  "0x1e376c085141ab53",
  "0x2748774cdf8eeb99",
  "0x34b0bcb5e19b48a8",
  "0x391c0cb3c5c95a63",
  "0x4ed8aa4ae3418acb",
  "0x5b9cca4f7763e373",
  "0x682e6ff3d6b2b8a3",
  "0x748f82ee5defb2fc",
  "0x78a5636f43172f60",
  "0x84c87814a1f0ab72",
  "0x8cc702081a6439ec",
  "0x90befffa23631e28",
  "0xa4506cebde82bde9",
  "0xbef9a3f7b2c67915",
  "0xc67178f2e372532b",
  "0xca273eceea26619c",
  "0xd186b8c721c0c207",
  "0xeada7dd6cde0eb1e",
  "0xf57d4f7fee6ed178",
  "0x06f067aa72176fba",
  "0x0a637dc5a2c898a6",
  "0x113f9804bef90dae",
  "0x1b710b35131c471b",
  "0x28db77f523047d84",
  "0x32caab7b40c72493",
  "0x3c9ebe0a15c9bebc",
  "0x431d67c49c100d4c",
  "0x4cc5d4becb3e42b6",
  "0x597f299cfc657e2a",
  "0x5fcb6fab3ad6faec",
  "0x6c44198c4a475817"
].map(BigInt)))();
var SHA512_Kh = (() => K512[0])();
var SHA512_Kl = (() => K512[1])();
var SHA512_W_H = new Uint32Array(80);
var SHA512_W_L = new Uint32Array(80);

class FastSHA512 extends HashMD {
  Ah = SHA512_IV[0] | 0;
  Al = SHA512_IV[1] | 0;
  Bh = SHA512_IV[2] | 0;
  Bl = SHA512_IV[3] | 0;
  Ch = SHA512_IV[4] | 0;
  Cl = SHA512_IV[5] | 0;
  Dh = SHA512_IV[6] | 0;
  Dl = SHA512_IV[7] | 0;
  Eh = SHA512_IV[8] | 0;
  El = SHA512_IV[9] | 0;
  Fh = SHA512_IV[10] | 0;
  Fl = SHA512_IV[11] | 0;
  Gh = SHA512_IV[12] | 0;
  Gl = SHA512_IV[13] | 0;
  Hh = SHA512_IV[14] | 0;
  Hl = SHA512_IV[15] | 0;
  constructor(outputLen = 64) {
    super(128, outputLen, 16, false);
  }
  get() {
    const { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
  }
  set(...[Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl]) {
    this.Ah = Ah | 0;
    this.Al = Al | 0;
    this.Bh = Bh | 0;
    this.Bl = Bl | 0;
    this.Ch = Ch | 0;
    this.Cl = Cl | 0;
    this.Dh = Dh | 0;
    this.Dl = Dl | 0;
    this.Eh = Eh | 0;
    this.El = El | 0;
    this.Fh = Fh | 0;
    this.Fl = Fl | 0;
    this.Gh = Gh | 0;
    this.Gl = Gl | 0;
    this.Hh = Hh | 0;
    this.Hl = Hl | 0;
  }
  process(view, offset) {
    for (let i = 0;i < 16; i++, offset += 8) {
      SHA512_W_H[i] = view.getUint32(offset);
      SHA512_W_L[i] = view.getUint32(offset + 4);
    }
    for (let i = 16;i < 80; i++) {
      const W15h = SHA512_W_H[i - 15] | 0;
      const W15l = SHA512_W_L[i - 15] | 0;
      const s0h = rotrSH(W15h, W15l, 1) ^ rotrSH(W15h, W15l, 8) ^ shrSH(W15h, W15l, 7);
      const s0l = rotrSL(W15h, W15l, 1) ^ rotrSL(W15h, W15l, 8) ^ shrSL(W15h, W15l, 7);
      const W2h = SHA512_W_H[i - 2] | 0;
      const W2l = SHA512_W_L[i - 2] | 0;
      const s1h = rotrSH(W2h, W2l, 19) ^ rotrBH(W2h, W2l, 61) ^ shrSH(W2h, W2l, 6);
      const s1l = rotrSL(W2h, W2l, 19) ^ rotrBL(W2h, W2l, 61) ^ shrSL(W2h, W2l, 6);
      const SUMl = add4L(s0l, s1l, SHA512_W_L[i - 7], SHA512_W_L[i - 16]);
      const SUMh = add4H(SUMl, s0h, s1h, SHA512_W_H[i - 7], SHA512_W_H[i - 16]);
      SHA512_W_H[i] = SUMh | 0;
      SHA512_W_L[i] = SUMl | 0;
    }
    let { Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl } = this;
    for (let i = 0;i < 80; i++) {
      const sigma1h = rotrSH(Eh, El, 14) ^ rotrSH(Eh, El, 18) ^ rotrBH(Eh, El, 41);
      const sigma1l = rotrSL(Eh, El, 14) ^ rotrSL(Eh, El, 18) ^ rotrBL(Eh, El, 41);
      const CHIh = Eh & Fh ^ ~Eh & Gh;
      const CHIl = El & Fl ^ ~El & Gl;
      const T1ll = add5L(Hl, sigma1l, CHIl, SHA512_Kl[i], SHA512_W_L[i]);
      const T1h = add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[i], SHA512_W_H[i]);
      const T1l = T1ll | 0;
      const sigma0h = rotrSH(Ah, Al, 28) ^ rotrBH(Ah, Al, 34) ^ rotrBH(Ah, Al, 39);
      const sigma0l = rotrSL(Ah, Al, 28) ^ rotrBL(Ah, Al, 34) ^ rotrBL(Ah, Al, 39);
      const MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
      const MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
      Hh = Gh | 0;
      Hl = Gl | 0;
      Gh = Fh | 0;
      Gl = Fl | 0;
      Fh = Eh | 0;
      Fl = El | 0;
      ({ h: Eh, l: El } = add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
      Dh = Ch | 0;
      Dl = Cl | 0;
      Ch = Bh | 0;
      Cl = Bl | 0;
      Bh = Ah | 0;
      Bl = Al | 0;
      const T2l = add3L(sigma0l, MAJl, T1l);
      Ah = add3H(T2l, sigma0h, MAJh, T1h);
      Al = T2l | 0;
    }
    ({ h: Ah, l: Al } = add(Ah, Al, this.Ah, this.Al));
    ({ h: Bh, l: Bl } = add(Bh, Bl, this.Bh, this.Bl));
    ({ h: Ch, l: Cl } = add(Ch, Cl, this.Ch, this.Cl));
    ({ h: Dh, l: Dl } = add(Dh, Dl, this.Dh, this.Dl));
    ({ h: Eh, l: El } = add(Eh, El, this.Eh, this.El));
    ({ h: Fh, l: Fl } = add(Fh, Fl, this.Fh, this.Fl));
    ({ h: Gh, l: Gl } = add(Gh, Gl, this.Gh, this.Gl));
    ({ h: Hh, l: Hl } = add(Hh, Hl, this.Hh, this.Hl));
    this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
  }
  roundClean() {
    clean(SHA512_W_H, SHA512_W_L);
  }
  destroy() {
    clean(this.buffer);
    this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  }
}
var sha512Fast = createHasher(() => new FastSHA512);

class HMAC extends Hash {
  oHash;
  iHash;
  blockLen;
  outputLen;
  finished = false;
  destroyed = false;
  constructor(hash, _key) {
    super();
    ahash(hash);
    const key = toBytes(_key);
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function") {
      throw new TypeError("Expected instance of class which extends utils.Hash");
    }
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0;i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0;i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean(pad);
  }
  update(buf) {
    aexists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists(this);
    abytes(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to ??= Object.create(Object.getPrototypeOf(this), {});
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash ?? undefined);
    to.iHash = iHash._cloneInto(to.iHash ?? undefined);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
}
var hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
hmac.create = (hash, key) => new HMAC(hash, key);
function swapBytes32(w) {
  const res = w >>> 24 | w >>> 8 & 65280 | w << 8 & 16711680 | (w & 255) << 24;
  return res >>> 0;
}
var isLittleEndian = (() => {
  const b = new ArrayBuffer(4);
  const a = new Uint32Array(b);
  const c = new Uint8Array(b);
  a[0] = 16909060;
  return c[0] === 4;
})();

// node_modules/@bsv/sdk/dist/esm/src/primitives/utils.js
var BufferCtor3 = globalThis.Buffer;
var CAN_USE_BUFFER3 = BufferCtor3 != null && typeof BufferCtor3.from === "function";
var HEX_DIGITS2 = "0123456789abcdef";
var HEX_BYTE_STRINGS2 = Array.from({ length: 256 }, () => "");
for (let i = 0;i < 256; i++) {
  HEX_BYTE_STRINGS2[i] = HEX_DIGITS2[i >> 4 & 15] + HEX_DIGITS2[i & 15];
}
var toHex = (msg) => {
  if (CAN_USE_BUFFER3) {
    return BufferCtor3.from(msg).toString("hex");
  }
  if (msg.length === 0)
    return "";
  return Array.from(msg, (byte) => HEX_BYTE_STRINGS2[byte & 255]).join("");
};
var toArray2 = (msg, enc) => {
  if (Array.isArray(msg))
    return msg.slice();
  if (msg === undefined)
    return [];
  if (typeof msg !== "string") {
    return Array.from(msg, (item) => Math.trunc(item));
  }
  switch (enc) {
    case "hex":
      return hexToArray(msg);
    case "base64":
      return base64ToArray(msg);
    default:
      return utf8ToArray(msg);
  }
};
var HEX_CHAR_TO_VALUE2 = new Int8Array(256).fill(-1);
for (let i = 0;i < 10; i++) {
  HEX_CHAR_TO_VALUE2[48 + i] = i;
}
for (let i = 0;i < 6; i++) {
  HEX_CHAR_TO_VALUE2[65 + i] = 10 + i;
  HEX_CHAR_TO_VALUE2[97 + i] = 10 + i;
}
var hexToArray = (msg) => {
  return Array.from(hexToUint8Array(msg));
};
var hexToUint8Array = (msg) => {
  assertValidHex(msg);
  const normalized = msg.length % 2 === 0 ? msg : "0" + msg;
  if (CAN_USE_BUFFER3) {
    const decoded = BufferCtor3.from(normalized, "hex");
    return new Uint8Array(decoded.buffer, decoded.byteOffset, decoded.byteLength);
  }
  const out = new Uint8Array(normalized.length / 2);
  let o = 0;
  for (let i = 0;i < normalized.length; i += 2) {
    const hi = HEX_CHAR_TO_VALUE2[normalized.codePointAt(i)];
    const lo = HEX_CHAR_TO_VALUE2[normalized.codePointAt(i + 1)];
    out[o++] = hi << 4 | lo;
  }
  return out;
};
var normalizeBase64 = (msg) => {
  if (typeof msg !== "string")
    throw new TypeError("msg must be a string");
  const normalized = msg.trim().replaceAll(/[\r\n\t\f\v ]+/g, "").replaceAll("-", "+").replaceAll("_", "/");
  const padIndex = normalized.indexOf("=");
  if (padIndex === -1)
    return normalized;
  const pad = normalized.slice(padIndex);
  if (!/^={1,2}$/.test(pad) || normalized.slice(0, padIndex).includes("=")) {
    throw new Error("Invalid base64 padding");
  }
  return normalized.slice(0, padIndex);
};
var base64CharacterValue = (codePoint, index) => {
  if (codePoint >= 65 && codePoint <= 90)
    return codePoint - 65;
  if (codePoint >= 97 && codePoint <= 122)
    return codePoint - 97 + 26;
  if (codePoint >= 48 && codePoint <= 57)
    return codePoint - 48 + 52;
  if (codePoint === 43)
    return 62;
  if (codePoint === 47)
    return 63;
  throw new Error(`Invalid base64 character at index ${index}`);
};
function base64ToArray(msg) {
  const s = normalizeBase64(msg);
  const result = [];
  let bitBuffer = 0;
  let bitCount = 0;
  for (let i = 0;i < s.length; i++) {
    const c = s.codePointAt(i);
    const v = base64CharacterValue(c, i);
    bitBuffer = bitBuffer << 6 | v;
    bitCount += 6;
    while (bitCount >= 8) {
      bitCount -= 8;
      result.push(bitBuffer >> bitCount & 255);
      bitBuffer &= (1 << bitCount) - 1;
    }
  }
  return result;
}
function utf8ToArray(str) {
  return Array.from(new TextEncoder().encode(str));
}
function toBase64(byteArray) {
  const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i;
  for (i = 0;i < byteArray.length; i += 3) {
    const byte1 = byteArray[i];
    const byte2 = i + 1 < byteArray.length ? byteArray[i + 1] : 0;
    const byte3 = i + 2 < byteArray.length ? byteArray[i + 2] : 0;
    const encoded1 = byte1 >> 2;
    const encoded2 = (byte1 & 3) << 4 | byte2 >> 4;
    const encoded3 = (byte2 & 15) << 2 | byte3 >> 6;
    const encoded4 = byte3 & 63;
    result += base64Chars.charAt(encoded1) + base64Chars.charAt(encoded2);
    result += i + 1 < byteArray.length ? base64Chars.charAt(encoded3) : "=";
    result += i + 2 < byteArray.length ? base64Chars.charAt(encoded4) : "=";
  }
  return result;
}
var base58chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
var toBase58 = (bin) => {
  const base58Map = Array.from({ length: 256 }, () => -1);
  for (let i = 0;i < base58chars.length; ++i) {
    base58Map[base58chars.codePointAt(i)] = i;
  }
  const result = [];
  for (const byte of bin) {
    let carry = byte;
    for (let j = 0;j < result.length; ++j) {
      const x = (base58Map[result[j]] << 8) + carry;
      const quotient = Math.trunc(x / 58);
      const remainder = x - quotient * 58;
      result[j] = base58chars.codePointAt(remainder);
      carry = quotient;
    }
    while (carry !== 0) {
      const quotient = Math.trunc(carry / 58);
      const remainder = carry - quotient * 58;
      result.push(base58chars.codePointAt(remainder));
      carry = quotient;
    }
  }
  for (const byte of bin) {
    if (byte === 0)
      result.push("1".codePointAt(0));
    else
      break;
  }
  result.reverse();
  return String.fromCodePoint(...result);
};
var toBase58Check = (bin, prefix = [0]) => {
  let hash = hash256([...prefix, ...bin]);
  hash = [...prefix, ...bin, ...hash.slice(0, 4)];
  return toBase58(hash);
};
var OverflowInt64 = new BigNumber(2).pow(new BigNumber(63));
var OverflowUint64 = new BigNumber(2).pow(new BigNumber(64));

// node_modules/@bsv/sdk/dist/esm/src/primitives/Curve.js
var globalCurve;
function normalizedMod4(value, carry) {
  const mod4 = value.andln(3) + carry & 3;
  return mod4 === 3 ? -1 : mod4;
}
function jsfDigit(value, carry, mod4, otherMod4) {
  if ((mod4 & 1) === 0)
    return 0;
  const mod8 = value.andln(7) + carry & 7;
  return (mod8 === 3 || mod8 === 5) && otherMod4 === 2 ? -mod4 : mod4;
}
function nextJsfCarry(carry, digit) {
  return 2 * carry === digit + 1 ? 1 - carry : carry;
}

class Curve {
  p;
  red;
  redN;
  zero;
  one;
  two;
  g;
  n;
  a;
  b;
  tinv;
  zeroA;
  threeA;
  endo;
  _endoWnafT1;
  _endoWnafT2;
  _wnafT1;
  _wnafT2;
  _wnafT3;
  _wnafT4;
  _bitLength;
  static assert(expression, message = "Elliptic curve assertion failed") {
    if (!expression) {
      throw new Error(message);
    }
  }
  getNAF(num, w, bits) {
    const naf = Array.from({ length: Math.max(num.bitLength(), bits) + 1 }, () => 0);
    naf.fill(0);
    const ws = 1 << w + 1;
    const k = num.clone();
    for (let i = 0;i < naf.length; i++) {
      let z;
      const mod = k.andln(ws - 1);
      if (k.isOdd()) {
        if (mod > (ws >> 1) - 1) {
          z = (ws >> 1) - mod;
        } else {
          z = mod;
        }
        k.isubn(z);
      } else {
        z = 0;
      }
      naf[i] = z;
      k.iushrn(1);
    }
    return naf;
  }
  getJSF(k1, k2) {
    const jsf = [[], []];
    k1 = k1.clone();
    k2 = k2.clone();
    let d1 = 0;
    let d2 = 0;
    while (k1.cmpn(-d1) > 0 || k2.cmpn(-d2) > 0) {
      const m14 = normalizedMod4(k1, d1);
      const m24 = normalizedMod4(k2, d2);
      const u1 = jsfDigit(k1, d1, m14, m24);
      jsf[0].push(u1);
      const u2 = jsfDigit(k2, d2, m24, m14);
      jsf[1].push(u2);
      d1 = nextJsfCarry(d1, u1);
      d2 = nextJsfCarry(d2, u2);
      k1.iushrn(1);
      k2.iushrn(1);
    }
    return jsf;
  }
  static cachedProperty(obj, name, computer) {
    const key = "_" + name;
    obj.prototype[name] = function cachedProperty() {
      if (this[key] === undefined) {
        this[key] = computer.call(this);
      }
      return this[key];
    };
  }
  static parseBytes(bytes) {
    return typeof bytes === "string" ? toArray2(bytes, "hex") : bytes;
  }
  static intFromLE(bytes) {
    return new BigNumber(bytes, "hex", "le");
  }
  constructor() {
    if (globalCurve === undefined) {
      globalCurve = this;
    } else {
      return globalCurve;
    }
    const precomputed = {
      doubles: {
        step: 4,
        points: [
          [
            "e60fce93b59e9ec53011aabc21c23e97b2a31369b87a5ae9c44ee89e2a6dec0a",
            "f7e3507399e595929db99f34f57937101296891e44d23f0be1f32cce69616821"
          ],
          [
            "8282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508",
            "11f8a8098557dfe45e8256e830b60ace62d613ac2f7b17bed31b6eaff6e26caf"
          ],
          [
            "175e159f728b865a72f99cc6c6fc846de0b93833fd2222ed73fce5b551e5b739",
            "d3506e0d9e3c79eba4ef97a51ff71f5eacb5955add24345c6efa6ffee9fed695"
          ],
          [
            "363d90d447b00c9c99ceac05b6262ee053441c7e55552ffe526bad8f83ff4640",
            "4e273adfc732221953b445397f3363145b9a89008199ecb62003c7f3bee9de9"
          ],
          [
            "8b4b5f165df3c2be8c6244b5b745638843e4a781a15bcd1b69f79a55dffdf80c",
            "4aad0a6f68d308b4b3fbd7813ab0da04f9e336546162ee56b3eff0c65fd4fd36"
          ],
          [
            "723cbaa6e5db996d6bf771c00bd548c7b700dbffa6c0e77bcb6115925232fcda",
            "96e867b5595cc498a921137488824d6e2660a0653779494801dc069d9eb39f5f"
          ],
          [
            "eebfa4d493bebf98ba5feec812c2d3b50947961237a919839a533eca0e7dd7fa",
            "5d9a8ca3970ef0f269ee7edaf178089d9ae4cdc3a711f712ddfd4fdae1de8999"
          ],
          [
            "100f44da696e71672791d0a09b7bde459f1215a29b3c03bfefd7835b39a48db0",
            "cdd9e13192a00b772ec8f3300c090666b7ff4a18ff5195ac0fbd5cd62bc65a09"
          ],
          [
            "e1031be262c7ed1b1dc9227a4a04c017a77f8d4464f3b3852c8acde6e534fd2d",
            "9d7061928940405e6bb6a4176597535af292dd419e1ced79a44f18f29456a00d"
          ],
          [
            "feea6cae46d55b530ac2839f143bd7ec5cf8b266a41d6af52d5e688d9094696d",
            "e57c6b6c97dce1bab06e4e12bf3ecd5c981c8957cc41442d3155debf18090088"
          ],
          [
            "da67a91d91049cdcb367be4be6ffca3cfeed657d808583de33fa978bc1ec6cb1",
            "9bacaa35481642bc41f463f7ec9780e5dec7adc508f740a17e9ea8e27a68be1d"
          ],
          [
            "53904faa0b334cdda6e000935ef22151ec08d0f7bb11069f57545ccc1a37b7c0",
            "5bc087d0bc80106d88c9eccac20d3c1c13999981e14434699dcb096b022771c8"
          ],
          [
            "8e7bcd0bd35983a7719cca7764ca906779b53a043a9b8bcaeff959f43ad86047",
            "10b7770b2a3da4b3940310420ca9514579e88e2e47fd68b3ea10047e8460372a"
          ],
          [
            "385eed34c1cdff21e6d0818689b81bde71a7f4f18397e6690a841e1599c43862",
            "283bebc3e8ea23f56701de19e9ebf4576b304eec2086dc8cc0458fe5542e5453"
          ],
          [
            "6f9d9b803ecf191637c73a4413dfa180fddf84a5947fbc9c606ed86c3fac3a7",
            "7c80c68e603059ba69b8e2a30e45c4d47ea4dd2f5c281002d86890603a842160"
          ],
          [
            "3322d401243c4e2582a2147c104d6ecbf774d163db0f5e5313b7e0e742d0e6bd",
            "56e70797e9664ef5bfb019bc4ddaf9b72805f63ea2873af624f3a2e96c28b2a0"
          ],
          [
            "85672c7d2de0b7da2bd1770d89665868741b3f9af7643397721d74d28134ab83",
            "7c481b9b5b43b2eb6374049bfa62c2e5e77f17fcc5298f44c8e3094f790313a6"
          ],
          [
            "948bf809b1988a46b06c9f1919413b10f9226c60f668832ffd959af60c82a0a",
            "53a562856dcb6646dc6b74c5d1c3418c6d4dff08c97cd2bed4cb7f88d8c8e589"
          ],
          [
            "6260ce7f461801c34f067ce0f02873a8f1b0e44dfc69752accecd819f38fd8e8",
            "bc2da82b6fa5b571a7f09049776a1ef7ecd292238051c198c1a84e95b2b4ae17"
          ],
          [
            "e5037de0afc1d8d43d8348414bbf4103043ec8f575bfdc432953cc8d2037fa2d",
            "4571534baa94d3b5f9f98d09fb990bddbd5f5b03ec481f10e0e5dc841d755bda"
          ],
          [
            "e06372b0f4a207adf5ea905e8f1771b4e7e8dbd1c6a6c5b725866a0ae4fce725",
            "7a908974bce18cfe12a27bb2ad5a488cd7484a7787104870b27034f94eee31dd"
          ],
          [
            "213c7a715cd5d45358d0bbf9dc0ce02204b10bdde2a3f58540ad6908d0559754",
            "4b6dad0b5ae462507013ad06245ba190bb4850f5f36a7eeddff2c27534b458f2"
          ],
          [
            "4e7c272a7af4b34e8dbb9352a5419a87e2838c70adc62cddf0cc3a3b08fbd53c",
            "17749c766c9d0b18e16fd09f6def681b530b9614bff7dd33e0b3941817dcaae6"
          ],
          [
            "fea74e3dbe778b1b10f238ad61686aa5c76e3db2be43057632427e2840fb27b6",
            "6e0568db9b0b13297cf674deccb6af93126b596b973f7b77701d3db7f23cb96f"
          ],
          [
            "76e64113f677cf0e10a2570d599968d31544e179b760432952c02a4417bdde39",
            "c90ddf8dee4e95cf577066d70681f0d35e2a33d2b56d2032b4b1752d1901ac01"
          ],
          [
            "c738c56b03b2abe1e8281baa743f8f9a8f7cc643df26cbee3ab150242bcbb891",
            "893fb578951ad2537f718f2eacbfbbbb82314eef7880cfe917e735d9699a84c3"
          ],
          [
            "d895626548b65b81e264c7637c972877d1d72e5f3a925014372e9f6588f6c14b",
            "febfaa38f2bc7eae728ec60818c340eb03428d632bb067e179363ed75d7d991f"
          ],
          [
            "b8da94032a957518eb0f6433571e8761ceffc73693e84edd49150a564f676e03",
            "2804dfa44805a1e4d7c99cc9762808b092cc584d95ff3b511488e4e74efdf6e7"
          ],
          [
            "e80fea14441fb33a7d8adab9475d7fab2019effb5156a792f1a11778e3c0df5d",
            "eed1de7f638e00771e89768ca3ca94472d155e80af322ea9fcb4291b6ac9ec78"
          ],
          [
            "a301697bdfcd704313ba48e51d567543f2a182031efd6915ddc07bbcc4e16070",
            "7370f91cfb67e4f5081809fa25d40f9b1735dbf7c0a11a130c0d1a041e177ea1"
          ],
          [
            "90ad85b389d6b936463f9d0512678de208cc330b11307fffab7ac63e3fb04ed4",
            "e507a3620a38261affdcbd9427222b839aefabe1582894d991d4d48cb6ef150"
          ],
          [
            "8f68b9d2f63b5f339239c1ad981f162ee88c5678723ea3351b7b444c9ec4c0da",
            "662a9f2dba063986de1d90c2b6be215dbbea2cfe95510bfdf23cbf79501fff82"
          ],
          [
            "e4f3fb0176af85d65ff99ff9198c36091f48e86503681e3e6686fd5053231e11",
            "1e63633ad0ef4f1c1661a6d0ea02b7286cc7e74ec951d1c9822c38576feb73bc"
          ],
          [
            "8c00fa9b18ebf331eb961537a45a4266c7034f2f0d4e1d0716fb6eae20eae29e",
            "efa47267fea521a1a9dc343a3736c974c2fadafa81e36c54e7d2a4c66702414b"
          ],
          [
            "e7a26ce69dd4829f3e10cec0a9e98ed3143d084f308b92c0997fddfc60cb3e41",
            "2a758e300fa7984b471b006a1aafbb18d0a6b2c0420e83e20e8a9421cf2cfd51"
          ],
          [
            "b6459e0ee3662ec8d23540c223bcbdc571cbcb967d79424f3cf29eb3de6b80ef",
            "67c876d06f3e06de1dadf16e5661db3c4b3ae6d48e35b2ff30bf0b61a71ba45"
          ],
          [
            "d68a80c8280bb840793234aa118f06231d6f1fc67e73c5a5deda0f5b496943e8",
            "db8ba9fff4b586d00c4b1f9177b0e28b5b0e7b8f7845295a294c84266b133120"
          ],
          [
            "324aed7df65c804252dc0270907a30b09612aeb973449cea4095980fc28d3d5d",
            "648a365774b61f2ff130c0c35aec1f4f19213b0c7e332843967224af96ab7c84"
          ],
          [
            "4df9c14919cde61f6d51dfdbe5fee5dceec4143ba8d1ca888e8bd373fd054c96",
            "35ec51092d8728050974c23a1d85d4b5d506cdc288490192ebac06cad10d5d"
          ],
          [
            "9c3919a84a474870faed8a9c1cc66021523489054d7f0308cbfc99c8ac1f98cd",
            "ddb84f0f4a4ddd57584f044bf260e641905326f76c64c8e6be7e5e03d4fc599d"
          ],
          [
            "6057170b1dd12fdf8de05f281d8e06bb91e1493a8b91d4cc5a21382120a959e5",
            "9a1af0b26a6a4807add9a2daf71df262465152bc3ee24c65e899be932385a2a8"
          ],
          [
            "a576df8e23a08411421439a4518da31880cef0fba7d4df12b1a6973eecb94266",
            "40a6bf20e76640b2c92b97afe58cd82c432e10a7f514d9f3ee8be11ae1b28ec8"
          ],
          [
            "7778a78c28dec3e30a05fe9629de8c38bb30d1f5cf9a3a208f763889be58ad71",
            "34626d9ab5a5b22ff7098e12f2ff580087b38411ff24ac563b513fc1fd9f43ac"
          ],
          [
            "928955ee637a84463729fd30e7afd2ed5f96274e5ad7e5cb09eda9c06d903ac",
            "c25621003d3f42a827b78a13093a95eeac3d26efa8a8d83fc5180e935bcd091f"
          ],
          [
            "85d0fef3ec6db109399064f3a0e3b2855645b4a907ad354527aae75163d82751",
            "1f03648413a38c0be29d496e582cf5663e8751e96877331582c237a24eb1f962"
          ],
          [
            "ff2b0dce97eece97c1c9b6041798b85dfdfb6d8882da20308f5404824526087e",
            "493d13fef524ba188af4c4dc54d07936c7b7ed6fb90e2ceb2c951e01f0c29907"
          ],
          [
            "827fbbe4b1e880ea9ed2b2e6301b212b57f1ee148cd6dd28780e5e2cf856e241",
            "c60f9c923c727b0b71bef2c67d1d12687ff7a63186903166d605b68baec293ec"
          ],
          [
            "eaa649f21f51bdbae7be4ae34ce6e5217a58fdce7f47f9aa7f3b58fa2120e2b3",
            "be3279ed5bbbb03ac69a80f89879aa5a01a6b965f13f7e59d47a5305ba5ad93d"
          ],
          [
            "e4a42d43c5cf169d9391df6decf42ee541b6d8f0c9a137401e23632dda34d24f",
            "4d9f92e716d1c73526fc99ccfb8ad34ce886eedfa8d8e4f13a7f7131deba9414"
          ],
          [
            "1ec80fef360cbdd954160fadab352b6b92b53576a88fea4947173b9d4300bf19",
            "aeefe93756b5340d2f3a4958a7abbf5e0146e77f6295a07b671cdc1cc107cefd"
          ],
          [
            "146a778c04670c2f91b00af4680dfa8bce3490717d58ba889ddb5928366642be",
            "b318e0ec3354028add669827f9d4b2870aaa971d2f7e5ed1d0b297483d83efd0"
          ],
          [
            "fa50c0f61d22e5f07e3acebb1aa07b128d0012209a28b9776d76a8793180eef9",
            "6b84c6922397eba9b72cd2872281a68a5e683293a57a213b38cd8d7d3f4f2811"
          ],
          [
            "da1d61d0ca721a11b1a5bf6b7d88e8421a288ab5d5bba5220e53d32b5f067ec2",
            "8157f55a7c99306c79c0766161c91e2966a73899d279b48a655fba0f1ad836f1"
          ],
          [
            "a8e282ff0c9706907215ff98e8fd416615311de0446f1e062a73b0610d064e13",
            "7f97355b8db81c09abfb7f3c5b2515888b679a3e50dd6bd6cef7c73111f4cc0c"
          ],
          [
            "174a53b9c9a285872d39e56e6913cab15d59b1fa512508c022f382de8319497c",
            "ccc9dc37abfc9c1657b4155f2c47f9e6646b3a1d8cb9854383da13ac079afa73"
          ],
          [
            "959396981943785c3d3e57edf5018cdbe039e730e4918b3d884fdff09475b7ba",
            "2e7e552888c331dd8ba0386a4b9cd6849c653f64c8709385e9b8abf87524f2fd"
          ],
          [
            "d2a63a50ae401e56d645a1153b109a8fcca0a43d561fba2dbb51340c9d82b151",
            "e82d86fb6443fcb7565aee58b2948220a70f750af484ca52d4142174dcf89405"
          ],
          [
            "64587e2335471eb890ee7896d7cfdc866bacbdbd3839317b3436f9b45617e073",
            "d99fcdd5bf6902e2ae96dd6447c299a185b90a39133aeab358299e5e9faf6589"
          ],
          [
            "8481bde0e4e4d885b3a546d3e549de042f0aa6cea250e7fd358d6c86dd45e458",
            "38ee7b8cba5404dd84a25bf39cecb2ca900a79c42b262e556d64b1b59779057e"
          ],
          [
            "13464a57a78102aa62b6979ae817f4637ffcfed3c4b1ce30bcd6303f6caf666b",
            "69be159004614580ef7e433453ccb0ca48f300a81d0942e13f495a907f6ecc27"
          ],
          [
            "bc4a9df5b713fe2e9aef430bcc1dc97a0cd9ccede2f28588cada3a0d2d83f366",
            "d3a81ca6e785c06383937adf4b798caa6e8a9fbfa547b16d758d666581f33c1"
          ],
          [
            "8c28a97bf8298bc0d23d8c749452a32e694b65e30a9472a3954ab30fe5324caa",
            "40a30463a3305193378fedf31f7cc0eb7ae784f0451cb9459e71dc73cbef9482"
          ],
          [
            "8ea9666139527a8c1dd94ce4f071fd23c8b350c5a4bb33748c4ba111faccae0",
            "620efabbc8ee2782e24e7c0cfb95c5d735b783be9cf0f8e955af34a30e62b945"
          ],
          [
            "dd3625faef5ba06074669716bbd3788d89bdde815959968092f76cc4eb9a9787",
            "7a188fa3520e30d461da2501045731ca941461982883395937f68d00c644a573"
          ],
          [
            "f710d79d9eb962297e4f6232b40e8f7feb2bc63814614d692c12de752408221e",
            "ea98e67232d3b3295d3b535532115ccac8612c721851617526ae47a9c77bfc82"
          ]
        ]
      },
      naf: {
        wnd: 7,
        points: [
          [
            "f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9",
            "388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672"
          ],
          [
            "2f8bde4d1a07209355b4a7250a5c5128e88b84bddc619ab7cba8d569b240efe4",
            "d8ac222636e5e3d6d4dba9dda6c9c426f788271bab0d6840dca87d3aa6ac62d6"
          ],
          [
            "5cbdf0646e5db4eaa398f365f2ea7a0e3d419b7e0330e39ce92bddedcac4f9bc",
            "6aebca40ba255960a3178d6d861a54dba813d0b813fde7b5a5082628087264da"
          ],
          [
            "acd484e2f0c7f65309ad178a9f559abde09796974c57e714c35f110dfc27ccbe",
            "cc338921b0a7d9fd64380971763b61e9add888a4375f8e0f05cc262ac64f9c37"
          ],
          [
            "774ae7f858a9411e5ef4246b70c65aac5649980be5c17891bbec17895da008cb",
            "d984a032eb6b5e190243dd56d7b7b365372db1e2dff9d6a8301d74c9c953c61b"
          ],
          [
            "f28773c2d975288bc7d1d205c3748651b075fbc6610e58cddeeddf8f19405aa8",
            "ab0902e8d880a89758212eb65cdaf473a1a06da521fa91f29b5cb52db03ed81"
          ],
          [
            "d7924d4f7d43ea965a465ae3095ff41131e5946f3c85f79e44adbcf8e27e080e",
            "581e2872a86c72a683842ec228cc6defea40af2bd896d3a5c504dc9ff6a26b58"
          ],
          [
            "defdea4cdb677750a420fee807eacf21eb9898ae79b9768766e4faa04a2d4a34",
            "4211ab0694635168e997b0ead2a93daeced1f4a04a95c0f6cfb199f69e56eb77"
          ],
          [
            "2b4ea0a797a443d293ef5cff444f4979f06acfebd7e86d277475656138385b6c",
            "85e89bc037945d93b343083b5a1c86131a01f60c50269763b570c854e5c09b7a"
          ],
          [
            "352bbf4a4cdd12564f93fa332ce333301d9ad40271f8107181340aef25be59d5",
            "321eb4075348f534d59c18259dda3e1f4a1b3b2e71b1039c67bd3d8bcf81998c"
          ],
          [
            "2fa2104d6b38d11b0230010559879124e42ab8dfeff5ff29dc9cdadd4ecacc3f",
            "2de1068295dd865b64569335bd5dd80181d70ecfc882648423ba76b532b7d67"
          ],
          [
            "9248279b09b4d68dab21a9b066edda83263c3d84e09572e269ca0cd7f5453714",
            "73016f7bf234aade5d1aa71bdea2b1ff3fc0de2a887912ffe54a32ce97cb3402"
          ],
          [
            "daed4f2be3a8bf278e70132fb0beb7522f570e144bf615c07e996d443dee8729",
            "a69dce4a7d6c98e8d4a1aca87ef8d7003f83c230f3afa726ab40e52290be1c55"
          ],
          [
            "c44d12c7065d812e8acf28d7cbb19f9011ecd9e9fdf281b0e6a3b5e87d22e7db",
            "2119a460ce326cdc76c45926c982fdac0e106e861edf61c5a039063f0e0e6482"
          ],
          [
            "6a245bf6dc698504c89a20cfded60853152b695336c28063b61c65cbd269e6b4",
            "e022cf42c2bd4a708b3f5126f16a24ad8b33ba48d0423b6efd5e6348100d8a82"
          ],
          [
            "1697ffa6fd9de627c077e3d2fe541084ce13300b0bec1146f95ae57f0d0bd6a5",
            "b9c398f186806f5d27561506e4557433a2cf15009e498ae7adee9d63d01b2396"
          ],
          [
            "605bdb019981718b986d0f07e834cb0d9deb8360ffb7f61df982345ef27a7479",
            "2972d2de4f8d20681a78d93ec96fe23c26bfae84fb14db43b01e1e9056b8c49"
          ],
          [
            "62d14dab4150bf497402fdc45a215e10dcb01c354959b10cfe31c7e9d87ff33d",
            "80fc06bd8cc5b01098088a1950eed0db01aa132967ab472235f5642483b25eaf"
          ],
          [
            "80c60ad0040f27dade5b4b06c408e56b2c50e9f56b9b8b425e555c2f86308b6f",
            "1c38303f1cc5c30f26e66bad7fe72f70a65eed4cbe7024eb1aa01f56430bd57a"
          ],
          [
            "7a9375ad6167ad54aa74c6348cc54d344cc5dc9487d847049d5eabb0fa03c8fb",
            "d0e3fa9eca8726909559e0d79269046bdc59ea10c70ce2b02d499ec224dc7f7"
          ],
          [
            "d528ecd9b696b54c907a9ed045447a79bb408ec39b68df504bb51f459bc3ffc9",
            "eecf41253136e5f99966f21881fd656ebc4345405c520dbc063465b521409933"
          ],
          [
            "49370a4b5f43412ea25f514e8ecdad05266115e4a7ecb1387231808f8b45963",
            "758f3f41afd6ed428b3081b0512fd62a54c3f3afbb5b6764b653052a12949c9a"
          ],
          [
            "77f230936ee88cbbd73df930d64702ef881d811e0e1498e2f1c13eb1fc345d74",
            "958ef42a7886b6400a08266e9ba1b37896c95330d97077cbbe8eb3c7671c60d6"
          ],
          [
            "f2dac991cc4ce4b9ea44887e5c7c0bce58c80074ab9d4dbaeb28531b7739f530",
            "e0dedc9b3b2f8dad4da1f32dec2531df9eb5fbeb0598e4fd1a117dba703a3c37"
          ],
          [
            "463b3d9f662621fb1b4be8fbbe2520125a216cdfc9dae3debcba4850c690d45b",
            "5ed430d78c296c3543114306dd8622d7c622e27c970a1de31cb377b01af7307e"
          ],
          [
            "f16f804244e46e2a09232d4aff3b59976b98fac14328a2d1a32496b49998f247",
            "cedabd9b82203f7e13d206fcdf4e33d92a6c53c26e5cce26d6579962c4e31df6"
          ],
          [
            "caf754272dc84563b0352b7a14311af55d245315ace27c65369e15f7151d41d1",
            "cb474660ef35f5f2a41b643fa5e460575f4fa9b7962232a5c32f908318a04476"
          ],
          [
            "2600ca4b282cb986f85d0f1709979d8b44a09c07cb86d7c124497bc86f082120",
            "4119b88753c15bd6a693b03fcddbb45d5ac6be74ab5f0ef44b0be9475a7e4b40"
          ],
          [
            "7635ca72d7e8432c338ec53cd12220bc01c48685e24f7dc8c602a7746998e435",
            "91b649609489d613d1d5e590f78e6d74ecfc061d57048bad9e76f302c5b9c61"
          ],
          [
            "754e3239f325570cdbbf4a87deee8a66b7f2b33479d468fbc1a50743bf56cc18",
            "673fb86e5bda30fb3cd0ed304ea49a023ee33d0197a695d0c5d98093c536683"
          ],
          [
            "e3e6bd1071a1e96aff57859c82d570f0330800661d1c952f9fe2694691d9b9e8",
            "59c9e0bba394e76f40c0aa58379a3cb6a5a2283993e90c4167002af4920e37f5"
          ],
          [
            "186b483d056a033826ae73d88f732985c4ccb1f32ba35f4b4cc47fdcf04aa6eb",
            "3b952d32c67cf77e2e17446e204180ab21fb8090895138b4a4a797f86e80888b"
          ],
          [
            "df9d70a6b9876ce544c98561f4be4f725442e6d2b737d9c91a8321724ce0963f",
            "55eb2dafd84d6ccd5f862b785dc39d4ab157222720ef9da217b8c45cf2ba2417"
          ],
          [
            "5edd5cc23c51e87a497ca815d5dce0f8ab52554f849ed8995de64c5f34ce7143",
            "efae9c8dbc14130661e8cec030c89ad0c13c66c0d17a2905cdc706ab7399a868"
          ],
          [
            "290798c2b6476830da12fe02287e9e777aa3fba1c355b17a722d362f84614fba",
            "e38da76dcd440621988d00bcf79af25d5b29c094db2a23146d003afd41943e7a"
          ],
          [
            "af3c423a95d9f5b3054754efa150ac39cd29552fe360257362dfdecef4053b45",
            "f98a3fd831eb2b749a93b0e6f35cfb40c8cd5aa667a15581bc2feded498fd9c6"
          ],
          [
            "766dbb24d134e745cccaa28c99bf274906bb66b26dcf98df8d2fed50d884249a",
            "744b1152eacbe5e38dcc887980da38b897584a65fa06cedd2c924f97cbac5996"
          ],
          [
            "59dbf46f8c94759ba21277c33784f41645f7b44f6c596a58ce92e666191abe3e",
            "c534ad44175fbc300f4ea6ce648309a042ce739a7919798cd85e216c4a307f6e"
          ],
          [
            "f13ada95103c4537305e691e74e9a4a8dd647e711a95e73cb62dc6018cfd87b8",
            "e13817b44ee14de663bf4bc808341f326949e21a6a75c2570778419bdaf5733d"
          ],
          [
            "7754b4fa0e8aced06d4167a2c59cca4cda1869c06ebadfb6488550015a88522c",
            "30e93e864e669d82224b967c3020b8fa8d1e4e350b6cbcc537a48b57841163a2"
          ],
          [
            "948dcadf5990e048aa3874d46abef9d701858f95de8041d2a6828c99e2262519",
            "e491a42537f6e597d5d28a3224b1bc25df9154efbd2ef1d2cbba2cae5347d57e"
          ],
          [
            "7962414450c76c1689c7b48f8202ec37fb224cf5ac0bfa1570328a8a3d7c77ab",
            "100b610ec4ffb4760d5c1fc133ef6f6b12507a051f04ac5760afa5b29db83437"
          ],
          [
            "3514087834964b54b15b160644d915485a16977225b8847bb0dd085137ec47ca",
            "ef0afbb2056205448e1652c48e8127fc6039e77c15c2378b7e7d15a0de293311"
          ],
          [
            "d3cc30ad6b483e4bc79ce2c9dd8bc54993e947eb8df787b442943d3f7b527eaf",
            "8b378a22d827278d89c5e9be8f9508ae3c2ad46290358630afb34db04eede0a4"
          ],
          [
            "1624d84780732860ce1c78fcbfefe08b2b29823db913f6493975ba0ff4847610",
            "68651cf9b6da903e0914448c6cd9d4ca896878f5282be4c8cc06e2a404078575"
          ],
          [
            "733ce80da955a8a26902c95633e62a985192474b5af207da6df7b4fd5fc61cd4",
            "f5435a2bd2badf7d485a4d8b8db9fcce3e1ef8e0201e4578c54673bc1dc5ea1d"
          ],
          [
            "15d9441254945064cf1a1c33bbd3b49f8966c5092171e699ef258dfab81c045c",
            "d56eb30b69463e7234f5137b73b84177434800bacebfc685fc37bbe9efe4070d"
          ],
          [
            "a1d0fcf2ec9de675b612136e5ce70d271c21417c9d2b8aaaac138599d0717940",
            "edd77f50bcb5a3cab2e90737309667f2641462a54070f3d519212d39c197a629"
          ],
          [
            "e22fbe15c0af8ccc5780c0735f84dbe9a790badee8245c06c7ca37331cb36980",
            "a855babad5cd60c88b430a69f53a1a7a38289154964799be43d06d77d31da06"
          ],
          [
            "311091dd9860e8e20ee13473c1155f5f69635e394704eaa74009452246cfa9b3",
            "66db656f87d1f04fffd1f04788c06830871ec5a64feee685bd80f0b1286d8374"
          ],
          [
            "34c1fd04d301be89b31c0442d3e6ac24883928b45a9340781867d4232ec2dbdf",
            "9414685e97b1b5954bd46f730174136d57f1ceeb487443dc5321857ba73abee"
          ],
          [
            "f219ea5d6b54701c1c14de5b557eb42a8d13f3abbcd08affcc2a5e6b049b8d63",
            "4cb95957e83d40b0f73af4544cccf6b1f4b08d3c07b27fb8d8c2962a400766d1"
          ],
          [
            "d7b8740f74a8fbaab1f683db8f45de26543a5490bca627087236912469a0b448",
            "fa77968128d9c92ee1010f337ad4717eff15db5ed3c049b3411e0315eaa4593b"
          ],
          [
            "32d31c222f8f6f0ef86f7c98d3a3335ead5bcd32abdd94289fe4d3091aa824bf",
            "5f3032f5892156e39ccd3d7915b9e1da2e6dac9e6f26e961118d14b8462e1661"
          ],
          [
            "7461f371914ab32671045a155d9831ea8793d77cd59592c4340f86cbc18347b5",
            "8ec0ba238b96bec0cbdddcae0aa442542eee1ff50c986ea6b39847b3cc092ff6"
          ],
          [
            "ee079adb1df1860074356a25aa38206a6d716b2c3e67453d287698bad7b2b2d6",
            "8dc2412aafe3be5c4c5f37e0ecc5f9f6a446989af04c4e25ebaac479ec1c8c1e"
          ],
          [
            "16ec93e447ec83f0467b18302ee620f7e65de331874c9dc72bfd8616ba9da6b5",
            "5e4631150e62fb40d0e8c2a7ca5804a39d58186a50e497139626778e25b0674d"
          ],
          [
            "eaa5f980c245f6f038978290afa70b6bd8855897f98b6aa485b96065d537bd99",
            "f65f5d3e292c2e0819a528391c994624d784869d7e6ea67fb18041024edc07dc"
          ],
          [
            "78c9407544ac132692ee1910a02439958ae04877151342ea96c4b6b35a49f51",
            "f3e0319169eb9b85d5404795539a5e68fa1fbd583c064d2462b675f194a3ddb4"
          ],
          [
            "494f4be219a1a77016dcd838431aea0001cdc8ae7a6fc688726578d9702857a5",
            "42242a969283a5f339ba7f075e36ba2af925ce30d767ed6e55f4b031880d562c"
          ],
          [
            "a598a8030da6d86c6bc7f2f5144ea549d28211ea58faa70ebf4c1e665c1fe9b5",
            "204b5d6f84822c307e4b4a7140737aec23fc63b65b35f86a10026dbd2d864e6b"
          ],
          [
            "c41916365abb2b5d09192f5f2dbeafec208f020f12570a184dbadc3e58595997",
            "4f14351d0087efa49d245b328984989d5caf9450f34bfc0ed16e96b58fa9913"
          ],
          [
            "841d6063a586fa475a724604da03bc5b92a2e0d2e0a36acfe4c73a5514742881",
            "73867f59c0659e81904f9a1c7543698e62562d6744c169ce7a36de01a8d6154"
          ],
          [
            "5e95bb399a6971d376026947f89bde2f282b33810928be4ded112ac4d70e20d5",
            "39f23f366809085beebfc71181313775a99c9aed7d8ba38b161384c746012865"
          ],
          [
            "36e4641a53948fd476c39f8a99fd974e5ec07564b5315d8bf99471bca0ef2f66",
            "d2424b1b1abe4eb8164227b085c9aa9456ea13493fd563e06fd51cf5694c78fc"
          ],
          [
            "336581ea7bfbbb290c191a2f507a41cf5643842170e914faeab27c2c579f726",
            "ead12168595fe1be99252129b6e56b3391f7ab1410cd1e0ef3dcdcabd2fda224"
          ],
          [
            "8ab89816dadfd6b6a1f2634fcf00ec8403781025ed6890c4849742706bd43ede",
            "6fdcef09f2f6d0a044e654aef624136f503d459c3e89845858a47a9129cdd24e"
          ],
          [
            "1e33f1a746c9c5778133344d9299fcaa20b0938e8acff2544bb40284b8c5fb94",
            "60660257dd11b3aa9c8ed618d24edff2306d320f1d03010e33a7d2057f3b3b6"
          ],
          [
            "85b7c1dcb3cec1b7ee7f30ded79dd20a0ed1f4cc18cbcfcfa410361fd8f08f31",
            "3d98a9cdd026dd43f39048f25a8847f4fcafad1895d7a633c6fed3c35e999511"
          ],
          [
            "29df9fbd8d9e46509275f4b125d6d45d7fbe9a3b878a7af872a2800661ac5f51",
            "b4c4fe99c775a606e2d8862179139ffda61dc861c019e55cd2876eb2a27d84b"
          ],
          [
            "a0b1cae06b0a847a3fea6e671aaf8adfdfe58ca2f768105c8082b2e449fce252",
            "ae434102edde0958ec4b19d917a6a28e6b72da1834aff0e650f049503a296cf2"
          ],
          [
            "4e8ceafb9b3e9a136dc7ff67e840295b499dfb3b2133e4ba113f2e4c0e121e5",
            "cf2174118c8b6d7a4b48f6d534ce5c79422c086a63460502b827ce62a326683c"
          ],
          [
            "d24a44e047e19b6f5afb81c7ca2f69080a5076689a010919f42725c2b789a33b",
            "6fb8d5591b466f8fc63db50f1c0f1c69013f996887b8244d2cdec417afea8fa3"
          ],
          [
            "ea01606a7a6c9cdd249fdfcfacb99584001edd28abbab77b5104e98e8e3b35d4",
            "322af4908c7312b0cfbfe369f7a7b3cdb7d4494bc2823700cfd652188a3ea98d"
          ],
          [
            "af8addbf2b661c8a6c6328655eb96651252007d8c5ea31be4ad196de8ce2131f",
            "6749e67c029b85f52a034eafd096836b2520818680e26ac8f3dfbcdb71749700"
          ],
          [
            "e3ae1974566ca06cc516d47e0fb165a674a3dabcfca15e722f0e3450f45889",
            "2aeabe7e4531510116217f07bf4d07300de97e4874f81f533420a72eeb0bd6a4"
          ],
          [
            "591ee355313d99721cf6993ffed1e3e301993ff3ed258802075ea8ced397e246",
            "b0ea558a113c30bea60fc4775460c7901ff0b053d25ca2bdeee98f1a4be5d196"
          ],
          [
            "11396d55fda54c49f19aa97318d8da61fa8584e47b084945077cf03255b52984",
            "998c74a8cd45ac01289d5833a7beb4744ff536b01b257be4c5767bea93ea57a4"
          ],
          [
            "3c5d2a1ba39c5a1790000738c9e0c40b8dcdfd5468754b6405540157e017aa7a",
            "b2284279995a34e2f9d4de7396fc18b80f9b8b9fdd270f6661f79ca4c81bd257"
          ],
          [
            "cc8704b8a60a0defa3a99a7299f2e9c3fbc395afb04ac078425ef8a1793cc030",
            "bdd46039feed17881d1e0862db347f8cf395b74fc4bcdc4e940b74e3ac1f1b13"
          ],
          [
            "c533e4f7ea8555aacd9777ac5cad29b97dd4defccc53ee7ea204119b2889b197",
            "6f0a256bc5efdf429a2fb6242f1a43a2d9b925bb4a4b3a26bb8e0f45eb596096"
          ],
          [
            "c14f8f2ccb27d6f109f6d08d03cc96a69ba8c34eec07bbcf566d48e33da6593",
            "c359d6923bb398f7fd4473e16fe1c28475b740dd098075e6c0e8649113dc3a38"
          ],
          [
            "a6cbc3046bc6a450bac24789fa17115a4c9739ed75f8f21ce441f72e0b90e6ef",
            "21ae7f4680e889bb130619e2c0f95a360ceb573c70603139862afd617fa9b9f"
          ],
          [
            "347d6d9a02c48927ebfb86c1359b1caf130a3c0267d11ce6344b39f99d43cc38",
            "60ea7f61a353524d1c987f6ecec92f086d565ab687870cb12689ff1e31c74448"
          ],
          [
            "da6545d2181db8d983f7dcb375ef5866d47c67b1bf31c8cf855ef7437b72656a",
            "49b96715ab6878a79e78f07ce5680c5d6673051b4935bd897fea824b77dc208a"
          ],
          [
            "c40747cc9d012cb1a13b8148309c6de7ec25d6945d657146b9d5994b8feb1111",
            "5ca560753be2a12fc6de6caf2cb489565db936156b9514e1bb5e83037e0fa2d4"
          ],
          [
            "4e42c8ec82c99798ccf3a610be870e78338c7f713348bd34c8203ef4037f3502",
            "7571d74ee5e0fb92a7a8b33a07783341a5492144cc54bcc40a94473693606437"
          ],
          [
            "3775ab7089bc6af823aba2e1af70b236d251cadb0c86743287522a1b3b0dedea",
            "be52d107bcfa09d8bcb9736a828cfa7fac8db17bf7a76a2c42ad961409018cf7"
          ],
          [
            "cee31cbf7e34ec379d94fb814d3d775ad954595d1314ba8846959e3e82f74e26",
            "8fd64a14c06b589c26b947ae2bcf6bfa0149ef0be14ed4d80f448a01c43b1c6d"
          ],
          [
            "b4f9eaea09b6917619f6ea6a4eb5464efddb58fd45b1ebefcdc1a01d08b47986",
            "39e5c9925b5a54b07433a4f18c61726f8bb131c012ca542eb24a8ac07200682a"
          ],
          [
            "d4263dfc3d2df923a0179a48966d30ce84e2515afc3dccc1b77907792ebcc60e",
            "62dfaf07a0f78feb30e30d6295853ce189e127760ad6cf7fae164e122a208d54"
          ],
          [
            "48457524820fa65a4f8d35eb6930857c0032acc0a4a2de422233eeda897612c4",
            "25a748ab367979d98733c38a1fa1c2e7dc6cc07db2d60a9ae7a76aaa49bd0f77"
          ],
          [
            "dfeeef1881101f2cb11644f3a2afdfc2045e19919152923f367a1767c11cceda",
            "ecfb7056cf1de042f9420bab396793c0c390bde74b4bbdff16a83ae09a9a7517"
          ],
          [
            "6d7ef6b17543f8373c573f44e1f389835d89bcbc6062ced36c82df83b8fae859",
            "cd450ec335438986dfefa10c57fea9bcc521a0959b2d80bbf74b190dca712d10"
          ],
          [
            "e75605d59102a5a2684500d3b991f2e3f3c88b93225547035af25af66e04541f",
            "f5c54754a8f71ee540b9b48728473e314f729ac5308b06938360990e2bfad125"
          ],
          [
            "eb98660f4c4dfaa06a2be453d5020bc99a0c2e60abe388457dd43fefb1ed620c",
            "6cb9a8876d9cb8520609af3add26cd20a0a7cd8a9411131ce85f44100099223e"
          ],
          [
            "13e87b027d8514d35939f2e6892b19922154596941888336dc3563e3b8dba942",
            "fef5a3c68059a6dec5d624114bf1e91aac2b9da568d6abeb2570d55646b8adf1"
          ],
          [
            "ee163026e9fd6fe017c38f06a5be6fc125424b371ce2708e7bf4491691e5764a",
            "1acb250f255dd61c43d94ccc670d0f58f49ae3fa15b96623e5430da0ad6c62b2"
          ],
          [
            "b268f5ef9ad51e4d78de3a750c2dc89b1e626d43505867999932e5db33af3d80",
            "5f310d4b3c99b9ebb19f77d41c1dee018cf0d34fd4191614003e945a1216e423"
          ],
          [
            "ff07f3118a9df035e9fad85eb6c7bfe42b02f01ca99ceea3bf7ffdba93c4750d",
            "438136d603e858a3a5c440c38eccbaddc1d2942114e2eddd4740d098ced1f0d8"
          ],
          [
            "8d8b9855c7c052a34146fd20ffb658bea4b9f69e0d825ebec16e8c3ce2b526a1",
            "cdb559eedc2d79f926baf44fb84ea4d44bcf50fee51d7ceb30e2e7f463036758"
          ],
          [
            "52db0b5384dfbf05bfa9d472d7ae26dfe4b851ceca91b1eba54263180da32b63",
            "c3b997d050ee5d423ebaf66a6db9f57b3180c902875679de924b69d84a7b375"
          ],
          [
            "e62f9490d3d51da6395efd24e80919cc7d0f29c3f3fa48c6fff543becbd43352",
            "6d89ad7ba4876b0b22c2ca280c682862f342c8591f1daf5170e07bfd9ccafa7d"
          ],
          [
            "7f30ea2476b399b4957509c88f77d0191afa2ff5cb7b14fd6d8e7d65aaab1193",
            "ca5ef7d4b231c94c3b15389a5f6311e9daff7bb67b103e9880ef4bff637acaec"
          ],
          [
            "5098ff1e1d9f14fb46a210fada6c903fef0fb7b4a1dd1d9ac60a0361800b7a00",
            "9731141d81fc8f8084d37c6e7542006b3ee1b40d60dfe5362a5b132fd17ddc0"
          ],
          [
            "32b78c7de9ee512a72895be6b9cbefa6e2f3c4ccce445c96b9f2c81e2778ad58",
            "ee1849f513df71e32efc3896ee28260c73bb80547ae2275ba497237794c8753c"
          ],
          [
            "e2cb74fddc8e9fbcd076eef2a7c72b0ce37d50f08269dfc074b581550547a4f7",
            "d3aa2ed71c9dd2247a62df062736eb0baddea9e36122d2be8641abcb005cc4a4"
          ],
          [
            "8438447566d4d7bedadc299496ab357426009a35f235cb141be0d99cd10ae3a8",
            "c4e1020916980a4da5d01ac5e6ad330734ef0d7906631c4f2390426b2edd791f"
          ],
          [
            "4162d488b89402039b584c6fc6c308870587d9c46f660b878ab65c82c711d67e",
            "67163e903236289f776f22c25fb8a3afc1732f2b84b4e95dbda47ae5a0852649"
          ],
          [
            "3fad3fa84caf0f34f0f89bfd2dcf54fc175d767aec3e50684f3ba4a4bf5f683d",
            "cd1bc7cb6cc407bb2f0ca647c718a730cf71872e7d0d2a53fa20efcdfe61826"
          ],
          [
            "674f2600a3007a00568c1a7ce05d0816c1fb84bf1370798f1c69532faeb1a86b",
            "299d21f9413f33b3edf43b257004580b70db57da0b182259e09eecc69e0d38a5"
          ],
          [
            "d32f4da54ade74abb81b815ad1fb3b263d82d6c692714bcff87d29bd5ee9f08f",
            "f9429e738b8e53b968e99016c059707782e14f4535359d582fc416910b3eea87"
          ],
          [
            "30e4e670435385556e593657135845d36fbb6931f72b08cb1ed954f1e3ce3ff6",
            "462f9bce619898638499350113bbc9b10a878d35da70740dc695a559eb88db7b"
          ],
          [
            "be2062003c51cc3004682904330e4dee7f3dcd10b01e580bf1971b04d4cad297",
            "62188bc49d61e5428573d48a74e1c655b1c61090905682a0d5558ed72dccb9bc"
          ],
          [
            "93144423ace3451ed29e0fb9ac2af211cb6e84a601df5993c419859fff5df04a",
            "7c10dfb164c3425f5c71a3f9d7992038f1065224f72bb9d1d902a6d13037b47c"
          ],
          [
            "b015f8044f5fcbdcf21ca26d6c34fb8197829205c7b7d2a7cb66418c157b112c",
            "ab8c1e086d04e813744a655b2df8d5f83b3cdc6faa3088c1d3aea1454e3a1d5f"
          ],
          [
            "d5e9e1da649d97d89e4868117a465a3a4f8a18de57a140d36b3f2af341a21b52",
            "4cb04437f391ed73111a13cc1d4dd0db1693465c2240480d8955e8592f27447a"
          ],
          [
            "d3ae41047dd7ca065dbf8ed77b992439983005cd72e16d6f996a5316d36966bb",
            "bd1aeb21ad22ebb22a10f0303417c6d964f8cdd7df0aca614b10dc14d125ac46"
          ],
          [
            "463e2763d885f958fc66cdd22800f0a487197d0a82e377b49f80af87c897b065",
            "bfefacdb0e5d0fd7df3a311a94de062b26b80c61fbc97508b79992671ef7ca7f"
          ],
          [
            "7985fdfd127c0567c6f53ec1bb63ec3158e597c40bfe747c83cddfc910641917",
            "603c12daf3d9862ef2b25fe1de289aed24ed291e0ec6708703a5bd567f32ed03"
          ],
          [
            "74a1ad6b5f76e39db2dd249410eac7f99e74c59cb83d2d0ed5ff1543da7703e9",
            "cc6157ef18c9c63cd6193d83631bbea0093e0968942e8c33d5737fd790e0db08"
          ],
          [
            "30682a50703375f602d416664ba19b7fc9bab42c72747463a71d0896b22f6da3",
            "553e04f6b018b4fa6c8f39e7f311d3176290d0e0f19ca73f17714d9977a22ff8"
          ],
          [
            "9e2158f0d7c0d5f26c3791efefa79597654e7a2b2464f52b1ee6c1347769ef57",
            "712fcdd1b9053f09003a3481fa7762e9ffd7c8ef35a38509e2fbf2629008373"
          ],
          [
            "176e26989a43c9cfeba4029c202538c28172e566e3c4fce7322857f3be327d66",
            "ed8cc9d04b29eb877d270b4878dc43c19aefd31f4eee09ee7b47834c1fa4b1c3"
          ],
          [
            "75d46efea3771e6e68abb89a13ad747ecf1892393dfc4f1b7004788c50374da8",
            "9852390a99507679fd0b86fd2b39a868d7efc22151346e1a3ca4726586a6bed8"
          ],
          [
            "809a20c67d64900ffb698c4c825f6d5f2310fb0451c869345b7319f645605721",
            "9e994980d9917e22b76b061927fa04143d096ccc54963e6a5ebfa5f3f8e286c1"
          ],
          [
            "1b38903a43f7f114ed4500b4eac7083fdefece1cf29c63528d563446f972c180",
            "4036edc931a60ae889353f77fd53de4a2708b26b6f5da72ad3394119daf408f9"
          ]
        ]
      }
    };
    const conf = {
      prime: "k256",
      p: "ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f",
      a: "0",
      b: "7",
      n: "ffffffff ffffffff ffffffff fffffffe baaedce6 af48a03b bfd25e8c d0364141",
      h: "1",
      beta: "7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee",
      lambda: "5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72",
      basis: [
        {
          a: "3086d221a7d46bcde86c90e49284eb15",
          b: "-e4437ed6010e88286f547fa90abfe4c3"
        },
        {
          a: "114ca50f7a8e2f3f657c1108d9d44cfd8",
          b: "3086d221a7d46bcde86c90e49284eb15"
        }
      ],
      gRed: false,
      g: [
        "79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
        "483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",
        precomputed
      ]
    };
    this.p = new BigNumber(conf.p, 16);
    this.red = new ReductionContext(conf.prime);
    this.zero = new BigNumber(0).toRed(this.red);
    this.one = new BigNumber(1).toRed(this.red);
    this.two = new BigNumber(2).toRed(this.red);
    this.n = new BigNumber(conf.n, 16);
    this.g = Point.fromJSON(conf.g, conf.gRed);
    this._wnafT1 = Array.from({ length: 4 }, () => {
      return;
    });
    this._wnafT2 = Array.from({ length: 4 }, () => {
      return;
    });
    this._wnafT3 = Array.from({ length: 4 }, () => {
      return;
    });
    this._wnafT4 = Array.from({ length: 4 }, () => {
      return;
    });
    this._bitLength = this.n.bitLength();
    this.redN = this.n.toRed(this.red);
    this.a = new BigNumber(conf.a, 16).toRed(this.red);
    this.b = new BigNumber(conf.b, 16).toRed(this.red);
    this.tinv = this.two.redInvm();
    this.zeroA = this.a.fromRed().cmpn(0) === 0;
    this.threeA = this.a.fromRed().sub(this.p).cmpn(-3) === 0;
    this.endo = this._getEndomorphism(conf);
    this._endoWnafT1 = Array.from({ length: 4 }, () => {
      return;
    });
    this._endoWnafT2 = Array.from({ length: 4 }, () => {
      return;
    });
  }
  _getEndomorphism(conf) {
    if (!this.zeroA || this.p.modrn(3) !== 1) {
      return;
    }
    const beta = this._resolveEndomorphismBeta(conf);
    const lambda = this._resolveEndomorphismLambda(conf, beta);
    return {
      beta,
      lambda,
      basis: this._resolveEndomorphismBasis(conf, lambda)
    };
  }
  _resolveEndomorphismBeta(conf) {
    if (conf.beta !== undefined)
      return new BigNumber(conf.beta, 16).toRed(this.red);
    const betas = this._getEndoRoots(this.p);
    if (betas == null)
      throw new Error("Failed to get endomorphism roots for beta.");
    const beta = betas[0].cmp(betas[1]) < 0 ? betas[0] : betas[1];
    return beta.toRed(this.red);
  }
  _endomorphismLambdaMatches(lambda, beta, requireCoordinates = false) {
    if (this.g == null)
      throw new Error("Curve generator point (g) is not defined.");
    const gMulX = this.g.mul(lambda)?.x;
    const gXRedMulBeta = this.g.x == null ? undefined : this.g.x.redMul(beta);
    if (gMulX == null || gXRedMulBeta == null) {
      if (requireCoordinates) {
        throw new Error("Lambda computation failed: g.mul(lambda).x or g.x.redMul(beta) is undefined.");
      }
      return false;
    }
    return gMulX.cmp(gXRedMulBeta) === 0;
  }
  _resolveEndomorphismLambda(conf, beta) {
    if (conf.lambda !== undefined)
      return new BigNumber(conf.lambda, 16);
    const lambdas = this._getEndoRoots(this.n);
    if (lambdas == null)
      throw new Error("Failed to get endomorphism roots for lambda.");
    if (this._endomorphismLambdaMatches(lambdas[0], beta))
      return lambdas[0];
    Curve.assert(this._endomorphismLambdaMatches(lambdas[1], beta, true), "Lambda selection does not match computed beta.");
    return lambdas[1];
  }
  _resolveEndomorphismBasis(conf, lambda) {
    if (typeof conf.basis !== "object" || conf.basis === null) {
      return this._getEndoBasis(lambda);
    }
    return conf.basis.map((vec) => ({
      a: new BigNumber(vec.a, 16),
      b: new BigNumber(vec.b, 16)
    }));
  }
  _getEndoRoots(num) {
    const red = num === this.p ? this.red : new MontgomoryMethod(num);
    const tinv = new BigNumber(2).toRed(red).redInvm();
    const ntinv = tinv.redNeg();
    const s = new BigNumber(3).toRed(red).redNeg().redSqrt().redMul(tinv);
    const l1 = ntinv.redAdd(s).fromRed();
    const l2 = ntinv.redSub(s).fromRed();
    return [l1, l2];
  }
  _getEndoBasis(lambda) {
    const aprxSqrt = this.n.ushrn(Math.floor(this.n.bitLength() / 2));
    let u = lambda;
    let v = this.n.clone();
    let x1 = new BigNumber(1);
    let y1 = new BigNumber(0);
    let x2 = new BigNumber(0);
    let y2 = new BigNumber(1);
    let a0;
    let b0;
    let a1;
    let b1;
    let a2;
    let b2;
    let prevR = new BigNumber(0);
    let i = 0;
    let r = new BigNumber(0);
    let x = new BigNumber(0);
    while (u.cmpn(0) !== 0) {
      const q = v.div(u);
      r = v.sub(q.mul(u));
      x = x2.sub(q.mul(x1));
      const y = y2.sub(q.mul(y1));
      if (a1 === undefined && r.cmp(aprxSqrt) < 0) {
        a0 = prevR.neg();
        b0 = x1;
        a1 = r.neg();
        b1 = x;
      } else if (a1 !== undefined && ++i === 2) {
        break;
      }
      prevR = r;
      v = u;
      u = r;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
    }
    if (a0 === undefined || b0 === undefined || a1 === undefined || b1 === undefined) {
      throw new Error("Failed to compute Endo Basis values");
    }
    a2 = r.neg();
    b2 = x;
    const len1 = a1.sqr().add(b1.sqr());
    const len2 = a2.sqr().add(b2.sqr());
    if (len2.cmp(len1) >= 0) {
      a2 = a0;
      b2 = b0;
    }
    if (a1.negative !== 0) {
      a1 = a1.neg();
      b1 = b1.neg();
    }
    if (a2.negative !== 0) {
      a2 = a2.neg();
      b2 = b2.neg();
    }
    return [
      { a: a1, b: b1 },
      { a: a2, b: b2 }
    ];
  }
  _endoSplit(k) {
    if (this.endo == null) {
      throw new Error("Endomorphism is not defined.");
    }
    const basis = this.endo.basis;
    const v1 = basis[0];
    const v2 = basis[1];
    const c1 = v2.b.mul(k).divRound(this.n);
    const c2 = v1.b.neg().mul(k).divRound(this.n);
    const p1 = c1.mul(v1.a);
    const p2 = c2.mul(v2.a);
    const q1 = c1.mul(v1.b);
    const q2 = c2.mul(v2.b);
    const k1 = k.sub(p1).sub(p2);
    const k2 = q1.add(q2).neg();
    return { k1, k2 };
  }
  validate(point) {
    if (point.inf) {
      return true;
    }
    const x = point.x;
    const y = point.y;
    if (x === null || y === null) {
      throw new Error("Point coordinates cannot be null");
    }
    const ax = this.a.redMul(x);
    const rhs = x.redSqr().redMul(x).redIAdd(ax).redIAdd(this.b);
    return y.redSqr().redISub(rhs).cmpn(0) === 0;
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/BasePoint.js
class BasePoint {
  curve;
  type;
  precomputed;
  constructor(type) {
    this.curve = new Curve;
    this.type = type;
    this.precomputed = null;
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/JacobianPoint.js
class JacobianPoint extends BasePoint {
  x;
  y;
  z;
  zOne;
  constructor(x, y, z) {
    super("jacobian");
    if (x === null && y === null && z === null) {
      this.x = this.curve.one;
      this.y = this.curve.one;
      this.z = new BigNumber(0);
    } else {
      if (!BigNumber.isBN(x)) {
        x = new BigNumber(x, 16);
      }
      this.x = x;
      if (!BigNumber.isBN(y)) {
        y = new BigNumber(y, 16);
      }
      this.y = y;
      if (!BigNumber.isBN(z)) {
        z = new BigNumber(z, 16);
      }
      this.z = z;
    }
    if (this.x.red == null) {
      this.x = this.x.toRed(this.curve.red);
    }
    if (this.y.red == null) {
      this.y = this.y.toRed(this.curve.red);
    }
    if (this.z.red == null) {
      this.z = this.z.toRed(this.curve.red);
    }
    this.zOne = this.z === this.curve.one;
    if (this.isInfinity()) {
      this.x = this.curve.one;
      this.y = this.curve.one;
      this.z = new BigNumber(0).toRed(this.curve.red);
      this.zOne = false;
    }
  }
  toP() {
    if (this.isInfinity()) {
      return new Point(null, null);
    }
    const zinv = this.z.redInvm();
    const zinv2 = zinv.redSqr();
    const ax = this.x.redMul(zinv2);
    const ay = this.y.redMul(zinv2).redMul(zinv);
    return new Point(ax, ay);
  }
  neg() {
    return new JacobianPoint(this.x, this.y.redNeg(), this.z);
  }
  add(p) {
    if (this.isInfinity()) {
      return p;
    }
    if (p.isInfinity()) {
      return this;
    }
    const pz2 = p.z.redSqr();
    const z2 = this.z.redSqr();
    const u1 = this.x.redMul(pz2);
    const u2 = p.x.redMul(z2);
    const s1 = this.y.redMul(pz2.redMul(p.z));
    const s2 = p.y.redMul(z2.redMul(this.z));
    const h = u1.redSub(u2);
    const r = s1.redSub(s2);
    if (h.cmpn(0) === 0) {
      if (r.cmpn(0) === 0) {
        return this.dbl();
      } else {
        return new JacobianPoint(null, null, null);
      }
    }
    const h2 = h.redSqr();
    const h3 = h2.redMul(h);
    const v = u1.redMul(h2);
    const nx = r.redSqr().redIAdd(h3).redISub(v).redISub(v);
    const ny = r.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
    const nz = this.z.redMul(p.z).redMul(h);
    return new JacobianPoint(nx, ny, nz);
  }
  mixedAdd(p) {
    if (this.isInfinity()) {
      return p.toJ();
    }
    if (p.isInfinity()) {
      return this;
    }
    if (p.x === null || p.y === null) {
      throw new Error("Point coordinates cannot be null");
    }
    const z2 = this.z.redSqr();
    const u1 = this.x;
    const u2 = p.x.redMul(z2);
    const s1 = this.y;
    const s2 = p.y.redMul(z2).redMul(this.z);
    const h = u1.redSub(u2);
    const r = s1.redSub(s2);
    if (h.cmpn(0) === 0) {
      if (r.cmpn(0) === 0) {
        return this.dbl();
      } else {
        return new JacobianPoint(null, null, null);
      }
    }
    const h2 = h.redSqr();
    const h3 = h2.redMul(h);
    const v = u1.redMul(h2);
    const nx = r.redSqr().redIAdd(h3).redISub(v).redISub(v);
    const ny = r.redMul(v.redISub(nx)).redISub(s1.redMul(h3));
    const nz = this.z.redMul(h);
    return new JacobianPoint(nx, ny, nz);
  }
  dblp(pow) {
    if (pow === 0) {
      return this;
    }
    if (this.isInfinity()) {
      return this;
    }
    if (pow === undefined) {
      return this.dbl();
    }
    let r = this;
    for (let i = 0;i < pow; i++) {
      r = r.dbl();
    }
    return r;
  }
  dbl() {
    if (this.isInfinity()) {
      return this;
    }
    let nx;
    let ny;
    let nz;
    if (this.zOne) {
      const xx = this.x.redSqr();
      const yy = this.y.redSqr();
      const yyyy = yy.redSqr();
      let s = this.x.redAdd(yy).redSqr().redISub(xx).redISub(yyyy);
      s = s.redIAdd(s);
      const m = xx.redAdd(xx).redIAdd(xx);
      const t = m.redSqr().redISub(s).redISub(s);
      let yyyy8 = yyyy.redIAdd(yyyy);
      yyyy8 = yyyy8.redIAdd(yyyy8);
      yyyy8 = yyyy8.redIAdd(yyyy8);
      nx = t;
      ny = m.redMul(s.redISub(t)).redISub(yyyy8);
      nz = this.y.redAdd(this.y);
    } else {
      const a = this.x.redSqr();
      const b = this.y.redSqr();
      const c = b.redSqr();
      let d = this.x.redAdd(b).redSqr().redISub(a).redISub(c);
      d = d.redIAdd(d);
      const e = a.redAdd(a).redIAdd(a);
      const f = e.redSqr();
      let c8 = c.redIAdd(c);
      c8 = c8.redIAdd(c8);
      c8 = c8.redIAdd(c8);
      nx = f.redISub(d).redISub(d);
      ny = e.redMul(d.redISub(nx)).redISub(c8);
      nz = this.y.redMul(this.z);
      nz = nz.redIAdd(nz);
    }
    return new JacobianPoint(nx, ny, nz);
  }
  eq(p) {
    if (p.type === "affine") {
      return this.eq(p.toJ());
    }
    if (this === p) {
      return true;
    }
    p = p;
    if (this.isInfinity() && p.isInfinity()) {
      return true;
    }
    if (this.isInfinity() !== p.isInfinity()) {
      return false;
    }
    const z2 = this.z.redSqr();
    const pz2 = p.z.redSqr();
    if (this.x.redMul(pz2).redISub(p.x.redMul(z2)).cmpn(0) !== 0) {
      return false;
    }
    const z3 = z2.redMul(this.z);
    const pz3 = pz2.redMul(p.z);
    return this.y.redMul(pz3).redISub(p.y.redMul(z3)).cmpn(0) === 0;
  }
  eqXToP(x) {
    const zs = this.z.redSqr();
    const rx = x.toRed(this.curve?.red).redMul(zs);
    if (this.x.cmp(rx) === 0) {
      return true;
    }
    const xc = x.clone();
    if (this.curve?.redN == null) {
      throw new Error("Curve or redN is not initialized.");
    }
    const t = this.curve.redN.redMul(zs);
    while (xc.cmp(this.curve.p) < 0) {
      xc.iadd(this.curve.n);
      if (xc.cmp(this.curve.p) >= 0) {
        return false;
      }
      rx.redIAdd(t);
      if (this.x.cmp(rx) === 0) {
        return true;
      }
    }
    return false;
  }
  inspect() {
    if (this.isInfinity()) {
      return "<EC JPoint Infinity>";
    }
    return "<EC JPoint x: " + this.x.toString(16, 2) + " y: " + this.y.toString(16, 2) + " z: " + this.z.toString(16, 2) + ">";
  }
  isInfinity() {
    return this.z.cmpn(0) === 0;
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/Point.js
function ctSwap(swap, a, b) {
  const mask = -swap;
  const swapX = (a.X ^ b.X) & mask;
  const swapY = (a.Y ^ b.Y) & mask;
  const swapZ = (a.Z ^ b.Z) & mask;
  a.X ^= swapX;
  b.X ^= swapX;
  a.Y ^= swapY;
  b.Y ^= swapY;
  a.Z ^= swapZ;
  b.Z ^= swapZ;
}
var BI_ZERO = 0n;
var BI_ONE = 1n;
var BI_TWO = 2n;
var BI_THREE = 3n;
var BI_FOUR = 4n;
var BI_EIGHT = 8n;
var P_BIGINT = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
var N_BIGINT = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
var MASK_256 = (1n << 256n) - 1n;
function red(x) {
  let hi = x >> 256n;
  x = (x & MASK_256) + (hi << 32n) + hi * 977n;
  hi = x >> 256n;
  x = (x & MASK_256) + (hi << 32n) + hi * 977n;
  if (x >= P_BIGINT)
    x -= P_BIGINT;
  return x;
}
var biMod = (a) => red((a % P_BIGINT + P_BIGINT) % P_BIGINT);
var biModSub = (a, b) => a >= b ? a - b : P_BIGINT - (b - a);
var biModMul = (a, b) => red(a * b);
var biModAdd = (a, b) => red(a + b);
var biModInv = (a) => {
  let lm = BI_ONE;
  let hm = BI_ZERO;
  let low = biMod(a);
  let high = P_BIGINT;
  while (low > BI_ONE) {
    const r = high / low;
    [lm, hm] = [hm - lm * r, lm];
    [low, high] = [high - low * r, low];
  }
  return biMod(lm);
};
var biModSqr = (a) => biModMul(a, a);
var biModPow = (base, exp) => {
  let result = 1n;
  base = biMod(base);
  while (exp > 0n) {
    if ((exp & 1n) !== 0n) {
      result = biModMul(result, base);
    }
    base = biModMul(base, base);
    exp >>= 1n;
  }
  return result;
};
var P_PLUS1_DIV4 = P_BIGINT + 1n >> 2n;
var biModSqrt = (a) => {
  const r = biModPow(a, P_PLUS1_DIV4);
  if (biModMul(r, r) !== biMod(a)) {
    return null;
  }
  return r;
};
var toBigInt = (x) => {
  if (BigNumber.isBN(x))
    return BigInt("0x" + x.toString(16));
  if (typeof x === "string")
    return BigInt("0x" + x);
  if (Array.isArray(x))
    return BigInt("0x" + toHex(x));
  return BigInt(x);
};
var GX_BIGINT = BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798");
var GY_BIGINT = BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8");
var WNAF_TABLE_CACHE = new Map;
var jpDouble = (P) => {
  const { X: X1, Y: Y1, Z: Z1 } = P;
  if (Y1 === BI_ZERO)
    return { X: BI_ZERO, Y: BI_ONE, Z: BI_ZERO };
  const Y1sq = biModMul(Y1, Y1);
  const S = biModMul(BI_FOUR, biModMul(X1, Y1sq));
  const M = biModMul(BI_THREE, biModMul(X1, X1));
  const X3 = biModSub(biModMul(M, M), biModMul(BI_TWO, S));
  const Y3 = biModSub(biModMul(M, biModSub(S, X3)), biModMul(BI_EIGHT, biModMul(Y1sq, Y1sq)));
  const Z3 = biModMul(BI_TWO, biModMul(Y1, Z1));
  return { X: X3, Y: Y3, Z: Z3 };
};
var jpAdd = (P, Q) => {
  if (P.Z === BI_ZERO)
    return Q;
  if (Q.Z === BI_ZERO)
    return P;
  const Z1Z1 = biModMul(P.Z, P.Z);
  const Z2Z2 = biModMul(Q.Z, Q.Z);
  const U1 = biModMul(P.X, Z2Z2);
  const U2 = biModMul(Q.X, Z1Z1);
  const S1 = biModMul(P.Y, biModMul(Z2Z2, Q.Z));
  const S2 = biModMul(Q.Y, biModMul(Z1Z1, P.Z));
  const H = biModSub(U2, U1);
  const r = biModSub(S2, S1);
  if (H === BI_ZERO) {
    if (r === BI_ZERO)
      return jpDouble(P);
    return { X: BI_ZERO, Y: BI_ONE, Z: BI_ZERO };
  }
  const HH = biModMul(H, H);
  const HHH = biModMul(H, HH);
  const V = biModMul(U1, HH);
  const X3 = biModSub(biModSub(biModMul(r, r), HHH), biModMul(BI_TWO, V));
  const Y3 = biModSub(biModMul(r, biModSub(V, X3)), biModMul(S1, HHH));
  const Z3 = biModMul(H, biModMul(P.Z, Q.Z));
  return { X: X3, Y: Y3, Z: Z3 };
};
var jpNeg = (P) => {
  if (P.Z === BI_ZERO)
    return P;
  return { X: P.X, Y: P_BIGINT - P.Y, Z: P.Z };
};
var wnafTable = (window, P0) => {
  const key = `${window}:${P0.x.toString(16)}:${P0.y.toString(16)}`;
  const cached = WNAF_TABLE_CACHE.get(key);
  if (cached !== undefined)
    return cached;
  const table = Array.from({ length: 1 << window - 1 }, () => ({
    X: BI_ZERO,
    Y: BI_ONE,
    Z: BI_ZERO
  }));
  const point = { X: P0.x, Y: P0.y, Z: BI_ONE };
  table[0] = point;
  const doubled = jpDouble(point);
  for (let i = 1;i < table.length; i++) {
    table[i] = jpAdd(table[i - 1], doubled);
  }
  WNAF_TABLE_CACHE.set(key, table);
  return table;
};
var wnafDigits = (scalar, window) => {
  const digits = [];
  const windowSize = 1n << BigInt(window);
  const halfWindow = windowSize >> 1n;
  let remaining = scalar;
  while (remaining > 0n) {
    if ((remaining & BI_ONE) === BI_ZERO) {
      digits.push(0);
    } else {
      let digit = remaining & windowSize - 1n;
      if (digit > halfWindow)
        digit -= windowSize;
      digits.push(Number(digit));
      remaining -= digit;
    }
    remaining >>= BI_ONE;
  }
  return digits;
};
var scalarMultiplyWNAF = (k, P0, window = 5) => {
  const table = wnafTable(window, P0);
  const wnaf = wnafDigits(k, window);
  let Q = { X: BI_ZERO, Y: BI_ONE, Z: BI_ZERO };
  for (let i = wnaf.length - 1;i >= 0; i--) {
    Q = jpDouble(Q);
    const di = wnaf[i];
    if (di !== 0) {
      const idx = Math.abs(di) >> 1;
      const addend = di > 0 ? table[idx] : jpNeg(table[idx]);
      Q = jpAdd(Q, addend);
    }
  }
  return Q;
};
var modN = (a) => {
  let r = a % N_BIGINT;
  if (r < 0n)
    r += N_BIGINT;
  return r;
};
var modMulN = (a, b) => modN(a * b);
var modInvN = (a) => {
  let lm = 1n;
  let hm = 0n;
  let low = modN(a);
  let high = N_BIGINT;
  while (low > 1n) {
    const q = high / low;
    [lm, hm] = [hm - lm * q, lm];
    [low, high] = [high - low * q, low];
  }
  return modN(lm);
};

class Point extends BasePoint {
  x;
  y;
  inf;
  static _assertOnCurve(p) {
    if (!p.validate()) {
      throw new Error("Invalid point");
    }
    return p;
  }
  static fromDER(bytes) {
    const len = 32;
    if ((bytes[0] === 4 || bytes[0] === 6 || bytes[0] === 7) && bytes.length - 1 === 2 * len) {
      if (bytes[0] === 6) {
        if (bytes.at(-1) % 2 !== 0) {
          throw new Error("Point string value is wrong length");
        }
      } else if (bytes[0] === 7) {
        if (bytes.at(-1) % 2 !== 1) {
          throw new Error("Point string value is wrong length");
        }
      }
      const res = new Point(bytes.slice(1, 1 + len), bytes.slice(1 + len, 1 + 2 * len));
      return Point._assertOnCurve(res);
    } else if ((bytes[0] === 2 || bytes[0] === 3) && bytes.length - 1 === len) {
      return Point._assertOnCurve(Point.fromX(bytes.slice(1, 1 + len), bytes[0] === 3));
    }
    throw new Error("Unknown point format");
  }
  static fromString(str) {
    const bytes = toArray2(str, "hex");
    return Point._assertOnCurve(Point.fromDER(bytes));
  }
  static fromX(x, odd) {
    let xBigInt = toBigInt(x);
    xBigInt = biMod(xBigInt);
    const y2 = biModAdd(biModMul(biModSqr(xBigInt), xBigInt), 7n);
    const y = biModSqrt(y2);
    if (y === null) {
      throw new Error("Invalid point");
    }
    let yBig = y;
    if ((yBig & BI_ONE) !== (odd ? BI_ONE : BI_ZERO)) {
      yBig = biModSub(P_BIGINT, yBig);
    }
    const xBN = new BigNumber(xBigInt.toString(16), 16);
    const yBN = new BigNumber(yBig.toString(16), 16);
    return Point._assertOnCurve(new Point(xBN, yBN));
  }
  static fromJSON(obj, isRed) {
    if (typeof obj === "string") {
      obj = JSON.parse(obj);
    }
    let res = new Point(obj[0], obj[1], isRed);
    res = Point._assertOnCurve(res);
    if (typeof obj[2] !== "object" || obj[2] === null) {
      return res;
    }
    const pre = obj[2];
    const obj2point = (p) => {
      const pt = new Point(p[0], p[1], isRed);
      return Point._assertOnCurve(pt);
    };
    res.precomputed = {
      beta: null,
      doubles: typeof pre.doubles === "object" && pre.doubles !== null ? {
        step: pre.doubles.step,
        points: [res].concat(pre.doubles.points.map(obj2point))
      } : undefined,
      naf: typeof pre.naf === "object" && pre.naf !== null ? {
        wnd: pre.naf.wnd,
        points: [res].concat(pre.naf.points.map(obj2point))
      } : undefined
    };
    return res;
  }
  constructor(x, y, isRed = true) {
    super("affine");
    this.precomputed = null;
    if (x === null && y === null) {
      this.x = null;
      this.y = null;
      this.inf = true;
    } else {
      if (!BigNumber.isBN(x)) {
        x = new BigNumber(x, 16);
      }
      this.x = x;
      if (!BigNumber.isBN(y)) {
        y = new BigNumber(y, 16);
      }
      this.y = y;
      if (isRed) {
        this.x.forceRed(this.curve.red);
        this.y.forceRed(this.curve.red);
      }
      if (this.x.red === null) {
        this.x = this.x.toRed(this.curve.red);
      }
      if (this.y.red === null) {
        this.y = this.y.toRed(this.curve.red);
      }
      this.inf = false;
    }
  }
  validate() {
    if (this.inf || this.x == null || this.y == null)
      return false;
    try {
      const xBig = BigInt("0x" + this.x.fromRed().toString(16));
      const yBig = BigInt("0x" + this.y.fromRed().toString(16));
      const lhs = biModMul(yBig, yBig);
      const rhs = biModAdd(biModMul(biModMul(xBig, xBig), xBig), 7n);
      return lhs === rhs;
    } catch {
      return false;
    }
  }
  encode(compact = true, enc) {
    if (this.inf) {
      if (enc === "hex")
        return "00";
      return [0];
    }
    const len = this.curve.p.byteLength();
    const x = this.getX().toArray("be", len);
    let res;
    if (compact) {
      res = [this.getY().isEven() ? 2 : 3].concat(x);
    } else {
      res = [4].concat(x, this.getY().toArray("be", len));
    }
    if (enc === "hex") {
      return toHex(res);
    } else {
      return res;
    }
  }
  toString() {
    return this.encode(true, "hex");
  }
  toJSON() {
    if (this.precomputed == null) {
      return [this.x, this.y];
    }
    return [
      this.x,
      this.y,
      typeof this.precomputed === "object" && this.precomputed !== null ? {
        doubles: this.precomputed.doubles == null ? undefined : {
          step: this.precomputed.doubles.step,
          points: this.precomputed.doubles.points.slice(1)
        },
        naf: this.precomputed.naf == null ? undefined : {
          wnd: this.precomputed.naf.wnd,
          points: this.precomputed.naf.points.slice(1)
        }
      } : undefined
    ];
  }
  inspect() {
    if (this.isInfinity()) {
      return "<EC Point Infinity>";
    }
    return "<EC Point x: " + (this.x?.fromRed()?.toString(16, 2) ?? "undefined") + " y: " + (this.y?.fromRed()?.toString(16, 2) ?? "undefined") + ">";
  }
  isInfinity() {
    return this.inf;
  }
  add(p) {
    if (this.inf) {
      return p;
    }
    if (p.inf) {
      return this;
    }
    if (this.eq(p)) {
      return this.dbl();
    }
    if (this.neg().eq(p)) {
      return new Point(null, null);
    }
    if (this.x?.cmp(p.x ?? new BigNumber(0)) === 0) {
      return new Point(null, null);
    }
    const P1 = {
      X: BigInt("0x" + this.x.fromRed().toString(16)),
      Y: BigInt("0x" + this.y.fromRed().toString(16)),
      Z: BI_ONE
    };
    const Q1 = {
      X: BigInt("0x" + p.x.fromRed().toString(16)),
      Y: BigInt("0x" + p.y.fromRed().toString(16)),
      Z: BI_ONE
    };
    const R = jpAdd(P1, Q1);
    if (R.Z === BI_ZERO)
      return new Point(null, null);
    const zInv = biModInv(R.Z);
    const zInv2 = biModMul(zInv, zInv);
    const xRes = biModMul(R.X, zInv2);
    const yRes = biModMul(R.Y, biModMul(zInv2, zInv));
    return new Point(xRes.toString(16), yRes.toString(16));
  }
  dbl() {
    if (this.inf)
      return this;
    if (this.x === null || this.y === null) {
      throw new Error("Point coordinates cannot be null");
    }
    const X = BigInt("0x" + this.x.fromRed().toString(16));
    const Y = BigInt("0x" + this.y.fromRed().toString(16));
    if (Y === BI_ZERO)
      return new Point(null, null);
    const R = jpDouble({ X, Y, Z: BI_ONE });
    const zInv = biModInv(R.Z);
    const zInv2 = biModMul(zInv, zInv);
    const xRes = biModMul(R.X, zInv2);
    const yRes = biModMul(R.Y, biModMul(zInv2, zInv));
    return new Point(xRes.toString(16), yRes.toString(16));
  }
  getX() {
    return (this.x ?? new BigNumber(0)).fromRed();
  }
  getY() {
    return (this.y ?? new BigNumber(0)).fromRed();
  }
  mul(k) {
    if (!BigNumber.isBN(k)) {
      k = new BigNumber(k, 16);
    }
    k = k;
    if (this.inf) {
      return this;
    }
    const isNeg = k.isNeg();
    const kAbs = isNeg ? k.neg() : k;
    let kBig = BigInt("0x" + kAbs.toString(16));
    kBig = biMod(kBig);
    if (kBig === BI_ZERO) {
      return new Point(null, null);
    }
    if (kBig === BI_ZERO) {
      return new Point(null, null);
    }
    if (this.x === null || this.y === null) {
      throw new Error("Point coordinates cannot be null");
    }
    let Px;
    let Py;
    if (this === this.curve.g) {
      Px = GX_BIGINT;
      Py = GY_BIGINT;
    } else {
      Px = BigInt("0x" + this.x.fromRed().toString(16));
      Py = BigInt("0x" + this.y.fromRed().toString(16));
    }
    const R = scalarMultiplyWNAF(kBig, { x: Px, y: Py });
    if (R.Z === BI_ZERO) {
      return new Point(null, null);
    }
    const zInv = biModInv(R.Z);
    const zInv2 = biModMul(zInv, zInv);
    const xRes = biModMul(R.X, zInv2);
    const yRes = biModMul(R.Y, biModMul(zInv2, zInv));
    const xBN = new BigNumber(xRes.toString(16), 16);
    const yBN = new BigNumber(yRes.toString(16), 16);
    const result = new Point(xBN, yBN);
    if (isNeg) {
      return result.neg();
    }
    return result;
  }
  mulCT(k) {
    if (!BigNumber.isBN(k)) {
      k = new BigNumber(k, 16);
    }
    k = k;
    if (this.inf)
      return new Point(null, null);
    const isNeg = k.isNeg();
    const kAbs = isNeg ? k.neg() : k;
    let kBig = BigInt("0x" + kAbs.toString(16));
    kBig = biMod(kBig);
    if (kBig === 0n)
      return new Point(null, null);
    const Px = this === this.curve.g ? GX_BIGINT : BigInt("0x" + this.getX().toString(16));
    const Py = this === this.curve.g ? GY_BIGINT : BigInt("0x" + this.getY().toString(16));
    let R0 = { X: 0n, Y: 1n, Z: 0n };
    let R1 = { X: Px, Y: Py, Z: 1n };
    const bits = kBig.toString(2);
    for (const bitChar of bits) {
      const bit = bitChar === "1" ? 1n : 0n;
      ctSwap(bit, R0, R1);
      R1 = jpAdd(R0, R1);
      R0 = jpDouble(R0);
      ctSwap(bit, R0, R1);
    }
    if (R0.Z === 0n)
      return new Point(null, null);
    const zInv = biModInv(R0.Z);
    const zInv2 = biModMul(zInv, zInv);
    const x = biModMul(R0.X, zInv2);
    const y = biModMul(R0.Y, biModMul(zInv2, zInv));
    const result = new Point(x.toString(16), y.toString(16));
    return isNeg ? result.neg() : result;
  }
  mulAdd(k1, p2, k2) {
    const points = [this, p2];
    const coeffs = [k1, k2];
    return this._endoWnafMulAdd(points, coeffs);
  }
  jmulAdd(k1, p2, k2) {
    const points = [this, p2];
    const coeffs = [k1, k2];
    return this._endoWnafMulAdd(points, coeffs, true);
  }
  eq(p) {
    return this === p || this.inf === p.inf && (this.inf || (this.x ?? new BigNumber(0)).cmp(p.x ?? new BigNumber(0)) === 0 && (this.y ?? new BigNumber(0)).cmp(p.y ?? new BigNumber(0)) === 0);
  }
  neg(_precompute) {
    if (this.inf) {
      return this;
    }
    const res = new Point(this.x, (this.y ?? new BigNumber(0)).redNeg());
    if (_precompute === true && this.precomputed != null) {
      const pre = this.precomputed;
      const negate = (p) => p.neg();
      res.precomputed = {
        naf: pre.naf == null ? undefined : {
          wnd: pre.naf.wnd,
          points: pre.naf.points.map(negate)
        },
        doubles: pre.doubles == null ? undefined : {
          step: pre.doubles.step,
          points: pre.doubles.points.map((p) => p.neg())
        },
        beta: undefined
      };
    }
    return res;
  }
  dblp(k) {
    let r;
    for (let i = 0;i < k; i++) {
      r = (r ?? this).dbl();
    }
    return r ?? this;
  }
  toJ() {
    if (this.inf) {
      return new JacobianPoint(null, null, null);
    }
    const res = new JacobianPoint(this.x, this.y, this.curve.one);
    return res;
  }
  _getBeta() {
    if (typeof this.curve.endo !== "object") {
      return;
    }
    const pre = this.precomputed;
    if (typeof pre === "object" && pre !== null && typeof pre.beta === "object" && pre.beta !== null) {
      return pre.beta;
    }
    const beta = new Point((this.x ?? new BigNumber(0)).redMul(this.curve.endo.beta), this.y);
    if (pre != null) {
      const curve = this.curve;
      const endoMul = (basePoint) => {
        const p = basePoint;
        if (p.x === null) {
          throw new Error("p.x is null");
        }
        if (curve.endo === undefined || curve.endo === null) {
          throw new Error("curve.endo is undefined");
        }
        return new Point(p.x.redMul(curve.endo.beta), p.y);
      };
      pre.beta = beta;
      beta.precomputed = {
        beta: null,
        naf: pre.naf == null ? undefined : {
          wnd: pre.naf.wnd,
          points: pre.naf.points.map(endoMul)
        },
        doubles: pre.doubles == null ? undefined : {
          step: pre.doubles.step,
          points: pre.doubles.points.map(endoMul)
        }
      };
    }
    return beta;
  }
  _fixedNafMul(k) {
    if (typeof this.precomputed !== "object" || this.precomputed === null) {
      throw new Error("_fixedNafMul requires precomputed values for the point");
    }
    const doubles = this._getDoubles();
    const naf = this.curve.getNAF(k, 1, this.curve._bitLength);
    let I = (1 << doubles.step + 1) - (doubles.step % 2 === 0 ? 2 : 1);
    I /= 3;
    const repr = [];
    for (let j = 0;j < naf.length; j += doubles.step) {
      let nafW = 0;
      for (let k = j + doubles.step - 1;k >= j; k--) {
        nafW = (nafW << 1) + naf[k];
      }
      repr.push(nafW);
    }
    let a = new JacobianPoint(null, null, null);
    let b = new JacobianPoint(null, null, null);
    for (let i = I;i > 0; i--) {
      for (let j = 0;j < repr.length; j++) {
        const nafW = repr[j];
        if (nafW === i) {
          b = b.mixedAdd(doubles.points[j]);
        } else if (nafW === -i) {
          b = b.mixedAdd(doubles.points[j].neg());
        }
      }
      a = a.add(b);
    }
    return a.toP();
  }
  _prepareWnafWindows(defW, points, len, wndWidth, wnd) {
    for (let index = 0;index < len; index++) {
      const nafPoints = points[index]._getNAFPoints(defW);
      wndWidth[index] = nafPoints.wnd;
      wnd[index] = nafPoints.points;
    }
  }
  _combineWnafPair(a, b, context) {
    const { points, coeffs, wndWidth, wnd, naf, currentMax } = context;
    if (wndWidth[a] !== 1 || wndWidth[b] !== 1) {
      naf[a] = this.curve.getNAF(coeffs[a], wndWidth[a], this.curve._bitLength);
      naf[b] = this.curve.getNAF(coeffs[b], wndWidth[b], this.curve._bitLength);
      return Math.max(currentMax, naf[a].length, naf[b].length);
    }
    const comb = [points[a], null, null, points[b]];
    const aY = points[a].y ?? new BigNumber(0);
    const bY = points[b].y ?? new BigNumber(0);
    if (aY.cmp(bY) === 0) {
      comb[1] = points[a].add(points[b]);
      comb[2] = points[a].toJ().mixedAdd(points[b].neg());
    } else if (aY.cmp(bY.redNeg()) === 0) {
      comb[1] = points[a].toJ().mixedAdd(points[b]);
      comb[2] = points[a].add(points[b].neg());
    } else {
      comb[1] = points[a].toJ().mixedAdd(points[b]);
      comb[2] = points[a].toJ().mixedAdd(points[b].neg());
    }
    const index = [-3, -1, -5, -7, 0, 7, 5, 1, 3];
    const jsf = this.curve.getJSF(coeffs[a], coeffs[b]);
    const max = Math.max(currentMax, jsf[0].length);
    naf[a] = Array.from({ length: max });
    naf[b] = Array.from({ length: max });
    for (let position = 0;position < max; position++) {
      const ja = Math.trunc(jsf[0][position]);
      const jb = Math.trunc(jsf[1][position]);
      naf[a][position] = index[(ja + 1) * 3 + (jb + 1)];
      naf[b][position] = 0;
      wnd[a] = comb;
    }
    return max;
  }
  _prepareWnafRepresentations(points, coeffs, len, wndWidth, wnd, naf) {
    let max = 0;
    for (let index = len - 1;index >= 1; index -= 2) {
      max = this._combineWnafPair(index - 1, index, {
        points,
        coeffs,
        wndWidth,
        wnd,
        naf,
        currentMax: max
      });
    }
    return max;
  }
  _collectWnafStep(start, len, naf, tmp) {
    let index = start;
    let doubles = 0;
    while (index >= 0) {
      let zero = true;
      for (let point = 0;point < len; point++) {
        tmp[point] = new BigNumber(typeof naf[point][index] === "number" ? naf[point][index] : 0);
        if (!tmp[point].isZero())
          zero = false;
      }
      if (!zero)
        break;
      doubles++;
      index--;
    }
    if (index >= 0)
      doubles++;
    return { index, doubles };
  }
  _addWnafStep(accumulator, len, tmp, wnd) {
    const one = new BigNumber(1);
    const two = new BigNumber(2);
    let result = accumulator;
    for (let index = 0;index < len; index++) {
      const value = tmp[index];
      if (value.cmpn(0) === 0)
        continue;
      const point = value.isNeg() ? wnd[index][value.neg().sub(one).div(two).toNumber()].neg() : wnd[index][value.sub(one).div(two).toNumber()];
      result = point.type === "affine" ? result.mixedAdd(point) : result.add(point);
    }
    return result;
  }
  _wnafMulAdd(defW, points, coeffs, len, jacobianResult) {
    const scratchLength = this.curve._wnafT1.length;
    const wndWidth = Array.from({ length: scratchLength });
    const wnd = Array.from({ length: scratchLength }, () => []);
    const naf = Array.from({ length: scratchLength }, () => []);
    this._prepareWnafWindows(defW, points, len, wndWidth, wnd);
    const max = this._prepareWnafRepresentations(points, coeffs, len, wndWidth, wnd, naf);
    let acc = new JacobianPoint(null, null, null);
    const tmp = this.curve._wnafT4;
    let index = max;
    while (index >= 0) {
      const step = this._collectWnafStep(index, len, naf, tmp);
      index = step.index;
      acc = acc.dblp(step.doubles);
      if (index < 0)
        break;
      acc = this._addWnafStep(acc, len, tmp, wnd);
      index--;
    }
    for (let i = 0;i < len; i++) {
      wnd[i] = [];
    }
    if (jacobianResult === true) {
      return acc;
    } else {
      return acc.toP();
    }
  }
  _endoWnafMulAdd(points, coeffs, jacobianResult) {
    const npoints = Array.from({ length: points.length * 2 });
    const ncoeffs = Array.from({ length: points.length * 2 });
    let i;
    for (i = 0;i < points.length; i++) {
      const split = this.curve._endoSplit(coeffs[i]);
      let p = points[i];
      let beta = p._getBeta() ?? new Point(null, null);
      if (split.k1.negative !== 0) {
        split.k1.ineg();
        p = p.neg(true);
      }
      if (split.k2.negative !== 0) {
        split.k2.ineg();
        beta = beta.neg(true);
      }
      npoints[i * 2] = p;
      npoints[i * 2 + 1] = beta;
      ncoeffs[i * 2] = split.k1;
      ncoeffs[i * 2 + 1] = split.k2;
    }
    const res = this._wnafMulAdd(1, npoints, ncoeffs, i * 2, jacobianResult);
    for (let j = 0;j < i * 2; j++) {
      npoints[j] = null;
      ncoeffs[j] = null;
    }
    return res;
  }
  _hasDoubles(k) {
    if (this.precomputed == null) {
      return false;
    }
    const doubles = this.precomputed.doubles;
    if (typeof doubles !== "object") {
      return false;
    }
    return doubles.points.length >= Math.ceil((k.bitLength() + 1) / doubles.step);
  }
  _getDoubles(step, power) {
    if (typeof this.precomputed === "object" && this.precomputed !== null && typeof this.precomputed.doubles === "object" && this.precomputed.doubles !== null) {
      return this.precomputed.doubles;
    }
    const doubles = [this];
    let acc;
    for (let i = 0;i < (power ?? 0); i += step ?? 1) {
      for (let j = 0;j < (step ?? 1); j++) {
        acc = (acc ?? this).dbl();
      }
      doubles.push(acc);
    }
    return {
      step: step ?? 1,
      points: doubles
    };
  }
  _getNAFPoints(wnd) {
    if (typeof this.precomputed === "object" && this.precomputed !== null && typeof this.precomputed.naf === "object" && this.precomputed.naf !== null) {
      return this.precomputed.naf;
    }
    const res = [this];
    const max = (1 << wnd) - 1;
    const dbl = max === 1 ? null : this.dbl();
    for (let i = 1;i < max; i++) {
      if (dbl !== null) {
        res[i] = res[i - 1].add(dbl);
      }
    }
    return {
      wnd,
      points: res
    };
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/PublicKey.js
class PublicKey extends Point {
  static fromPrivateKey(key) {
    const c = new Curve;
    const p = c.g.mul(key);
    return new PublicKey(p.x, p.y);
  }
  static fromString(str) {
    const p = Point.fromString(str);
    return new PublicKey(p.x, p.y);
  }
  static fromDER(bytes) {
    const p = Point.fromDER(bytes);
    return new PublicKey(p.x, p.y);
  }
  constructor(x, y = null, isRed = true) {
    if (x instanceof Point) {
      super(x.getX(), x.getY());
    } else {
      if (y === null && isRed && typeof x === "string") {
        if (x.length === 66 || x.length === 130) {
          throw new Error('You are using the "new PublicKey()" constructor with a DER hex string. You need to use "PublicKey.fromString()" instead.');
        }
      }
      super(x, y, isRed);
    }
  }
  deriveSharedSecret(priv) {
    if (!this.validate()) {
      throw new Error("Public key not valid for ECDH secret derivation");
    }
    return this.mulCT(priv);
  }
  verify(msg, sig, enc) {
    const msgHash = new BigNumber(sha256(msg, enc), 16);
    return verify(msgHash, sig, this);
  }
  toDER(enc) {
    if (enc === "hex")
      return this.encode(true, enc);
    return this.encode(true);
  }
  toHash(enc) {
    const pkh = hash160(this.encode(true));
    if (enc === "hex") {
      return toHex(pkh);
    }
    return pkh;
  }
  toAddress(prefix = [0]) {
    if (typeof prefix === "string") {
      if (prefix === "testnet" || prefix === "test") {
        prefix = [111];
      } else if (prefix === "mainnet" || prefix === "main") {
        prefix = [0];
      } else {
        throw new Error(`Invalid prefix ${prefix}`);
      }
    }
    return toBase58Check(this.toHash(), prefix);
  }
  deriveChild(privateKey, invoiceNumber, cacheSharedSecret, retrieveCachedSharedSecret) {
    let sharedSecret;
    if (typeof retrieveCachedSharedSecret === "function") {
      const retrieved = retrieveCachedSharedSecret(privateKey, this);
      if (retrieved === undefined) {
        sharedSecret = this.deriveSharedSecret(privateKey);
        if (typeof cacheSharedSecret === "function") {
          cacheSharedSecret(privateKey, this, sharedSecret);
        }
      } else {
        sharedSecret = retrieved;
      }
    } else {
      sharedSecret = this.deriveSharedSecret(privateKey);
    }
    const invoiceNumberBin = toArray2(invoiceNumber, "utf8");
    const hmac = sha256hmac(sharedSecret.encode(true), invoiceNumberBin);
    const curve = new Curve;
    const point = curve.g.mul(new BigNumber(hmac));
    const finalPoint = this.add(point);
    return new PublicKey(finalPoint.x, finalPoint.y);
  }
  static fromMsgHashAndCompactSignature(msgHash, signature, enc) {
    const data = toArray2(signature, enc);
    if (data.length !== 65) {
      throw new Error("Invalid Compact Signature");
    }
    const compactByte = data[0];
    if (compactByte < 27 || compactByte >= 35) {
      throw new Error("Invalid Compact Byte");
    }
    let r = data[0] - 27;
    if (r > 3) {
      r -= 4;
    }
    const s = new Signature(new BigNumber(data.slice(1, 33)), new BigNumber(data.slice(33, 65)));
    return s.RecoverPublicKey(r, msgHash);
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/Signature.js
class Signature {
  r;
  s;
  static fromDER(data, enc) {
    const getLength = (buf, p) => {
      const initial = buf[p.place++];
      if ((initial & 128) === 0) {
        return initial;
      } else {
        throw new Error("Invalid DER entity length");
      }
    };

    class Position {
      place = 0;
    }
    data = toArray2(data, enc);
    const p = new Position;
    if (data[p.place++] !== 48) {
      throw new Error("Signature DER must start with 0x30");
    }
    const len = getLength(data, p);
    if (len + p.place !== data.length) {
      throw new Error("Signature DER invalid");
    }
    if (data[p.place++] !== 2) {
      throw new Error("Signature DER invalid");
    }
    const rlen = getLength(data, p);
    let r = data.slice(p.place, rlen + p.place);
    p.place += rlen;
    if (data[p.place++] !== 2) {
      throw new Error("Signature DER invalid");
    }
    const slen = getLength(data, p);
    if (data.length !== slen + p.place) {
      throw new Error("Invalid R-length in signature DER");
    }
    let s = data.slice(p.place, slen + p.place);
    if (r[0] === 0) {
      if ((r[1] & 128) === 0) {
        throw new Error("Invalid R-value in signature DER");
      } else {
        r = r.slice(1);
      }
    }
    if (s[0] === 0) {
      if ((s[1] & 128) === 0) {
        throw new Error("Invalid S-value in signature DER");
      } else {
        s = s.slice(1);
      }
    }
    return new Signature(new BigNumber(r), new BigNumber(s));
  }
  static fromCompact(data, enc) {
    data = toArray2(data, enc);
    if (data.length !== 65) {
      throw new Error("Invalid Compact Signature");
    }
    const compactByte = data[0];
    if (compactByte < 27 || compactByte >= 35) {
      throw new Error("Invalid Compact Byte");
    }
    return new Signature(new BigNumber(data.slice(1, 33)), new BigNumber(data.slice(33, 65)));
  }
  constructor(r, s) {
    this.r = r;
    this.s = s;
  }
  verify(msg, key, enc) {
    const msgHash = new BigNumber(sha256(msg, enc), 16);
    return verify(msgHash, this, key);
  }
  toString(enc) {
    return this.toDER(enc);
  }
  toDER(enc) {
    const constructLength = (arr, len) => {
      if (len < 128) {
        arr.push(len);
      } else {
        throw new Error("len must be < 0x80");
      }
    };
    const rmPadding = (buf) => {
      let i = 0;
      const len = buf.length - 1;
      while (buf[i] === 0 && (buf[i + 1] & 128) === 0 && i < len) {
        i++;
      }
      if (i === 0) {
        return buf;
      }
      return buf.slice(i);
    };
    let r = this.r.toArray();
    let s = this.s.toArray();
    if ((r[0] & 128) !== 0) {
      r = [0].concat(r);
    }
    if ((s[0] & 128) !== 0) {
      s = [0].concat(s);
    }
    r = rmPadding(r);
    s = rmPadding(s);
    while (s[0] === 0 && (s[1] & 128) === 0) {
      s = s.slice(1);
    }
    let arr = [2];
    constructLength(arr, r.length);
    arr = arr.concat(r);
    arr.push(2);
    constructLength(arr, s.length);
    const backHalf = arr.concat(s);
    let res = [48];
    constructLength(res, backHalf.length);
    res = res.concat(backHalf);
    if (enc === "hex") {
      return toHex(res);
    } else if (enc === "base64") {
      return toBase64(res);
    } else {
      return res;
    }
  }
  toCompact(recovery, compressed, enc) {
    if (recovery < 0 || recovery > 3)
      throw new Error("Invalid recovery param");
    if (typeof compressed !== "boolean") {
      throw new TypeError("Invalid compressed param");
    }
    let compactByte = 27 + recovery;
    if (compressed) {
      compactByte += 4;
    }
    let arr = [compactByte];
    arr = arr.concat(this.r.toArray("be", 32));
    arr = arr.concat(this.s.toArray("be", 32));
    if (enc === "hex") {
      return toHex(arr);
    } else if (enc === "base64") {
      return toBase64(arr);
    } else {
      return arr;
    }
  }
  RecoverPublicKey(recovery, e) {
    const r = this.r;
    const s = this.s;
    const isYOdd = (recovery & 1) !== 0;
    const isSecondKey = recovery >> 1;
    const curve = new Curve;
    const n = curve.n;
    const G = curve.g;
    const x = isSecondKey === 0 ? r : r.add(n);
    const R = Point.fromX(x, isYOdd);
    const nR = R.mul(n);
    if (!nR.isInfinity()) {
      throw new Error("nR is not at infinity");
    }
    const eNeg = e.neg().umod(n);
    const rInv = r.invm(n);
    const srInv = rInv.mul(s).umod(n);
    const eInvrInv = rInv.mul(eNeg).umod(n);
    const Q = G.mul(eInvrInv).add(R.mul(srInv));
    const pubKey = new PublicKey(Q);
    pubKey.validate();
    return pubKey;
  }
  CalculateRecoveryFactor(pubkey, msgHash) {
    for (let recovery = 0;recovery < 4; recovery++) {
      let Qprime;
      try {
        Qprime = this.RecoverPublicKey(recovery, msgHash);
      } catch {
        continue;
      }
      if (pubkey.eq(Qprime)) {
        return recovery;
      }
    }
    throw new Error("Unable to find valid recovery factor");
  }
}

// node_modules/@bsv/sdk/dist/esm/src/primitives/ECDSA.js
function bnToBigInt(bn) {
  const bytes = bn.toArray("be");
  let x = 0n;
  for (const byte of bytes) {
    x = x << 8n | BigInt(byte);
  }
  return x;
}
var curve = new Curve;
var bytes = curve.n.byteLength();
var ns1 = curve.n.subn(1);
var halfN = N_BIGINT >> 1n;
var verify = (msg, sig, key) => {
  const nBitLength = curve.n.bitLength();
  if (msg.bitLength() > nBitLength) {
    return false;
  }
  const hash = bnToBigInt(msg);
  if (key.x == null || key.y == null) {
    throw new Error("Invalid public key: missing coordinates.");
  }
  const publicKey = {
    x: bnToBigInt(key.x),
    y: bnToBigInt(key.y)
  };
  const signature = {
    r: bnToBigInt(sig.r),
    s: bnToBigInt(sig.s)
  };
  const { r, s } = signature;
  const z = hash;
  if (r <= BI_ZERO || r >= N_BIGINT || s <= BI_ZERO || s >= N_BIGINT) {
    return false;
  }
  const w = modInvN(s);
  if (w === 0n)
    return false;
  const u1 = modMulN(z, w);
  const u2 = modMulN(r, w);
  const RG = scalarMultiplyWNAF(u1, { x: GX_BIGINT, y: GY_BIGINT });
  const RQ = scalarMultiplyWNAF(u2, publicKey);
  const R = jpAdd(RG, RQ);
  if (R.Z === 0n)
    return false;
  const zInv = biModInv(R.Z);
  const zInv2 = biModMul(zInv, zInv);
  const xAff = biModMul(R.X, zInv2);
  const v = modN(xAff);
  return v === r;
};
// utils/externalWalletConfig.ts
var EXTERNAL_WALLET_CONTEXT = Symbol.for("bsv-mcp.external-wallet-context");
function readExternalWalletConfig(env = process.env) {
  const raw = env.BRC100_WALLET_URL;
  if (raw === undefined) {
    if ([
      "BRC100_WALLET_ORIGINATOR",
      "BRC100_WALLET_PUBLIC_KEY",
      "BRC100_WALLET_ROLES"
    ].some((name) => env[name] !== undefined)) {
      throw new Error("External wallet configuration requires BRC100_WALLET_URL");
    }
    return;
  }
  for (const name of ["PRIVATE_KEY_WIF", "IDENTITY_KEY_WIF"]) {
    if (env[name] !== undefined) {
      throw new Error(`BRC100_WALLET_URL conflicts with ${name}; select one wallet identity`);
    }
  }
  if (env.USE_DROPLIT_API === "true") {
    throw new Error("BRC100_WALLET_URL conflicts with USE_DROPLIT_API");
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("BRC100_WALLET_URL must be a valid signer RPC URL");
  }
  const loopback = url.hostname === "localhost" || url.hostname === "[::1]" || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(url.hostname);
  if (!raw || raw !== raw.trim() || /[\\\s@?]/.test(raw) || url.username || url.password || raw.includes("#") || url.search || !(url.protocol === "https:" || url.protocol === "http:" && loopback)) {
    throw new Error("BRC100_WALLET_URL requires HTTPS or HTTP loopback, without credentials, queries or fragments");
  }
  const projectRoot = env.BSV_MCP_PROJECT_ROOT;
  const projectId = env.BSV_MCP_PROJECT_ID;
  let projectOrigin;
  if (projectRoot !== undefined || projectId !== undefined) {
    if (!projectRoot || !isAbsolute(projectRoot) || !projectId || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(projectId))
      throw new Error("External project wallets require an absolute BSV_MCP_PROJECT_ROOT and valid BSV_MCP_PROJECT_ID together");
    projectOrigin = `project-${createHash("sha256").update(JSON.stringify([resolve(projectRoot), projectId])).digest("hex").slice(0, 32)}.bsv-mcp.local`;
  }
  const originator = env.BRC100_WALLET_ORIGINATOR ?? projectOrigin ?? "bsv-mcp.local";
  let origin;
  try {
    origin = new URL(originator.includes("://") ? originator : `http://${originator}`);
  } catch {
    throw new Error("BRC100_WALLET_ORIGINATOR must be a domain or HTTP(S) origin");
  }
  if (!originator || /[\s\\]/.test(originator) || originator.length >= 250 || !["http:", "https:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || /[#?@]/.test(originator) || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|\[::1\])$/i.test(origin.hostname) || origin.hostname.toLowerCase() === "admin.bsv-mcp.internal") {
    throw new Error("BRC100_WALLET_ORIGINATOR must be a non-admin domain or HTTP(S) origin without credentials, path, query or fragment");
  }
  const config = {
    url: url.toString().replace(/\/$/, ""),
    originator
  };
  if (env.BRC100_WALLET_PUBLIC_KEY !== undefined) {
    const pin = env.BRC100_WALLET_PUBLIC_KEY;
    if (!/^0[23][0-9a-f]{64}$/i.test(pin))
      throw new Error("BRC100_WALLET_PUBLIC_KEY must be a compressed public key");
    config.expectedPublicKey = PublicKey.fromString(pin).toString();
  }
  if (env.BRC100_WALLET_ROLES !== undefined) {
    const role = object({
      url: string2(),
      originator: string2().optional(),
      expectedPublicKey: string2().optional()
    }).strict().nullable().optional();
    const parsed = object({
      payments: role,
      identity: role,
      ordinals: role,
      encryption: role
    }).strict().parse(JSON.parse(env.BRC100_WALLET_ROLES));
    config.roles = {};
    for (const name of [
      "payments",
      "identity",
      "ordinals",
      "encryption"
    ]) {
      const selected = parsed[name];
      config.roles[name] = selected ? readExternalWalletConfig({
        BRC100_WALLET_URL: selected.url,
        BRC100_WALLET_ORIGINATOR: selected.originator ?? originator,
        BRC100_WALLET_PUBLIC_KEY: selected.expectedPublicKey
      }) : null;
    }
    if (!Object.values(config.roles).some(Boolean))
      throw new Error("Assign at least one external wallet role");
  }
  return config;
}

// scripts/local-mcp-launcher.ts
var SAFE_INHERITED_ENV = [
  "PATH",
  "USER",
  "LOGNAME",
  "SHELL",
  "TERM",
  "LANG",
  "LC_ALL",
  "TZ",
  "MCP_TOOL_CATALOG"
];
var CONFLICTING_WALLET_ENV = [
  "BRC100_WALLET_URL",
  "BRC100_WALLET_ORIGINATOR",
  "BRC100_WALLET_PUBLIC_KEY",
  "BRC100_WALLET_ROLES",
  "PRIVATE_KEY_WIF",
  "IDENTITY_KEY_WIF",
  "BSV_MCP_ACCOUNT",
  "BSV_MCP_PASSWORD",
  "BSV_MCP_PASSPHRASE",
  "USE_DROPLIT_API",
  "REMOTE_STORAGE_URL",
  "BSV_CHAIN",
  "VAULT_PATH"
];
var PROJECT_CONFIG_ENV = [
  "BSV_MCP_PROJECT_ROOT",
  "BSV_MCP_PROJECT_ID"
];
var PROJECT_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
var REPO_ROOT = resolve2(dirname(fileURLToPath(import.meta.url)), "..");
var DEFAULT_SERVER_BINARY = resolve2(REPO_ROOT, "dist/index.js");
var FORWARDED_SIGNALS = ["SIGINT", "SIGTERM"];
function canonicalPath(path) {
  let candidate = resolve2(path);
  const tail = [];
  while (!existsSync2(candidate)) {
    const parent = dirname(candidate);
    if (parent === candidate)
      return candidate;
    tail.unshift(basename(candidate));
    candidate = parent;
  }
  return resolve2(realpathSync(candidate), ...tail);
}
function isInside(parent, child) {
  const path = relative(canonicalPath(parent), canonicalPath(child));
  return path === "" || !path.startsWith("..") && !isAbsolute2(path);
}
function assertCleanWorkingDirectory(directory) {
  const resolved = resolve2(directory);
  if (isInside(REPO_ROOT, resolved))
    throw new Error("Launcher working directory must be outside the BSV MCP checkout");
  return resolved;
}
function regularFileExists(file) {
  try {
    regularPath(file);
    return existsSync2(file);
  } catch (error) {
    if (error.code === "ENOENT")
      return false;
    throw error;
  }
}
function inspectEmbeddedAccount(name, homeDirectory = homedir2()) {
  const parsed = accountNameSchema.safeParse(name);
  if (!parsed.success)
    throw new Error("Invalid BSV_MCP_ACCOUNT; use lowercase letters, digits, underscores or hyphens");
  const accountsRoot = join2(resolve2(homeDirectory), ".bsv-mcp", "accounts");
  const directory = accountDir(name, accountsRoot);
  const missing = [];
  let config;
  try {
    config = readAccount(name, accountsRoot);
  } catch {
    missing.push("a valid config.json");
  }
  if (!config && !missing.includes("a valid config.json"))
    missing.push("config.json");
  if (!regularFileExists(join2(directory, "keys.bep")))
    missing.push("encrypted keys.bep");
  return { name, eligible: missing.length === 0, missing };
}
function safeInheritedEnvironment(baseEnv, homeDirectory) {
  const env = {};
  for (const name of SAFE_INHERITED_ENV) {
    const value = baseEnv[name];
    if (value !== undefined)
      env[name] = value;
  }
  for (const name of CONFLICTING_WALLET_ENV)
    delete env[name];
  for (const name of PROJECT_CONFIG_ENV)
    delete env[name];
  const pathValue = env.PATH ?? "/usr/bin:/bin";
  env.PATH = pathValue;
  env.HOME = resolve2(homeDirectory);
  env.TMPDIR = tmpdir();
  env.TMP = env.TMPDIR;
  env.TEMP = env.TMPDIR;
  env.NO_COLOR = "1";
  env.TRANSPORT = "stdio";
  return env;
}
function requireNonEmpty(value, message) {
  if (!value?.trim())
    throw new Error(message);
  return value;
}
function resolveProjectConfig(options) {
  const hasRoot = options.projectRoot !== undefined;
  const hasId = options.projectId !== undefined;
  if (hasRoot !== hasId)
    throw new Error("BSV_MCP_PROJECT_ROOT and BSV_MCP_PROJECT_ID must be configured together");
  if (!hasRoot || !hasId)
    return;
  const projectRoot = options.projectRoot;
  const projectId = options.projectId;
  if (!isAbsolute2(projectRoot))
    throw new Error("BSV_MCP_PROJECT_ROOT must be an absolute path");
  if (!projectId || !PROJECT_ID_PATTERN.test(projectId))
    throw new Error("BSV_MCP_PROJECT_ID must match the project role identifier format");
  let info;
  try {
    info = lstatSync2(projectRoot);
  } catch (error) {
    if (error.code === "ENOENT")
      throw new Error("BSV_MCP_PROJECT_ROOT must be an existing directory");
    throw error;
  }
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("BSV_MCP_PROJECT_ROOT must be an existing real directory");
  return { projectRoot: realpathSync(projectRoot), projectId };
}
function buildLaunchPlan(options, baseEnv = process.env) {
  if (options.mode !== "external" && options.mode !== "embedded" && options.mode !== "project")
    throw new Error("Launcher mode must be external, embedded, or project");
  const serverBinary = resolve2(options.serverBinary ?? DEFAULT_SERVER_BINARY);
  if (!existsSync2(serverBinary))
    throw new Error("Canonical BSV MCP binary was not found at the configured path");
  const cwd = assertCleanWorkingDirectory(options.workingDirectory ?? join2(tmpdir(), `bsv-mcp-local-${options.mode}`));
  const bunExecutable = resolve2(options.bunExecutable ?? process.execPath);
  const homeDirectory = options.mode === "embedded" || options.mode === "project" ? resolve2(options.homeDirectory ?? homedir2()) : resolve2(options.homeDirectory ?? join2(tmpdir(), "bsv-mcp-local-external-home"));
  const env = safeInheritedEnvironment(baseEnv, homeDirectory);
  env.DISABLE_BROADCASTING = options.disableBroadcasting ?? baseEnv.DISABLE_BROADCASTING !== "false" ? "true" : "false";
  const project = resolveProjectConfig(options);
  if (project && options.mode === "embedded")
    throw new Error("Project selectors require project or external launcher mode");
  if (project) {
    env.BSV_MCP_PROJECT_ROOT = project.projectRoot;
    env.BSV_MCP_PROJECT_ID = project.projectId;
  }
  if (options.mode === "project") {
    if (!project)
      throw new Error("Project mode requires paired --project-root and --project-id flags");
    const password = requireNonEmpty(options.runtimePassword ?? baseEnv.BSV_MCP_PASSWORD, "Project mode requires BSV_MCP_PASSWORD at launcher runtime; do not pass it as an argument or store it in MCP config");
    env.BSV_MCP_PASSWORD = password;
    const vaultPath = options.vaultPath ?? baseEnv.VAULT_PATH;
    if (vaultPath !== undefined)
      env.VAULT_PATH = vaultPath;
  } else if (options.mode === "external") {
    const url = requireNonEmpty(options.externalWalletUrl ?? baseEnv.BRC100_WALLET_URL, "External mode requires BRC100_WALLET_URL in the launcher's runtime environment");
    const originator = options.externalOriginator ?? baseEnv.BRC100_WALLET_ORIGINATOR;
    const config = readExternalWalletConfig({
      ...env,
      BRC100_WALLET_URL: url,
      BRC100_WALLET_ORIGINATOR: originator,
      BRC100_WALLET_PUBLIC_KEY: options.externalPublicKey ?? baseEnv.BRC100_WALLET_PUBLIC_KEY,
      BRC100_WALLET_ROLES: options.externalRoles ?? baseEnv.BRC100_WALLET_ROLES
    });
    if (!config)
      throw new Error("External signer configuration is missing");
    env.BRC100_WALLET_URL = config.url;
    env.BRC100_WALLET_ORIGINATOR = config.originator;
    if (config.expectedPublicKey)
      env.BRC100_WALLET_PUBLIC_KEY = config.expectedPublicKey;
    if (config.roles)
      env.BRC100_WALLET_ROLES = JSON.stringify(config.roles);
    if (baseEnv.BSV_CHAIN !== undefined) {
      if (!["main", "test"].includes(baseEnv.BSV_CHAIN))
        throw new Error("BSV_CHAIN must be main or test");
      env.BSV_CHAIN = baseEnv.BSV_CHAIN;
    }
  } else {
    const name = options.accountName ?? baseEnv.BSV_MCP_ACCOUNT ?? "default";
    const home = resolve2(options.homeDirectory ?? homedir2());
    const readiness = inspectEmbeddedAccount(name, home);
    if (!readiness.eligible)
      throw new Error('Embedded account "' + name + '" is not ready; provide an existing encrypted account with ' + readiness.missing.join(" and ") + ". The launcher never creates or migrates accounts.");
    const password = requireNonEmpty(options.runtimePassword ?? baseEnv.BSV_MCP_PASSWORD, "Embedded mode requires BSV_MCP_PASSWORD at launcher runtime; do not pass it as an argument or store it in MCP config");
    env.BSV_MCP_ACCOUNT = name;
    env.BSV_MCP_PASSWORD = password;
  }
  return {
    mode: options.mode,
    command: bunExecutable,
    args: ["--no-env-file", serverBinary, "--stdio"],
    cwd,
    env,
    serverBinary,
    ...project ?? {}
  };
}
function ensureLaunchDirectories(plan) {
  mkdirSync2(plan.cwd, { recursive: true, mode: 448 });
  if (plan.mode === "external")
    mkdirSync2(plan.env.HOME, { recursive: true, mode: 448 });
}
function launch(plan) {
  ensureLaunchDirectories(plan);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      stdio: "inherit"
    });
    let settled = false;
    const forwardSignal = (signal) => {
      if (!child.killed)
        child.kill(signal);
    };
    const cleanup = () => {
      for (const signal of FORWARDED_SIGNALS)
        process.off(signal, forwardSignal);
    };
    const settle = (finish) => {
      if (settled)
        return;
      settled = true;
      cleanup();
      finish();
    };
    for (const signal of FORWARDED_SIGNALS)
      process.on(signal, forwardSignal);
    child.once("error", (error) => settle(() => reject(error)));
    child.once("exit", (code, signal) => {
      settle(() => {
        if (code !== null) {
          resolvePromise(code);
          return;
        }
        resolvePromise(signal ? 128 : 1);
      });
    });
  });
}
function usage() {
  return `Usage:
` + `  bun --no-env-file scripts/local-mcp-launcher.ts external
` + `  BSV_MCP_PASSWORD=... bun --no-env-file scripts/local-mcp-launcher.ts embedded
` + `  BSV_MCP_PASSWORD=... bun --no-env-file scripts/local-mcp-launcher.ts project --project-root /absolute/project --project-id id

` + `External mode reads BRC100_WALLET_URL and optional BRC100_WALLET_ORIGINATOR
` + `from the launcher's runtime environment. Embedded mode reads BSV_MCP_ACCOUNT
` + `and BSV_MCP_PASSWORD at runtime and requires an existing encrypted account.
` + `Project mode requires the paired --project-root and --project-id flags;
` + `the root is passed as BSV_MCP_PROJECT_ROOT and the ID as BSV_MCP_PROJECT_ID.
` + `Neither mode loads repository dotenv files. The password is never an argv value
` + "or printed by this launcher.";
}
function isLauncherEntryPoint() {
  const entry = process.argv[1];
  if (!entry)
    return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve2(entry));
  } catch {
    return false;
  }
}
function parseLauncherArguments(argv) {
  const mode = argv[0];
  if (mode !== "external" && mode !== "embedded" && mode !== "project")
    throw new Error("Launcher mode must be external, embedded, or project");
  let projectRoot;
  let projectId;
  let vaultPath;
  for (let index = 1;index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--project-root" || flag === "--project-id" || flag === "--vault-path") {
      const value = argv[++index];
      if (!value || value.startsWith("--"))
        throw new Error(`${flag} requires a value`);
      if (flag === "--project-root")
        projectRoot = value;
      else if (flag === "--project-id")
        projectId = value;
      else
        vaultPath = value;
      continue;
    }
    throw new Error(`Unknown launcher option: ${flag}`);
  }
  return {
    mode,
    projectRoot,
    projectId,
    ...vaultPath === undefined ? {} : { vaultPath }
  };
}
async function main() {
  const args = process.argv.slice(2);
  if (!args[0] || args[0] === "--help" || args[0] === "-h") {
    console.error(usage());
    return;
  }
  const plan = buildLaunchPlan(parseLauncherArguments(args));
  const exitCode = await launch(plan);
  process.exitCode = exitCode;
}
if (isLauncherEntryPoint()) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Local MCP launch failed");
    process.exitCode = 1;
  }
}
export {
  CONFLICTING_WALLET_ENV,
  PROJECT_CONFIG_ENV,
  buildLaunchPlan,
  inspectEmbeddedAccount,
  launch,
  parseLauncherArguments
};
