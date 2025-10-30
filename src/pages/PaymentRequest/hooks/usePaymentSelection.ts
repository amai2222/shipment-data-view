// 付款申请选择状态Hook（与开票申请完全相同）
import { useState, useCallback } from 'react';
import type { SelectionState } from '@/types/paymentRequest';

export function usePaymentSelection() {
  const [selection, setSelection] = useState<SelectionState>({
    mode: 'none',
    selectedIds: new Set()
  });

  const handleToggleRecord = useCallback((recordId: string) => {
    setSelection(prev => {
      const newSelectedIds = new Set(prev.selectedIds);
      if (newSelectedIds.has(recordId)) {
        newSelectedIds.delete(recordId);
      } else {
        newSelectedIds.add(recordId);
      }
      
      return {
        mode: newSelectedIds.size > 0 ? 'current_page' : 'none',
        selectedIds: newSelectedIds
      };
    });
  }, []);

  const handleSelectAll = useCallback((recordIds: string[]) => {
    setSelection(prev => {
      const allSelected = recordIds.every(id => prev.selectedIds.has(id));
      
      if (allSelected) {
        return { mode: 'none', selectedIds: new Set() };
      } else {
        return { mode: 'current_page', selectedIds: new Set(recordIds) };
      }
    });
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelection({ mode: 'all_filtered', selectedIds: new Set() });
  }, []);

  const clearSelection = useCallback(() => {
    setSelection({ mode: 'none', selectedIds: new Set() });
  }, []);

  return {
    selection,
    handleToggleRecord,
    handleSelectAll,
    handleSelectAllFiltered,
    clearSelection
  };
}

