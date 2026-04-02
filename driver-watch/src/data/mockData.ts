export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicleNumber: string;
  status: "active" | "inactive";
  assignedRoute: "Route A" | "Route B" | "Route C";
  currentLat: number;
  currentLng: number;
  routeStatus: "on-route" | "off-route";
}

export interface AttendanceRecord {
  driverId: string;
  driverName: string;
  type: "manual" | "gps";
  checkInTime: string;
  date: string;
}

export interface Session {
  driverId: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
}

export interface Trip {
  id: string;
  driverId: string;
  driverName: string;
  origin: string;
  destination: string;
  durationMinutes: number;
  distanceKm: number;
  date: string;
}

// IIT campus center approx
const CENTER_LAT = 12.9916;
const CENTER_LNG = 80.2336;

export const drivers: Driver[] = [
  { id: "DRV-001", name: "Rajesh Kumar", phone: "+91 98765 43210", vehicleNumber: "TN-01-AB-1234", status: "active", assignedRoute: "Route A", currentLat: CENTER_LAT + 0.002, currentLng: CENTER_LNG + 0.001, routeStatus: "on-route" },
  { id: "DRV-002", name: "Suresh Babu", phone: "+91 98765 43211", vehicleNumber: "TN-01-CD-5678", status: "active", assignedRoute: "Route B", currentLat: CENTER_LAT - 0.001, currentLng: CENTER_LNG + 0.003, routeStatus: "on-route" },
  { id: "DRV-003", name: "Anand Sharma", phone: "+91 98765 43212", vehicleNumber: "TN-01-EF-9012", status: "active", assignedRoute: "Route C", currentLat: CENTER_LAT + 0.004, currentLng: CENTER_LNG - 0.002, routeStatus: "off-route" },
  { id: "DRV-004", name: "Vikram Singh", phone: "+91 98765 43213", vehicleNumber: "TN-01-GH-3456", status: "inactive", assignedRoute: "Route A", currentLat: CENTER_LAT - 0.003, currentLng: CENTER_LNG - 0.001, routeStatus: "on-route" },
  { id: "DRV-005", name: "Mohan Das", phone: "+91 98765 43214", vehicleNumber: "TN-01-IJ-7890", status: "active", assignedRoute: "Route B", currentLat: CENTER_LAT + 0.001, currentLng: CENTER_LNG + 0.004, routeStatus: "on-route" },
  { id: "DRV-006", name: "Prakash Raj", phone: "+91 98765 43215", vehicleNumber: "TN-01-KL-2345", status: "active", assignedRoute: "Route C", currentLat: CENTER_LAT - 0.002, currentLng: CENTER_LNG + 0.002, routeStatus: "off-route" },
  { id: "DRV-007", name: "Karthik Nair", phone: "+91 98765 43216", vehicleNumber: "TN-01-MN-6789", status: "active", assignedRoute: "Route A", currentLat: CENTER_LAT + 0.003, currentLng: CENTER_LNG + 0.003, routeStatus: "on-route" },
  { id: "DRV-008", name: "Arun Patel", phone: "+91 98765 43217", vehicleNumber: "TN-01-OP-0123", status: "inactive", assignedRoute: "Route B", currentLat: CENTER_LAT, currentLng: CENTER_LNG, routeStatus: "on-route" },
];

export const attendance: AttendanceRecord[] = [
  { driverId: "DRV-001", driverName: "Rajesh Kumar", type: "manual", checkInTime: "08:15", date: "2026-04-01" },
  { driverId: "DRV-002", driverName: "Suresh Babu", type: "gps", checkInTime: "08:30", date: "2026-04-01" },
  { driverId: "DRV-003", driverName: "Anand Sharma", type: "manual", checkInTime: "08:45", date: "2026-04-01" },
  { driverId: "DRV-005", driverName: "Mohan Das", type: "gps", checkInTime: "09:00", date: "2026-04-01" },
  { driverId: "DRV-006", driverName: "Prakash Raj", type: "manual", checkInTime: "08:20", date: "2026-04-01" },
  { driverId: "DRV-007", driverName: "Karthik Nair", type: "gps", checkInTime: "08:10", date: "2026-04-01" },
];

export const sessions: Session[] = [
  { driverId: "DRV-001", startTime: "08:15", endTime: "12:30", durationMinutes: 255 },
  { driverId: "DRV-001", startTime: "13:30", endTime: null, durationMinutes: 120 },
  { driverId: "DRV-002", startTime: "08:30", endTime: null, durationMinutes: 300 },
  { driverId: "DRV-003", startTime: "08:45", endTime: "11:00", durationMinutes: 135 },
  { driverId: "DRV-005", startTime: "09:00", endTime: null, durationMinutes: 240 },
  { driverId: "DRV-006", startTime: "08:20", endTime: "14:00", durationMinutes: 340 },
  { driverId: "DRV-007", startTime: "08:10", endTime: null, durationMinutes: 350 },
];

export const trips: Trip[] = [
  { id: "T-001", driverId: "DRV-001", driverName: "Rajesh Kumar", origin: "Main Gate", destination: "Hostel Zone", durationMinutes: 12, distanceKm: 3.2, date: "2026-04-01" },
  { id: "T-002", driverId: "DRV-001", driverName: "Rajesh Kumar", origin: "Hostel Zone", destination: "Academic Block", durationMinutes: 8, distanceKm: 2.1, date: "2026-04-01" },
  { id: "T-003", driverId: "DRV-002", driverName: "Suresh Babu", origin: "Main Gate", destination: "Research Park", durationMinutes: 15, distanceKm: 4.5, date: "2026-04-01" },
  { id: "T-004", driverId: "DRV-003", driverName: "Anand Sharma", origin: "Staff Quarters", destination: "Main Gate", durationMinutes: 10, distanceKm: 2.8, date: "2026-04-01" },
  { id: "T-005", driverId: "DRV-005", driverName: "Mohan Das", origin: "Academic Block", destination: "Sports Complex", durationMinutes: 7, distanceKm: 1.9, date: "2026-04-01" },
  { id: "T-006", driverId: "DRV-006", driverName: "Prakash Raj", origin: "Research Park", destination: "Hostel Zone", durationMinutes: 14, distanceKm: 3.8, date: "2026-04-01" },
  { id: "T-007", driverId: "DRV-007", driverName: "Karthik Nair", origin: "Main Gate", destination: "Academic Block", durationMinutes: 11, distanceKm: 3.0, date: "2026-04-01" },
  { id: "T-008", driverId: "DRV-002", driverName: "Suresh Babu", origin: "Research Park", destination: "Staff Quarters", durationMinutes: 9, distanceKm: 2.5, date: "2026-04-01" },
  { id: "T-009", driverId: "DRV-005", driverName: "Mohan Das", origin: "Sports Complex", destination: "Main Gate", durationMinutes: 13, distanceKm: 3.6, date: "2026-04-01" },
  { id: "T-010", driverId: "DRV-007", driverName: "Karthik Nair", origin: "Academic Block", destination: "Hostel Zone", durationMinutes: 6, distanceKm: 1.5, date: "2026-04-01" },
];

export const routePolylines: Record<string, [number, number][]> = {
  "Route A": [
    [CENTER_LAT - 0.005, CENTER_LNG - 0.003],
    [CENTER_LAT - 0.002, CENTER_LNG],
    [CENTER_LAT, CENTER_LNG + 0.002],
    [CENTER_LAT + 0.003, CENTER_LNG + 0.003],
    [CENTER_LAT + 0.005, CENTER_LNG + 0.001],
  ],
  "Route B": [
    [CENTER_LAT - 0.004, CENTER_LNG + 0.004],
    [CENTER_LAT - 0.001, CENTER_LNG + 0.003],
    [CENTER_LAT + 0.001, CENTER_LNG + 0.004],
    [CENTER_LAT + 0.003, CENTER_LNG + 0.002],
  ],
  "Route C": [
    [CENTER_LAT + 0.005, CENTER_LNG - 0.004],
    [CENTER_LAT + 0.003, CENTER_LNG - 0.002],
    [CENTER_LAT, CENTER_LNG],
    [CENTER_LAT - 0.002, CENTER_LNG + 0.002],
  ],
};
