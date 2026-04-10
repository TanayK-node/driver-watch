import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Upload, FileText, Wand2, Save, AlertTriangle, CheckCircle2, Camera, Loader2, MapPin, ClipboardList } from "lucide-react";
import BulkGpsAttendance from "./BulkGpsAttendance";
import { toast } from "sonner";

interface RawRow {
  rawName: string;
  date: string;
  inTime: string;
  outTime: string;
}

interface MappedRow extends RawRow {
  driverId: string | null;
  driverName: string | null;
  matchStatus: "auto" | "manual" | "unmatched";
}

type Step = "upload" | "map" | "review";

/** Convert various date formats (DD-MM-YYYY, DD/MM/YYYY, etc.) to YYYY-MM-DD */
function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // DD-MM-YYYY or DD/MM/YYYY
  const match = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  // MM/DD/YYYY — fallback (ambiguous, but try)
  return trimmed;
}

/** Convert common time variants (8.26, 8:26 AM, 0826) to HH:MM for Postgres time columns. */
function normalizeTime(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const compact = trimmed
    .replace(/\.(?=\d)/g, ":")
    .replace(/\s+/g, " ")
    .replace(/\b([ap])\.m\.?\b/gi, "$1m")
    .toUpperCase();

  const timeMatch = compact.match(/^([0-2]?\d)(?::?(\d{2}))?(?::?(\d{2}))?\s*([AP]M)?$/);
  if (!timeMatch) return trimmed;

  let hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2] ?? "0", 10);
  const second = Number.parseInt(timeMatch[3] ?? "0", 10);
  const period = timeMatch[4];

  if (Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) return trimmed;
  if (minute > 59 || second > 59) return trimmed;

  if (period === "AM") {
    if (hour === 12) hour = 0;
  } else if (period === "PM" && hour < 12) {
    hour += 12;
  }

  if (hour > 23) return trimmed;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default function AttendanceUpload() {
  const [step, setStep] = useState<Step>("upload");
  const [pasteData, setPasteData] = useState("");
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("driverId, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const parseCSV = (text: string): RawRow[] => {
  // Split by newline and remove empty lines (handles \r\n from Windows CSVs)
  const lines = text.trim().split("\n").filter(Boolean);
  
  // We need at least the Date row (0), In/Out header row (1), and 1 driver data row (2)
  if (lines.length < 3) return []; 

  const rows: RawRow[] = [];
  
  // Row 1 (index 0) contains the dates.
  const dateHeaders = lines[0].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
  
  const dateColumns: { date: string; colIndex: number }[] = [];
  
  // Find all columns that have a date. 
  // In your file, dates are at index 1, 3, 5, etc.
  for (let i = 1; i < dateHeaders.length; i++) {
    if (dateHeaders[i] && dateHeaders[i] !== "") {
      dateColumns.push({ 
        // The existing normalizeDate function safely converts DD-MM-YYYY to YYYY-MM-DD
        date: normalizeDate(dateHeaders[i]), 
        colIndex: i 
      });
    }
  }

  // Row 3 (index 2) onwards are the driver rows containing the times.
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const rawName = cols[0]; // Column 0 is "NAME OF AUTO DRIVER"
    
    if (!rawName) continue;

    // For this specific driver, loop through all the detected date columns
    for (const { date, colIndex } of dateColumns) {
      const inTime = normalizeTime(cols[colIndex] || "");
      const outTime = normalizeTime(cols[colIndex + 1] || ""); // The immediate next column is the Out Time

      // Only push a record if the driver actually has an In Time or Out Time logged for that day
      // This automatically ignores days where the cells are completely empty (e.g., ",,,")
      if (inTime || outTime) {
        rows.push({
          rawName,
          date,
          inTime: inTime || "",
          outTime: outTime || "",
        });
      }
    }
  }

  return rows;
};

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error("No valid rows found in CSV");
        return;
      }
      setRawRows(rows);
      toast.success(`Parsed ${rows.length} rows`);
    };
    reader.readAsText(file);
  };

  const handlePaste = () => {
    const rows = parseCSV(pasteData);
    if (rows.length === 0) {
      toast.error("No valid rows found. Ensure header: Driver Name, Date, In Time, Out Time");
      return;
    }
    setRawRows(rows);
    toast.success(`Parsed ${rows.length} rows`);
  };

  /** AI-powered photo extraction */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, etc.)");
      return;
    }

    setAiLoading(true);
    try {
      // Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("extract-attendance", {
        body: {
          imageBase64: base64,
          drivers: drivers.map((d) => ({ driverId: d.driverId, name: d.name })),
        },
      });

      if (error) throw error;

      const rows: RawRow[] = (data?.rows || []).map((r: any) => ({
        rawName: r.rawName || "",
        date: normalizeDate(r.date || ""),
        inTime: normalizeTime(r.inTime || ""),
        outTime: normalizeTime(r.outTime || ""),
      }));

      if (rows.length === 0) {
        toast.error("AI could not extract any attendance records from the image");
        return;
      }

      setRawRows(rows);
      toast.success(`AI extracted ${rows.length} records from photo`);
    } catch (err: any) {
      console.error("AI extraction error:", err);
      toast.error(err.message || "Failed to extract data from photo");
    } finally {
      setAiLoading(false);
    }
  };

  const autoMatch = useCallback(() => {
    const mapped: MappedRow[] = rawRows.map((row) => {
      const normalRaw = row.rawName.toLowerCase().trim();
      const exact = drivers.find((d) => d.name?.toLowerCase().trim() === normalRaw);
      if (exact) {
        return { ...row, driverId: exact.driverId, driverName: exact.name, matchStatus: "auto" as const };
      }
      const partial = drivers.find(
        (d) =>
          d.name?.toLowerCase().includes(normalRaw) ||
          normalRaw.includes(d.name?.toLowerCase() ?? "")
      );
      if (partial) {
        return { ...row, driverId: partial.driverId, driverName: partial.name, matchStatus: "auto" as const };
      }
      return { ...row, driverId: null, driverName: null, matchStatus: "unmatched" as const };
    });
    setMappedRows(mapped);
    setStep("map");
  }, [rawRows, drivers]);

  const updateMapping = (index: number, driverId: string) => {
    const driver = drivers.find((d) => d.driverId === driverId);
    setMappedRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, driverId, driverName: driver?.name ?? null, matchStatus: "manual" as const }
          : r
      )
    );
  };

  const unmappedCount = mappedRows.filter((r) => !r.driverId).length;
  const missingCheckout = mappedRows.filter((r) => !r.outTime).length;

  const handleSave = async () => {
    const valid = mappedRows.filter((r) => r.driverId);
    if (valid.length === 0) {
      toast.error("No mapped records to save");
      return;
    }

    // Keep only one row per driver+date in the current batch to avoid self-conflicting upserts.
    const dedupedByDriverDate = new Map<string, MappedRow>();
    for (const row of valid) {
      const key = `${row.driverId}|${row.date}`;
      dedupedByDriverDate.set(key, row);
    }
    const dedupedRows = Array.from(dedupedByDriverDate.values());
    const skippedDuplicates = valid.length - dedupedRows.length;

    setSaving(true);
    const records = dedupedRows.map((r) => ({
      driver_id: r.driverId!,
      raw_name: r.rawName,
      date: r.date,
      check_in: normalizeTime(r.inTime) || null,
      check_out: normalizeTime(r.outTime) || null,
      source: "manual",
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(records, { onConflict: "driver_id,date" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    if (skippedDuplicates > 0) {
      toast.success(
        `Saved ${dedupedRows.length} records. ${skippedDuplicates} duplicate row(s) in this upload were merged by driver+date.`
      );
    } else {
      toast.success(`Saved ${dedupedRows.length} attendance records`);
    }

    setStep("upload");
    setRawRows([]);
    setMappedRows([]);
    setPasteData("");
  };

  return (
    <div className="space-y-6 max-w-5xl">

        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="manual" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Manual Upload
            </TabsTrigger>
            <TabsTrigger value="gps" className="gap-2">
              <MapPin className="h-4 w-4" />
              GPS Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-6">
            <div className="space-y-6">
        <div className="flex gap-2">
          {(["upload", "map", "review"] as Step[]).map((s, i) => (
            <Badge
              key={s}
              variant={step === s ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => {
                if (s === "upload") setStep(s);
                if (s === "map" && rawRows.length > 0) autoMatch();
                if (s === "review" && mappedRows.length > 0) setStep(s);
              }}
            >
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </Badge>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* AI Photo Upload */}
            <Card className="md:col-span-2 border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Camera className="h-4 w-4" /> 📸 Upload Gate Register Photo (AI-powered)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Upload a photo of your handwritten gate register. AI will extract driver names, dates, and times automatically.
                </p>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="cursor-pointer max-w-sm"
                    disabled={aiLoading}
                  />
                  {aiLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI is reading the register...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Upload CSV
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  CSV with columns: Driver Name, Date, In Time, Out Time
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Paste Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder={"Driver Name,Date,In Time,Out Time\nRajesh Kumar,2026-04-01,08:15,17:30"}
                  rows={5}
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={handlePaste}>
                  Parse Data
                </Button>
              </CardContent>
            </Card>

            {rawRows.length > 0 && (
              <div className="md:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                    <CardTitle className="text-base">
                      Parsed {rawRows.length} Records
                    </CardTitle>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Date for all:</label>
                        <Input
                          type="date"
                          value={overrideDate || rawRows[0]?.date || ""}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setOverrideDate(newDate);
                            setRawRows((prev) =>
                              prev.map((row) => ({ ...row, date: newDate }))
                            );
                          }}
                          className="h-8 w-40"
                        />
                      </div>
                      <Button onClick={autoMatch} className="gap-2">
                        <Wand2 className="h-4 w-4" /> Auto-Match & Continue
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver Name</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>In Time</TableHead>
                          <TableHead>Out Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                     {rawRows.slice(0, 10).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.rawName}</TableCell>
                            <TableCell>{r.date}</TableCell>
                            <TableCell>{r.inTime}</TableCell>
                            <TableCell>{r.outTime || <span className="text-muted-foreground">—</span>}</TableCell>
                          </TableRow>
                        ))}
                        {rawRows.length > 10 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              ... and {rawRows.length - 10} more rows
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Mapping */}
        {step === "map" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Name Mapping</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button size="sm" onClick={() => setStep("review")} disabled={unmappedCount === mappedRows.length}>
                  Continue to Review
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {unmappedCount > 0 && (
                <div className="flex items-center gap-2 mb-4 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  {unmappedCount} record(s) not matched — please map manually
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Raw Name</TableHead>
                    <TableHead>Matched Driver</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.rawName}</TableCell>
                      <TableCell>
                        <Select
                          value={r.driverId ?? ""}
                          onValueChange={(v) => updateMapping(i, v)}
                        >
                          <SelectTrigger className="w-[220px]">
                            <SelectValue placeholder="Select driver..." />
                          </SelectTrigger>
                          <SelectContent>
                            {drivers.map((d) => (
                              <SelectItem key={d.driverId} value={d.driverId}>
                                {d.name ?? d.driverId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {r.matchStatus === "auto" && (
                          <Badge className="bg-success/15 text-success border-success/30" variant="outline">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Auto-matched
                          </Badge>
                        )}
                        {r.matchStatus === "manual" && (
                          <Badge className="bg-primary/15 text-primary border-primary/30" variant="outline">
                            Manually mapped
                          </Badge>
                        )}
                        {r.matchStatus === "unmatched" && (
                          <Badge className="bg-warning/15 text-warning border-warning/30" variant="outline">
                            <AlertTriangle className="h-3 w-3 mr-1" /> Needs review
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Review & Save */}
        {step === "review" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Review & Confirm</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep("map")}>
                  Back
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : `Save ${mappedRows.filter((r) => r.driverId).length} Records`}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {unmappedCount > 0 && (
                <div className="flex items-center gap-2 mb-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {unmappedCount} unmapped record(s) will be skipped
                </div>
              )}
              {missingCheckout > 0 && (
                <div className="flex items-center gap-2 mb-3 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  {missingCheckout} record(s) missing check-out time
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Raw Name</TableHead>
                    <TableHead>Mapped Driver</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRows.map((r, i) => (
                    <TableRow key={i} className={!r.driverId ? "opacity-40" : ""}>
                      <TableCell>{r.rawName}</TableCell>
                      <TableCell className="font-medium">
                        {r.driverName ?? <span className="text-destructive">Unmapped</span>}
                      </TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.inTime}</TableCell>
                      <TableCell>{r.outTime || <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
            </div>
          </TabsContent>

          <TabsContent value="gps" className="mt-6">
            <BulkGpsAttendance />
          </TabsContent>
        </Tabs>
    </div>
  );
}
