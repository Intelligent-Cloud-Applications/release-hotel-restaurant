import React, { useContext, useState, useEffect } from "react";
import { Context } from "../../../../Context";
import { API } from "aws-amplify";
import { toast } from "react-toastify";

const EndDay = () => {
  const { institutionData, setLoader } = useContext(Context);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [leftSideData, setLeftSideData] = useState({});
  const [rightSideSections, setRightSideSections] = useState([]);
  const [reportSaved, setReportSaved] = useState(false);
  const [previousDayData, setPreviousDayData] = useState(null);

  useEffect(() => {
    if (institutionData?.institution) {
      initializeEndDayData();
    }
  }, [institutionData, selectedDate]);

  const initializeEndDayData = async () => {
    try {
      setLoading(true);

      // Fetch multiple data sources in parallel
      const [ordersData, previousData] = await Promise.all([
        fetchOrdersData(),
        fetchPreviousDayData(),
      ]);

      // Calculate left side data based on current day's orders
      calculateLeftSideData(ordersData, selectedDate, previousData);

      // Load default right side sections
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
    // Load basic default sections
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
    let totalPayments = {};

    ordersForDate.forEach((order) => {
      const amount = Number(order.totalAmount) || 0;
      totalBilledAmount += amount;
      totalCgst += Number(order.cgst) || 0;
      totalSgst += Number(order.sgst) || 0;
      totalServiceTax += Number(order.serviceTax) || 0;

      // Payment method breakdown
      const payMethod = (
        order.paymentMethod ||
        order.paymentMode ||
        "Cash"
      ).toLowerCase();
      totalPayments[payMethod] = (totalPayments[payMethod] || 0) + amount;

      // Bar vs Kitchen sales
      (order.items || []).forEach((item) => {
        const itemAmount =
          (Number(item.price) || 0) * (Number(item.quantity) || 0);
        const itemType = String(item.type || "").toLowerCase();

        if (itemType === "bar") {
          totalBarAmount += itemAmount;
        } else {
          totalKitchenAmount += itemAmount;
        }
      });
    });

    const totalTax = totalCgst + totalSgst + totalServiceTax;
    const totalReceiptsAmount = totalBarAmount + totalKitchenAmount + totalTax;

    // Calculate dynamic opening balance from previous day's closing balance
    const openingBalance = previousData?.closingBalance || 0;

    // Calculate average sales dynamically (could be based on last 30 days average)
    const averageSales = calculateAverageSales(orders, date);

    setLeftSideData({
      openingBalance: openingBalance,
      averageSales: averageSales,
      kitchenSales: totalKitchenAmount,
      barSales: totalBarAmount,
      sgst: totalSgst,
      cgst: totalCgst,
      serviceTax: totalServiceTax,
      totalSales: totalBilledAmount,
      totalTax: totalTax,
      grandTotal: totalReceiptsAmount,
      paymentBreakdown: totalPayments,
      orderCount: ordersForDate.length,
      date: date, // <-- change here
    });
  };

  const calculateAverageSales = (allOrders, currentDate) => {
    // Calculate average sales for the last 30 days (excluding current day)
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const currentDayStart = new Date(currentDate);
    currentDayStart.setHours(0, 0, 0, 0);

    const historicalOrders = allOrders.filter((order) => {
      const orderDate = new Date(Number(order.createdAt));
      return orderDate >= thirtyDaysAgo && orderDate < currentDayStart;
    });

    if (historicalOrders.length === 0) return 0;

    // Group by date and calculate daily totals
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
    // Re-initialize data when date changes
    if (institutionData?.institution) {
      initializeEndDayData();
    }
  };

  const handleSaveReport = async () => {
    try {
      setLoader(true);

      // Calculate total from all sections
      const rightSideTotal = rightSideSections.reduce((sectionSum, section) => {
        const sectionTotal = section.entries.reduce(
          (entrySum, entry) => entrySum + (Number(entry.value) || 0),
          0
        );
        return sectionSum + sectionTotal;
      }, 0);

      const closingBalance = (leftSideData.grandTotal || 0) - rightSideTotal;

      const reportData = {
        dayStart: false, // <-- required
        type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe", // <-- required
        leftSideData: { ...leftSideData, date: selectedDate }, // keep your data
        rightSideSections: rightSideSections.filter((section) =>
          section.entries.some((entry) => entry.name.trim() !== "")
        ),
        closingBalance,
        savedAt: new Date().toISOString(),
        savedBy: institutionData.userData?.userName || "Admin",
      };

      // Save to backend API
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
    // If report isn't saved yet, attempt to save it first
    if (!reportSaved) {
      const saved = await handleSaveReport();
      if (!saved) {
        toast.warning("Unable to save report. Cannot download.");
        return;
      }
    }

    // Generate and download the report
    const reportContent = generateReportHTML();

    // Create a new window and print
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

    return `
            <html>
                <head>
                    <title>End Day Report - ${leftSideData.date}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; font-size: 12px; margin: 20px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .company-name { font-weight: bold; font-size: 14px; }
                        .report-title { font-weight: bold; margin: 10px 0; }
                        .date-time { margin: 5px 0; }
                        .container { display: flex; gap: 40px; }
                        .left-section, .right-section { flex: 1; }
                        .section-title { font-weight: bold; border-bottom: 1px solid #000; margin: 15px 0 5px 0; padding-bottom: 2px; }
                        .line-item { display: flex; justify-content: space-between; margin: 2px 0; }
                        .line-item .label { text-align: left; }
                        .line-item .value { text-align: right; }
                        .total-line { border-top: 1px solid #000; margin-top: 5px; padding-top: 2px; font-weight: bold; }
                        .closing-balance { border-top: 2px solid #000; margin-top: 15px; padding-top: 5px; font-weight: bold; }
                        @media print { body { margin: 0; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="company-name">${
                          institutionData?.companyName || "AMRAPALI TESTING"
                        }</div>
                        <div class="report-title">CASHIERING REPORT ${
                          institutionData?.companyName || "AMRAPALI TESTING"
                        } BAR</div>
                        <div class="date-time">Print On: ${
                          leftSideData.date
                        } ${new Date().toLocaleTimeString("en-IN")}</div>
                    </div>
                    
                    <div class="container">
                        <div class="left-section">
                            <div class="section-title">RECEIPTS</div>
                            <div class="line-item">
                                <span class="label">BAR SALES</span>
                                <span class="value">${
                                  leftSideData.barSales?.toFixed(2) || "0.00"
                                }</span>
                            </div>
                            <div class="line-item">
                                <span class="label">KITCHEN SALES</span>
                                <span class="value">${
                                  leftSideData.kitchenSales?.toFixed(2) ||
                                  "0.00"
                                }</span>
                            </div>
                            
                            <div class="line-item">
                                <span class="label">SGST 2.5 %</span>
                                <span class="value">${
                                  leftSideData.sgst?.toFixed(2) || "0.00"
                                }</span>
                            </div>
                            <div class="line-item">
                                <span class="label">CGST 2.5 %</span>
                                <span class="value">${
                                  leftSideData.cgst?.toFixed(2) || "0.00"
                                }</span>
                            </div>
                            
                            <div class="line-item total-line">
                                <span class="label">TOTAL</span>
                                <span class="value">${
                                  leftSideData.grandTotal?.toFixed(2) || "0.00"
                                }</span>
                            </div>
                            
                            <div style="margin-top: 20px;">
                                <div class="section-title">PAYMENT METHODS</div>
                                ${Object.entries(
                                  leftSideData.paymentBreakdown || {}
                                )
                                  .map(
                                    ([method, amount]) => `
                                    <div class="line-item">
                                        <span class="label">${method.toUpperCase()}</span>
                                        <span class="value">${Number(
                                          amount
                                        ).toFixed(2)}</span>
                                    </div>
                                `
                                  )
                                  .join("")}
                                <div class="line-item total-line">
                                    <span class="label">Total</span>
                                    <span class="value">${
                                      leftSideData.totalSales?.toFixed(2) ||
                                      "0.00"
                                    }</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="right-section">
                            ${rightSideSections
                              .map(
                                (section) => `
                                <div class="section-title">${
                                  section.heading
                                }</div>
                                ${section.entries
                                  .filter((entry) => entry.name.trim() !== "")
                                  .map(
                                    (entry) => `
                                    <div class="line-item">
                                        <span class="label">${entry.name}</span>
                                        <span class="value">${Number(
                                          entry.value
                                        ).toFixed(2)}</span>
                                    </div>
                                `
                                  )
                                  .join("")}
                                <div class="line-item total-line">
                                    <span class="label">${
                                      section.heading
                                    } Total</span>
                                    <span class="value">${section.entries
                                      .reduce(
                                        (sum, entry) =>
                                          sum + (Number(entry.value) || 0),
                                        0
                                      )
                                      .toFixed(2)}</span>
                                </div>
                                <br/>
                            `
                              )
                              .join("")}
                            
                            <div class="line-item total-line" style="margin-top: 15px; border-top: 2px solid #000;">
                                <span class="label">GRAND TOTAL</span>
                                <span class="value">${rightSideTotal.toFixed(
                                  2
                                )}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="closing-balance">
                        <div class="line-item">
                            <span class="label">CLOSING BALANCE</span>
                            <span class="value">${finalClosingBalance.toFixed(
                              2
                            )}</span>
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
        {/* Header */}
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
              {reportSaved && (
                <div className="bg-green-100 text-green-800 px-3 py-2 rounded-lg">
                  ✓ Report Saved
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div
          className="bg-white rounded-lg shadow-md p-6 mb-6"
          style={{ fontFamily: '"Courier New", monospace' }}>
          {/* Report Header */}
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

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side - Auto Generated */}
            <div>
              <h4 className="font-bold text-lg mb-4 border-b border-gray-300 pb-2">
                RECEIPTS
              </h4>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>BAR SALES</span>
                  <span>{leftSideData.barSales?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between">
                  <span>KITCHEN SALES</span>
                  <span>{leftSideData.kitchenSales?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="border-b border-gray-300 my-2"></div>
                <div className="flex justify-between">
                  <span>SGST 2.5 %</span>
                  <span>{leftSideData.sgst?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST 2.5 %</span>
                  <span>{leftSideData.cgst?.toFixed(2) || "0.00"}</span>
                </div>

                <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2">
                  <span>TOTAL</span>
                  <span>{leftSideData.grandTotal?.toFixed(2) || "0.00"}</span>
                </div>
              </div>

              {/* Payment Breakdown */}
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
                          <span>{Number(amount).toFixed(2)}</span>
                        </div>
                      )
                    )}
                    <div className="flex justify-between font-bold border-t border-gray-300 pt-2 mt-2">
                      <span>Total</span>
                      <span>
                        {leftSideData.totalSales?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - User Editable Sections */}
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
                    {/* Section Header */}
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

                    {/* Section Entries */}
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

                      {/* Section Total */}
                      <div className="flex justify-between font-semibold border-t border-gray-300 pt-1 mt-2 text-sm">
                        <span>{section.heading} Total</span>
                        <span>
                          {section.entries
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

                {/* Overall Total */}
                <div className="flex justify-between font-bold border-t-2 border-gray-800 pt-2 mt-4 text-lg bg-gray-100 px-3 py-2 rounded">
                  <span>GRAND TOTAL</span>
                  <span>
                    {rightSideSections
                      .reduce((sectionSum, section) => {
                        const sectionTotal = section.entries.reduce(
                          (entrySum, entry) =>
                            entrySum + (Number(entry.value) || 0),
                          0
                        );
                        return sectionSum + sectionTotal;
                      }, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Closing Balance */}
          <div className="mt-8 pt-4 border-t-2 border-gray-800">
            <div className="flex justify-between font-bold text-lg">
              <span>CLOSING BALANCE</span>
              <span>{finalClosingBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
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
            Download/Print Report
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
