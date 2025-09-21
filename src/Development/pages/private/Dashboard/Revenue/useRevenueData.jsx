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

    // Helper function to check if payment method is complementary
    const isComplementaryPayment = (paymentMethod) => {
      if (!paymentMethod) return false;
      return paymentMethod.toLowerCase().includes('complementary') || 
             paymentMethod.toLowerCase().includes('complimentary');
    };

    // Helper function to get revenue amount excluding complementary payments
    const getRevenueFromOrder = (order) => {
      if (order.downloadLink) {
        // Monthly summary record - check paymentMethods object
        if (order.paymentMethods && typeof order.paymentMethods === 'object') {
          return Object.entries(order.paymentMethods).reduce((sum, [method, amount]) => {
            if (isComplementaryPayment(method)) {
              return sum; // Don't add complementary amount to revenue
            }
            return sum + (Number(amount) || 0);
          }, 0);
        } else {
          // Monthly summary without paymentMethods breakdown - check if order itself is complementary
          const orderPaymentMethod = order.paymentMethod || order.paymentMethodType || order.paymentType;
          if (isComplementaryPayment(orderPaymentMethod)) {
            return 0;
          }
          return order.totalAmount || 0;
        }
      } else {
        // Regular order - handle both single payment method and array of payment methods
        if (Array.isArray(order.paymentMethods)) {
          // Handle array of payment methods
          return order.paymentMethods.reduce((sum, methodEntry) => {
            if (methodEntry?.method && typeof methodEntry.amount === "number") {
              if (isComplementaryPayment(methodEntry.method)) {
                return sum; // Don't add complementary amount to revenue
              }
              return sum + methodEntry.amount;
            }
            return sum;
          }, 0);
        } else {
          // Handle single payment method
          let paymentMethod = order.paymentMethod || order.paymentMethodType || order.paymentType;
          if (isComplementaryPayment(paymentMethod)) {
            return 0; // Don't add complementary orders to revenue
          }
          return order.totalAmount || 0;
        }
      }
    };

    // Calculate revenue excluding complementary payments
    const totalRevenue = filteredOrders.reduce((sum, order) => {
      return sum + getRevenueFromOrder(order);
    }, 0);

    // Calculate total orders (including complementary for count)
    const totalOrders = filteredOrders.reduce((sum, order) => {
      if (order.downloadLink && order.totalOrders !== undefined) {
        // Monthly summary record - use the totalOrders field
        return sum + Number(order.totalOrders);
      }
      // Regular order - count all orders including complementary
      return sum + 1;
    }, 0);

    // Calculate average order value based on revenue (excluding complementary)
    const revenueGeneratingOrders = filteredOrders.reduce((count, order) => {
      if (order.downloadLink) {
        // For monthly summaries, we need to estimate non-complementary orders
        // This is complex without detailed breakdown, so we'll use totalOrders as approximation
        return count + (Number(order.totalOrders) || 0);
      } else {
        // Regular order - check if it's not complementary
        let paymentMethod = order.paymentMethod || order.paymentMethodType || order.paymentType;
        if (Array.isArray(order.paymentMethods)) {
          // If any payment method in the array is non-complementary, count the order
          const hasNonComplementary = order.paymentMethods.some(methodEntry => 
            !isComplementaryPayment(methodEntry?.method)
          );
          return hasNonComplementary ? count + 1 : count;
        } else {
          return isComplementaryPayment(paymentMethod) ? count : count + 1;
        }
      }
    }, 0);

    const averageOrderValue = revenueGeneratingOrders > 0 ? totalRevenue / revenueGeneratingOrders : 0;

    // Calculate total tax only on revenue-generating orders
    const totalTax = institution === "bhuk2323" 
      ? totalRevenue * 0.05  
      : filteredOrders.reduce((sum, order) => {
          // Only calculate tax if the order contributes to revenue
          const orderRevenue = getRevenueFromOrder(order);
          if (orderRevenue === 0) return sum; // Skip complementary orders for tax calculation
          
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

    // Generate hourly data from regular orders (excluding complementary revenue)
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      revenue: 0,
      orders: 0,
    }));
    
    filteredRegularOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const hour = orderDate.getHours();
      
      // Count all orders including complementary
      hourlyData[hour].orders += 1;
      
      // Add revenue only if not complementary
      const orderRevenue = getRevenueFromOrder(order);
      hourlyData[hour].revenue += orderRevenue;
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