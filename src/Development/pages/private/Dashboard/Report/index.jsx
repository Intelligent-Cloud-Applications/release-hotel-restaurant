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
import {
  ChevronDown,
  Filter,
  RefreshCw,
  Download,
  FileText,
  FileSpreadsheet,
  Calendar,
  Search,
  Eye,
  EyeOff,
} from "lucide-react";

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

// utility to format combined quantity strings for cafe display
const formatKgMlString = (qty, unit) => {
  // qty assumed to be numeric in base units (g or ml) or for kg/l units passed as numbers in kg/l
  if (unit === "piece" || unit === "pieces" || unit === "pc") {
    return `${safeNum(qty)} pcs`;
  }
  if (unit === "kg") {
    // qty in kg (may be fractional)
    const wholeKg = Math.floor(qty);
    const grams = Math.round((qty - wholeKg) * 1000);
    if (wholeKg > 0 && grams > 0) return `${wholeKg}kg ${grams}g`;
    if (wholeKg > 0) return `${wholeKg}kg`;
    return `${grams}g`;
  }
  if (unit === "g") {
    const kg = Math.floor(qty / 1000);
    const g = qty % 1000;
    if (kg > 0 && g > 0) return `${kg}kg ${g}g`;
    if (kg > 0) return `${kg}kg`;
    return `${g}g`;
  }
  if (unit === "l") {
    const wholeL = Math.floor(qty);
    const ml = Math.round((qty - wholeL) * 1000);
    if (wholeL > 0 && ml > 0) return `${wholeL}L ${ml}ml`;
    if (wholeL > 0) return `${wholeL}L`;
    return `${ml}ml`;
  }
  if (unit === "ml") {
    const l = Math.floor(qty / 1000);
    const ml = qty % 1000;
    if (l > 0 && ml > 0) return `${l}L ${ml}ml`;
    if (l > 0) return `${l}L`;
    return `${ml}ml`;
  }
  // fallback — show raw
  return String(qty);
};

const formatNumber = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return "0";
  const rounded = Number(Number(num).toFixed(2));
  return rounded % 1 === 0
    ? rounded.toString()
    : rounded.toFixed(2).replace(/\.?0+$/, "");
};

const buildCafeDailyReport = (isoDate, stocks) => {
  const key = dateToKey(isoDate);
  const items = [];

  stocks
    .filter((s) => s.type === "cafe")
    .forEach((stock) => {
      const update = (stock.stockupdate || {})[key] || {};
      const hasUpdate = Object.keys(update).length > 0;
      const openingRaw = hasUpdate
        ? update.openingStock ?? update.opening ?? update.open ?? 0
        : stock.quantity ?? 0;
      const receivedRaw = update.received ?? 0;
      const unit = stock.unit || "g";

      // convert raw to base numeric ml/g as per parseVolumeToMl (returns numeric ml for ml units; for pieces parseVolumeToMl should return number as is)
      let openingQty = parseVolumeToMl(openingRaw);
      let receivedQty = parseVolumeToMl(receivedRaw);

      if (unit === "piece") {
        openingQty = safeNum(openingRaw);
        receivedQty = safeNum(receivedRaw);
      }

      // compute consumption by iterating update keys (excluding known keys)
      let consumptionQty = 0;
      Object.keys(update).forEach((k) => {
        if (
          !["openingStock", "opening", "open", "received"].includes(k) &&
          !k.startsWith("unitRate_")
        ) {
          const cnt = safeNum(update[k] ?? 0);
          const num = Number(String(k).match(/\d+/)?.[0] || 1);
          consumptionQty += cnt * num;
        }
      });

      const totalQty = openingQty + receivedQty;
      const closingQty = Math.max(0, totalQty - consumptionQty);

      // For display, convert numeric base quantities into human-friendly strings
      // If unit in kg/l context: parseVolumeToMl likely returned ml for ml units; we need to convert properly.
      // We'll normalize:
      const isWeight = ["kg", "g"].includes(unit);
      const isVolume = ["l", "ml"].includes(unit);

      const displayOpening = (() => {
        if (unit === "piece") return formatKgMlString(openingQty, "piece");
        if (isWeight) {
          // openingQty might be provided as grams if parseVolumeToMl returns ml for volumes;
          // assume original openingRaw was in either 'kg' or 'g' strings and parseVolumeToMl returned numeric in ml for volumes.
          // If stock.unit === 'kg' the parseVolumeToMl might be used inconsistently by codebase. We'll attempt to interpret:
          // If parseVolumeToMl produced a number and unit is weight, we try to interpret openingRaw directly if numeric and accompanied by unit string in stock.oneBottleVolume maybe.
          // To keep it consistent: if unit === 'kg' and openingRaw seems numeric in kg, use openingRaw, else if openingQty seems large (>1000) treat as grams.
          const numeric = Number(openingRaw);
          if (
            !Number.isNaN(numeric) &&
            String(openingRaw).toString().includes("kg")
          ) {
            return formatKgMlString(numeric, "kg");
          }
          // fallback: treat openingQty as grams if large
          if (openingQty > 1000) return formatKgMlString(openingQty, "g");
          return formatKgMlString(openingQty, "g");
        }
        if (isVolume) {
          // parseVolumeToMl returns ml number for ml/l
          // If unit === 'l', openingRaw might already be in liters — but parseVolumeToMl returns ml
          // Convert ml to liters for display
          const ml = openingQty;
          return formatKgMlString(ml, "ml");
        }
        // fallback
        return String(openingQty);
      })();

      const displayReceived = (() => {
        if (unit === "piece") return formatKgMlString(receivedQty, "piece");
        if (["kg", "g"].includes(unit)) {
          if (receivedQty > 1000) return formatKgMlString(receivedQty, "g");
          return formatKgMlString(receivedQty, "g");
        }
        if (["l", "ml"].includes(unit)) {
          return formatKgMlString(receivedQty, "ml");
        }
        return String(receivedQty);
      })();

      const displayConsumption = (() => {
        if (unit === "piece") return formatKgMlString(consumptionQty, "piece");
        if (["kg", "g"].includes(unit)) {
          return formatKgMlString(consumptionQty, "g");
        }
        if (["l", "ml"].includes(unit)) {
          return formatKgMlString(consumptionQty, "ml");
        }
        return String(consumptionQty);
      })();

      const displayClosing = (() => {
        if (unit === "piece") return formatKgMlString(closingQty, "piece");
        if (["kg", "g"].includes(unit)) {
          return formatKgMlString(closingQty, "g");
        }
        if (["l", "ml"].includes(unit)) {
          return formatKgMlString(closingQty, "ml");
        }
        return String(closingQty);
      })();

      items.push({
        stockId: stock.stockId,
        stockName: stock.stockName || stock.name || "-",
        openingRaw,
        receivedRaw,
        consumptionRaw: consumptionQty,
        closingRaw: closingQty,
        openingDisplay: displayOpening,
        receivedDisplay: displayReceived,
        consumptionDisplay: displayConsumption,
        closingDisplay: displayClosing,
        unit,
      });
    });

  items.sort((a, b) => a.stockName.localeCompare(b.stockName));
  return { items };
};

// Professional PDF styling helper
const addProfessionalHeader = (doc, title, subtitle, dateText, generatedText) => {
  // Company header with proper spacing
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  
  const titleWidth = doc.getTextWidth(title);
  const centerX = doc.internal.pageSize.width / 2;
  doc.text(title, centerX - titleWidth / 2, 20);

  // Subtitle
  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  const subtitleWidth = doc.getTextWidth(subtitle);
  doc.text(subtitle, centerX - subtitleWidth / 2, 30);

  // Date and generated info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(dateText, 20, 45);
  const generatedWidth = doc.getTextWidth(generatedText);
  doc.text(generatedText, doc.internal.pageSize.width - 20 - generatedWidth, 45);

  // Professional line separator
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.line(20, 50, doc.internal.pageSize.width - 20, 50);

  return 60; // Return Y position for content start
};

const addProfessionalFooter = (doc, pageNum, totalPages, additionalText = "") => {
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  
  // Footer line
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(20, pageHeight - 25, pageWidth - 20, pageHeight - 25);
  
  // Page numbers
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 40, pageHeight - 15);
  
  // Additional text if provided
  if (additionalText) {
    const textWidth = doc.getTextWidth(additionalText);
    doc.text(additionalText, (pageWidth - textWidth) / 2, pageHeight - 10);
  }
};

// Requires: jsPDF, jsPDF-AutoTable
// Requires: jsPDF, jsPDF-AutoTable
const exportCafeDailyReport = (builtData, institutionData = {}, isoDate, options = {}) => {
  const { includeLogo = false, logoDataUrl = null, filenamePrefix = "" } = options;

  if (!isoDate) {
    alert("Choose a date first");
    return;
  }
  const { items = [] } = builtData || {};
  if (!Array.isArray(items) || items.length === 0) {
    alert("No items found for the selected date.");
    return;
  }

  // PDF setup
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  const pageWidth = doc.internal.pageSize.width;
  const margin = { left: 18, right: 18, top: 18, bottom: 18 };

  // Time strings (Asia/Kolkata)
  const currentTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const companyName = (institutionData?.companyName || "COMPANY NAME").toString();
  const titleText = `${companyName.toUpperCase()}`;
  const subtitleText = "CAFE DAILY STOCK REPORT";
  const dateText = `Report Date: ${isoDate.split("-").reverse().join("/")}`;
  const generatedText = `Generated: ${currentTime}`;

  // Header (only first page)
  const addHeader = () => {
    const headerY = margin.top;
    const logoSize = 18;
    if (includeLogo && logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, "PNG", margin.left, headerY - 2, logoSize, logoSize, undefined, "FAST");
      } catch {}
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    const leftX = includeLogo && logoDataUrl ? margin.left + (logoSize + 6) : margin.left;
    doc.text(titleText, leftX, headerY + 4);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const subX = pageWidth - margin.right;
    doc.text(subtitleText, subX, headerY + 4, { align: "right" });

    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(dateText, leftX, headerY + 10);
    doc.text(generatedText, subX, headerY + 10, { align: "right" });

    doc.setDrawColor(220);
    doc.setLineWidth(0.4);
    doc.line(margin.left, headerY + 13, pageWidth - margin.right, headerY + 13);
  };

  // Footer (all pages)
  const addFooter = (pageNumber, totalPages) => {
    const footerY = doc.internal.pageSize.height - margin.bottom + 6;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");
    doc.text(
      "This document is computer generated and requires no signature for authenticity.",
      margin.left,
      footerY
    );
    const pageText = `Page ${pageNumber} / ${totalPages}`;
    doc.text(pageText, pageWidth - margin.right, footerY, { align: "right" });
  };

  // Page 1 header
  addHeader();

  // Executive Summary
  let yPos = margin.top + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40);
  doc.text("EXECUTIVE SUMMARY", margin.left, yPos);

  yPos += 6;
  doc.setDrawColor(230);
  doc.setLineWidth(0.3);
  doc.line(margin.left, yPos, margin.left + 55, yPos);

  yPos += 8;
  const totalItems = items.length;
  const totalReceived = items.reduce((s, it) => s + Number(it.received || 0), 0);
  const totalConsumed = items.reduce((s, it) => s + Number(it.consumption || 0), 0);
  const totalClosing = items.reduce((s, it) => s + Number(it.closing || 0), 0);

  const summaryRows = [
    ["Total Items Tracked", String(totalItems)],
    ["Total Received (sum)", String(totalReceived)],
    ["Total Consumed (sum)", String(totalConsumed)],
    ["Total Closing (sum)", String(totalClosing)],
    ["Report Period", isoDate.split("-").reverse().join("/")],
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const col1X = margin.left;
  const col2X = margin.left + 85;
  let rowY = yPos;
  summaryRows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, col1X, rowY);
    doc.setFont("helvetica", "normal");
    doc.text(v, col2X, rowY);
    rowY += 6;
  });

  yPos = rowY + 6;

  // Table Data
  const tableBody = items.map((it, idx) => [
    idx + 1,
    it.stockName || "-",
    it.openingDisplay ?? "-",
    it.receivedDisplay ?? "-",
    it.consumptionDisplay ?? "-",
    it.closingDisplay ?? "-",
    it.unit || "-",
  ]);

  const tableHead = [["S.No", "Item Name", "Opening", "Received", "Consumed", "Closing", "Unit"]];

  // Stock Table
  doc.autoTable({
    startY: yPos,
    head: tableHead,
    body: tableBody,
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
      overflow: "linebreak",
      valign: "middle",
      halign: "center",
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [52, 73, 94],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    tableWidth: "auto",   // ensure fits page
    halign: "center",     // center the table
    margin: { left: 18, right: 18 },

    columnStyles: {
      0: { cellWidth: 12, halign: "center" }, // S.No
      1: { halign: "left" },                  // Item Name auto
    },

    didDrawPage: (data) => {
      // ✅ Draw header only on first page
      if (doc.internal.getCurrentPageInfo().pageNumber === 1) {
        addHeader();
      }
    },
  });

  // Add footers to all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  const safeName = companyName.replace(/\s+/g, "_").toLowerCase();
  const filename = `${filenamePrefix || safeName}_cafe_report_${isoDate}.pdf`;
  doc.save(filename);
};



// ================== exportItemPDF ==================
const exportItemPDF = (builtData, institutionData, start, end) => {
  const { items = [] } = builtData || {};
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const currentTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", hour12: true, day: "2-digit", month: "2-digit",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const title = (institutionData?.companyName || "Company Name").toUpperCase();
  const subtitle = "ITEM SALES ANALYSIS REPORT";
  const dateText = `Period: ${start.toLocaleDateString("en-IN")} to ${end.toLocaleDateString("en-IN")}`;
  const generatedText = `Generated: ${currentTime}`;

  let yPos = addProfessionalHeader(doc, title, subtitle, dateText, generatedText);

  // Executive Summary
  yPos += 10;
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(40, 40, 40);
  doc.text("EXECUTIVE SUMMARY", 20, yPos);
  yPos += 5; doc.setDrawColor(200).line(20, yPos, 80, yPos);
  yPos += 10;

  const totalItems = items.length;
  const totalQty = items.reduce((s, it) => s + (it.quantity || 0), 0);
  const barQty = items.filter(it => it.type === "Bar").reduce((s, it) => s + (it.quantity || 0), 0);
  const cafeQty = items.filter(it => it.type === "Cafe").reduce((s, it) => s + (it.quantity || 0), 0);

  doc.autoTable({
    startY: yPos,
    head: [["Performance Metric", "Value"]],
    body: [
      ["Total Unique Items", String(totalItems)],
      ["Total Quantity Sold", String(totalQty)],
      ["Bar Items Quantity", String(barQty)],
      ["Cafe Items Quantity", String(cafeQty)],
      ["Analysis Period", `${start.toLocaleDateString("en-IN")} - ${end.toLocaleDateString("en-IN")}`],
    ],
    theme: "grid",
    headStyles: { fillColor: [52,73,94], textColor: [255,255,255], fontStyle: "bold", halign: "center" },
    styles: { fontSize: 10, cellPadding: 3 },
    margin: { left: 20, right: 20 },
    tableWidth: "auto",
    halign: "center",
  });

  // Detailed Breakdown
  yPos = doc.lastAutoTable.finalY + 20;
  doc.setFont("helvetica", "bold").setFontSize(12).text("DETAILED SALES BREAKDOWN", 20, yPos);
  yPos += 5; doc.line(20, yPos, 105, yPos); yPos += 10;

  const body = items.map(it => [(it.name || "-"), it.type || "-", String(it.quantity || 0)]);

  doc.autoTable({
    startY: yPos,
    head: [["Item Name", "Category", "Quantity Sold"]],
    body,
    theme: "striped",
    headStyles: { fillColor: [52,73,94], textColor: [255,255,255], fontStyle: "bold", halign: "center" },
    bodyStyles: { fontSize: 9, textColor: [44,62,80] },
    alternateRowStyles: { fillColor: [248,249,250] },
    styles: { cellPadding: 2, overflow: "linebreak", lineColor: [189,195,199], lineWidth: 0.1 },
    margin: { left: 20, right: 20 },
    tableWidth: "auto",
    halign: "center",
  });

  // Totals footer
  const finalY = doc.lastAutoTable.finalY + 15;
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(40,40,40);
  doc.text(`TOTAL ITEMS ANALYZED: ${totalItems}`, 20, finalY);
  doc.text(`TOTAL QUANTITY SOLD: ${totalQty}`, 20, finalY + 8);

  const totalPages = doc.internal.getNumberOfPages();
  for (let i=1; i<=totalPages; i++) {
    doc.setPage(i);
    addProfessionalFooter(doc, i, totalPages, "This document is computer generated and requires no signature for authenticity.");
  }

  const safeName = (institutionData.companyName || "company").replace(/\s+/g,"_").toLowerCase();
  doc.save(`${safeName}_item_analysis_${start.toISOString().slice(0,10)}_to_${end.toISOString().slice(0,10)}.pdf`);
};


// ================== exportOrderPDF ==================
const exportOrderPDF = (builtData, institutionData, start, end, subtype=null) => {
  const {
    orders = [], totalBilledAmount=0, totalCgst=0, totalSgst=0, totalServiceTax=0,
    totalBarAmount=0, totalCafeAmount=0, paymentBreakdown={}
  } = builtData || {};

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const currentTime = new Date().toLocaleString("en-IN", { timeZone:"Asia/Kolkata", hour12:true,
    day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit" });

  const title = (institutionData?.companyName || "Company Name").toUpperCase();
  const subtitle = subtype==="cancelled"?"CANCELLED ORDERS REPORT": subtype==="pending"?"PENDING ORDERS REPORT":"ORDER ANALYSIS REPORT";
  const dateText = `Period: ${start.toLocaleDateString("en-IN")} to ${end.toLocaleDateString("en-IN")}`;
  const generatedText = `Generated: ${currentTime}`;

  let yPos = addProfessionalHeader(doc, title, subtitle, dateText, generatedText);

  // Executive Summary
  yPos += 8;
  doc.setFont("helvetica","bold").setFontSize(12).text("EXECUTIVE SUMMARY",20,yPos);
  yPos += 5; doc.setDrawColor(200).line(20,yPos,80,yPos); yPos += 8;

  const summaryBody = [
    ["Total Orders Processed", String(orders.length), "Total Revenue Generated", `${totalBilledAmount.toFixed(2)}`],
    ["Bar Sales Revenue", `${totalBarAmount.toFixed(2)}`, "Cafe Sales Revenue", `${totalCafeAmount.toFixed(2)}`],
    ["CGST Collected", `${totalCgst.toFixed(2)}`, "SGST Collected", `${totalSgst.toFixed(2)}`],
    ["Service Tax", `${totalServiceTax.toFixed(2)}`, "Analysis Period", `${Math.floor((end-start)/(1000*60*60*24))+1} days`],
  ];

  doc.autoTable({
    startY: yPos,
    body: summaryBody,
    theme: "grid",
    styles: { fontSize:9, cellPadding:3 },
    margin: { left:20, right:20 },
    tableWidth: "auto",
    halign: "center",
  });

  // Payment Breakdown
  yPos = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica","bold").setFontSize(10).text("PAYMENT METHOD BREAKDOWN",20,yPos);
  yPos += 5; doc.line(20,yPos,100,yPos); yPos += 5;

  const paymentBody = Object.entries(paymentBreakdown).map(([m,a])=>[m,`${a.toFixed(2)}`,((a/totalBilledAmount)*100).toFixed(1)+"%"]);

  doc.autoTable({
    startY: yPos,
    head: [["Payment Method","Amount","Percentage"]],
    body: paymentBody,
    theme: "striped",
    headStyles: { fillColor:[52,73,94], textColor:[255,255,255], fontStyle:"bold", halign:"center" },
    styles: { fontSize:8, cellPadding:2 },
    margin: { left:20, right:20 },
    tableWidth: "auto",
    halign: "center",
  });

  // Detailed Orders
  yPos = doc.lastAutoTable.finalY + 15;
  doc.setFont("helvetica","bold").setFontSize(10).text("DETAILED ORDER INFORMATION",20,yPos);
  yPos += 5; doc.line(20,yPos,115,yPos); yPos += 8;

  const isBhuk = institutionData?.institution === "bhuk2323";
let tableColumns = ["Order ID","Customer","Table",...(isBhuk?["Phone"]:[]),"Date","Time",
    subtype === "pending" || subtype === "cancelled" ? "Status" : "Payment",
    "Items","Amount"];

  const tableData = orders.map(order=>{
    const itemsText = Array.isArray(order.items)?order.items.map(i=>`${i.name}(${i.quantity})`).join(", "):"No items";
    const row = [
      order.orderId||"N/A", order.name||"N/A", order.tableName||"N/A", ...(isBhuk?[order.phoneNumber||"N/A"]:[]),
      new Date(order.createdAt).toLocaleDateString("en-IN"),
      new Date(order.createdAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false}),
      getPaymentDisplay(order),
      itemsText.length>60?itemsText.slice(0,57)+"...":itemsText,
      `${safeNum(order.totalAmount).toFixed(2)}`
    ];
    if (subtype==="cancelled") row.push(order.cancelReason||"N/A");
    return row;
  });

  doc.autoTable({
    startY: yPos,
    head: [tableColumns],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor:[52,73,94], textColor:[255,255,255], fontStyle:"bold", fontSize:8, halign:"center" },
    bodyStyles: { fontSize:7, textColor:[44,62,80] },
    styles: { cellPadding:2, overflow:"linebreak", lineColor:[189,195,199], lineWidth:0.1 },
    margin: { left:20, right:20 },
    tableWidth: "auto",
    halign: "center",
  });

  // Footer + Summary
  const totalPages = doc.internal.getNumberOfPages();
  for (let i=1; i<=totalPages; i++) {
    doc.setPage(i);
    addProfessionalFooter(doc,i,totalPages,"This document is computer generated and requires no signature for authenticity.");
    if (i===totalPages) {
      const footerY = Math.max(doc.lastAutoTable.finalY+15, doc.internal.pageSize.height-40);
      doc.setFont("helvetica","bold").setFontSize(10).setTextColor(40,40,40);
      doc.text(`TOTAL ORDERS: ${orders.length}`,20,footerY);
      doc.text(`TOTAL REVENUE: ${totalBilledAmount.toFixed(2)}`,doc.internal.pageSize.width-80,footerY);
    }
  }

  const safeName = (institutionData.companyName||"company").replace(/\s+/g,"_").toLowerCase();
  doc.save(`${safeName}_Order_Report_${start.toISOString().slice(0,10)}_to_${end.toISOString().slice(0,10)}.pdf`);
};


// ================== exportSettlementPDF ==================
const exportSettlementPDF = (builtData, institutionData, start, end) => {
  const { orders=[], totalBilledAmount=0, totalCgst=0, totalSgst=0, totalServiceTax=0,
          totalBarAmount=0, totalCafeAmount=0, paymentBreakdown={} } = builtData || {};

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const currentTime = new Date().toLocaleString("en-IN", { timeZone:"Asia/Kolkata", hour12:true,
    day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit" });

  const title = (institutionData?.companyName || "Company Name").toUpperCase();
  const subtitle = "FINANCIAL SETTLEMENT REPORT";
  const dateText = `Settlement Period: ${start.toLocaleDateString("en-IN")} to ${end.toLocaleDateString("en-IN")}`;
  const generatedText = `Generated: ${currentTime}`;

  let yPos = addProfessionalHeader(doc, title, subtitle, dateText, generatedText);

  // Financial Summary
  yPos += 10;
  doc.setFont("helvetica","bold").setFontSize(12).text("FINANCIAL SUMMARY",20,yPos);
  yPos += 5; doc.line(20,yPos,75,yPos); yPos += 10;

  const summaryData = [
    ["Total Revenue",`${totalBilledAmount.toFixed(2)}`],
    ["Bar Sales",`${totalBarAmount.toFixed(2)}`],
    ["Cafe Sales",`${totalCafeAmount.toFixed(2)}`],
    ["CGST Collected",`${totalCgst.toFixed(2)}`],
    ["SGST Collected",`${totalSgst.toFixed(2)}`],
    ["Service Tax",`${totalServiceTax.toFixed(2)}`],
    ["Net Taxable Amount",`${(totalBilledAmount-totalCgst-totalSgst-totalServiceTax).toFixed(2)}`],
  ];

  doc.autoTable({
    startY: yPos,
    head: [["Financial Metric","Amount ()"]],
    body: summaryData,
    theme: "grid",
    headStyles: { fillColor:[52,73,94], textColor:[255,255,255], fontStyle:"bold", halign:"center" },
    styles: { fontSize:10, cellPadding:3 },
    margin: { left:20, right:20 },
    tableWidth: "auto",
    halign: "center",
  });

  // Payment Methods
  yPos = doc.lastAutoTable.finalY + 20;
  doc.setFont("helvetica","bold").setFontSize(12).text("PAYMENT METHOD ANALYSIS",20,yPos);
  yPos += 5; doc.line(20,yPos,110,yPos); yPos += 10;

  const breakdownBody = Object.entries(paymentBreakdown).map(([m,a])=>[m,`${a.toFixed(2)}`,`${((a/totalBilledAmount)*100).toFixed(1)}%`]);
  breakdownBody.push(["TOTAL",`${totalBilledAmount.toFixed(2)}`,"100.0%"]);

  doc.autoTable({
    startY: yPos,
    head: [["Payment Method","Amount ()","Percentage"]],
    body: breakdownBody,
    theme: "striped",
    headStyles: { fillColor:[52,73,94], textColor:[255,255,255], fontStyle:"bold", halign:"center" },
    bodyStyles: { fontSize:9 },
    alternateRowStyles: { fillColor:[248,249,250] },
    margin: { left:20, right:20 },
    tableWidth: "auto",
    halign: "center",
    didParseCell: d=>{
      if(d.row.index===breakdownBody.length-1){ d.cell.styles.fontStyle="bold"; d.cell.styles.fillColor=[220,220,220]; }
    }
  });

  // Order Summary
  yPos = doc.lastAutoTable.finalY + 20;
  doc.setFont("helvetica","bold").setFontSize(12).text("ORDER SUMMARY",20,yPos);
  yPos += 5; doc.line(20,yPos,65,yPos); yPos += 10;

  const orderSummaryData = orders.slice(0,15).map(o=>[
    o.orderId||"N/A", o.name||"N/A",
    new Date(o.createdAt).toLocaleDateString("en-IN"),
    getPaymentDisplay(o).substring(0,15),
    `${safeNum(o.totalAmount).toFixed(2)}`
  ]);
  if (orders.length>15) orderSummaryData.push(["... ",`${orders.length-15} more orders`,"...","...",""+orders.slice(15).reduce((s,o)=>s+safeNum(o.totalAmount),0).toFixed(2)]);

  doc.autoTable({
    startY: yPos,
    head: [["Order ID","Customer","Date","Payment","Amount"]],
    body: orderSummaryData,
    theme: "striped",
    headStyles: { fillColor:[52,73,94], textColor:[255,255,255], fontStyle:"bold", halign:"center" },
    bodyStyles: { fontSize:8, textColor:[44,62,80] },
    alternateRowStyles: { fillColor:[248,249,250] },
    margin: { left:20, right:20 },
    tableWidth: "auto",
    halign: "center",
  });

  // Footer
  const totalPages = doc.internal.getNumberOfPages();
  for(let i=1;i<=totalPages;i++){
    doc.setPage(i);
    addProfessionalFooter(doc,i,totalPages,"This document is computer generated and requires no signature for authenticity.");
    if(i===totalPages){
      const footerY = Math.max(doc.lastAutoTable.finalY+15, doc.internal.pageSize.height-40);
      doc.setFont("helvetica","bold").setFontSize(11).setTextColor(40,40,40);
      doc.text(`SETTLEMENT TOTAL: ${totalBilledAmount.toFixed(2)}`,20,footerY);
      doc.text(`TOTAL ORDERS SETTLED: ${orders.length}`,20,footerY+8);
    }
  }

  const safeName = (institutionData.companyName||"company").replace(/\s+/g,"_").toLowerCase();
  doc.save(`${safeName}_Settlement_Report_${start.toISOString().slice(0,10)}_to_${end.toISOString().slice(0,10)}.pdf`);
};

// Simplified cafe Excel export (combined strings)
const exportCafeExcel = (builtData, institutionData, isoDate) => {
  const { items } = builtData;
  const exportData = items.map((it) => ({
    "Item Name": it.stockName,
    Opening: it.openingDisplay,
    Received: it.receivedDisplay,
    Consumption: it.consumptionDisplay,
    Closing: it.closingDisplay,
    Unit: it.unit,
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  applyExcelStyles(ws, exportData);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cafe Report");
  XLSX.writeFile(
    wb,
    `${institutionData.companyName || "Company"}_cafe_report_${isoDate}.xlsx`
  );
};

const getPaymentMethod = (order) => {
  return order.paymentMethod || order.paymentMethods?.[0]?.method || "Unknown";
};

const getPaymentDisplay = (order) => {
    // For unpaid or cancelled orders, show status instead of payment method
    if (order.paymentStatus !== true) {
        return order.cancel === true ? "CANCELLED" : "PENDING";
    }
    
    // For paid orders, show actual payment method
    if (order.paymentMethods && Array.isArray(order.paymentMethods) && order.paymentMethods.length > 0) {
        return order.paymentMethods
            .map((pm) => {
                let str = `${pm.method}(${pm.amount})`;
                if (pm.name || pm.reason || pm.note) {
                    str += ` - ${pm.name || pm.reason || pm.note}`;
                }
                return str;
            })
            .join(", ");
    }
    
    // Fallback for single payment method (paid orders only)
    return order.paymentMethod || "Cash";
};

const buildOrderReport = (start, end, filteredOrders) => {
  const startTime = new Date(start).setHours(0, 0, 0, 0);
  const endTime = new Date(end).setHours(23, 59, 59, 999);

  const orders = filteredOrders
    .filter((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= startTime && orderDate <= endTime;
    })
    .sort((a, b) => getPaymentMethod(a).localeCompare(getPaymentMethod(b)));

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

  orders.forEach((order) => {
    totalBilledAmount += safeNum(order.totalAmount);
    totalCgst += safeNum(order.cgst);
    totalSgst += safeNum(order.sgst);
    totalServiceTax += safeNum(order.serviceTax);

    const payKey = order.paymentMethod || order.paymentMode || "Cash";
    paymentBreakdown[payKey] =
      (paymentBreakdown[payKey] || 0) + safeNum(order.totalAmount);

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
    orders,
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

const buildItemReport = (start, end, allOrders, itemTypeFilter = null, menuItems) => {
    const { itemQuantities } = buildOrderReport(start, end, allOrders);
    let items = Object.entries(itemQuantities).map(([name, { quantity, type }]) => {
        const menuItem = menuItems.find((mi) => mi.itemName === name);
        return {
            name,
            quantity,
            type: type === "bar" ? "Bar" : "Cafe",
            category: menuItem?.category || "N/A",
        };
    });

    // Filter based on report type
    if (itemTypeFilter) {
        if (itemTypeFilter === "Beverage") {
            // Beverage report: show only items where category === "Beverage"
            items = items.filter((it) => it.category === "Beverage");
        } else if (itemTypeFilter === "Kitchen") {
            // Kitchen report: show items where category !== "Beverage"
            items = items.filter((it) => it.category !== "Beverage");
        }
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    return { items };
};

// Excel export functions
const exportItemExcel = (builtData, institutionData, start, end) => {
  const { items } = builtData;
  const exportData = items.map((item) => ({
    "Item Name": item.name,
    Type: item.type,
    "Quantity Sold": item.quantity,
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  applyExcelStyles(ws, exportData);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Item Report");
  XLSX.writeFile(
    wb,
    `${institutionData.companyName}_item_report_${start
      .toISOString()
      .slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString()
        ? `_to_${end.toISOString().slice(0, 10)}`
        : ""
    }.xlsx`
  );
};

const exportOrderExcel = (builtData, institutionData, start, end) => {
  const { orders } = builtData;
  const exportData = orders.map((order) => ({
    "Order ID": order.orderId || "N/A",
    Customer: order.name || "N/A",
    Table: order.tableName || "N/A",
    Date: new Date(order.createdAt).toLocaleDateString(),
    Time: new Date(order.createdAt).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    Payment: getPaymentDisplay(order),
    Total: safeNum(order.totalAmount),
    CGST: safeNum(order.cgst),
    SGST: safeNum(order.sgst),
    "Service Tax": safeNum(order.serviceTax),
    Items: order.items
      ? order.items.map((it) => `${it.name || "N/A"}(x${it.quantity || 0})`).join("; ")
      : "",
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  applyExcelStyles(ws, exportData);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Order Report");
  XLSX.writeFile(
    wb,
    `${institutionData.companyName}_orders_${start.toISOString().slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString()
        ? `_to_${end.toISOString().slice(0, 10)}`
        : ""
    }.xlsx`
  );
};

const exportSettlementExcel = (builtData, institutionData, start, end) => {
  const { paymentBreakdown, totalBilledAmount } = builtData;

  const exportData = Object.entries(paymentBreakdown).map(([method, amount]) => ({
    "Payment Method": method,
    Amount: amount,
  }));

  exportData.push({
    "Payment Method": "Total",
    Amount: totalBilledAmount,
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  applyExcelStyles(ws, exportData);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Settlement Report");
  XLSX.writeFile(
    wb,
    `${institutionData.companyName}_settlement_${start.toISOString().slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString()
        ? `_to_${end.toISOString().slice(0, 10)}`
        : ""
    }.xlsx`
  );
};

// applyExcelStyles - as provided in your code (keeps cell styling & alignment behavior)
const applyExcelStyles = (ws, data, headerRowCount = 1) => {
  const range = XLSX.utils.decode_range(ws["!ref"]);

  const headerStyle = {
    font: { bold: true },
    fill: { fgColor: { rgb: "2196F3" } },
    alignment: { horizontal: "center" },
    border: {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    },
  };

  const numberStyle = {
    numFmt: "#,##0.00",
    alignment: { horizontal: "right" },
  };
  const currencyStyle = {
    numFmt: "#,##0.00",
    alignment: { horizontal: "right" },
  };
  const textStyle = { alignment: { horizontal: "left", wrapText: true } };
  const dateStyle = {
    numFmt: "dd/mm/yyyy",
    alignment: { horizontal: "center" },
  };
  const totalStyle = {
    font: { bold: true },
    fill: { fgColor: { rgb: "FFFF00" } },
    alignment: { horizontal: "right" },
  };

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
    const isTotalRow =
      data[R - headerRowCount] &&
      (data[R - headerRowCount].Category === "TOTAL" ||
        data[R - headerRowCount].Category === "GRAND TOTAL" ||
        data[R - headerRowCount]["Order ID"] === "Summary");

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cell]) continue;

      if (isTotalRow) {
        ws[cell].s = { ...ws[cell].s, ...totalStyle };
      } else if (typeof ws[cell].v === "number") {
        if (
          ws[cell].v % 1 !== 0 ||
          /Amount|Sales|Rate|Total|CGST|SGST|Service Tax|Price/i.test(
            Object.keys(data[0])[C]
          )
        ) {
          ws[cell].s = { ...ws[cell].s, ...currencyStyle };
        } else {
          ws[cell].s = { ...ws[cell].s, ...numberStyle };
        }
      } else if (
        Object.keys(data[0])[C] &&
        /date/i.test(Object.keys(data[0])[C].toLowerCase())
      ) {
        ws[cell].s = { ...ws[cell].s, ...dateStyle };
      } else {
        ws[cell].s = { ...ws[cell].s, ...textStyle };
      }

      // Borders for all cells
      ws[cell].s = {
        ...ws[cell].s,
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
      };
    }
  }

  // Auto-size columns
  const colWidths = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let max = 10;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cell] && ws[cell].v)
        max = Math.max(max, ws[cell].v.toString().length + 2);
    }
    colWidths.push({ wch: max });
  }
  ws["!cols"] = colWidths;

  // Enable filters
  ws["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
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
    `${
      institutionData?.companyName || "Restaurant"
    }_Item_ID_Reference_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
};

const Report = () => {
  const { institutionData } = useContext(Context) || {};
  const institution =
    institutionData?.institution ||
    institutionData?.id ||
    institutionData?.name ||
    "";

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
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [orderSourceFilter, setOrderSourceFilter] = useState("All"); // Added orderSource filter
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [orderSourceOptions, setOrderSourceOptions] = useState([]); // Added orderSource options

  const getRecordCount = () => {
    if (!reportData) return 0;
    switch (reportData.type) {
      case "cafe":
        return reportData.data.items?.length || 0;
      case "item":
        return reportData.data.items?.length || 0;
      case "order":
      case "settlement":
        return reportData.data.orders?.length || 0;
      case "itemId":
        return reportData.data.length || 0;
      default:
        return 0;
    }
  };

  // REPORT OPTIONS
  const reportOptions = [
    { value: "", label: "Select Report" },
    { value: "cafe", label: "Stock Report" },
    { value: "item", label: "Item Report" },
    { value: "beverage_item", label: "Beverage Item Report" },
    { value: "kitchen_item", label: "Kitchen Item Report" },
    { value: "order", label: "Order Report" },
    { value: "settlement", label: "Settlement Report" },
    { value: "pending_orders", label: "Pending Orders Report" },
    { value: "cancelled_orders", label: "Cancelled Orders Report" },
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
        const paidOrders = (orderResponse || []).filter(
          (order) => order.paymentStatus === true
        );
        setAllOrders(orderResponse || []); // Keep all orders for pending/cancelled
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
    const methods = new Set();
    const sources = new Set(); // Added orderSource collection
    
    allOrders.forEach((order) => {
      if (order.paymentMethod) methods.add(order.paymentMethod);
      if (order.paymentMethods && Array.isArray(order.paymentMethods)) {
        order.paymentMethods.forEach((pm) => methods.add(pm.method));
      }
      
      // Collect orderSource values
      if (order.orderSource) sources.add(order.orderSource);
    });

    setPaymentOptions(["All", ...Array.from(methods).sort()]);
    setOrderSourceOptions(["All", ...Array.from(sources).sort()]); // Set orderSource options
  }, [allOrders]);

  useEffect(() => {
    if (!selectedReport || loading) return;

    let effectiveEnd = ["cafe"].includes(selectedReport) ? new Date(startDate) : endDate;

    const hasPayment = (order, method) => {
      if (method === "All") return true;
      if (order.paymentMethod === method) return true;
      if (order.paymentMethods && Array.isArray(order.paymentMethods)) {
        return order.paymentMethods.some((pm) => pm.method === method && pm.amount > 0);
      }
      return false;
    };

    const hasOrderSource = (order, source) => {
      if (source === "All") return true;
      return order.orderSource === source;
    };

    let filteredOrders = allOrders;
if (["order", "settlement"].includes(selectedReport)) {
  filteredOrders = allOrders.filter(
    (o) =>
      hasPayment(o, paymentFilter) &&
      hasOrderSource(o, orderSourceFilter) &&
      (selectedReport === "settlement" ? o.paymentStatus === true : true)
  );
} else if (selectedReport === "pending_orders") {
  filteredOrders = allOrders.filter(
    (o) => !o.paymentStatus && !o.cancel && hasOrderSource(o, orderSourceFilter)
  );
} else if (selectedReport === "cancelled_orders") {
  filteredOrders = allOrders.filter(
    (o) => o.cancel === true && hasOrderSource(o, orderSourceFilter)
  );
}

    if (selectedReport === "itemId") {
      const data = buildItemReferenceData(menuItems);
      setReportData({ type: "itemId", data });
    } else {
      const isoStart = startDate.toISOString().slice(0, 10);
      if (selectedReport === "cafe") {
        const data = buildCafeDailyReport(isoStart, stocks);
        setReportData({ type: "cafe", data });
      } else if (selectedReport === "item") {
  const data = buildItemReport(startDate, effectiveEnd, filteredOrders, null, menuItems);
  setReportData({ type: "item", data });
}  else if (selectedReport === "beverage_item") {
    const data = buildItemReport(startDate, effectiveEnd, filteredOrders, "Beverage", menuItems);
    setReportData({ type: "item", subtype: "beverage", data });
} else if (selectedReport === "kitchen_item") {
    const data = buildItemReport(startDate, effectiveEnd, filteredOrders, "Kitchen", menuItems);
    setReportData({ type: "item", subtype: "kitchen", data });
} else if (["order", "settlement", "pending_orders", "cancelled_orders"].includes(selectedReport)) {
        const data = buildOrderReport(startDate, effectiveEnd, filteredOrders);
        setReportData({
          type: selectedReport === "settlement" ? "settlement" : "order",
          subtype: selectedReport === "pending_orders" ? "pending" : selectedReport === "cancelled_orders" ? "cancelled" : null,
          data,
        });
      }
    }
  }, [selectedReport, startDate, endDate, paymentFilter, orderSourceFilter, stocks, allOrders, menuItems, loading]);

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
    if (!reportData) return <p className="text-gray-500 text-sm">Select a report to preview.</p>;

    // make preview text a little smaller: using text-sm
    switch (reportData.type) {
      case "cafe": {
        const { items: cafeItems } = reportData.data;
        return (
          <div className="overflow-x-auto text-sm">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border text-left text-xs">Item</th>
                  <th className="px-3 py-2 border text-center text-xs">Opening</th>
                  <th className="px-3 py-2 border text-center text-xs">Received</th>
                  <th className="px-3 py-2 border text-center text-xs">Consumption</th>
                  <th className="px-3 py-2 border text-center text-xs">Closing</th>
                  <th className="px-3 py-2 border text-center text-xs">Unit</th>
                </tr>
              </thead>
              <tbody>
                {cafeItems.map((it, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="px-3 py-2 border text-left">{it.stockName.substring(0, 30)}</td>
                    <td className="px-3 py-2 border text-center">{it.openingDisplay}</td>
                    <td className="px-3 py-2 border text-center">{it.receivedDisplay}</td>
                    <td className="px-3 py-2 border text-center">{it.consumptionDisplay}</td>
                    <td className="px-3 py-2 border text-center">{it.closingDisplay}</td>
                    <td className="px-3 py-2 border text-center">{it.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case "item": {
        const { items: itemItems } = reportData.data;
        return (
          <div className="overflow-x-auto text-sm">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border text-left text-xs">Item Name</th>
                  <th className="px-3 py-2 border text-center text-xs">Type</th>
                  <th className="px-3 py-2 border text-right text-xs">Quantity Sold</th>
                </tr>
              </thead>
              <tbody>
                {itemItems.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="px-3 py-2 border text-left">{item.name}</td>
                    <td className="px-3 py-2 border text-center">{item.type}</td>
                    <td className="px-3 py-2 border text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case "order": {
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
        const isCancelled = reportData.subtype === "cancelled";

        return (
          <div className="overflow-x-auto text-sm">
            {/* Summary */}
            <h2 className="text-base font-bold mb-2">Order Summary</h2>
            <table className="min-w-full bg-white border border-gray-300 mb-4 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border text-left text-xs">Metric</th>
                  <th className="px-3 py-2 border text-right text-xs">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 border text-left">Total Orders</td>
                  <td className="px-3 py-2 border text-right">{orders.length}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border text-left">Total Amount</td>
                  <td className="px-3 py-2 border text-right">{totalBilledAmount.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 border text-left">Bar Sales</td>
                  <td className="px-3 py-2 border text-right">{totalBarAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border text-left">Cafe Sales</td>
                  <td className="px-3 py-2 border text-right">{totalCafeAmount.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 border text-left">CGST</td>
                  <td className="px-3 py-2 border text-right">{totalCgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border text-left">SGST</td>
                  <td className="px-3 py-2 border text-right">{totalSgst.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 border text-left">Service Tax</td>
                  <td className="px-3 py-2 border text-right">{totalServiceTax.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Payment Breakdown */}
            <h3 className="text-sm font-semibold mb-2">Payment Breakdown</h3>
            <table className="min-w-full bg-white border border-gray-300 mb-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border text-left text-xs">Payment Method</th>
                  <th className="px-3 py-2 border text-right text-xs">Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(paymentBreakdown).map(([method, amount], index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="px-3 py-2 border text-left">{method}</td>
                    <td className="px-3 py-2 border text-right">{amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Orders */}
            <h2 className="text-base font-bold mb-2">Orders</h2>
            <table className="min-w-full bg-white border border-gray-300 text-sm">
              <thead className="bg-gray-100">
    <tr>
        <th className="px-3 py-2 border text-left text-xs">Order ID</th>
        <th className="px-3 py-2 border text-left text-xs">Customer</th>
        <th className="px-3 py-2 border text-left text-xs">Table</th>
        {institutionData?.institution === "bhuk2323" && (
            <th className="px-3 py-2 border text-left text-xs">Phone</th>
        )}
        <th className="px-3 py-2 border text-center text-xs">Date</th>
        <th className="px-3 py-2 border text-center text-xs">Time</th>
        <th className="px-3 py-2 border text-left text-xs">
            {isCancelled || reportData.subtype === "pending" ? "Status" : "Payment Method"}
        </th>
        <th className="px-3 py-2 border text-right text-xs">Total</th>
        <th className="px-3 py-2 border text-right text-xs">CGST</th>
        <th className="px-3 py-2 border text-right text-xs">SGST</th>
        <th className="px-3 py-2 border text-right text-xs">Service Tax</th>
        <th className="px-3 py-2 border text-left text-xs">Items</th>
        {isCancelled && <th className="px-3 py-2 border text-left text-xs">Cancel Reason</th>}
    </tr>
</thead>
              <tbody>
                {orders.map((order, index) => {
                  const paymentMethod = getPaymentDisplay(order);
                  const itemsSummary = order.items
                    ? order.items
                        .map((item) => `${item.name || "N/A"} (Qty: ${item.quantity || 0})`)
                        .join(", ")
                    : "N/A";

                  return (
                    <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="px-3 py-2 border text-left">{order.orderId}</td>
                      <td className="px-3 py-2 border text-left">{order.name || "N/A"}</td>
                      <td className="px-3 py-2 border text-left">{order.tableName || "N/A"}</td>
                      {institutionData?.institution === "bhuk2323" && (
                        <td className="px-3 py-2 border text-left">{order.phoneNumber || "N/A"}</td>
                      )}
                      <td className="px-3 py-2 border text-center">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 border text-center">
                        {new Date(order.createdAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="px-3 py-2 border text-left">{paymentMethod}</td>
                      <td className="px-3 py-2 border text-right">{safeNum(order.totalAmount).toFixed(2)}</td>
                      <td className="px-3 py-2 border text-right">
                        {order.cgst ? `${(order.totalAmount * (order.cgst / 100)).toFixed(2)}` : "N/A"}
                      </td>
                      <td className="px-3 py-2 border text-right">
                        {order.sgst ? `${(order.totalAmount * (order.sgst / 100)).toFixed(2)}` : "N/A"}
                      </td>
                      <td className="px-3 py-2 border text-right">{order.serviceTax || "N/A"}</td>
                      <td className="px-3 py-2 border text-left">{itemsSummary}</td>
                      {isCancelled && <td className="px-3 py-2 border text-left">{order.cancelReason || "N/A"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      case "settlement": {
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
          <div className="overflow-x-auto text-sm">
            {/* Summary */}
            <h2 className="text-base font-bold mb-2">Settlement Summary</h2>
            <table className="min-w-full bg-white border border-gray-300 mb-4 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border text-left text-xs">Metric</th>
                  <th className="px-3 py-2 border text-right text-xs">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 border text-left">Total Amount</td>
                  <td className="px-3 py-2 border text-right">{totalBilledAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border text-left">Bar Sales</td>
                  <td className="px-3 py-2 border text-right">{totalBarAmount.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 border text-left">Cafe Sales</td>
                  <td className="px-3 py-2 border text-right">{totalCafeAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border text-left">CGST</td>
                  <td className="px-3 py-2 border text-right">{totalCgst.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-3 py-2 border text-left">SGST</td>
                  <td className="px-3 py-2 border text-right">{totalSgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border text-left">Service Tax</td>
                  <td className="px-3 py-2 border text-right">{totalServiceTax.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            {/* Payment Breakdown */}
            <h3 className="text-sm font-semibold mb-2">Payment Breakdown</h3>
            <table className="min-w-full bg-white border border-gray-300 mb-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border text-left text-xs">Payment Method</th>
                  <th className="px-3 py-2 border text-right text-xs">Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(paymentBreakdown).map(([method, amount], index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="px-3 py-2 border text-left">{method}</td>
                    <td className="px-3 py-2 border text-right">{amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Orders */}
            <h2 className="text-base font-bold mb-2">Orders</h2>
            <table className="min-w-full bg-white border border-gray-300 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border text-left text-xs">Order ID</th>
                  <th className="px-3 py-2 border text-left text-xs">Customer</th>
                  <th className="px-3 py-2 border text-left text-xs">Table</th>
                  {institutionData?.institution === "bhuk2323" && (
                    <th className="px-3 py-2 border text-left text-xs">Phone</th>
                  )}
                  <th className="px-3 py-2 border text-center text-xs">Date</th>
                  <th className="px-3 py-2 border text-center text-xs">Time</th>
                  <th className="px-3 py-2 border text-left text-xs">Payment Method</th>
                  <th className="px-3 py-2 border text-right text-xs">Total</th>
                  <th className="px-3 py-2 border text-right text-xs">CGST</th>
                  <th className="px-3 py-2 border text-right text-xs">SGST</th>
                  <th className="px-3 py-2 border text-right text-xs">Service Tax</th>
                  <th className="px-3 py-2 border text-left text-xs">Items</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => {
                  const paymentMethod = getPaymentDisplay(order);
                  const itemsSummary = order.items
                    ? order.items
                        .map((item) => `${item.name || "N/A"} (Qty: ${item.quantity || 0})`)
                        .join(", ")
                    : "N/A";

                  return (
                    <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="px-3 py-2 border text-left">{order.orderId}</td>
                      <td className="px-3 py-2 border text-left">{order.name || "N/A"}</td>
                      <td className="px-3 py-2 border text-left">{order.tableName || "N/A"}</td>
                      {institutionData?.institution === "bhuk2323" && (
                        <td className="px-3 py-2 border text-left">{order.phoneNumber || "N/A"}</td>
                      )}
                      <td className="px-3 py-2 border text-center">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 border text-center">
                        {new Date(order.createdAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="px-3 py-2 border text-left">{paymentMethod}</td>
                      <td className="px-3 py-2 border text-right">{safeNum(order.totalAmount).toFixed(2)}</td>
                      <td className="px-3 py-2 border text-right">
                        {order.cgst ? `${(order.totalAmount * (order.cgst / 100)).toFixed(2)}` : "N/A"}
                      </td>
                      <td className="px-3 py-2 border text-right">
                        {order.sgst ? `${(order.totalAmount * (order.sgst / 100)).toFixed(2)}` : "N/A"}
                      </td>
                      <td className="px-3 py-2 border text-right">{order.serviceTax || "N/A"}</td>
                      <td className="px-3 py-2 border text-left">{itemsSummary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      case "itemId": {
        const itemIdData = reportData.data;
        return (
          <div className="overflow-x-auto text-sm">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border text-left text-xs">Shorthand Search</th>
                  <th className="px-3 py-2 border text-left text-xs">Item Name</th>
                  <th className="px-3 py-2 border text-left text-xs">Category</th>
                  <th className="px-3 py-2 border text-right text-xs">Price</th>
                  <th className="px-3 py-2 border text-left text-xs">Type</th>
                </tr>
              </thead>
              <tbody>
                {itemIdData.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                    <td className="px-3 py-2 border text-left">{item["Shorthand Search"]}</td>
                    <td className="px-3 py-2 border text-left">{item["Item Name"]}</td>
                    <td className="px-3 py-2 border text-left">{item.Category}</td>
                    <td className="px-3 py-2 border text-right">{item.Price}</td>
                    <td className="px-3 py-2 border text-left">{item.Type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const renderExportButtons = () => {
    if (!selectedReport) return null;

    const isoDate = startDate.toISOString().slice(0, 10);
    const buttons = [];

    switch (selectedReport) {
      case "cafe":
        buttons.push(
          <button
            key="cafe-excel"
            onClick={() => exportCafeExcel(reportData.data, institutionData, isoDate)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FileSpreadsheet className="w-3 h-3" />
            Excel
          </button>,
          <button
            key="cafe-pdf"
            onClick={() => exportCafeDailyReport(reportData.data, institutionData, isoDate)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            <FileText className="w-3 h-3" />
            PDF
          </button>
        );
        break;

      case "item":
      case "beverage_item":
      case "kitchen_item":
        buttons.push(
          <button
            key="item-excel"
            onClick={() => exportItemExcel(reportData.data, institutionData, startDate, endDate)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FileSpreadsheet className="w-3 h-3" />
            Excel
          </button>,
          <button
            key="item-pdf"
            onClick={() => exportItemPDF(reportData.data, institutionData, startDate, endDate)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            <FileText className="w-3 h-3" />
            PDF
          </button>
        );
        break;

      case "order":
      case "pending_orders":
      case "cancelled_orders":
        buttons.push(
          <button
            key="order-excel"
            onClick={() => exportOrderExcel(reportData.data, institutionData, startDate, endDate)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FileSpreadsheet className="w-3 h-3" />
            Excel
          </button>,
          <button
            key="order-pdf"
            onClick={() => exportOrderPDF(reportData.data, institutionData, startDate, endDate, reportData.subtype)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            <FileText className="w-3 h-3" />
            PDF
          </button>
        );
        break;

      case "settlement":
        buttons.push(
          <button
            key="settlement-excel"
            onClick={() => exportSettlementExcel(reportData.data, institutionData, startDate, endDate)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FileSpreadsheet className="w-3 h-3" />
            Excel
          </button>,
          <button
            key="settlement-pdf"
            onClick={() => exportSettlementPDF(reportData.data, institutionData, startDate, endDate)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            <FileText className="w-3 h-3" />
            PDF
          </button>
        );
        break;

      case "itemId":
        buttons.push(
          <button
            key="itemid-excel"
            onClick={() => exportItemReferenceExcel(menuItems, institutionData)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FileSpreadsheet className="w-3 h-3" />
            Excel
          </button>
        );
        break;

      default:
        return null;
    }

    return buttons;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Report Generator</h1>
          <p className="text-gray-600">Generate and export reports from different data sources</p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Filters Header */}
          <div className="border-b border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-medium text-gray-900">Report Configuration</h2>
                <button className="text-xs text-gray-500 hover:text-gray-700 ml-2">Hide</button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
                <button className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800">Clear Filters</button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {/* Report Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Select Report Type</label>
                <div className="relative">
                  <select
                    value={selectedReport}
                    onChange={(e) => setSelectedReport(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                  >
                    {reportOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Start Date */}
              {selectedReport && selectedReport !== "itemId" && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                  <div className="relative">
                    <button
                      onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-left bg-white"
                    >
                      {startDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </button>
                    <Calendar className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  {showStartDatePicker && (
                    <div className="absolute z-20 mt-2 bg-white shadow-lg rounded-lg border border-gray-200">
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
              )}

              {/* End Date */}
              {selectedReport &&
                ["item", "beverage_item", "kitchen_item", "order", "settlement", "pending_orders", "cancelled_orders"].includes(
                  selectedReport
                ) && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <div className="relative">
                      <button
                        onClick={() => setShowEndDatePicker(!showEndDatePicker)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-left bg-white"
                      >
                        {endDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </button>
                      <Calendar className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    {showEndDatePicker && (
                      <div className="absolute z-20 mt-2 bg-white shadow-lg rounded-lg border border-gray-200">
                        <DayPicker
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => handleDateSelection(date, setEndDate, setShowEndDatePicker)}
                          fromDate={getDateLimits().minDate}
                          toDate={getDateLimits().maxDate}
                          className="p-3"
                        />
                      </div>
                    )}
                  </div>
                )}

              {/* Payment Filter */}
              {["order", "settlement"].includes(selectedReport) && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                  <div className="relative">
                    <select
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                    >
                      {paymentOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Order Source Filter */}
              {["order", "settlement", "pending_orders", "cancelled_orders"].includes(selectedReport) && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Order Source</label>
                  <div className="relative">
                    <select
                      value={orderSourceFilter}
                      onChange={(e) => setOrderSourceFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                    >
                      {orderSourceOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Search Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Search Filter</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search in data..."
                    className="w-full px-3 py-2 pl-8 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Export Actions */}
              <div className="flex items-end gap-2">{renderExportButtons()}</div>
            </div>
          </div>

          {/* Report Preview */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-medium text-gray-900">
                  {selectedReport
                    ? `${reportOptions.find((r) => r.value === selectedReport)?.label} Report`
                    : "Select a Report Type"}
                </h3>
              </div>
              {reportData && <span className="text-xs text-gray-500">Showing {getRecordCount()} records</span>}
            </div>
            <div className="border border-gray-200 rounded overflow-hidden">{renderPreview()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Report;