// --- 文件: src/components/AddShipmentDialog.tsx ---

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  project_name: z.string().min(2, { message: "项目名称至少需要2个字符。" }),
  license_plate: z.string().min(7, { message: "请输入有效的车牌号。" }),
  driver_name: z.string().min(2, { message: "请输入司机姓名。" }),
  driver_phone: z.string().regex(/^1\d{10}$/, { message: "请输入有效的11位手机号。" }),
  payable_cost: z.coerce.number().min(0, { message: "成本不能为负数。" }),
});

interface AddShipmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: z.infer<typeof formSchema>) => void;
}

export function AddShipmentDialog({ isOpen, onClose, onSave }: AddShipmentDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_name: "",
      license_plate: "",
      driver_name: "",
      driver_phone: "",
      payable_cost: 0,
    },
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      onClose();
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    onSave(values);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>新增运单</DialogTitle>
          <DialogDescription>填写新的运单信息。完成后点击保存。</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="project_name" render={({ field }) => ( <FormItem> <FormLabel>项目名称</FormLabel> <FormControl> <Input placeholder="例如：上海-北京专线" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="license_plate" render={({ field }) => ( <FormItem> <FormLabel>车牌号</FormLabel> <FormControl> <Input placeholder="例如：沪A88888" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="driver_name" render={({ field }) => ( <FormItem> <FormLabel>司机姓名</FormLabel> <FormControl> <Input placeholder="张三" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="driver_phone" render={({ field }) => ( <FormItem> <FormLabel>司机电话</FormLabel> <FormControl> <Input type="tel" placeholder="13800138000" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <FormField control={form.control} name="payable_cost" render={({ field }) => ( <FormItem> <FormLabel>应付成本 (元)</FormLabel> <FormControl> <Input type="number" {...field} /> </FormControl> <FormMessage /> </FormItem> )}/>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>取消</Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
