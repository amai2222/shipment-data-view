// --- 文件: src/data/mockData.ts ---

import { LogisticsRecord, FullShipmentDetails } from '@/types';

const mockProjects = ['上海-北京专线', '广佛同城配送', '长三角区域干线', '珠三角冷链项目', '西南生鲜运输'];
const mockPlates = ['沪A', '京B', '粤S', '苏E', '川A', '浙B'];
const mockDrivers = ['张伟', '李娜', '王强', '刘洋', '陈静', '赵磊'];

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomNumber(min: number, max: number, isFloat = false): number {
  const num = Math.random() * (max - min) + min;
  return isFloat ? parseFloat(num.toFixed(2)) : Math.floor(num);
}

export function getMockData(count: number): LogisticsRecord[] {
  const data: LogisticsRecord[] = [];
  for (let i = 0; i < count; i++) {
    const creationDate = new Date(Date.now() - getRandomNumber(0, 30) * 24 * 60 * 60 * 1000);
    data.push({
      id: `SHIP_${Date.now()}_${i}`,
      project_name: getRandomElement(mockProjects),
      license_plate: `${getRandomElement(mockPlates)}${getRandomNumber(10000, 99999)}`,
      driver_name: getRandomElement(mockDrivers),
      driver_phone: `1${getRandomNumber(3, 8)}${getRandomNumber(100000000, 999999999)}`,
      transport_type: '公路',
      loading_date: new Date(creationDate.getTime() + 60 * 60 * 1000).toISOString(),
      loading_location: '仓库A',
      unloading_location: '客户B',
      payable_cost: getRandomNumber(2000, 15000, true),
      created_at: creationDate.toISOString(),
    });
  }
  return data;
}

export async function getMockFullShipmentDetails(shipment: LogisticsRecord): Promise<FullShipmentDetails> {
  await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟

  return {
    baseInfo: shipment,
    financials: [
      { id: 'fin_1', type: '运费', amount: shipment.payable_cost * 0.9, status: '已支付', transaction_date: new Date().toISOString() },
      { id: 'fin_2', type: '加急费', amount: shipment.payable_cost * 0.1, status: '待支付', transaction_date: new Date().toISOString() },
      { id: 'fin_3', type: '压车费', amount: 300, status: '审核中', transaction_date: new Date().toISOString() },
    ],
    events: [
      { id: 'evt_1', timestamp: shipment.created_at, status: '已创建', description: '系统收到运单请求。' },
      { id: 'evt_2', timestamp: new Date(new Date(shipment.created_at).getTime() + 3600*1000).toISOString(), status: '已派车', description: `车辆 ${shipment.license_plate} 已指派。` },
      { id: 'evt_3', timestamp: shipment.loading_date, status: '运输中', description: '货物已装车，离开装货点。' },
      { id: 'evt_4', timestamp: new Date(new Date(shipment.loading_date).getTime() + 48*3600*1000).toISOString(), status: '已送达', description: '货物已安全送达卸货点。' },
    ],
    documents: {
      podUrl: '#',
      invoiceUrl: '#'
    }
  };
}
