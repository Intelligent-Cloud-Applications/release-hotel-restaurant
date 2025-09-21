import React, { useState, useEffect, useContext } from "react";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import { Button } from "flowbite-react";
import { DayPicker } from "react-day-picker";
import * as XLSX from "xlsx";
import "react-day-picker/dist/style.css";
import {
  safeNum,
  parseVolumeToMl,
  formatBottlesMl,
  dateToKey,
} from "../StockManagement/index";
import jsPDF from "jspdf";
import "jspdf-autotable";

const Loader = () => (
  <div className="flex flex-col items-center justify-center p-12">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-gray-300 border-t-primaryColor rounded-full animate-spin"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl font-bold">
        🍽️
      </div>
    </div>
    <p className="mt-4 text-primaryColor font-medium">Loading data...</p>
  </div>
);

// Common table styling configuration
const getTableStyles = () => ({
  theme: "grid",
  headStyles: {
    fillColor: [33, 150, 243], // Vibrant blue header background
    textColor: [255, 255, 255], // White text for headers
    fontStyle: "bold",
    halign: "center",
    fontSize: 9, // Slightly smaller font
    cellPadding: 2, // Reduced padding
    font: "helvetica",
  },
  bodyStyles: {
    fontSize: 8, // Smaller font for body
    cellPadding: 1.5, // Reduced padding
    font: "helvetica",
    textColor: [33, 33, 33], // Dark gray text
  },
  alternateRowStyles: {
    fillColor: [245, 245, 245], // Light gray for alternating rows
  },
  styles: {
    lineColor: [200, 200, 200], // Light gray borders
    lineWidth: 0.1,
    overflow: "linebreak",
  },
  margin: { top: 30, left: 15, right: 15 }, // Increased margins to prevent cutoff
});

// Common header setup for PDFs
const setupPDFHeader = (doc, title, isoDate, institutionData, currentTime, dateRange = null) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14); // Slightly smaller title font
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (doc.internal.pageSize.width - titleWidth) / 2, 15);
  doc.setFontSize(9); // Smaller font for header text
  doc.setFont("helvetica", "normal");
  const dateText = dateRange
    ? `Date Range: ${dateRange.start} to ${dateRange.end}`
    : `Date: ${isoDate.split("-").reverse().join("/")}`;
  doc.text(dateText, 15, 25);
  doc.text(`Printed: ${currentTime}`, doc.internal.pageSize.width - 15 - doc.getTextWidth(`Printed: ${currentTime}`), 25);
  doc.setLineWidth(0.5);
  doc.line(15, 28, doc.internal.pageSize.width - 15, 28); // Horizontal line under header
};

const formatNumber = (num) => {
  const rounded = Number(num.toFixed(2));
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2).replace(/\.?0+$/, "");
};

const buildCafeDailyReport = (isoDate, stocks) => {
  const key = dateToKey(isoDate);
  const items = [];
  stocks
    .filter((s) => s.type === "cafe")
    .forEach((stock) => {
      const update = (stock.stockupdate || {})[key] || {};
      const hasUpdate = Object.keys(update).length > 0;
      const openingRaw = hasUpdate ? update.openingStock ?? update.opening ?? update.open ?? 0 : stock.quantity ?? 0;
      const receivedRaw = update.received ?? 0;
      const unit = stock.unit || "g";
      let openingQty = parseVolumeToMl(openingRaw);
      let receivedQty = parseVolumeToMl(receivedRaw);
      let totalQty = openingQty + receivedQty;
      if (unit === "piece") {
        openingQty = safeNum(openingRaw);
        receivedQty = safeNum(receivedRaw);
        totalQty = openingQty + receivedQty;
      }
      let consumptionQty = 0;
      Object.keys(update).forEach((key) => {
        if (
          !["openingStock", "opening", "open", "received"].includes(key) &&
          !key.startsWith("unitRate_")
        ) {
          const cnt = safeNum(update[key] ?? 0);
          const num = Number(String(key).match(/\d+/)?.[0] || 1);
          consumptionQty += cnt * num;
        }
      });
      const closingQty = Math.max(0, totalQty - consumptionQty);
      const convertQuantities = (qty, unit) => {
        let kgL = 0,
          gMl = 0,
          piece = 0;
        if (unit === "piece") {
          piece = qty;
        } else if (["kg", "l"].includes(unit)) {
          kgL = qty;
          gMl = (qty * 1000) % 1000;
        } else if (["g", "ml"].includes(unit)) {
          kgL = Math.floor(qty / 1000);
          gMl = qty % 1000;
        }
        return { kgL, gMl, piece };
      };
      items.push({
        stockId: stock.stockId,
        stockName: stock.stockName || stock.name || "-",
        opening: convertQuantities(openingQty, unit),
        received: convertQuantities(receivedQty, unit),
        consumption: convertQuantities(consumptionQty, unit),
        closing: convertQuantities(closingQty, unit),
        unit,
      });
    });
  items.sort((a, b) => a.stockName.localeCompare(b.stockName));
  return { items };
};

// Updated exportCafeDailyReport
const exportCafeDailyReport = (isoDate, stocks, institutionData) => {
  if (!isoDate) {
    alert("Choose a date first");
    return;
  }

  const { items } = buildCafeDailyReport(isoDate, stocks);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }); // Landscape for better fit
  const currentTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // HEADER (matches Order/Bar Report style)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const title = `${(institutionData?.companyName || "Company Name").toUpperCase()}`;
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (doc.internal.pageSize.width - titleWidth) / 2, 15);

  doc.setFontSize(12);
  const subtitle = "CAFE DAILY STOCK SUMMARY";
  const subtitleWidth = doc.getTextWidth(subtitle);
  doc.text(subtitle, (doc.internal.pageSize.width - subtitleWidth) / 2, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const dateText = `Date: ${isoDate.split("-").reverse().join("/")}`;
  doc.text(dateText, 15, 35);
  const printedText = `Generated: ${currentTime}`;
  doc.text(printedText, doc.internal.pageSize.width - 15 - doc.getTextWidth(printedText), 35);

  // Header separator
  doc.setLineWidth(0.5);
  doc.line(15, 38, doc.internal.pageSize.width - 15, 38);

  // EXECUTIVE SUMMARY
  let yPos = 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("EXECUTIVE SUMMARY", 15, yPos);
  doc.setLineWidth(0.1);
  doc.line(15, yPos + 2, 15 + doc.getTextWidth("EXECUTIVE SUMMARY"), yPos + 2);
  yPos += 8;

  // Aggregate key metrics
  const safe = (n) => Number(n || 0);
  const sumOf = (selector) => items.reduce((sum, item) => sum + safe(selector(item)), 0);

  const totalItems = items.length;
  const totalOpeningL = (sumOf((i) => i.opening.kgL * 1000 + i.opening.gMl) / 1000).toFixed(2);
  const totalReceivedL = (sumOf((i) => i.received.kgL * 1000 + i.received.gMl) / 1000).toFixed(2);
  const totalConsumptionL = (sumOf((i) => i.consumption.kgL * 1000 + i.consumption.gMl) / 1000).toFixed(2);
  const totalClosingL = (sumOf((i) => i.closing.kgL * 1000 + i.closing.gMl) / 1000).toFixed(2);

  doc.autoTable({
    startY: yPos,
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [
      ["Total Items", totalItems, "Total Opening (L)", totalOpeningL],
      ["Total Received (L)", totalReceivedL, "Total Consumption (L)", totalConsumptionL],
      ["Total Closing (L)", totalClosingL, "", ""],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 11,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 3,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 50 },
      1: { halign: "center", cellWidth: 40 },
      2: { halign: "center", cellWidth: 50 },
      3: { halign: "center", cellWidth: 40 },
    },
    margin: { left: 15, right: 15 },
  });

  // CAFE STOCK TABLE
  yPos = doc.lastAutoTable.finalY + 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DAILY CAFE STOCK DETAILS", 15, yPos);
  doc.setLineWidth(0.1);
  doc.line(15, yPos + 2, 15 + doc.getTextWidth("DAILY CAFE STOCK DETAILS"), yPos + 2);
  yPos += 8;

  // Process items for table
  const tableData = items.map((it) => {
    return [
      (it.stockName || "-").substring(0, 20), // Item name
      formatNumber(it.opening.kgL),            // Opening kg/l
      it.opening.gMl.toFixed(0),               // Opening g/ml
      it.opening.piece,                        // Opening piece
      formatNumber(it.received.kgL),           // Received kg/l
      it.received.gMl.toFixed(0),              // Received g/ml
      it.received.piece,                       // Received piece
      formatNumber(it.consumption.kgL),        // Consumption kg/l
      it.consumption.gMl.toFixed(0),           // Consumption g/ml
      it.consumption.piece,                    // Consumption piece
      formatNumber(it.closing.kgL),            // Closing kg/l
      it.closing.gMl.toFixed(0),               // Closing g/ml
      it.closing.piece,                        // Closing piece
    ];
  });

  // Table headers
  const headers = [
    "Item",
    "Opening", "Opening", "Opening",
    "Received", "Received", "Received",
    "Consumption", "Consumption", "Consumption",
    "Closing", "Closing", "Closing",
  ];

  // Table sub-headers
  const subHeaders = [
    "",
    "kg/l", "g/ml", "piece",
    "kg/l", "g/ml", "piece",
    "kg/l", "g/ml", "piece",
    "kg/l", "g/ml", "piece",
  ];

  // Build table
  doc.autoTable({
    startY: yPos,
    head: [headers, subHeaders], // Multi-row header
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 2,
      textColor: [44, 62, 80],
      halign: "center", // default center
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    // Column alignment overrides
    columnStyles: {
      0: { halign: "left", cellWidth: 35 }, // Item name left-aligned
      1: { cellWidth: 12 }, 2: { cellWidth: 12 }, 3: { cellWidth: 12 }, // Opening
      4: { cellWidth: 12 }, 5: { cellWidth: 12 }, 6: { cellWidth: 12 }, // Received
      7: { cellWidth: 12 }, 8: { cellWidth: 12 }, 9: { cellWidth: 12 }, // Consumption
      10: { cellWidth: 12 }, 11: { cellWidth: 12 }, 12: { cellWidth: 12 }, // Closing
    },
    styles: {
      overflow: "linebreak",
      lineColor: [189, 195, 199],
      lineWidth: 0.1,
    },
    margin: { left: 15, right: 15 },
    pageBreak: "auto",
  });

  // FOOTER: Page numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 15,
      doc.internal.pageSize.height - 10,
      { align: "right" }
    );
  }

  doc.save(`${institutionData.companyName}_cafe_report_${isoDate}.pdf`);
};

const buildDailyReportByCategory = (isoDate, typeFilter, stocks, allOrders) => {
  const key = dateToKey(isoDate);
  const baseSaleCols = ["60 ml", "30 ml"];
  const saleSizes = new Set(baseSaleCols);
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
          !["openingStock", "opening", "open", "received", "transferred"].includes(k)
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
        const openingRaw = hasUpdate ? update.openingStock ?? update.opening ?? update.open ?? 0 : stock.quantity ?? 0;
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

const exportDailyReport = (isoDate, stocks, allOrders, institutionData) => {
  if (!isoDate) {
    alert("Choose a date first");
    return;
  }

  const { categories, grandTotalAmount } = buildDailyReportByCategory(
    isoDate,
    "bar",
    stocks,
    allOrders
  );

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const currentTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // HEADER (same style as Order PDF)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const title = `${(institutionData?.companyName || "Company Name").toUpperCase()}`;
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (doc.internal.pageSize.width - titleWidth) / 2, 15);

  doc.setFontSize(12);
  const subtitle = "BAR DAILY REPORT";
  const subtitleWidth = doc.getTextWidth(subtitle);
  doc.text(subtitle, (doc.internal.pageSize.width - subtitleWidth) / 2, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const dateText = `Date: ${isoDate.split("-").reverse().join("/")}`;
  doc.text(dateText, 15, 35);
  const printedText = `Generated: ${currentTime}`;
  doc.text(printedText, doc.internal.pageSize.width - 15 - doc.getTextWidth(printedText), 35);

  // Header separator
  doc.setLineWidth(0.5);
  doc.line(15, 38, doc.internal.pageSize.width - 15, 38);

  // EXECUTIVE SUMMARY
  let yPos = 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("EXECUTIVE SUMMARY", 15, yPos);
  doc.setLineWidth(0.1);
  doc.line(15, yPos + 2, 15 + doc.getTextWidth("EXECUTIVE SUMMARY"), yPos + 2);
  yPos += 8;

  const safe = (n) => Number(n || 0);
  const sumOf = (selector) => categories.reduce((sum, c) => sum + safe(selector(c)), 0);

  // Aggregate in ML (convert to L for display)
  const openingL = (sumOf((c) => c.totals.openingMl) / 1000).toFixed(2);
  const receivedL = (sumOf((c) => c.totals.receivedMl) / 1000).toFixed(2);
  const transferredL = (sumOf((c) => c.totals.transferredMl) / 1000).toFixed(2);
  const closingL = (sumOf((c) => c.totals.closingMl) / 1000).toFixed(2);
  const totalCategories = categories.length;
  const totalItems = categories.reduce((sum, c) => sum + (c.items?.length || 0), 0);
  const totalSales60 = sumOf((c) => safe(c.totals.sales?.["60 ml"]));
  const totalSales30 = sumOf((c) => safe(c.totals.sales?.["30 ml"]));
  const totalSalesBTL = categories.reduce((sum, c) => {
    const sales = c.totals.sales || {};
    return (
      sum +
      Object.entries(sales).reduce(
        (s, [k, v]) => (["30 ml", "60 ml"].includes(String(k).toLowerCase()) ? s : s + safe(v)),
        0
      )
    );
  }, 0);

  doc.autoTable({
    startY: yPos,
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [
      ["Total Categories", totalCategories, "Total Items", totalItems],
      ["Opening (L)", openingL, "Received (L)", receivedL],
      ["Transferred (L)", transferredL, "Closing (L)", closingL],
      ["Sales 60ML", totalSales60, "Sales 30ML", totalSales30],
      ["Sales BTL", totalSalesBTL, "Grand Amount", grandTotalAmount.toFixed(2)],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 11,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 3,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 50 },
      1: { halign: "center", cellWidth: 40 },
      2: { halign: "center", cellWidth: 50 },
      3: { halign: "center", cellWidth: 40 },
    },
    margin: { left: 15, right: 15 },
  });

  // CATEGORY TABLES
  yPos = doc.lastAutoTable.finalY + 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("DAILY STOCK BY CATEGORY", 15, yPos);
  doc.setLineWidth(0.1);
  doc.line(15, yPos + 2, 15 + doc.getTextWidth("DAILY STOCK BY CATEGORY"), yPos + 2);
  yPos += 8;

  categories.forEach((cat, idx) => {
    // Page break check before section
    let startY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : yPos;
    if (startY > doc.internal.pageSize.height - 40) {
      doc.addPage();
      startY = 25;
    }

    // Category title tag
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Category: ${cat.category}`, 15, startY);
    startY += 6;

    // Build body rows
    const rows = cat.items.map((it) => {
      const bottleSalesKeys = Object.keys(it.sales || {}).filter(
        (k) => !["30 ml", "60 ml"].includes(k.toLowerCase())
      );
      const totalBottleSold = bottleSalesKeys.reduce((sum, k) => sum + safe(it.sales[k]), 0);
      const rate60ml = safe(it.unitRates?.["60 ml"]);
      const rate30ml = safe(it.unitRates?.["30 ml"]);
      const bottleRateKeys = Object.keys(it.unitRates || {}).filter(
        (k) => !["30 ml", "60 ml"].includes(k.toLowerCase())
      );
      const rateBottle = bottleRateKeys.length > 0 ? safe(it.unitRates[bottleRateKeys[0]]) : 0;

      return [
        (it.stockName || "-").substring(0, 18),
        it.openingBTL.bottles,
        it.openingBTL.remainder,
        it.receivedBTL.bottles,
        it.receivedBTL.remainder,
        it.totalBTL.bottles,
        it.totalBTL.remainder,
        it.transferredBTL.bottles,
        it.transferredBTL.remainder,
        safe(it.sales["60 ml"] || 0),
        safe(it.sales["30 ml"] || 0),
        totalBottleSold,
        rate60ml ? rate60ml.toFixed(0) : "0",
        rate30ml ? rate30ml.toFixed(0) : "0",
        rateBottle ? rateBottle.toFixed(0) : "0",
        it.closingBTL.bottles,
        it.closingBTL.remainder,
        safe(it.amount).toFixed(0),
      ];
    });

    // Category total row
    rows.push([
      "TOTAL:",
      cat.totals.openingBTL.bottles,
      cat.totals.openingBTL.remainder,
      cat.totals.receivedBTL.bottles,
      cat.totals.receivedBTL.remainder,
      cat.totals.totalBTL.bottles,
      cat.totals.totalBTL.remainder,
      cat.totals.transferredBTL.bottles,
      cat.totals.transferredBTL.remainder,
      safe(cat.totals.sales["60 ml"] || 0),
      safe(cat.totals.sales["30 ml"] || 0),
      Object.entries(cat.totals.sales || {}).reduce(
        (sum, [k, v]) => (["30 ml", "60 ml"].includes(k.toLowerCase()) ? sum : sum + safe(v)),
        0
      ),
      "",
      "",
      "",
      cat.totals.closingBTL.bottles,
      cat.totals.closingBTL.remainder,
      safe(cat.totals.amount).toFixed(0),
    ]);

    // Table
    doc.autoTable({
      startY,
      head: [
        [
          { content: "Item", rowSpan: 2 },
          { content: "Opening", colSpan: 2 },
          { content: "Received", colSpan: 2 },
          { content: "Total", colSpan: 2 },
          { content: "Transfer", colSpan: 2 },
          { content: "Sales", colSpan: 3 },
          { content: "Rate", colSpan: 3 },
          { content: "Closing", colSpan: 2 },
          { content: "Amount", rowSpan: 2 },
        ],
        [
          "BTL",
          "ML",
          "BTL",
          "ML",
          "BTL",
          "ML",
          "BTL",
          "ML",
          "60ML",
          "30ML",
          "BTL",
          "60ML",
          "30ML",
          "BTL",
          "BTL",
          "ML",
        ],
      ],
      body: rows,
      theme: "striped",
      headStyles: {
        fillColor: [52, 73, 94],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 10,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 9,
        cellPadding: 2,
        textColor: [44, 62, 80],
        halign: "center", // default center for all cells
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250],
      },
      // Column widths tuned for landscape A4
      columnStyles: {
        0: { halign: "left", cellWidth: 28 },   // Item
        1: { cellWidth: 10 }, 2: { cellWidth: 12 }, // Opening
        3: { cellWidth: 10 }, 4: { cellWidth: 12 }, // Received
        5: { cellWidth: 10 }, 6: { cellWidth: 12 }, // Total
        7: { cellWidth: 10 }, 8: { cellWidth: 12 }, // Transfer
        9: { cellWidth: 10 }, 10: { cellWidth: 10 }, 11: { cellWidth: 10 }, // Sales
        12: { cellWidth: 10 }, 13: { cellWidth: 10 }, 14: { cellWidth: 12 }, // Rate
        15: { cellWidth: 10 }, 16: { cellWidth: 12 }, // Closing
        17: { halign: "right", cellWidth: 16 }, // Amount
      },
      styles: {
        overflow: "linebreak",
        lineColor: [189, 195, 199],
        lineWidth: 0.1,
      },
      margin: { left: 15, right: 15 },
      pageBreak: "auto",
    });
  });

  // FOOTER: Grand total and page numbers
  let finalY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 10 : doc.internal.pageSize.height - 20;

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Page number
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 15,
      doc.internal.pageSize.height - 10,
      { align: "right" }
    );

    if (i === pageCount) {
      const footerY = Math.max(finalY, doc.internal.pageSize.height - 30);
      doc.setLineWidth(0.5);
      doc.line(15, footerY - 5, doc.internal.pageSize.width - 15, footerY - 5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Grand Total Amount: ${grandTotalAmount.toFixed(2)}`, 15, footerY);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.text(
        "This report is computer generated and does not require signature.",
        doc.internal.pageSize.width / 2,
        footerY + 8,
        { align: "center" }
      );
    }
  }

  doc.save(`${institutionData.companyName}_bar_report_${isoDate}.pdf`);
};

const buildOrderReport = (start, end, allOrders) => {
  const startTime = new Date(start).setHours(0, 0, 0, 0);
  const endTime = new Date(end).setHours(23, 59, 59, 999);
  const filteredOrders = allOrders.filter((order) => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= startTime && orderDate <= endTime;
  });
  let totalBilledAmount = 0,
    totalCgst = 0,
    totalSgst = 0,
    totalServiceTax = 0;
  let totalBarAmount = 0,
    totalCafeAmount = 0,
    totalBarItemsCount = 0,
    totalCafeItemsCount = 0;
  const paymentBreakdown = {};
  const itemQuantities = {};
  filteredOrders.forEach((order) => {
    totalBilledAmount += safeNum(order.totalAmount);
    totalCgst += safeNum(order.cgst);
    totalSgst += safeNum(order.sgst);
    totalServiceTax += safeNum(order.serviceTax);
    const payKey = order.paymentMethod || order.paymentMode || "Cash";
    paymentBreakdown[payKey] = (paymentBreakdown[payKey] || 0) + safeNum(order.totalAmount);
    (order.items || []).forEach((it) => {
      const itQty = safeNum(it.quantity);
      const itAmount = safeNum(it.price) * itQty;
      const itType = String(it.type || "").toLowerCase();
      if (itType === "bar") {
        totalBarAmount += itAmount;
        totalBarItemsCount += itQty;
      } else {
        totalCafeAmount += itAmount;
        totalCafeItemsCount += itQty;
      }
      if (it.name) {
        itemQuantities[it.name] = {
          quantity: (itemQuantities[it.name]?.quantity || 0) + itQty,
          type: itType || "cafe",
        };
      }
    });
  });
  return {
    orders: filteredOrders,
    totalBilledAmount,
    totalCgst,
    totalSgst,
    totalServiceTax,
    totalBarAmount,
    totalCafeAmount,
    totalBarItemsCount,
    totalCafeItemsCount,
    paymentBreakdown,
    itemQuantities,
  };
};

const buildItemReport = (start, end, allOrders) => {
  const { itemQuantities } = buildOrderReport(start, end, allOrders);
  const items = Object.entries(itemQuantities).map(([name, { quantity, type }]) => ({
    name,
    quantity,
    type: type === "bar" ? "Bar" : "Cafe",
  }));
  items.sort((a, b) => a.name.localeCompare(b.name));
  return { items };
};

// Updated exportItemPDF
const exportItemPDF = (start, end, institutionData, allOrders) => {
  const { items } = buildItemReport(start, end, allOrders);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const currentTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ---------- HEADER (same style as Order / Bar / Cafe) ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const title = `${(institutionData?.companyName || "Company Name").toUpperCase()}`;
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (doc.internal.pageSize.width - titleWidth) / 2, 15);

  doc.setFontSize(12);
  const subtitle = "ITEM SALES REPORT";
  const subtitleWidth = doc.getTextWidth(subtitle);
  doc.text(subtitle, (doc.internal.pageSize.width - subtitleWidth) / 2, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const dateRange = `Period: ${start.toLocaleDateString("en-IN")} to ${end.toLocaleDateString("en-IN")}`;
  doc.text(dateRange, 15, 35);
  const printedText = `Generated: ${currentTime}`;
  doc.text(printedText, doc.internal.pageSize.width - 15 - doc.getTextWidth(printedText), 35);

  doc.setLineWidth(0.5);
  doc.line(15, 38, doc.internal.pageSize.width - 15, 38);

  // ---------- EXECUTIVE SUMMARY ----------
  let yPos = 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("EXECUTIVE SUMMARY", 15, yPos);
  doc.setLineWidth(0.1);
  doc.line(15, yPos + 2, 15 + doc.getTextWidth("EXECUTIVE SUMMARY"), yPos + 2);
  yPos += 8;

  const totalItems = items.length;
  const totalQty   = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const barQty     = items.filter(it => it.type === "Bar").reduce((sum, it) => sum + (it.quantity || 0), 0);
  const cafeQty    = items.filter(it => it.type === "Cafe").reduce((sum, it) => sum + (it.quantity || 0), 0);

  doc.autoTable({
    startY: yPos,
    head: [["Metric", "Value", "Metric", "Value"]],
    body: [
      ["Total Items", totalItems, "Total Quantity", totalQty],
      ["Bar Sales Qty", barQty, "Cafe Sales Qty", cafeQty],
    ],
    theme: "grid",
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 11,
      halign: "center",
    },
    bodyStyles: { fontSize: 10, cellPadding: 3, halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 50 },
      1: { halign: "center", cellWidth: 40 },
      2: { halign: "center", cellWidth: 50 },
      3: { halign: "center", cellWidth: 40 },
    },
    margin: { left: 15, right: 15 },
  });

  // ---------- DETAIL TABLE ----------
  yPos = doc.lastAutoTable.finalY + 15;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ITEM SALES DETAILS", 15, yPos);
  doc.setLineWidth(0.1);
  doc.line(15, yPos + 2, 15 + doc.getTextWidth("ITEM SALES DETAILS"), yPos + 2);
  yPos += 8;

  const body = items.map(it => [
    (it.name || "-").substring(0, 35),
    it.type,
    it.quantity,
  ]);

  doc.autoTable({
    startY: yPos,
    head: [["Item Name", "Type", "Quantity Sold"]],
    body,
    theme: "striped",
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 2,
      textColor: [44, 62, 80],
      halign: "center",
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { halign: "left", cellWidth: 100 },   // Item name left
      1: { halign: "center", cellWidth: 35 },  // Type center
      2: { halign: "center", cellWidth: 35 },  // Qty center
    },
    styles: {
      overflow: "linebreak",
      lineColor: [189, 195, 199],
      lineWidth: 0.1,
    },
    margin: { left: 15, right: 15 },
    pageBreak: "auto",
  });

  // ---------- FOOTER / PAGE NUMBERS ----------
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 15,
      doc.internal.pageSize.height - 10,
      { align: "right" }
    );
    if (i === pageCount) {
      const footerY = Math.max(doc.lastAutoTable.finalY + 10, doc.internal.pageSize.height - 30);
      doc.setLineWidth(0.5);
      doc.line(15, footerY - 5, doc.internal.pageSize.width - 15, footerY - 5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Total Quantity: ${totalQty}`, 15, footerY);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.text(
        "This report is computer generated and does not require signature.",
        doc.internal.pageSize.width / 2,
        footerY + 8,
        { align: "center" }
      );
    }
  }

  doc.save(
    `${institutionData.companyName}_item_report_${start.toISOString().slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString() ? `_to_${end.toISOString().slice(0, 10)}` : ""
    }.pdf`
  );
};

// Updated exportOrderPDF
const exportOrderPDF = (start, end, institutionData, allOrders) => {
  const {
    orders,
    totalBilledAmount,
    totalCgst,
    totalSgst,
    totalServiceTax,
    totalBarAmount,
    totalCafeAmount,
    paymentBreakdown,
  } = buildOrderReport(start, end, allOrders);
  
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" }); // Changed to landscape for better table layout
  const currentTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Header with company branding
  const dateRange = {
    start: start.toLocaleDateString("en-IN"),
    end: end.toLocaleDateString("en-IN"),
  };
  
  // Enhanced header setup
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const title = `${(institutionData?.companyName || "Company Name").toUpperCase()}`;
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (doc.internal.pageSize.width - titleWidth) / 2, 15);
  
  doc.setFontSize(12);
  const subtitle = "ORDER REPORT";
  const subtitleWidth = doc.getTextWidth(subtitle);
  doc.text(subtitle, (doc.internal.pageSize.width - subtitleWidth) / 2, 25);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const dateText = `Period: ${dateRange.start} to ${dateRange.end}`;
  doc.text(dateText, 15, 35);
  doc.text(`Generated: ${currentTime}`, doc.internal.pageSize.width - 15 - doc.getTextWidth(`Generated: ${currentTime}`), 35);
  
  // Header separator line
  doc.setLineWidth(0.5);
  doc.line(15, 38, doc.internal.pageSize.width - 15, 38);

  // Enhanced summary section with better layout
  let yPos = 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("EXECUTIVE SUMMARY", 15, yPos);
  doc.setLineWidth(0.1); // Added line under section title
  doc.line(15, yPos + 2, 15 + doc.getTextWidth("EXECUTIVE SUMMARY"), yPos + 2);
  yPos += 8;

  // Summary data remains in two columns for better space utilization, with left/right alignment as is professional for metrics.
  const summaryData = [
    { label: "Total Orders", value: orders.length.toString() },
    { label: "Total Revenue", value: `${totalBilledAmount.toFixed(2)}` },
    { label: "Bar Sales", value: `${totalBarAmount.toFixed(2)}` },
    { label: "Cafe Sales", value: `${totalCafeAmount.toFixed(2)}` },
    { label: "CGST", value: `${totalCgst.toFixed(2)}` },
    { label: "SGST", value: `${totalSgst.toFixed(2)}` },
    { label: "Service Tax", value: `${totalServiceTax.toFixed(2)}` },
  ];

  doc.autoTable({
    startY: yPos,
    head: [["Metric", "Amount", "Payment Method", "Amount"]],
    body: [
      ...summaryData.slice(0, Math.ceil(summaryData.length / 2)).map((item, index) => {
        const paymentEntries = Object.entries(paymentBreakdown);
        const paymentItem = paymentEntries[index];
        return [
          item.label,
          item.value,
          paymentItem ? paymentItem[0] : "",
          paymentItem ? `${paymentItem[1].toFixed(2)}` : ""
        ];
      }),
      // Handle remaining summary items if odd number
      ...summaryData.slice(Math.ceil(summaryData.length / 2)).map((item) => [
        item.label,
        item.value,
        "",
        ""
      ])
    ],
    theme: "grid",
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 11,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 3,
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 50, fontStyle: "bold" },
      1: { halign: "right", cellWidth: 40 },
      2: { halign: "left", cellWidth: 50, fontStyle: "bold" },
      3: { halign: "right", cellWidth: 40 },
    },
    margin: { left: 15, right: 15 },
  });

  // Orders section with improved table design
  yPos = doc.lastAutoTable.finalY + 15;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("ORDER DETAILS", 15, yPos);
  doc.setLineWidth(0.1); // Added line under section title
  doc.line(15, yPos + 2, 15 + doc.getTextWidth("ORDER DETAILS"), yPos + 2);
  yPos += 8;

  const isBhuk = institutionData?.institution === "bhuk2323";
  
  // Optimized column structure for landscape orientation
  const tableColumns = [
    { header: "Order ID", dataKey: "orderId", width: 25 },
    { header: "Customer", dataKey: "customer", width: 35 },
    { header: "Table", dataKey: "table", width: 20 },
    ...(isBhuk ? [{ header: "Phone", dataKey: "phone", width: 30 }] : []),
    { header: "Date", dataKey: "date", width: 25 },
    { header: "Time", dataKey: "time", width: 25 },
    { header: "Payment", dataKey: "payment", width: 35 },
    { header: "Items", dataKey: "items", width: 80 }, // Adjusted width for more space
    { header: "Amount", dataKey: "amount", width: 25 },
  ];

  // Process orders data for the table
  const tableData = orders.map((order) => {
    const paymentMethod = order.paymentMethods
      ? Array.isArray(order.paymentMethods)
        ? order.paymentMethods.map((pm) => `${pm.method}(${pm.amount})`).join(", ")
        : Object.entries(order.paymentMethods)
            .map(([method, amount]) => `${method}(${amount})`)
            .join(", ")
      : order.paymentMethod || "Cash";

    // Format items more compactly
    const itemsText = order.items && Array.isArray(order.items)
      ? order.items.map(item => `${item.name}(${item.quantity})`).join(", ")
      : "No items";

    return {
      orderId: order.orderId || "N/A",
      customer: order.name || "N/A",
      table: order.tableName || "N/A",
      ...(isBhuk ? { phone: order.phoneNumber || "N/A" } : {}),
      date: new Date(order.createdAt).toLocaleDateString("en-IN"),
      time: new Date(order.createdAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }),
      payment: paymentMethod,
      items: itemsText,
      amount: `${order.totalAmount.toFixed(2)}`,
    };
  });

  doc.autoTable({
    startY: yPos,
    head: [tableColumns.map(col => col.header)],
    body: tableData.map(row => tableColumns.map(col => row[col.dataKey])),
    theme: "striped",
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 11,
      halign: "center",
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 10, // Increased body font size for better readability
      cellPadding: 2,
      textColor: [44, 62, 80],
      // Default all body cells to center alignment
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    columnStyles: Object.fromEntries(
      tableColumns.map((col, index) => [
        index,
        {
          cellWidth: col.width,
          // Override default center alignment for specific columns:
          // Amount should be right-aligned
          // Items should be left-aligned and wrapped
          halign: col.dataKey === "amount" ? "right" : 
                  col.dataKey === "items" ? "left" : "center",
          ...(col.dataKey === "items" ? { 
            fontSize: 10, // Increased font size for items
            overflow: "linebreak",
            cellPadding: 1.5 
          } : {}),
        }
      ])
    ),
    styles: {
      overflow: "linebreak",
      cellPadding: 2,
      // Global font size for the table, overridden by headStyles and bodyStyles
      fontSize: 7, 
      lineColor: [189, 195, 199],
      lineWidth: 0.1,
    },
    margin: { left: 15, right: 15 },
    pageBreak: "auto",
  });

  // Footer with totals and page numbers
  let finalY = doc.lastAutoTable.finalY + 10;
  
  // Add page numbers and summary footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Page number
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 15,
      doc.internal.pageSize.height - 10,
      { align: "right" }
    );
    
    // Footer summary on last page
    if (i === pageCount) {
      const footerY = Math.max(finalY, doc.internal.pageSize.height - 30); // Adjusted footer position
      
      doc.setLineWidth(0.5);
      doc.line(15, footerY - 5, doc.internal.pageSize.width - 15, footerY - 5);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`Total Revenue: ${totalBilledAmount.toFixed(2)}`, 15, footerY);
      doc.text(`Total Orders: ${orders.length}`, doc.internal.pageSize.width - 15, footerY, { align: "right" });
      
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.text(
        "This report is computer generated and does not require signature.",
        doc.internal.pageSize.width / 2,
        footerY + 8,
        { align: "center" }
      );
    }
  }

  doc.save(
    `${institutionData.companyName}_Order_Report_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}.pdf`
  );
};

const applyExcelStyles = (ws, data, headerRowCount = 1) => {
  const range = XLSX.utils.decode_range(ws['!ref']);
  const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: "2196F3" } }, alignment: { horizontal: "center" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
  const numberStyle = { numFmt: "#,##0.00", alignment: { horizontal: "right" } };
  const currencyStyle = { numFmt: "#,##0.00", alignment: { horizontal: "right" } };
  const textStyle = { alignment: { horizontal: "left", wrapText: true } };
  const dateStyle = { numFmt: "dd/mm/yyyy", alignment: { horizontal: "center" } };
  const totalStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FFFF00" } }, alignment: { horizontal: "right" } };

  // Apply header styles
  for (let C = range.s.c; C <= range.e.c; ++C) {
    for (let R = range.s.r; R < range.s.r + headerRowCount; ++R) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cell]) continue;
      ws[cell].s = headerStyle;
    }
  }

  // Apply body styles and detect totals
  for (let R = range.s.r + headerRowCount; R <= range.e.r; ++R) {
    const isTotalRow = data[R - headerRowCount] && (data[R - headerRowCount].Category === "TOTAL" || data[R - headerRowCount].Category === "GRAND TOTAL" || data[R - headerRowCount]["Order ID"] === "Summary");
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cell]) continue;
      if (isTotalRow) {
        ws[cell].s = { ...ws[cell].s, ...totalStyle };
      } else if (typeof ws[cell].v === "number") {
        if (ws[cell].v % 1 !== 0 || /Amount|Sales|Rate|Total|CGST|SGST|Service Tax|Price/i.test(Object.keys(data[0])[C])) {
          ws[cell].s = { ...ws[cell].s, ...currencyStyle };
        } else {
          ws[cell].s = { ...ws[cell].s, ...numberStyle };
        }
      } else if (/date/i.test(Object.keys(data[0])[C].toLowerCase())) {
        ws[cell].s = { ...ws[cell].s, ...dateStyle };
      } else {
        ws[cell].s = { ...ws[cell].s, ...textStyle };
      }
      // Borders for all cells
      ws[cell].s = { ...ws[cell].s, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } } };
    }
  }

  // Auto-size columns
  const colWidths = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let max = 10;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cell] && ws[cell].v) max = Math.max(max, (ws[cell].v.toString().length + 2));
    }
    colWidths.push({ wch: max });
  }
  ws['!cols'] = colWidths;

  // Enable filters
  ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
};

const exportItemExcel = (start, end, institutionData, allOrders) => {
  const { items } = buildItemReport(start, end, allOrders);
  // Prepare data for Excel
  const exportData = items.map((item) => ({
    "Item Name": item.name,
    Type: item.type,
    "Quantity Sold": item.quantity,
  }));
  // Add a header row for clarity
  const worksheetData = [
    { "Item Name": `${institutionData.companyName || "Company Name"} Item Report`, Type: "", "Quantity Sold": "" },
    ...exportData,
  ];
  const ws = XLSX.utils.json_to_sheet(worksheetData);
  applyExcelStyles(ws, worksheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Item Report");
  XLSX.writeFile(
    wb,
    `${institutionData.companyName}_item_report_${start.toISOString().slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString() ? `_to_${end.toISOString().slice(0, 10)}` : ""
    }.xlsx`
  );
};

const exportOrderExcel = (start, end, institutionData, allOrders) => {
  const {
    orders,
    totalBilledAmount,
    totalCgst,
    totalSgst,
    totalServiceTax,
    totalBarAmount,
    totalCafeAmount,
    paymentBreakdown,
    itemQuantities,
  } = buildOrderReport(start, end, allOrders);

  const ws = XLSX.utils.aoa_to_sheet([]); // Start with empty sheet for full control
  let row = 0;

  // === TITLE ROW ===
  const title = `${institutionData.companyName} Order Report`;
  XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: { r: row, c: 0 } });
  ws[`A${row + 1}`].s = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "center" },
    fill: { fgColor: { rgb: "E3F2FD" } },
  };
  ws["!merges"] = [{ s: { r: row, c: 0 }, e: { r: row, c: 15 } }];
  row += 2;

  // === DATE RANGE ===
  const dateRange = `Date Range: ${start.toLocaleDateString("en-IN")} to ${end.toLocaleDateString("en-IN")}`;
  XLSX.utils.sheet_add_aoa(ws, [[dateRange]], { origin: { r: row, c: 0 } });
  ws[`A${row + 1}`].s = {
    font: { italic: true, sz: 10 },
    alignment: { horizontal: "left" },
  };
  row += 2;

  // === SUMMARY SECTION ===
  XLSX.utils.sheet_add_aoa(ws, [["SUMMARY"]], { origin: { r: row, c: 0 } });
  ws[`A${row + 1}`].s = {
    font: { bold: true, sz: 12, color: { rgb: "1976D2" } },
    fill: { fgColor: { rgb: "BBDEFB" } },
    alignment: { horizontal: "left" },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
  };
  ws["!merges"].push({ s: { r: row, c: 0 }, e: { r: row, c: 15 } });
  row++;

  const summaryData = [
    ["Metric", "Value"],
    ["Total Orders", orders.length],
    ["Total Amount", totalBilledAmount],
    ["Bar Sales", totalBarAmount],
    ["Cafe Sales", totalCafeAmount],
    ["CGST", totalCgst],
    ["SGST", totalSgst],
    ["Service Tax", totalServiceTax],
  ];

  XLSX.utils.sheet_add_aoa(ws, summaryData, { origin: { r: row, c: 0 } });

  // Style summary header
  for (let c = 0; c <= 1; c++) {
    ws[XLSX.utils.encode_cell({ r: row, c })].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "2196F3" } },
      alignment: { horizontal: "center" },
      font: { color: { rgb: "FFFFFF" } },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };
  }

  // Style summary body
  for (let r = row + 1; r <= row + summaryData.length - 1; r++) {
    for (let c = 0; c <= 1; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      ws[cellRef].s = {
        alignment: c === 0 ? { horizontal: "left" } : { horizontal: "right" },
        font: { bold: r === row + 1 },
        fill: { fgColor: { rgb: r % 2 === 0 ? "F5F5F5" : "FFFFFF" } },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      };
      if (c === 1 && typeof ws[cellRef].v === "number") {
        ws[cellRef].z = "#,##0.00";
      }
    }
  }
  row += summaryData.length + 1;

  // === PAYMENT BREAKDOWN ===
  XLSX.utils.sheet_add_aoa(ws, [["PAYMENT BREAKDOWN"]], { origin: { r: row, c: 0 } });
  ws[`A${row + 1}`].s = {
    font: { bold: true, sz: 12, color: { rgb: "1976D2" } },
    fill: { fgColor: { rgb: "BBDEFB" } },
    alignment: { horizontal: "left" },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
  };
  ws["!merges"].push({ s: { r: row, c: 0 }, e: { r: row, c: 15 } });
  row++;

  const paymentData = [["Payment Method", "Amount"]];
  Object.entries(paymentBreakdown).forEach(([method, amount]) => {
    paymentData.push([method, amount]);
  });

  XLSX.utils.sheet_add_aoa(ws, paymentData, { origin: { r: row, c: 0 } });

  // Style payment header
  for (let c = 0; c <= 1; c++) {
    ws[XLSX.utils.encode_cell({ r: row, c })].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "2196F3" } },
      alignment: { horizontal: "center" },
      font: { color: { rgb: "FFFFFF" } },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };
  }

  // Style payment body
  for (let r = row + 1; r <= row + paymentData.length - 1; r++) {
    for (let c = 0; c <= 1; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      ws[cellRef].s = {
        alignment: c === 0 ? { horizontal: "left" } : { horizontal: "right" },
        fill: { fgColor: { rgb: r % 2 === 0 ? "F5F5F5" : "FFFFFF" } },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      };
      if (c === 1 && typeof ws[cellRef].v === "number") {
        ws[cellRef].z = "#,##0.00";
      }
    }
  }
  row += paymentData.length + 1;

  // === ORDERS SECTION ===
  XLSX.utils.sheet_add_aoa(ws, [["ORDERS"]], { origin: { r: row, c: 0 } });
  ws[`A${row + 1}`].s = {
    font: { bold: true, sz: 12, color: { rgb: "1976D2" } },
    fill: { fgColor: { rgb: "BBDEFB" } },
    alignment: { horizontal: "left" },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
  };
  ws["!merges"].push({ s: { r: row, c: 0 }, e: { r: row, c: 15 } });
  row++;

  // Define columns based on institution
  const isBhuk = institutionData?.institution === "bhuk2323";
  const baseHeaders = [
    "Order ID",
    "Customer",
    "Table",
    ...(isBhuk ? ["Phone"] : []),
    "Date",
    "Time",
    "Payment Method",
    "Total",
    "CGST",
    "SGST",
    "Service Tax",
    "Items", // Combined item details in one cell
  ];

  // Write headers
  XLSX.utils.sheet_add_aoa(ws, [baseHeaders], { origin: { r: row, c: 0 } });

  // Style headers
  for (let c = 0; c < baseHeaders.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: row, c });
    ws[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "1976D2" } },
      alignment: { horizontal: "center", wrapText: true },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };
  }
  row++;

  // Write order data with combined items in a single cell
  let outlineLevel = 1;
  orders.forEach((order) => {
    const paymentMethod = order.paymentMethods
      ? Array.isArray(order.paymentMethods)
        ? order.paymentMethods.map((pm) => `${pm.method} (${pm.amount})`).join("; ")
        : Object.entries(order.paymentMethods)
            .map(([method, amount]) => `${method} (${amount})`)
            .join("; ")
      : order.paymentMethod || "N/A";

    // Format items into a single string with line breaks
    const itemsString = order.items && Array.isArray(order.items)
      ? order.items.map(item =>
          `${item.name || "N/A"} (Qty: ${item.quantity || 0}, ${(item.price * item.quantity).toFixed(2)})`
        ).join("\n")
      : "N/A";

    // Main order row with combined items
    const orderRowData = [
      order.orderId,
      order.name || "N/A",
      order.tableName || "N/A",
      ...(isBhuk ? [order.phoneNumber || "N/A"] : []),
      new Date(order.createdAt).toLocaleDateString(),
      new Date(order.createdAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      paymentMethod,
      order.totalAmount,
      order.cgst ? (order.totalAmount * (order.cgst / 100)).toFixed(2) : "N/A",
      order.sgst ? (order.totalAmount * (order.sgst / 100)).toFixed(2) : "N/A",
      order.serviceTax || "N/A",
      itemsString, // Combined items in one cell
    ];

    XLSX.utils.sheet_add_aoa(ws, [orderRowData], { origin: { r: row, c: 0 } });

    // Style order row
    for (let c = 0; c < baseHeaders.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c });
      ws[cellRef].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "E3F2FD" } },
        alignment: (() => {
          if (c === baseHeaders.length - 1) { // Items column
            return { horizontal: "left", vertical: "top", wrapText: true };
          }
          if (c === 0 || c === 1 || c === 2 || (isBhuk && c === 3) || c === 6) return { horizontal: "left" };
          if ([7, 8, 9, 10].includes(c)) return { horizontal: "right" };
          return { horizontal: "center" };
        })(),
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      };
      if ([7, 8, 9, 10].includes(c) && typeof ws[cellRef].v === "number") {
        ws[cellRef].z = "#,##0.00";
      }
    }

    // Set row height for items cell
    const lines = itemsString.split('\n').length;
    ws[`A${row + 1}`].h = { hpt: Math.min(15 * lines, 100) }; // Max 100 points height

    // Set outline level for grouping
    if (!ws["!rows"]) ws["!rows"] = [];
    ws["!rows"][row] = { level: outlineLevel, hpt: Math.min(15 * lines, 100) };

    row++;
  });

  // === COLUMN WIDTHS ===
  const colWidths = baseHeaders.map((header, index) => {
    switch (header) {
      case "Order ID":
        return { wch: 12 };
      case "Customer":
        return { wch: 18 };
      case "Table":
        return { wch: 10 };
      case "Phone":
        return { wch: 12 };
      case "Date":
      case "Time":
        return { wch: 10 };
      case "Payment Method":
        return { wch: 20 };
      case "Total":
      case "CGST":
      case "SGST":
      case "Service Tax":
        return { wch: 12 };
      case "Items":
        return { wch: 50 }; // Wider column for items
      default:
        return { wch: 12 };
    }
  });
  ws["!cols"] = colWidths;

  // Enable filters on header row (orders section)
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: row - orders.length - 1, c: 0 }, e: { r: row - 1, c: baseHeaders.length - 1 } }) };

  // Freeze top row of orders
  ws["!freeze"] = { ySplit: row - orders.length - 1, xSplit: 0 };

  // Create workbook and save
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Order Report");

  XLSX.writeFile(
    wb,
    `${institutionData.companyName}_orders_${start.toISOString().slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString() ? `_to_${end.toISOString().slice(0, 10)}` : ""
    }.xlsx`
  );
};

// New Excel export for Cafe
const exportCafeExcel = (isoDate, stocks, institutionData) => {
  const { items } = buildCafeDailyReport(isoDate, stocks);
  const exportData = items.map((it) => ({
    "Item Name": it.stockName,
    "Opening kg/l": it.opening.kgL,
    "Opening g/ml": it.opening.gMl,
    "Opening piece": it.opening.piece,
    "Received kg/l": it.received.kgL,
    "Received g/ml": it.received.gMl,
    "Received piece": it.received.piece,
    "Consumption kg/l": it.consumption.kgL,
    "Consumption g/ml": it.consumption.gMl,
    "Consumption piece": it.consumption.piece,
    "Closing kg/l": it.closing.kgL,
    "Closing g/ml": it.closing.gMl,
    "Closing piece": it.closing.piece,
    Unit: it.unit,
  }));
  const ws = XLSX.utils.json_to_sheet(exportData);
  applyExcelStyles(ws, exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cafe Report");
  XLSX.writeFile(wb, `${institutionData.companyName}_cafe_report_${isoDate}.xlsx`);
};

// New Excel export for Bar
const exportBarExcel = (isoDate, stocks, allOrders, institutionData) => {
  const { categories, grandTotalAmount } = buildDailyReportByCategory(isoDate, "bar", stocks, allOrders);
  let exportData = [];
  categories.forEach((cat) => {
    exportData.push({
      Category: cat.category,
      Item: "",
      "Opening BTL": "",
      "Opening ML": "",
      "Received BTL": "",
      "Received ML": "",
      "Total BTL": "",
      "Total ML": "",
      "Transfer BTL": "",
      "Transfer ML": "",
      "Sales 60ML": "",
      "Sales 30ML": "",
      "Sales BTL": "",
      "Rate 60ML": "",
      "Rate 30ML": "",
      "Rate BTL": "",
      "Closing BTL": "",
      "Closing ML": "",
      Amount: "",
    });
    cat.items.forEach((it) => {
      const bottleSalesKeys = Object.keys(it.sales || {}).filter((k) => !["30 ml", "60 ml"].includes(k.toLowerCase()));
      const totalBottleSold = bottleSalesKeys.reduce((sum, k) => sum + safeNum(it.sales[k]), 0);
      const rate60ml = safeNum(it.unitRates?.["60 ml"] || 0);
      const rate30ml = safeNum(it.unitRates?.["30 ml"] || 0);
      const bottleRateKeys = Object.keys(it.unitRates || {}).filter((k) => !["30 ml", "60 ml"].includes(k.toLowerCase()));
      const rateBottle = bottleRateKeys.length > 0 ? safeNum(it.unitRates[bottleRateKeys[0]]) : 0;
      exportData.push({
        Category: "",
        Item: it.stockName,
        "Opening BTL": it.openingBTL.bottles,
        "Opening ML": it.openingBTL.remainder,
        "Received BTL": it.receivedBTL.bottles,
        "Received ML": it.receivedBTL.remainder,
        "Total BTL": it.totalBTL.bottles,
        "Total ML": it.totalBTL.remainder,
        "Transfer BTL": it.transferredBTL.bottles,
        "Transfer ML": it.transferredBTL.remainder,
        "Sales 60ML": safeNum(it.sales["60 ml"] || 0),
        "Sales 30ML": safeNum(it.sales["30 ml"] || 0),
        "Sales BTL": totalBottleSold,
        "Rate 60ML": rate60ml > 0 ? rate60ml : 0,
        "Rate 30ML": rate30ml > 0 ? rate30ml : 0,
        "Rate BTL": rateBottle > 0 ? rateBottle : 0,
        "Closing BTL": it.closingBTL.bottles,
        "Closing ML": it.closingBTL.remainder,
        Amount: safeNum(it.amount),
      });
    });
    exportData.push({
      Category: "TOTAL",
      Item: "",
      "Opening BTL": cat.totals.openingBTL.bottles,
      "Opening ML": cat.totals.openingBTL.remainder,
      "Received BTL": cat.totals.receivedBTL.bottles,
      "Received ML": cat.totals.receivedBTL.remainder,
      "Total BTL": cat.totals.totalBTL.bottles,
      "Total ML": cat.totals.totalBTL.remainder,
      "Transfer BTL": cat.totals.transferredBTL.bottles,
      "Transfer ML": cat.totals.transferredBTL.remainder,
      "Sales 60ML": safeNum(cat.totals.sales["60 ml"] || 0),
      "Sales 30ML": safeNum(cat.totals.sales["30 ml"] || 0),
      "Sales BTL": Object.entries(cat.totals.sales || {}).reduce(
        (sum, [k, v]) => (["30 ml", "60 ml"].includes(k.toLowerCase()) ? sum : sum + safeNum(v)),
        0
      ),
      "Rate 60ML": "",
      "Rate 30ML": "",
      "Rate BTL": "",
      "Closing BTL": cat.totals.closingBTL.bottles,
      "Closing ML": cat.totals.closingBTL.remainder,
      Amount: safeNum(cat.totals.amount),
    });
  });
  exportData.push({
    Category: "GRAND TOTAL",
    Item: "",
    "Opening BTL": "",
    "Opening ML": "",
    "Received BTL": "",
    "Received ML": "",
    "Total BTL": "",
    "Total ML": "",
    "Transfer BTL": "",
    "Transfer ML": "",
    "Sales 60ML": "",
    "Sales 30ML": "",
    "Sales BTL": "",
    "Rate 60ML": "",
    "Rate 30ML": "",
    "Rate BTL": "",
    "Closing BTL": "",
    "Closing ML": "",
    Amount: grandTotalAmount,
  });
  const ws = XLSX.utils.json_to_sheet(exportData);
  applyExcelStyles(ws, exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bar Report");
  XLSX.writeFile(wb, `${institutionData.companyName}_bar_report_${isoDate}.xlsx`);
};

const buildItemReferenceData = (menuItems) => {
  if (!menuItems || menuItems.length === 0) {
    return [];
  }
  const referenceData = [];
  menuItems
    .filter((item) => item.itemId)
    .sort((a, b) => {
      const aNum = parseInt(a.itemId.toString().replace(/\D/g, "")) || 0;
      const bNum = parseInt(b.itemId.toString().replace(/\D/g, "")) || 0;
      return aNum - bNum;
    })
    .forEach((item) => {
      const fullId = item.itemId.toString();
      let shorthandNo = "";
      if (fullId.startsWith("1000") && fullId.length === 5) {
        shorthandNo = fullId.substring(4);
      } else if (fullId.length === 5 && fullId.startsWith("100")) {
        shorthandNo = fullId.substring(3);
      } else {
        shorthandNo = fullId;
      }
      referenceData.push({
        "Shorthand Search": shorthandNo,
        "Item Name": item.itemName || "N/A",
        Category: item.category || "N/A",
        Price: item.price ? item.price : 0,
        Type: item.type || "N/A",
      });
    });
  return referenceData;
};

const exportItemReferenceExcel = (menuItems, institutionData) => {
  const referenceData = buildItemReferenceData(menuItems);
  const ws = XLSX.utils.json_to_sheet(referenceData);
  applyExcelStyles(ws, referenceData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Item ID Reference");
  XLSX.writeFile(
    wb,
    `${institutionData?.companyName || "Restaurant"}_Item_ID_Reference_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
};

const Report = () => {
  const { institutionData } = useContext(Context) || {};
  const institution = institutionData?.institution || institutionData?.id || institutionData?.name || "";
  const [stocks, setStocks] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [reportData, setReportData] = useState(null);

  const reportOptions = [
    { value: "", label: "Select Report" },
    { value: "bar", label: "Bar Daily Report" },
    { value: "cafe", label: "Cafe Daily Report" },
    { value: "item", label: "Item Report" },
    { value: "order", label: "Order Report" },
    { value: "itemId", label: "Item ID Reference" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!institution) {
          console.warn("No institution id available. Skipping fetch.");
          setStocks([]);
          setAllOrders([]);
          return;
        }
        const type = institutionData?.bar_integration === "Yes" ? "bar" : "cafe";
        const [stockResponse, orderResponse, menuResponse] = await Promise.all([
          API.get("main", `/admin/stock-list-items/${institution}`),
          API.get("main", `/admin/list-orders/${institution}?type=${type}`, {}),
          API.get("main", `/any/list-items/${institution}`),
        ]);
        setStocks(stockResponse || []);
        const paidOrders = (orderResponse || []).filter((order) => order.paymentStatus === true);
        setAllOrders(paidOrders);
        setMenuItems(menuResponse || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [institution]);

  useEffect(() => {
    if (!selectedReport || loading) return;

    let effectiveEnd = ["bar", "cafe"].includes(selectedReport) ? new Date(startDate) : endDate;

    if (selectedReport === "itemId") {
      const data = buildItemReferenceData(menuItems);
      setReportData({ type: "itemId", data });
    } else {
      const isoStart = startDate.toISOString().slice(0, 10);
      if (selectedReport === "bar") {
        const data = buildDailyReportByCategory(isoStart, "bar", stocks, allOrders);
        setReportData({ type: "bar", data });
      } else if (selectedReport === "cafe") {
        const data = buildCafeDailyReport(isoStart, stocks);
        setReportData({ type: "cafe", data });
      } else if (selectedReport === "item") {
        const data = buildItemReport(startDate, effectiveEnd, allOrders);
        setReportData({ type: "item", data });
      } else if (selectedReport === "order") {
        const data = buildOrderReport(startDate, effectiveEnd, allOrders);
        setReportData({ type: "order", data });
      }
    }
  }, [selectedReport, startDate, endDate, stocks, allOrders, menuItems, loading]);

  const getDateLimits = () => {
    const today = new Date();
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);
    return { minDate: twoMonthsAgo, maxDate: today };
  };

  const handleDateSelection = (date, setDateFunction, closePicker) => {
    if (!date) return;
    const { minDate, maxDate } = getDateLimits();
    if (date >= minDate && date <= maxDate) {
      setDateFunction(date);
    } else {
      alert("Selected date is out of allowed range (last 2 months).");
    }
    closePicker(false);
  };

  if (loading) return <Loader />;

  const renderPreview = () => {
    if (!reportData) return <p className="text-gray-500">Select a report to preview.</p>;

    switch (reportData.type) {
      case "cafe":
        const { items: cafeItems } = reportData.data;
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th rowSpan="2" className="px-4 py-2 border text-left">Item</th>
                  <th colSpan="3" className="px-4 py-2 border text-center">Opening</th>
                  <th colSpan="3" className="px-4 py-2 border text-center">Received</th>
                  <th colSpan="3" className="px-4 py-2 border text-center">Consumption</th>
                  <th colSpan="3" className="px-4 py-2 border text-center">Closing</th>
                </tr>
                <tr>
                  <th className="px-4 py-2 border text-right">kg/l</th>
                  <th className="px-4 py-2 border text-right">g/ml</th>
                  <th className="px-4 py-2 border text-right">piece</th>
                  <th className="px-4 py-2 border text-right">kg/l</th>
                  <th className="px-4 py-2 border text-right">g/ml</th>
                  <th className="px-4 py-2 border text-right">piece</th>
                  <th className="px-4 py-2 border text-right">kg/l</th>
                  <th className="px-4 py-2 border text-right">g/ml</th>
                  <th className="px-4 py-2 border text-right">piece</th>
                  <th className="px-4 py-2 border text-right">kg/l</th>
                  <th className="px-4 py-2 border text-right">g/ml</th>
                  <th className="px-4 py-2 border text-right">piece</th>
                </tr>
              </thead>
              <tbody>
                {cafeItems.map((it, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="px-4 py-2 border text-left">{it.stockName.substring(0, 20)}</td>
                    <td className="px-4 py-2 border text-right">{formatNumber(it.opening.kgL)}</td>
                    <td className="px-4 py-2 border text-right">{it.opening.gMl.toFixed(0)}</td>
                    <td className="px-4 py-2 border text-right">{it.opening.piece}</td>
                    <td className="px-4 py-2 border text-right">{formatNumber(it.received.kgL)}</td>
                    <td className="px-4 py-2 border text-right">{it.received.gMl.toFixed(0)}</td>
                    <td className="px-4 py-2 border text-right">{it.received.piece}</td>
                    <td className="px-4 py-2 border text-right">{formatNumber(it.consumption.kgL)}</td>
                    <td className="px-4 py-2 border text-right">{it.consumption.gMl.toFixed(0)}</td>
                    <td className="px-4 py-2 border text-right">{it.consumption.piece}</td>
                    <td className="px-4 py-2 border text-right">{formatNumber(it.closing.kgL)}</td>
                    <td className="px-4 py-2 border text-right">{it.closing.gMl.toFixed(0)}</td>
                    <td className="px-4 py-2 border text-right">{it.closing.piece}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "bar":
        const { categories: barCategories, grandTotalAmount } = reportData.data;
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th rowSpan="2" className="px-4 py-2 border text-left">ITEM</th>
                  <th colSpan="2" className="px-4 py-2 border text-center">OPENING</th>
                  <th colSpan="2" className="px-4 py-2 border text-center">RECEIVED</th>
                  <th colSpan="2" className="px-4 py-2 border text-center">TOTAL</th>
                  <th colSpan="2" className="px-4 py-2 border text-center">TRANSFER</th>
                  <th colSpan="3" className="px-4 py-2 border text-center">SALES</th>
                  <th colSpan="3" className="px-4 py-2 border text-center">RATE</th>
                  <th colSpan="2" className="px-4 py-2 border text-center">CLOSING</th>
                  <th rowSpan="2" className="px-4 py-2 border text-right">AMOUNT</th>
                </tr>
                <tr>
                  <th className="px-4 py-2 border text-center">BTL</th>
                  <th className="px-4 py-2 border text-center">ML</th>
                  <th className="px-4 py-2 border text-center">BTL</th>
                  <th className="px-4 py-2 border text-center">ML</th>
                  <th className="px-4 py-2 border text-center">BTL</th>
                  <th className="px-4 py-2 border text-center">ML</th>
                  <th className="px-4 py-2 border text-center">BTL</th>
                  <th className="px-4 py-2 border text-center">ML</th>
                  <th className="px-4 py-2 border text-center">60ML</th>
                  <th className="px-4 py-2 border text-center">30ML</th>
                  <th className="px-4 py-2 border text-center">BTL</th>
                  <th className="px-4 py-2 border text-center">60ML</th>
                  <th className="px-4 py-2 border text-center">30ML</th>
                  <th className="px-4 py-2 border text-center">BTL</th>
                  <th className="px-4 py-2 border text-center">BTL</th>
                  <th className="px-4 py-2 border text-center">ML</th>
                </tr>
              </thead>
              <tbody>
                {barCategories.map((cat, catIndex) => (
                  <React.Fragment key={catIndex}>
                    <tr>
                      <td colSpan="18" className="px-4 py-2 border text-center font-bold bg-gray-200">
                        {cat.category}
                      </td>
                    </tr>
                    {cat.items.map((it, index) => {
                      const bottleSalesKeys = Object.keys(it.sales || {}).filter(
                        (k) => !["30 ml", "60 ml"].includes(k.toLowerCase())
                      );
                      const totalBottleSold = bottleSalesKeys.reduce((sum, k) => sum + safeNum(it.sales[k]), 0);
                      const rate60ml = safeNum(it.unitRates?.["60 ml"] || 0);
                      const rate30ml = safeNum(it.unitRates?.["30 ml"] || 0);
                      const bottleRateKeys = Object.keys(it.unitRates || {}).filter(
                        (k) => !["30 ml", "60 ml"].includes(k.toLowerCase())
                      );
                      const rateBottle = bottleRateKeys.length > 0 ? safeNum(it.unitRates[bottleRateKeys[0]]) : 0;
                      return (
                        <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                          <td className="px-4 py-2 border text-left">{it.stockName.substring(0, 12)}</td>
                          <td className="px-4 py-2 border text-center">{it.openingBTL.bottles}</td>
                          <td className="px-4 py-2 border text-center">{it.openingBTL.remainder}</td>
                          <td className="px-4 py-2 border text-center">{it.receivedBTL.bottles}</td>
                          <td className="px-4 py-2 border text-center">{it.receivedBTL.remainder}</td>
                          <td className="px-4 py-2 border text-center">{it.totalBTL.bottles}</td>
                          <td className="px-4 py-2 border text-center">{it.totalBTL.remainder}</td>
                          <td className="px-4 py-2 border text-center">{it.transferredBTL.bottles}</td>
                          <td className="px-4 py-2 border text-center">{it.transferredBTL.remainder}</td>
                          <td className="px-4 py-2 border text-center">{safeNum(it.sales["60 ml"] || 0)}</td>
                          <td className="px-4 py-2 border text-center">{safeNum(it.sales["30 ml"] || 0)}</td>
                          <td className="px-4 py-2 border text-center">{totalBottleSold}</td>
                          <td className="px-4 py-2 border text-center">{rate60ml > 0 ? rate60ml.toFixed(0) : "0"}</td>
                          <td className="px-4 py-2 border text-center">{rate30ml > 0 ? rate30ml.toFixed(0) : "0"}</td>
                          <td className="px-4 py-2 border text-center">{rateBottle > 0 ? rateBottle.toFixed(0) : "0"}</td>
                          <td className="px-4 py-2 border text-center">{it.closingBTL.bottles}</td>
                          <td className="px-4 py-2 border text-center">{it.closingBTL.remainder}</td>
                          <td className="px-4 py-2 border text-right">{safeNum(it.amount).toFixed(0)}</td>
                        </tr>
                      );
                    })}
                    <tr className="font-bold bg-gray-100">
                      <td className="px-4 py-2 border text-left">TOTAL:</td>
                      <td className="px-4 py-2 border text-center">{cat.totals.openingBTL.bottles}</td>
                      <td className="px-4 py-2 border text-center">{cat.totals.openingBTL.remainder}</td>
                      <td className="px-4 py-2 border text-center">{cat.totals.receivedBTL.bottles}</td>
                      <td className="px-4 py-2 border text-center">{cat.totals.receivedBTL.remainder}</td>
                      <td className="px-4 py-2 border text-center">{cat.totals.totalBTL.bottles}</td>
                      <td className="px-4 py-2 border text-center">{cat.totals.totalBTL.remainder}</td>
                      <td className="px-4 py-2 border text-center">{cat.totals.transferredBTL.bottles}</td>
                      <td className="px-4 py-2 border text-center">{cat.totals.transferredBTL.remainder}</td>
                      <td className="px-4 py-2 border text-center">{safeNum(cat.totals.sales["60 ml"] || 0)}</td>
                      <td className="px-4 py-2 border text-center">{safeNum(cat.totals.sales["30 ml"] || 0)}</td>
                      <td className="px-4 py-2 border text-center">
                        {Object.entries(cat.totals.sales || {}).reduce(
                          (sum, [k, v]) => (["30 ml", "60 ml"].includes(k.toLowerCase()) ? sum : sum + safeNum(v)),
                          0
                        )}
                      </td>
                      <td className="px-4 py-2 border text-center"></td>
                      <td className="px-4 py-2 border text-center"></td>
                      <td className="px-4 py-2 border text-center"></td>
                      <td className="px-4 py-2 border text-center">{cat.totals.closingBTL.bottles}</td>
                      <td className="px-4 py-2 border text-center">{cat.totals.closingBTL.remainder}</td>
                      <td className="px-4 py-2 border text-right">{safeNum(cat.totals.amount).toFixed(0)}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-right font-bold">Grand Total: {grandTotalAmount.toFixed(2)}</div>
          </div>
        );
      case "item":
        const { items: itemItems } = reportData.data;
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-left">Item Name</th>
                  <th className="px-4 py-2 border text-center">Type</th>
                  <th className="px-4 py-2 border text-right">Quantity Sold</th>
                </tr>
              </thead>
              <tbody>
                {itemItems.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="px-4 py-2 border text-left">{item.name}</td>
                    <td className="px-4 py-2 border text-center">{item.type}</td>
                    <td className="px-4 py-2 border text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case "order":
        const {
          orders,
          totalBilledAmount,
          totalCgst,
          totalSgst,
          totalServiceTax,
          totalBarAmount,
          totalCafeAmount,
          paymentBreakdown,
        } = reportData.data;
        return (
          <div className="overflow-x-auto">
            {/* Summary Table */}
            <h2 className="text-xl font-bold mb-4">Order Summary</h2>
            <table className="min-w-full bg-white border border-gray-300 mb-6">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-left">Metric</th>
                  <th className="px-4 py-2 border text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 border text-left">Total Orders</td>
                  <td className="px-4 py-2 border text-right">{orders.length}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 border text-left">Total Amount</td>
                  <td className="px-4 py-2 border text-right">{totalBilledAmount.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 border text-left">Bar Sales</td>
                  <td className="px-4 py-2 border text-right">{totalBarAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 border text-left">Cafe Sales</td>
                  <td className="px-4 py-2 border text-right">{totalCafeAmount.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 border text-left">CGST</td>
                  <td className="px-4 py-2 border text-right">{totalCgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 border text-left">SGST</td>
                  <td className="px-4 py-2 border text-right">{totalSgst.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 border text-left">Service Tax</td>
                  <td className="px-4 py-2 border text-right">{totalServiceTax.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Payment Breakdown Table */}
            <h3 className="text-lg font-semibold mb-2">Payment Breakdown</h3>
            <table className="min-w-full bg-white border border-gray-300 mb-6">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-left">Payment Method</th>
                  <th className="px-4 py-2 border text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(paymentBreakdown).map(([method, amount], index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="px-4 py-2 border text-left">{method}</td>
                    <td className="px-4 py-2 border text-right">{amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Orders Table */}
            <h2 className="text-xl font-bold mb-4">Orders</h2>
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-left">Order ID</th>
                  <th className="px-4 py-2 border text-left">Customer</th>
                  <th className="px-4 py-2 border text-left">Table</th>
                  {institutionData?.institution === "bhuk2323" && (
                    <th className="px-4 py-2 border text-left">Phone</th>
                  )}
                  <th className="px-4 py-2 border text-center">Date</th>
                  <th className="px-4 py-2 border text-center">Time</th>
                  <th className="px-4 py-2 border text-left">Payment Method</th>
                  <th className="px-4 py-2 border text-right">Total</th>
                  <th className="px-4 py-2 border text-right">CGST</th>
                  <th className="px-4 py-2 border text-right">SGST</th>
                  <th className="px-4 py-2 border text-right">Service Tax</th>
                  <th className="px-4 py-2 border text-left">Items</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => {
                  const paymentMethod = order.paymentMethods
                    ? Array.isArray(order.paymentMethods)
                      ? order.paymentMethods.map((pm) => `${pm.method} (${pm.amount})`).join(", ")
                      : Object.entries(order.paymentMethods)
                          .map(([method, amount]) => `${method} (${amount})`)
                          .join(", ")
                    : order.paymentMethod || "N/A";
                  const itemsSummary = order.items
                    ? order.items
                        .map((item) => `${item.name || "N/A"} (Qty: ${item.quantity || 0})`)
                        .join(", ")
                    : "N/A";
                  return (
                    <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="px-4 py-2 border text-left">{order.orderId}</td>
                      <td className="px-4 py-2 border text-left">{order.name || "N/A"}</td>
                      <td className="px-4 py-2 border text-left">{order.tableName || "N/A"}</td>
                      {institutionData?.institution === "bhuk2323" && (
                        <td className="px-4 py-2 border text-left">{order.phoneNumber || "N/A"}</td>
                      )}
                      <td className="px-4 py-2 border text-center">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2 border text-center">
                        {new Date(order.createdAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="px-4 py-2 border text-left">{paymentMethod}</td>
                      <td className="px-4 py-2 border text-right">{order.totalAmount}</td>
                      <td className="px-4 py-2 border text-right">
                        {order.cgst ? `${(order.totalAmount * (order.cgst / 100)).toFixed(2)}` : "N/A"}
                      </td>
                      <td className="px-4 py-2 border text-right">
                        {order.sgst ? `${(order.totalAmount * (order.sgst / 100)).toFixed(2)}` : "N/A"}
                      </td>
                      <td className="px-4 py-2 border text-right">{order.serviceTax || "N/A"}</td>
                      <td className="px-4 py-2 border text-left">{itemsSummary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      case "itemId":
        const itemIdData = reportData.data;
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 border text-left">Shorthand Search</th>
                  <th className="px-4 py-2 border text-left">Item Name</th>
                  <th className="px-4 py-2 border text-left">Category</th>
                  <th className="px-4 py-2 border text-right">Price</th>
                  <th className="px-4 py-2 border text-left">Type</th>
                </tr>
              </thead>
              <tbody>
                {itemIdData.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="px-4 py-2 border text-left">{item["Shorthand Search"]}</td>
                    <td className="px-4 py-2 border text-left">{item["Item Name"]}</td>
                    <td className="px-4 py-2 border text-left">{item.Category}</td>
                    <td className="px-4 py-2 border text-right">{item.Price}</td>
                    <td className="px-4 py-2 border text-left">{item.Type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return null;
    }
  };

  const renderExportButtons = () => {
    if (!selectedReport) return null;

    const isoDate = startDate.toISOString().slice(0, 10);
    switch (selectedReport) {
      case "bar":
        return (
          <>
            <Button
              onClick={() => exportDailyReport(isoDate, stocks, allOrders, institutionData)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              PDF Bar Report
            </Button>
            <Button
              onClick={() => exportBarExcel(isoDate, stocks, allOrders, institutionData)}
              className="bg-green-600 hover:bg-green-700"
            >
              Excel Bar Report
            </Button>
          </>
        );
      case "cafe":
        return (
          <>
            <Button
              onClick={() => exportCafeDailyReport(isoDate, stocks, institutionData)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              PDF Cafe Report
            </Button>
            <Button
              onClick={() => exportCafeExcel(isoDate, stocks, institutionData)}
              className="bg-green-600 hover:bg-green-700"
            >
              Excel Cafe Report
            </Button>
          </>
        );
      case "item":
        return (
          <>
            <Button
              onClick={() => exportItemPDF(startDate, endDate, institutionData, allOrders)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              PDF Item Report
            </Button>
            <Button
              onClick={() => exportItemExcel(startDate, endDate, institutionData, allOrders)}
              className="bg-green-600 hover:bg-green-700"
            >
              Excel Item Report
            </Button>
          </>
        );
      case "order":
        return (
          <>
            <Button
              onClick={() => exportOrderPDF(startDate, endDate, institutionData, allOrders)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              PDF Order Report
            </Button>
            <Button
              onClick={() => exportOrderExcel(startDate, endDate, institutionData, allOrders)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Excel Order Report
            </Button>
          </>
        );
      case "itemId":
        return (
          <Button
            onClick={() => exportItemReferenceExcel(menuItems, institutionData)}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Excel Item ID Reference
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-6 sm:p-8 lg:p-10 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      {/* Filters Sidebar */}
      <div className="lg:w-1/4 bg-white p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold text-indigo-700 mb-6">Filters</h2>

        <label className="block text-gray-600 font-medium text-sm mb-2">Choose Report:</label>
        <select
          value={selectedReport}
          onChange={(e) => setSelectedReport(e.target.value)}
          className="border border-gray-300 rounded-lg p-2.5 w-full bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm mb-6"
        >
          {reportOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {selectedReport && selectedReport !== "itemId" && (
          <>
            {/* Start Date */}
            <div className="mb-4">
              <label className="block text-gray-600 font-medium text-sm mb-2">Start Date:</label>
              <div className="relative">
                <button
                  onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                  className="border border-gray-300 rounded-lg p-2.5 bg-white w-full text-left focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm text-gray-800"
                >
                  {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </button>
                {showStartDatePicker && (
                  <div className="absolute z-20 mt-2 bg-white shadow-2xl rounded-lg border border-gray-200">
                    <DayPicker
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => handleDateSelection(date, setStartDate, setShowStartDatePicker)}
                      fromDate={getDateLimits().minDate}
                      toDate={getDateLimits().maxDate}
                      className="p-4"
                      classNames={{
                        day: "text-gray-800 hover:bg-indigo-100 rounded-full",
                        day_selected: "bg-indigo-600 text-white rounded-full",
                        caption: "text-lg font-semibold text-gray-900",
                        nav_button: "text-gray-600 hover:bg-gray-100 rounded-full p-1",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* End Date */}
            {["item", "order"].includes(selectedReport) && (
              <div>
                <label className="block text-gray-600 font-medium text-sm mb-2">End Date:</label>
                <div className="relative">
                  <button
                    onClick={() => setShowEndDatePicker(!showEndDatePicker)}
                    className="border border-gray-300 rounded-lg p-2.5 bg-white w-full text-left focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm text-gray-800"
                  >
                    {endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </button>
                  {showEndDatePicker && (
                    <div className="absolute z-20 mt-2 bg-white shadow-2xl rounded-lg border border-gray-200">
                      <DayPicker
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => handleDateSelection(date, setEndDate, setShowEndDatePicker)}
                        fromDate={Math.max(startDate, getDateLimits().minDate)}
                        toDate={getDateLimits().maxDate}
                        className="p-4"
                        classNames={{
                          day: "text-gray-800 hover:bg-indigo-100 rounded-full",
                          day_selected: "bg-indigo-600 text-white rounded-full",
                          caption: "text-lg font-semibold text-gray-900",
                          nav_button: "text-gray-600 hover:bg-gray-100 rounded-full p-1",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Preview Section */}
      <div className="lg:w-3/4 flex flex-col">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-6 text-indigo-700 tracking-tight">
          {institutionData?.companyName || "Company"} Reports
        </h1>

        <div className="bg-white p-6 rounded-xl shadow-md overflow-y-auto max-h-[70vh]">
          {renderPreview()}
        </div>

        <div className="flex flex-wrap justify-start gap-4 mt-6">
          {renderExportButtons()}
        </div>
      </div>
    </div>
  );
};

export default Report;
