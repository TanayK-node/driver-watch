import { useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { drivers, routePolylines } from "@/data/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const routeColors: Record<string, string> = {
  "Route A": "#3b82f6",
  "Route B": "#22c55e",
  "Route C": "#f59e0b",
};

const CENTER_LAT = 12.9916;
const CENTER_LNG = 80.2336;

export default function LiveMap() {
  return (
    <DashboardLayout title="Live Map View">
      <Card className="overflow-hidden">
        <CardContent className="p-0 h-[calc(100vh-8rem)]">
          <MapContainer
            center={[CENTER_LAT, CENTER_LNG]}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Route polylines */}
            {Object.entries(routePolylines).map(([name, positions]) => (
              <Polyline
                key={name}
                positions={positions}
                pathOptions={{ color: routeColors[name], weight: 4, opacity: 0.7 }}
              />
            ))}

            {/* Driver markers */}
            {drivers.filter(d => d.status === "active").map((driver) => (
              <Marker key={driver.id} position={[driver.currentLat, driver.currentLng]}>
                <Popup>
                  <div className="text-sm space-y-1 min-w-[160px]">
                    <p className="font-semibold">{driver.name}</p>
                    <p className="text-muted-foreground">{driver.vehicleNumber}</p>
                    <p>{driver.assignedRoute}</p>
                    <div className="pt-1">
                      <StatusBadge status={driver.routeStatus} />
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </CardContent>
      </Card>

      <div className="mt-4 flex gap-4 flex-wrap">
        {Object.entries(routeColors).map(([name, color]) => (
          <div key={name} className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-1 rounded" style={{ backgroundColor: color }} />
            {name}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
