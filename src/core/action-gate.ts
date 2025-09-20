import type { EngineAction, KernelEngine } from '../kernel/engine';
import type { KernelActionSource } from '../kernel/types';

export interface ActionGate {
  applyPatches: (patches: Record<string, unknown>, source?: KernelActionSource) => void;
  updateField: (path: string, next: unknown, source?: KernelActionSource) => void;
  addRow: (rowKey: string, row: Record<string, unknown>, source?: KernelActionSource) => void;
  removeRow: (rowKey: string, source?: KernelActionSource) => void;
  renameRow: (oldKey: string, newKey: string, source?: KernelActionSource) => void;
}

export function createActionGate(engine: KernelEngine): ActionGate {
  const dispatch = (action: EngineAction) => {
    engine.dispatch(action);
  };

  return {
    applyPatches(patches, source) {
      if (!patches || Object.keys(patches).length === 0) return;
      dispatch({ type: 'apply-patches', patches, source });
    },
    updateField(path, next, source) {
      if (!path) return;
      dispatch({ type: 'update-field', path, next, source });
    },
    addRow(rowKey, row, source) {
      dispatch({ type: 'add-row', rowKey, row, source });
    },
    removeRow(rowKey, source) {
      dispatch({ type: 'remove-row', rowKey, source });
    },
    renameRow(oldKey, newKey, source) {
      dispatch({ type: 'rename-row', oldKey, newKey, source });
    }
  };
}
