import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

interface OtherPlatformNamesDisplayProps {
  platformNames?: string[];
  className?: string;
}

export function OtherPlatformNamesDisplay({
  platformNames,
  className = ''
}: OtherPlatformNamesDisplayProps) {

  // 如果没有平台名称或为空数组，不显示
  if (!platformNames || platformNames.length === 0) {
    return null;
  }

  // 过滤空字符串
  const validPlatformNames = platformNames.filter(name => name.trim() !== '');

  if (validPlatformNames.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ExternalLink className="h-4 w-4" />
          其他平台
          <Badge variant="outline" className="text-xs">
            {validPlatformNames.length} 个
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {validPlatformNames.map((platform, index) => (
            <Badge key={index} variant="secondary" className="text-sm">
              {platform}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default OtherPlatformNamesDisplay;
