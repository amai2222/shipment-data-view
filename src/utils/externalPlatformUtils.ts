// 外部平台数据处理工具 - 借鉴数据维护-数据导入的专业处理
// 支持复杂的JSONB格式转换和多平台数据处理

export interface ExternalTrackingNumber {
  platform: string;
  tracking_number: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  created_at: string;
}

export interface ProcessedPlatformData {
  externalTrackingNumbers: ExternalTrackingNumber[] | null;
  otherPlatformNames: string[] | null;
}

// 处理外部平台数据
export const processExternalPlatformData = (rowData: any): ProcessedPlatformData => {
  console.log('开始处理外部平台数据:', {
    platformNames: rowData['其他平台名称'],
    trackingNumbers: rowData['其他平台运单号']
  });

  let externalTrackingNumbers: ExternalTrackingNumber[] | null = null;
  let otherPlatformNames: string[] | null = null;
  
  if (rowData['其他平台名称'] || rowData['其他平台运单号']) {
    // 处理平台名称
    const platformNames = rowData['其他平台名称']?.toString()
      .split(',')
      .map((name: string) => name.trim())
      .filter((name: string) => name) || [];
    
    // 处理运单号组
    const platformTrackingGroups = rowData['其他平台运单号']?.toString()
      .split(',')
      .map((group: string) => group.trim())
      .filter((group: string) => group) || [];
    
    console.log('解析的平台数据:', {
      platformNames,
      platformTrackingGroups
    });
    
    // 处理外部运单号（JSONB格式）
    const trackingNumbers: ExternalTrackingNumber[] = [];
    
    for (let i = 0; i < platformNames.length; i++) {
      const platformName = platformNames[i];
      const trackingGroup = platformTrackingGroups[i] || '';
      
      // 每个平台的运单号用|分隔
      const trackingNumbersList = trackingGroup 
        ? trackingGroup.split('|')
            .map((tn: string) => tn.trim())
            .filter((tn: string) => tn) 
        : [];
      
      console.log(`处理平台 ${platformName}:`, {
        trackingGroup,
        trackingNumbersList
      });
      
      if (platformName && trackingNumbersList.length > 0) {
        trackingNumbersList.forEach(trackingNumber => {
          trackingNumbers.push({
            platform: platformName,
            tracking_number: trackingNumber,
            status: 'pending',
            created_at: new Date().toISOString()
          });
        });
      }
    }
    
    if (trackingNumbers.length > 0) {
      externalTrackingNumbers = trackingNumbers;
      console.log('生成的外部运单号:', externalTrackingNumbers);
    }
    
    if (platformNames.length > 0) {
      otherPlatformNames = platformNames;
      console.log('生成的平台名称:', otherPlatformNames);
    }
  }
  
  return {
    externalTrackingNumbers,
    otherPlatformNames
  };
};

// 验证外部平台数据格式
export const validateExternalPlatformData = (rowData: any): string[] => {
  const errors: string[] = [];
  
  if (rowData['其他平台名称'] && rowData['其他平台运单号']) {
    const platformNames = rowData['其他平台名称']?.toString().split(',').map((name: string) => name.trim()).filter((name: string) => name) || [];
    const platformTrackingGroups = rowData['其他平台运单号']?.toString().split(',').map((group: string) => group.trim()).filter((group: string) => group) || [];
    
    // 检查平台名称和运单号组数量是否匹配
    if (platformNames.length !== platformTrackingGroups.length) {
      errors.push(`平台名称数量(${platformNames.length})与运单号组数量(${platformTrackingGroups.length})不匹配`);
    }
    
    // 检查每个运单号组是否包含有效的运单号
    platformTrackingGroups.forEach((group: string, index: number) => {
      const trackingNumbers = group.split('|').map((tn: string) => tn.trim()).filter((tn: string) => tn);
      if (trackingNumbers.length === 0) {
        errors.push(`平台"${platformNames[index]}"的运单号组为空`);
      }
    });
  }
  
  return errors;
};

// 格式化外部平台数据用于显示
export const formatExternalPlatformDataForDisplay = (data: ProcessedPlatformData): string => {
  if (!data.externalTrackingNumbers || data.externalTrackingNumbers.length === 0) {
    return '无外部平台数据';
  }
  
  const platformGroups = data.externalTrackingNumbers.reduce((acc, item) => {
    if (!acc[item.platform]) {
      acc[item.platform] = [];
    }
    acc[item.platform].push(item.tracking_number);
    return acc;
  }, {} as Record<string, string[]>);
  
  return Object.entries(platformGroups)
    .map(([platform, trackingNumbers]) => 
      `${platform}: ${trackingNumbers.join('|')}`
    )
    .join(', ');
};

// 清理外部平台数据
export const cleanExternalPlatformData = (data: any): any => {
  const cleaned = { ...data };
  
  // 清理平台名称
  if (cleaned['其他平台名称']) {
    cleaned['其他平台名称'] = cleaned['其他平台名称']
      .toString()
      .split(',')
      .map((name: string) => name.trim())
      .filter((name: string) => name)
      .join(',');
  }
  
  // 清理运单号
  if (cleaned['其他平台运单号']) {
    cleaned['其他平台运单号'] = cleaned['其他平台运单号']
      .toString()
      .split(',')
      .map((group: string) => 
        group.split('|')
          .map((tn: string) => tn.trim())
          .filter((tn: string) => tn)
          .join('|')
      )
      .filter((group: string) => group)
      .join(',');
  }
  
  return cleaned;
};
