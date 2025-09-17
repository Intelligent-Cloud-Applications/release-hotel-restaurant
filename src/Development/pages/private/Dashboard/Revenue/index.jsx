import React, { useState, useContext, useEffect } from "react";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import { useRevenueData } from "./useRevenueData";
import {
  LineChart,
  BarChart,
  PieChart,
  Line,
  Bar,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Calendar,
  IndianRupee,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import Error from "../../../Error";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const Loader = () => (
  <div className="flex flex-col items-center justify-center p-12">
  <div className="relative">
    <div className="w-16 h-16 border-4 border-gray-300 border-t-primaryColor rounded-full animate-spin"></div>
    <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-primaryColor">💰</div>
  </div>
  <p className="mt-4 text-primaryColor font-medium">Fetching revenue data...</p>
</div>
);

const MetricCard = ({ title, value, icon: Icon, trend }) => (
  <div className="bg-white rounded-lg p-6 shadow-lg">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold mt-2">{value}</p>
        {trend && (
          <p
            className={`text-sm mt-2 ${
              trend >= 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </p>
        )}
      </div>
      <div className="bg-blue-100 p-4 rounded-full">
        <Icon className="w-6 h-6 text-blue-600" />
      </div>
    </div>
  </div>
);

const CustomDropdown = ({ options, value, onChange, label }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
  </div>
);

const RevenueDashboard = () => {
  const [data, setData] = useState([]);
  const { institution } = useContext(Context).institutionData;
    const { institutionData } = useContext(Context);
  const { userData } = useContext(Context);
  const [timeFrame, setTimeFrame] = useState("today");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [loading, setLoading] = useState(true);

  if (userData.userType !== "admin") {
    return <Error />;
  }

  useEffect(() => {
      const fetchData = async () => {
    setLoading(true);
    try {
      const type = institutionData?.bar_integration === "Yes" ? "bar" : "cafe";

      const result = await API.get(
        "main",
        `/admin/list-orders/${institution}?type=${type}`,
        {}
      );
      const filteredData = result.filter(
        (order) => order.paymentStatus === true
      );
      setData(filteredData);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };
    fetchData();
  }, [institution]);

  const processedData = useRevenueData(
    data,
    timeFrame,
    selectedDate ? new Date(selectedDate) : null,
    selectedMonth ? new Date(selectedMonth + "-01") : null,
    institution 
  );

  if (loading) return <Loader />;
  if (!processedData) return <Loader />;

  const { summary, hourlyData, uniqueDates, uniqueMonths, filteredOrders, monthlySummaries } = processedData;

  // Calculate payment methods considering both regular orders and monthly summaries
  const paymentMethodsWithAmount = filteredOrders.reduce((acc, order) => {
    if (order.paymentStatus === true) {
      if (order.downloadLink) {
        // Monthly summary record - use paymentMethods object
        if (order.paymentMethods && typeof order.paymentMethods === 'object') {
          Object.entries(order.paymentMethods).forEach(([method, amount]) => {
            const methodName = method || 'Unknown';
            if (!acc[methodName]) {
              acc[methodName] = { count: 0, amount: 0, isSummary: false };
            }
            acc[methodName].amount += Number(amount) || 0;
            // For monthly summaries, don't estimate order counts - leave as 0
            acc[methodName].isSummary = true;
          });
        } else {
          // Monthly summary without paymentMethods - treat as Cash
          const methodName = 'Cash';
          if (!acc[methodName]) {
            acc[methodName] = { count: 0, amount: 0, isSummary: false };
          }
          acc[methodName].amount += order.totalAmount || 0;
          acc[methodName].isSummary = true;
        }
      } else {
        // Regular order - handle both single payment method and array of payment methods
        if (Array.isArray(order.paymentMethods)) {
          // Handle array of payment methods
          order.paymentMethods.forEach(methodEntry => {
            if (methodEntry?.method && typeof methodEntry.amount === "number") {
              const methodName = methodEntry.method || 'Cash';
              if (!acc[methodName]) {
                acc[methodName] = { count: 0, amount: 0, isSummary: false };
              }
              acc[methodName].count += 1;
              acc[methodName].amount += methodEntry.amount;
            }
          });
        } else {
          // Handle single payment method
          let methodName = order.paymentMethod;
          
          // Handle various cases where payment method might be missing or invalid
          if (!methodName || methodName === 'null' || methodName === 'undefined' || methodName === 'Unknown') {
            // Try to infer payment method from other fields
            if (order.paymentMethods && typeof order.paymentMethods === 'object') {
              // If there's a paymentMethods object, use the first method
              const firstMethod = Object.keys(order.paymentMethods)[0];
              methodName = firstMethod || 'Cash';
            } else if (order.paymentMethodType) {
              methodName = order.paymentMethodType;
            } else if (order.paymentType) {
              methodName = order.paymentType;
            } else {
              methodName = 'Cash'; // Default to Cash instead of Unknown
            }
          }
          
          if (!acc[methodName]) {
            acc[methodName] = { count: 0, amount: 0, isSummary: false };
          }
          acc[methodName].count += 1;
          acc[methodName].amount += order.totalAmount || 0;
        }
      }
    }
    return acc;
  }, {});

  const paymentMethodsData = Object.entries(paymentMethodsWithAmount).map(
    ([name, { count, amount, isSummary }]) => ({
      name,
      value: isSummary ? null : count, // null for summary payment methods
      amount,
      isSummary
    })
  );

  // Fallback: If no payment methods found, create a default entry
  if (paymentMethodsData.length === 0) {
    paymentMethodsData.push({
      name: 'Cash',
      value: summary.totalOrders,
      amount: summary.totalRevenue,
      isSummary: false
    });
  }

  const chartData = timeFrame === "today" ? hourlyData : 
    filteredOrders.reduce((acc, order) => {
      const date = new Date(order.createdAt);
      const key = timeFrame === "monthly" 
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : date.toISOString().split('T')[0];

      if (!acc[key]) {
        acc[key] = { date: key, revenue: 0, orders: 0 };
      }
      
      // Handle both regular orders and monthly summaries
      if (order.downloadLink) {
        // Monthly summary
        acc[key].revenue += order.totalAmount || 0;
        acc[key].orders += order.totalOrders || 0;
      } else {
        // Regular order
        acc[key].revenue += order.totalAmount || 0;
        acc[key].orders += 1;
      }
      
      return acc;
    }, {});

  const finalChartData = timeFrame === "today" ? chartData : 
    Object.values(chartData).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Revenue Dashboard</h1>
        <div className="mt-4 flex flex-wrap gap-4 items-center">
          <div className="flex space-x-2">
            {["today", "monthly", "all"].map((period) => (
              <button
                key={period}
                onClick={() => {
                  setTimeFrame(period);
                  setSelectedDate("");
                  setSelectedMonth("");
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${
                    timeFrame === period
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-100"
                  }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
          


          {timeFrame === "today" && (
            <CustomDropdown
              options={uniqueDates}
              value={selectedDate}
              onChange={setSelectedDate}
              label="Select Date"
            />
          )}

          {timeFrame === "monthly" && (
            <CustomDropdown
              options={uniqueMonths}
              value={selectedMonth}
              onChange={setSelectedMonth}
              label="Select Month"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Revenue"
          value={`₹${summary.totalRevenue.toLocaleString()}`}
          icon={IndianRupee}
        />
        <MetricCard
          title="Total Orders"
          value={summary.totalOrders}
          icon={ShoppingCart}
        />
        <MetricCard
          title="Average Order Value"
          value={`₹${summary.averageOrderValue.toFixed(2)}`}
          icon={TrendingUp}
        />
        <MetricCard
          title="Total Tax"
          value={`₹${summary.totalTax.toFixed(2)}`}
          icon={CreditCard}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Revenue Trend</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={finalChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey={timeFrame === "today" ? "hour" : "date"}
                  stroke="#64748b"
                  tick={{ fontSize: 12, angle: -45, textAnchor: "end" }}
                  interval={0}
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0088FE"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Orders Distribution</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={finalChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey={timeFrame === "today" ? "hour" : "date"}
                  stroke="#64748b"
                  tick={{ fontSize: 12 }}
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="orders"
                  fill="#00C49F"
                  radius={[4, 4, 0, 0]}
                  name="Orders"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-4">Payment Methods</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey={(entry) => entry.value || 1} // Use 1 for summary payment methods
                  label
                >
                  {paymentMethodsData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg mb-10">
          <h2 className="text-xl font-semibold mb-4">Payment Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Payment Method</th>
                  <th className="text-right py-2">Orders</th>
                  <th className="text-right py-2">Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethodsData.map(({ name, value, amount, isSummary }) => (
                  <tr key={name} className="border-b">
                    <td className="py-2">
                      {name}
                      {isSummary && <span className="text-xs text-gray-500 ml-2">(Summary)</span>}
                    </td>
                    <td className="text-right">
                      {value !== null ? value : '-'}
                    </td>
                    <td className="text-right">₹{amount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}</td>
                  </tr>
                ))}
                <tr className="border-b font-bold">
                  <td className="py-2">Total</td>
                  <td className="text-right">{summary.totalOrders}</td>
                  <td className="text-right">₹{summary.totalRevenue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>



      {/* Monthly Summaries Section */}
      {monthlySummaries.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Monthly Archives</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Month</th>
                  <th className="text-right py-2">Total Orders</th>
                  <th className="text-right py-2">Total Revenue</th>
                  <th className="text-right py-2">CGST</th>
                  <th className="text-right py-2">SGST</th>
                  <th className="text-right py-2">Service Tax</th>
                  <th className="text-center py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummaries.map((summary) => (
                  <tr key={summary.orderId} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium">{summary.orderId}</td>
                    <td className="text-right">{summary.totalOrders}</td>
                    <td className="text-right">₹{summary.totalAmount?.toLocaleString()}</td>
                    <td className="text-right">₹{summary.cgst?.toFixed(2)}</td>
                    <td className="text-right">₹{summary.sgst?.toFixed(2)}</td>
                    <td className="text-right">₹{summary.serviceTax?.toFixed(2)}</td>
                    <td className="text-center">
                      <button
                        onClick={() => window.open(summary.downloadLink, "_blank")}
                        disabled={!summary.downloadLink}
                        className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        Download CSV
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueDashboard;