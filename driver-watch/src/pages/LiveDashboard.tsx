import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix for default Leaflet icon issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const autoIcon = new L.Icon({
    iconUrl: 'https://tutem.in/auto.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
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

    const fetchDashboardData = async () => {
        try {
            setError(null);
            const [driversRes, countRes, colorsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/ride-request/drivers/name/locations/iitb`),
                fetch(`${API_BASE_URL}/api/ride-request/drivers/name/locations/iitb/getIITBDriverCount`),
                supabase.from('drivers').select('driverId, vehicleColor')
            ]);

            if (colorsRes.error) throw colorsRes.error;
            if (!driversRes.ok) throw new Error('Failed to load live drivers');
            if (!countRes.ok) throw new Error('Failed to load registered driver count');

            const driversData = await driversRes.json();
            const countData = await countRes.json();

            const colorMap = new Map(
                (colorsRes.data ?? []).map((driver) => [driver.driverId, driver.vehicleColor ?? null])
            );

            setDrivers(
                (driversData ?? []).map((driver: Driver) => ({
                    ...driver,
                    vehicleColor: colorMap.get(driver.driverId) ?? null,
                }))
            );
            setTotalRegistered(countData.count);
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

    const G = drivers.filter((d) => getDriverColorKey(d) === 'green').length;
    const Y = drivers.filter((d) => getDriverColorKey(d) === 'yellow').length;
    const B = drivers.filter((d) => getDriverColorKey(d) === 'blue').length;

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-gray-900 text-white p-4 shadow-md flex justify-between items-center z-10 relative">
                <h1 className="text-xl font-bold tracking-tight">IIT Bombay Campus Auto Service Dashboard</h1>
                {error && <span className="text-red-400 text-sm">{error}</span>}
            </header>

            {/* Main Content */}
            <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
                
                {/* Left Side: Map */}
                <div className="flex-1 relative h-[50vh] md:h-full z-0">
                    <MapContainer 
                        center={[19.13238, 72.91732]} 
                        zoom={16} 
                        className="h-full w-full"
                    >
                        <TileLayer 
                            attribution='&copy; OpenStreetMap'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                        />
                        {drivers.map((driver) => (
                            <Marker 
                                key={driver.driverId} 
                                position={[driver.latitude, driver.longitude]} 
                                icon={autoIcon}
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

                    <button 
                        onClick={fetchDashboardData}
                        className="absolute bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-green-700 transition-colors z-[1000] flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        Refresh Map
                    </button>
                </div>

                {/* Right Side: Driver List Panel */}
                <div className="w-full md:w-1/3 bg-white flex flex-col border-l border-gray-200 shadow-xl z-10">
                    {/* Stats Card */}
                    <div className="p-5 border-b border-gray-200 bg-gray-50">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-semibold text-lg text-gray-800">Live Status</h2>
                            <button 
                                onClick={fetchDashboardData} 
                                className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition flex items-center gap-1 shadow-sm"
                            >
                                Sync
                            </button>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-gray-600">
                                Total Available Drivers: <strong className="text-gray-900">{drivers.length}</strong> 
                                <span className="text-xs ml-2 text-gray-500">(G: {G} | Y: {Y} | B: {B})</span>
                            </p>
                            <p className="text-sm text-gray-600">
                                Total Registered Drivers: <strong className="text-gray-900">{totalRegistered}</strong>
                            </p>
                        </div>
                    </div>

                    {/* Table Headers */}
                    <div className="flex bg-gray-100 p-3 border-b border-gray-200 font-semibold text-sm text-gray-600 uppercase tracking-wider">
                        <div className="w-3/4 pl-2">Name</div>
                        <div className="w-1/4 text-center">Booking</div>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {drivers.map(d => (
                            <div 
                                key={d.driverId} 
                                className="p-3 rounded-md shadow-sm flex items-center justify-between border border-gray-100 transition-all hover:shadow-md"
                                style={{ backgroundColor: getDriverColorValue(d) }}
                            >
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800 tracking-tight">{d.name}</span>
                                    <span className="text-xs text-gray-600 font-mono mt-0.5">
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
                            <div className="text-center p-8 text-gray-500">
                                No active drivers found inside campus right now.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}