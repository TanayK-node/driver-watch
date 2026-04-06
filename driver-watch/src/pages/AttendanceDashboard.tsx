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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, UserX, CalendarIcon, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
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

  const getDriverName = (driverId: string | null) => {
    if (!driverId) return "Unknown";
    return drivers.find((d) => d.driverId === driverId)?.name ?? driverId;
  };

  // --- TIME CALCULATION & ANALYSIS LOGIC ---

  // Helper to parse HH:MM or HH:MM:SS into total minutes
  const parseTime = (timeStr: string | null) => {
    if (!timeStr) return null;
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return null;
  };

  // Helper to strip seconds for cleaner UI display
  const formatTimeDisplay = (timeStr: string | null) => {
    if (!timeStr) return "—";
    const parts = timeStr.split(":");
    return `${parts[0]}:${parts[1]}`;
  };

  // Helper to format minutes back to "Xh Ym"
  const formatMins = (mins: number | null) => {
    if (mins === null || mins <= 0) return "—";
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return `${h}h ${m}m`;
  };

  const analyzeRecord = (record: any) => {
    const manualIn = parseTime(record.check_in);
    const manualOut = parseTime(record.check_out);
    const gpsIn = parseTime(record.gps_first_in);
    const gpsOut = parseTime(record.gps_last_out);

    let manualMins = null;
    if (manualIn !== null && manualOut !== null) {
      manualMins = manualOut - manualIn;
      if (manualMins < 0) manualMins += 24 * 60; // Handle overnight shifts
    }

    let gpsMins = null;
    if (gpsIn !== null && gpsOut !== null) {
      gpsMins = gpsOut - gpsIn;
      if (gpsMins < 0) gpsMins += 24 * 60;
    } else if (record.gps_total_hours) {
      gpsMins = Math.round(record.gps_total_hours * 60);
    }

    let status = "pending";
    let statusLabel = "";
    let statusVariant: "default" | "secondary" | "destructive" | "outline" = "outline";

    if (manualMins !== null && gpsMins !== null) {
      const diff = Math.abs(manualMins - gpsMins);
      // Threshold: Mismatch is flagged if the difference is more than 60 minutes
      if (diff <= 60) {
        status = "matched";
        statusLabel = "Verified";
        statusVariant = "default"; // Usually green/primary in standard shadcn
      } else {
        status = "mismatch";
        const diffHrs = (diff / 60).toFixed(1);
        statusLabel = `Mismatch (${diffHrs}h diff)`;
        statusVariant = "destructive"; // Red
      }
    } else if (manualMins !== null) {
      status = "missing_gps";
      statusLabel = "Pending GPS";
      statusVariant = "secondary"; // Gray/Yellow
    } else if (gpsMins !== null) {
      status = "missing_gate";
      statusLabel = "Pending Gate";
      statusVariant = "secondary";
    }

    return {
      manualMins,
      gpsMins,
      statusLabel,
      statusVariant,
    };
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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <KPICard title="Total Drivers" value={drivers.length} icon={Users} />
          <KPICard title="Present Today" value={presentCount} icon={UserCheck} accent="success" />
          <KPICard title="Absent Today" value={absentCount} icon={UserX} accent="destructive" />
          {/* Optional new KPI to track discrepancies */}
          <KPICard 
            title="Mismatches" 
            value={attendance.filter(a => analyzeRecord(a).statusVariant === "destructive").length} 
            icon={AlertTriangle} 
            accent="destructive" 
          />
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Attendance Cross-Verification — {format(selectedDate, "dd MMM yyyy")}
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
                    <TableHead>Gate In/Out</TableHead>
                    <TableHead>Gate Hrs</TableHead>
                    <TableHead>GPS In/Out</TableHead>
                    <TableHead>GPS Hrs</TableHead>
                    <TableHead>Status Analysis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((record) => {
                    const analysis = analyzeRecord(record);
                    return (
                      <TableRow
                        key={record.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/attendance/driver/${record.driver_id}`)}
                      >
                        <TableCell className="font-medium">{getDriverName(record.driver_id)}</TableCell>
                        
                        {/* Gate Data */}
                        <TableCell>
                          <div className="text-xs">
                            <span className="text-muted-foreground">In: </span>{formatTimeDisplay(record.check_in)}
                            <br />
                            <span className="text-muted-foreground">Out: </span>{formatTimeDisplay(record.check_out)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatMins(analysis.manualMins)}</TableCell>

                        {/* GPS Data */}
                        <TableCell>
                          <div className="text-xs">
                            <span className="text-muted-foreground">In: </span>{formatTimeDisplay(record.gps_first_in)}
                            <br />
                            <span className="text-muted-foreground">Out: </span>{formatTimeDisplay(record.gps_last_out)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-blue-600 dark:text-blue-400">
                          {formatMins(analysis.gpsMins)}
                        </TableCell>

                        {/* Analysis Status */}
                        <TableCell>
                          <Badge variant={analysis.statusVariant}>
                            {analysis.statusLabel}
                          </Badge>
                        </TableCell>

                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}