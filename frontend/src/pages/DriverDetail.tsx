import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Phone, Car, CreditCard, Building2, Palette, Mail, MapPin, Star, CalendarDays, User } from "lucide-react";

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const formatDate = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString();
  };

  const { data: driver, isLoading } = useQuery({
    queryKey: ["driver", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("driverId", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!driver) {
    return (
      <DashboardLayout title="Driver Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Driver not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/drivers")}>Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const driverExtra = driver as typeof driver & {
    email?: string | null;
    image?: string | null;
    address?: string | null;
    rating?: number | null;
    dob?: string | null;
    gender?: string | null;
    createdAt?: string | null;
  };

  const displayImage = driverExtra.image;
  const joinedDate = formatDate(driverExtra.createdAt || driver.created_at);
  const dobDate = formatDate(driverExtra.dob);
  const ratingText = typeof driverExtra.rating === "number" ? driverExtra.rating.toFixed(1) : "-";

  return (
    <DashboardLayout title={driver.name || "Driver"}>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/drivers")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Drivers
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={`${driver.name || "Driver"} profile`}
                    className="h-12 w-12 rounded-full object-cover border"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {driver.name?.charAt(0) || "?"}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-foreground">{driver.name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground font-mono">{driver.driverId}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {driver.phone || "-"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> {driverExtra.email || "-"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {driverExtra.address || "-"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" /> {driverExtra.gender || "-"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" /> DOB: {dobDate}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Star className="h-4 w-4" /> Rating: {ratingText}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" /> {driver.organization || "—"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="h-4 w-4" /> License: {driver.driverLicenseNo || "-"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" /> Joined: {joinedDate}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Vehicle Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Registration</span>
                <span className="font-mono font-medium">{driver.vehicleRegistrationNo || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Make & Model</span>
                <span className="font-medium">{[driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(" ") || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Class</span>
                <span className="font-medium">{driver.vehicleClass || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Palette className="h-3.5 w-3.5" /> Color</span>
                <span className="font-medium">{driver.vehicleColor || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Car className="h-3.5 w-3.5" /> Registered</span>
                <span className="font-medium">{driver.created_at ? new Date(driver.created_at).toLocaleDateString() : "—"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
