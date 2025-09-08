'use strict';

// src/plugins/backend-sync.ts
function createBackendSync(store, opts = {}) {
  const coalesceMs = opts.coalesceMs ?? 16;
  const policy = opts.policy ?? "keepDirtyValues";
  let timer = null;
  let pending = {};
  let serverEpoch = 0;
  function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(() => {
      const snapshot = pending;
      pending = {};
      timer = null;
      serverEpoch++;
      store.setState((s) => ({ ...s, serverState: { ...s.serverState ?? {}, ...snapshot } }), false, { type: `${store.getState().name} server:flush(${serverEpoch})` });
      const st = store.getState();
      const dirty = st.formState?.dirtyFields ?? {};
      const refs = st.__domRefs ?? {};
      for (const p of Object.keys(snapshot)) {
        if (policy === "clientWins" || policy !== "serverWins" && dirty[p]) continue;
        const ref = refs[p];
        if (ref?.current && String(ref.current.value) !== String(snapshot[p])) {
          ref.current.value = String(snapshot[p] ?? "");
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