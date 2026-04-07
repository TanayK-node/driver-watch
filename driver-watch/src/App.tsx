import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import LandingPage from "./pages/LandingPage";
import DriverOverview from "./pages/DriverOverview";
import DriverDetail from "./pages/DriverDetail";
import AttendanceDashboard from "./pages/AttendanceDashboard";
import AttendanceUpload from "./pages/AttendanceUpload";
import DriverAttendanceDetail from "./pages/DriverAttendanceDetail";
import RouteAdherence from "./pages/RouteAdherence";
import TripAnalytics from "./pages/TripAnalytics";
import LiveMap from "./pages/LiveMap";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route path="/" element={<Protected><LandingPage /></Protected>} />
          <Route path="/drivers" element={<Protected><DriverOverview /></Protected>} />
          <Route path="/driver/:id" element={<Protected><DriverDetail /></Protected>} />
          <Route path="/attendance" element={<Protected><AttendanceDashboard /></Protected>} />
          <Route path="/attendance/upload" element={<Protected><AttendanceUpload /></Protected>} />
          <Route path="/attendance/driver/:driverId" element={<Protected><DriverAttendanceDetail /></Protected>} />
          <Route path="/routes" element={<Protected><RouteAdherence /></Protected>} />
          <Route path="/trips" element={<Protected><TripAnalytics /></Protected>} />
          <Route path="/map" element={<Protected><LiveMap /></Protected>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
