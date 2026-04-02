import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "active" | "inactive" | "on-route" | "off-route" | "manual" | "gps" | "present" | "absent";

const styles: Record<StatusType, string> = {
  active: "bg-success/15 text-success border-success/30",
  inactive: "bg-muted text-muted-foreground border-border",
  "on-route": "bg-success/15 text-success border-success/30",
  "off-route": "bg-destructive/15 text-destructive border-destructive/30",
  manual: "bg-primary/15 text-primary border-primary/30",
  gps: "bg-warning/15 text-warning border-warning/30",
  present: "bg-success/15 text-success border-success/30",
  absent: "bg-destructive/15 text-destructive border-destructive/30",
};

const labels: Record<StatusType, string> = {
  active: "Active",
  inactive: "Inactive",
  "on-route": "On Route",
  "off-route": "Off Route",
  manual: "Gate Entry",
  gps: "GPS",
  present: "Present",
  absent: "Absent",
};

export function StatusBadge({ status }: { status: StatusType }) {
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", styles[status])}>
      {labels[status]}
    </Badge>
  );
}
