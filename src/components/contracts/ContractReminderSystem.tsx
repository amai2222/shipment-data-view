import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Bell, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Plus,
  Settings,
  Mail,
  MessageSquare
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';

interface ContractReminder {
  id: string;
  contract_id: string;
  reminder_type: 'expiry_30' | 'expiry_60' | 'expiry_90' | 'custom';
  reminder_date: string;
  is_sent: boolean;
  sent_at?: string;
  recipient_emails?: string[];
  created_at: string;
  // 关联信息
  contract_number?: string;
  counterparty_company?: string;
  our_company?: string;
  end_date?: string;
}

interface ExpiringContract {
  id: string;
  contract_number: string;
  counterparty_company: string;
  our_company: string;
  end_date: string;
  responsible_person?: string;
  department?: string;
  days_until_expiry: number;
}

interface ContractReminderSystemProps {
  onReminderUpdate?: () => void;
}

export function ContractReminderSystem({ onReminderUpdate }: ContractReminderSystemProps) {
  const [reminders, setReminders] = useState<ContractReminder[]>([]);
  const [expiringContracts, setExpiringContracts] = useState<ExpiringContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedContract, setSelectedContract] = useState<string>('');
  const [reminderForm, setReminderForm] = useState({
    reminder_type: 'expiry_30' as 'expiry_30' | 'expiry_60' | 'expiry_90' | 'custom',
    custom_days: 30,
    recipient_emails: ''
  });

  const { toast } = useToast();

  useEffect(() => {
    loadReminders();
    loadExpiringContracts();
  }, []);

  const loadReminders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_reminders')
        .select(`
          *,
          contracts!inner(contract_number, counterparty_company, our_company, end_date)
        `)
        .order('reminder_date', { ascending: true });

      if (error) {
        console.error('Database error:', error);
        // 如果表不存在，返回空数组而不是抛出错误
        if (error.message.includes('relation "contract_reminders" does not exist')) {
          setReminders([]);
          return;
        }
        throw error;
      }
      
      const formattedData = (data || []).map(item => ({
        ...item,
        contract_number: item.contracts?.contract_number,
        counterparty_company: item.contracts?.counterparty_company,
        our_company: item.contracts?.our_company,
        end_date: item.contracts?.end_date
      }));

      setReminders(formattedData as any);
    } catch (error) {
      console.error('Error loading reminders:', error);
      toast({
        title: "错误",
        description: "加载提醒列表失败，请检查数据库连接",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExpiringContracts = async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, contract_number, counterparty_company, our_company, end_date, responsible_person, department')
        .eq('status', 'active')
        .order('end_date', { ascending: true });

      if (error) throw error;
      
      const today = new Date();
      const expiring = (data || [])
        .map(contract => {
          const endDate = new Date(contract.end_date);
          const daysUntilExpiry = differenceInDays(endDate, today);
          return {
            ...contract,
            days_until_expiry: daysUntilExpiry
          };
        })
        .filter(contract => contract.days_until_expiry <= 90 && contract.days_until_expiry >= 0);

      setExpiringContracts(expiring);
    } catch (error) {
      console.error('Error loading expiring contracts:', error);
    }
  };

  const createReminder = async () => {
    if (!selectedContract) {
      toast({
        title: "错误",
        description: "请选择合同",
        variant: "destructive",
      });
      return;
    }

    try {
      const contract = expiringContracts.find(c => c.id === selectedContract);
      if (!contract) return;

      let reminderDate: Date;
      if (reminderForm.reminder_type === 'custom') {
        reminderDate = addDays(new Date(contract.end_date), -reminderForm.custom_days);
      } else {
        const days = parseInt(reminderForm.reminder_type.replace('expiry_', ''));
        reminderDate = addDays(new Date(contract.end_date), -days);
      }

      const recipientEmails = reminderForm.recipient_emails
        .split(',')
        .map(email => email.trim())
        .filter(email => email);

      const { error } = await supabase
        .from('contract_reminders')
        .insert({
          contract_id: selectedContract,
          reminder_type: reminderForm.reminder_type,
          reminder_date: reminderDate.toISOString().split('T')[0],
          recipient_emails: recipientEmails.length > 0 ? recipientEmails : null
        });

      if (error) throw error;

      toast({
        title: "成功",
        description: "提醒已创建",
      });

      setShowCreateDialog(false);
      setSelectedContract('');
      setReminderForm({
        reminder_type: 'expiry_30',
        custom_days: 30,
        recipient_emails: ''
      });
      loadReminders();
      onReminderUpdate?.();
    } catch (error) {
      console.error('Error creating reminder:', error);
      toast({
        title: "错误",
        description: "创建提醒失败",
        variant: "destructive",
      });
    }
  };

  const sendReminder = async (reminderId: string) => {
    try {
      // 这里可以调用发送邮件的API
      const { error } = await supabase
        .from('contract_reminders')
        .update({
          is_sent: true,
          sent_at: new Date().toISOString()
        })
        .eq('id', reminderId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "提醒已发送",
      });

      loadReminders();
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast({
        title: "错误",
        description: "发送提醒失败",
        variant: "destructive",
      });
    }
  };

  const deleteReminder = async (reminderId: string) => {
    if (!confirm('确定要删除这个提醒吗？')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contract_reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "提醒已删除",
      });

      loadReminders();
      onReminderUpdate?.();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast({
        title: "错误",
        description: "删除提醒失败",
        variant: "destructive",
      });
    }
  };

  const getReminderTypeText = (type: string) => {
    switch (type) {
      case 'expiry_30': return '到期前30天';
      case 'expiry_60': return '到期前60天';
      case 'expiry_90': return '到期前90天';
      case 'custom': return '自定义';
      default: return type;
    }
  };

  const getDaysUntilExpiryBadge = (days: number) => {
    if (days <= 0) {
      return <Badge variant="destructive">已过期</Badge>;
    } else if (days <= 7) {
      return <Badge variant="destructive">{days}天后到期</Badge>;
    } else if (days <= 30) {
      return <Badge variant="default">{days}天后到期</Badge>;
    } else {
      return <Badge variant="secondary">{days}天后到期</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">合同到期提醒</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              创建提醒
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>创建到期提醒</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>选择合同</Label>
                <Select value={selectedContract} onValueChange={setSelectedContract}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择即将到期的合同" />
                  </SelectTrigger>
                  <SelectContent>
                    {expiringContracts.map(contract => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.contract_number} - {contract.counterparty_company} 
                        ({contract.days_until_expiry}天后到期)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>提醒类型</Label>
                <Select
                  value={reminderForm.reminder_type}
                  onValueChange={(value: 'expiry_30' | 'expiry_60' | 'expiry_90' | 'custom') =>
                    setReminderForm(prev => ({ ...prev, reminder_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expiry_30">到期前30天</SelectItem>
                    <SelectItem value="expiry_60">到期前60天</SelectItem>
                    <SelectItem value="expiry_90">到期前90天</SelectItem>
                    <SelectItem value="custom">自定义天数</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reminderForm.reminder_type === 'custom' && (
                <div>
                  <Label>提前天数</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={reminderForm.custom_days}
                    onChange={(e) => setReminderForm(prev => ({ 
                      ...prev, 
                      custom_days: parseInt(e.target.value) || 30 
                    }))}
                  />
                </div>
              )}

              <div>
                <Label>收件人邮箱（可选，用逗号分隔）</Label>
                <Input
                  placeholder="email1@example.com, email2@example.com"
                  value={reminderForm.recipient_emails}
                  onChange={(e) => setReminderForm(prev => ({ 
                    ...prev, 
                    recipient_emails: e.target.value 
                  }))}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  取消
                </Button>
                <Button onClick={createReminder}>
                  创建提醒
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 即将到期的合同 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
            即将到期的合同
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expiringContracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无即将到期的合同
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>合同编号</TableHead>
                  <TableHead>对方公司</TableHead>
                  <TableHead>我方公司</TableHead>
                  <TableHead>结束日期</TableHead>
                  <TableHead>剩余天数</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead>部门</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringContracts.map(contract => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-mono">{contract.contract_number}</TableCell>
                    <TableCell>{contract.counterparty_company}</TableCell>
                    <TableCell>{contract.our_company}</TableCell>
                    <TableCell>{format(new Date(contract.end_date), 'yyyy-MM-dd')}</TableCell>
                    <TableCell>{getDaysUntilExpiryBadge(contract.days_until_expiry)}</TableCell>
                    <TableCell>{contract.responsible_person || '-'}</TableCell>
                    <TableCell>{contract.department || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 提醒列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            提醒列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无提醒记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>合同编号</TableHead>
                  <TableHead>对方公司</TableHead>
                  <TableHead>提醒类型</TableHead>
                  <TableHead>提醒日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>收件人</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reminders.map(reminder => (
                  <TableRow key={reminder.id}>
                    <TableCell className="font-mono">{reminder.contract_number}</TableCell>
                    <TableCell>{reminder.counterparty_company}</TableCell>
                    <TableCell>{getReminderTypeText(reminder.reminder_type)}</TableCell>
                    <TableCell>{format(new Date(reminder.reminder_date), 'yyyy-MM-dd')}</TableCell>
                    <TableCell>
                      <Badge variant={reminder.is_sent ? 'default' : 'secondary'}>
                        {reminder.is_sent ? '已发送' : '待发送'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {reminder.recipient_emails?.length || 0} 人
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {!reminder.is_sent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendReminder(reminder.id)}
                          >
                            <Mail className="h-3 w-3 mr-1" />
                            发送
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteReminder(reminder.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
