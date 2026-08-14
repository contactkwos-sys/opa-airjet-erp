import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#0b6e75", "#1a6f9a", "#c47a12", "#0d8a6a", "#c0392b", "#5a6f86"];

type Point = { name: string; value: number; [key: string]: string | number };

export function TrendChart({
  title,
  data,
  dataKey = "value",
  color = "#0b6e75",
}: {
  title: string;
  data: Point[];
  dataKey?: string;
  color?: string;
}) {
  return (
    <section className="panel chart-card">
      <div className="section-head">
        <h3>{title}</h3>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,32,51,0.08)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function BarChartCard({
  title,
  data,
  dataKey = "value",
  color = "#1298a0",
}: {
  title: string;
  data: Point[];
  dataKey?: string;
  color?: string;
}) {
  return (
    <section className="panel chart-card">
      <div className="section-head">
        <h3>{title}</h3>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(18,32,51,0.08)" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function PieChartCard({
  title,
  data,
}: {
  title: string;
  data: Point[];
}) {
  return (
    <section className="panel chart-card">
      <div className="section-head">
        <h3>{title}</h3>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
