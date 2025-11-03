// 权限选择器组件 - 统一权限选择逻辑

import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PermissionGroup, PermissionItem } from '@/types/permission';

interface PermissionSelectorProps {
  title: string;
  permissions: PermissionGroup[];
  selectedPermissions: string[];
  onPermissionChange: (permissions: string[]) => void;
  disabled?: boolean;
}

export function PermissionSelector({ 
  title, 
  permissions, 
  selectedPermissions, 
  onPermissionChange,
  disabled = false 
}: PermissionSelectorProps) {
  
  // 切换单个权限
  const togglePermission = (permissionKey: string) => {
    if (disabled) return;
    
    const newPermissions = selectedPermissions.includes(permissionKey)
      ? selectedPermissions.filter(p => p !== permissionKey)
      : [...selectedPermissions, permissionKey];
    
    onPermissionChange(newPermissions);
  };

  // 切换组权限
  const toggleGroup = (group: PermissionGroup) => {
    if (disabled) return;
    
    const groupPermissions = group.children.map(child => child.key);
    const allSelected = groupPermissions.every(p => selectedPermissions.includes(p));
    
    if (allSelected) {
      // 取消选择整个组
      const newPermissions = selectedPermissions.filter(p => !groupPermissions.includes(p));
      onPermissionChange(newPermissions);
    } else {
      // 选择整个组
      const newPermissions = [...new Set([...selectedPermissions, ...groupPermissions])];
      onPermissionChange(newPermissions);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="text-sm text-muted-foreground">
          已选择 {selectedPermissions.length} 个权限
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {permissions.map(group => {
          const groupPermissions = group.children.map(child => child.key);
          const selectedCount = groupPermissions.filter(p => selectedPermissions.includes(p)).length;
          const allSelected = selectedCount === groupPermissions.length;
          const someSelected = selectedCount > 0 && selectedCount < groupPermissions.length;

          return (
            <div key={group.key} className="border rounded-lg p-3 bg-gradient-to-r from-blue-50 to-white">
              {/* 组标题 */}
              <div className="flex items-center space-x-2 mb-3 pb-2 border-b">
                <Checkbox
                  id={`group-${group.key}`}
                  checked={allSelected}
                  ref={(el) => {
                    if (el && el instanceof HTMLInputElement) {
                      el.indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={() => toggleGroup(group)}
                  disabled={disabled}
                />
                <Label 
                  htmlFor={`group-${group.key}`}
                  className="font-semibold text-base cursor-pointer flex items-center gap-2"
                >
                  📁 {group.label}
                </Label>
                <Badge variant="secondary" className="ml-auto">
                  {selectedCount}/{groupPermissions.length}
                </Badge>
              </div>

              {/* 权限项 */}
              <div className="ml-6 space-y-1.5">
                {group.children.map(item => (
                  <div key={item.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`permission-${item.key}`}
                      checked={selectedPermissions.includes(item.key)}
                      onCheckedChange={() => togglePermission(item.key)}
                      disabled={disabled}
                    />
                    <Label 
                      htmlFor={`permission-${item.key}`}
                      className="text-sm cursor-pointer"
                    >
                      {item.label}
                    </Label>
                    {item.description && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {item.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
