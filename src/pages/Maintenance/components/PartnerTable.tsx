import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Users, Eye, EyeOff } from "lucide-react";
import { Partner } from "@/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface PartnerWithProjects extends Partner {
  projects: {
    projectId: string;
    projectName: string;
    projectCode: string;
    level: number;
    taxRate: number;
  }[];
}

interface PartnerTableProps {
  partners: PartnerWithProjects[];
  showDetails: boolean;
  canViewSensitive: boolean;
  onEdit: (partner: Partner) => void;
  onDelete: (partnerId: string) => void;
}

export function PartnerTable({
  partners,
  showDetails,
  canViewSensitive,
  onEdit,
  onDelete,
}: PartnerTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [partnerToDelete, setPartnerToDelete] = useState<PartnerWithProjects | null>(null);

  const handleDeleteClick = (partner: PartnerWithProjects) => {
    setPartnerToDelete(partner);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (partnerToDelete) {
      onDelete(partnerToDelete.id);
      setDeleteDialogOpen(false);
      setPartnerToDelete(null);
    }
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>合作方列表 (共 {partners.length} 个)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                {showDetails && canViewSensitive && (
                  <>
                    <TableHead>全称</TableHead>
                    <TableHead>税号</TableHead>
                    <TableHead>银行账号</TableHead>
                  </>
                )}
                <TableHead>税率</TableHead>
                <TableHead>关联项目</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.length > 0 ? (
                partners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    {showDetails && canViewSensitive && (
                      <>
                        <TableCell>{partner.fullName || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {partner.taxNumber || '—'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {partner.bankAccount || '—'}
                        </TableCell>
                      </>
                    )}
                    <TableCell>{(partner.taxRate * 100).toFixed(1)}%</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {partner.projects && partner.projects.length > 0 ? (
                          partner.projects.map((proj) => (
                            <Badge key={proj.projectId} variant="outline">
                              {proj.projectName}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">未关联</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(partner)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          编辑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(partner)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={showDetails && canViewSensitive ? 7 : 4} className="h-24 text-center">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">暂无合作方数据</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="确认删除"
        description={`确定要删除合作方"${partnerToDelete?.name}"吗？相关的项目合作链路也会被影响，此操作不可撤销。`}
      />
    </>
  );
}

