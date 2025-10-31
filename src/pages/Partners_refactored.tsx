import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, Eye, EyeOff } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { usePartnersData } from "./Maintenance/hooks/usePartnersData";
import { usePartnerForm } from "./Maintenance/hooks/usePartnerForm";
import { PartnerTable } from "./Maintenance/components/PartnerTable";
import { PartnerFormDialog } from "./Maintenance/components/PartnerFormDialog";

export default function Partners() {
  const {
    partners,
    isLoading,
    activeTab,
    setActiveTab,
    showDetails,
    setShowDetails,
    canViewSensitive,
    fetchPartners,
    deletePartner,
  } = usePartnersData();

  const {
    isDialogOpen,
    setIsDialogOpen,
    editingPartner,
    formData,
    setFormData,
    resetForm,
    handleEdit,
    handleSubmit,
  } = usePartnerForm(fetchPartners);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleOpenDialog = () => {
    resetForm();
    setFormData({ ...formData, partnerType: activeTab });
    setIsDialogOpen(true);
  };

  const filteredPartners = partners.filter(p => p.partnerType === activeTab);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="合作方管理"
        description="管理所有合作方信息，包括货主、合作商、资方等"
        icon={Users}
        iconColor="text-orange-600"
      >
        <div className="flex gap-2">
          {canViewSensitive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  隐藏敏感信息
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  显示敏感信息
                </>
              )}
            </Button>
          )}
          <Button onClick={handleOpenDialog}>
            <Plus className="h-4 w-4 mr-2" />
            添加合作方
          </Button>
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="货主">货主</TabsTrigger>
          <TabsTrigger value="合作商">合作商</TabsTrigger>
          <TabsTrigger value="资方">资方</TabsTrigger>
          <TabsTrigger value="本公司">本公司</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          <PartnerTable
            partners={filteredPartners}
            showDetails={showDetails}
            canViewSensitive={canViewSensitive}
            onEdit={handleEdit}
            onDelete={deletePartner}
          />
        </TabsContent>
      </Tabs>

      <PartnerFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        formData={formData}
        setFormData={setFormData}
        isEditing={!!editingPartner}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

