import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { StatusBadge } from "@/components/StatusBadge";
import { drivers, attendance } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserCheck, Satellite, UserX } from "lucide-react";

export default function AttendanceDashboard() {
  const manualCount = attendance.filter((a) => a.type === "manual").length;
  const gpsCount = attendance.filter((a) => a.type === "gps").length;
  const absentCount = drivers.length - attendance.length;

  return (
    <DashboardLayout title="Attendance Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total Drivers" value={drivers.length} icon={Users} />
          <KPICard title="Present (Gate)" value={manualCount} icon={UserCheck} accent="success" />
          <KPICard title="Present (GPS)" value={gpsCount} icon={Satellite} accent="warning" />
          <KPICard title="Absent" value={absentCount} icon={UserX} accent="destructive" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance Records — Today</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Check-in Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((a) => (
                  <TableRow key={a.driverId}>
                    <TableCell className="font-medium">{a.driverName}</TableCell>
                    <TableCell><StatusBadge status={a.type} /></TableCell>
                    <TableCell>{a.checkInTime}</TableCell>
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
