import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
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
import { Upload, FileText, Wand2, Save, AlertTriangle, CheckCircle2, Camera, Loader2 } from "lucide-react";
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

export default function AttendanceUpload() {
  const [step, setStep] = useState<Step>("upload");
  const [pasteData, setPasteData] = useState("");
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("driverId, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const parseCSV = (text: string): RawRow[] => {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length < 2) return [];
    const rows: RawRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[,\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
      if (cols.length >= 4) {
        rows.push({
          rawName: cols[0],
          date: normalizeDate(cols[1]),
          inTime: cols[2],
          outTime: cols[3],
        });
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
        inTime: r.inTime || "",
        outTime: r.outTime || "",
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
    setSaving(true);
    const records = valid.map((r) => ({
      driver_id: r.driverId!,
      raw_name: r.rawName,
      date: r.date,
      check_in: r.inTime || null,
      check_out: r.outTime || null,
      source: "manual",
    }));

    const { error } = await supabase.from("attendance").insert(records);
    setSaving(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("Duplicate entries found for some driver+date combinations");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success(`Saved ${valid.length} attendance records`);
    setStep("upload");
    setRawRows([]);
    setMappedRows([]);
    setPasteData("");
  };

  return (
    <DashboardLayout title="Upload Attendance">
      <div className="space-y-6 max-w-5xl">
        {/* Step indicators */}
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
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">
                      Parsed {rawRows.length} Records
                    </CardTitle>
                    <Button onClick={autoMatch} className="gap-2">
                      <Wand2 className="h-4 w-4" /> Auto-Match & Continue
                    </Button>
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
    </DashboardLayout>
  );
}
