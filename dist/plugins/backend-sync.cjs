'use strict';

// src/plugins/backend-sync.ts
function createBackendSync(store, opts = {}) {
  var _a, _b;
  const coalesceMs = (_a = opts.coalesceMs) != null ? _a : 16;
  const policy = (_b = opts.policy) != null ? _b : "keepDirtyValues";
  let timer = null;
  let pending = {};
  let serverEpoch = 0;
  function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(() => {
      var _a2, _b2, _c, _d;
      const snapshot = pending;
      pending = {};
      timer = null;
      serverEpoch++;
      store.setState((s) => {
        var _a3;
        return { ...s, serverState: { ...(_a3 = s.serverState) != null ? _a3 : {}, ...snapshot } };
      }, false, { type: `${store.getState().name} server:flush(${serverEpoch})` });
      const st = store.getState();
      const dirty = (_b2 = (_a2 = st.formState) == null ? void 0 : _a2.dirtyFields) != null ? _b2 : {};
      const refs = (_c = st.__domRefs) != null ? _c : {};
      for (const p of Object.keys(snapshot)) {
        if (policy === "clientWins" || policy !== "serverWins" && dirty[p]) continue;
        const ref = refs[p];
        if ((ref == null ? void 0 : ref.current) && String(ref.current.value) !== String(snapshot[p])) {
          ref.current.value = String((_d = snapshot[p]) != null ? _d : "");
        }
      }
    }, coalesceMs);
  }
  return {
    pushServerPatch(patch) {
      Object.assign(pending, patch);
      scheduleFlush();
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = null;
      pending = {};
    }
  };
}

exports.createBackendSync = createBackendSync;
//# sourceMappingURL=backend-sync.cjs.map
//# sourceMappingURL=backend-sync.cjs.map