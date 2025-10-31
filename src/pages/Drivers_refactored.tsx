import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Truck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useDriversData } from "./Maintenance/hooks/useDriversData";
import { useDriverForm } from "./Maintenance/hooks/useDriverForm";
import { useDriverFilters } from "./Maintenance/hooks/useDriverFilters";
import { DriverFilters } from "./Maintenance/components/DriverFilters";
import { DriverTable } from "./Maintenance/components/DriverTable";
import { DriverFormDialog } from "./Maintenance/components/DriverFormDialog";

export default function Drivers() {
  const {
    drivers,
    projects,
    isLoading,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    loadData,
    deleteDriver,
  } = useDriversData();

  const {
    isDialogOpen,
    setIsDialogOpen,
    editingDriver,
    formData,
    setFormData,
    driverPhotos,
    setDriverPhotos,
    vehiclePhotos,
    setVehiclePhotos,
    resetForm,
    handleEdit,
    handleSubmit,
  } = useDriverForm(() => loadData(currentPage, "", pageSize));

  const {
    quickFilter,
    setQuickFilter,
    projectFilter,
    setProjectFilter,
    showFilters,
    setShowFilters,
    filteredDrivers,
    clearFilters,
    activeFiltersCount,
  } = useDriverFilters(drivers);

  useEffect(() => {
    loadData(1, "", pageSize);
  }, []);

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="司机管理"
        description="管理所有司机信息和车辆信息，支持照片上传"
        icon={Truck}
        iconColor="text-blue-600"
      >
        <Button onClick={handleOpenDialog}>
          <Plus className="h-4 w-4 mr-2" />
          添加司机
        </Button>
      </PageHeader>

      <DriverFilters
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        clearFilters={clearFilters}
        activeFiltersCount={activeFiltersCount}
        projects={projects}
        totalCount={totalCount}
        filteredCount={filteredDrivers.length}
      />

      <DriverTable
        drivers={filteredDrivers}
        projects={projects}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        onEdit={handleEdit}
        onDelete={deleteDriver}
        onPageChange={(page) => loadData(page, quickFilter, pageSize)}
        activeFiltersCount={activeFiltersCount}
        clearFilters={clearFilters}
      />

      <DriverFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        formData={formData}
        setFormData={setFormData}
        driverPhotos={driverPhotos}
        setDriverPhotos={setDriverPhotos}
        vehiclePhotos={vehiclePhotos}
        setVehiclePhotos={setVehiclePhotos}
        projects={projects}
        isEditing={!!editingDriver}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

