import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Edit, Trash2, Settings } from "lucide-react";
import { ProjectWithDetails } from "../hooks/useProjectsData";
import { PartnerChainDisplay } from "./PartnerChainDisplay";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ProjectRowProps {
  project: ProjectWithDetails;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (project: ProjectWithDetails) => void;
  onDelete: (projectId: string) => void;
  onStatusChange: (projectId: string, newStatus: string, projectName: string) => void;
}

export function ProjectRow({
  project,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onStatusChange,
}: ProjectRowProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case '进行中': return 'bg-green-100 text-green-800';
      case '已完成': return 'bg-blue-100 text-blue-800';
      case '已暂停': return 'bg-yellow-100 text-yellow-800';
      case '已取消': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const projectStatus = (project as any).projectStatus || '进行中';

  return (
    <Card className="border shadow-sm">
      <CardHeader 
        className="cursor-pointer hover:bg-muted/50 transition-colors pb-3" 
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <CardTitle className="text-lg">{project.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                负责人: {project.manager}
                <span className="mx-2">·</span>
                财务负责人: {project.financeManager || '—'}
                <span className="mx-2">·</span>
                计划数: {project.plannedTotalTons ?? '—'}
                <span className="mx-2">·</span>
                状态: <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(projectStatus)}`}>
                  {projectStatus}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-right">
              <p className="text-sm font-medium">{project.loadingAddress}</p>
              <p className="text-xs text-muted-foreground">装货地址</p>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="text-right">
              <p className="text-sm font-medium">{project.unloadingAddress}</p>
              <p className="text-xs text-muted-foreground">卸货地址</p>
            </div>
            <div className="flex space-x-2 ml-4">
              <div onClick={(e) => e.stopPropagation()}>
                <Select 
                  value={projectStatus} 
                  onValueChange={(value) => onStatusChange(project.id, value, project.name)}
                >
                  <SelectTrigger className="w-24 h-8">
                    <Settings className="h-3 w-3 mr-1" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="进行中">进行中</SelectItem>
                    <SelectItem value="已暂停">已暂停</SelectItem>
                    <SelectItem value="已完成">已完成</SelectItem>
                    <SelectItem value="已取消">已取消</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(project);
                }}
              >
                <Edit className="h-4 w-4 mr-1" />
                编辑
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                删除
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <div className="px-6 pb-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">开始日期：</span>
              {project.startDate || '—'}
            </div>
            <div>
              <span className="font-medium">结束日期：</span>
              {project.endDate || '—'}
            </div>
            <div>
              <span className="font-medium">货物类型：</span>
              {(project as any).cargoType || '货品'}
            </div>
            <div>
              <span className="font-medium">有效数量类型：</span>
              {(project as any).effectiveQuantityType === 'min_value' ? '取小值' :
               (project as any).effectiveQuantityType === 'loading' ? '装货重量' :
               (project as any).effectiveQuantityType === 'unloading' ? '卸货重量' : '—'}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">合作链路配置</h4>
            {project.partnerChains && project.partnerChains.length > 0 ? (
              <div className="space-y-3">
                {project.partnerChains.map((chain, idx) => (
                  <div key={chain.id} className="p-3 border rounded-md bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-sm">{chain.chainName}</span>
                        {chain.isDefault && (
                          <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                            默认
                          </span>
                        )}
                      </div>
                      {chain.description && (
                        <span className="text-xs text-muted-foreground">{chain.description}</span>
                      )}
                    </div>
                    <PartnerChainDisplay partners={chain.partners || []} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无合作链路配置</p>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={() => {
          onDelete(project.id);
          setShowDeleteDialog(false);
        }}
        title="确认删除"
        description={`确定要删除项目"${project.name}"吗？此操作不可撤销。`}
      />
    </Card>
  );
}
