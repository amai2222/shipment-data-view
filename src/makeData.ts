// 在 src/ 目录下创建此文件
// 它的唯一作用是生成模拟数据，用于前端开发和测试。

import { faker } from "@faker-js/faker/locale/zh_CN"; // 使用中文本地化数据
import { LogisticsRecord } from "./types"; // 导入我们的核心数据类型

/**
 * 创建一条新的、符合 LogisticsRecord 类型的模拟运单记录。
 * @returns {LogisticsRecord} 一条模拟的运单数据
 */
const newLogisticsRecord = (): LogisticsRecord => {
  // 定义一些可复用的模拟数据数组，让生成的数据更真实
  const licensePlates = ["粤B 88888", "沪A 6666G", "京A U888P", "苏E 12345"];
  const transportTypes = ["普通货运", "冷链运输", "危险品运输", "大件运输"];
  const locations = ["上海宝山仓库", "广州南沙港", "深圳盐田港", "北京顺义中转中心", "成都双流物流园"];
  const projects = ["华南-华东干线运输项目", "西南紧急物资配送", "长三角区域城配项目"];
  const driverLastNames = ["师傅", "队长", "先生"];

  return {
    id: faker.string.uuid(),
    project_name: faker.helpers.arrayElement(projects),
    loading_date: faker.date.recent({ days: 30 }).toISOString(),
    loading_location: faker.helpers.arrayElement(locations),
    unloading_location: faker.helpers.arrayElement(locations.filter(l => l !== this.loading_location)), // 确保装卸货地点不同
    license_plate: faker.helpers.arrayElement(licensePlates),
    driver_name: faker.person.lastName() + faker.helpers.arrayElement(driverLastNames),
    driver_phone: faker.phone.number('13#########'),
    transport_type: faker.helpers.arrayElement(transportTypes),
    // 生成一个 1000 到 15000 之间的随机整数作为成本
    payable_cost: faker.number.int({ min: 1000, max: 15000 }),
    created_at: faker.date.recent({ days: 30 }).toISOString(),
  };
};


/**
 * 根据指定的数量生成一个模拟运单记录的数组。
 * 这是我们前端页面的主要数据源（在连接真实API之前）。
 * @param {number} len - 需要生成的记录数量
 * @returns {LogisticsRecord[]} 一个包含模拟运单记录的数组
 */
export function makeData(len: number): LogisticsRecord[] {
  const data: LogisticsRecord[] = [];
  for (let i = 0; i < len; i++) {
    data.push(newLogisticsRecord());
  }
  return data;
}
