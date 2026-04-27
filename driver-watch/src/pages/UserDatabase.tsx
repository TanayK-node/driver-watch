import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { KPICard } from "@/components/KPICard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, ShieldCheck, Clock3, RefreshCw, LayoutGrid, List, Mail, Phone, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { getJson, postJson } from "@/lib/api";

type UserRow = {
  userId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  createdAt?: string | null;
  rating?: number | null;
  verificationStatus?: string | null;
  address?: string | null;
  deviceId?: string | null;
  totalTrips?: number | null;
  successfulTrips?: number | null;
  cancelledOrIncompleteTrips?: number | null;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function normalizeStatus(value?: string | null) {
  return (value ?? "pending").toLowerCase().trim();
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["verified", "approved", "active"].includes(status)) return "default";
  if (["rejected", "blocked"].includes(status)) return "destructive";
  if (["pending", "in-review", "in_review"].includes(status)) return "secondary";
  return "outline";
}

export default function UserDatabase() {
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<string>("table");
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await getJson<{ data: UserRow[] }>("/api/users");
      return response.data ?? [];
    },
  });

  const handleSyncUsers = async () => {
    setIsSyncing(true);
    try {
      await postJson("/api/sync-users", {});
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "Users Synced",
        description: "Latest users pulled from tutemprod and saved to TutemIq.",
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Could not sync users from the backend.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const genders = [...new Set(users.map((u) => (u.gender ?? "").trim()).filter(Boolean))];

  const filtered = useMemo(() => {
    const text = search.toLowerCase();

    return users
      .filter((u) => {
        const status = normalizeStatus(u.verificationStatus);
        const matchSearch =
          (u.name?.toLowerCase() || "").includes(text) ||
          (u.userId?.toLowerCase() || "").includes(text) ||
          (u.email?.toLowerCase() || "").includes(text) ||
          (u.phone?.toLowerCase() || "").includes(text);
        const matchGender = genderFilter === "all" || (u.gender ?? "").toLowerCase() === genderFilter.toLowerCase();
        const matchVerification = verificationFilter === "all" || status === verificationFilter;

        return matchSearch && matchGender && matchVerification;
      })
      .sort((a, b) => (b.totalTrips ?? 0) - (a.totalTrips ?? 0));
  }, [users, search, genderFilter, verificationFilter]);

  const verifiedCount = useMemo(
    () => users.filter((u) => ["verified", "approved", "active"].includes(normalizeStatus(u.verificationStatus))).length,
    [users]
  );
  const pendingCount = useMemo(
    () => users.filter((u) => ["pending", "in-review", "in_review"].includes(normalizeStatus(u.verificationStatus))).length,
    [users]
  );

  return (
    <DashboardLayout title="User Database">
      <div className="space-y-6 lg:space-y-8">
        <p className="text-xs text-muted-foreground">Users synced from tutemprod (user role only), stored in TutemIq.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <KPICard title="Total Users" value={isLoading ? "..." : users.length} icon={Users} />
          <KPICard title="Verified" value={isLoading ? "..." : verifiedCount} icon={ShieldCheck} accent="success" />
          <KPICard title="Pending" value={isLoading ? "..." : pendingCount} icon={Clock3} accent="warning" />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base lg:text-lg">All Users</CardTitle>
              <div className="flex flex-wrap gap-2 items-center">
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(v) => {
                    if (v) setViewMode(v);
                  }}
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
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-[220px] lg:w-[240px] lg:text-base"
                  />
                </div>

                <Select value={genderFilter} onValueChange={setGenderFilter}>
                  <SelectTrigger className="w-[150px] lg:w-[170px] lg:text-base">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genders</SelectItem>
                    {genders.map((gender) => (
                      <SelectItem key={gender} value={gender.toLowerCase()}>
                        {gender}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={verificationFilter} onValueChange={setVerificationFilter}>
                  <SelectTrigger className="w-[170px] lg:w-[200px] lg:text-base">
                    <SelectValue placeholder="Verification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" onClick={handleSyncUsers} disabled={isSyncing} className="gap-2">
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
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead className="text-right">Trips</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const status = normalizeStatus(u.verificationStatus);
                    return (
                      <TableRow key={u.userId} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/tutem/user-database/${u.userId}`)}>
                        <TableCell className="font-medium">{u.name || "Unknown"}</TableCell>
                        <TableCell>{u.email || "-"}</TableCell>
                        <TableCell>{u.phone || "-"}</TableCell>
                        <TableCell>{u.gender || "-"}</TableCell>
                        <TableCell>{formatDate(u.createdAt)}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(status)}>{u.verificationStatus || "pending"}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{u.totalTrips ?? 0}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No users found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No users found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((u) => {
                  const status = normalizeStatus(u.verificationStatus);
                  return (
                    <Card key={u.userId} className="cursor-pointer hover:shadow-md transition-all" onClick={() => navigate(`/tutem/user-database/${u.userId}`)}>
                      <CardContent className="p-4 lg:p-5 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base lg:text-lg shrink-0">
                            {u.name?.charAt(0) || "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate lg:text-base">{u.name || "Unknown"}</p>
                            <p className="text-xs lg:text-sm text-muted-foreground font-mono truncate">{u.userId}</p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-sm lg:text-base">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{u.email || "-"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{u.phone || "-"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Smartphone className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{u.deviceId || "-"}</span>
                          </div>
                          <div className="pt-1">
                            <Badge variant={statusBadgeVariant(status)}>{u.verificationStatus || "pending"}</Badge>
                          </div>
                          <div className="pt-0.5 text-xs text-muted-foreground">Trips: {u.totalTrips ?? 0}</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}