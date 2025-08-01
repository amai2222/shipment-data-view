// --- 文件: src/pages/BusinessEntry.tsx (已全面修正依赖项) ---

import { useState, useEffect, useMemo, useCallback } from "react"; // 引入 useCallback
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getColumns } from "@/components/columns";
import { ShipmentTable } from "@/components/ShipmentTable";
import { AddShipmentDialog } from "@/components/AddShipmentDialog";
import { EditShipmentDialog } from "@/components/EditShipmentDialog";
import { ConfirmationDialog } from "@/components/ConfirmationDialog";
import { ShipmentDetailSheet } from "@/components/ShipmentDetailSheet";
import { PlusCircle, ChevronsUpDown, Upload, Download, Trash2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LogisticsRecord, FullShipmentDetails } from "@/types";
import { getMockData, getMockFullShipmentDetails } from '@/data/mockData';
import { downloadImportTemplate, exportDataToExcel } from "@/lib/excelUtils";
import { RowSelectionState } from "@tanstack/react-table";
import { ImportDataDialog } from "@/components/ImportDataDialog";

export default function BusinessEntryPage() {
  // =================================================================
  // 1. 状态管理中心 (State Hub)
  // =================================================================
  const [shipments, setShipments] = useState<LogisticsRecord[]>([]);
  const [filterText, setFilterText] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [editingShipment, setEditingShipment] = useState<LogisticsRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedShipmentDetails, setSelectedShipmentDetails] = useState<FullShipmentDetails | null>(null);

  // =================================================================
  // 2. 数据处理与派生 (Data Processing & Derived State)
  // =================================================================
  useEffect(() => {
    const data = getMockData(50);
    setShipments(data);
  }, []);

  const filteredData = useMemo(() => {
    if (!filterText) return shipments;
    return shipments.filter(s => 
      s.project_name.toLowerCase().includes(filterText.toLowerCase()) ||
      s.license_plate.toLowerCase().includes(filterText.toLowerCase()) ||
      s.driver_name.toLowerCase().includes(filterText.toLowerCase())
    );
  }, [shipments, filterText]);

  const selectedRowCount = Object.keys(rowSelection).length;

  // =================================================================
  // 3. 核心业务逻辑处理 (使用 useCallback 优化)
  // =================================================================

  const handleSaveShipment = useCallback((newData: Partial<LogisticsRecord>) => {
    const newRecord: LogisticsRecord = {
        id: `SHIP_${Date.now()}`,
        transport_type: '公路',
        loading_date: new Date().toISOString(),
        loading_location: '仓库A',
        unloading_location: '客户B',
        created_at: new Date().toISOString(),
        ...newData,
    } as LogisticsRecord;
    setShipments(prev => [newRecord, ...prev]);
    setIsAddDialogOpen(false);
  }, []);
  
  const handleConfirmImport = useCallback((importedData: Partial<LogisticsRecord>[]) => {
    const newRecords = importedData.map(item => ({
        id: `SHIP_${Date.now()}_${Math.random()}`,
        transport_type: '公路',
        loading_date: new Date().toISOString(),
        loading_location: '仓库A',
        unloading_location: '客户B',
        created_at: new Date().toISOString(),
        ...item
    })) as LogisticsRecord[];
    setShipments(prev => [...newRecords, ...prev]);
    setIsImportDialogOpen(false);
  }, []);

  const handleUpdateShipment = useCallback((updatedShipment: LogisticsRecord) => {
    setShipments(prev => prev.map(s => s.id === updatedShipment.id ? updatedShipment : s));
    setIsEditDialogOpen(false);
    setEditingShipment(null);
  }, []);

  const handleDelete = useCallback(() => {
    if (deletingId) {
        setShipments(prev => prev.filter(s => s.id !== deletingId));
    }
    else if (selectedRowCount > 0) {
        const selectedIds = Object.keys(rowSelection);
        setShipments(prev => prev.filter(s => !selectedIds.includes(s.id)));
        setRowSelection({});
    }
    setIsConfirmDeleteDialogOpen(false);
    setDeletingId(null);
  }, [deletingId, rowSelection, selectedRowCount]);
  
  const openDeleteConfirmation = useCallback((id?: string) => {
    if (id) setDeletingId(id);
    else setDeletingId(null);
    setIsConfirmDeleteDialogOpen(true);
  }, []);
  
  const handleViewDetails = useCallback(async (shipment: LogisticsRecord) => {
    setIsDetailSheetOpen(true);
    setIsDetailLoading(true);
    setSelectedShipmentDetails(null);
    try {
      const details = await getMockFullShipmentDetails(shipment);
      setSelectedShipmentDetails(details);
    } catch (error) {
      console.error("Failed to fetch shipment details:", error);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const handleEdit = useCallback((shipment: LogisticsRecord) => {
      setEditingShipment(shipment);
      setIsEditDialogOpen(true);
  }, []);

  // =================================================================
  // 4. 列定义 (使用修正后的依赖项)
  // =================================================================
  const columns = useMemo(() => getColumns({
    onViewDetails: handleViewDetails,
    onEdit: handleEdit,
    onDelete: openDeleteConfirmation,
  }), [handleViewDetails, handleEdit, openDeleteConfirmation]);

  // =================================================================
  // 5. 渲染中心 (JSX Rendering)
  // =================================================================
  return (
    <>
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-between mb-4">
          <div><h1 className="text-3xl font-bold">运单管理平台</h1><p className="text-muted-foreground">精确、系统地管理所有业务运单。</p></div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" />新增</Button>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline">数据操作<ChevronsUpDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}><Upload className="mr-2 h-4 w-4" />导入</DropdownMenuItem>
                <DropdownMenuItem onClick={downloadImportTemplate}><Download className="mr-2 h-4 w-4" />下载模板</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportDataToExcel(filteredData, '运单数据导出')}><Download className="mr-2 h-4 w-4" />导出当前数据</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center justify-between py-4">
          <div className="relative w-full max-w-sm">
            <Input placeholder="搜索项目/车牌/司机..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="pr-8"/>
            {filterText && <XCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer" onClick={() => setFilterText("")} />}
          </div>
          {selectedRowCount > 0 && (
            <Button variant="destructive" onClick={() => openDeleteConfirmation()}>
              <Trash2 className="mr-2 h-4 w-4" />
              删除选中的 {selectedRowCount} 条记录
            </Button>
          )}
        </div>
        
        <ShipmentTable
          columns={columns}
          data={filteredData}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      </div>

      <AddShipmentDialog isOpen={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} onSave={handleSaveShipment} />
      <EditShipmentDialog isOpen={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} onSave={handleUpdateShipment} shipment={editingShipment} />
      <ImportDataDialog isOpen={isImportDialogOpen} onClose={() => setIsImportDialogOpen(false)} onConfirmImport={handleConfirmImport} />
      <ShipmentDetailSheet isOpen={isDetailSheetOpen} onClose={() => setIsDetailSheetOpen(false)} shipmentDetails={selectedShipmentDetails} isLoading={isDetailLoading} />
      <ConfirmationDialog
        isOpen={isConfirmDeleteDialogOpen}
        onClose={() => setIsConfirmDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title={`确认删除操作`}
        description={`您确定要删除这 ${deletingId ? '1' : selectedRowCount} 条运单吗？此操作将同时删除所有关联的财务信息，且无法撤销。`}
      />
    </>
  );
}
