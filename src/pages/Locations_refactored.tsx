import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, MapPin } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useLocationsData } from "./Maintenance/hooks/useLocationsData";
import { useLocationForm } from "./Maintenance/hooks/useLocationForm";
import { useLocationFilters } from "./Maintenance/hooks/useLocationFilters";
import { LocationFilters } from "./Maintenance/components/LocationFilters";
import { LocationTable } from "./Maintenance/components/LocationTable";
import { LocationFormDialog } from "./Maintenance/components/LocationFormDialog";

export default function Locations() {
  const {
    locations,
    projects,
    isLoading,
    loadData,
    deleteLocation,
  } = useLocationsData();

  const {
    isDialogOpen,
    setIsDialogOpen,
    editingLocation,
    formData,
    setFormData,
    resetForm,
    handleEdit,
    handleSubmit,
  } = useLocationForm(loadData);

  const {
    searchQuery,
    setSearchQuery,
    projectFilter,
    setProjectFilter,
    showFilters,
    setShowFilters,
    filteredLocations,
    clearFilters,
    activeFiltersCount,
  } = useLocationFilters(locations);

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="地点管理"
        description="管理所有装货和卸货地点信息"
        icon={MapPin}
        iconColor="text-green-600"
      >
        <Button onClick={handleOpenDialog}>
          <Plus className="h-4 w-4 mr-2" />
          添加地点
        </Button>
      </PageHeader>

      <LocationFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        clearFilters={clearFilters}
        activeFiltersCount={activeFiltersCount}
        projects={projects}
        totalCount={locations.length}
        filteredCount={filteredLocations.length}
      />

      <LocationTable
        locations={filteredLocations}
        projects={projects}
        totalCount={locations.length}
        onEdit={handleEdit}
        onDelete={deleteLocation}
        activeFiltersCount={activeFiltersCount}
        clearFilters={clearFilters}
      />

      <LocationFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        formData={formData}
        setFormData={setFormData}
        projects={projects}
        isEditing={!!editingLocation}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

