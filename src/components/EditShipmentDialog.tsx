// --- 文件: src/components/EditShipmentDialog.tsx ---

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LogisticsRecord } from "@/types";

const formSchema = z.object({
  project_name: z.string().min(2, { message: "项目名称至少需要2个字符。" }),
  license_plate: z.string().min(7, { message: "请输入有效的车牌号。" }),
  driver_name: z.string().min(2, { message: "请输入司机姓名。" }),
  driver_phone: z.string().regex(/^1\d{10}$/, { message: "请输入有效的11位手机号。" }),
  payable_cost: z.coerce.number().min(0, { message: "成本不能为负数。" }),
});

interface EditShipmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LogisticsRecord) => void;
  shipment: LogisticsRecord | null;
}

export function EditShipmentDialog({ isOpen, onClose, onSave, shipment }: EditShipmentDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (shipment) {
      form.reset({
        project_name: shipment.project_name,
        license_plate: shipment.license_plate,
        driver_name: shipment.driver_name,
        driver_phone: shipment.driver_phone,
        payable_cost: shipment.payable_cost,
      });
    }
  }, [shipment, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!shipment) return;
    const updatedShipment = {
        ...shipment,
        ...values,
    };
    onSave(updatedShipment);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>编辑运单记录</DialogTitle>
          <DialogDescription>修改运单信息。完成后点击保存。</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="project_name" render={({ field }) => ( <FormItem> <FormLabel>项目名称</FormLabel> <FormControl> <Input {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="license_plate" render={({ field }) => ( <FormItem> <FormLabel>车牌号</FormLabel> <FormControl> <Input {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="driver_name" render={({ field }) => ( <FormItem> <FormLabel>司机姓名</FormLabel> <FormControl> <Input {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="driver_phone" render={({ field }) => ( <FormItem> <FormLabel>司机电话</FormLabel> <FormControl> <Input type="tel" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="payable_cost" render={({ field }) => ( <FormItem> <FormLabel>应付成本 (元)</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>取消</Button>
              <Button type="submit">保存更改</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
