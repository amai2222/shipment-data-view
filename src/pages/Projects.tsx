import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Package, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useProjectsData } from "./Maintenance/hooks/useProjectsData";
import { useProjectForm } from "./Maintenance/hooks/useProjectForm";
import { useProjectFilters } from "./Maintenance/hooks/useProjectFilters";
import { ProjectFilters } from "./Maintenance/components/ProjectFilters";
import { ProjectTable } from "./Maintenance/components/ProjectTable";
import { ProjectFormDialog } from "./Maintenance/components/ProjectFormDialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Projects() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const {
    projects,
    partners,
    isLoading,
    expandedProject,
    setExpandedProject,
    deleteProject,
    refetchProjects,
  } = useProjectsData();

  const {
    isDialogOpen,
    setIsDialogOpen,
    editingProject,
    isSubmitting,
    formData,
    setFormData,
    selectedChains,
    setSelectedChains,
    resetForm,
    handleEdit,
    handleSubmit,
  } = useProjectForm(refetchProjects);

  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    showFilters,
    setShowFilters,
    sortBy,
    setSortBy,
    filteredAndSortedProjects,
    clearFilters,
    activeFiltersCount,
  } = useProjectFilters(projects);

  const handleStatusChange = async (projectId: string, newStatus: string, projectName: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ project_status: newStatus })
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: "状态更新成功",
        description: `项目"${projectName}"状态已更新为"${newStatus}"`
      });

      await queryClient.invalidateQueries({ queryKey: ['projects-with-details'] });
    } catch (error) {
      console.error('更新项目状态失败:', error);
      toast({
        title: "状态更新失败",
        description: "更新项目状态时出现错误",
        variant: "destructive"
      });
    }
  };

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">加载项目数据中...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="项目管理"
        description="管理所有物流项目的基本信息，支持多种合作链路配置"
        icon={Package}
        iconColor="text-purple-600"
      >
        <Button onClick={handleOpenDialog}>
          <Plus className="h-4 w-4 mr-2" />
          添加项目
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <ProjectFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          showFilters={showFilters}
          setShowFilters={setShowFilters}
          sortBy={sortBy}
          setSortBy={setSortBy}
          clearFilters={clearFilters}
          activeFiltersCount={activeFiltersCount}
          totalCount={projects.length}
          filteredCount={filteredAndSortedProjects.length}
        />

        <ProjectTable
          projects={filteredAndSortedProjects}
          totalCount={projects.length}
          expandedProject={expandedProject}
          onToggleExpand={(projectId) =>
            setExpandedProject(expandedProject === projectId ? null : projectId)
          }
          onEdit={handleEdit}
          onDelete={deleteProject}
          onStatusChange={handleStatusChange}
        />
      </div>

      <ProjectFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        formData={formData}
        setFormData={setFormData}
        selectedChains={selectedChains}
        setSelectedChains={setSelectedChains}
        partners={partners}
        isSubmitting={isSubmitting}
        isEditing={!!editingProject}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

