import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Truck, ChevronLeft, ChevronRight } from "lucide-react";
import { Driver, Project } from "@/types";
import { DriverRow } from "./DriverRow";

interface DriverTableProps {
  drivers: Driver[];
  projects: Project[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onEdit: (driver: Driver) => void;
  onDelete: (driverId: string) => void;
  onPageChange: (page: number) => void;
  activeFiltersCount: number;
  clearFilters: () => void;
}

export function DriverTable({
  drivers,
  projects,
  isLoading,
  currentPage,
  totalPages,
  totalCount,
  onEdit,
  onDelete,
  onPageChange,
  activeFiltersCount,
  clearFilters,
}: DriverTableProps) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>司机列表 (共 {totalCount} 个司机)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>车牌号</TableHead>
                <TableHead>电话</TableHead>
                <TableHead>关联项目</TableHead>
                <TableHead>照片</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex justify-center items-center">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      正在加载数据...
                    </div>
                  </TableCell>
                </TableRow>
              ) : drivers.length > 0 ? (
                drivers.map((driver) => (
                  <DriverRow
                    key={driver.id}
                    driver={driver}
                    projects={projects}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-muted-foreground">
                      {activeFiltersCount > 0 ? '当前筛选条件下无数据' : '暂无司机数据'}
                    </p>
                    {activeFiltersCount > 0 && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={clearFilters}
                        className="mt-2"
                      >
                        清除筛选条件
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* 分页 */}
      {totalPages > 1 && (
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            第 {currentPage} 页，共 {totalPages} 页
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isLoading}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

