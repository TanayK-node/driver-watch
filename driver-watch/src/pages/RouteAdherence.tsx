import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { drivers } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle } from "lucide-react";

const routes = ["Route A", "Route B", "Route C"] as const;

export default function RouteAdherence() {
  const offRouteDrivers = drivers.filter((d) => d.routeStatus === "off-route");

  return (
    <DashboardLayout title="Route Adherence">
      <div className="space-y-6">
        {offRouteDrivers.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Deviation Alerts</p>
                <p className="text-sm text-muted-foreground">
                  {offRouteDrivers.map((d) => d.name).join(", ")} — currently off their assigned routes.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {routes.map((route) => {
            const routeDrivers = drivers.filter((d) => d.assignedRoute === route);
            return (
              <Card key={route}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{route}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {routeDrivers.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                        <span className="font-medium">{d.name}</span>
                        <StatusBadge status={d.routeStatus} />
                      </div>
                    ))}
                    {routeDrivers.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No drivers assigned</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Drivers — Route Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Assigned Route</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((d) => (
                  <TableRow key={d.id} className={d.routeStatus === "off-route" ? "bg-destructive/5" : ""}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.assignedRoute}</TableCell>
                    <TableCell><StatusBadge status={d.routeStatus} /></TableCell>
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
