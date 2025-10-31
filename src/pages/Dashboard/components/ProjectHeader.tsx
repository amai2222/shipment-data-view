import { Project } from "@/types";

interface ProjectHeaderProps {
  project: Project | undefined;
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
      <h2 className="text-xl font-bold text-blue-900 mb-1">
        {project?.name || '未知项目'}
      </h2>
      <p className="text-blue-700">
        项目负责人：{project?.manager || '未指定'}
      </p>
    </div>
  );
}

