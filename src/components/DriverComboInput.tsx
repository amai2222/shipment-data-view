import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Driver {
  id: string;
  name: string;
  license_plate: string | null;
  phone: string | null;
}

interface DriverComboInputProps {
  drivers: Driver[];
  value: string;
  onChange: (driverId: string, driverData?: { name: string; license_plate: string; phone: string }) => void;
  onDriversUpdate?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DriverComboInput({
  drivers,
  value,
  onChange,
  onDriversUpdate,
  disabled = false,
  placeholder = "搜索或选择司机",
}: DriverComboInputProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDriverData, setNewDriverData] = useState({
    name: "",
    license_plate: "",
    phone: "",
  });
  const { toast } = useToast();

  const selectedDriver = drivers.find((driver) => driver.id === value);

  // 当搜索值变化时，如果没有匹配结果，显示添加按钮
  const filteredDrivers = drivers.filter((driver) =>
    driver.name.toLowerCase().includes(searchValue.toLowerCase()) ||
    (driver.license_plate && driver.license_plate.toLowerCase().includes(searchValue.toLowerCase())) ||
    (driver.phone && driver.phone.includes(searchValue))
  );

  const handleAddDriver = async () => {
    if (!newDriverData.name.trim()) {
      toast({
        title: "错误",
        description: "司机姓名不能为空",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("drivers")
        .insert({
          name: newDriverData.name.trim(),
          license_plate: newDriverData.license_plate.trim() || null,
          phone: newDriverData.phone.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "成功",
        description: `司机 ${newDriverData.name} 已添加`,
      });

      // 通知父组件更新司机列表
      if (onDriversUpdate) {
        onDriversUpdate();
      }

      // 自动选择新添加的司机
      if (data) {
        onChange(data.id, {
          name: data.name,
          license_plate: data.license_plate || "",
          phone: data.phone || "",
        });
      }

      // 关闭对话框并重置表单
      setShowAddDialog(false);
      setNewDriverData({ name: "", license_plate: "", phone: "" });
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "添加失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedDriver ? (
              <span className="flex items-center gap-2 truncate">
                <span className="font-medium">{selectedDriver.name}</span>
                {selectedDriver.license_plate && (
                  <span className="text-xs text-muted-foreground">
                    {selectedDriver.license_plate}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput
              placeholder="搜索司机姓名、车牌或电话..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 py-6">
                  <p className="text-sm text-muted-foreground">未找到匹配的司机</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewDriverData({ name: searchValue, license_plate: "", phone: "" });
                      setShowAddDialog(true);
                    }}
                    className="mt-2"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    添加新司机 "{searchValue}"
                  </Button>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {filteredDrivers.map((driver) => (
                  <CommandItem
                    key={driver.id}
                    value={driver.id}
                    onSelect={(currentValue) => {
                      const selectedDriver = drivers.find(d => d.id === currentValue);
                      if (selectedDriver) {
                        onChange(currentValue, {
                          name: selectedDriver.name,
                          license_plate: selectedDriver.license_plate || "",
                          phone: selectedDriver.phone || "",
                        });
                      }
                      setOpen(false);
                      setSearchValue("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === driver.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium truncate">{driver.name}</span>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {driver.license_plate && (
                          <span>🚗 {driver.license_plate}</span>
                        )}
                        {driver.phone && (
                          <span>📱 {driver.phone}</span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setNewDriverData({ name: searchValue, license_plate: "", phone: "" });
                setShowAddDialog(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              添加自定义司机
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* 添加新司机对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新司机</DialogTitle>
            <DialogDescription>
              输入新司机的信息，司机信息将保存到数据库中供后续使用
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="driver-name">司机姓名 *</Label>
              <Input
                id="driver-name"
                value={newDriverData.name}
                onChange={(e) =>
                  setNewDriverData({ ...newDriverData, name: e.target.value })
                }
                placeholder="输入司机姓名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license-plate">车牌号</Label>
              <Input
                id="license-plate"
                value={newDriverData.license_plate}
                onChange={(e) =>
                  setNewDriverData({
                    ...newDriverData,
                    license_plate: e.target.value,
                  })
                }
                placeholder="输入车牌号"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="driver-phone">司机电话</Label>
              <Input
                id="driver-phone"
                value={newDriverData.phone}
                onChange={(e) =>
                  setNewDriverData({ ...newDriverData, phone: e.target.value })
                }
                placeholder="输入司机电话"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setNewDriverData({ name: "", license_plate: "", phone: "" });
              }}
            >
              取消
            </Button>
            <Button onClick={handleAddDriver}>添加司机</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

