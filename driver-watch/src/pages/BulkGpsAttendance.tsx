import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Upload, Loader2, MapPin, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/DashboardLayout";

interface GpsRecord {
  driver_name: string;
  first_in: string;
  last_out: string;
  total_hours: number;
  status: string;
}

export default function BulkGpsAttendance() {
  const [date, setDate] = useState<Date>();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GpsRecord[] | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.name.endsWith(".csv")) {
      setFile(selected);
    } else {
      toast({ title: "Invalid file", description: "Please upload a .csv file", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!date || !file) {
      toast({ title: "Missing fields", description: "Please select a date and upload a CSV file", variant: "destructive" });
      return;
    }

    setLoading(true);
    setData(null);

    try {
      const formData = new FormData();
      formData.append("date", format(date, "yyyy-MM-dd"));
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/api/attendance/verify-gps-bulk", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = "API request failed";
        try {
          const errorBody = await res.json();
          errorMessage = errorBody?.detail || errorBody?.message || errorMessage;
        } catch {
          // Keep fallback message when response is not JSON.
        }
        throw new Error(errorMessage);
      }

      const json = await res.json();
      setData(json.data ?? []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to process attendance", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("present") || s.includes("inside")) return "bg-success/15 text-success border-success/30";
    if (s.includes("absent") || s.includes("outside")) return "bg-destructive/15 text-destructive border-destructive/30";
    return "bg-warning/15 text-warning border-warning/30";
  };

  return (
    <DashboardLayout title="Bulk GPS Attendance">
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground text-sm">Upload a GPS CSV file to verify driver attendance by location.</p>
        </div>

        {/* Upload Area */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload GPS Data</CardTitle>
            <CardDescription>Select a date and upload the GPS .csv export file.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              {/* Date Picker */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-[200px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* File Input */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">GPS CSV File</label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">
                    <Upload className="h-4 w-4" />
                    {file ? file.name : "Choose file…"}
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              {/* Submit */}
              <Button onClick={handleSubmit} disabled={loading || !date || !file}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                Process Attendance
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {data && data.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-foreground">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">Total Drivers Present: {data.length}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Table */}
        {data !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Results</CardTitle>
            </CardHeader>
            <CardContent>
              {data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <MapPin className="h-10 w-10 mb-3 opacity-40" />
                  <p className="font-medium">No drivers found inside campus for this date</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Driver Name</TableHead>
                      <TableHead>Time In</TableHead>
                      <TableHead>Time Out</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>GPS Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row) => (
                      <TableRow key={`${row.driver_name}-${row.first_in}-${row.last_out}`}>
                        <TableCell className="font-medium">{row.driver_name}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {row.first_in}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {row.last_out}
                          </span>
                        </TableCell>
                        <TableCell>{row.total_hours.toFixed(2)} hrs</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs font-medium", statusColor(row.status))}>
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
