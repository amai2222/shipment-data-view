import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Map, Zap, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useEnhancedLocationsData } from "./Maintenance/hooks/useEnhancedLocationsData";
import { useEnhancedLocationForm } from "./Maintenance/hooks/useEnhancedLocationForm";
import { useEnhancedLocationFilters } from "./Maintenance/hooks/useEnhancedLocationFilters";
import { EnhancedLocationFilters } from "./Maintenance/components/EnhancedLocationFilters";
import { EnhancedLocationTable } from "./Maintenance/components/EnhancedLocationTable";
import { LocationFormDialog } from "./Maintenance/components/LocationFormDialog";
import { GeocodingStatsCard } from "./Maintenance/components/GeocodingStatsCard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export default function EnhancedLocations() {
  const { toast } = useToast();
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [showGeocodingInfo, setShowGeocodingInfo] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const {
    locations,
    setLocations,
    projects,
    isLoading,
    selectedLocations,
    setSelectedLocations,
    selectAll,
    setSelectAll,
    geocodingStats,
    loadData,
    deleteLocation,
    batchGeocode,
    geocodingService,
  } = useEnhancedLocationsData();

  const {
    isDialogOpen,
    setIsDialogOpen,
    editingLocation,
    formData,
    setFormData,
    resetForm,
    handleEdit,
    handleNameChange,
    handleSubmit,
  } = useEnhancedLocationForm(geocodingService, loadData);

  const {
    searchQuery,
    setSearchQuery,
    projectFilter,
    setProjectFilter,
    geocodingStatusFilter,
    setGeocodingStatusFilter,
    showFilters,
    setShowFilters,
    filteredLocations,
    clearFilters,
    activeFiltersCount,
  } = useEnhancedLocationFilters(locations);

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleGeocodeSingle = async (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    if (!location) return;

    setIsGeocoding(true);
    try {
      const result = await geocodingService.geocodeLocation(location);
      if (result.success) {
        toast({ title: "地理编码成功", description: `${location.name} 的坐标已更新` });
        loadData();
      } else {
        toast({ 
          title: "地理编码失败", 
          description: result.message, 
          variant: "destructive" 
        });
      }
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleBatchGeocode = async () => {
    if (selectedLocations.length === 0) {
      toast({ title: "请选择地点", description: "请至少选择一个地点进行批量地理编码" });
      return;
    }

    setIsGeocoding(true);
    try {
      const result = await batchGeocode(selectedLocations);
      toast({
        title: "批量地理编码完成",
        description: `成功: ${result.successCount}, 失败: ${result.failureCount}`
      });
      setSelectedLocations([]);
      setSelectAll(false);
      loadData();
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="地点管理（增强版）"
        description="管理地点信息并支持高德地图地理编码"
        icon={MapPin}
        iconColor="text-green-600"
      >
        <div className="flex gap-2">
          {showBatchActions && selectedLocations.length > 0 && (
            <Button
              onClick={handleBatchGeocode}
              disabled={isGeocoding}
              variant="outline"
            >
              <Map className="h-4 w-4 mr-2" />
              批量地理编码
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Zap className="h-4 w-4 mr-2" />
                批量操作
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowBatchActions(!showBatchActions)}>
                {showBatchActions ? '退出批量选择' : '进入批量选择'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowGeocodingInfo(!showGeocodingInfo)}>
                {showGeocodingInfo ? '隐藏统计信息' : '显示统计信息'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={handleOpenDialog}>
            <Plus className="h-4 w-4 mr-2" />
            添加地点
          </Button>
        </div>
      </PageHeader>

      {showGeocodingInfo && <GeocodingStatsCard stats={geocodingStats} />}

      <EnhancedLocationFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        projectFilter={projectFilter}
        setProjectFilter={setProjectFilter}
        geocodingStatusFilter={geocodingStatusFilter}
        setGeocodingStatusFilter={setGeocodingStatusFilter}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        clearFilters={clearFilters}
        activeFiltersCount={activeFiltersCount}
        projects={projects}
        totalCount={locations.length}
        filteredCount={filteredLocations.length}
      />

      <EnhancedLocationTable
        locations={filteredLocations}
        projects={projects}
        totalCount={locations.length}
        selectedLocations={selectedLocations}
        setSelectedLocations={setSelectedLocations}
        selectAll={selectAll}
        setSelectAll={setSelectAll}
        showBatchActions={showBatchActions}
        onEdit={handleEdit}
        onDelete={deleteLocation}
        onGeocode={handleGeocodeSingle}
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

