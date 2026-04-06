import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "./pages/LandingPage";
import DriverOverview from "./pages/DriverOverview";
import DriverDetail from "./pages/DriverDetail";
import AttendanceDashboard from "./pages/AttendanceDashboard";
import AttendanceUpload from "./pages/AttendanceUpload";
import DriverAttendanceDetail from "./pages/DriverAttendanceDetail";
import RouteAdherence from "./pages/RouteAdherence";
import TripAnalytics from "./pages/TripAnalytics";
import LiveMap from "./pages/LiveMap";
import BulkGpsAttendance from "./pages/BulkGpsAttendance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/drivers" element={<DriverOverview />} />
          <Route path="/driver/:id" element={<DriverDetail />} />
          <Route path="/attendance" element={<AttendanceDashboard />} />
          <Route path="/attendance/upload" element={<AttendanceUpload />} />
          <Route path="/attendance/driver/:driverId" element={<DriverAttendanceDetail />} />
          <Route path="/routes" element={<RouteAdherence />} />
          <Route path="/trips" element={<TripAnalytics />} />
          <Route path="/map" element={<LiveMap />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
