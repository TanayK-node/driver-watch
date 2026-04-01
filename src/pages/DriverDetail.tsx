import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { drivers, attendance, sessions } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, Car, MapPin, Clock } from "lucide-react";

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const driver = drivers.find((d) => d.id === id);

  if (!driver) {
    return (
      <DashboardLayout title="Driver Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Driver not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const driverAttendance = attendance.find((a) => a.driverId === driver.id);
  const driverSessions = sessions.filter((s) => s.driverId === driver.id);
  const totalMinutes = driverSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const activeSessions = driverSessions.filter((s) => !s.endTime).length;

  return (
    <DashboardLayout title={driver.name}>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Drivers
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {driver.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{driver.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">{driver.id}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {driver.phone}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Car className="h-4 w-4" /> {driver.vehicleNumber}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" /> {driver.assignedRoute}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={driver.status} />
                  <StatusBadge status={driver.routeStatus} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Today's Attendance</CardTitle></CardHeader>
            <CardContent>
              {driverAttendance ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <StatusBadge status={driverAttendance.type} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Check-in</span>
                    <span className="text-sm font-medium">{driverAttendance.checkInTime}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusBadge status="present" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-6">
                  <StatusBadge status="absent" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-base">Session Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{driverSessions.length}</p>
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                </div>
                <div className="text-center p-3 bg-primary/10 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{activeSessions}</p>
                  <p className="text-xs text-muted-foreground">Active Now</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</p>
                  <p className="text-xs text-muted-foreground">Total Working Time</p>
                </div>
              </div>
              <div className="space-y-2">
                {driverSessions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{s.startTime} – {s.endTime || "Ongoing"}</span>
                    </div>
                    <span className="text-muted-foreground">{Math.floor(s.durationMinutes / 60)}h {s.durationMinutes % 60}m</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
