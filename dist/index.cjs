'use strict';

var vanilla = require('zustand/vanilla');
var middleware = require('zustand/middleware');
var React = require('react');
var jsxRuntime = require('react/jsx-runtime');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/core/path.ts
var DANGEROUS_KEYS = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function assertSafeKey(k) {
  if (DANGEROUS_KEYS.has(k)) throw new Error(`Unsafe key: ${k}`);
}
function parsePath(input) {
  if (Array.isArray(input)) return Array.from(input);
  const s = String(input);
  if (!s) return [];
  const out = [];
  let i = 0;
  const N = s.length;
  while (i < N) {
    let id = "";
    while (i < N) {
      const ch2 = s[i];
      if (ch2 === "." || ch2 === "[") break;
      id += ch2;
      i++;
    }
    if (id) {
      assertSafeKey(id);
      out.push(id);
    }
    if (i >= N) break;
    const ch = s[i];
    if (ch === ".") {
      i++;
      continue;
    }
    if (ch === "[") {
      i++;
      let num = "";
      while (i < N && s[i] !== "]") {
        num += s[i++];
      }
      if (i >= N) throw new Error("Unclosed bracket");
      i++;
      if (!/^\d+$/.test(num)) throw new Error(`Invalid index: ${num}`);
      const idx = Number(num);
      if (idx < 0 || !Number.isInteger(idx)) throw new Error(`Invalid index: ${num}`);
      out.push(idx);
      if (i < N && s[i] === ".") i++;
    }
  }
  return out;
}
function getAtPath(obj, path) {
  const parts = parsePath(path);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return void 0;
    cur = cur[p];
  }
  return cur;
}
function setAtPath(obj, path, value) {
  const parts = parsePath(path);
  if (parts.length === 0) return value;
  const rootIsArray = Array.isArray(obj);
  const root = rootIsArray ? obj.slice() : { ...obj ?? {} };
  let cur = root;
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    const isLast = i === parts.length - 1;
    if (typeof seg === "number") {
      const next = cur[seg];
      if (isLast) {
        cur[seg] = value;
      } else {
        const nxtSeg = parts[i + 1];
        const container = Array.isArray(next) || typeof nxtSeg === "number" ? Array.isArray(next) ? next.slice() : [] : { ...next ?? {} };
        cur[seg] = container;
        cur = container;
      }
    } else {
      assertSafeKey(seg);
      const next = cur[seg];
      if (isLast) {
        cur[seg] = value;
      } else {
        const nxtSeg = parts[i + 1];
        const container = Array.isArray(next) || typeof nxtSeg === "number" ? Array.isArray(next) ? next.slice() : [] : { ...next ?? {} };
        cur[seg] = container;
        cur = container;
      }
    }
  }
  return root;
}
function createBatcher(cfg = {}) {
  const max = cfg.max ?? 1e3;
  const useTrans = !!cfg.useTransition;
  let q = {};
  let order = [];
  let scheduled = false;
  const schedule = (run) => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (useTrans && typeof globalThis.startTransition === "function") {
        globalThis.startTransition(run);
      } else run();
    });
  };
  return {
    push(key, payload, flush) {
      if (!(key in q)) order.push(key);
      q[key] = payload;
      if (order.length > max) order.shift();
      schedule(() => {
        const keys = order;
        order = [];
        const payloads = q;
        q = {};
        for (const k of keys) flush(k, payloads[k]);
      });
    }
  };
}
function createFormStore(name, initial, devtools) {
  const base = {
    name: name || "rzf",
    __initial: initial,
    formState: { dirtyFields: {}, touchedFields: {}, errors: {} },
    resolverEpoch: 0
  };
  const withMw = (creator) => process.env.NODE_ENV !== "production" && devtools ? __require("zustand/middleware").devtools(middleware.subscribeWithSelector(creator), { name }) : middleware.subscribeWithSelector(creator);
  const storeImpl = vanilla.createStore(withMw(() => base));
  return {
    getState: storeImpl.getState,
    setState: (updater, _replace, action) => {
      const next = updater(storeImpl.getState());
      storeImpl.setState(next, true);
      if (storeImpl.setState.length >= 3 && action) {
        storeImpl.setState(next, true, action);
      }
    },
    subscribe: (fn) => storeImpl.subscribe(fn)
  };
}
var Ctx = React__default.default.createContext(null);
function useForm(opts) {
  const name = opts.name || "rzf";
  const storeRef = React__default.default.useRef();
  if (!storeRef.current) {
    storeRef.current = createFormStore(name, opts.defaultValues, !!opts.devtools);
  }
  const store = storeRef.current;
  const [formState, setFormState] = React__default.default.useState(store.getState().formState);
  React__default.default.useEffect(() => {
    const unsub = store.subscribe((s) => setFormState(s.formState));
    return () => unsub();
  }, [store]);
  const runResolverAndApply = React__default.default.useCallback(async (values) => {
    if (!opts.resolver) return;
    const token = ++store.getState().resolverEpoch;
    try {
      const result = await opts.resolver(values);
      if (token !== store.getState().resolverEpoch) return;
      const errors = result?.errors ?? {};
      store.setState((s) => ({ ...s, formState: { ...s.formState, errors } }), false, { type: `${name} resolver:ok` });
    } catch (err) {
      if (token !== store.getState().resolverEpoch) return;
      const errors = { _root: String(err?.message ?? err) };
      store.setState((s) => ({ ...s, formState: { ...s.formState, errors } }), false, { type: `${name} resolver:err` });
    }
  }, [name, opts.resolver, store]);
  const Provider = React__default.default.useCallback(({ children }) => {
    return /* @__PURE__ */ jsxRuntime.jsxs(Ctx.Provider, { value: store, children: [
      " ",
      children,
      " "
    ] });
  }, [store]);
  function register(path, ropts = {}) {
    const parts = parsePath(path);
    const def = getAtPath(opts.defaultValues, parts);
    if (ropts.uncontrolled) {
      return {
        name: path,
        defaultValue: def,
        ref: (el) => {
          if (!el) return;
          const st = store.getState();
          const refs = st.__domRefs ?? (st.__domRefs = {});
          refs[path] = { current: el };
        },
        onChange: (e) => {
          const now = e.currentTarget.value;
          const isDirty = String(now) !== String(def ?? "");
          store.setState((s) => ({ ...s, formState: { ...s.formState, dirtyFields: { ...s.formState.dirtyFields, [path]: isDirty } } }), false, { type: `${name} field:dirty` });
        },
        onBlur: () => {
          store.setState((s) => ({ ...s, formState: { ...s.formState, touchedFields: { ...s.formState.touchedFields, [path]: true } } }), false, { type: `${name} field:touched` });
        }
      };
    }
    return {
      name: path,
      value: getAtPath(store.getState().value ?? opts.defaultValues, parts) ?? "",
      onChange: (e) => {
        const v = e.currentTarget.value;
        let nextValLocal;
        store.setState((s) => {
          const prev = s.value ?? opts.defaultValues;
          const nextVal = setAtPath(prev, parts, v);
          nextValLocal = nextVal;
          const dirty = {
            ...s.formState.dirtyFields,
            [path]: String(v) !== String(def ?? "")
          };
          return { ...s, value: nextVal, formState: { ...s.formState, dirtyFields: dirty } };
        }, false, { type: `${name} field:set` });
        const enqueue = (cb) => typeof queueMicrotask === "function" ? queueMicrotask(cb) : Promise.resolve().then(cb);
        enqueue(() => runResolverAndApply(nextValLocal));
      },
      onBlur: () => {
        store.setState((s) => ({ ...s, formState: { ...s.formState, touchedFields: { ...s.formState.touchedFields, [path]: true } } }), false, { type: `${name} field:touched` });
      }
    };
  }
  const handleSubmit = (fn) => (e) => {
    e?.preventDefault?.();
    const st = store.getState();
    const refs = st.__domRefs ?? {};
    const fromDom = JSON.parse(JSON.stringify(opts.defaultValues));
    Object.keys(refs).forEach((p) => {
      const el = refs[p]?.current;
      if (!el) return;
      const parts = parsePath(p);
      getAtPath(fromDom, parts);
      const v = el.value;
      const next = setAtPath(fromDom, parts, v);
      Object.assign(fromDom, next);
    });
    fn(fromDom);
  };
  return { Provider, register, handleSubmit, formState, store };
}
function useFormStore() {
  const ctx = React__default.default.useContext(Ctx);
  if (!ctx) throw new Error("useFormStore must be used under Provider");
  return ctx;
}

exports.createBatcher = createBatcher;
exports.createFormStore = createFormStore;
exports.getAtPath = getAtPath;
exports.parsePath = parsePath;
exports.setAtPath = setAtPath;
exports.useForm = useForm;
exports.useFormStore = useFormStore;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map