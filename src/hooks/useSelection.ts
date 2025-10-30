// 通用选择状态管理Hook
import { useState, useCallback } from 'react';

export interface SelectionState {
  mode: 'none' | 'all_filtered';
  selectedIds: Set<string>;
}

export function useSelection() {
  const [selection, setSelection] = useState<SelectionState>({
    mode: 'none',
    selectedIds: new Set()
  });

  const handleToggle = useCallback((id: string) => {
    setSelection(prev => {
      const newIds = new Set(prev.selectedIds);
      if (newIds.has(id)) {
        newIds.delete(id);
      } else {
        newIds.add(id);
      }
      return {
        mode: newIds.size > 0 ? prev.mode : 'none',
        selectedIds: newIds
      };
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelection(prev => ({
      mode: prev.mode === 'all_filtered' ? 'none' : 'all_filtered',
      selectedIds: new Set()
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelection({ mode: 'none', selectedIds: new Set() });
  }, []);

  return { selection, handleToggle, handleSelectAll, clearSelection, setSelection };
}

