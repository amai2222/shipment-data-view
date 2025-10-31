import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProjectForm } from "./ProjectForm";
import { Partner } from "@/types";

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

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FormData;
  setFormData: (data: FormData) => void;
  selectedChains: PartnerChain[];
  setSelectedChains: (chains: PartnerChain[]) => void;
  partners: Partner[];
  isSubmitting: boolean;
  isEditing: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  selectedChains,
  setSelectedChains,
  partners,
  isSubmitting,
  isEditing,
  onSubmit,
}: ProjectFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑项目' : '添加项目'}</DialogTitle>
          <DialogDescription>
            {isEditing ? '修改项目信息和合作链路配置' : '填写项目基本信息并配置合作链路'}
          </DialogDescription>
        </DialogHeader>
        
        <ProjectForm
          formData={formData}
          setFormData={setFormData}
          selectedChains={selectedChains}
          setSelectedChains={setSelectedChains}
          partners={partners}
          isSubmitting={isSubmitting}
          isEditing={isEditing}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

