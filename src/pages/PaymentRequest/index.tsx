// 付款申请主页面 - 重构版本
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { Banknote } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { useFilterState } from '@/hooks/useFilterState';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationLink, PaginationNext } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// 导入组件和hooks
import { PaymentRecordsTable } from './components/PaymentRecordsTable';
import { RecordDetailDialog } from './components/RecordDetailDialog';
import { PaymentPreviewDialog } from './components/PaymentPreviewDialog';
import { BulkActionButtons } from './components/BulkActionButtons';

import { usePaymentData } from './hooks/usePaymentData';
import { usePaymentSelection } from './hooks/usePaymentSelection';
import { usePaymentActions } from './hooks/usePaymentActions';

import type { LogisticsRecord, PaymentFilters, Partner } from '@/types/paymentRequest';
import { PaymentRequestFilterBar } from './components/PaymentRequestFilterBar';

const INITIAL_FILTERS: PaymentFilters = {
  waybillNumbers: '',
  driverName: '',
  licensePlate: '',
  driverPhone: '',
  projectId: 'all',
  partnerId: 'all',
  startDate: '',
  endDate: '',
  paymentStatus: 'Unpaid',
  otherPlatformName: ''
};

export default function PaymentRequest() {
  const { toast } = useToast();
  const { uiFilters, setUiFilters, activeFilters, handleSearch, handleClear, isStale } = useFilterState(INITIAL_FILTERS);
  
  const { reportData, loading, pagination, setPagination, fetchReportData } = usePaymentData();
  const { selection, handleToggleRecord, handleSelectAll, handleSelectAllFiltered, clearSelection } = usePaymentSelection();
  const { generatePaymentPreview, savePaymentRequests, isGenerating, isSaving } = usePaymentActions();

  const [sortField, setSortField] = useState('loading_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [finalData, setFinalData] = useState(null);
  const [allPartners, setAllPartners] = useState<Partner[]>([]);
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const { data: projectsData } = await supabase.from('projects').select('id, name').order('name');
        setProjects(projectsData || []);
        
        const { data: partnersData } = await supabase.from('project_partners').select(`partner_id, level, partners!inner(name)`);
        const uniquePartners = Array.from(new Map(partnersData?.map(p => [
          p.partner_id,
          { id: p.partner_id, name: (p.partners as any).name, level: p.level }
        ]) || []).values()).sort((a, b) => a.level - b.level);
        setAllPartners(uniquePartners);
      } catch (error) {
        toast({ title: '错误', description: '加载选项失败', variant: 'destructive' });
      }
    };
    loadOptions();
  }, [toast]);

  useEffect(() => {
    if (!isStale) {
      fetchReportData(activeFilters as any);
    }
  }, [activeFilters, isStale, fetchReportData, pagination.currentPage]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRecords = useMemo(() => {
    const records = reportData?.records || [];
    return [...records].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'loading_date':
          aVal = new Date(a.loading_date).getTime();
          bVal = new Date(b.loading_date).getTime();
          break;
        case 'auto_number':
          aVal = a.auto_number;
          bVal = b.auto_number;
          break;
        case 'driver_name':
          aVal = a.driver_name;
          bVal = b.driver_name;
          break;
        case 'payable_cost':
          aVal = a.payable_cost || 0;
          bVal = b.payable_cost || 0;
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
  }, [reportData?.records, sortField, sortDirection]);

  const displayedPartners = useMemo(() => {
    if (uiFilters.partnerId !== 'all') {
      const selected = allPartners.find(p => p.id === uiFilters.partnerId);
      return selected ? [selected] : [];
    }
    return allPartners.slice(0, 5);
  }, [uiFilters.partnerId, allPartners]);

  const handleApplyForPayment = async () => {
    const records = selection.mode === 'all_filtered' ? (reportData?.records || []) : 
      sortedRecords.filter(r => selection.selectedIds.has(r.id));
    
    const preview = await generatePaymentPreview(records);
    if (preview) {
      setPreviewData(preview as any);
      setFinalData({ sheets: preview.sheets, all_record_ids: preview.processed_record_ids } as any);
      setIsPreviewOpen(true);
    }
  };

  const handleConfirmPayment = async () => {
    if (!finalData) return;
    const success = await savePaymentRequests(finalData);
    if (success) {
      setIsPreviewOpen(false);
      clearSelection();
      fetchReportData(activeFilters as any);
    }
  };

  const selectedCount = selection.mode === 'all_filtered' ? (reportData?.count || 0) : selection.selectedIds.size;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="合作方付款申请"
        description="向合作方申请支付运费"
        icon={Banknote}
        iconColor="text-green-600"
      />

      <PaymentRequestFilterBar
        filters={uiFilters}
        projects={projects}
        partners={allPartners}
        onFilterChange={(key, value) => setUiFilters(prev => ({ ...prev, [key]: value }))}
        onSearch={handleSearch}
        onClear={handleClear}
      />

      {isStale && (
        <div className="text-center py-10 border rounded-lg bg-muted/20">
          <h3 className="text-sm font-semibold">筛选条件已更改</h3>
          <p className="text-sm text-muted-foreground">请点击"搜索"按钮查看结果</p>
        </div>
      )}

      {!isStale && (
        <>
          <BulkActionButtons
            selectedCount={selectedCount}
            selectionMode={selection.mode}
            totalRecords={reportData?.count || 0}
            onApplyForPayment={handleApplyForPayment}
            isGenerating={isGenerating}
          />

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <PaymentRecordsTable
                  records={sortedRecords}
                  partners={displayedPartners}
                  selection={selection}
                  onToggleRecord={handleToggleRecord}
                  onSelectAll={handleSelectAll}
                  onSelectAllFiltered={handleSelectAllFiltered}
                  onRecordClick={setViewingRecord}
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  overview={reportData?.overview}
                  partnerTotals={reportData?.partners || []}
                  totalRecords={reportData?.count || 0}
                />
              )}

              <div className="p-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                        className={cn(pagination.currentPage <= 1 && 'pointer-events-none opacity-50')}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => i + 1).map(page => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setPagination(prev => ({ ...prev, currentPage: page }))}
                          isActive={pagination.currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(pagination.totalPages, prev.currentPage + 1) }))}
                        className={cn(pagination.currentPage >= pagination.totalPages && 'pointer-events-none opacity-50')}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <RecordDetailDialog
        open={!!viewingRecord}
        onOpenChange={(open) => !open && setViewingRecord(null)}
        record={viewingRecord}
      />

      <PaymentPreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        previewData={previewData}
        onConfirm={handleConfirmPayment}
        isSaving={isSaving}
      />
    </div>
  );
}

