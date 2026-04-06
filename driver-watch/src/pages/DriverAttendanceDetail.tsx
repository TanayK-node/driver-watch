import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { KPICard } from "@/components/KPICard";
import { CalendarDays, Clock, UserCheck } from "lucide-react";

export default function DriverAttendanceDetail() {
  const { driverId } = useParams<{ driverId: string }>();

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

  const getDisplayCheckIn = (record: any) => record.check_in ?? record.gps_first_in ?? null;

  const getDisplayCheckOut = (record: any) => record.check_out ?? record.gps_last_out ?? null;

  const calcMinutes = (record: any) => {
    const checkIn = getDisplayCheckIn(record);
    const checkOut = getDisplayCheckOut(record);
    if (!checkIn || !checkOut) return 0;
    const [h1, m1] = checkIn.split(":").map(Number);
    const [h2, m2] = checkOut.split(":").map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    return diff > 0 ? diff : 0;
  };

  const formatHours = (mins: number) => {
    if (mins === 0) return "—";
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const totalDays = records.length;
  const totalMinutes = records.reduce((sum, r) => sum + calcMinutes(r), 0);
  const avgHours = totalDays > 0 ? formatHours(Math.round(totalMinutes / totalDays)) : "—";

  return (
    <DashboardLayout title={`Attendance — ${driver?.name ?? driverId}`}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard title="Total Days Present" value={totalDays} icon={CalendarDays} accent="success" />
          <KPICard title="Total Hours Worked" value={formatHours(totalMinutes)} icon={Clock} />
          <KPICard title="Avg Hours/Day" value={avgHours} icon={UserCheck} accent="warning" />
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
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Hours Worked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.date}</TableCell>
                      <TableCell>{getDisplayCheckIn(r) ?? "—"}</TableCell>
                      <TableCell>{getDisplayCheckOut(r) ?? <span className="text-warning">Missing</span>}</TableCell>
                      <TableCell>{formatHours(calcMinutes(r))}</TableCell>
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
