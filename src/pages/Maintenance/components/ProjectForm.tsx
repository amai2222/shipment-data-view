import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Partner } from "@/types";
import { PartnerSelector } from "@/components/PartnerSelector";

interface FormData {
  name: string;
  startDate: string;
  endDate: string;
  manager: string;
  loadingAddress: string;
  unloadingAddress: string;
  financeManager: string;
  plannedTotalTons: string;
  projectStatus: string;
  cargoType: string;
  effectiveQuantityType: "min_value" | "loading" | "unloading";
}

interface PartnerChain {
  id: string;
  chainName: string;
  description?: string;
  billingTypeId?: number | null;
  isDefault?: boolean;
  partners: Array<{
    id: string;
    partnerId: string;
    level: number;
    taxRate: number;
    calculationMethod: "tax" | "profit";
    profitRate?: number;
    partnerName?: string;
  }>;
}

interface ProjectFormProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  selectedChains: PartnerChain[];
  setSelectedChains: (chains: PartnerChain[]) => void;
  partners: Partner[];
  isSubmitting: boolean;
  isEditing: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ProjectForm({
  formData,
  setFormData,
  selectedChains,
  setSelectedChains,
  partners,
  isSubmitting,
  isEditing,
  onSubmit,
}: ProjectFormProps) {
  const addNewChain = () => {
    setSelectedChains([...selectedChains, {
      id: `chain-new-${Date.now()}`,
      chainName: `链路${selectedChains.length + 1}`,
      description: '',
      billingTypeId: 1,
      isDefault: selectedChains.length === 0,
      partners: []
    }]);
  };

  const removeChain = (chainIndex: number) => {
    setSelectedChains(selectedChains.filter((_, i) => i !== chainIndex));
  };

  const updateChainField = (chainIndex: number, field: string, value: any) => {
    setSelectedChains(selectedChains.map((chain, i) =>
      i === chainIndex ? { ...chain, [field]: value } : chain
    ));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 基本信息 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">项目名称 *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="输入项目名称"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manager">项目负责人 *</Label>
          <Input
            id="manager"
            value={formData.manager}
            onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
            placeholder="输入负责人姓名"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="financeManager">财务负责人</Label>
          <Input
            id="financeManager"
            value={formData.financeManager}
            onChange={(e) => setFormData({ ...formData, financeManager: e.target.value })}
            placeholder="输入财务负责人姓名"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plannedTotalTons">计划总量</Label>
          <Input
            id="plannedTotalTons"
            type="number"
            step="0.01"
            value={formData.plannedTotalTons}
            onChange={(e) => setFormData({ ...formData, plannedTotalTons: e.target.value })}
            placeholder="输入计划总量"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">开始日期 *</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">结束日期</Label>
          <Input
            id="endDate"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loadingAddress">装货地址 *</Label>
          <Input
            id="loadingAddress"
            value={formData.loadingAddress}
            onChange={(e) => setFormData({ ...formData, loadingAddress: e.target.value })}
            placeholder="输入装货地址"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unloadingAddress">卸货地址 *</Label>
          <Input
            id="unloadingAddress"
            value={formData.unloadingAddress}
            onChange={(e) => setFormData({ ...formData, unloadingAddress: e.target.value })}
            placeholder="输入卸货地址"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="projectStatus">项目状态</Label>
          <Select
            value={formData.projectStatus}
            onValueChange={(value) => setFormData({ ...formData, projectStatus: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="进行中">进行中</SelectItem>
              <SelectItem value="已暂停">已暂停</SelectItem>
              <SelectItem value="已完成">已完成</SelectItem>
              <SelectItem value="已取消">已取消</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cargoType">货物类型</Label>
          <Input
            id="cargoType"
            value={formData.cargoType}
            onChange={(e) => setFormData({ ...formData, cargoType: e.target.value })}
            placeholder="输入货物类型"
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="effectiveQuantityType">有效数量类型</Label>
          <Select
            value={formData.effectiveQuantityType}
            onValueChange={(value: any) => setFormData({ ...formData, effectiveQuantityType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="min_value">取小值（装货和卸货的较小值）</SelectItem>
              <SelectItem value="loading">装货重量</SelectItem>
              <SelectItem value="unloading">卸货重量</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 合作链路配置 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>合作链路配置 *</Label>
          <Button type="button" size="sm" onClick={addNewChain}>
            <Plus className="h-4 w-4 mr-1" />
            添加链路
          </Button>
        </div>
        
        {selectedChains.length > 0 ? (
          <div className="space-y-4">
            {selectedChains.map((chain, chainIndex) => (
              <Card key={chain.id} className="border-2">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Input
                      value={chain.chainName}
                      onChange={(e) => updateChainField(chainIndex, 'chainName', e.target.value)}
                      placeholder="链路名称"
                      className="max-w-xs"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeChain(chainIndex)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      删除链路
                    </Button>
                  </div>
                  
                  <PartnerSelector
                    partners={partners}
                    value={chain.partners}
                    onChange={(newPartners) =>
                      updateChainField(chainIndex, 'partners', newPartners)
                    }
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded">
            暂无合作链路，点击"添加链路"开始配置多种合作方案
          </div>
        )}
      </div>

      {/* 提交按钮 */}
      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isEditing ? "更新中..." : "添加中..."}
            </>
          ) : (
            isEditing ? "更新" : "添加"
          )}
        </Button>
      </div>
    </form>
  );
}

