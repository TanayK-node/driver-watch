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
import { Users, Search, Car, Building2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast"; // or "@/hooks/use-toast"
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DriverOverview() {
  const [search, setSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>("all");
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

  // --- SYNC LOGIC ---
  const handleSyncMongo = async () => {
    setIsSyncing(true);
    try {
      // Hit your Render backend
      const response = await fetch("https://driver-watch.onrender.com/api/sync-drivers", {
      // Use the Localhost URL:
      // const response = await fetch("http://127.0.0.1:8000/api/sync-drivers", {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to sync");
      const result = await response.json();

      // Tell React Query to instantly refresh your drivers table data
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
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard title="Total Drivers" value={isLoading ? "..." : drivers.length} icon={Users} />
          <KPICard title="Vehicle Types" value={isLoading ? "..." : vehicleClasses.length} icon={Car} accent="success" />
          <KPICard title="Organizations" value={isLoading ? "..." : organizations.length} icon={Building2} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base">All Drivers</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search drivers..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-[220px]"
                  />
                </div>
                <Select value={orgFilter} onValueChange={setOrgFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Organization" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org} value={org!}>{org}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* SYNC BUTTON */}
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
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    {/* <TableHead>Phone</TableHead> */}
                    <TableHead>Vehicle Reg.</TableHead>
                    {/* <TableHead>Vehicle</TableHead> */}
                    <TableHead>Organization</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow
                      key={d.driverId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/driver/${d.driverId}`)}
                    >
                      <TableCell className="font-medium">{d.name || "—"}</TableCell>
                      {/* <TableCell>{d.phone || "—"}</TableCell> */}
                      <TableCell className="font-mono text-sm">{d.vehicleRegistrationNo || "—"}</TableCell>
                      {/* <TableCell className="text-sm">{[d.vehicleMake, d.vehicleModel].filter(Boolean).join(" ") || "—"}</TableCell> */}
                      <TableCell className="text-sm">{d.organization || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No drivers found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}