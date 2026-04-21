import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { getJson } from '@/lib/api';

// Fix for default Leaflet icon issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const autoIcon = new L.Icon({
    iconUrl: 'https://tutem.in/auto.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

const selectedAutoIcon = new L.Icon({
    iconUrl: 'https://tutem.in/auto.png',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
});

const routeColors: Record<string, string> = {
    "green": "#d4f4dd",
    "yellow": "#fff9c4",
    "blue": "#e3f2fd",
    "red": "#ffcdd2",
    "orange": "#ffe0b2",
    "purple": "#e1bee7",
    "not assigned": "#f5f5f5"
};

interface Driver {
    driverId: string;
    name: string;
    shuttleService: boolean;
    latitude: number;
    longitude: number;
    vehicleRegistrationNo: string;
    vehicleRoute: string;
    vehicleColor: string | null;
}

const normalizeKey = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

const isCssColor = (value: string) =>
    value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl');

const getDriverColorValue = (driver: Pick<Driver, 'vehicleColor' | 'vehicleRoute'>) => {
    const color = normalizeKey(driver.vehicleColor);
    const route = normalizeKey(driver.vehicleRoute);

    if (color && isCssColor(color)) return color;
    if (color && routeColors[color]) return routeColors[color];
    if (route && routeColors[route]) return routeColors[route];
    return routeColors['not assigned'];
};

const getDriverColorKey = (driver: Pick<Driver, 'vehicleColor' | 'vehicleRoute'>) => {
    const color = normalizeKey(driver.vehicleColor);
    const route = normalizeKey(driver.vehicleRoute);

    if (['green', 'yellow', 'blue'].includes(color)) return color;
    if (['green', 'yellow', 'blue'].includes(route)) return route;
    return 'not assigned';
};

export default function LiveDashboard() {
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [totalRegistered, setTotalRegistered] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRefs = useRef<Record<string, L.Marker | null>>({});

    const fetchDashboardData = async () => {
        try {
            setError(null);
            const [driversRes, countRes] = await Promise.all([
                getJson<{ data: Driver[] }>('/api/ride-request/drivers/name/locations/iitb'),
                getJson<{ count: number }>('/api/drivers/count'),
            ]);

            setDrivers(driversRes.data ?? []);
            setTotalRegistered(countRes.count ?? 0);
        } catch (err) {
            console.error("API Error:", err);
            setError("Error connecting to server. Retrying...");
        }
    };

    useEffect(() => {
        fetchDashboardData();
        const driversPoll = setInterval(fetchDashboardData, 5000); // 5 seconds
        const countPoll = setInterval(fetchDashboardData, 50000);  // 50 seconds

        return () => {
            clearInterval(driversPoll);
            clearInterval(countPoll);
        };
    }, []);

    const focusDriverOnMap = (driver: Driver) => {
        setSelectedDriverId(driver.driverId);

        if (mapRef.current) {
            const targetZoom = Math.max(mapRef.current.getZoom(), 17);
            mapRef.current.flyTo([driver.latitude, driver.longitude], targetZoom, { duration: 0.8 });
        }

        const marker = markerRefs.current[driver.driverId];
        if (marker) {
            marker.openPopup();
        }
    };

    const G = drivers.filter((d) => getDriverColorKey(d) === 'green').length;
    const Y = drivers.filter((d) => getDriverColorKey(d) === 'yellow').length;
    const B = drivers.filter((d) => getDriverColorKey(d) === 'blue').length;

    return (
        <DashboardLayout title="Live Dashboard">
            <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <h2 className="text-lg font-semibold text-foreground">IIT Bombay Campus Auto Service Dashboard</h2>
                            <p className="text-sm text-muted-foreground">
                                Real-time location and booking overview for active campus drivers.
                            </p>
                        </div>
                        {error && (
                            <Badge variant="destructive" className="whitespace-normal text-xs">
                                {error}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="grid items-start gap-4 md:grid-cols-[7fr_3fr]">
                    <div className="space-y-4">
                        {/* Map */}
                        <div className="relative z-0 overflow-hidden rounded-xl border bg-card shadow-sm">
                            <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
                                <p className="text-sm font-medium text-foreground">Live Vehicle Map</p>
                                <Button variant="outline" size="sm" onClick={fetchDashboardData}>
                                    Refresh Map
                                </Button>
                            </div>
                            <div className="h-[55vh] min-h-[340px]">
                                <MapContainer
                                    center={[19.13238, 72.91732]}
                                    zoom={16}
                                    className="h-full w-full"
                                    ref={(mapInstance) => {
                                        mapRef.current = mapInstance;
                                    }}
                                >
                                    <TileLayer
                                        attribution='&copy; OpenStreetMap'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />
                                    {drivers.map((driver) => (
                                        <Marker
                                            key={driver.driverId}
                                            position={[driver.latitude, driver.longitude]}
                                            icon={selectedDriverId === driver.driverId ? selectedAutoIcon : autoIcon}
                                            ref={(markerInstance) => {
                                                markerRefs.current[driver.driverId] = markerInstance;
                                            }}
                                        >
                                            <Popup>
                                                <div className="text-center">
                                                    <strong className="block text-lg">{driver.name}</strong>
                                                    <span className="text-sm text-gray-600">Auto Number: {driver.vehicleRegistrationNo}</span>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ))}
                                </MapContainer>
                            </div>
                        </div>

                        {/* Live stats below map */}
                        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                            <div className="flex justify-between items-center">
                                <h2 className="font-semibold text-base text-foreground">Live Status</h2>
                                <Button variant="secondary" size="sm" onClick={fetchDashboardData}>
                                    Sync
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div className="rounded-md border bg-background p-2.5">
                                    <p className="text-xs text-muted-foreground">Available</p>
                                    <p className="text-lg font-semibold text-foreground">{drivers.length}</p>
                                </div>
                                <div className="rounded-md border bg-background p-2.5">
                                    <p className="text-xs text-muted-foreground">Registered</p>
                                    <p className="text-lg font-semibold text-foreground">{totalRegistered}</p>
                                </div>
                                <div className="rounded-md border bg-background p-2.5">
                                    <p className="text-xs text-muted-foreground">Green</p>
                                    <p className="text-lg font-semibold text-foreground">{G}</p>
                                </div>
                                <div className="rounded-md border bg-background p-2.5">
                                    <p className="text-xs text-muted-foreground">Yellow + Blue</p>
                                    <p className="text-lg font-semibold text-foreground">{Y + B}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                                    Green: {G}
                                </Badge>
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800">
                                    Yellow: {Y}
                                </Badge>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800">
                                    Blue: {B}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Driver list */}
                    <div className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                        <div className="flex border-b bg-muted/40 p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <div className="w-3/4 pl-2">Name</div>
                            <div className="w-1/4 text-center">Booking</div>
                        </div>

                        <div className="max-h-[calc(55vh+8.5rem)] min-h-[320px] space-y-2 overflow-y-auto p-3">
                            {drivers.map(d => (
                                <div
                                    key={d.driverId}
                                    onClick={() => focusDriverOnMap(d)}
                                    className={`p-3 rounded-lg flex items-center justify-between border transition-all hover:shadow-sm cursor-pointer ${selectedDriverId === d.driverId ? 'border-blue-500 ring-2 ring-blue-200 shadow-sm' : 'border-border'}`}
                                    style={{ backgroundColor: getDriverColorValue(d) }}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-800 tracking-tight">{d.name}</span>
                                        <span className="text-xs text-slate-600 font-mono mt-0.5">
                                            {d.vehicleRegistrationNo} · {d.vehicleColor || d.vehicleRoute || 'not assigned'}
                                        </span>
                                    </div>
                                    <div className="flex justify-center w-1/4">
                                        <input
                                            type="checkbox"
                                            checked={d.shuttleService}
                                            readOnly
                                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-not-allowed opacity-80"
                                        />
                                    </div>
                                </div>
                            ))}

                            {drivers.length === 0 && !error && (
                                <div className="text-center p-8 text-muted-foreground text-sm">
                                    No active drivers found inside campus right now.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}