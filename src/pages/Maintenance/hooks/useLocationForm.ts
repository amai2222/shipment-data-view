import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Location } from "@/types";

interface FormData {
  name: string;
  projectIds: string[];
}

export function useLocationForm(reloadData: () => void) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    projectIds: [],
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      projectIds: [],
    });
    setEditingLocation(null);
  }, []);

  const handleEdit = (location: Location) => {
    setFormData({
      name: location.name,
      projectIds: location.projectIds || [],
    });
    setEditingLocation(location);
    setIsDialogOpen(true);
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
      if (editingLocation) {
        await SupabaseStorage.updateLocation(editingLocation.id, formData);
        toast({
          title: "更新成功",
          description: "地点信息已成功更新。",
        });
      } else {
        await SupabaseStorage.addLocation(formData);
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
    handleSubmit,
  };
}

