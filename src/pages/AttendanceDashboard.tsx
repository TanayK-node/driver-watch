import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, UserX, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { useNavigate } from "react-router-dom";

export default function AttendanceDashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const navigate = useNavigate();
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("driverId, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ["attendance", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("date", dateStr);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (driverFilter === "all") return attendance;
    return attendance.filter((a) => a.driver_id === driverFilter);
  }, [attendance, driverFilter]);

  const presentIds = new Set(attendance.map((a) => a.driver_id));
  const presentCount = presentIds.size;
  const absentCount = drivers.length - presentCount;

  const calcHours = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return "—";
    const [h1, m1] = checkIn.split(":").map(Number);
    const [h2, m2] = checkOut.split(":").map(Number);
    const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff <= 0) return "—";
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hrs}h ${mins}m`;
  };

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return "Unknown";
    return drivers.find((d) => d.driverId === driverId)?.name ?? driverId;
  };

  return (
    <DashboardLayout title="Attendance Dashboard">
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Date</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "PPP")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Driver</p>
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Drivers</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.driverId} value={d.driverId}>
                    {d.name ?? d.driverId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KPICard title="Total Drivers" value={drivers.length} icon={Users} />
          <KPICard title="Present Today" value={presentCount} icon={UserCheck} accent="success" />
          <KPICard title="Absent Today" value={absentCount} icon={UserX} accent="destructive" />
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Attendance Records — {format(selectedDate, "dd MMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No records found for this date.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Working Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/attendance/driver/${a.driver_id}`)}
                    >
                      <TableCell className="font-medium">{getDriverName(a.driver_id)}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.source === "gps" ? "gps" : "manual"} />
                      </TableCell>
                      <TableCell>{a.check_in ?? "—"}</TableCell>
                      <TableCell>{a.check_out ?? <span className="text-warning">Missing</span>}</TableCell>
                      <TableCell>{calcHours(a.check_in, a.check_out)}</TableCell>
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
