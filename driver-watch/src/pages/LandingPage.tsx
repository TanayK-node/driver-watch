import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, FileSearch, Gauge, MapPinned, Route, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroOverviewImage from "@/assets/hero.png";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const features = [
  {
    icon: Gauge,
    title: "Automated Monitoring",
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

const attendanceTrend = [
  { day: "Mon", value: 82 },
  { day: "Tue", value: 85 },
  { day: "Wed", value: 81 },
  { day: "Thu", value: 88 },
  { day: "Fri", value: 91 },
  { day: "Sat", value: 86 },
];

const verificationSplit = [
  { name: "Verified", value: 78, color: "#22c55e" },
  { name: "Mismatch", value: 15, color: "#ef4444" },
  { name: "Pending", value: 7, color: "#f59e0b" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout title="TUTEM IQ">
      <div className="mx-auto w-full max-w-[1800px] space-y-6 xl:space-y-8 2xl:space-y-10">
        <section>
          <Card>
            <CardContent className="p-6 md:p-8 xl:p-10 2xl:p-12">
              <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] xl:gap-8 2xl:grid-cols-[1.35fr_1fr] 2xl:gap-10">
                <div className="space-y-4">
                  {/* <p className="text-sm font-medium text-primary">Driver Monitoring and Operational Intelligence</p> */}
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    
                  </h1>
                  <p className="max-w-3xl text-base leading-7 md:text-lg xl:text-xl xl:leading-8">
                    TUTEM IQ Campus is a smart mobility intelligence dashboard designed to monitor and analyze informal paratransit systems operating within a controlled campus environment. The platform integrates real-time GPS data from registered auto-rickshaw drivers to provide actionable insights for operational monitoring, security oversight, and data-driven decision-making. 

                  </p>
                  {/* <div className="flex flex-wrap gap-3">
                    <Button onClick={() => navigate("/drivers")} className="gap-2">
                      Explore Drivers
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/attendance/upload")} className="gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Attendance
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/routes")} className="gap-2">
                      <MapPinned className="h-4 w-4" />
                      View Routes
                    </Button>
                  </div> */}
                </div>

                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border bg-muted/20">
                    <img
                      src={heroOverviewImage}
                      alt="Dashboard overview preview"
                      className="h-56 w-full object-cover md:h-64 xl:h-72 2xl:h-80"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* <Card className="border-muted">
                      <CardHeader className="pb-1">
                        <CardTitle className="text-sm">Attendance Trend</CardTitle>
                      </CardHeader>
                      <CardContent className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={attendanceTrend}>
                            <Tooltip />
                            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card> */}

                    {/* <Card className="border-muted">
                      <CardHeader className="pb-1">
                        <CardTitle className="text-sm">Verification Split</CardTitle>
                      </CardHeader>
                      <CardContent className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip />
                            <Pie data={verificationSplit} dataKey="value" nameKey="name" innerRadius={26} outerRadius={42}>
                              {verificationSplit.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card> */}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* s */}


        <section className="space-y-3 xl:space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight xl:text-3xl">Features</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4 text-primary" />
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{feature.description}</CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-3 xl:space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight xl:text-3xl">Data Flow</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:gap-5">
            {workflow.map((item) => (
              <Card key={item.step}>
                <CardContent className="space-y-2 p-5">
                  <p className="text-xs font-semibold tracking-wide text-primary">{item.step}</p>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
