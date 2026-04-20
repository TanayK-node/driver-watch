import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, FileSearch, Gauge, Route } from "lucide-react";
import heroOverviewImage from "@/assets/hero.png";

const features = [
  {
    icon: Gauge,
    title: "Live Monitoring",
    description: "Monitor movement, attendance with minimal oversight.",
  },
  {
    icon: FileSearch,
    title: "Data-Driven Insights",
    description: "Convert trip logs and GPS data into clear, scannable insights",
  },
  {
    icon: BarChart3,
    title: "Performance Analytics",
    description: "Compare patterns over time and quickly spot fleet inconsistencies",
  },
  {
    icon: Route,
    title: "Route Intelligence",
    description: "Review routes, detect deviations, prioritize critical trips",
  },
];

const workflow = [
  { step: "01", title: "Ingest", text: "Upload gate attendance and GPS movement CSVs." },
  { step: "02", title: "Process", text: "System parses timestamps, validates records, and maps drivers." },
  { step: "03", title: "Analyze", text: "Dashboard compares attendance, trips, and route adherence." },
  { step: "04", title: "Act", text: "Operations team reviews mismatches and exceptions quickly." },
];

export default function LandingPage() {
  return (
    <DashboardLayout title="TUTEM IQ">
      <div className="mx-auto w-full max-w-[1800px] space-y-6 xl:space-y-8 2xl:space-y-10">
        <section>
          <Card className="border-primary/20 bg-gradient-to-br from-white via-blue-50/70 to-blue-100/70 shadow-sm">
            <CardContent className="p-6 md:p-8 xl:p-10 2xl:p-12">
              <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] xl:gap-8 2xl:grid-cols-[1.35fr_1fr] 2xl:gap-10">
                <div className="space-y-4">
                  <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
                    Smart Mobility Intelligence
                  </p>
                  <h1 className="text-4xl font-extrabold tracking-tight text-transparent md:text-5xl xl:text-6xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 bg-clip-text">
                    TUTEM IQ
                  </h1>
                  <p className="max-w-3xl text-base leading-7 text-slate-700 md:text-lg xl:text-xl xl:leading-8">
                    TUTEM IQ Campus is a smart mobility intelligence dashboard designed to monitor and analyze informal paratransit systems operating within a controlled campus environment. The platform integrates real-time GPS data from registered auto-rickshaw drivers to provide actionable insights for operational monitoring, security oversight, and data-driven decision-making. 
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-primary/20 bg-white/70 shadow-sm">
                    <img
                      src={heroOverviewImage}
                      alt="Dashboard overview preview"
                      className="h-56 w-full object-cover md:h-64 xl:h-72 2xl:h-80"
                    />
                  </div>

                  {/* <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-blue-200 bg-white/90 p-3">
                      <p className="text-xs font-semibold tracking-wide text-blue-700">Live Tracking</p>
                      <p className="mt-1 text-sm text-slate-700">GPS + attendance visibility</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-white/90 p-3">
                      <p className="text-xs font-semibold tracking-wide text-blue-700">Verification</p>
                      <p className="mt-1 text-sm text-slate-700">Automated mismatch checks</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-white/90 p-3">
                      <p className="text-xs font-semibold tracking-wide text-blue-700">Operations</p>
                      <p className="mt-1 text-sm text-slate-700">Faster exception handling</p>
                    </div>
                  </div> */}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* s */}


        <section className="space-y-3 xl:space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-blue-800 xl:text-3xl">Features</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-blue-100 bg-white shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4 text-blue-600" />
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-600">{feature.description}</CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-3 xl:space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight text-blue-800 xl:text-3xl">Data Flow</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:gap-5">
            {workflow.map((item) => (
              <Card key={item.step} className="border-blue-100 bg-white shadow-sm">
                <CardContent className="space-y-2 p-5">
                  <p className="text-xs font-semibold tracking-wide text-blue-700">{item.step}</p>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600">{item.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
