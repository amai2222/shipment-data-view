import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FileViewerDialog } from '@/components/FileViewerDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, Plus, Download, Eye, Trash2, FileText, History, Archive } from 'lucide-react';
import { format } from 'date-fns';

interface ContractFileVersion {
  id: string;
  contract_id: string;
  file_type: 'original' | 'attachment' | 'scan' | 'amendment';
  file_name: string;
  file_url: string;
  file_size?: number;
  file_hash?: string;
  version_number: number;
  is_current: boolean;
  uploaded_by?: string;
  uploaded_at: string;
  description?: string;
  // 关联信息
  uploader_name?: string;
  contract_number?: string;
}

interface ContractFileManagerProps {
  contractId?: string;
  contractNumber?: string;
  onFileUpdate?: () => void;
}

export function ContractFileManager({ contractId, contractNumber, onFileUpdate }: ContractFileManagerProps) {
  const [files, setFiles] = useState<ContractFileVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [currentFileUrl, setCurrentFileUrl] = useState('');
  const [currentFileName, setCurrentFileName] = useState('');
  const [formData, setFormData] = useState({
    file_type: 'attachment' as 'original' | 'attachment' | 'scan' | 'amendment',
    description: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    loadFiles();
  }, [contractId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      
      // 如果没有选择合同，返回空数组
      if (!contractId || contractId === '') {
        setFiles([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('contract_file_versions')
        .select(`
          *,
          contracts!inner(contract_number)
        `)
        .eq('contract_id', contractId)
        .order('version_number', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        // 如果表不存在，返回空数组而不是抛出错误
        if (error.message.includes('relation "contract_file_versions" does not exist')) {
          setFiles([]);
          return;
        }
        throw error;
      }
      
      const formattedData = (data || []).map(item => ({
        ...item,
        uploader_name: item.uploaded_by ? `用户 ${item.uploaded_by}` : null,
        contract_number: item.contracts?.contract_number
      }));

      setFiles(formattedData as any);
    } catch (error) {
      console.error('Error loading files:', error);
      toast({
        title: "错误",
        description: "加载文件列表失败，请检查数据库连接",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      toast({
        title: "错误",
        description: "请选择文件",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // 获取合同信息用于文件命名
      const { data: contractData } = await supabase
        .from('contracts')
        .select('contract_number, counterparty_company, our_company')
        .eq('id', contractId)
        .single();

      if (!contractData) {
        throw new Error('合同信息不存在');
      }

      const fileExtension = selectedFile.name.split('.').pop();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      
      // 使用合同编号作为前缀，确保文件命名规范
      const contractPrefix = contractData.contract_number || `CONTRACT-${contractId.slice(0, 8)}`;
      const customFileName = `${contractPrefix}-${formData.file_type}-${timestamp}.${fileExtension}`;
      
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64.split(',')[1]);
        };
        reader.readAsDataURL(selectedFile);
      });

      const { data, error } = await supabase.functions.invoke('qiniu-upload', {
        body: {
          files: [{
            fileName: selectedFile.name,
            fileData: fileData
          }],
          namingParams: {
            projectName: 'hetong',
            customName: customFileName
          }
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Upload failed');

      // 获取当前版本号
      const { data: maxVersion } = await supabase
        .from('contract_file_versions')
        .select('version_number')
        .eq('contract_id', contractId)
        .eq('file_type', formData.file_type)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const nextVersion = (maxVersion?.version_number || 0) + 1;

      // 如果是原件或附件，将其他版本设为非当前版本
      if (formData.file_type === 'original' || formData.file_type === 'attachment') {
        await supabase
          .from('contract_file_versions')
          .update({ is_current: false })
          .eq('contract_id', contractId)
          .eq('file_type', formData.file_type);
      }

      // 保存文件版本记录
      const { error: insertError } = await supabase
        .from('contract_file_versions')
        .insert({
          contract_id: contractId,
          file_type: formData.file_type,
          file_name: selectedFile.name,
          file_url: data.urls[0],
          file_size: selectedFile.size,
          version_number: nextVersion,
          is_current: true,
          description: formData.description || null
        });

      if (insertError) throw insertError;

      toast({
        title: "成功",
        description: "文件上传成功",
      });

      setShowForm(false);
      setSelectedFile(null);
      setFormData({
        file_type: 'attachment',
        description: ''
      });
      loadFiles();
      onFileUpdate?.();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "错误",
        description: "文件上传失败",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleViewFile = (fileUrl: string, fileName: string) => {
    setCurrentFileUrl(fileUrl);
    setCurrentFileName(fileName);
    setFileViewerOpen(true);
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('确定要删除这个文件吗？')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contract_file_versions')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "文件删除成功",
      });

      loadFiles();
      onFileUpdate?.();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "错误",
        description: "文件删除失败",
        variant: "destructive",
      });
    }
  };

  const handleSetCurrent = async (fileId: string, fileType: string) => {
    try {
      // 先将同类型的所有文件设为非当前版本
      await supabase
        .from('contract_file_versions')
        .update({ is_current: false })
        .eq('contract_id', contractId)
        .eq('file_type', fileType);

      // 将指定文件设为当前版本
      const { error } = await supabase
        .from('contract_file_versions')
        .update({ is_current: true })
        .eq('id', fileId);

      if (error) throw error;

      toast({
        title: "成功",
        description: "已设置为当前版本",
      });

      loadFiles();
      onFileUpdate?.();
    } catch (error) {
      console.error('Error setting current version:', error);
      toast({
        title: "错误",
        description: "设置当前版本失败",
        variant: "destructive",
      });
    }
  };

  const getFileTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'original': return 'default';
      case 'attachment': return 'secondary';
      case 'scan': return 'outline';
      case 'amendment': return 'destructive';
      default: return 'secondary';
    }
  };

  const getFileTypeText = (type: string) => {
    switch (type) {
      case 'original': return '原件';
      case 'attachment': return '附件';
      case 'scan': return '扫描件';
      case 'amendment': return '修订版';
      default: return type;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">合同文件管理</h2>
          {!contractId && (
            <p className="text-sm text-muted-foreground mt-1">
              请先在合同列表中选择一个合同，然后才能上传文件
            </p>
          )}
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button disabled={!contractId}>
              <Plus className="h-4 w-4 mr-2" />
              上传文件
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>上传文件</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file_type">文件类型</Label>
                <Select
                  value={formData.file_type}
                  onValueChange={(value: 'original' | 'attachment' | 'scan' | 'amendment') =>
                    setFormData(prev => ({ ...prev, file_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">原件</SelectItem>
                    <SelectItem value="attachment">附件</SelectItem>
                    <SelectItem value="scan">扫描件</SelectItem>
                    <SelectItem value="amendment">修订版</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="file">选择文件</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="mt-1"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    已选择: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description">文件描述</Label>
                <Textarea
                  id="description"
                  placeholder="输入文件描述（可选）"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  disabled={uploading}
                >
                  取消
                </Button>
                <Button
                  onClick={uploadFile}
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? '上传中...' : '上传'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Archive className="h-5 w-5 mr-2" />
            文件列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无文件
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文件类型</TableHead>
                  <TableHead>文件名</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>文件大小</TableHead>
                  <TableHead>上传时间</TableHead>
                  <TableHead>上传人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <Badge variant={getFileTypeBadgeVariant(file.file_type)}>
                        {getFileTypeText(file.file_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate" title={file.file_name}>
                        {file.file_name}
                      </div>
                      {file.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {file.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono">v{file.version_number}</span>
                        {file.is_current && (
                          <Badge variant="default" className="text-xs">
                            当前
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(file.file_size)}</TableCell>
                    <TableCell>
                      {format(new Date(file.uploaded_at), 'yyyy-MM-dd HH:mm')}
                    </TableCell>
                    <TableCell>{file.uploader_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={file.is_current ? 'default' : 'secondary'}>
                        {file.is_current ? '当前版本' : '历史版本'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewFile(file.file_url, file.file_name)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(file.file_url, '_blank')}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        {!file.is_current && (file.file_type === 'original' || file.file_type === 'attachment') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetCurrent(file.id, file.file_type)}
                          >
                            <History className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteFile(file.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
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

      <FileViewerDialog
        open={fileViewerOpen}
        onOpenChange={setFileViewerOpen}
        fileUrl={currentFileUrl}
        fileName={currentFileName}
      />
    </div>
  );
}
