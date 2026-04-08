import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { KPICard } from "@/components/KPICard";
import { ArrowLeft, CalendarDays, Clock, UserCheck } from "lucide-react";

export default function DriverAttendanceDetail() {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const backPath = ((location.state as { from?: string } | null)?.from) ?? "/attendance";

  const { data: driver } = useQuery({
    queryKey: ["driver", driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("driverId", driverId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!driverId,
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance-history", driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("driver_id", driverId!)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!driverId,
  });

  const calcMinutes = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return 0;
    const [h1, m1] = checkIn.split(":").map(Number);
    const [h2, m2] = checkOut.split(":").map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    return diff > 0 ? diff : 0;
  };

  const formatHours = (mins: number) => {
    if (mins === 0) return "—";
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const totalDays = records.length;
  const totalGateMinutes = records.reduce((sum, r) => sum + calcMinutes(r.check_in, r.check_out), 0);
  const totalGpsMinutes = records.reduce((sum, r) => {
    const fromTimes = calcMinutes(r.gps_first_in, r.gps_last_out);
    if (fromTimes > 0) return sum + fromTimes;
    const fromHours = r.gps_total_hours ? Math.round(r.gps_total_hours * 60) : 0;
    return sum + fromHours;
  }, 0);
  const avgGateHours = totalDays > 0 ? formatHours(Math.round(totalGateMinutes / totalDays)) : "—";

  return (
    <DashboardLayout title={`Attendance — ${driver?.name ?? driverId}`}>
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => navigate(backPath)} className="w-fit">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard title="Total Days Present" value={totalDays} icon={CalendarDays} accent="success" />
          <KPICard title="Total Gate Hours" value={formatHours(totalGateMinutes)} icon={Clock} />
          <KPICard title="Avg Gate Hrs/Day" value={avgGateHours} icon={UserCheck} accent="warning" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
          <KPICard title="Total GPS Hours" value={formatHours(totalGpsMinutes)} icon={Clock} accent="success" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : records.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance records found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Gate In</TableHead>
                    <TableHead>Gate Out</TableHead>
                    <TableHead>Gate Hours</TableHead>
                    <TableHead>GPS In</TableHead>
                    <TableHead>GPS Out</TableHead>
                    <TableHead>GPS Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.date}</TableCell>
                      <TableCell>{r.check_in ?? "—"}</TableCell>
                      <TableCell>{r.check_out ?? <span className="text-warning">Missing</span>}</TableCell>
                      <TableCell>{formatHours(calcMinutes(r.check_in, r.check_out))}</TableCell>
                      <TableCell>{r.gps_first_in ?? "—"}</TableCell>
                      <TableCell>{r.gps_last_out ?? <span className="text-warning">Missing</span>}</TableCell>
                      <TableCell>{formatHours(calcMinutes(r.gps_first_in, r.gps_last_out) || (r.gps_total_hours ? Math.round(r.gps_total_hours * 60) : 0))}</TableCell>
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
