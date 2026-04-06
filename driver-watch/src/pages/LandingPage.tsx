import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Clock3, FileSearch, Gauge, MapPinned, Route, ShieldCheck, Sparkles, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

const highlights = [
  { value: "1,200+", label: "drivers monitored" },
  { value: "98%", label: "attendance sync accuracy" },
  { value: "24/7", label: "route visibility" },
];

const features = [
  {
    icon: Gauge,
    title: "Automated Monitoring",
    description: "Track movement and attendance behavior with less manual oversight and faster review cycles.",
  },
  {
    icon: FileSearch,
    title: "Data-Driven Insights",
    description: "Turn trip logs and GPS records into decision-ready signals that are easy to scan at a glance.",
  },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    description: "Compare operational patterns over time and quickly spot inconsistencies across the fleet.",
  },
  {
    icon: Route,
    title: "Route Intelligence",
    description: "Review route adherence, detect deviations, and prioritize the trips that need attention first.",
  },
];

const workflow = [
  { step: "01", title: "Upload data", text: "Drop in attendance or GPS files to start the automated review pipeline." },
  { step: "02", title: "Verify signals", text: "Cross-check driver movement, time windows, and route behavior in one place." },
  { step: "03", title: "Act quickly", text: "Use the dashboard to prioritize follow-up, exceptions, and operational reporting." },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout title="Operational Intelligence">
      <div className="relative mx-auto max-w-7xl space-y-4 overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="landing-orb landing-orb-one animate-aurora" />
          <div className="landing-orb landing-orb-two animate-aurora-delayed" />
          <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl animate-pulse-soft" />
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="relative overflow-hidden border-border/60 bg-card/90 shadow-lg shadow-slate-950/5 backdrop-blur-sm animate-fade-up">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-cyan-500/10" />
            <CardContent className="relative space-y-6 p-6 md:p-8 lg:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs font-medium text-primary animate-fade-up">
                <Sparkles className="h-3.5 w-3.5" />
                Fleet command center
              </div>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl animate-fade-up" style={{ animationDelay: "80ms" }}>
                  Driver monitoring Dashboard
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:text-base animate-fade-up" style={{ animationDelay: "140ms" }}>
                  The Driver Monitoring and Operational Intelligence Dashboard helps teams evaluate attendance, GPS traces,
                  route adherence, and performance patterns without the friction of repetitive manual inspection.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: "200ms" }}>
                <Button onClick={() => navigate("/drivers")} className="group gap-2 bg-slate-950 text-white hover:bg-slate-800">
                  View Drivers
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <Button variant="outline" onClick={() => navigate("/attendance/upload")} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Attendance
                </Button>
                <Button variant="ghost" onClick={() => navigate("/routes")} className="gap-2 text-muted-foreground">
                  <MapPinned className="h-4 w-4" />
                  Route Intelligence
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 animate-fade-up" style={{ animationDelay: "280ms" }}>
                {highlights.map((item) => (
                  <div key={item.label} className="rounded-2xl border bg-background/70 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                    <div className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-slate-900/80 bg-slate-950 text-white shadow-2xl shadow-slate-950/30 animate-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.28),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.22),transparent_35%)]" />
            <CardHeader className="relative space-y-3 pb-4">
              <CardDescription className="text-slate-300">Operational snapshot</CardDescription>
              <CardTitle className="text-2xl text-white">Live indicators at a glance</CardTitle>
            </CardHeader>
            <CardContent className="relative space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Verification status
                  </div>
                  <div className="mt-3 text-2xl font-semibold">98.4% synced</div>
                  <div className="mt-1 text-sm text-slate-300">Attendance uploads are being processed without manual reconciliation.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Clock3 className="h-4 w-4 text-cyan-300" />
                    Review latency
                  </div>
                  <div className="mt-3 text-2xl font-semibold">Under 3 min</div>
                  <div className="mt-1 text-sm text-slate-300">A faster path from upload to operational insight.</div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Priority signals</span>
                  <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-medium text-emerald-300">Live</span>
                </div>
                <div className="space-y-3">
                  {[
                    ["Attendance gap", "2 drivers need a follow-up", "w-[78%]"],
                    ["Route deviation", "1 trip exceeded the expected path", "w-[44%]"],
                    ["On-time completion", "Fleet trend remains stable this cycle", "w-[90%]"],
                  ].map(([label, detail, width]) => (
                    <div key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-white">{label}</span>
                        <span className="text-slate-300">{detail}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10">
                        <div className={`h-2 rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-primary ${width} animate-shimmer`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Features</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Core capabilities built for day-to-day fleet operations.</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <Card
                key={feature.title}
                className="group border-border/60 bg-card/85 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 animate-fade-up"
                style={{ animationDelay: `${140 + index * 90}ms` }}
              >
                <CardHeader className="space-y-4 pb-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">{feature.description}</CardContent>
              </Card>
            );
          })}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/60 bg-card/85 shadow-sm backdrop-blur-sm animate-fade-up" style={{ animationDelay: "180ms" }}>
            <CardHeader>
              <CardDescription>Why it matters</CardDescription>
              <CardTitle className="text-2xl md:text-3xl">Replace repetitive inspection with a faster review loop.</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              <p>
                The workflow is built to reduce manual CSV review and make attendance, route, and performance checks easier
                to understand in seconds rather than minutes.
              </p>
              <p>
                You get a cleaner operating surface for daily monitoring, exception handling, and reporting without needing
                to jump between disconnected tools.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/85 shadow-sm backdrop-blur-sm animate-fade-up" style={{ animationDelay: "220ms" }}>
            <CardHeader>
              <CardDescription>How it flows</CardDescription>
              <CardTitle className="text-2xl md:text-3xl">A simple path from upload to decision.</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {workflow.map((item, index) => (
                <div key={item.step} className="rounded-2xl border bg-background/70 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <div className="text-xs font-semibold tracking-[0.2em] text-primary">{item.step}</div>
                  <div className="mt-3 text-sm font-semibold text-foreground">{item.title}</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</div>
                  <div className="mt-4 h-1 rounded-full bg-muted">
                    <div className="h-1 rounded-full bg-gradient-to-r from-primary to-cyan-500" style={{ width: `${70 + index * 10}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
