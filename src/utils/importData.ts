import { LocalStorage } from "./storage";

// 清空所有数据并导入新的初始数据（仅执行一次）
export function clearAndImportData() {
  // 检查是否已经导入过数据
  const hasImported = localStorage.getItem("data_imported");
  if (hasImported) {
    return; // 如果已经导入过，则不再重复导入
  }
  // 清空所有现有数据
  localStorage.removeItem("logistics_projects");
  localStorage.removeItem("logistics_drivers");
  localStorage.removeItem("logistics_locations");
  localStorage.removeItem("logistics_records");

  // 创建默认项目
  const project = LocalStorage.addProject({
    name: "镇赉-大安运输项目",
    startDate: "2024-07-01",
    endDate: "2024-12-31",
    manager: "运输部经理",
    loadingAddress: "镇赉",
    unloadingAddress: "大安",
  });

  // 创建司机信息
  const drivers = [
    LocalStorage.addDriver({
      name: "田英杰",
      licensePlate: "吉JJ8577",
      phone: "15834657987",
    }),
    LocalStorage.addDriver({
      name: "唐晓庆",
      licensePlate: "吉GD2875", 
      phone: "13331576560",
    }),
    LocalStorage.addDriver({
      name: "辛建涛",
      licensePlate: "吉BG8039",
      phone: "13404435577",
    }),
  ];

  // 创建地点信息
  LocalStorage.addLocation({ name: "镇赉" });
  LocalStorage.addLocation({ name: "大安" });

  // 创建物流记录数据
  const recordsData = [
    {
      date: "7-3", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "田英杰",
      loadingWeight: 45.14, unloadingWeight: 45.08, unloadingDate: "7-3", transportType: "实际运输" as const,
      currentCost: 1487.64, payableCost: 1487.64
    },
    {
      date: "7-3", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "唐晓庆",
      loadingWeight: 47.32, unloadingWeight: 47.3, unloadingDate: "7-3", transportType: "实际运输" as const,
      currentCost: 1560.90, payableCost: 1560.90
    },
    {
      date: "7-3", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "辛建涛",
      loadingWeight: 47.42, unloadingWeight: 47.4, unloadingDate: "7-3", transportType: "实际运输" as const,
      currentCost: 1564.20, payableCost: 1564.20
    },
    {
      date: "7-4", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "田英杰",
      loadingWeight: 46.01, unloadingWeight: 46.04, unloadingDate: "7-5", transportType: "实际运输" as const,
      currentCost: 1519.32, extraCost: 300, payableCost: 1819.32
    },
    {
      date: "7-4", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "唐晓庆",
      loadingWeight: 47.06, transportType: "实际运输" as const, remarks: "玉米检验不合格退回返厂",
      currentCost: 1552.98, extraCost: 300, payableCost: 1852.98
    },
    {
      date: "7-4", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "辛建涛",
      loadingWeight: 47.26, unloadingWeight: 47.24, unloadingDate: "7-5", transportType: "实际运输" as const,
      currentCost: 1558.92, extraCost: 300, payableCost: 1858.92
    },
    {
      date: "7-5", loadingLocation: "大安", unloadingLocation: "镇赉", driverName: "唐晓庆",
      loadingWeight: 47.06, unloadingWeight: 47.06, transportType: "退货" as const,
      remarks: "已经返厂等待卸货", currentCost: 752.96, payableCost: 752.96
    },
    {
      date: "7-6", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "辛建涛",
      loadingWeight: 48.30, unloadingWeight: 48.26, unloadingDate: "7-7", transportType: "实际运输" as const,
      currentCost: 1592.58, payableCost: 1592.58
    },
    {
      date: "7-6", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "田英杰",
      loadingWeight: 46.65, transportType: "实际运输" as const, remarks: "7号检测呕吐霉素超标退货返厂",
      currentCost: 1539.45, payableCost: 1539.45
    },
    {
      date: "7-7", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "唐晓庆",
      loadingWeight: 47.84, transportType: "实际运输" as const, remarks: "玉米检验不合格退回返厂",
      currentCost: 1578.72, payableCost: 1578.72
    },
    {
      date: "7-7", loadingLocation: "大安", unloadingLocation: "镇赉", driverName: "唐晓庆",
      loadingWeight: 47.84, unloadingWeight: 47.84, transportType: "退货" as const,
      remarks: "已经返厂等待卸货", currentCost: 765.44, payableCost: 765.44
    },
    {
      date: "7-7", loadingLocation: "大安", unloadingLocation: "镇赉", driverName: "田英杰",
      loadingWeight: 46.65, unloadingWeight: 46.65, transportType: "退货" as const,
      remarks: "返厂卸掉货", currentCost: 746.40, payableCost: 746.40
    },
    {
      date: "7-7", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "田英杰",
      loadingWeight: 45.57, unloadingWeight: 45.58, unloadingDate: "7-8", transportType: "实际运输" as const,
      currentCost: 1504.14, payableCost: 1504.14
    },
    {
      date: "7-7", loadingLocation: "镇赉", unloadingLocation: "大安", driverName: "辛建涛",
      loadingWeight: 47.64, transportType: "实际运输" as const, remarks: "不合格退货",
      currentCost: 1572.12, payableCost: 1572.12
    },
    {
      date: "7-8", loadingLocation: "大安", unloadingLocation: "镇赉", driverName: "辛建涛",
      loadingWeight: 47.64, unloadingWeight: 47.64, transportType: "退货" as const,
      remarks: "返厂", currentCost: 762.24, payableCost: 762.24
    }
  ];

  // 转换日期格式并添加记录
  recordsData.forEach(record => {
    const driver = drivers.find(d => d.name === record.driverName);
    if (!driver) return;

    // 转换日期格式 7-3 -> 2024-07-03
    const [month, day] = record.date.split('-');
    const loadingTime = `2024-${month.padStart(2, '0')}-${day.padStart(2, '0')}T08:00`;
    const unloadingDate = record.unloadingDate ? 
      `2024-${month.padStart(2, '0')}-${record.unloadingDate.split('-')[1].padStart(2, '0')}` : 
      undefined;

    LocalStorage.addLogisticsRecord({
      projectId: project.id,
      projectName: project.name,
      loadingDate: loadingTime,
      loadingLocation: record.loadingLocation,
      unloadingLocation: record.unloadingLocation,
      driverId: driver.id,
      driverName: driver.name,
      licensePlate: driver.licensePlate,
      driverPhone: driver.phone,
      loadingWeight: record.loadingWeight,
      unloadingDate,
      unloadingWeight: record.unloadingWeight,
      transportType: record.transportType,
      currentFee: record.currentCost,
      extraFee: record.extraCost,
      payableFee: record.payableCost,
      remarks: record.remarks,
      createdByUserId: "system_import",
    });
  });

  // 标记数据已导入
  localStorage.setItem("data_imported", "true");
  
  console.log("数据已清空并重新导入完成！");
  console.log(`导入了 ${recordsData.length} 条物流记录`);
}

// 强制重新导入数据（用于开发测试）
export function forceReimportData() {
  localStorage.removeItem("data_imported");
  clearAndImportData();
}