/**
 * 模糊地址地理编码演示组件
 * 展示如何处理各种模糊地址格式
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AMapService, geocodingUtils } from '@/services/AMapService';
import { createLocationGeocodingService } from '@/services/LocationGeocodingService';
import { 
  MapPin, 
  Navigation, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Lightbulb,
  Target,
  Loader2
} from 'lucide-react';

interface GeocodingResult {
  originalAddress: string;
  processedAddress: string;
  confidence: number;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  level?: string;
  success: boolean;
  error?: string;
}

export function FuzzyAddressGeocodingDemo() {
  const { toast } = useToast();
  const [address, setAddress] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const amapService = new AMapService({
    key: process.env.REACT_APP_AMAP_KEY || '',
    baseUrl: 'https://restapi.amap.com/v3',
    version: 'v3'
  });

  // 示例模糊地址
  const exampleAddresses = [
    '北京朝阳区附近',
    '上海浦东一带',
    '广州天河区周围',
    '深圳南山区大概位置',
    '杭州西湖区边上',
    '成都锦江区左右',
    '武汉江汉区区域',
    '南京鼓楼区地段',
    '重庆渝中区附近',
    '西安雁塔区周边'
  ];

  // 处理单个地址
  const processAddress = async (inputAddress: string): Promise<GeocodingResult> => {
    const originalAddress = inputAddress;
    const processedAddress = geocodingUtils.normalizeAddress(inputAddress);
    const confidence = geocodingUtils.getAddressConfidenceScore(inputAddress);
    
    try {
      // 使用智能地理编码
      const response = await amapService.smartGeocode(processedAddress);
      
      if (response.geocodes.length === 0) {
        return {
          originalAddress,
          processedAddress,
          confidence,
          success: false,
          error: '未找到匹配的地理编码结果'
        };
      }

      const geocode = response.geocodes[0];
      const [longitude, latitude] = geocode.location.split(',').map(Number);
      const geocodeConfidence = amapService.getAddressConfidence(geocode);

      return {
        originalAddress,
        processedAddress,
        confidence: Math.max(confidence, geocodeConfidence),
        latitude,
        longitude,
        formattedAddress: geocode.formatted_address,
        level: geocode.level,
        success: true
      };
    } catch (error: any) {
      return {
        originalAddress,
        processedAddress,
        confidence,
        success: false,
        error: error.message
      };
    }
  };

  // 处理地址
  const handleProcessAddress = async () => {
    if (!address.trim()) {
      toast({
        title: "请输入地址",
        description: "地址不能为空",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await processAddress(address);
      setResults(prev => [result, ...prev.slice(0, 9)]); // 保留最近10个结果
    } catch (error) {
      console.error('处理地址失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 批量处理示例地址
  const handleProcessExamples = async () => {
    setIsLoading(true);
    try {
      const promises = exampleAddresses.map(addr => processAddress(addr));
      const results = await Promise.all(promises);
      setResults(results);
      
      const successCount = results.filter(r => r.success).length;
      toast({
        title: "批量处理完成",
        description: `成功处理 ${successCount}/${results.length} 个地址`,
      });
    } catch (error) {
      console.error('批量处理失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取置信度颜色
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    if (confidence >= 0.4) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  // 获取置信度文本
  const getConfidenceText = (confidence: number) => {
    if (confidence >= 0.8) return '高';
    if (confidence >= 0.6) return '中';
    if (confidence >= 0.4) return '低';
    return '很低';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            模糊地址地理编码演示
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 输入区域 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">输入地址（支持模糊地址）</label>
            <div className="flex gap-2">
              <Input
                placeholder="例如：北京朝阳区附近、上海浦东一带"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleProcessAddress()}
              />
              <Button 
                onClick={handleProcessAddress} 
                disabled={isLoading || !address.trim()}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '处理地址'}
              </Button>
            </div>
          </div>

          {/* 示例地址 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">示例模糊地址</label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {exampleAddresses.map((example, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setAddress(example)}
                  className="text-xs"
                >
                  {example}
                </Button>
              ))}
            </div>
            <Button 
              variant="outline" 
              onClick={handleProcessExamples}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
              批量处理示例地址
            </Button>
          </div>

          {/* 功能说明 */}
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              <strong>模糊地址处理能力：</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• 支持"附近"、"一带"、"周围"等模糊词汇</li>
                <li>• 自动提取省市区信息进行智能匹配</li>
                <li>• 多种策略尝试，提高成功率</li>
                <li>• 置信度评分，帮助判断结果可靠性</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 结果展示 */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5" />
              地理编码结果 ({results.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    {/* 地址信息 */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">原始地址：</span>
                          <span className="text-sm">{result.originalAddress}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">处理后：</span>
                          <span className="text-sm text-muted-foreground">{result.processedAddress}</span>
                        </div>
                        {result.formattedAddress && (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">格式化：</span>
                            <span className="text-sm text-blue-600">{result.formattedAddress}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                        <Badge className={getConfidenceColor(result.confidence)}>
                          置信度: {getConfidenceText(result.confidence)} ({(result.confidence * 100).toFixed(0)}%)
                        </Badge>
                      </div>
                    </div>

                    {/* 坐标信息 */}
                    {result.success && result.latitude && result.longitude && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">纬度：</span>
                          <span className="text-green-600">{result.latitude.toFixed(6)}</span>
                        </div>
                        <div>
                          <span className="font-medium">经度：</span>
                          <span className="text-green-600">{result.longitude.toFixed(6)}</span>
                        </div>
                        {result.level && (
                          <div className="col-span-2">
                            <span className="font-medium">精确度：</span>
                            <Badge variant="outline" className="ml-1">
                              {result.level}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 错误信息 */}
                    {!result.success && result.error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{result.error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 技术说明 */}
      <Card>
        <CardHeader>
          <CardTitle>技术实现说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <h4 className="font-medium text-foreground mb-2">模糊地址处理策略：</h4>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li><strong>直接编码：</strong>尝试原始地址直接进行地理编码</li>
              <li><strong>城市分离：</strong>提取城市信息，分别处理城市和详细地址</li>
              <li><strong>地址简化：</strong>移除详细地址信息，保留主要地理信息</li>
              <li><strong>主要地点：</strong>只使用省市区等主要地理信息</li>
              <li><strong>地址变体：</strong>生成多种地址变体进行尝试</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-medium text-foreground mb-2">置信度评分：</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>包含省市区信息：+0.3~0.6分</li>
              <li>包含详细地址：+0.1~0.2分</li>
              <li>包含模糊词汇：-0.3分</li>
              <li>地址长度适中：+0.1分</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-2">支持的模糊词汇：</h4>
            <div className="flex flex-wrap gap-1">
              {['附近', '周围', '一带', '周边', '大概', '大约', '左右', '边上', '旁边', '区域', '地段'].map(word => (
                <Badge key={word} variant="outline" className="text-xs">
                  {word}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
