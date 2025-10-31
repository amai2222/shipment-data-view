import { ChevronRight } from "lucide-react";
import { ProjectPartner } from "@/types";

interface PartnerChainDisplayProps {
  partners: ProjectPartner[];
}

export function PartnerChainDisplay({ partners }: PartnerChainDisplayProps) {
  if (!partners || partners.length === 0) {
    return <div className="text-xs text-muted-foreground">暂无合作方</div>;
  }
  
  return (
    <div className="flex flex-wrap items-center gap-2">
      {partners.map((partner, index) => (
        <div key={partner.id} className="flex items-center">
          <div className="flex flex-col items-center p-2 border rounded-md bg-primary text-primary-foreground shadow-sm">
            <span className="text-sm font-semibold">{partner.partnerName}</span>
            <span className="text-xs text-primary-foreground/80">
              {partner.calculationMethod === "tax" 
                ? `税点: ${(partner.taxRate * 100).toFixed(1)}%` 
                : `利润: ${partner.profitRate}元`}
            </span>
          </div>
          {index < partners.length - 1 && (
            <ChevronRight className="h-5 w-5 text-muted-foreground mx-2" />
          )}
        </div>
      ))}
    </div>
  );
}

