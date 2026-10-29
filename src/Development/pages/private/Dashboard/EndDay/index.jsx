import React, { useContext, useState, useEffect } from "react";
import { Context } from "../../../../Context";
import { API } from "aws-amplify";
import { toast } from "react-toastify";

const EndDay = () => {
  const { institutionData, setLoader } = useContext(Context);
  const [allOrders, setAllOrders] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [leftSideData, setLeftSideData] = useState({});
  const [rightSideSections, setRightSideSections] = useState([]);
  const [reportSaved, setReportSaved] = useState(false);
  const [previousDayData, setPreviousDayData] = useState(null);

  // Utility functions for stock report
  const dateToKey = (isoDate) => {
    const d = new Date(isoDate);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}${mm}${dd}`;
  };

  const safeNum = (val) => {
    if (val == null) return 0;
    if (typeof val === "number") return val;
    const m = String(val).match(/-?[\d,.]+/);
    if (!m) return 0;
    return Number(String(m[0]).replace(/,/g, "")) || 0;
  };

  const parseVolumeToMl = (str) => {
    if (!str && str !== 0) return 0;
    if (typeof str === "number") return str;
    const s = String(str).trim().toLowerCase();
    if (s.includes("piece")) return Number(s.match(/([\d,.]+)/)?.[1] || 1);
    const nMatch = s.match(/([\d,.]+)/);
    if (!nMatch) return 0;
    let num = Number(nMatch[1].replace(/,/g, ""));
    if (s.includes("l") && !s.includes("ml")) {
      num = num * 1000;
    } else if (s.includes("ml")) {
      // num stays
    } else if (s.includes("kg")) {
      num = num * 1000;
    } else if (s.includes("g")) {
      // num stays
    }
    return Math.round(num);
  };

  const formatBottlesMl = (mlTotal, oneBottleMl) => {
    const bottleSize = oneBottleMl > 0 ? oneBottleMl : 1000;
    const bottles = Math.floor(mlTotal / bottleSize);
    const remainder = mlTotal - bottles * bottleSize;
    return { bottles, remainder };
  };

  useEffect(() => {
    if (institutionData?.institution) {
      initializeEndDayData();
    }
  }, [institutionData, selectedDate]);

  const fetchStockData = async () => {
    try {
      if (!institutionData?.institution) return [];
      const response = await API.get(
        "main",
        `/admin/stock-list-items/${institutionData.institution}`
      );
      return response || [];
    } catch (error) {
      console.error("Error fetching stock data:", error);
      return [];
    }
  };

  const initializeEndDayData = async () => {
    try {
      setLoading(true);

      const [ordersData, previousData, stockData] = await Promise.all([
        fetchOrdersData(),
        fetchPreviousDayData(),
        fetchStockData(),
      ]);

      setStocks(stockData);
      calculateLeftSideData(ordersData, selectedDate, previousData);
      loadRightSideSections();
    } catch (error) {
      console.error("Error initializing end day data:", error);
      toast.error("Failed to load end day data");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrdersData = async () => {
    const type = institutionData?.bar_integration === "Yes" ? "bar" : "cafe";
    const result = await API.get(
      "main",
      `/admin/list-orders/${institutionData.institution}?type=${type}`,
      {}
    );

    const paidOrders = (result || []).filter(
      (order) => order.paymentStatus === true
    );
    setAllOrders(paidOrders);
    return paidOrders;
  };

  const fetchPreviousDayData = async () => {
    try {
      const previousDate = new Date(selectedDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const prevDateStr = previousDate.toISOString().slice(0, 10);

      const previousDay = await API.get(
        "main",
        `/admin/end-day-report/${institutionData.institution}?date=${prevDateStr}`,
        {}
      );
      setPreviousDayData(previousDay);
      return previousDay;
    } catch (error) {
      console.log("No previous day data found");
      return null;
    }
  };

  const loadRightSideSections = () => {
    setRightSideSections([
      {
        heading: "PAYMENTS",
        entries: [
          { name: "CASH TO OWNER", value: 0 },
          { name: "OFFICE DEPOSIT", value: 0 },
          { name: "OTHER EXP.", value: 0 },
        ],
      },
    ]);
  };

  const calculateLeftSideData = (orders, date, previousData) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const ordersForDate = orders.filter((order) => {
      const created = Number(order.createdAt) || 0;
      return created >= dayStart.getTime() && created < dayEnd.getTime();
    });

    let totalBilledAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalServiceTax = 0;
    let totalBarAmount = 0;
    let totalKitchenAmount = 0;
    let totalBeverageAmount = 0;
    let totalPayments = {};

    const channels = {
      restaurant: { label: "Restaurant", orders: 0, revenue: 0 },
      roomService: { label: "Room Service", orders: 0, revenue: 0 },
      zomato: { label: "Zomato", orders: 0, revenue: 0 },
      swiggy: { label: "Swiggy", orders: 0, revenue: 0 },
      banquet: { label: "Banquet Hall", orders: 0, revenue: 0 },
      boardRoom: { label: "Board Room", orders: 0, revenue: 0 },
    };

    ordersForDate.forEach((order) => {
      const amount = Number(order.totalAmount) || 0;
      totalBilledAmount += amount;
      totalCgst += Number(order.cgst) || 0;
      totalSgst += Number(order.sgst) || 0;
      totalServiceTax += Number(order.serviceTax) || 0;

      const payMethod = (
        order.paymentMethod ||
        order.paymentMode ||
        "Cash"
      ).toLowerCase();
      totalPayments[payMethod] = (totalPayments[payMethod] || 0) + amount;

      const tbl = String(order.tableName || order.table || "").toLowerCase();
      const src = String(order.orderSource || order.source || order.orderSourceGroup || "").toLowerCase();
      const billNo = String(order.billNo || order.bill_no || order.orderId || "").toUpperCase();

      if (tbl.includes("room") || tbl.includes("hotel") || src.includes("room") || tbl.startsWith("rm")) {
        channels.roomService.orders += 1;
        channels.roomService.revenue += amount;
      } else if (tbl.startsWith("zomato") || src.includes("zomato") || billNo.startsWith("ZM_") || billNo.startsWith("ZOMATO")) {
        channels.zomato.orders += 1;
        channels.zomato.revenue += amount;
      } else if (tbl.startsWith("swiggy") || src.includes("swiggy") || billNo.startsWith("SW_") || billNo.startsWith("SWIGGY")) {
        channels.swiggy.orders += 1;
        channels.swiggy.revenue += amount;
      } else if (tbl.includes("banquet") || src.includes("banquet")) {
        channels.banquet.orders += 1;
        channels.banquet.revenue += amount;
      } else if (tbl.includes("board") || src.includes("board") || tbl.includes("conference")) {
        channels.boardRoom.orders += 1;
        channels.boardRoom.revenue += amount;
      } else {
        channels.restaurant.orders += 1;
        channels.restaurant.revenue += amount;
      }

      (order.items || []).forEach((item) => {
        const itemAmount =
          (Number(item.price) || 0) * (Number(item.quantity) || 0);
        const itemType = String(item.type || "").toLowerCase();
        const itemCategory = String(item.category || "").toLowerCase();

        if (itemType === "bar") {
          totalBarAmount += itemAmount;
        } else if (itemType === "cafe" || itemType === "kitchen") {
          if (itemCategory !== "beverage") {
            totalKitchenAmount += itemAmount;
          } else {
            totalBeverageAmount += itemAmount;
          }
        }
      });
    });

    const totalTax = totalCgst + totalSgst + totalServiceTax;
    const totalReceiptsAmount = totalBarAmount + totalKitchenAmount + totalBeverageAmount + totalTax;

    const openingBalance = previousData?.closingBalance || 0;
    const averageSales = calculateAverageSales(orders, date);

    setLeftSideData({
      openingBalance: openingBalance,
      averageSales: averageSales,
      kitchenSales: totalKitchenAmount,
      beverageSales: totalBeverageAmount,
      barSales: totalBarAmount,
      sgst: totalSgst,
      cgst: totalCgst,
      serviceTax: totalServiceTax,
      totalSales: totalBilledAmount,
      totalTax: totalTax,
      grandTotal: totalReceiptsAmount,
      paymentBreakdown: totalPayments,
      orderCount: ordersForDate.length,
      channels: channels,
      date: date,
    });
  };

  const calculateAverageSales = (allOrders, currentDate) => {
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const currentDayStart = new Date(currentDate);
    currentDayStart.setHours(0, 0, 0, 0);

    const historicalOrders = allOrders.filter((order) => {
      const orderDate = new Date(Number(order.createdAt));
      return orderDate >= thirtyDaysAgo && orderDate < currentDayStart;
    });

    if (historicalOrders.length === 0) return 0;

    const dailyTotals = {};
    historicalOrders.forEach((order) => {
      const dateKey = new Date(Number(order.createdAt)).toDateString();
      if (!dailyTotals[dateKey]) {
        dailyTotals[dateKey] = 0;
      }
      dailyTotals[dateKey] += Number(order.totalAmount) || 0;
    });

    const totalSales = Object.values(dailyTotals).reduce(
      (sum, daily) => sum + daily,
      0
    );
    const numberOfDays = Object.keys(dailyTotals).length;

    return numberOfDays > 0 ? totalSales / numberOfDays : 0;
  };

  const buildStockReportData = (isoDate, stocks, typeFilter = "bar") => {
    const key = dateToKey(isoDate);
    const saleSizes = new Set(["60 ml", "30 ml"]);
    const rateSizes = new Set();
    const groups = {};

    stocks
      .filter((s) => s.type === typeFilter)
      .forEach((stock) => {
        const update = (stock.stockupdate || {})[key] || {};
        Object.keys(update || {}).forEach((k) => {
          if (k.startsWith("unitRate_")) {
            rateSizes.add(k.replace("unitRate_", ""));
          } else if (
            ![
              "openingStock",
              "opening",
              "open",
              "received",
              "transferred",
            ].includes(k)
          ) {
            saleSizes.add(k);
          }
        });

        const cat = stock.category || "UNCATEGORISED";
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push({ stock, update });
      });

    const saleCols = Array.from(saleSizes).sort((a, b) => {
      const na = Number(String(a).match(/\d+/)?.[0] || 0);
      const nb = Number(String(b).match(/\d+/)?.[0] || 0);
      return nb - na || String(a).localeCompare(b);
    });
    const rateCols = Array.from(rateSizes).sort((a, b) => {
      const na = Number(String(a).match(/\d+/)?.[0] || 0);
      const nb = Number(String(b).match(/\d+/)?.[0] || 0);
      return na - nb || String(a).localeCompare(b);
    });

    const categories = [];
    let grandTotalAmount = 0;

    Object.keys(groups)
      .sort()
      .forEach((cat) => {
        const items = groups[cat].map(({ stock, update }) => {
          const hasUpdate = Object.keys(update).length > 0;
          const openingRaw = hasUpdate
            ? update.openingStock ?? update.opening ?? update.open ?? 0
            : stock.quantity ?? 0;
          const receivedRaw = update.received ?? 0;
          const transferredRaw = update.transferred ?? 0;

          const openingMl = parseVolumeToMl(openingRaw);
          const receivedMl = parseVolumeToMl(receivedRaw);
          const transferredMl = parseVolumeToMl(transferredRaw);
          const totalMl = openingMl + receivedMl;

          const sales = {};
          let salesVolumeMl = 0;
          saleCols.forEach((s) => {
            const cnt = safeNum(update[s] ?? 0);
            sales[s] = cnt;
            const num = Number(String(s).match(/\d+/)?.[0] || 0);
            if (num) salesVolumeMl += cnt * num;
          });

          let amount = 0;
          rateCols.forEach((r) => {
            const rate = safeNum(update[`unitRate_${r}`] ?? 0);
            const cnt = safeNum(update[r] ?? 0);
            amount += rate * cnt;
          });

          const closingMl = Math.max(0, totalMl - salesVolumeMl - transferredMl);
          const oneBottleMl = parseVolumeToMl(stock.oneBottleVolume || "1000 ml");
          const openingBTL = formatBottlesMl(openingMl, oneBottleMl);
          const receivedBTL = formatBottlesMl(receivedMl, oneBottleMl);
          const totalBTL = formatBottlesMl(totalMl, oneBottleMl);
          const transferredBTL = formatBottlesMl(transferredMl, oneBottleMl);
          const closingBTL = formatBottlesMl(closingMl, oneBottleMl);

          return {
            stockId: stock.stockId,
            stockName: stock.stockName || stock.name || "-",
            openingMl,
            receivedMl,
            totalMl,
            transferredMl,
            openingBTL,
            receivedBTL,
            totalBTL,
            transferredBTL,
            sales,
            unitRates: rateCols.reduce((acc, r) => {
              acc[r] = safeNum(update[`unitRate_${r}`] ?? 0);
              return acc;
            }, {}),
            amount,
            closingMl,
            closingBTL,
            oneBottleMl,
            oneBottleLabel: stock.oneBottleVolume || `${oneBottleMl} ml`,
          };
        });

        const catTotals = {
          openingMl: 0,
          receivedMl: 0,
          totalMl: 0,
          transferredMl: 0,
          sales: {},
          amount: 0,
          closingMl: 0,
          closingBottles: 0,
          closingRemainderMl: 0,
        };
        saleCols.forEach((s) => (catTotals.sales[s] = 0));

        items.forEach((it) => {
          catTotals.openingMl += safeNum(it.openingMl);
          catTotals.receivedMl += safeNum(it.receivedMl);
          catTotals.totalMl += safeNum(it.totalMl);
          catTotals.transferredMl += safeNum(it.transferredMl);
          saleCols.forEach((s) => {
            catTotals.sales[s] += safeNum(it.sales[s]);
          });
          catTotals.amount += safeNum(it.amount);
          catTotals.closingMl += safeNum(it.closingMl);
          catTotals.closingBottles += safeNum(it.closingBTL.bottles);
          catTotals.closingRemainderMl += safeNum(it.closingBTL.remainder);
        });

        const oneBottleMl = items.length > 0 ? items[0].oneBottleMl : 1000;
        catTotals.openingBTL = formatBottlesMl(catTotals.openingMl, oneBottleMl);
        catTotals.receivedBTL = formatBottlesMl(catTotals.receivedMl, oneBottleMl);
        catTotals.totalBTL = formatBottlesMl(catTotals.totalMl, oneBottleMl);
        catTotals.transferredBTL = formatBottlesMl(catTotals.transferredMl, oneBottleMl);
        catTotals.closingBTL = {
          bottles: catTotals.closingBottles,
          remainder: catTotals.closingRemainderMl,
        };

        grandTotalAmount += catTotals.amount;
        categories.push({ category: cat, items, totals: catTotals });
      });

    return { categories, saleCols, rateCols, grandTotalAmount };
  };

  // Section management functions
  const addNewSection = () => {
    const newSection = {
      heading: "NEW SECTION",
      entries: [{ name: "", value: 0 }],
    };
    setRightSideSections([...rightSideSections, newSection]);
  };

  const updateSectionHeading = (sectionIndex, newHeading) => {
    const updatedSections = [...rightSideSections];
    updatedSections[sectionIndex].heading = newHeading;
    setRightSideSections(updatedSections);
  };

  const removeSection = (sectionIndex) => {
    if (rightSideSections.length > 1) {
      setRightSideSections(
        rightSideSections.filter((_, index) => index !== sectionIndex)
      );
    }
  };

  const addEntryToSection = (sectionIndex) => {
    const updatedSections = [...rightSideSections];
    updatedSections[sectionIndex].entries.push({ name: "", value: 0 });
    setRightSideSections(updatedSections);
  };

  const updateEntry = (sectionIndex, entryIndex, field, value) => {
    const updatedSections = [...rightSideSections];
    if (field === "value") {
      updatedSections[sectionIndex].entries[entryIndex][field] =
        Number(value) || 0;
    } else {
      updatedSections[sectionIndex].entries[entryIndex][field] = value;
    }
    setRightSideSections(updatedSections);
  };

  const removeEntry = (sectionIndex, entryIndex) => {
    const updatedSections = [...rightSideSections];
    if (updatedSections[sectionIndex].entries.length > 1) {
      updatedSections[sectionIndex].entries = updatedSections[
        sectionIndex
      ].entries.filter((_, index) => index !== entryIndex);
      setRightSideSections(updatedSections);
    }
  };

  const loadExistingReport = async (date) => {
    try {
      const existingReport = await API.get(
        "main",
        `/admin/end-day-report/${institutionData.institution}?date=${date}`,
        {}
      );

      if (existingReport) {
        setLeftSideData(existingReport.leftSideData);
        setRightSideSections(existingReport.rightSideSections || []);
        setReportSaved(true);
        toast.info("Loaded existing report for this date");
      }
    } catch (error) {
      console.log("No existing report found for this date");
    }
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    resetReportState();
    loadExistingReport(newDate);
  };

  const resetReportState = () => {
    setReportSaved(false);
    if (institutionData?.institution) {
      initializeEndDayData();
    }
  };

  const handleSaveReport = async () => {
    try {
      setLoader(true);

      const rightSideTotal = rightSideSections.reduce((sectionSum, section) => {
        const sectionTotal = section.entries.reduce(
          (entrySum, entry) => entrySum + (Number(entry.value) || 0),
          0
        );
        return sectionSum + sectionTotal;
      }, 0);

      const closingBalance = (leftSideData.grandTotal || 0) - rightSideTotal;

      const reportData = {
        dayStart: false,
        type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        leftSideData: { ...leftSideData, date: selectedDate },
        rightSideSections: rightSideSections.filter((section) =>
          section.entries.some((entry) => entry.name.trim() !== "")
        ),
        closingBalance,
        savedAt: new Date().toISOString(),
        savedBy: institutionData.userData?.userName || "Admin",
      };

      await API.post(
        "main",
        `/admin/end-day-report/${institutionData.institution}`,
        {
          body: reportData,
        }
      );

      setReportSaved(true);
      toast.success("End day report saved successfully!");
      return true;
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error(
        "Failed to save report: " + (error.message || "Unknown error")
      );
      return false;
    } finally {
      setLoader(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!reportSaved) {
      const saved = await handleSaveReport();
      if (!saved) {
        toast.warning("Unable to save report. Cannot download.");
        return;
      }
    }

    const reportContent = generateReportHTML();
    const printWindow = window.open("", "_blank");
    printWindow.document.write(reportContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const generateReportHTML = () => {
    const rightSideTotal = rightSideSections.reduce((sectionSum, section) => {
      const sectionTotal = section.entries.reduce(
        (entrySum, entry) => entrySum + (Number(entry.value) || 0),
        0
      );
      return sectionSum + sectionTotal;
    }, 0);
    const finalClosingBalance = (leftSideData.grandTotal || 0) - rightSideTotal;

    const stockReportData = buildStockReportData(selectedDate, stocks);

    const currentTime = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true,
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const formattedDate = selectedDate.split('-').reverse().join('/');

    return `
      <html>
        <head>
          <title>End Day Report - ${leftSideData.date}</title>
          <style>
            @page {
              margin: 8mm;
              size: A4;
            }
            
            * {
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Times New Roman', serif;
              font-size: 10px;
              line-height: 1.1;
              color: #000;
              background: white;
              margin: 0;
              padding: 0;
            }
            
            .report-container {
              max-width: 200mm;
              margin: 0 auto;
              padding: 5mm;
            }
            
            .header-section {
              text-align: center;
              margin-bottom: 8mm;
              padding-bottom: 3mm;
              border-bottom: 1px solid #000;
            }
            
            .company-name {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 1mm;
              letter-spacing: 0.5px;
            }
            
            .report-title {
              font-size: 11px;
              font-weight: bold;
              margin: 1mm 0;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            
            .date-section {
              font-size: 9px;
              margin: 1mm 0;
              color: #333;
            }
            
            .main-content {
              display: flex;
              justify-content: space-between;
              margin: 2mm 0;
              gap: 5mm;
            }
            
            .content-column {
              flex: 1;
            }
            
            .section-header {
              font-size: 11px;
              font-weight: bold;
              margin: 0 0 2mm 0;
              padding-bottom: 0.5mm;
              border-bottom: 1px solid #000;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            
            .amount-row {
              display: flex;
              justify-content: space-between;
              margin: 0.5mm 0;
              padding: 0.5mm 0;
            }
            
            .amount-label {
              font-size: 10px;
              text-align: left;
              flex: 2;
            }
            
            .amount-value {
              font-size: 10px;
              text-align: right;
              flex: 1;
              font-family: 'Courier New', monospace;
            }
            
            .total-row {
              border-top: 1.5px solid #000;
              margin-top: 1mm;
              padding-top: 1mm;
              font-weight: bold;
              font-size: 11px;
            }
            
            .grand-total-row {
              border-top: 2px solid #000;
              margin-top: 3mm;
              padding-top: 1.5mm;
              font-weight: bold;
              font-size: 12px;
            }
            
            .closing-balance-section {
              margin-top: 5mm;
              padding-top: 3mm;
              border-top: 1.5px solid #000;
              text-align: center;
            }
            
            .closing-balance {
              font-size: 13px;
              font-weight: bold;
              letter-spacing: 0.5px;
            }
            
            .page-break {
              page-break-before: always;
            }
            
            .stock-report-header {
              text-align: center;
              margin-bottom: 5mm;
              padding-bottom: 2mm;
              border-bottom: 1px solid #000;
            }
            
            .stock-table {
              width: 100%;
              border-collapse: collapse;
              margin: 2mm 0;
              font-size: 8px;
            }
            
            .stock-table th,
            .stock-table td {
              border: 0.5px solid #000;
              padding: 1mm 0.3mm;
              text-align: center;
              vertical-align: middle;
            }
            
            .stock-table th {
              background-color: #f8f8f8;
              font-weight: bold;
              font-size: 7px;
              text-transform: uppercase;
              letter-spacing: 0.2px;
            }
            
            .stock-table .item-name {
              text-align: left;
              font-size: 8.5px;
              padding-left: 1.5mm;
              background-color: #fafafa;
            }
            
            .stock-table .amount-column {
              text-align: right;
              padding-right: 1mm;
              font-family: 'Courier New', monospace;
            }
            
            .category-header {
              background-color: #e0e0e0 !important;
              font-weight: bold;
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            
            .category-total {
              background-color: #d0d0d0 !important;
              font-weight: bold;
              font-size: 9px;
            }
            
            .grand-total-row-stock {
              background-color: #c8c8c8 !important;
              font-weight: bold;
              font-size: 10px;
              border-top: 1.5px solid #000;
              border-bottom: 1.5px solid #000;
            }
            
            .report-footer {
              margin-top: 5mm;
              padding-top: 3mm;
              border-top: 0.5px solid #ccc;
              text-align: center;
              font-size: 8px;
              color: #666;
            }
            
            .signature-section {
              margin-top: 5mm;
              display: flex;
              justify-content: space-between;
              font-size: 9px;
            }
            
            .signature-box {
              flex: 1;
              border-top: 0.5px solid #000;
              padding-top: 1.5mm;
              text-align: center;
              margin: 0 2mm;
            }
            
            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              
              .report-container {
                padding: 3mm;
              }
              
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <!-- First Page: Cashiering Report -->
            <div class="header-section">
              <div class="company-name">${
                institutionData?.companyName || "AMRAPALI TESTING"
              }</div>
              <div class="report-title">CASHIERING REPORT - ${
                institutionData?.companyName || "AMRAPALI TESTING"
              } BAR</div>
              <div class="date-section">
                Date: ${formattedDate} | Printed: ${currentTime}
              </div>
            </div>
            
            <div class="main-content">
              <div class="content-column">
                <div class="section-header">RECEIPTS</div>
                <div class="amount-row">
                  <div class="amount-label">BAR SALES</div>
                  <div class="amount-value">₹${
                    leftSideData.barSales?.toFixed(2) || "0.00"
                  }</div>
                </div>
                <div class="amount-row">
                  <div class="amount-label">KITCHEN SALES</div>
                  <div class="amount-value">₹${
                    leftSideData.kitchenSales?.toFixed(2) || "0.00"
                  }</div>
                </div>
                <div class="amount-row">
                  <div class="amount-label">BEVERAGE SALES</div>
                  <div class="amount-value">₹${
                    leftSideData.beverageSales?.toFixed(2) || "0.00"
                  }</div>
                </div>
                <div class="amount-row total-row">
                  <div class="amount-label">SUB TOTAL</div>
                  <div class="amount-value">₹${
                    (leftSideData.barSales + leftSideData.kitchenSales + leftSideData.beverageSales)?.toFixed(2) || "0.00"
                  }</div>
                </div>
                <div class="amount-row">
                  <div class="amount-label">SGST @ 2.5%</div>
                  <div class="amount-value">₹${
                    leftSideData.sgst?.toFixed(2) || "0.00"
                  }</div>
                </div>
                <div class="amount-row">
                  <div class="amount-label">CGST @ 2.5%</div>
                  <div class="amount-value">₹${
                    leftSideData.cgst?.toFixed(2) || "0.00"
                  }</div>
                </div>
                <div class="amount-row total-row">
                  <div class="amount-label">TOTAL RECEIPTS</div>
                  <div class="amount-value">₹${
                    leftSideData.grandTotal?.toFixed(2) || "0.00"
                  }</div>
                </div>
                
                <div style="margin-top: 3mm;">
                  <div class="section-header">PAYMENT METHODS</div>
                  ${Object.entries(leftSideData.paymentBreakdown || {})
                    .map(([method, amount]) => `
                    <div class="amount-row">
                      <div class="amount-label">${method.toUpperCase()}</div>
                      <div class="amount-value">₹${Number(amount).toFixed(2)}</div>
                    </div>
                  `)
                    .join("")}
                  <div class="amount-row total-row">
                    <div class="amount-label">TOTAL</div>
                    <div class="amount-value">₹${
                      leftSideData.totalSales?.toFixed(2) || "0.00"
                    }</div>
                  </div>
                </div>

                <div style="margin-top: 3mm;">
                  <div class="section-header">RESTAURANT CHANNELS (SAME DAY)</div>
                  ${leftSideData.channels ? Object.entries(leftSideData.channels).map(([key, ch]) => `
                    <div class="amount-row">
                      <div class="amount-label">${ch.label.toUpperCase()} (${ch.orders} orders)</div>
                      <div class="amount-value">₹${Number(ch.revenue || 0).toFixed(2)}</div>
                    </div>
                  `).join("") : ""}
                  <div class="amount-row total-row">
                    <div class="amount-label">TOTAL CHANNEL REVENUE</div>
                    <div class="amount-value">₹${
                      leftSideData.channels ? Object.values(leftSideData.channels).reduce((s, c) => s + (Number(c.revenue) || 0), 0).toFixed(2) : "0.00"
                    }</div>
                  </div>
                </div>
              </div>
              
              <div class="content-column">
                <div class="section-header">EXPENDITURES</div>
                ${rightSideSections
                  .map((section, sectionIndex) => `
                  <div style="margin-bottom: 2mm;">
                    <div style="font-weight: bold; font-size: 10px; margin-bottom: 1mm; padding-bottom: 0.3mm; border-bottom: 0.5px solid #ccc;">
                      ${section.heading}
                    </div>
                    ${section.entries
                      .filter((entry) => entry.name.trim() !== "")
                      .map((entry) => `
                      <div class="amount-row">
                        <div class="amount-label">${entry.name}</div>
                        <div class="amount-value">₹${Number(entry.value).toFixed(2)}</div>
                      </div>
                    `)
                      .join("")}
                    <div class="amount-row total-row">
                      <div class="amount-label">${section.heading} TOTAL</div>
                      <div class="amount-value">₹${section.entries
                        .reduce((sum, entry) => sum + (Number(entry.value) || 0), 0)
                        .toFixed(2)}</div>
                    </div>
                  </div>
                `)
                  .join("")}
                
                <div class="grand-total-row">
                  <div class="amount-label">GRAND TOTAL EXPENDITURE</div>
                  <div class="amount-value">₹${rightSideTotal.toFixed(2)}</div>
                </div>
              </div>
            </div>
            
            <div class="closing-balance-section">
              <div class="closing-balance">CLOSING BALANCE: ₹${finalClosingBalance.toFixed(2)}</div>
              <div style="margin-top: 1mm; font-size: 9px; color: #666;">
                Orders: ${leftSideData.orderCount || 0} | Avg Sales: ₹${(leftSideData.averageSales || 0).toFixed(0)}
              </div>
            </div>
            
            <div class="signature-section">
              <div class="signature-box">
                <div style="margin-bottom: 1mm;">Prepared By</div>
                <div>${institutionData.userData?.userName || "Manager"}</div>
              </div>
              <div class="signature-box">
                <div style="margin-bottom: 1mm;">Verified By</div>
                <div>________________</div>
              </div>
              <div class="signature-box">
                <div style="margin-bottom: 1mm;">Accounts</div>
                <div>________________</div>
              </div>
            </div>
          </div>

          <!-- Page Break for Second Page -->
          <div class="page-break"></div>
          
          <div class="report-container">
            <!-- Second Page: Stock Report -->
            <div class="stock-report-header">
              <div class="company-name">${
                institutionData?.companyName || "AMRAPALI TESTING"
              }</div>
              <div class="report-title">DAILY STOCK REPORT - BAR INVENTORY</div>
              <div class="date-section">
                Date: ${formattedDate} | Printed: ${currentTime}
              </div>
            </div>

            <table class="stock-table">
              <thead>
                <tr>
                  <th rowspan="2" class="item-name">ITEM</th>
                  <th colspan="2">OPENING</th>
                  <th colspan="2">RECEIVED</th>
                  <th colspan="2">TOTAL</th>
                  <th colspan="2">TRANSFER</th>
                  <th colspan="3">SALES</th>
                  <th colspan="3">RATE</th>
                  <th colspan="2">CLOSING</th>
                  <th rowspan="2" class="amount-column">AMOUNT<br>(₹)</th>
                </tr>
                <tr>
                  <th>BTL</th>
                  <th>ML</th>
                  <th>BTL</th>
                  <th>ML</th>
                  <th>BTL</th>
                  <th>ML</th>
                  <th>BTL</th>
                  <th>ML</th>
                  <th>60ml</th>
                  <th>30ml</th>
                  <th>BTL</th>
                  <th>60ml</th>
                  <th>30ml</th>
                  <th>BTL</th>
                  <th>BTL</th>
                  <th>ML</th>
                </tr>
              </thead>
              <tbody>
                ${stockReportData.categories
                  .map((cat) => {
                    let catHtml = `
                      <tr>
                        <td colspan="18" class="category-header">${cat.category.toUpperCase()}</td>
                      </tr>
                    `;

                    cat.items.forEach((item) => {
                      const totalBottleSold = Object.keys(item.sales || {})
                        .filter((k) => !["30 ml", "60 ml"].includes(k.toLowerCase()))
                        .reduce((sum, k) => sum + safeNum(item.sales[k]), 0);
                      const rate60ml = safeNum(item.unitRates?.["60 ml"] || 0);
                      const rate30ml = safeNum(item.unitRates?.["30 ml"] || 0);
                      const rateBottle = Object.keys(item.unitRates || {})
                        .filter((k) => !["30 ml", "60 ml"].includes(k.toLowerCase()))
                        .reduce((rate, k) => rate || safeNum(item.unitRates[k]), 0);

                      catHtml += `
                        <tr>
                          <td class="item-name">${(item.stockName || "").substring(0, 18)}</td>
                          <td>${item.openingBTL.bottles}</td>
                          <td>${Math.round(item.openingBTL.remainder)}</td>
                          <td>${item.receivedBTL.bottles}</td>
                          <td>${Math.round(item.receivedBTL.remainder)}</td>
                          <td>${item.totalBTL.bottles}</td>
                          <td>${Math.round(item.totalBTL.remainder)}</td>
                          <td>${item.transferredBTL.bottles}</td>
                          <td>${Math.round(item.transferredBTL.remainder)}</td>
                          <td>${safeNum(item.sales["60 ml"] || 0)}</td>
                          <td>${safeNum(item.sales["30 ml"] || 0)}</td>
                          <td>${totalBottleSold}</td>
                          <td>${rate60ml > 0 ? rate60ml.toFixed(0) : "-"}</td>
                          <td>${rate30ml > 0 ? rate30ml.toFixed(0) : "-"}</td>
                          <td>${rateBottle > 0 ? rateBottle.toFixed(0) : "-"}</td>
                          <td>${item.closingBTL.bottles}</td>
                          <td>${Math.round(item.closingBTL.remainder)}</td>
                          <td class="amount-column">${safeNum(item.amount).toFixed(0)}</td>
                        </tr>
                      `;
                    });

                    const catTotalBottleSold = Object.entries(cat.totals.sales || {})
                      .filter(([k]) => !["30 ml", "60 ml"].includes(k.toLowerCase()))
                      .reduce((sum, [k, v]) => sum + safeNum(v), 0);

                    catHtml += `
                      <tr class="category-total">
                        <td class="item-name">TOTAL ${cat.category.toUpperCase()}</td>
                        <td>${cat.totals.openingBTL.bottles}</td>
                        <td>${Math.round(cat.totals.openingBTL.remainder)}</td>
                        <td>${cat.totals.receivedBTL.bottles}</td>
                        <td>${Math.round(cat.totals.receivedBTL.remainder)}</td>
                        <td>${cat.totals.totalBTL.bottles}</td>
                        <td>${Math.round(cat.totals.totalBTL.remainder)}</td>
                        <td>${cat.totals.transferredBTL.bottles}</td>
                        <td>${Math.round(cat.totals.transferredBTL.remainder)}</td>
                        <td>${safeNum(cat.totals.sales["60 ml"] || 0)}</td>
                        <td>${safeNum(cat.totals.sales["30 ml"] || 0)}</td>
                        <td>${catTotalBottleSold}</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>${cat.totals.closingBTL.bottles}</td>
                        <td>${Math.round(cat.totals.closingBTL.remainder)}</td>
                        <td class="amount-column">${safeNum(cat.totals.amount).toFixed(0)}</td>
                      </tr>
                    `;

                    return catHtml;
                  })
                  .join("")}

                <tr class="grand-total-row-stock">
                  <td class="item-name">GRAND TOTAL</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td>-</td>
                  <td class="amount-column">${stockReportData.grandTotalAmount.toFixed(0)}</td>
                </tr>
              </tbody>
            </table>

            <div class="report-footer">
              <div style="margin-bottom: 1mm; font-weight: bold; font-size: 9px;">
                TOTAL STOCK VALUE: ₹${stockReportData.grandTotalAmount.toFixed(2)}
              </div>
              <div style="font-size: 7px;">
                Generated: ${new Date().toLocaleDateString("en-IN")} | Page 2 of 2
              </div>
            </div>

            <div class="signature-section">
              <div class="signature-box">
                <div style="margin-bottom: 1mm;">Stock Verified</div>
                <div>________________</div>
              </div>
              <div class="signature-box">
                <div style="margin-bottom: 1mm;">Bar Manager</div>
                <div>________________</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const rightSideTotal = rightSideSections.reduce((sectionSum, section) => {
    const sectionTotal = section.entries.reduce(
      (entrySum, entry) => entrySum + (Number(entry.value) || 0),
      0
    );
    return sectionSum + sectionTotal;
  }, 0);
  const finalClosingBalance = (leftSideData.grandTotal || 0) - rightSideTotal;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            End Day Report
          </h1>

          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <label className="block text-sm font-medium text-gray-700">
                Select Date:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="bg-blue-50 px-3 py-2 rounded-lg">
                <span className="font-medium">Orders Today:</span>{" "}
                {leftSideData.orderCount || 0}
              </div>
              <div className="bg-green-50 px-3 py-2 rounded-lg">
                <span className="font-medium">Total Sales:</span> ₹
                {(leftSideData.totalSales || 0).toFixed(2)}
              </div>
              <div className="bg-orange-50 px-3 py-2 rounded-lg">
                <span className="font-medium">Kitchen Sales:</span> ₹
                {(leftSideData.kitchenSales || 0).toFixed(2)}
              </div>
              <div className="bg-purple-50 px-3 py-2 rounded-lg">
                <span className="font-medium">Beverage Sales:</span> ₹
                {(leftSideData.beverageSales || 0).toFixed(2)}
              </div>
              {leftSideData.channels && (
                <div className="bg-indigo-50 px-3 py-2 rounded-lg">
                  <span className="font-medium">Room Service:</span> ₹
                  {(leftSideData.channels.roomService?.revenue || 0).toFixed(2)}
                </div>
              )}
              {leftSideData.channels && (
                <div className="bg-pink-50 px-3 py-2 rounded-lg">
                  <span className="font-medium">Zomato / Swiggy:</span> ₹
                  {((leftSideData.channels.zomato?.revenue || 0) + (leftSideData.channels.swiggy?.revenue || 0)).toFixed(2)}
                </div>
              )}
              {reportSaved && (
                <div className="bg-green-100 text-green-800 px-3 py-2 rounded-lg">
                  ✓ Report Saved
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-md p-6 mb-6"
          style={{ fontFamily: '"Times New Roman", serif' }}>
          <div className="text-center mb-6 border-b pb-4">
            <h2 className="text-xl font-bold">
              {institutionData?.companyName || "AMRAPALI TESTING"}
            </h2>
            <h3 className="text-lg font-semibold">
              CASHIERING REPORT{" "}
              {institutionData?.companyName || "AMRAPALI TESTING"} BAR
            </h3>
            <p className="text-sm text-gray-600">
              Print On: {leftSideData.date}{" "}
              {new Date().toLocaleTimeString("en-IN")}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-lg mb-4 border-b border-gray-300 pb-2">
                RECEIPTS
              </h4>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>BAR SALES</span>
                  <span>₹{leftSideData.barSales?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between">
                  <span>KITCHEN SALES</span>
                  <span>₹{leftSideData.kitchenSales?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between">
                  <span>BEVERAGE SALES</span>
                  <span>₹{leftSideData.beverageSales?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="border-b border-gray-300 my-2"></div>
                <div className="flex justify-between">
                  <span>SGST 2.5 %</span>
                  <span>₹{leftSideData.sgst?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST 2.5 %</span>
                  <span>₹{leftSideData.cgst?.toFixed(2) || "0.00"}</span>
                </div>

                <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2">
                  <span>TOTAL</span>
                  <span>₹{leftSideData.grandTotal?.toFixed(2) || "0.00"}</span>
                </div>
              </div>

              {Object.keys(leftSideData.paymentBreakdown || {}).length > 0 && (
                <div className="mt-6">
                  <h4 className="font-bold text-lg mb-4 border-b border-gray-300 pb-2">
                    PAYMENT METHODS
                  </h4>
                  <div className="space-y-1 text-sm">
                    {Object.entries(leftSideData.paymentBreakdown || {}).map(
                      ([method, amount]) => (
                        <div key={method} className="flex justify-between">
                          <span>{method.toUpperCase()}</span>
                          <span>₹{Number(amount).toFixed(2)}</span>
                        </div>
                      )
                    )}
                    <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2">
                      <span>Total</span>
                      <span>₹{leftSideData.totalSales?.toFixed(2) || "0.00"}</span>
                    </div>
                  </div>
                </div>
              )}

              {leftSideData.channels && (
                <div className="mt-6">
                  <h4 className="font-bold text-lg mb-4 border-b border-gray-300 pb-2 flex justify-between items-center">
                    <span>RESTAURANT CHANNELS (SAME DAY)</span>
                    <span className="text-xs font-normal text-gray-500">Night Audit Breakdown</span>
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    {Object.entries(leftSideData.channels).map(([key, ch]) => (
                      <div key={key} className="flex justify-between items-center py-1 border-b border-gray-100">
                        <div>
                          <span className="font-medium text-gray-800">{ch.label}</span>
                          <span className="text-xs text-gray-500 ml-2 bg-gray-100 px-2 py-0.5 rounded-full">{ch.orders} orders</span>
                        </div>
                        <span className="font-semibold text-gray-900">₹{Number(ch.revenue || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2 text-base text-gray-900">
                      <span>Total Channel Revenue</span>
                      <span>
                        ₹
                        {Object.values(leftSideData.channels)
                          .reduce((sum, ch) => sum + Number(ch.revenue || 0), 0)
                          .toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-lg border-b border-gray-300 pb-2">
                  CUSTOM SECTIONS
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={addNewSection}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm">
                    Add Section
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {rightSideSections.map((section, sectionIndex) => (
                  <div
                    key={sectionIndex}
                    className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={section.heading}
                        onChange={(e) =>
                          updateSectionHeading(sectionIndex, e.target.value)
                        }
                        className="flex-1 font-bold text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                        placeholder="Section name"
                      />
                      <button
                        onClick={() => addEntryToSection(sectionIndex)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs">
                        + Entry
                      </button>
                      <button
                        onClick={() => removeSection(sectionIndex)}
                        className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                        disabled={rightSideSections.length === 1}>
                        ✕ Section
                      </button>
                    </div>

                    <div className="space-y-1">
                      {section.entries.map((entry, entryIndex) => (
                        <div
                          key={entryIndex}
                          className="flex items-center gap-2">
                          <input
                            type="text"
                            value={entry.name}
                            onChange={(e) =>
                              updateEntry(
                                sectionIndex,
                                entryIndex,
                                "name",
                                e.target.value
                              )
                            }
                            placeholder="Entry name"
                            className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={entry.value}
                            onChange={(e) =>
                              updateEntry(
                                sectionIndex,
                                entryIndex,
                                "value",
                                e.target.value
                              )
                            }
                            placeholder="0.00"
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                          />
                          <button
                            onClick={() =>
                              removeEntry(sectionIndex, entryIndex)
                            }
                            className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                            disabled={section.entries.length === 1}>
                            ✕
                          </button>
                        </div>
                      ))}

                      <div className="flex justify-between font-semibold border-t border-gray-300 pt-1 mt-2 text-sm">
                        <span>{section.heading} Total</span>
                        <span>
                          ₹{section.entries
                            .reduce(
                              (sum, entry) => sum + (Number(entry.value) || 0),
                              0
                            )
                            .toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between font-bold border-t-2 border-gray-800 pt-2 mt-4 text-lg bg-gray-100 px-3 py-2 rounded">
                  <span>GRAND TOTAL</span>
                  <span>₹{rightSideTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t-2 border-gray-800">
            <div className="flex justify-between font-bold text-lg">
              <span>CLOSING BALANCE</span>
              <span>₹{finalClosingBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={handleSaveReport}
            disabled={reportSaved}
            className={`px-6 py-3 rounded-lg font-semibold ${
              reportSaved
                ? "bg-green-500 text-white cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}>
            {reportSaved ? "✓ Report Saved" : "Save Report"}
          </button>

          <button
            onClick={handleDownloadReport}
            disabled={!reportSaved}
            className={`px-6 py-3 rounded-lg font-semibold ${
              !reportSaved
                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}>
            Download/Print Report (2 Pages)
          </button>
        </div>

        {!reportSaved && (
          <p className="text-center text-gray-600 mt-4 text-sm">
            * You must save the report before downloading
          </p>
        )}
      </div>
    </div>
  );
};

export default EndDay;