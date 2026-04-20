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
import LiveDashboard from './pages/LiveDashboard'
import DriverAttendanceDetail from "./pages/DriverAttendanceDetail";
import RouteAdherence from "./pages/RouteAdherence";
import TripAnalytics from "./pages/TripAnalytics";
import LiveMap from "./pages/LiveMap";
import WIPPage from "./pages/WIPPage";
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
          <Route path="/live-dashboard" element={<LiveDashboard />} />
          <Route path="/attendance/driver/:driverId" element={<Protected><DriverAttendanceDetail /></Protected>} />
          <Route path="/routes" element={<Protected><RouteAdherence /></Protected>} />
          <Route path="/trips" element={<Protected><TripAnalytics /></Protected>} />
          <Route path="/map" element={<Protected><LiveMap /></Protected>} />
          <Route
            path="/tutem/user-database"
            element={<Protected><WIPPage title="User Database" description="The TUTEM user database view is under development." /></Protected>}
          />
          <Route
            path="/tutem/daily-trips"
            element={<Protected><WIPPage title="Daily Trips" description="The daily trips page is under development." /></Protected>}
          />
          <Route
            path="/tutem/verification-status"
            element={<Protected><WIPPage title="Verification Status" description="The verification status page is under development." /></Protected>}
          />
          <Route
            path="/tutem/feedback"
            element={<Protected><WIPPage title="Feedback" description="The feedback page is under development." /></Protected>}
          />
          <Route
            path="/rnd"
            element={<Protected><WIPPage title="R&D" description="The R&D section is under development." /></Protected>}
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
