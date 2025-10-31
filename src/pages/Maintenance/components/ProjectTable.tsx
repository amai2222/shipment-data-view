import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectWithDetails } from "../hooks/useProjectsData";
import { ProjectRow } from "./ProjectRow";

interface ProjectTableProps {
  projects: ProjectWithDetails[];
  totalCount: number;
  expandedProject: string | null;
  onToggleExpand: (projectId: string) => void;
  onEdit: (project: ProjectWithDetails) => void;
  onDelete: (projectId: string) => void;
  onStatusChange: (projectId: string, newStatus: string, projectName: string) => void;
}

export function ProjectTable({
  projects,
  totalCount,
  expandedProject,
  onToggleExpand,
  onEdit,
  onDelete,
  onStatusChange,
}: ProjectTableProps) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            项目列表 (共 {totalCount} 个项目，显示 {projects.length} 个)
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {projects.length > 0 ? (
            projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                isExpanded={expandedProject === project.id}
                onToggleExpand={() => onToggleExpand(project.id)}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">暂无项目数据</p>
              <p className="text-sm">点击右上角"添加项目"按钮开始创建项目</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
