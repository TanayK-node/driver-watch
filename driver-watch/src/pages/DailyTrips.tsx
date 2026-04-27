import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { getJson, postJson } from "@/lib/api";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  XCircle,
  AlertTriangle,
  TrendingUp,
  MapPin,
} from "lucide-react";

type TripAnalysisSnapshot = {
  snapshotDate: string;
  generatedAt: string;
  source?: string;
  daily: {
    totalTripsToday: number;
    activeTrips: number;
    completedTripsToday: number;
    cancelledOrIncompletedTripsToday: number;
  };
  past: {
    overallTrips: number;
    successfulTrips: number;
    cancelledTrips: number;
  };
};

type TodayTripBrief = {
  tripId: string;
  userId?: string;
  userName: string;
  driverId?: string;
  driverName: string;
  isCompleted: boolean;
  status: string;
  originName: string;
  destinationName: string;
  createdAt?: string;
};

type TrendPoint = {
  date: string;
  dailyTrips: number;
  dailySuccessfulTrips: number;
  dailyCancelledTrips: number;
  cumulativeTrips: number;
  cumulativeSuccessfulTrips: number;
  cumulativeCancelledTrips: number;
};

type OdPoint = {
  name: string;
  lat: number;
  lng: number;
  count: number;
};

type OdRoute = {
  originName: string;
  destinationName: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  count: number;
};

type OdMatrixEntry = {
  originName: string;
  destinationName: string;
  count: number;
};

type TripVisualAnalytics = {
  generatedAt: string;
  windowDays: number;
  scannedTrips: number;
  summary: {
    activeDays: number;
    avgTripsPerDay: number;
    totalTripsInWindow: number;
  };
  trend: TrendPoint[];
  od: {
    matrix: OdMatrixEntry[];
    origins: OdPoint[];
    destinations: OdPoint[];
    routes: OdRoute[];
  };
};

function formatDateTime(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
}

function formatChartDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

const IITB_CENTER: [number, number] = [19.13238, 72.91732];

export default function DailyTrips() {
  const { toast } = useToast();
  const [isTodayTripsOpen, setIsTodayTripsOpen] = useState(false);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["tutem-trip-analysis", "daily"],
    queryFn: async () => {
      try {
        const syncResponse = await postJson<{ data: TripAnalysisSnapshot }>(
          "/api/tutem/trip-analysis/sync",
          {}
        );
        return syncResponse.data;
      } catch (_error) {
        const latestResponse = await getJson<{ data: TripAnalysisSnapshot }>(
          "/api/tutem/trip-analysis/latest"
        );
        return latestResponse.data;
      }
    },
  });

  const {
    data: visuals,
    isLoading: isVisualsLoading,
  } = useQuery({
    queryKey: ["tutem-trip-analysis", "visuals"],
    queryFn: async () => {
      const response = await getJson<{ data: TripVisualAnalytics }>(
        "/api/tutem/trip-analysis/visuals?days=120&limit=25000"
      );
      return response.data;
    },
  });

  const {
    data: todayTrips = [],
    isLoading: isTodayTripsLoading,
  } = useQuery({
    queryKey: ["tutem-trip-analysis", "today-trips"],
    enabled: isTodayTripsOpen,
    queryFn: async () => {
      const response = await getJson<{ data: TodayTripBrief[] }>("/api/tutem/trip-analysis/today-trips?limit=250");
      return response.data ?? [];
    },
  });

  const handleRefresh = async () => {
    const result = await refetch();
    if (result.error) {
      toast({
        title: "Refresh Failed",
        description: "Could not fetch and save trip statistics.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Statistics Updated",
      description: "Latest trip statistics fetched from tutemprod and saved to TutemIq.",
    });
  };

  const mapCenter = IITB_CENTER;

  const matrixView = useMemo(() => {
    const matrix = visuals?.od.matrix ?? [];
    const originTotals = new Map<string, number>();
    const destinationTotals = new Map<string, number>();

    matrix.forEach((entry) => {
      originTotals.set(entry.originName, (originTotals.get(entry.originName) ?? 0) + entry.count);
      destinationTotals.set(entry.destinationName, (destinationTotals.get(entry.destinationName) ?? 0) + entry.count);
    });

    const topOrigins = Array.from(originTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);

    const topDestinations = Array.from(destinationTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);

    const countsByCell = new Map<string, number>();
    let maxValue = 0;

    matrix.forEach((entry) => {
      if (!topOrigins.includes(entry.originName) || !topDestinations.includes(entry.destinationName)) return;
      const key = `${entry.originName}__${entry.destinationName}`;
      const next = (countsByCell.get(key) ?? 0) + entry.count;
      countsByCell.set(key, next);
      if (next > maxValue) maxValue = next;
    });

    return {
      topOrigins,
      topDestinations,
      countsByCell,
      maxValue,
    };
  }, [visuals?.od.matrix]);

  return (
    <DashboardLayout title="Daily Trips">
      <div className="space-y-6 lg:space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Source: {data?.source ?? "tutemprod.riderequests"}
            </p>
            <p className="text-xs text-muted-foreground">
              Last generated: {formatDateTime(data?.generatedAt)}
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Refreshing..." : "Refresh & Save"}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <CalendarDays className="h-4 w-4" />
              Daily Trips
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-[112px] w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                <button
                  type="button"
                  onClick={() => setIsTodayTripsOpen(true)}
                  className="w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Open today's trip brief"
                >
                  <KPICard title="Total Trips Today" value={data?.daily.totalTripsToday ?? 0} icon={BarChart3} />
                </button>
                <KPICard title="Active Trips" value={data?.daily.activeTrips ?? 0} icon={Clock3} accent="warning" />
                <KPICard
                  title="Completed Trips Today"
                  value={data?.daily.completedTripsToday ?? 0}
                  icon={CheckCircle2}
                  accent="success"
                />
                <KPICard
                  title="Cancelled or Incompleted Trips Today"
                  value={data?.daily.cancelledOrIncompletedTripsToday ?? 0}
                  icon={AlertTriangle}
                  accent="destructive"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Past Trips</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-[112px] w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                <KPICard title="Overall Trips Till Now" value={data?.past.overallTrips ?? 0} icon={BarChart3} />
                <KPICard title="Successful Trips" value={data?.past.successfulTrips ?? 0} icon={CheckCircle2} accent="success" />
                <KPICard title="Cancelled Trips" value={data?.past.cancelledTrips ?? 0} icon={XCircle} accent="destructive" />
                <KPICard
                  title="Avg Trips / Day"
                  value={isVisualsLoading ? "..." : (visuals?.summary.avgTripsPerDay ?? 0).toFixed(2)}
                  icon={TrendingUp}
                  accent="primary"
                  subtitle={`From last ${visuals?.windowDays ?? 120} days`}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">Cumulative Trip Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {isVisualsLoading ? (
              <Skeleton className="h-[360px] w-full" />
            ) : (visuals?.trend?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No trend data available for the selected window.</p>
            ) : (
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={visuals?.trend ?? []} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={formatChartDate} minTickGap={24} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(label) => formatDateTime(String(label))}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="cumulativeTrips" name="Cumulative Trips" stroke="#1d4ed8" strokeWidth={2.5} dot={false} />
                    <Line
                      type="monotone"
                      dataKey="cumulativeSuccessfulTrips"
                      name="Cumulative Successful Trips"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cumulativeCancelledTrips"
                      name="Cumulative Cancelled Trips"
                      stroke="#dc2626"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <MapPin className="h-4 w-4" />
              OD Matrix Map
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isVisualsLoading ? (
              <Skeleton className="h-[420px] w-full" />
            ) : (visuals?.od.origins.length ?? 0) + (visuals?.od.destinations.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No origin/destination coordinates found in trip data.</p>
            ) : (
              <>
                <div className="h-[420px] w-full overflow-hidden rounded-xl border">
                  <MapContainer center={mapCenter} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {(visuals?.od.routes ?? []).map((route, idx) => (
                      <Polyline
                        key={`route-${idx}-${route.originName}-${route.destinationName}`}
                        positions={[
                          [route.originLat, route.originLng],
                          [route.destinationLat, route.destinationLng],
                        ]}
                        pathOptions={{ color: "#2563eb", opacity: 0.2, weight: 2 }}
                      />
                    ))}

                    {(visuals?.od.origins ?? []).map((point, idx) => (
                      <CircleMarker
                        key={`origin-${idx}-${point.name}-${point.lat}-${point.lng}`}
                        center={[point.lat, point.lng]}
                        radius={Math.min(11, 4 + Math.log2(point.count + 1))}
                        pathOptions={{ color: "#dc2626", fillColor: "#ef4444", fillOpacity: 0.75 }}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p className="font-semibold">Origin: {point.name}</p>
                            <p>Trips: {point.count}</p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}

                    {(visuals?.od.destinations ?? []).map((point, idx) => (
                      <CircleMarker
                        key={`dest-${idx}-${point.name}-${point.lat}-${point.lng}`}
                        center={[point.lat, point.lng]}
                        radius={Math.min(11, 4 + Math.log2(point.count + 1))}
                        pathOptions={{ color: "#15803d", fillColor: "#22c55e", fillOpacity: 0.75 }}
                      >
                        <Popup>
                          <div className="text-sm">
                            <p className="font-semibold">Destination: {point.name}</p>
                            <p>Trips: {point.count}</p>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>

                <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> Origin points
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-500" /> Destination points
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-0.5 w-8 bg-blue-600/60" /> Top OD flows
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base lg:text-lg">OD Matrix (Top Routes)</CardTitle>
          </CardHeader>
          <CardContent>
            {isVisualsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : matrixView.topOrigins.length === 0 || matrixView.topDestinations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No OD matrix data available.</p>
            ) : (
              <div className="max-h-[420px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Origin \ Destination</TableHead>
                      {matrixView.topDestinations.map((destination) => (
                        <TableHead key={destination} className="min-w-[120px] text-center">
                          {destination}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixView.topOrigins.map((origin) => (
                      <TableRow key={origin}>
                        <TableCell className="font-medium">{origin}</TableCell>
                        {matrixView.topDestinations.map((destination) => {
                          const key = `${origin}__${destination}`;
                          const value = matrixView.countsByCell.get(key) ?? 0;
                          const ratio = matrixView.maxValue > 0 ? value / matrixView.maxValue : 0;
                          const bg = value === 0 ? "transparent" : `rgba(37, 99, 235, ${0.14 + ratio * 0.66})`;

                          return (
                            <TableCell key={`${origin}-${destination}`} className="text-center">
                              <span
                                className="inline-flex min-w-12 items-center justify-center rounded-md px-2 py-1 text-xs font-semibold"
                                style={{ backgroundColor: bg, color: value === 0 ? "hsl(var(--muted-foreground))" : "white" }}
                              >
                                {value}
                              </span>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isTodayTripsOpen} onOpenChange={setIsTodayTripsOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Today Trip Brief</DialogTitle>
              <DialogDescription>
                User, driver, completion status, origin, and destination for today&apos;s trips.
              </DialogDescription>
            </DialogHeader>

            {isTodayTripsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-10 w-full" />
                ))}
              </div>
            ) : todayTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trips found for today.</p>
            ) : (
              <div className="max-h-[65vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Origin</TableHead>
                      <TableHead>Destination</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayTrips.map((trip) => (
                      <TableRow key={trip.tripId}>
                        <TableCell className="font-medium">{trip.userName || "Unknown User"}</TableCell>
                        <TableCell>{trip.driverName || "Unknown Driver"}</TableCell>
                        <TableCell>
                          <Badge variant={trip.isCompleted ? "default" : "secondary"}>
                            {trip.isCompleted ? "Completed" : "Not Completed"}
                          </Badge>
                        </TableCell>
                        <TableCell>{trip.originName || "-"}</TableCell>
                        <TableCell>{trip.destinationName || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
