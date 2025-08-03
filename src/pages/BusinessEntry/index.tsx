// src/pages/BusinessEntry/index.tsx

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileDown, FileUp, PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";

import { Project, Driver, Location, LogisticsRecord, PartnerChain } from './types';
import { useLogisticsData } from './hooks/useLogisticsData';
import { useLogisticsForm } from './hooks/useLogisticsForm';
import { useExcelImport } from './hooks/useExcelImport';
import { FilterBar } from './components/FilterBar';
import { LogisticsTable } from './components/LogisticsTable';
import { LogisticsFormDialog } from './components/LogisticsFormDialog';
import { ImportDialog } from './components/ImportDialog';

// Define types for the link tables
type DriverProjectLink = { driver_id: string; project_id: string; };
type LocationProjectLink = { location_id: string; project_id: string; };

export default function BusinessEntry() {
  const { toast } = useToast();
  
  // Centralized state for all source data
  const [projects, setProjects] = useState<Project[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [partnerChains, setPartnerChains] = useState<PartnerChain[]>([]);
  const [driverProjectLinks, setDriverProjectLinks] = useState<DriverProjectLink[]>([]);
  const [locationProjectLinks, setLocationProjectLinks] = useState<LocationProjectLink[]>([]);
  
  const [viewingRecord, setViewingRecord] = useState<LogisticsRecord | null>(null);

  // Hooks for different concerns
  const { records, loading, filters, setFilters, pagination, setPagination, summary, handleDelete, refetch } = useLogisticsData();
  const { isModalOpen, setIsModalOpen, editingRecord, formData, dispatch, handleOpenModal, handleSubmit } = useLogisticsForm(projects, () => {
    refetch();
    loadInitialOptions();
  });
  const { isImporting, isImportModalOpen, importStep, importPreview, approvedDuplicates, importLogs, importLogRef, handleExcelImport, executeFinalImport, closeImportModal, setApprovedDuplicates } = useExcelImport(() => {
    refetch();
    loadInitialOptions();
  });

  // Load ALL necessary data once on component mount
  const loadInitialOptions = useCallback(async () => {
    try {
      const [
        projectsRes, driversRes, locationsRes, partnerChainsRes, driverLinksRes, locationLinksRes
      ] = await Promise.all([
        supabase.from('projects').select('id, name, start_date'),
        supabase.from('drivers').select('id, name, license_plate, phone'),
        supabase.from('locations').select('id, name'),
        supabase.from('partner_chains').select('id, project_id, chain_name'),
        supabase.from('driver_projects').select('driver_id, project_id'),
        supabase.from('location_projects').select('location_id, project_id')
      ]);

      setProjects(projectsRes.data || []);
      setDrivers(driversRes.data || []);
      setLocations(locationsRes.data || []);
      setPartnerChains(partnerChainsRes.data || []);
      setDriverProjectLinks(driverLinksRes.data || []);
      setLocationProjectLinks(locationLinksRes.data || []);

    } catch (error) { toast({ title: "错误", description: "加载页面基础数据失败", variant: "destructive" }); }
  }, [toast]);

  useEffect(() => {
    loadInitialOptions();
  }, [loadInitialOptions]);

  // THE CRITICAL FIX: Reset dependent form fields when the project changes.
  // This now happens in the top-level component.
  useEffect(() => {
    if (isModalOpen) { // Only run this logic when the form is open
      dispatch({ type: 'SET_FIELD', field: 'chain_id', payload: null });
      dispatch({ type: 'SET_FIELD', field: 'driver_id', payload: '' });
      dispatch({ type: 'SET_FIELD', field: 'driver_name', payload: '' });
    }
  }, [formData.project_id, isModalOpen, dispatch]);

  // DERIVED STATE: Calculate filtered lists synchronously on every render.
  // useMemo ensures this is performant.
  const filteredChainsForForm = useMemo(() => {
    return partnerChains.filter(c => c.project_id === formData.project_id);
  }, [formData.project_id, partnerChains]);

  const filteredDriversForForm = useMemo(() => {
    const relevantDriverIds = new Set(driverProjectLinks.filter(l => l.project_id === formData.project_id).map(l => l.driver_id));
    return drivers.filter(d => relevantDriverIds.has(d.id));
  }, [formData.project_id, driverProjectLinks, drivers]);

  const filteredLocationsForForm = useMemo(() => {
    const relevantLocationIds = new Set(locationProjectLinks.filter(l => l.project_id === formData.project_id).map(l => l.location_id));
    return locations.filter(l => relevantLocationIds.has(l.id));
  }, [formData.project_id, locationProjectLinks, locations]);

  // Export logic
  const exportToExcel = async () => {
    // ... (export logic remains the same)
  };
  const handleTemplateDownload = () => {
    // ... (template download logic remains the same)
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {/* ... (header remains the same) */}
      </div>

      <FilterBar filters={filters} setFilters={setFilters} loading={loading} />

      <LogisticsTable
        records={records}
        loading={loading}
        summary={summary}
        pagination={pagination}
        setPagination={setPagination}
        onEdit={handleOpenModal}
        onDelete={handleDelete}
        onView={setViewingRecord}
      />

      <LogisticsFormDialog
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSubmit={handleSubmit}
        editingRecord={editingRecord}
        formData={formData}
        dispatch={dispatch}
        projects={projects}
        // Pass the synchronously derived, always-correct lists
        filteredDrivers={filteredDriversForForm}
        filteredLocations={filteredLocationsForForm}
        partnerChains={filteredChainsForForm}
      />

      <ImportDialog
        isOpen={isImportModalOpen}
        onClose={closeImportModal}
        importStep={importStep}
        importPreview={importPreview}
        approvedDuplicates={approvedDuplicates}
        setApprovedDuplicates={setApprovedDuplicates}
        importLogs={importLogs}
        importLogRef={importLogRef}
        onExecuteImport={executeFinalImport}
      />
      
      <Dialog open={!!viewingRecord} onOpenChange={(isOpen) => !isOpen && setViewingRecord(null)}>
        {/* ... (viewing dialog remains the same) */}
      </Dialog>
    </div>
  );
}
