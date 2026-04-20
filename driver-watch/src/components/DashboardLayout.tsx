import { MapPinned, UserCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import tutemLogo from "@/assets/logo.png";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigationGroups = [
  {
    label: "Security",
    items: [
      { title: "Home", url: "/", end: true },
      { title: "Drivers", url: "/drivers" },
      { title: "Attendance", url: "/attendance" },
      { title: "Live Dashboard", url: "/live-dashboard" },
      { title: "Route Adherence", url: "/routes" },
    ],
  },
  {
    label: "TUTEM",
    items: [
      { title: "User Database", url: "/tutem/user-database" },
      { title: "Daily Trips", url: "/tutem/daily-trips" },
      { title: "Verification Status", url: "/tutem/verification-status" },
      { title: "Feedback", url: "/tutem/feedback" },
    ],
  },
  {
    label: "R&D",
    items: [{ title: "R&D", url: "/rnd" }],
  },
];

export function DashboardLayout({ children, title }: { children: React.ReactNode; title: string }) {
  const iitBombayMapsUrl =
    "https://maps.app.goo.gl/fMoYr14WQCHFYwiQ9";
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const handleOpenGps = () => {
    window.open(iitBombayMapsUrl, "_blank", "noopener,noreferrer");
  };

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const queueCloseMenu = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenMenu(null);
    }, 150);
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-50 border-b border-blue-200/70 bg-gradient-to-r from-white via-blue-50/70 to-white backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <NavLink to="/" className="flex items-center gap-3 rounded-md transition-opacity hover:opacity-90">
              <img src={tutemLogo} alt="TUTEM home" className="h-10 w-10 shrink-0 object-contain" />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
                {/* <p className="hidden text-xs text-muted-foreground sm:block">Intelligence Dashboard</p> */}
              </div>
            </NavLink>
            <nav className="hidden items-center gap-1 lg:flex">
              {navigationGroups.map((group) => (
                <DropdownMenu
                  key={group.label}
                  open={openMenu === group.label}
                  onOpenChange={(nextOpen) => {
                    if (nextOpen) {
                      clearCloseTimer();
                      setOpenMenu(group.label);
                    } else if (openMenu === group.label) {
                      setOpenMenu(null);
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="gap-1.5 px-3 text-sm font-medium text-blue-900 hover:bg-blue-100 hover:text-blue-700"
                      onMouseEnter={() => {
                        clearCloseTimer();
                        setOpenMenu(group.label);
                      }}
                      onMouseLeave={queueCloseMenu}
                    >
                      {group.label}
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="min-w-56 border-blue-100 bg-white/95"
                    onMouseEnter={clearCloseTimer}
                    onMouseLeave={queueCloseMenu}
                  >
                    {group.items.map((item) => (
                      <DropdownMenuItem key={item.title} asChild>
                        <NavLink
                          to={item.url}
                          end={item.end ?? false}
                          className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-slate-700 outline-none transition-colors hover:bg-blue-100 hover:text-blue-700"
                          activeClassName="bg-blue-100 text-blue-700"
                        >
                          {item.title}
                        </NavLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenGps}
              className="gap-2 border-blue-200 bg-white text-blue-700 hover:bg-blue-100 hover:text-blue-800"
            >
              <MapPinned className="h-4 w-4" />
              Google Maps
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-200 bg-white shadow-sm">
              <UserCircle2 className="h-5 w-5 text-blue-700" />
            </div>
          </div>
        </div>

        <div className="border-t px-4 py-3 sm:px-6 lg:hidden">
          <div className="flex flex-wrap gap-2">
            {navigationGroups.map((group) => (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    {group.label}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-56">
                  {group.items.map((item) => (
                    <DropdownMenuItem key={item.title} asChild>
                      <NavLink
                        to={item.url}
                        end={item.end ?? false}
                        className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                        activeClassName="bg-accent text-accent-foreground"
                      >
                        {item.title}
                      </NavLink>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
