import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, FileSearch, Gauge, MapPinned, Route, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroOverviewImage from "@/assets/hero-overview.svg";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

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
    <DashboardLayout title="Operational Intelligence">
      <div className="mx-auto max-w-6xl space-y-6">
        <section>
          <Card>
            <CardContent className="p-6 md:p-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                <div className="space-y-4">
                  <p className="text-sm font-medium text-primary">Driver Monitoring and Operational Intelligence</p>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    Driver Monitoring and Operational Intelligence Dashboard
                  </h1>
                  <p className="max-w-xl text-sm text-muted-foreground md:text-base">
                    The Driver Monitoring and Operational Intelligence Dashboard is designed as an automated analytical system to monitor and evaluate the operational behavior of registered auto drivers using structured trip and movement data. 

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
                    <img src={heroOverviewImage} alt="Dashboard overview preview" className="h-44 w-full object-cover md:h-52" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-muted">
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
                    </Card>

                    <Card className="border-muted">
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
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardDescription>Location</CardDescription>
              <CardTitle className="text-2xl flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-primary" />
                IIT Bombay
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3769.4204230664327!2d72.91253117444579!3d19.133065550180124!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c7f189efc039%3A0x68fdcea4c5c5894e!2sIndian%20Institute%20of%20Technology%20Bombay!5e0!3m2!1sen!2sin!4v1776616813665!5m2!1sen!2sin"
                  width="100%"
                  height="380"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="IIT Bombay location map"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardDescription>About</CardDescription>
              <CardTitle className="text-2xl">Why this dashboard exists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
              <p>
                The platform is designed as an automated analytical system to monitor and evaluate the operational behavior
                of registered auto drivers using structured trip and movement data.
              </p>
              <p>
                Its primary purpose is to replace the existing manual CSV-based monitoring workflow, which requires repetitive
                inspection, periodic analysis, and manual interpretation of driver performance indicators.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Features</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">Data Flow</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
