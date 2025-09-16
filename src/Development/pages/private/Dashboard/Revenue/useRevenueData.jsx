import { useMemo } from 'react';

export const useRevenueData = (data, timeFrame, selectedDate, selectedMonth, institution) => {
  return useMemo(() => {
    if (!data) return null;

    // Filter valid orders and separate regular orders from monthly summaries
    const validOrders = data.filter(order => order.paymentStatus === true);
    const regularOrders = validOrders.filter(order => !order.downloadLink);
    const monthlySummaries = validOrders.filter(order => order.downloadLink);

    const filterData = (orders) => {
      switch (timeFrame) {
        case 'today': {
          const filterDate = selectedDate || new Date();
          return orders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return (
              orderDate.getUTCDate() === filterDate.getUTCDate() &&
              orderDate.getUTCMonth() === filterDate.getUTCMonth() &&
              orderDate.getUTCFullYear() === filterDate.getUTCFullYear()
            );
          });
        }
        case 'monthly': {
          const filterDate = selectedMonth || new Date();
          return orders.filter(order => {
            const orderDate = new Date(order.createdAt);
            return (
              orderDate.getUTCMonth() === filterDate.getUTCMonth() &&
              orderDate.getUTCFullYear() === filterDate.getUTCFullYear()
            );
          });
        }
        default:
          return orders;
      }
    };

    const filteredRegularOrders = filterData(regularOrders);
    const filteredMonthlySummaries = filterData(monthlySummaries);
    const filteredOrders = [...filteredRegularOrders, ...filteredMonthlySummaries];

    // Calculate totals considering both regular orders and monthly summaries
    const totalRevenue = filteredOrders.reduce((sum, order) => {
      if (order.downloadLink) {
        // Monthly summary record
        return sum + (order.totalAmount || 0);
      }
      // Regular order
      return sum + (order.totalAmount || 0);
    }, 0);

    const totalOrders = filteredOrders.reduce((sum, order) => {
      if (order.downloadLink && order.totalOrders !== undefined) {
        // Monthly summary record - use the totalOrders field
        return sum + Number(order.totalOrders);
      }
      // Regular order
      return sum + 1;
    }, 0);

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate total tax considering both regular orders and monthly summaries
    const totalTax = institution === "bhuk2323" 
      ? totalRevenue * 0.05  
      : filteredOrders.reduce((sum, order) => {
          if (order.downloadLink) {
            // Monthly summary record - tax is already calculated
            const cgst = isNaN(parseFloat(order.cgst)) ? 0 : parseFloat(order.cgst);
            const sgst = isNaN(parseFloat(order.sgst)) ? 0 : parseFloat(order.sgst);
            const serviceTax = isNaN(parseFloat(order.serviceTax)) ? 0 : parseFloat(order.serviceTax);
            return sum + cgst + sgst + serviceTax;
          } else {
            // Regular order
            const cgst = isNaN(parseFloat(order.cgst)) ? 0 : parseFloat(order.cgst);
            const sgst = isNaN(parseFloat(order.sgst)) ? 0 : parseFloat(order.sgst);
            const serviceTax = isNaN(parseFloat(order.serviceTax)) ? 0 : parseFloat(order.serviceTax);
            return sum + cgst + sgst + serviceTax;
          }
        }, 0);

    // Get unique dates and months from all orders (including summaries)
    const uniqueDates = [...new Set(validOrders.map(order => {
      const date = new Date(order.createdAt);
      return date.toISOString().split('T')[0];
    }))].sort().reverse();

    const uniqueMonths = [...new Set(validOrders.map(order => {
      const date = new Date(order.createdAt);
      return `${date.getFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    }))].sort().reverse();

    // Generate hourly data only from regular orders (summaries don't have hourly breakdown)
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      revenue: 0,
      orders: 0,
    }));
    
    filteredRegularOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const hour = orderDate.getHours();
      hourlyData[hour].revenue += order.totalAmount || 0;
      hourlyData[hour].orders += 1;
    });

    return {
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        totalTax,
      },
      hourlyData,
      uniqueDates,
      uniqueMonths,
      filteredOrders,
      regularOrders: filteredRegularOrders,
      monthlySummaries: filteredMonthlySummaries,
    };
  }, [data, timeFrame, selectedDate, selectedMonth, institution]);
};