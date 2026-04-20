import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Construction, ArrowLeft } from "lucide-react";

export default function WIPPage({ title, description }: { title: string; description?: string }) {
  const navigate = useNavigate();

  return (
    <DashboardLayout title={title}>
      <div className="mx-auto flex max-w-3xl items-center justify-center py-10">
        <Card className="w-full border-dashed">
          <CardContent className="space-y-5 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Construction className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">Work in progress</h2>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                {description ?? "This section is being built and will be available soon."}
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
