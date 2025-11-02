// 优化的权限选择器组件
import { useRef, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface OptimizedPermissionSelectorProps {
  title: string;
  permissions: any[];
  selectedPermissions: string[];
  onSelectionChange: (permissions: string[]) => void;
}

export function OptimizedPermissionSelector({ 
  title, 
  permissions, 
  selectedPermissions, 
  onSelectionChange
}: OptimizedPermissionSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleGroupToggle = useCallback((groupKey: string, checked: boolean) => {
    const group = permissions.find(p => p.key === groupKey);
    if (!group) return;

    const groupPermissions = group.children?.map((child: any) => child.key) || [];
    
    if (checked) {
      onSelectionChange([...selectedPermissions, ...groupPermissions]);
    } else {
      onSelectionChange(selectedPermissions.filter(p => !groupPermissions.includes(p)));
    }
  }, [permissions, selectedPermissions, onSelectionChange]);

  const handlePermissionToggle = useCallback((permissionKey: string, checked: boolean) => {
    // 保存滚动位置
    const scrollTop = scrollRef.current?.scrollTop || 0;
    
    if (checked) {
      onSelectionChange([...selectedPermissions, permissionKey]);
    } else {
      onSelectionChange(selectedPermissions.filter(p => p !== permissionKey));
    }
    
    // 恢复滚动位置 - 使用更稳定的方法
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollTop;
      }
    });
  }, [selectedPermissions, onSelectionChange]);

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-lg">{title}</h4>
      <div 
        ref={scrollRef}
        className="space-y-3 max-h-96 overflow-y-auto scroll-smooth border rounded-lg p-4 bg-gray-50/50"
        style={{ scrollbarWidth: 'thin' }}
      >
        {permissions.map(group => (
          <div key={group.key} className="space-y-2">
            <div className="flex items-center space-x-2 p-2 bg-white rounded border">
              <Checkbox
                id={group.key}
                checked={group.children?.every((child: any) => 
                  selectedPermissions.includes(child.key)
                )}
                onCheckedChange={(checked) => 
                  handleGroupToggle(group.key, checked as boolean)
                }
              />
              <Label htmlFor={group.key} className="font-medium">
                {group.label}
              </Label>
            </div>
            
            {group.children && (
              <div className="ml-6 space-y-1">
                {group.children.map((child: any) => (
                  <div key={child.key} className="flex items-center space-x-2 p-1 hover:bg-gray-100 rounded">
                    <Checkbox
                      id={child.key}
                      checked={selectedPermissions.includes(child.key)}
                      onCheckedChange={(checked) => 
                        handlePermissionToggle(child.key, checked as boolean)
                      }
                    />
                    <Label htmlFor={child.key} className="text-sm">
                      {child.label}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
