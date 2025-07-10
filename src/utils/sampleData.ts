import { LocalStorage } from "./storage";

// 初始化示例数据
export function initializeSampleData() {
  // 检查是否已有数据
  if (LocalStorage.getProjects().length > 0) return;

  // 添加示例项目
  LocalStorage.addProject({
    name: "城市配送项目A",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    manager: "李经理",
  });

  LocalStorage.addProject({
    name: "工业园区运输项目",
    startDate: "2024-06-01",
    endDate: "2024-12-31", 
    manager: "王总监",
  });

  // 添加示例司机
  LocalStorage.addDriver({
    name: "张师傅",
    licensePlate: "京A12345",
    phone: "13812345678",
  });

  LocalStorage.addDriver({
    name: "李师傅", 
    licensePlate: "京B67890",
    phone: "13987654321",
  });

  LocalStorage.addDriver({
    name: "王师傅",
    licensePlate: "京C11111",
    phone: "13811112222",
  });

  // 添加示例地点
  const locations = [
    "北京仓储中心",
    "天津配送站",
    "上海物流园",
    "深圳港口",
    "广州批发市场",
    "成都西部中心",
    "武汉中转站",
    "西安物流基地"
  ];

  locations.forEach(name => {
    LocalStorage.addLocation({ name });
  });

  console.log("示例数据初始化完成！");
}