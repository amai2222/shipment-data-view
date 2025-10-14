import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, AlertCircle } from "lucide-react";

interface BatchInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: string[]) => void;
  title: string;
  placeholder: string;
  description: string;
  currentValue: string;
}

export function BatchInputDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  placeholder,
  description,
  currentValue
}: BatchInputDialogProps) {
  const [inputValue, setInputValue] = useState("");
  const [parsedValues, setParsedValues] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputValue(currentValue);
      parseValues(currentValue);
    }
  }, [isOpen, currentValue]);

  const parseValues = (value: string) => {
    if (!value.trim()) {
      setParsedValues([]);
      return;
    }

    // 支持逗号和换行符分隔
    const values = value
      .split(/[,\n]/)
      .map(v => v.trim())
      .filter(v => v.length > 0);

    setParsedValues(values);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    parseValues(value);
  };

  const handleConfirm = () => {
    const finalValues = parsedValues.join(',');
    onConfirm(parsedValues);
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inputValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputValue(text);
      parseValues(text);
    } catch (err) {
      console.error('粘贴失败:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{title}</span>
            <Badge variant="secondary" className="text-xs">
              批量输入
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 说明文字 */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">{description}</p>
              <p className="text-xs text-blue-600">
                支持逗号（,）或换行符分隔多个值，系统会自动去除空格
              </p>
            </div>
          </div>

          {/* 输入区域 */}
          <div className="space-y-2">
            <Label htmlFor="batch-input" className="text-sm font-medium">
              输入内容
            </Label>
            <div className="relative">
              <Textarea
                id="batch-input"
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                className="min-h-[120px] resize-none"
                autoFocus
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-6 w-6 p-0"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePaste}
              className="text-xs"
            >
              粘贴剪贴板内容
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInputValue("");
                setParsedValues([]);
              }}
              className="text-xs"
            >
              清空
            </Button>
          </div>

          {/* 解析结果预览 */}
          {parsedValues.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                解析结果 ({parsedValues.length} 项)
              </Label>
              <div className="max-h-32 overflow-y-auto p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex flex-wrap gap-1">
                  {parsedValues.map((value, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {value}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 空值提示 */}
          {inputValue.trim() && parsedValues.length === 0 && (
            <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                未检测到有效内容，请检查输入格式
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={parsedValues.length === 0}>
            确认 ({parsedValues.length} 项)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
