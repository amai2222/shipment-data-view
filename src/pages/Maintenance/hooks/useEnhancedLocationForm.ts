import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { LocationWithGeocoding } from '@/services/LocationGeocodingService';

interface FormData {
  name: string;
  address: string;
  projectIds: string[];
}

export function useEnhancedLocationForm(
  geocodingService: any,
  reloadData: () => void
) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationWithGeocoding | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    address: "",
    projectIds: [],
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      address: "",
      projectIds: [],
    });
    setEditingLocation(null);
  }, []);

  const handleEdit = (location: LocationWithGeocoding) => {
    setFormData({
      name: location.name,
      address: location.address || location.name,
      projectIds: location.projectIds || [],
    });
    setEditingLocation(location);
    setIsDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name: name,
      address: name
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast({
        title: "表单验证失败",
        description: "请填写地点名称",
        variant: "destructive",
      });
      return;
    }

    try {
      const locationData = {
        name: formData.name,
        address: formData.address || formData.name,
        projectIds: formData.projectIds,
      };

      if (editingLocation) {
        await geocodingService.updateLocation(editingLocation.id, locationData);
        toast({
          title: "更新成功",
          description: "地点信息已成功更新。",
        });
      } else {
        await geocodingService.createLocation(locationData);
        toast({
          title: "添加成功",
          description: "新地点已成功添加。",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      reloadData();
    } catch (error: any) {
      console.error('Error saving location:', error);
      toast({
        title: editingLocation ? "更新失败" : "添加失败",
        description: error.message || "操作失败，请重试。",
        variant: "destructive",
      });
    }
  };

  return {
    isDialogOpen,
    setIsDialogOpen,
    editingLocation,
    formData,
    setFormData,
    resetForm,
    handleEdit,
    handleNameChange,
    handleSubmit,
  };
}

