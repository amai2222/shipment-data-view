// 合作方-项目关系Hook使用示例
// 文件路径: src/examples/PartnerProjectExample.tsx
// 描述: 展示如何在其他组件中使用usePartnerProjectRelation Hook

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, FileText } from "lucide-react";
import { usePartnerProjectRelation, Partner, Project } from "@/hooks/usePartnerProjectRelation";

export function PartnerProjectExample() {
  const {
    partners,
    projects,
    partnerProjects,
    loadingPartners,
    loadingProjects,
    loadAllPartners,
    loadProjectsByPartner,
    loadAllProjects,
    getPartnerLevelInProject,
    getProjectPartners,
    isPartnerHighestLevel,
  } = usePartnerProjectRelation();

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [partnerLevel, setPartnerLevel] = useState<number | null>(null);
  const [isHighestLevel, setIsHighestLevel] = useState<boolean>(false);

  // 初始化加载数据
  useEffect(() => {
    loadAllPartners();
    loadAllProjects();
  }, [loadAllPartners, loadAllProjects]);

  // 合作商选择变化
  const handlePartnerChange = async (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setSelectedProjectId('');
    if (partnerId) {
      await loadProjectsByPartner(partnerId);
    }
  };

  // 项目选择变化
  const handleProjectChange = async (projectId: string) => {
    setSelectedProjectId(projectId);
    if (selectedPartnerId && projectId) {
      const level = await getPartnerLevelInProject(selectedPartnerId, projectId);
      const highest = await isPartnerHighestLevel(selectedPartnerId, projectId);
      setPartnerLevel(level);
      setIsHighestLevel(highest);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">合作方-项目关系示例</h1>
      
      {/* 合作商选择 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            合作商选择
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select
              value={selectedPartnerId}
              onValueChange={handlePartnerChange}
              disabled={loadingPartners}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择合作商" />
              </SelectTrigger>
              <SelectContent>
                {partners.map(partner => (
                  <SelectItem key={partner.id} value={partner.id}>
                    {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {loadingPartners && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载合作商中...
              </div>
            )}
            
            <div className="text-sm text-gray-600">
              共 {partners.length} 个合作商（显示最高级别）
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 项目选择 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            项目选择
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select
              value={selectedProjectId}
              onValueChange={handleProjectChange}
              disabled={loadingProjects || !selectedPartnerId}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedPartnerId ? "选择项目" : "请先选择合作商"} />
              </SelectTrigger>
              <SelectContent>
                {partnerProjects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {loadingProjects && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载项目中...
              </div>
            )}
            
            <div className="text-sm text-gray-600">
              {selectedPartnerId ? `该合作商参与 ${partnerProjects.length} 个项目` : '请先选择合作商'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 关系信息 */}
      {selectedPartnerId && selectedProjectId && (
        <Card>
          <CardHeader>
            <CardTitle>关系信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">合作商</label>
                  <div className="text-lg font-semibold">
                    {partners.find(p => p.id === selectedPartnerId)?.name}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">项目</label>
                  <div className="text-lg font-semibold">
                    {partnerProjects.find(p => p.id === selectedProjectId)?.name}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">合作商级别</label>
                  <div className="text-lg font-semibold">
                    {partnerLevel !== null ? `Level ${partnerLevel}` : '未知'}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">是否最高级别</label>
                  <div>
                    <Badge variant={isHighestLevel ? "default" : "secondary"}>
                      {isHighestLevel ? "是" : "否"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• 合作商列表显示所有项目的最高级别合作商</p>
            <p>• 选择合作商后，项目列表会动态更新为该合作商参与的项目</p>
            <p>• 选择项目后，会显示合作商在该项目中的级别信息</p>
            <p>• 级别数字越大表示级别越高</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 在其他组件中的使用示例
export function SimplePartnerSelector() {
  const { partners, loadAllPartners, loadingPartners } = usePartnerProjectRelation();
  
  useEffect(() => {
    loadAllPartners();
  }, [loadAllPartners]);

  return (
    <Select disabled={loadingPartners}>
      <SelectTrigger>
        <SelectValue placeholder="选择合作商" />
      </SelectTrigger>
      <SelectContent>
        {partners.map(partner => (
          <SelectItem key={partner.id} value={partner.id}>
            {partner.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// 项目合作商关系展示组件
export function ProjectPartnerList({ projectId }: { projectId: string }) {
  const { getProjectPartners } = usePartnerProjectRelation();
  const [projectPartners, setProjectPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProjectPartners = async () => {
      setLoading(true);
      const partners = await getProjectPartners(projectId);
      setProjectPartners(partners);
      setLoading(false);
    };
    
    if (projectId) {
      loadProjectPartners();
    }
  }, [projectId, getProjectPartners]);

  if (loading) {
    return <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />加载中...</div>;
  }

  return (
    <div className="space-y-2">
      {projectPartners.map((relation, index) => (
        <div key={relation.partner_id} className="flex items-center justify-between p-2 border rounded">
          <span className="font-medium">{relation.partner.name}</span>
          <Badge variant={index === 0 ? "default" : "secondary"}>
            Level {relation.level}
          </Badge>
        </div>
      ))}
    </div>
  );
}
