import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { format, subDays, startOfDay, startOfWeek, startOfMonth } from "date-fns";

interface Reservation {
  id: string;
  reservation_date: string;
  reservation_time: string;
  location: string;
  status: string;
}

const AdminReports = () => {
  const { t } = useTranslation();
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("reservations")
        .select("id, reservation_date, reservation_time, location, status");
      setReservations((data as Reservation[]) || []);
    };
    fetch();
  }, []);

  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const todayCount = reservations.filter((r) => r.reservation_date === today).length;
  const weekCount = reservations.filter((r) => r.reservation_date >= weekStart).length;
  const monthCount = reservations.filter((r) => r.reservation_date >= monthStart).length;

  const byLocation = reservations.reduce<Record<string, number>>((acc, r) => {
    acc[r.location] = (acc[r.location] || 0) + 1;
    return acc;
  }, {});

  const byStatus = reservations.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  // Popular time slots
  const byTime = reservations.reduce<Record<string, number>>((acc, r) => {
    acc[r.reservation_time] = (acc[r.reservation_time] || 0) + 1;
    return acc;
  }, {});
  const popularTimes = Object.entries(byTime)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Last 30 days chart data
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const date = format(subDays(startOfDay(new Date()), 29 - i), "yyyy-MM-dd");
    const count = reservations.filter((r) => r.reservation_date === date).length;
    return { date: format(subDays(new Date(), 29 - i), "dd/MM"), count };
  });

  const statCards = [
    { label: t("admin.reports.today"), value: todayCount },
    { label: t("admin.reports.thisWeek"), value: weekCount },
    { label: t("admin.reports.thisMonth"), value: monthCount },
    { label: t("admin.reports.total"), value: reservations.length },
  ];

  const locationNames: Record<string, string> = {
    tarragona: "Tarragona",
    arrabassada: "Arrabassada",
  };

  const statusLabels: Record<string, string> = {
    pending: t("admin.statusPending"),
    confirmed: t("admin.statusConfirmed"),
    cancelled: t("admin.statusCancelled"),
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-card rounded-lg p-5 border border-border shadow-sm">
            <p className="text-muted-foreground font-body text-sm">{s.label}</p>
            <p className="font-display text-3xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* By location */}
        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <h3 className="font-display text-lg font-bold text-foreground mb-4">
            {t("admin.reports.byLocation")}
          </h3>
          <div className="space-y-3">
            {Object.entries(byLocation).map(([loc, count]) => (
              <div key={loc} className="flex items-center justify-between">
                <span className="font-body text-foreground">{locationNames[loc] || loc}</span>
                <span className="font-display text-xl font-bold text-primary">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By status */}
        <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
          <h3 className="font-display text-lg font-bold text-foreground mb-4">
            {t("admin.reports.byStatus")}
          </h3>
          <div className="space-y-3">
            {Object.entries(byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="font-body text-foreground">{statusLabels[status] || status}</span>
                <span className="font-display text-xl font-bold text-primary">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Popular times */}
        <div className="bg-card rounded-lg p-5 border border-border shadow-sm md:col-span-2">
          <h3 className="font-display text-lg font-bold text-foreground mb-4">
            {t("admin.reports.popularTimes")}
          </h3>
          <div className="flex flex-wrap gap-3">
            {popularTimes.map(([time, count]) => (
              <div key={time} className="bg-primary/10 rounded-lg px-4 py-2 text-center">
                <p className="font-display text-lg font-bold text-primary">{time}</p>
                <p className="font-body text-xs text-muted-foreground">
                  {count} {t("admin.reports.reservations")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card rounded-lg p-5 border border-border shadow-sm">
        <h3 className="font-display text-lg font-bold text-foreground mb-4">
          {t("admin.reports.last30Days")}
        </h3>
        <div className="h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last30}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" className="font-body text-xs" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} className="font-body text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontFamily: "var(--font-body)",
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
