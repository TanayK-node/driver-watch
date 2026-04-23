import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CalendarDays, MapPin, Car, User, Phone, Hash, Star, Clock3, BadgeCheck, CircleAlert, Route, Navigation } from "lucide-react";
import { getJson } from "@/lib/api";

type TripRecord = Record<string, any> & {
  tripId?: string;
  statusNormalized?: string;
};

function normalizeStatus(value?: string | null) {
  return (value ?? "unknown").toLowerCase().trim();
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "cancelled") return "destructive";
  if (status === "ongoing") return "secondary";
  return "outline";
}

function prettyDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleString();
}

function displayTripTime(trip: TripRecord) {
  return trip.completedAt || trip.cancelledAt || trip.updatedAt || trip.createdAt || trip.startedAt || null;
}

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const response = await getJson<{ data: TripRecord }>(`/api/trips/${tripId}`);
      return response.data;
    },
    enabled: !!tripId,
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!trip) {
    return (
      <DashboardLayout title="Trip Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Trip not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const status = normalizeStatus(trip.statusNormalized || trip.status);

  const detailItems = [
    ["Trip ID", trip.tripId || trip._id],
    ["Driver ID", trip.driverId],
    ["User ID", trip.userId],
    ["Unique Code", trip.uniqueCode],
    ["Organization", trip.organization],
    ["Gender", trip.gender],
    ["Distance", trip.distance],
    ["Fare Amount", trip.fareAmount],
    ["Fare Calculated", trip.fareAmountCalculated],
    ["Default Fare Range", trip.defaultAmtForRange],
    ["Driver Rating", trip.driverRating],
    ["User Rating", trip.userRating],
    ["Is MoWo", String(trip.isMoWo)],
    ["Created At", prettyDate(trip.createdAt)],
    ["Updated At", prettyDate(trip.updatedAt)],
    ["Started At", prettyDate(trip.startedAt)],
    ["Driver Reached At", prettyDate(trip.driverReachedAt)],
    ["On Trip At", prettyDate(trip.onTripAt)],
    ["Reached Destination At", prettyDate(trip.reachedDestinationAt)],
    ["Completed At", prettyDate(trip.completedAt)],
    ["Cancelled At", prettyDate(trip.cancelledAt)],
    ["Reason For Cancelling", trip.reasonForCancelling],
    ["Actual Covered Distance", trip.actualCoveredDistance],
  ] as const;

  return (
    <DashboardLayout title="Trip Details">
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 w-fit">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Origin</p>
              <p className="mt-2 text-sm font-medium break-words">{trip.originName || "-"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Destination</p>
              <p className="mt-2 text-sm font-medium break-words">{trip.destName || "-"}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Route className="h-4 w-4" /> Trip Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" /> {prettyDate(displayTripTime(trip))}</div>
            <div className="flex items-center gap-2 text-muted-foreground"><Navigation className="h-4 w-4" /> Origin to destination trip</div>
            <div className="flex items-center gap-2 text-muted-foreground"><Car className="h-4 w-4" /> Driver: {trip.driverId || "-"}</div>
            <div className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" /> User: {trip.userId || "-"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4" /> Full Trip Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {detailItems.map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 rounded-md border bg-muted/30 p-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-right font-medium break-all">{value || "-"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CircleAlert className="h-4 w-4" /> Raw Trip Payload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md bg-muted p-4 text-xs leading-6">
              {JSON.stringify(trip, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
