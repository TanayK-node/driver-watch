import {
  Home,
  Users,
  ClipboardCheck,
  Route,
  BarChart3,
  Map,
  Monitor,
  LogOut,
  Database,
  CalendarClock,
  ShieldCheck,
  MessageSquareText,
  FlaskConical,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navigationGroups = [
  {
    label: "Security",
    items: [
      { title: "Home", url: "/", icon: Home, end: true },
      { title: "Drivers", url: "/drivers", icon: Users },
      { title: "Attendance", url: "/attendance", icon: ClipboardCheck },
      { title: "Live Dashboard", url: "/live-dashboard", icon: Monitor },
      { title: "Route Adherence", url: "/routes", icon: Route },
    ],
  },
  {
    label: "TUTEM",
    items: [
      { title: "User Database", url: "/tutem/user-database", icon: Database },
      { title: "Daily Trips", url: "/tutem/daily-trips", icon: CalendarClock },
      { title: "Verification Status", url: "/tutem/verification-status", icon: ShieldCheck },
      { title: "Feedback", url: "/tutem/feedback", icon: MessageSquareText },
    ],
  },
  {
    label: "R&D",
    items: [{ title: "R&D", url: "/rnd", icon: FlaskConical }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-5">
          {!collapsed && (
            <h2 className="text-lg font-bold text-sidebar-primary-foreground tracking-tight">
              Driver db
            </h2>
          )}
          {collapsed && <span className="text-xl">🚗</span>}
        </div>
        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.end ?? false}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
