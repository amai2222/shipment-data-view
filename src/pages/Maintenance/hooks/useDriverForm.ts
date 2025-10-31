import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { SupabaseStorage } from "@/utils/supabase";
import { Driver } from "@/types";

interface FormData {
  name: string;
  licensePlate: string;
  phone: string;
  projectIds: string[];
}

interface DriverPhotos {
  id_card_photos: string[];
  driver_license_photos: string[];
  qualification_certificate_photos: string[];
}

interface VehiclePhotos {
  driving_license_photos: string[];
  transport_license_photos: string[];
}

export function useDriverForm(reloadData: () => void) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    name: "",
    licensePlate: "",
    phone: "",
    projectIds: [],
  });

  const [driverPhotos, setDriverPhotos] = useState<DriverPhotos>({
    id_card_photos: [],
    driver_license_photos: [],
    qualification_certificate_photos: []
  });

  const [vehiclePhotos, setVehiclePhotos] = useState<VehiclePhotos>({
    driving_license_photos: [],
    transport_license_photos: []
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      licensePlate: "",
      phone: "",
      projectIds: [],
    });
    setDriverPhotos({
      id_card_photos: [],
      driver_license_photos: [],
      qualification_certificate_photos: []
    });
    setVehiclePhotos({
      driving_license_photos: [],
      transport_license_photos: []
    });
    setEditingDriver(null);
  }, []);

  const handleEdit = (driver: Driver) => {
    setFormData({
      name: driver.name,
      licensePlate: driver.licensePlate,
      phone: driver.phone,
      projectIds: driver.projectIds || [],
    });
    setDriverPhotos({
      id_card_photos: driver.id_card_photos || [],
      driver_license_photos: driver.driver_license_photos || [],
      qualification_certificate_photos: driver.qualification_certificate_photos || []
    });
    setVehiclePhotos({
      driving_license_photos: driver.driving_license_photos || [],
      transport_license_photos: driver.transport_license_photos || []
    });
    setEditingDriver(driver);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.licensePlate) {
      toast({
        title: "表单验证失败",
        description: "请填写司机姓名和车牌号",
        variant: "destructive",
      });
      return;
    }

    try {
      const driverData = {
        ...formData,
        ...driverPhotos,
        ...vehiclePhotos,
      };

      if (editingDriver) {
        await SupabaseStorage.updateDriver(editingDriver.id, driverData);
        toast({
          title: "更新成功",
          description: "司机信息已成功更新。",
        });
      } else {
        await SupabaseStorage.addDriver(driverData);
        toast({
          title: "添加成功",
          description: "新司机已成功添加。",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      reloadData();
    } catch (error: any) {
      console.error('Error saving driver:', error);
      toast({
        title: editingDriver ? "更新失败" : "添加失败",
        description: error.message || "操作失败，请重试。",
        variant: "destructive",
      });
    }
  };

  return {
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
  };
}

