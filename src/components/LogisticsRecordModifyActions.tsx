// ============================================================================
// 文件: LogisticsRecordModifyActions.tsx - 运单修改操作公共组件
// ============================================================================
// 功能说明：
// 1. 单个修改合作链路
// 2. 单个修改运费（合作方和司机应收）
// 3. 批量修改应收（合作方和司机应收）
// 4. 批量修改合作链路
// ============================================================================

import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Edit, Link as LinkIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";

// ============================================================================
// 类型定义
// ============================================================================

interface PartnerCost {
  partner_id: string;
  partner_name: string;
  level: number;
  payable_amount: number;
  full_name?: string;
  bank_account?: string;
  bank_name?: string;
  branch_name?: string;
}

interface LogisticsRecord {
  id: string;
  auto_number: string;
  project_name: string;
  project_id?: string;
  driver_id: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  loading_date: string;
  unloading_date: string | null;
  license_plate: string | null;
  driver_phone: string | null;
  payable_cost: number | null;
  partner_costs?: PartnerCost[];
  payment_status: 'Unpaid' | 'Processing' | 'Approved' | 'Paid';
  invoice_status?: 'Uninvoiced' | 'Processing' | 'Invoiced' | null;
  chain_name?: string | null;
  chain_id?: string | null;
}

interface PartnerChain {
  id: string;
  chain_name: string;
  is_default: boolean;
}

interface BatchCostRecord {
  id: string;
  auto_number: string;
  loading_date: string;
  driver_name: string;
  original_amount: number;
  new_amount: string;
  original_driver_amount: number;
  new_driver_amount: string;
}

interface LogisticsRecordModifyActionsProps {
  // 选中的运单ID集合
  selectedIds: Set<string>;
  // 运单数据列表
  records: LogisticsRecord[];
  // 项目列表（用于查找项目ID）
  projects?: Array<{ id: string; name: string }>;
  // 数据刷新回调
  onRefresh: () => void;
  // 是否显示批量操作按钮（默认true）
  showBatchActions?: boolean;
  // 是否显示单个操作按钮（默认true）
  showSingleActions?: boolean;
  // 自定义按钮样式
  buttonClassName?: string;
}

// 暴露给父组件的函数接口
export interface LogisticsRecordModifyActionsRef {
  // 打开修改运费对话框
  editPartnerCost: (record: LogisticsRecord) => void;
  // 打开修改合作链路对话框
  editChain: (record: LogisticsRecord) => Promise<void>;
}

// ============================================================================
// 组件实现
// ============================================================================

export const LogisticsRecordModifyActions = forwardRef<LogisticsRecordModifyActionsRef, LogisticsRecordModifyActionsProps>(({
  selectedIds,
  records,
  projects = [],
  onRefresh,
  showBatchActions = true,
  showSingleActions = true,
  buttonClassName = "bg-orange-600 hover:bg-orange-700 text-white"
}, ref) => {
  const { toast } = useToast();
  
  // 单个修改运费相关状态
  const [editPartnerCostData, setEditPartnerCostData] = useState<{
    recordId: string;
    recordNumber: string;
    partnerCosts: PartnerCost[];
    driverPayableCost: number;
  } | null>(null);
  const [tempPartnerCosts, setTempPartnerCosts] = useState<PartnerCost[]>([]);
  const [tempDriverCost, setTempDriverCost] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  
  // 单个修改合作链路相关状态
  const [editChainData, setEditChainData] = useState<{
    recordId: string;
    recordNumber: string;
    projectId: string;
    currentChainName: string;
  } | null>(null);
  const [availableChains, setAvailableChains] = useState<PartnerChain[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string>('');
  const [isLoadingChains, setIsLoadingChains] = useState(false);
  
  // 批量修改相关状态
  const [batchModifyType, setBatchModifyType] = useState<'cost' | 'chain' | null>(null);
  const [batchCostRecords, setBatchCostRecords] = useState<BatchCostRecord[]>([]);
  const [batchChainId, setBatchChainId] = useState<string>('');
  const [batchChains, setBatchChains] = useState<PartnerChain[]>([]);
  const [isBatchModifying, setIsBatchModifying] = useState(false);

  // ==========================================================================
  // 单个修改运费功能
  // ==========================================================================

  /**
   * 打开"修改合作方运费"对话框
   */
  const handleEditPartnerCost = (record: LogisticsRecord) => {
    setEditPartnerCostData({
      recordId: record.id,
      recordNumber: record.auto_number,
      partnerCosts: record.partner_costs || [],
      driverPayableCost: record.payable_cost || 0
    });
    setTempPartnerCosts(JSON.parse(JSON.stringify(record.partner_costs || [])));
    setTempDriverCost(record.payable_cost || 0);
  };

  /**
   * 保存合作方运费修改
   */
  const handleSavePartnerCost = async () => {
    if (!editPartnerCostData) return;
    
    setIsSaving(true);
    try {
      // 验证运单支付状态和开票状态
      interface LogisticsRecordStatus {
        payment_status: string;
        invoice_status: string | null;
      }
      
      const { data: recordData, error: checkError } = await supabase
        .from('logistics_records')
        .select('payment_status, invoice_status')
        .eq('id', editPartnerCostData.recordId)
        .single<LogisticsRecordStatus>();
      
      if (checkError) throw checkError;
      
      if (!recordData) {
        throw new Error('运单记录不存在');
      }
      
      // 检查支付状态
      if (recordData.payment_status !== 'Unpaid') {
        const statusText = {
          'Processing': '已申请支付',
          'Approved': '支付审核通过',
          'Paid': '已支付'
        }[recordData.payment_status] || recordData.payment_status;
        throw new Error(`只有未支付状态的运单才能修改运费。当前付款状态：${statusText}`);
      }
      
      // 检查开票状态
      if (recordData.invoice_status && recordData.invoice_status !== 'Uninvoiced') {
        const statusText = recordData.invoice_status === 'Processing' ? '开票中' : '已开票';
        throw new Error(`只有未开票状态的运单才能修改运费。当前开票状态：${statusText}`);
      }
      
      // 1. 更新所有层级合作方的金额
      for (const cost of tempPartnerCosts) {
        const amount = typeof cost.payable_amount === 'string' ? parseFloat(cost.payable_amount) : cost.payable_amount;
        
        const { error: updateError } = await supabase
          .from('logistics_partner_costs')
          .update({
            payable_amount: amount,
            is_manually_modified: true,
            updated_at: new Date().toISOString()
          } as never)
          .eq('logistics_record_id', editPartnerCostData.recordId)
          .eq('partner_id', cost.partner_id)
          .eq('level', cost.level);
        
        if (updateError) throw updateError;
      }
      
      // 2. 更新司机应收金额
      const driverAmount = typeof tempDriverCost === 'string' ? parseFloat(tempDriverCost) : tempDriverCost;
      const { error: driverUpdateError } = await supabase
        .from('logistics_records')
        .update({
          payable_cost: driverAmount,
          updated_at: new Date().toISOString()
        } as never)
        .eq('id', editPartnerCostData.recordId);
      
      if (driverUpdateError) throw driverUpdateError;
      
      toast({ 
        title: "成功", 
        description: `已更新 ${tempPartnerCosts.length} 个合作方的运费和司机应收` 
      });
      setEditPartnerCostData(null);
      setTempPartnerCosts([]);
      setTempDriverCost(0);
      onRefresh();
    } catch (error) {
      console.error("保存合作方运费失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: "错误", description: `保存失败: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================================================
  // 单个修改合作链路功能
  // ==========================================================================

  /**
   * 打开"修改合作链路"对话框
   */
  const handleEditChain = async (record: LogisticsRecord) => {
    let projectId = record.project_id;
    
    if (!projectId && record.project_name) {
      const project = projects.find(p => p.name === record.project_name);
      if (project) {
        projectId = project.id;
      }
    }
    
    if (!projectId) {
      toast({ title: "错误", description: "无法获取项目信息", variant: "destructive" });
      return;
    }
    
    setEditChainData({
      recordId: record.id,
      recordNumber: record.auto_number,
      projectId: projectId,
      currentChainName: record.chain_name || '默认链路'
    });
    
    setSelectedChainId('');
    
    // 获取可用的合作链路
    setIsLoadingChains(true);
    try {
      const { data, error } = await supabase
        .from('partner_chains')
        .select('id, chain_name, is_default, project_id')
        .eq('project_id', projectId)
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast({ 
          title: "提示", 
          description: `项目"${record.project_name}"暂无合作链路配置。如需配置，请前往项目管理页面。`, 
          variant: "default",
          duration: 5000
        });
      }
      
      setAvailableChains(data || []);
    } catch (error) {
      console.error("获取合作链路失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: "错误", description: `获取合作链路失败: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsLoadingChains(false);
    }
  };

  /**
   * 保存合作链路修改
   */
  const handleSaveChain = async (newChainId: string) => {
    if (!editChainData) return;
    
    setIsSaving(true);
    try {
      const selectedChain = availableChains.find(c => c.id === newChainId);
      if (!selectedChain) throw new Error("未找到选择的合作链路");
      
      interface ModifyChainResult {
        success: boolean;
        message: string;
        recalculated_partners?: number;
      }
      
      const { data, error } = await supabase.rpc<ModifyChainResult>('modify_logistics_record_chain_with_recalc_1126', {
        p_record_id: editChainData.recordId,
        p_chain_name: selectedChain.chain_name
      });
      
      if (error) throw error;
      
      const result = data;
      toast({ 
        title: "成功", 
        description: `合作链路已更新为"${selectedChain.chain_name}"，已重新计算${result?.recalculated_partners || 0}个合作方的成本` 
      });
      setEditChainData(null);
      setAvailableChains([]);
      setSelectedChainId('');
      onRefresh();
    } catch (error) {
      console.error("修改合作链路失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: "错误", description: `修改失败: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================================================
  // 批量修改应收功能
  // ==========================================================================

  /**
   * 打开批量修改应收对话框
   */
  const handleOpenBatchModifyCost = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "提示", description: "请先选择要修改的运单" });
      return;
    }

    setBatchModifyType('cost');
    
    const selectedRecords = records.filter(r => selectedIds.has(r.id));
    
    const recordsWithCost = await Promise.all(
      selectedRecords.map(async (record) => {
        const highestCost = record.partner_costs && record.partner_costs.length > 0
          ? record.partner_costs.reduce((max, cost) => 
              cost.level > max.level ? cost : max
            )
          : null;
        
        const driverPayableCost = record.payable_cost || 0;
        
        return {
          id: record.id,
          auto_number: record.auto_number,
          loading_date: record.loading_date,
          driver_name: record.driver_name,
          original_amount: highestCost?.payable_amount || 0,
          new_amount: (highestCost?.payable_amount || 0).toString(),
          original_driver_amount: driverPayableCost,
          new_driver_amount: driverPayableCost.toString()
        };
      })
    );
    
    setBatchCostRecords(recordsWithCost);
  };

  /**
   * 批量修改应收
   */
  const handleBatchModifyCost = async () => {
    const invalidRecords = batchCostRecords.filter(r => {
      const partnerValue = r.new_amount?.toString().trim();
      if (!partnerValue && partnerValue !== '0') return true;
      const partnerNum = parseFloat(partnerValue);
      if (isNaN(partnerNum) || partnerNum < 0) return true;
      
      const driverValue = r.new_driver_amount?.toString().trim();
      if (!driverValue && driverValue !== '0') return true;
      const driverNum = parseFloat(driverValue);
      if (isNaN(driverNum) || driverNum < 0) return true;
      
      return false;
    });
    
    if (invalidRecords.length > 0) {
      toast({ title: "错误", description: `请为所有运单输入有效的合作方和司机金额（可以是0，但不能为负数）`, variant: "destructive" });
      return;
    }

    setIsBatchModifying(true);
    let successCount = 0;
    let failedCount = 0;
    const failedList: string[] = [];

    try {
      for (const record of batchCostRecords) {
        try {
          const newPartnerAmount = parseFloat(record.new_amount);
          const newDriverAmount = parseFloat(record.new_driver_amount);
          
          interface LogisticsRecordStatus {
            payment_status: string;
            invoice_status: string | null;
          }
          
          const { data: recordData, error: checkError } = await supabase
            .from('logistics_records')
            .select('payment_status, invoice_status')
            .eq('id', record.id)
            .single<LogisticsRecordStatus>();
          
          if (checkError) throw checkError;
          
          if (!recordData) {
            failedCount++;
            failedList.push(`${record.auto_number}(运单不存在)`);
            continue;
          }
          
          if (recordData.payment_status !== 'Unpaid') {
            failedCount++;
            failedList.push(`${record.auto_number}(已申请或已付款)`);
            continue;
          }
          
          if (recordData.invoice_status && recordData.invoice_status !== 'Uninvoiced') {
            failedCount++;
            failedList.push(`${record.auto_number}(已开票)`);
            continue;
          }
          
          const { data: costs } = await supabase
            .from('logistics_partner_costs')
            .select('partner_id, level')
            .eq('logistics_record_id', record.id)
            .order('level', { ascending: false })
            .limit(1);
          
          if (!costs || costs.length === 0) {
            failedCount++;
            failedList.push(`${record.auto_number}(无合作方)`);
            continue;
          }
          
          const highestPartner = costs[0] as { partner_id: string; level: number };
          
          const { error: updatePartnerError } = await supabase
            .from('logistics_partner_costs')
            .update({
              payable_amount: newPartnerAmount,
              is_manually_modified: true,
              updated_at: new Date().toISOString()
            } as never)
            .eq('logistics_record_id', record.id)
            .eq('partner_id', highestPartner.partner_id)
            .eq('level', highestPartner.level);
          
          if (updatePartnerError) throw updatePartnerError;
          
          const { error: updateDriverError } = await supabase
            .from('logistics_records')
            .update({
              payable_cost: newDriverAmount,
              updated_at: new Date().toISOString()
            } as never)
            .eq('id', record.id);
          
          if (updateDriverError) throw updateDriverError;
          
          successCount++;
        } catch (error) {
          failedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          failedList.push(`${record.auto_number}(错误: ${errorMessage})`);
        }
      }

      toast({
        title: "批量修改完成",
        description: `成功更新 ${successCount} 条运单（含合作方和司机应收），失败 ${failedCount} 条`,
        variant: successCount > 0 ? "default" : "destructive"
      });

      if (failedList.length > 0) {
        console.log('失败的运单:', failedList);
      }

      setBatchModifyType(null);
      setBatchCostRecords([]);
      onRefresh();
    } catch (error) {
      console.error("批量修改应收失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: "错误", description: `批量修改失败: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsBatchModifying(false);
    }
  };

  // ==========================================================================
  // 批量修改合作链路功能
  // ==========================================================================

  /**
   * 打开批量修改合作链路对话框
   */
  const handleOpenBatchModifyChain = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "提示", description: "请先选择要修改的运单" });
      return;
    }

    setBatchModifyType('chain');
    
    // 获取选中运单的项目ID（必须属于同一个项目）
    const selectedRecords = records.filter(r => selectedIds.has(r.id));
    const projectIds = new Set(selectedRecords.map(r => r.project_id).filter(Boolean));
    
    if (projectIds.size === 0) {
      toast({ title: "错误", description: "无法获取项目信息", variant: "destructive" });
      return;
    }
    
    if (projectIds.size > 1) {
      toast({ title: "错误", description: "所选运单必须属于同一个项目", variant: "destructive" });
      return;
    }
    
    const projectId = Array.from(projectIds)[0] as string;
    
    // 获取该项目的所有合作链路
    try {
      const { data, error } = await supabase
        .from('partner_chains')
        .select('id, chain_name, is_default, project_id')
        .eq('project_id', projectId)
        .order('is_default', { ascending: false });
      
      if (error) throw error;
      
      setBatchChains(data || []);
      setBatchChainId('');
    } catch (error) {
      console.error("获取合作链路失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: "错误", description: `获取合作链路失败: ${errorMessage}`, variant: "destructive" });
    }
  };

  /**
   * 批量修改合作链路
   */
  const handleBatchModifyChain = async () => {
    if (!batchChainId) {
      toast({ title: "错误", description: "请选择合作链路", variant: "destructive" });
      return;
    }

    const idsToModify = Array.from(selectedIds);
    if (idsToModify.length === 0) {
      toast({ title: "提示", description: "请先选择要修改的运单" });
      return;
    }

    const selectedChain = batchChains.find(c => c.id === batchChainId);
    if (!selectedChain) {
      toast({ title: "错误", description: "未找到选择的合作链路", variant: "destructive" });
      return;
    }

    setIsBatchModifying(true);
    try {
      const { data, error } = await supabase.rpc('batch_modify_chain_1126', {
        p_record_ids: idsToModify,
        p_chain_name: selectedChain.chain_name
      });

      if (error) throw error;

      interface BatchModifyChainResult {
        success: boolean;
        message: string;
        failed_records?: string[];
      }
      
      const result = data as BatchModifyChainResult;
      toast({
        title: result.success ? "批量修改完成" : "修改失败",
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });

      if (result.failed_records && result.failed_records.length > 0) {
        console.log('失败的运单:', result.failed_records);
      }

      setBatchModifyType(null);
      setBatchChainId('');
      setBatchChains([]);
      onRefresh();
    } catch (error) {
      console.error("批量修改链路失败:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({ title: "错误", description: `批量修改失败: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsBatchModifying(false);
    }
  };

  // ==========================================================================
  // 辅助函数
  // ==========================================================================

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch {
      return dateString;
    }
  };

  // ==========================================================================
  // 暴露函数给父组件
  // ==========================================================================

  useImperativeHandle(ref, () => ({
    editPartnerCost: handleEditPartnerCost,
    editChain: handleEditChain
  }));

  // ==========================================================================
  // 渲染
  // ==========================================================================

  return (
    <>
      {/* 批量操作按钮 */}
      {showBatchActions && (
        <div className="flex gap-2">
          <Button 
            variant="default" 
            size="default"
            disabled={selectedIds.size === 0}
            onClick={handleOpenBatchModifyCost}
            className={buttonClassName}
          >
            <Edit className="mr-2 h-4 w-4" />
            批量修改应收
          </Button>
          <Button 
            variant="default"
            size="default"
            disabled={selectedIds.size === 0}
            onClick={handleOpenBatchModifyChain}
            className={buttonClassName}
          >
            <LinkIcon className="mr-2 h-4 w-4" />
            批量修改链路
          </Button>
        </div>
      )}

      {/* 单个操作函数通过 ref 暴露给父组件，父组件可以在表格操作列中调用 */}

      {/* 对话框1: 单个修改运费对话框 */}
      <Dialog open={!!editPartnerCostData} onOpenChange={(open) => {
        if (!open) {
          setEditPartnerCostData(null);
          setTempPartnerCosts([]);
          setTempDriverCost(0);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-green-100 rounded-lg">
                <Edit className="h-5 w-5 text-green-600" />
              </div>
              修改运费
            </DialogTitle>
            <DialogDescription>运单编号: <span className="font-mono font-semibold">{editPartnerCostData?.recordNumber}</span></DialogDescription>
          </DialogHeader>
          {editPartnerCostData && (
            <div className="py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                {/* 司机应收 */}
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-green-700">司机应收 (¥)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={tempDriverCost}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                            setTempDriverCost(value === '' ? 0 : parseFloat(value) || 0);
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value && !isNaN(parseFloat(value))) {
                            setTempDriverCost(parseFloat(value));
                          }
                        }}
                        disabled={isSaving}
                        className="font-mono h-10 text-right"
                        placeholder="输入金额"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* 合作方应收列表 */}
                {tempPartnerCosts.map((cost, index) => {
                  const isHighest = cost.level === Math.max(...tempPartnerCosts.map(c => c.level));
                  const borderColor = isHighest ? 'border-blue-500' : 'border-purple-500';
                  
                  return (
                    <Card key={`${cost.partner_id}-${cost.level}`} className={`border-l-4 ${borderColor}`}>
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            {cost.partner_name} (级别 {cost.level}) {isHighest && '(最高级)'}
                          </Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={cost.payable_amount}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                                const newCosts = [...tempPartnerCosts];
                                newCosts[index].payable_amount = value === '' ? 0 : parseFloat(value) || 0;
                                setTempPartnerCosts(newCosts);
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value;
                              if (value && !isNaN(parseFloat(value))) {
                                const newCosts = [...tempPartnerCosts];
                                newCosts[index].payable_amount = parseFloat(value);
                                setTempPartnerCosts(newCosts);
                              }
                            }}
                            disabled={isSaving}
                            className="font-mono h-10 text-right"
                            placeholder="输入金额"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>说明：</strong>
                    <br />• 🟢 绿色边框：司机应收金额
                    <br />• 🔵 蓝色边框：最高级合作方应收（通常是直接客户）
                    <br />• 🟣 紫色边框：低层级合作方应收（中间商）
                    <br />• 所有金额都可以独立修改
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPartnerCostData(null)} disabled={isSaving}>
              取消
            </Button>
            <ConfirmDialog
              title="确认修改应收"
              description={`确定要修改运单 ${editPartnerCostData?.recordNumber} 的应收金额吗？此操作将更新司机应收和所有合作方的费用。`}
              onConfirm={handleSavePartnerCost}
            >
              <Button disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                保存修改
              </Button>
            </ConfirmDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 对话框2: 单个修改合作链路对话框 */}
      <Dialog open={!!editChainData} onOpenChange={(open) => {
        if (!open) {
          setEditChainData(null);
          setAvailableChains([]);
          setSelectedChainId('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-purple-100 rounded-lg">
                <LinkIcon className="h-5 w-5 text-purple-600" />
              </div>
              修改合作链路
            </DialogTitle>
            <DialogDescription className="text-base">运单编号: <span className="font-mono font-semibold">{editChainData?.recordNumber}</span></DialogDescription>
          </DialogHeader>
          {editChainData && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">当前合作链路</Label>
                <div className="p-3 bg-muted/50 rounded-md border">
                  <p className="font-medium text-sm">{editChainData.currentChainName}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-chain">选择新的合作链路</Label>
                {isLoadingChains ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Select
                    value={selectedChainId}
                    onValueChange={setSelectedChainId}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="new-chain">
                      <SelectValue placeholder="请选择合作链路..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableChains.map((chain) => (
                        <SelectItem key={chain.id} value={chain.id}>
                          {chain.chain_name}
                          {chain.is_default && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              默认
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-xs text-blue-800">
                  <strong>提示：</strong>修改合作链路后，系统将自动重新计算该运单的所有合作方成本。
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setEditChainData(null);
                setAvailableChains([]);
                setSelectedChainId('');
              }} 
              disabled={isSaving}
            >
              取消
            </Button>
            <ConfirmDialog
              title="确认修改链路"
              description={`确定要将运单 ${editChainData?.recordNumber} 的合作链路修改为"${availableChains.find(c => c.id === selectedChainId)?.chain_name}"吗？此操作将自动重新计算所有合作方成本。`}
              onConfirm={() => {
                if (!selectedChainId) {
                  toast({ title: "提示", description: "请先选择合作链路", variant: "default" });
                  return;
                }
                handleSaveChain(selectedChainId);
              }}
            >
              <Button disabled={isSaving || !selectedChainId}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                确认修改
              </Button>
            </ConfirmDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 对话框3: 批量修改应收对话框 */}
      <Dialog open={batchModifyType === 'cost'} onOpenChange={(open) => {
        if (!open) {
          setBatchModifyType(null);
          setBatchCostRecords([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-green-100 rounded-lg">
                <Edit className="h-5 w-5 text-green-600" />
              </div>
              批量修改应收
            </DialogTitle>
            <DialogDescription>已选择 {batchCostRecords.length} 条运单，请逐个输入新的合作方应收和司机应收金额</DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-3">
              {batchCostRecords.map((record, index) => (
                <Card key={record.id} className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">运单编号</Label>
                          <p className="font-mono text-sm font-medium">{record.auto_number}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">装货日期</Label>
                          <p className="text-sm">{formatDate(record.loading_date)}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">司机</Label>
                          <p className="text-sm font-medium">{record.driver_name}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-green-50 p-3 rounded-md">
                        <div>
                          <Label className="text-xs font-medium text-green-700">司机原应收</Label>
                          <p className="text-sm font-mono text-green-900">¥{record.original_driver_amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <Label htmlFor={`driver-amount-${index}`} className="text-xs font-medium text-green-700">司机新应收 (¥)</Label>
                          <Input
                            id={`driver-amount-${index}`}
                            type="text"
                            inputMode="decimal"
                            value={record.new_driver_amount}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                                const newRecords = [...batchCostRecords];
                                newRecords[index].new_driver_amount = value;
                                setBatchCostRecords(newRecords);
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value;
                              if (value && value !== '-' && !isNaN(parseFloat(value))) {
                                const newRecords = [...batchCostRecords];
                                newRecords[index].new_driver_amount = parseFloat(value).toFixed(2);
                                setBatchCostRecords(newRecords);
                              }
                            }}
                            disabled={isBatchModifying}
                            className="font-mono h-9 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="输入金额（可以是0）"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-3 rounded-md">
                        <div>
                          <Label className="text-xs font-medium text-blue-700">合作方原应收</Label>
                          <p className="text-sm font-mono text-blue-900">¥{record.original_amount.toFixed(2)}</p>
                        </div>
                        <div>
                          <Label htmlFor={`partner-amount-${index}`} className="text-xs font-medium text-blue-700">合作方新应收 (¥)</Label>
                          <Input
                            id={`partner-amount-${index}`}
                            type="text"
                            inputMode="decimal"
                            value={record.new_amount}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                                const newRecords = [...batchCostRecords];
                                newRecords[index].new_amount = value;
                                setBatchCostRecords(newRecords);
                              }
                            }}
                            onBlur={(e) => {
                              const value = e.target.value;
                              if (value && value !== '-' && !isNaN(parseFloat(value))) {
                                const newRecords = [...batchCostRecords];
                                newRecords[index].new_amount = parseFloat(value).toFixed(2);
                                setBatchCostRecords(newRecords);
                              }
                            }}
                            disabled={isBatchModifying}
                            className="font-mono h-9 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="输入金额（可以是0）"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mt-4">
              <p className="text-xs text-yellow-800">
                <strong>注意：</strong>
                <br />• 同时修改最高级合作方应收和司机应收
                <br />• 只能修改"未支付"且"未开票"的运单
                <br />• 已申请付款或已开票的运单将自动跳过
                <br />• 金额可以设置为0（表示无需支付）
              </p>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">司机应收合计：</span>
                <span className="font-mono font-semibold text-green-700">
                  ¥{batchCostRecords.reduce((sum, record) => {
                    const value = parseFloat(record.new_driver_amount?.toString() || '0') || 0;
                    return sum + value;
                  }, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">合作方应收合计：</span>
                <span className="font-mono font-semibold text-blue-700">
                  ¥{batchCostRecords.reduce((sum, record) => {
                    const value = parseFloat(record.new_amount?.toString() || '0') || 0;
                    return sum + value;
                  }, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setBatchModifyType(null);
                  setBatchCostRecords([]);
                }}
                disabled={isBatchModifying}
              >
                取消
              </Button>
              <ConfirmDialog
                title="确认批量修改应收"
                description={`确定要批量修改 ${batchCostRecords.length} 条运单的应收金额吗？此操作将同时更新合作方应收和司机应收。`}
                onConfirm={handleBatchModifyCost}
              >
                <Button disabled={isBatchModifying}>
                  {isBatchModifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  确认修改 ({batchCostRecords.length}条)
                </Button>
              </ConfirmDialog>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 对话框4: 批量修改合作链路对话框 */}
      <Dialog open={batchModifyType === 'chain'} onOpenChange={(open) => {
        if (!open) {
          setBatchModifyType(null);
          setBatchChainId('');
          setBatchChains([]);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-purple-100 rounded-lg">
                <LinkIcon className="h-5 w-5 text-purple-600" />
              </div>
              批量修改合作链路
            </DialogTitle>
            <DialogDescription>已选择 {selectedIds.size} 条运单</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-chain">选择合作链路</Label>
              <Select
                value={batchChainId}
                onValueChange={setBatchChainId}
                disabled={isBatchModifying}
              >
                <SelectTrigger id="batch-chain">
                  <SelectValue placeholder="请选择合作链路..." />
                </SelectTrigger>
                <SelectContent>
                  {batchChains.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id}>
                      {chain.chain_name}
                      {chain.is_default && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          默认
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-blue-800">
                <strong>提示：</strong>
                <br />• 修改链路后将自动重新计算所有合作方成本
                <br />• 只能修改"未支付"且"未开票"的运单
                <br />• 已申请付款或已开票的运单将被跳过
                <br />• 所选运单必须属于同一个项目
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setBatchModifyType(null);
                setBatchChainId('');
                setBatchChains([]);
              }}
              disabled={isBatchModifying}
            >
              取消
            </Button>
            <ConfirmDialog
              title="确认批量修改链路"
              description={`确定要将选中的 ${selectedIds.size} 条运单的合作链路修改为"${batchChains.find(c => c.id === batchChainId)?.chain_name}"吗？此操作将自动重新计算所有合作方成本。`}
              onConfirm={handleBatchModifyChain}
            >
              <Button disabled={isBatchModifying || !batchChainId}>
                {isBatchModifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                确认修改
              </Button>
            </ConfirmDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
});

LogisticsRecordModifyActions.displayName = 'LogisticsRecordModifyActions';

// 导出单个操作函数，供父组件使用
export type { LogisticsRecordModifyActionsProps, LogisticsRecord, PartnerCost };

