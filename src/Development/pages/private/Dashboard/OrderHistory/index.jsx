import React, { useContext, useEffect, useState, useCallback } from "react";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import { PaginatedTable } from "../../../../common/DataDisplay";
import { FaEye } from "react-icons/fa6";
import { FaEdit, FaPlus, FaTrash } from "react-icons/fa";
import { Button } from "flowbite-react";
import { getCurrencySymbol } from "../../../../common/Inputs";
import { RiBillLine } from "react-icons/ri";
import { DayPicker } from 'react-day-picker';
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import Error from "../../../Error";
import OrderDetailsModal from "./OrderDetailsModal";
import PrintOrderHistoryBill from "./PrintOrderHistoryBill";
import { toast } from "react-toastify";
const OrderHistory = () => {
  const { institution } = useContext(Context).institutionData;
  const { institutionData } = useContext(Context);
  const { userData } = useContext(Context);
  const [selectedOrderItems, setSelectedOrderItems] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null); // full order for modal/print
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orders, setOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loader, setLoader] = useState(true);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [staffList, setStaffList] = useState([]);
  const [chefNames, setChefNames] = useState({});
  const [showKOT, setShowKOT] = useState(false);
  const [kotOrderId, setKotOrderId] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [filterType, setFilterType] = useState("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthlySummaries, setShowMonthlySummaries] = useState(true);
  const [showPrintBill, setShowPrintBill] = useState(false);
  const [selectedPrintOrder, setSelectedPrintOrder] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEditOrder, setSelectedEditOrder] = useState(null);
  const [editPaymentMethods, setEditPaymentMethods] = useState([]);
  const [editDiscountAmount, setEditDiscountAmount] = useState(0);
  const [editDiscountPercentage, setEditDiscountPercentage] = useState(0);
  const [editDiscountType, setEditDiscountType] = useState('amount'); // 'amount' or 'percentage'
  // Helper function to compute subtotal from items (ignores database subtotal)
  const computeSubtotalFromItems = (items) => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };
  // Helper function to check if payment method is complementary
  const isComplementaryPayment = (paymentMethod) => {
    if (!paymentMethod) return false;
    return paymentMethod.toLowerCase().includes('complementary') ||
           paymentMethod.toLowerCase().includes('complimentary');
  };
  // Helper function to check if an item category is non-taxable
  const isNonTaxableCategory = (category) => {
    if (!category) return false;
    const categoryLower = category.toLowerCase();
    return categoryLower.includes('no tax') ||
           categoryLower.includes('notax') ||
           categoryLower.includes('no tax beverage') ||
           categoryLower.includes('exempt');
  };
  // Helper function to calculate taxes properly based on institution settings and item categories
  const calculateTaxesForOrder = (subtotal, discountAmount = 0, orderItems = []) => {
    const afterDiscountAmount = subtotal - discountAmount;
    const cgstRate = institutionData?.cgst || 0;
    const sgstRate = institutionData?.sgst || 0;
    const serviceTaxRate = institutionData?.serviceTax || 0;
 
    // If no items provided, calculate tax on full amount (backward compatibility)
    if (!orderItems || orderItems.length === 0) {
      const cgst = afterDiscountAmount * (cgstRate / 100);
      const sgst = afterDiscountAmount * (sgstRate / 100);
      const serviceTax = afterDiscountAmount * (serviceTaxRate / 100);
   
      return {
        cgst,
        sgst,
        serviceTax,
        totalTax: cgst + sgst + serviceTax,
        totalWithTax: Math.round(afterDiscountAmount + cgst + sgst + serviceTax)
      };
    }
 
    // Calculate total amount of taxable vs non-taxable items
    let taxableAmount = 0;
    let nonTaxableAmount = 0;
    const totalItemAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
 
    orderItems.forEach(item => {
      const itemTotal = item.price * item.quantity;
      if (isNonTaxableCategory(item.category)) {
        nonTaxableAmount += itemTotal;
      } else {
        taxableAmount += itemTotal;
      }
    });
 
    // Apply discount proportionally to taxable items only
    const discountRatio = afterDiscountAmount / totalItemAmount;
    const adjustedTaxableAmount = taxableAmount * discountRatio;
 
    // Calculate taxes only on taxable amount
    const cgst = adjustedTaxableAmount * (cgstRate / 100);
    const sgst = adjustedTaxableAmount * (sgstRate / 100);
    const serviceTax = adjustedTaxableAmount * (serviceTaxRate / 100);
 
    return {
      cgst,
      sgst,
      serviceTax,
      totalTax: cgst + sgst + serviceTax,
      taxableAmount: adjustedTaxableAmount,
      nonTaxableAmount: nonTaxableAmount * discountRatio,
      totalWithTax: Math.round(afterDiscountAmount + cgst + sgst + serviceTax)
    };
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
  // Helper to normalize order source (supports orderSource or source)
  const getOrderSource = (order) => {
    if (!order) return "N/A";
    return order.orderSource || order.source || "N/A";
  };
  const getDateLimits = () => {
    const today = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);
    return {
      minDate: twoMonthsAgo,
      maxDate: today
    };
  };
  const isDateInAllowedRange = (date) => {
    const { minDate, maxDate } = getDateLimits();
    return date >= minDate && date <= maxDate;
  };
  const handleDateSelection = (date, setDateFunction, closePicker) => {
    if (!date) return;
 
    if (!isDateInAllowedRange(date)) {
      setFilterType("monthly");
      setSelectedMonth(date.getMonth());
      setSelectedYear(date.getFullYear());
      toast.info("Date is older than 2 months. Switched to monthly view for better performance.");
    } else {
      setDateFunction(date);
    }
    closePicker(false);
  };
  const formatPaymentMethod = (order) => {
    if (order.paymentMethods) {
      if (Array.isArray(order.paymentMethods)) {
        return order.paymentMethods
          .map(pm => {
            const isComplementary = isComplementaryPayment(pm.method);
            return `${pm.method}${isComplementary ? ' (Complementary)' : ''} (${getCurrencySymbol(order.currency || 'INR')}${pm.amount})`;
          })
          .join(", ");
      }
      else if (typeof order.paymentMethods === 'object' && order.paymentMethods !== null) {
        return Object.entries(order.paymentMethods)
          .map(([method, amount]) => {
            const isComplementary = isComplementaryPayment(method);
            return `${method}${isComplementary ? ' (Complementary)' : ''} (${getCurrencySymbol(order.currency || 'INR')}${amount})`;
          })
          .join(", ");
      }
    }
    const paymentMethod = order.paymentMethod || "N/A";
    const isComplementary = isComplementaryPayment(paymentMethod);
    return `${paymentMethod}${isComplementary ? ' (Complementary)' : ''}`;
  };
  const getPaymentMethodForExport = (order) => {
    if (order.paymentMethods) {
      if (Array.isArray(order.paymentMethods)) {
        return order.paymentMethods
          .map(pm => {
            const isComplementary = isComplementaryPayment(pm.method);
            return `${pm.method}${isComplementary ? ' (Complementary)' : ''}: ${getCurrencySymbol(order.currency || 'INR')}${pm.amount}`;
          })
          .join("; ");
      }
      else if (typeof order.paymentMethods === 'object' && order.paymentMethods !== null) {
        return Object.entries(order.paymentMethods)
          .map(([method, amount]) => {
            const isComplementary = isComplementaryPayment(method);
            return `${method}${isComplementary ? ' (Complementary)' : ''}: ${getCurrencySymbol(order.currency || 'INR')}${amount}`;
          })
          .join("; ");
      }
    }
    const paymentMethod = order.paymentMethod || "N/A";
    const isComplementary = isComplementaryPayment(paymentMethod);
    return `${paymentMethod}${isComplementary ? ' (Complementary)' : ''}`;
  };
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  const handleAddPaymentMethod = () => {
    setEditPaymentMethods(prev => [...prev, { method: "Cash", amount: 0 }]);
  };
  const handleRemovePaymentMethod = (index) => {
    setEditPaymentMethods(prev => prev.filter((_, i) => i !== index));
  };
  const handlePaymentMethodChange = (index, field, value) => {
    setEditPaymentMethods(prev =>
      prev.map((pm, i) =>
        i === index ? { ...pm, [field]: field === 'amount' ? Number(value) || 0 : value } : pm
      )
    );
  };
  const getCurrentPaymentMethods = useCallback((order) => {
    if (order.paymentMethods && Array.isArray(order.paymentMethods)) {
      return order.paymentMethods;
    } else {
      const total = order.totalAmount || 0;
      const method = order.paymentMethod || "Cash";
      return [{ method, amount: total }];
    }
  }, []);
  const calculatePaymentTotal = () => {
    return editPaymentMethods.reduce((sum, pm) => sum + pm.amount, 0);
  };
  // Updated to use computed subtotal from items
  const calculateDiscountTotal = () => {
    const subtotal = computeSubtotalFromItems(selectedEditOrder?.items);
    if (editDiscountType === 'percentage') {
      return (subtotal * (editDiscountPercentage / 100));
    }
    return editDiscountAmount;
  };
  // Updated to use computed subtotal from items
  const calculateOrderTotal = () => {
    const subtotal = computeSubtotalFromItems(selectedEditOrder?.items);
    const discount = calculateDiscountTotal();
    const orderItems = selectedEditOrder?.items || [];
 
    // Use the updated tax calculation that considers non-taxable items
    const taxCalc = calculateTaxesForOrder(subtotal, discount, orderItems);
    return taxCalc.totalWithTax;
  };
  const handleUpdateOrder = async () => {
    const paymentTotal = calculatePaymentTotal();
    const orderTotal = calculateOrderTotal();
    if (Math.abs(paymentTotal - orderTotal) > 0.01) {
      toast.error(`Total payment amount (₹${paymentTotal.toFixed(2)}) does not match order total (₹${orderTotal.toFixed(2)})`);
      return;
    }
    if (editPaymentMethods.length === 0) {
      toast.error("At least one payment method is required.");
      return;
    }
    try {
      const updateBody = {
        paymentMethods: editPaymentMethods,
      };
      // Add discount only if it's not zero
      if (editDiscountType === 'amount' && editDiscountAmount > 0) {
        updateBody.discountAmount = editDiscountAmount;
      } else if (editDiscountType === 'percentage' && editDiscountPercentage > 0) {
        updateBody.discountPercentage = editDiscountPercentage;
      }
      await API.put("main", `/admin/update-payment/${institution}/${selectedEditOrder.orderId}`, {
        body: updateBody
      });
      // Update local state
      setAllOrders((prev) =>
        prev.map((o) =>
          o.orderId === selectedEditOrder.orderId
            ? {
                ...o,
                paymentMethods: editPaymentMethods,
                ...(editDiscountType === 'amount' ? { discountAmount: editDiscountAmount, discountPercentage: 0 } : { discountPercentage: editDiscountPercentage, discountAmount: calculateDiscountTotal() }),
                totalAmount: orderTotal
              }
            : o
        )
      );
      toast.success("Order updated successfully");
      setShowEditModal(false);
      setSelectedEditOrder(null);
      setEditPaymentMethods([]);
      setEditDiscountAmount(0);
      setEditDiscountPercentage(0);
      setEditDiscountType('amount');
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Error updating order");
    }
  };
  if (userData?.userType !== 'admin') {
    return <Error message="Access Denied: Admins Only" />;
  }
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  useEffect(() => {
    if (showEditModal && selectedEditOrder) {
      setEditPaymentMethods(getCurrentPaymentMethods(selectedEditOrder));
      // Determine discount type: prefer percentage if it's non-zero, else amount
      if (selectedEditOrder.discountPercentage > 0) {
        setEditDiscountType('percentage');
        setEditDiscountPercentage(selectedEditOrder.discountPercentage);
        setEditDiscountAmount(0); // Reset amount
      } else {
        setEditDiscountType('amount');
        setEditDiscountAmount(selectedEditOrder.discountAmount || 0);
        setEditDiscountPercentage(0); // Reset percentage
      }
    } else {
      setEditPaymentMethods([]);
      setEditDiscountAmount(0);
      setEditDiscountPercentage(0);
      setEditDiscountType('amount');
    }
  }, [showEditModal, selectedEditOrder, getCurrentPaymentMethods]);
  useEffect(() => {
    if (institution && userData?.userType && userData?.cognitoId) {
      fetchAllOrders();
    }
  }, [institution, userData]);
  useEffect(() => {
    applyFilters();
  }, [allOrders, filterType, selectedDate, startDate, endDate, selectedMonth, selectedYear, showMonthlySummaries]);
  const fetchAllOrders = async () => {
    if (!userData || !userData.userType || !userData.cognitoId) {
      console.log("Waiting for userData to load...");
      return;
    }
    try {
      setLoader(true);
      const type = institutionData?.bar_integration === "Yes" ? "bar" : "cafe";
      const result = await API.get(
        "main",
        `/admin/list-orders/${institution}?type=${type}`,
        {}
      );
      console.log("Fetched orders:", result);
      const paidOrders = result.filter((order) => order.paymentStatus === true);
      // Compute correct subtotals for all orders from items (override database subtotal)
      const ordersWithCorrectSubtotal = paidOrders.map(order => ({
        ...order,
        subtotal: computeSubtotalFromItems(order.items)
      }));
      setAllOrders(ordersWithCorrectSubtotal);
      if (userData.userType === "admin") {
        const staffResult = await API.get(
          "main",
          `/admin/staff-list/${institution}`,
          {}
        );
        setStaffList(staffResult);
        const chefNameMapping = {};
        staffResult.forEach((staff) => {
          chefNameMapping[staff.cognitoId] = staff.userName;
        });
        setChefNames(chefNameMapping);
      }
      setLoader(false);
    } catch (e) {
      console.error("Error fetching orders:", e);
      setLoader(false);
    }
  };
  const applyFilters = useCallback(() => {
    if (allOrders.length === 0) {
      setOrders([]);
      return;
    }
    let filteredOrders = [...allOrders];
    if (filterType === "day") {
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);
      filteredOrders = filteredOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= dayStart && orderDate <= dayEnd;
      });
    } else if (filterType === "dateRange") {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filteredOrders = filteredOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= start && orderDate <= end;
      });
    } else if (filterType === "monthly") {
      filteredOrders = filteredOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return (
          orderDate.getMonth() === selectedMonth &&
          orderDate.getFullYear() === selectedYear
        );
      });
    } else if (filterType === "yearly") {
      filteredOrders = filteredOrders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        return orderDate.getFullYear() === selectedYear;
      });
    } else if (filterType === "showAll") {
      // no-op; use full list
    }
    if (!showMonthlySummaries) {
      filteredOrders = filteredOrders.filter(order => !order.downloadLink);
    }
    const sortedOrders = filteredOrders.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    setOrders(sortedOrders);
  }, [allOrders, filterType, selectedDate, startDate, endDate, selectedMonth, selectedYear, showMonthlySummaries]);
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };
  // Calculate revenue excluding complementary payments
  const netRevenue = orders.reduce((sum, order) => sum + getRevenueFromOrder(order), 0);
  const totalAmount = netRevenue; // Make totalAmount equal to netRevenue (excluding complementary)
  const totalOrders = orders.reduce((sum, order) => {
    if (order.totalOrders !== undefined && order.downloadLink !== undefined) {
      return sum + Number(order.totalOrders);
    }
    return sum + 1;
  }, 0);
  const avgOrderSize = totalOrders > 0 ? (netRevenue / totalOrders).toFixed(2) : 0;
  const handlePrintBill = (order) => {
    setSelectedPrintOrder(order);
    setShowPrintBill(true);
  };
  const openOrderDetails = (order) => {
    setSelectedOrderItems(order.items || []);
    setSelectedOrder(order || null);
    setShowOrderModal(true);
  };
  // Updated openEditModal to compute and override subtotal from items
  const openEditModal = (order) => {
    const computedSubtotal = computeSubtotalFromItems(order.items);
    const orderWithCorrectSubtotal = { ...order, subtotal: computedSubtotal };
    setSelectedEditOrder(orderWithCorrectSubtotal);
    setShowEditModal(true);
  };
  const closeOrderModal = () => {
    setShowOrderModal(false);
    setSelectedOrderItems([]);
    setSelectedOrder(null);
  };
  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedEditOrder(null);
    setEditPaymentMethods([]);
    setEditDiscountAmount(0);
    setEditDiscountPercentage(0);
    setEditDiscountType('amount');
  };
  const Loader = () => (
    <div className="flex flex-col items-center justify-center p-12">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-gray-300 border-t-primaryColor rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-primaryColor">📦</div>
      </div>
      <p className="mt-4 text-primaryColor font-medium">Loading orders...</p>
    </div>
  );
  if (loader) {
    return <Loader />;
  }
  const paymentTotal = calculatePaymentTotal();
  const discountTotal = calculateDiscountTotal();
  const orderTotal = calculateOrderTotal();
  const originalSubtotal = computeSubtotalFromItems(selectedEditOrder?.items);
  const isTotalValid = Math.abs(paymentTotal - orderTotal) <= 0.01;
  // Export functions (exportToExcel, exportToPDF, exportItemsReport) remain unchanged
  const exportToExcel = () => {
    const exportData = [];
    // Add header row
    exportData.push({
      "Order ID": `${institutionData.companyName} Order Report`,
      "Type": "",
      "Name": "",
      "Table": "",
      "Order Source": "",
      "Phone Number": "",
      "Total Orders": "",
      "Total Amount": "",
      "Revenue Amount": "",
      "CGST": "",
      "SGST": "",
      "Service Tax": "",
      "Date": "",
      "Time": "",
      "Download Link": "",
      "Payment Method": "",
      "Discount Amount": "",
      "Discount Percentage": "",
      "Subtotal": "",
      "Item Name": "",
      "Quantity": "",
      "Item Price": "",
      "Item Total": ""
    });
    // Add summary row for total orders, total amount, and net revenue
    exportData.push({
      "Order ID": "Summary",
      "Type": "Overall Totals",
      "Name": "",
      "Table": "",
      "Order Source": "",
      "Phone Number": "",
      "Total Orders": totalOrders,
      "Total Amount": `${getCurrencySymbol('INR')}${totalAmount}`,
      "Revenue Amount": `${getCurrencySymbol('INR')}${netRevenue}`,
      "CGST": "",
      "SGST": "",
      "Service Tax": "",
      "Date": "",
      "Time": "",
      "Download Link": "",
      "Payment Method": "",
      "Discount Amount": "",
      "Discount Percentage": "",
      "Subtotal": "",
      "Item Name": "",
      "Quantity": "",
      "Item Price": "",
      "Item Total": ""
    });
    orders.forEach((order) => {
      const isSummary = order.downloadLink !== undefined;
      const orderRevenue = getRevenueFromOrder(order);
      if (isSummary) {
        // Monthly summary row
        const summaryRow = {
          "Order ID": order.orderId,
          "Type": "Monthly Summary",
          "Name": "",
          "Table": "",
          "Order Source": getOrderSource(order),
          "Phone Number": institution === "bhuk2323" ? "N/A" : "",
          "Total Orders": order.totalOrders || "N/A",
          "Total Amount": `${getCurrencySymbol(order.currency || 'INR')}${orderRevenue}`, // Use revenue for consistency
          "Revenue Amount": `${getCurrencySymbol(order.currency || 'INR')}${orderRevenue}`,
          "CGST": order.cgst ? `${getCurrencySymbol(order.currency || 'INR')}${order.cgst}` : "",
          "SGST": order.sgst ? `${getCurrencySymbol(order.currency || 'INR')}${order.sgst}` : "",
          "Service Tax": order.serviceTax ? `${getCurrencySymbol(order.currency || 'INR')}${order.serviceTax}` : "",
          "Date": formatDate(order.createdAt),
          "Time": formatTime(order.createdAt),
          "Download Link": order.downloadLink || "",
          "Payment Method": getPaymentMethodForExport(order),
          "Discount Amount": `${getCurrencySymbol(order.currency || 'INR')}${order.discountAmount || 0}`,
          "Discount Percentage": `${order.discountPercentage || 0}%`,
          "Subtotal": `${getCurrencySymbol(order.currency || 'INR')}${order.subtotal || 0}`,
          "Item Name": "",
          "Quantity": "",
          "Item Price": "",
          "Item Total": ""
        };
        exportData.push(summaryRow);
        // Add payment methods for summary
        if (order.paymentMethods && typeof order.paymentMethods === 'object') {
          const paymentMethods = Array.isArray(order.paymentMethods)
            ? order.paymentMethods.map(pm => ({ method: pm.method, amount: pm.amount }))
            : Object.entries(order.paymentMethods).map(([method, amount]) => ({ method, amount }));
          paymentMethods.forEach(({ method, amount }) => {
            const isComplementary = isComplementaryPayment(method);
            exportData.push({
              "Order ID": "",
              "Type": "",
              "Name": "",
              "Table": "",
              "Order Source": "",
              "Phone Number": "",
              "Total Orders": "",
              "Total Amount": "",
              "Revenue Amount": "",
              "CGST": "",
              "SGST": "",
              "Service Tax": "",
              "Date": "",
              "Time": "",
              "Download Link": "",
              "Payment Method": "",
              "Discount Amount": "",
              "Discount Percentage": "",
              "Subtotal": "",
              "Item Name": `Payment Method: ${method}${isComplementary ? ' (Complementary)' : ''}`,
              "Quantity": "",
              "Item Price": "",
              "Item Total": `${getCurrencySymbol(order.currency || 'INR')}${amount}`
            });
          });
        }
      } else {
        // Regular order row
        const mainOrderRow = {
          "Order ID": order.orderId,
          "Type": "Regular Order",
          "Name": order.name || "N/A",
          "Table": order.tableName || "N/A",
          "Order Source": getOrderSource(order),
          "Phone Number": institution === "bhuk2323" ? order.phoneNumber || "N/A" : "",
          "Total Orders": "1",
          "Total Amount": `${getCurrencySymbol(order.currency || 'INR')}${orderRevenue}`, // Use revenue for consistency
          "Revenue Amount": `${getCurrencySymbol(order.currency || 'INR')}${orderRevenue}`,
          "CGST": order.cgst ? `${order.cgst}%` : "",
          "SGST": order.sgst ? `${order.sgst}%` : "",
          "Service Tax": order.serviceTax ? `${getCurrencySymbol(order.currency || 'INR')}${order.serviceTax}` : "",
          "Date": formatDate(order.createdAt),
          "Time": formatTime(order.createdAt),
          "Download Link": "",
          "Payment Method": getPaymentMethodForExport(order),
          "Discount Amount": `${getCurrencySymbol(order.currency || 'INR')}${order.discountAmount || 0}`,
          "Discount Percentage": `${order.discountPercentage || 0}%`,
          "Subtotal": `${getCurrencySymbol(order.currency || 'INR')}${order.subtotal || 0}`,
          "Item Name": "",
          "Quantity": "",
          "Item Price": "",
          "Item Total": ""
        };
        exportData.push(mainOrderRow);
        // Add items for regular order
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item) => {
            exportData.push({
              "Order ID": "",
              "Type": "",
              "Name": "",
              "Table": "",
              "Order Source": "",
              "Phone Number": "",
              "Total Orders": "",
              "Total Amount": "",
              "Revenue Amount": "",
              "CGST": "",
              "SGST": "",
              "Service Tax": "",
              "Date": "",
              "Time": "",
              "Download Link": "",
              "Payment Method": "",
              "Discount Amount": "",
              "Discount Percentage": "",
              "Subtotal": "",
              "Item Name": item.name || "N/A",
              "Quantity": item.quantity || 0,
              "Item Price": `${getCurrencySymbol(order.currency || 'INR')}${item.price || 0}`,
              "Item Total": `${getCurrencySymbol(order.currency || 'INR')}${(item.price * item.quantity) || 0}`
            });
          });
        }
        // Add payment methods for regular order
        if (order.paymentMethods && typeof order.paymentMethods === 'object') {
          const paymentMethods = Array.isArray(order.paymentMethods)
            ? order.paymentMethods.map(pm => ({ method: pm.method, amount: pm.amount }))
            : Object.entries(order.paymentMethods).map(([method, amount]) => ({ method, amount }));
          paymentMethods.forEach(({ method, amount }) => {
            const isComplementary = isComplementaryPayment(method);
            exportData.push({
              "Order ID": "",
              "Type": "",
              "Name": "",
              "Table": "",
              "Order Source": "",
              "Phone Number": "",
              "Total Orders": "",
              "Total Amount": "",
              "Revenue Amount": "",
              "CGST": "",
              "SGST": "",
              "Service Tax": "",
              "Date": "",
              "Time": "",
              "Download Link": "",
              "Payment Method": "",
              "Discount Amount": "",
              "Discount Percentage": "",
              "Subtotal": "",
              "Item Name": `Payment Method: ${method}${isComplementary ? ' (Complementary)' : ''}`,
              "Quantity": "",
              "Item Price": "",
              "Item Total": `${getCurrencySymbol(order.currency || 'INR')}${amount}`
            });
          });
        }
      }
      // Add empty row for separation
      exportData.push({
        "Order ID": "",
        "Type": "",
        "Name": "",
        "Table": "",
        "Order Source": "",
        "Phone Number": "",
        "Total Orders": "",
        "Total Amount": "",
        "Revenue Amount": "",
        "CGST": "",
        "SGST": "",
        "Service Tax": "",
        "Date": "",
        "Time": "",
        "Download Link": "",
        "Payment Method": "",
        "Discount Amount": "",
        "Discount Percentage": "",
        "Subtotal": "",
        "Item Name": "",
        "Quantity": "",
        "Item Price": "",
        "Item Total": ""
      });
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${institutionData.companyName} Orders`);
    const maxWidth = 50;
    const colWidths = {};
    Object.keys(exportData[0]).forEach(key => {
      colWidths[key] = Math.min(
        Math.max(...exportData.map(row => row[key] ? row[key].toString().length : 0)),
        maxWidth
      );
    });
    worksheet["!cols"] = Object.keys(colWidths).map(key => ({ wch: colWidths[key] }));
    XLSX.writeFile(workbook, `${institutionData.companyName}_orders_with_items.xlsx`);
  };
  const exportToPDF = () => {
    const doc = new jsPDF();
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.width;
    // Add centered company name heading
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    const title = `${institutionData.companyName} Order Report`;
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPos);
    yPos += 10;
    // Add summary section for total orders, total amount, and net revenue
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text("Overall Totals", 10, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Total Orders: ${totalOrders}`, 10, yPos);
    doc.text(`Total Amount: ${totalAmount}`, 80, yPos);
    doc.text(`Revenue Amount: ${netRevenue}`, 150, yPos);
    yPos += 10;
    doc.setDrawColor(200);
    doc.line(10, yPos, pageWidth - 10, yPos);
    yPos += 10;
    orders.forEach((order, index) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      const orderRevenue = getRevenueFromOrder(order);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      const isSummary = order.downloadLink !== undefined;
      if (isSummary) {
        // Monthly summary section
        doc.text(`Monthly Summary - ${order.orderId}`, 10, yPos);
        yPos += 10;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Total Orders: ${order.totalOrders || 'N/A'}`, 10, yPos);
        doc.text(`Total Amount: ${orderRevenue}`, 80, yPos); // Use revenue for consistency
        doc.text(`Revenue Amount: ${orderRevenue}`, 150, yPos);
        yPos += 7;
        doc.text(`Date: ${formatDate(order.createdAt)}`, 10, yPos);
        yPos += 7;
        doc.text(`Source: ${getOrderSource(order)}`, 10, yPos);
        yPos += 7;
        doc.text(`CGST: ${order.cgst ? `${order.cgst}` : 'N/A'}`, 10, yPos);
        doc.text(`SGST: ${order.sgst ? `${order.sgst}` : 'N/A'}`, 80, yPos);
        doc.text(`Service Tax: ${order.serviceTax ? `${order.serviceTax}` : 'N/A'}`, 150, yPos);
        yPos += 7;
        doc.text(`Discount Amount: ${order.discountAmount || 0}`, 10, yPos);
        doc.text(`Discount %: ${order.discountPercentage || 0}%`, 80, yPos);
        doc.text(`Subtotal: ${order.subtotal || 0}`, 150, yPos);
        yPos += 7;
        doc.text(`Download Link: ${order.downloadLink || 'N/A'}`, 10, yPos);
        yPos += 10;
        if (order.paymentMethods && typeof order.paymentMethods === 'object') {
          const paymentData = Array.isArray(order.paymentMethods)
            ? order.paymentMethods.map(pm => {
                const isComplementary = isComplementaryPayment(pm.method);
                return [`${pm.method}${isComplementary ? ' (Complementary)' : ''}`, `${pm.amount}`];
              })
            : Object.entries(order.paymentMethods).map(([method, amount]) => {
                const isComplementary = isComplementaryPayment(method);
                return [`${method}${isComplementary ? ' (Complementary)' : ''}`, `${amount}`];
              });
          doc.autoTable({
            startY: yPos,
            head: [["Payment Method", "Amount"]],
            body: paymentData,
            margin: { left: 10 },
            tableWidth: 190
          });
          yPos = doc.lastAutoTable.finalY + 20;
        }
      } else {
        // Regular order section
        doc.text(`Order Details - ${order.orderId}`, 10, yPos);
        yPos += 10;
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Customer: ${order.name || 'N/A'}`, 10, yPos);
        doc.text(`Table: ${order.tableName || 'N/A'}`, 80, yPos);
        doc.text(`Date: ${formatDate(order.createdAt)}`, 150, yPos);
        yPos += 7;
        doc.text(`Time: ${formatTime(order.createdAt)}`, 10, yPos);
        yPos += 7;
        if (institution === "bhuk2323") {
          doc.text(`Phone: ${order.phoneNumber || "N/A"}`, 10, yPos);
          yPos += 7;
        }
        doc.text(`Source: ${getOrderSource(order)}`, 10, yPos);
        yPos += 7;
        doc.text(`Payment Method: ${formatPaymentMethod(order)}`, 10, yPos);
        yPos += 7;
        doc.text(`Total Amount: ${orderRevenue}`, 10, yPos); // Use revenue for consistency
        doc.text(`Revenue Amount: ${orderRevenue}`, 80, yPos);
        yPos += 7;
        doc.text(`Discount Amount: ${order.discountAmount || 0}`, 10, yPos);
        doc.text(`Discount %: ${order.discountPercentage || 0}%`, 80, yPos);
        doc.text(`Subtotal: ${order.subtotal || 0}`, 150, yPos);
        yPos += 7;
        if (order.cgst || order.sgst || order.serviceTax) {
          if (order.cgst) {
            const afterDiscountAmount = (order.subtotal || 0) - (order.discountAmount || 0);
            doc.text(`CGST: ${order.cgst}% (${(afterDiscountAmount * (order.cgst / 100)).toFixed(2)})`, 10, yPos);
            yPos += 7;
          }
          if (order.sgst) {
            const afterDiscountAmount = (order.subtotal || 0) - (order.discountAmount || 0);
            doc.text(`SGST: ${order.sgst}% (${(afterDiscountAmount * (order.sgst / 100)).toFixed(2)})`, 10, yPos);
            yPos += 7;
          }
          if (order.serviceTax) {
            doc.text(`Service Tax: ${order.serviceTax}`, 10, yPos);
            yPos += 7;
          }
        }
        yPos += 5;
        if (order.items && Array.isArray(order.items) && order.items.length > 0) {
          doc.autoTable({
            startY: yPos,
            head: [["Item Name", "Quantity", "Price", "Total"]],
            body: order.items.map((item) => [
              item.name || "N/A",
              item.quantity || 0,
              `${item.price || 0}`,
              `${(item.price * item.quantity) || 0}`
            ]),
            margin: { left: 10 },
            tableWidth: 190
          });
          yPos = doc.lastAutoTable.finalY + 10;
        }
        if (order.paymentMethods && typeof order.paymentMethods === 'object') {
          const paymentData = Array.isArray(order.paymentMethods)
            ? order.paymentMethods.map(pm => {
                const isComplementary = isComplementaryPayment(pm.method);
                return [`${pm.method}${isComplementary ? ' (Complementary)' : ''}`, `${pm.amount}`];
              })
            : Object.entries(order.paymentMethods).map(([method, amount]) => {
                const isComplementary = isComplementaryPayment(method);
                return [`${method}${isComplementary ? ' (Complementary)' : ''}`, `${amount}`];
              });
          doc.autoTable({
            startY: yPos,
            head: [["Payment Method", "Amount"]],
            body: paymentData,
            margin: { left: 10 },
            tableWidth: 190
          });
          yPos = doc.lastAutoTable.finalY + 20;
        }
      }
      if (index < orders.length - 1) {
        doc.setDrawColor(200);
        doc.line(10, yPos - 10, pageWidth - 10, yPos - 10);
        yPos += 10;
      }
    });
    doc.save(`${institutionData.companyName}_orders_with_items.pdf`);
  };
  const exportItemsReport = () => {
    const itemQuantities = {};
    orders.forEach((order) => {
      if (order.downloadLink) return;
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item) => {
          if (item.name) {
            itemQuantities[item.name] = (itemQuantities[item.name] || 0) + item.quantity;
          }
        });
      }
    });
    if (Object.keys(itemQuantities).length === 0) {
      alert("No items found for the selected filter criteria.");
      return;
    }
    const exportData = Object.keys(itemQuantities).map((itemName, index) => ({
      "Sl No": index + 1,
      "Item Name": itemName,
      "Total Quantity Sold": itemQuantities[itemName]
    }));
    const excelData = [
      { "Sl No": "", "Item Name": `${institutionData.companyName} Item Report`, "Total Quantity Sold": "" },
      ...exportData
    ];
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${institutionData.companyName} Items Report`);
    const maxWidth = 50;
    const colWidths = {};
    Object.keys(excelData[0]).forEach(key => {
      colWidths[key] = Math.min(
        Math.max(...excelData.map(row => row[key] ? row[key].toString().length : 0)),
        maxWidth
      );
    });
    worksheet["!cols"] = Object.keys(colWidths).map(key => ({ wch: colWidths[key] }));
    XLSX.writeFile(workbook, `${institutionData.companyName}_items_report.xlsx`);
    const doc = new jsPDF();
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.width;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    const title = `${institutionData.companyName} Item Report`;
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    if (filterType === "day") {
      doc.text(`Date: ${selectedDate.toLocaleDateString()}`, 10, yPos);
    } else if (filterType === "dateRange") {
      doc.text(`Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`, 10, yPos);
    } else if (filterType === "monthly") {
      doc.text(`Month: ${new Date(0, selectedMonth).toLocaleString("default", { month: "long" })} ${selectedYear}`, 10, yPos);
    } else if (filterType === "yearly") {
      doc.text(`Year: ${selectedYear}`, 10, yPos);
    } else {
      doc.text("All Orders", 10, yPos);
    }
    yPos += 10;
    doc.autoTable({
      startY: yPos,
      head: [["Sl No", "Item Name", "Total Quantity Sold"]],
      body: exportData.map((row) => [
        row["Sl No"],
        row["Item Name"],
        row["Total Quantity Sold"]
      ]),
      margin: { left: 10 },
      tableWidth: 190
    });
    doc.save(`${institutionData.companyName}_items_report.pdf`);
  };
  const isHotel = institutionData?.integration === "HOTEL" || institutionData?.hotel_integration === true || institutionData?.hotel_integration === "Yes";
  const head = [
    "Sl No",
    ...(isHotel ? ["Bill No"] : []),
    "Order ID",
    "Name",
    institution === "bhuk2323" ? "Phone Number" : null,
    "Table",
    "Order Source",
    "Payment Method",
    "Amount",
    "Revenue",
    "Discount",
    "Subtotal",
    "Date",
    "Actions"
  ].filter(item => item !== null);
  return (
    <>
      <div className="w-full p-4 sm:p-6 lg:p-8 bg-gray-100">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl mb-6 lg:mb-8 font-bold text-gray-900 text-center">
          {institutionData.companyName} Item Report
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 sm:p-6 rounded-lg shadow-md text-white">
            <h3 className="text-sm sm:text-lg font-semibold">Total Amount</h3>
            <p className="text-xl sm:text-2xl font-bold">₹{totalAmount}</p>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 sm:p-6 rounded-lg shadow-md text-white">
            <h3 className="text-sm sm:text-lg font-semibold">Net Revenue</h3>
            <p className="text-xl sm:text-2xl font-bold">₹{netRevenue}</p>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 sm:p-6 rounded-lg shadow-md text-white">
            <h3 className="text-sm sm:text-lg font-semibold">Total Orders</h3>
            <p className="text-xl sm:text-2xl font-bold">{totalOrders}</p>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 sm:p-6 rounded-lg shadow-md text-white">
            <h3 className="text-sm sm:text-lg font-semibold">Avg Order Size</h3>
            <p className="text-xl sm:text-2xl font-bold">₹{avgOrderSize}</p>
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-4 mb-4 bg-white p-4 rounded-lg shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
            <label className="text-gray-700 whitespace-nowrap text-sm font-medium">Filter By:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border rounded p-2 w-full sm:w-auto min-w-[120px]"
            >
              <option value="day">Day</option>
              <option value="dateRange">Date Range</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="showAll">Show All</option>
            </select>
          </div>
          {filterType === "day" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
              <label className="text-gray-700 whitespace-nowrap text-sm font-medium">Select Date:</label>
              <div className="relative w-full sm:w-auto">
                <button
                  onClick={() => setShowDayPicker(!showDayPicker)}
                  className="border rounded p-2 bg-white w-full sm:w-auto min-w-[140px] text-left"
                >
                  {selectedDate.toLocaleDateString()}
                </button>
                {showDayPicker && (
                  <div className="absolute z-20 mt-1 bg-white shadow-lg rounded-lg left-0 right-0 sm:left-auto">
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => handleDateSelection(date, setSelectedDate, setShowDayPicker)}
                      fromDate={getDateLimits().minDate}
                      toDate={getDateLimits().maxDate}
                      className="p-3"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          {filterType === "dateRange" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0">
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-gray-700 text-sm font-medium">Start Date:</label>
                <div className="relative">
                  <button
                    onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                    className="border rounded p-2 bg-white w-full sm:w-auto min-w-[140px] text-left"
                  >
                    {startDate.toLocaleDateString()}
                  </button>
                  {showStartDatePicker && (
                    <div className="absolute z-20 mt-1 bg-white shadow-lg rounded-lg left-0 right-0 sm:left-auto min-w-[280px]">
                      <DayPicker
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => handleDateSelection(date, setStartDate, setShowStartDatePicker)}
                        fromDate={getDateLimits().minDate}
                        toDate={getDateLimits().maxDate}
                        className="p-3"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label className="text-gray-700 text-sm font-medium">End Date:</label>
                <div className="relative">
                  <button
                    onClick={() => setShowEndDatePicker(!showEndDatePicker)}
                    className="border rounded p-2 bg-white w-full sm:w-auto min-w-[140px] text-left"
                  >
                    {endDate.toLocaleDateString()}
                  </button>
                  {showEndDatePicker && (
                    <div className="absolute z-20 mt-1 bg-white shadow-lg rounded-lg left-0 right-0 sm:left-auto min-w-[280px]">
                      <DayPicker
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => handleDateSelection(date, setEndDate, setShowEndDatePicker)}
                        fromDate={Math.max(startDate, getDateLimits().minDate)}
                        toDate={getDateLimits().maxDate}
                        className="p-3"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {filterType === "monthly" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
                <label className="text-gray-700 whitespace-nowrap text-sm font-medium">Month:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="border rounded p-2 w-full sm:w-auto min-w-[120px]"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {new Date(0, i).toLocaleString("default", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
                <label className="text-gray-700 whitespace-nowrap text-sm font-medium">Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="border rounded p-2 w-full sm:w-auto min-w-[100px]"
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i} value={new Date().getFullYear() - i}>
                      {new Date().getFullYear() - i}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {filterType === "yearly" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
              <label className="text-gray-700 whitespace-nowrap text-sm font-medium">Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="border rounded p-2 w-full sm:w-auto min-w-[100px]"
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={new Date().getFullYear() - i}>
                    {new Date().getFullYear() - i}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 min-w-0">
            <div className="flex flex-col sm:flex-row gap-2 min-w-0">
              <Button
                onClick={exportToExcel}
                disabled={orders.length === 0}
                className="bg-green-500 w-full sm:w-auto min-w-[140px]"
              >
                Export to Excel
              </Button>
              <Button
                onClick={exportToPDF}
                disabled={orders.length === 0}
                className="bg-blue-500 w-full sm:w-auto min-w-[140px]"
              >
                Export to PDF
              </Button>
              <Button
                onClick={exportItemsReport}
                disabled={orders.length === 0}
                className="bg-purple-500"
              >
                Export Items Report
              </Button>
            </div>
          </div>
        </div>
        {orders.length === 0 ? (
          <div className="text-center text-gray-600">No data available</div>
        ) : screenWidth > 1025 ? (
          <PaginatedTable
            head={head}
            data={orders.map((obj, index) => {
              const isSummary = obj.downloadLink !== undefined;
              const orderRevenue = getRevenueFromOrder(obj);
              if (isSummary) {
                return [
                  index + 1,
                  ...(isHotel ? ["-"] : []),
                  obj.orderId,
                  "Monthly Summary",
                  institution === "bhuk2323" ? "N/A" : null,
                  "N/A",
                  getOrderSource(obj),
                  formatPaymentMethod(obj),
                  `₹${orderRevenue}`, // Use revenue for Amount column
                  `₹${orderRevenue}`,
                  `₹${obj.discountAmount || 0} (${obj.discountPercentage || 0}%)`,
                  `₹${obj.subtotal || 0}`,
                  formatDate(obj.createdAt),
                  <div className="flex gap-2">
                    <Button
                      onClick={() => window.open(obj.downloadLink, "_blank")}
                      disabled={!obj.downloadLink}
                      className="bg-green-500"
                    >
                      Download
                    </Button>
                  </div>,
                ].filter(item => item !== null);
              }
              return [
                index + 1,
                ...(isHotel ? [obj.billNo || obj.billNumber || "-"] : []),
                obj.orderId,
                obj.name,
                institution === "bhuk2323" ? obj.phoneNumber || "N/A" : null,
                obj.tableName,
                getOrderSource(obj),
                formatPaymentMethod(obj),
                `₹${orderRevenue}`, // Use revenue for Amount column
                `₹${orderRevenue}`,
                `₹${obj.discountAmount || 0} (${obj.discountPercentage || 0}%)`,
                `₹${obj.subtotal || 0}`,
                formatDate(obj.createdAt),
                <div className="flex gap-2">
                  <Button
                    onClick={() => openOrderDetails(obj)}
                    className="bg-primaryColor"
                  >
                    <FaEye />
                  </Button>
                  <Button
                    onClick={() => openEditModal(obj)}
                    className="bg-yellow-500"
                  >
                    <FaEdit />
                  </Button>
                  <Button
                    onClick={() => handlePrintBill(obj)}
                    className="bg-blue-500"
                  >
                    <RiBillLine />
                  </Button>
                </div>,
              ].filter(item => item !== null);
            })}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => {
              const isSummary = order.downloadLink !== undefined;
              const orderRevenue = getRevenueFromOrder(order);
              if (isSummary) {
                return (
                  <div
                    key={order.orderId}
                    className="relative rounded-lg shadow-lg overflow-hidden p-4 flex flex-col justify-between h-full bg-white"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h2 className="text-lg font-semibold text-gray-800">
                        Monthly Summary
                      </h2>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => window.open(order.downloadLink, "_blank")}
                          disabled={!order.downloadLink}
                          className="bg-green-500"
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">Month:</span> {order.orderId}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">Total Amount:</span> ₹{orderRevenue} {/* Use revenue */}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-semibold">Revenue:</span> ₹{orderRevenue}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      <span className="font-semibold">Payment:</span> {formatPaymentMethod(order)}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      <span className="font-semibold">Source:</span> {getOrderSource(order)}
                    </div>
                    <div className="text-xs text-gray-600">
                      <span className="font-semibold">Date:</span>{" "}
                      <span className="font-bold">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={order.orderId}
                  className="relative rounded-lg shadow-lg overflow-hidden p-4 flex flex-col justify-between h-full bg-white"
                >
                  <div className="flex justify-between items-center mb-1">
                    <h2 className="text-lg font-semibold text-gray-800">
                      {order.name} {(order.billNo || order.billNumber) && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono">Bill #{order.billNo || order.billNumber}</span>}
                    </h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openOrderDetails(order)}
                        className="text-primaryColor text-lg"
                      >
                        <FaEye />
                      </button>
                      <button
                        onClick={() => openEditModal(order)}
                        className="text-yellow-500 text-lg"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handlePrintBill(order)}
                        className="text-blue-500 text-lg"
                      >
                        <RiBillLine />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <div>
                      <span className="font-semibold text-xs">Table:</span>{" "}
                      {order.tableName}
                    </div>
                    <div>
                      <span className="text-xs font-semibold">Total Amount:</span>{" "}
                      ₹{orderRevenue} {/* Use revenue */}
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <div>
                      <span className="text-xs font-semibold">Revenue:</span>{" "}
                      ₹{orderRevenue}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    <span className="font-semibold">Discount:</span>{" "}
                    ₹{order.discountAmount || 0} ({order.discountPercentage || 0}%)
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    <span className="font-semibold">Subtotal:</span>{" "}
                    ₹{order.subtotal || 0}
                  </div>
                  {institution === "bhuk2323" && (
                    <div className="text-xs text-gray-600 mb-2">
                      <span className="font-semibold">Phone:</span>{" "}
                      {order.phoneNumber || "N/A"}
                    </div>
                  )}
                  <div className="text-xs text-gray-600 mb-2">
                    <span className="font-semibold">Payment:</span>{" "}
                    {formatPaymentMethod(order)}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    <span className="font-semibold">Source:</span> {getOrderSource(order)}
                  </div>
                  {userData.userType === "admin" && order.chefId && (
                    <div className="text-xs text-gray-600 mb-2">
                      <span className="font-semibold">Chef:</span>{" "}
                      {chefNames[order.chefId]
                        ? chefNames[order.chefId]
                        : "Chef Not Found"}
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-2">
                    <div
                      className={`${
                        order.status === "ready"
                          ? "bg-green-500"
                          : order.status === "pending"
                          ? "bg-red-500"
                          : order.status === "preparing"
                          ? "bg-blue-500"
                          : order.status === "delivered"
                          ? "bg-purple-500"
                          : "bg-gray-500"
                      } text-white text-xs font-semibold px-3 py-1 rounded-full`}
                    >
                      {order.status}
                    </div>
                    <div className="text-xs text-gray-600">
                      <span className="font-semibold">Date:</span>{" "}
                      <span className="font-bold">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <OrderDetailsModal
          show={showOrderModal}
          onClose={closeOrderModal}
          orderItems={selectedOrderItems}
          order={selectedOrder} // optional: modal can use .orderSource if desired
        />
        {showPrintBill && selectedPrintOrder && (
          <PrintOrderHistoryBill
            order={{
              orderId: selectedPrintOrder.orderId,
              billNo: selectedPrintOrder.billNo || selectedPrintOrder.billNumber,
              tableName: selectedPrintOrder.tableName,
              items: selectedPrintOrder.items || [],
              createdAt: selectedPrintOrder.createdAt,
              phoneNumber: institution === "bhuk2323" ? selectedPrintOrder.phoneNumber || "N/A" : undefined,
              paymentMethods: selectedPrintOrder.paymentMethods,
              orderSource: getOrderSource(selectedPrintOrder), // include source
              discountAmount: selectedPrintOrder.discountAmount || 0,
              discountPercentage: selectedPrintOrder.discountPercentage || 0,
            }}
            institutionData={institutionData}
            screenWidth={screenWidth}
            onClose={() => setShowPrintBill(false)}
          />
        )}
        {showEditModal && selectedEditOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Edit Order Details</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Original Subtotal: ₹{originalSubtotal.toFixed(2)}</label>
              </div>
              {/* Discount Section */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Discount Type:</label>
                <div className="flex gap-2 mb-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="amount"
                      checked={editDiscountType === 'amount'}
                      onChange={(e) => {
                        setEditDiscountType(e.target.value);
                        if (e.target.value === 'amount') {
                          setEditDiscountPercentage(0);
                        }
                      }}
                      className="mr-1"
                    />
                    Amount
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="percentage"
                      checked={editDiscountType === 'percentage'}
                      onChange={(e) => {
                        setEditDiscountType(e.target.value);
                        if (e.target.value === 'percentage') {
                          setEditDiscountAmount(0);
                        }
                      }}
                      className="mr-1"
                    />
                    Percentage
                  </label>
                </div>
                {editDiscountType === 'amount' ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={originalSubtotal}
                    value={editDiscountAmount}
                    onChange={(e) => setEditDiscountAmount(Number(e.target.value) || 0)}
                    className="border rounded p-2 w-full"
                    placeholder="Discount Amount"
                  />
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editDiscountPercentage}
                    onChange={(e) => setEditDiscountPercentage(Number(e.target.value) || 0)}
                    className="border rounded p-2 w-full"
                    placeholder="Discount Percentage"
                  />
                )}
                <p className="text-sm text-gray-600 mt-1">Discount Total: ₹{discountTotal.toFixed(2)}</p>
              </div>
              {/* Tax Breakdown */}
              {selectedEditOrder && (
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <label className="block text-sm font-medium mb-2">Tax Breakdown:</label>
                  {(() => {
                    const orderItems = selectedEditOrder?.items || [];
                    const taxCalc = calculateTaxesForOrder(originalSubtotal, discountTotal, orderItems);
                    return (
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Subtotal after discount: ₹{(originalSubtotal - discountTotal).toFixed(2)}</div>
                        {taxCalc.taxableAmount !== undefined && (
                          <>
                            <div>Taxable amount: ₹{taxCalc.taxableAmount.toFixed(2)}</div>
                            {taxCalc.nonTaxableAmount > 0 && <div>Non-taxable amount: ₹{taxCalc.nonTaxableAmount.toFixed(2)}</div>}
                          </>
                        )}
                        {taxCalc.cgst > 0 && <div>CGST ({institutionData?.cgst || 0}%): ₹{taxCalc.cgst.toFixed(2)}</div>}
                        {taxCalc.sgst > 0 && <div>SGST ({institutionData?.sgst || 0}%): ₹{taxCalc.sgst.toFixed(2)}</div>}
                        {taxCalc.serviceTax > 0 && <div>Service Tax ({institutionData?.serviceTax || 0}%): ₹{taxCalc.serviceTax.toFixed(2)}</div>}
                        <div className="font-medium pt-1 border-t">Total Tax: ₹{taxCalc.totalTax.toFixed(2)}</div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {/* Payment Methods Section */}
              <div className="mb-4 max-h-60 overflow-y-auto">
                {editPaymentMethods.map((pm, index) => (
                  <div key={index} className="flex items-center gap-2 mb-3 p-3 border rounded">
                    <select
                      value={pm.method}
                      onChange={(e) => handlePaymentMethodChange(index, 'method', e.target.value)}
                      className="border rounded p-2 flex-1"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="QR">QR</option>
                      <option value="Complementary">Complementary</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pm.amount}
                      onChange={(e) => handlePaymentMethodChange(index, 'amount', e.target.value)}
                      className="border rounded p-2 w-24 text-right"
                      placeholder="0.00"
                    />
                    <Button
                      onClick={() => handleRemovePaymentMethod(index)}
                      size="xs"
                      color="failure"
                    >
                      <FaTrash />
                    </Button>
                  </div>
                ))}
                {editPaymentMethods.length < 5 && ( // Limit to 5 for simplicity
                  <Button
                    onClick={handleAddPaymentMethod}
                    className="w-full mb-2"
                    color="gray"
                  >
                    <FaPlus className="mr-2" /> Add Payment Method
                  </Button>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">New Order Total: ₹{orderTotal.toFixed(2)}</label>
                <label className="block text-sm font-medium mb-1">Payment Total: ₹{paymentTotal.toFixed(2)}</label>
                {!isTotalValid && (
                  <p className="text-red-500 text-sm">Payment total does not match order total!</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={closeEditModal} color="gray">
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateOrder}
                  disabled={!isTotalValid || editPaymentMethods.length === 0}
                  color="blue"
                >
                  Update
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
export default OrderHistory;