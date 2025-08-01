import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface BusinessEntryPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function BusinessEntryPagination({
  currentPage,
  totalPages,
  onPageChange
}: BusinessEntryPaginationProps) {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-muted-foreground">
        第 {currentPage} 页，共 {totalPages} 页
      </div>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentPage <= 1}
              className="gap-1 pl-2.5"
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={currentPage >= totalPages}
              className="gap-1 pr-2.5"
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}