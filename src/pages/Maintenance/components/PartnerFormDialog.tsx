import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FormData {
  name: string;
  fullName: string;
  bankAccount: string;
  bankName: string;
  branchName: string;
  taxNumber: string;
  companyAddress: string;
  taxRate: number;
  partnerType: '货主' | '合作商' | '资方' | '本公司';
}

interface PartnerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  setFormData: (data: FormData) => void;
  isEditing: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function PartnerFormDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  isEditing,
  onSubmit,
}: PartnerFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑合作方' : '添加合作方'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="bank">银行信息</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">合作方名称 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="输入合作方名称"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">公司全称</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="输入公司全称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partnerType">合作方类型 *</Label>
                  <Select
                    value={formData.partnerType}
                    onValueChange={(value: any) => setFormData({ ...formData, partnerType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="货主">货主</SelectItem>
                      <SelectItem value="合作商">合作商</SelectItem>
                      <SelectItem value="资方">资方</SelectItem>
                      <SelectItem value="本公司">本公司</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxRate">税率</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.001"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                    placeholder="例如：0.03"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="submit">
                  {isEditing ? "更新" : "添加"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="bank">
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxNumber">税号</Label>
                  <Input
                    id="taxNumber"
                    value={formData.taxNumber}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                    placeholder="输入税号"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">公司地址</Label>
                  <Input
                    id="companyAddress"
                    value={formData.companyAddress}
                    onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                    placeholder="输入公司地址"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccount">银行账号</Label>
                  <Input
                    id="bankAccount"
                    value={formData.bankAccount}
                    onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                    placeholder="输入银行账号"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankName">开户银行</Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="输入开户银行"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branchName">支行名称</Label>
                  <Input
                    id="branchName"
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                    placeholder="输入支行名称"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="submit">
                  {isEditing ? "更新" : "添加"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

