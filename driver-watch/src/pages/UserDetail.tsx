import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Mail, MapPin, Phone, Smartphone, CalendarDays, User, Star, ShieldCheck, IdCard, Route } from "lucide-react";
import { getJson } from "@/lib/api";

type UserRecord = {
  userId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  createdAt?: string | null;
  rating?: number | null;
  verificationStatus?: string | null;
  address?: string | null;
  deviceId?: string | null;
  isVerified?: boolean | null;
};

type TripSummary = {
  tripId: string;
  originName?: string | null;
  destName?: string | null;
  date?: string | null;
  status?: string | null;
};

type UserTripsResponse = {
  data: TripSummary[];
  total_trips?: number;
  successful_trips?: number;
  cancelled_or_incomplete_trips?: number;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString();
}

function normalizeStatus(value?: string | null) {
  return (value ?? "pending").toLowerCase().trim();
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["verified", "approved", "active"].includes(status)) return "default";
  if (["rejected", "blocked"].includes(status)) return "destructive";
  if (["pending", "in-review", "in_review"].includes(status)) return "secondary";
  return "outline";
}

function tripStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "cancelled") return "destructive";
  if (status === "ongoing") return "secondary";
  return "outline";
}

export default function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const response = await getJson<{ data: UserRecord }>(`/api/users/${userId}`);
      return response.data;
    },
    enabled: !!userId,
    initialData: () => {
      const users = queryClient.getQueryData<UserRecord[]>(["users"]);
      return users?.find((u) => u.userId === userId);
    },
  });

  const { data: tripsResponse, isLoading: tripsLoading } = useQuery({
    queryKey: ["user-trips", userId],
    queryFn: async () => {
      const response = await getJson<UserTripsResponse>(`/api/users/${userId}/trips?limit=100`);
      return response;
    },
    enabled: !!userId,
  });

  const trips = tripsResponse?.data ?? [];
  const totalTrips = tripsResponse?.total_trips ?? trips.length;
  const successfulTrips = tripsResponse?.successful_trips ?? trips.filter((trip) => normalizeStatus(trip.status) === "completed").length;
  const cancelledOrIncompleteTrips = tripsResponse?.cancelled_or_incomplete_trips ?? Math.max(0, totalTrips - successfulTrips);

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

  if (!user) {
    return (
      <DashboardLayout title="User Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">User not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/tutem/user-database")}>Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const status = normalizeStatus(user.verificationStatus);
  const ratingText = typeof user.rating === "number" ? user.rating.toFixed(1) : "-";

  return (
    <DashboardLayout title={user.name || "User"}>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tutem/user-database")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to User Database
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {user.name?.charAt(0) || "?"}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{user.name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground font-mono">{user.userId}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> {user.email || "-"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {user.phone || "-"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" /> DOB: {formatDate(user.dob)}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" /> Gender: {user.gender || "-"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {user.address || "-"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><IdCard className="h-3.5 w-3.5" /> User ID</span>
                <span className="font-mono font-medium">{user.userId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> Device ID</span>
                <span className="font-medium">{user.deviceId || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><Star className="h-3.5 w-3.5" /> Rating</span>
                <span className="font-medium">{ratingText}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Registered At</span>
                <span className="font-medium">{formatDate(user.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Verification</span>
                <Badge variant={statusBadgeVariant(status)}>{user.verificationStatus || "pending"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">isVerified</span>
                <span className="font-medium">{user.isVerified ? "True" : "False"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Route className="h-4 w-4" />Trip History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Total Trips</p>
                <p className="text-xl font-semibold">{totalTrips}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Successful Trips</p>
                <p className="text-xl font-semibold">{successfulTrips}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Cancelled or Incomplete</p>
                <p className="text-xl font-semibold">{cancelledOrIncompleteTrips}</p>
              </div>
            </div>

            {tripsLoading ? (
              <p className="text-sm text-muted-foreground">Loading trips...</p>
            ) : trips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trip history found for this user.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trips.map((trip) => (
                    <TableRow
                      key={trip.tripId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/tutem/trips/${trip.tripId}`)}
                    >
                      <TableCell className="font-medium">{formatDate(trip.date)}</TableCell>
                      <TableCell>{trip.originName || "-"}</TableCell>
                      <TableCell>{trip.destName || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={tripStatusBadgeVariant(normalizeStatus(trip.status))}>{trip.status || "unknown"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
