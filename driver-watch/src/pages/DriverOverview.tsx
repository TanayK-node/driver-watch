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
import { Users, Search, Car, Building2, RefreshCw, LayoutGrid, List, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export default function DriverOverview() {
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<string>("table");
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
      // const response = await fetch("https://driver-watch.onrender.com/api/sync-drivers", {
      const response = await fetch("http://127.0.0.1:8000/api/sync-drivers", {
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
    const matchSearch =
      (d.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      d.driverId.toLowerCase().includes(search.toLowerCase()) ||
      (d.vehicleRegistrationNo?.toLowerCase() || "").includes(search.toLowerCase());
    const matchOrg = orgFilter === "all" || d.organization === orgFilter;
    return matchSearch && matchOrg;
  });

  const vehicleClasses = [...new Set(drivers.map((d) => d.vehicleClass).filter(Boolean))];

  return (
    <DashboardLayout title="Driver Overview">
      <div className="space-y-6 lg:space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <KPICard title="Total Drivers" value={isLoading ? "..." : drivers.length} icon={Users} />
          <KPICard title="Vehicle Types" value={isLoading ? "..." : vehicleClasses.length} icon={Car} accent="success" />
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
                    className="pl-8 w-[220px] lg:w-[280px] lg:text-base"
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
                  {filtered.map((d) => (
                    <TableRow
                      key={d.driverId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/driver/${d.driverId}`)}
                    >
                      <TableCell className="font-medium lg:text-base">{d.name || "—"}</TableCell>
                      <TableCell className="font-mono text-sm lg:text-base">{d.vehicleRegistrationNo || "—"}</TableCell>
                      <TableCell className="text-sm lg:text-base">{d.organization || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
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
              filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No drivers found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map((d) => (
                    <Card
                      key={d.driverId}
                      className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}