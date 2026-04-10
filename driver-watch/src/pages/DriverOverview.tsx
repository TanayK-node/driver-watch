import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, Palette, Building2, RefreshCw, LayoutGrid, List, Phone, Car, PaintBucket } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function DriverOverview() {
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<string>("table");
  const [showHiddenDrivers, setShowHiddenDrivers] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*");
      if (error) throw error;
      return data;
    },
  });

  const handleSyncMongo = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("https://driver-watch.onrender.com/api/sync-drivers", {
      // const response = await fetch("http://127.0.0.1:8000/api/sync-drivers", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to sync");
      const result = await response.json();
      await queryClient.invalidateQueries({ queryKey: ["drivers"] });
      await queryClient.invalidateQueries({ queryKey: ["drivers-all"] });
      toast({
        title: "Drivers Synced",
        description: result.message || "IITB drivers updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Could not connect to the backend.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const organizations = [...new Set(drivers.map((d) => d.organization).filter(Boolean))];

  const filtered = drivers.filter((d) => {
    const driverColor = (d.vehicleColor ?? "").toLowerCase().trim();
    const matchSearch =
      (d.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      d.driverId.toLowerCase().includes(search.toLowerCase()) ||
      (d.vehicleRegistrationNo?.toLowerCase() || "").includes(search.toLowerCase());
    const matchOrg = orgFilter === "all" || d.organization === orgFilter;
    const matchColor = colorFilter === "all" || driverColor === colorFilter;
    return matchSearch && matchOrg && matchColor;
  });

  const featuredDriverNames = new Set(
    [
      "uma driver aws",
      "gaurav",
      "avijit maji",
      "suso",
      "tapas office",
      "xhx(for testing only don't booking)",
      "prathamesh",
      "rahul tanwar",
      "yameen",
    ].map((name) => name.toLowerCase().trim())
  );

  const hiddenDrivers = filtered.filter((d) =>
    featuredDriverNames.has((d.name ?? "").toLowerCase().trim())
  );
  const normalVisibleDrivers = filtered.filter(
    (d) => !featuredDriverNames.has((d.name ?? "").toLowerCase().trim())
  );
  const visibleDrivers = showHiddenDrivers
    ? [...normalVisibleDrivers, ...hiddenDrivers.slice(0, 10)]
    : normalVisibleDrivers;
  const hiddenDriversCount = hiddenDrivers.length;

  const colorCounts = drivers.reduce((acc, d) => {
    const c = (d.color ?? "unknown").toLowerCase().trim() || "unknown";
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const colorSummary = Object.entries(colorCounts).map(([c, n]) => `${c}: ${n}`).join(", ");
  const vehicleClasses = [...new Set(drivers.map((d) => d.vehicleClass).filter(Boolean))];

  return (
    <DashboardLayout title="Driver Overview">
      <div className="space-y-6 lg:space-y-8">
        <p className="text-xs text-muted-foreground">
          This page gives an overview of all drivers and their details.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <KPICard title="Total Drivers" value={isLoading ? "..." : drivers.length} icon={Users} />
          <KPICard title="Color Summary" value={isLoading ? "..." : colorSummary} icon={PaintBucket} accent="success" />
          <KPICard title="Organizations" value={isLoading ? "..." : organizations.length} icon={Building2} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base lg:text-lg">All Drivers</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(v) => { if (v) setViewMode(v); }}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="table" aria-label="Table view">
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="tiles" aria-label="Tile view">
                    <LayoutGrid className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search drivers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-[220px] lg:w-[240px] lg:text-base"
                  />
                </div>
                <Select value={orgFilter} onValueChange={setOrgFilter}>
                  <SelectTrigger className="w-[180px] lg:w-[200px] lg:text-base">
                    <SelectValue placeholder="Organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org} value={org!}>{org}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={colorFilter} onValueChange={setColorFilter}>
                  <SelectTrigger className="w-[150px] lg:w-[170px] lg:text-base">
                    <SelectValue placeholder="Color" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Colors</SelectItem>
                    <SelectItem value="yellow">Yellow</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                    <SelectItem value="blue">Blue</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={handleSyncMongo}
                  disabled={isSyncing}
                  className="gap-2"
                >
                  <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                  {isSyncing ? "Syncing..." : "Sync"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : viewMode === "table" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="lg:text-sm">Name</TableHead>
                    <TableHead className="lg:text-sm">Vehicle Reg.</TableHead>
                    <TableHead className="lg:text-sm">Organization</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleDrivers.map((d) => (
                    <TableRow
                      key={d.driverId}
                      className={cn(
                        "cursor-pointer",
                        (d.color ?? "").toLowerCase().trim() === "yellow" &&
                          "bg-yellow-50/70 hover:bg-yellow-100/70 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/35",
                        (d.color ?? "").toLowerCase().trim() === "green" &&
                          "bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/35",
                        (d.color ?? "").toLowerCase().trim() === "blue" &&
                          "bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/35",
                        !["yellow", "green", "blue"].includes((d.color ?? "").toLowerCase().trim()) &&
                          "hover:bg-muted/50"
                      )}
                      onClick={() => navigate(`/driver/${d.driverId}`)}
                    >
                      <TableCell className="font-medium lg:text-base">{d.name || "—"}</TableCell>
                      <TableCell className="font-mono text-sm lg:text-base">{d.vehicleRegistrationNo || "—"}</TableCell>
                      <TableCell className="text-sm lg:text-base">{d.organization || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {visibleDrivers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No drivers found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              /* TILES VIEW */
              visibleDrivers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No drivers found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleDrivers.map((d) => (
                    <Card
                      key={d.driverId}
                      className={cn(
                        "cursor-pointer hover:shadow-md transition-all",
                        (d.color ?? "").toLowerCase().trim() === "yellow" &&
                          "border-yellow-300 bg-yellow-50/70 hover:border-yellow-400 dark:border-yellow-700 dark:bg-yellow-950/20",
                        (d.color ?? "").toLowerCase().trim() === "green" &&
                          "border-emerald-300 bg-emerald-50/70 hover:border-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/20",
                        !["yellow", "green"].includes((d.color ?? "").toLowerCase().trim()) &&
                          "hover:border-primary/30"
                      )}
                      onClick={() => navigate(`/driver/${d.driverId}`)}
                    >
                      <CardContent className="p-4 lg:p-5 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base lg:text-lg shrink-0">
                            {d.name?.charAt(0) || "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate lg:text-base">{d.name || "Unknown"}</p>
                            <p className="text-xs lg:text-sm text-muted-foreground font-mono truncate">{d.driverId}</p>
                          </div>
                        </div>
                        <div className="space-y-1.5 text-sm lg:text-base">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Car className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate font-mono">{d.vehicleRegistrationNo || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{d.organization || "—"}</span>
                          </div>
                          {d.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{d.phone}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )
            )}
            {!isLoading && filtered.length > 0 && hiddenDriversCount > 0 && (
              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary"
                  onClick={() => setShowHiddenDrivers((prev) => !prev)}
                >
                  {showHiddenDrivers
                    ? "Hide hidden drivers"
                    : `View hidden drivers (${Math.min(hiddenDriversCount, 10)})`}
                </Button>
              </div>
            )}
            {!isLoading && showHiddenDrivers && hiddenDriversPreview.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="text-sm font-medium text-muted-foreground">
                  Hidden Drivers (showing {hiddenDriversPreview.length} of {hiddenDriversCount})
                </div>
                {viewMode === "table" ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="lg:text-sm">Name</TableHead>
                        <TableHead className="lg:text-sm">Vehicle Reg.</TableHead>
                        <TableHead className="lg:text-sm">Organization</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hiddenDriversPreview.map((d) => (
                        <TableRow
                          key={`hidden-${d.driverId}`}
                          className={cn(
                            "cursor-pointer",
                            (d.color ?? "").toLowerCase().trim() === "yellow" &&
                              "bg-yellow-50/70 hover:bg-yellow-100/70 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/35",
                            (d.color ?? "").toLowerCase().trim() === "green" &&
                              "bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/35",
                            (d.color ?? "").toLowerCase().trim() === "blue" &&
                              "bg-blue-50/70 hover:bg-blue-100/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/35",
                            !["yellow", "green", "blue"].includes((d.color ?? "").toLowerCase().trim()) &&
                              "hover:bg-muted/50"
                          )}
                          onClick={() => navigate(`/driver/${d.driverId}`)}
                        >
                          <TableCell className="font-medium lg:text-base">{d.name || "—"}</TableCell>
                          <TableCell className="font-mono text-sm lg:text-base">{d.vehicleRegistrationNo || "—"}</TableCell>
                          <TableCell className="text-sm lg:text-base">{d.organization || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {hiddenDriversPreview.map((d) => (
                      <Card
                        key={`hidden-card-${d.driverId}`}
                        className={cn(
                          "cursor-pointer hover:shadow-md transition-all",
                          (d.color ?? "").toLowerCase().trim() === "yellow" &&
                            "border-yellow-300 bg-yellow-50/70 hover:border-yellow-400 dark:border-yellow-700 dark:bg-yellow-950/20",
                          (d.color ?? "").toLowerCase().trim() === "green" &&
                            "border-emerald-300 bg-emerald-50/70 hover:border-emerald-400 dark:border-emerald-700 dark:bg-emerald-950/20",
                          (d.color ?? "").toLowerCase().trim() === "blue" &&
                            "border-blue-300 bg-blue-50/70 hover:border-blue-400 dark:border-blue-700 dark:bg-blue-950/20",
                          !["yellow", "green", "blue"].includes((d.color ?? "").toLowerCase().trim()) &&
                            "hover:border-primary/30"
                        )}
                        onClick={() => navigate(`/driver/${d.driverId}`)}
                      >
                        <CardContent className="p-4 lg:p-5 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base lg:text-lg shrink-0">
                              {d.name?.charAt(0) || "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate lg:text-base">{d.name || "Unknown"}</p>
                              <p className="text-xs lg:text-sm text-muted-foreground font-mono truncate">{d.driverId}</p>
                            </div>
                          </div>
                          <div className="space-y-1.5 text-sm lg:text-base">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Car className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate font-mono">{d.vehicleRegistrationNo || "—"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{d.organization || "—"}</span>
                            </div>
                            {d.phone && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{d.phone}</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}