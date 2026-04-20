import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { trips } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Navigation, Ruler, Timer, BarChart3 } from "lucide-react";

export default function TripAnalytics() {
  const totalTrips = trips.length;
  const totalDistance = trips.reduce((s, t) => s + t.distanceKm, 0).toFixed(1);
  const avgDuration = (trips.reduce((s, t) => s + t.durationMinutes, 0) / trips.length).toFixed(0);

  // Trips per driver chart data
  const driverTripCounts: Record<string, number> = {};
  trips.forEach((t) => {
    driverTripCounts[t.driverName] = (driverTripCounts[t.driverName] || 0) + 1;
  });
  const chartData = Object.entries(driverTripCounts).map(([name, count]) => ({
    name: name.split(" ")[0],
    trips: count,
  }));

  return (
    <DashboardLayout title="Trip Analytics">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard title="Total Trips Today" value={totalTrips} icon={Navigation} accent="primary" />
          <KPICard title="Total Distance" value={`${totalDistance} km`} icon={Ruler} accent="success" />
          <KPICard title="Avg Duration" value={`${avgDuration} min`} icon={Timer} accent="warning" />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Trips per Driver</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="trips" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Trip Log</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Distance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.driverName}</TableCell>
                    <TableCell>{t.origin}</TableCell>
                    <TableCell>{t.destination}</TableCell>
                    <TableCell>{t.durationMinutes} min</TableCell>
                    <TableCell>{t.distanceKm} km</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
