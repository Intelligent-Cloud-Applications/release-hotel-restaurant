import React, { useState, useEffect, useContext } from "react";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import operationData from "../../../../../Operation/data.json";
// import { fetchOrders as fetchFoodDeliveryOrders } from "../../../../utils/foodDeliveryApi";
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

const normalizeListResponse = (response) => {
  if (Array.isArray(response)) return response;
  const candidate = response?.data || response?.items || response?.result || response?.body;
  return Array.isArray(candidate) ? candidate : [];
};

const tagOrderSource = (orders, sourceGroup) =>
  normalizeListResponse(orders).map((order) => ({
    ...order,
    orderSourceGroup: sourceGroup,
  }));

const getOrderSourceGroup = (order) => (order?.orderSourceGroup || order?.sourceGroup || "main").toLowerCase();

const isFoodDeliveryOrder = (order) => getOrderSourceGroup(order) === "fooddelivery";

const getPaymentStatusValue = (order) => String(order?.paymentStatus ?? order?.payment_status ?? "").toLowerCase();
const getOrderStatusValue = (order) => String(order?.orderStatus ?? order?.status ?? "").toLowerCase();
const COMPLETED_STATUSES = new Set(["completed", "delivered", "payment_done", "confirmed", "paid"]);


const isOrderComplementary = (order) => {
  if (!order) return false;
  const pm = String(order.paymentMethod || order.payment_method || "").toLowerCase().trim();
  if (pm.includes("complementary") || pm.includes("complimentary")) return true;
  if (Array.isArray(order.paymentMethods) && order.paymentMethods.length > 0) {
    const nonZero = order.paymentMethods.filter((p) => Number(p.amount || 0) > 0);
    if (
      nonZero.length > 0 &&
      nonZero.every(
        (p) =>
          String(p.method || "").toLowerCase().trim().includes("complement") ||
          String(p.method || "").toLowerCase().trim().includes("compliment")
      )
    ) {
      return true;
    }
  }
  return false;
};

const isPaidOrCompletedOrder = (order) => {
  const paymentStatus = getPaymentStatusValue(order);
  const orderStatus = getOrderStatusValue(order);
  return (
    order?.paymentStatus === true ||
    paymentStatus === "paid" ||
    paymentStatus === "true" ||
    COMPLETED_STATUSES.has(orderStatus)
  );
};

const getReportOrderSourceLabel = (order) => {
  if (order?.orderSource) return order.orderSource;
  if (order?.source) return order.source;
  if (getOrderSourceGroup(order) === "fooddelivery") return "Food Delivery";
  return "Main";
};

const getOrderItems = (order) => (Array.isArray(order?.items) && order.items.length > 0 ? order.items : Array.isArray(order?.cart) ? order.cart : []);

const getCustomerDisplayName = (order) => order?.customerName || order?.name || order?.customer || order?.fullName || "Guest";

const getOrderDateValue = (order) => new Date(order?.createdAt || order?.date || order?.orderDate || order?.updatedAt || Date.now());

const getPaymentMethodLabel = (order) => {
  if (order?.paymentMethods && Array.isArray(order.paymentMethods) && order.paymentMethods.length > 0) {
    return order.paymentMethods
      .map((pm) => pm?.method || pm?.name || pm?.type || "Cash")
      .filter(Boolean)
      .join(", ");
  }

  if (order?.paymentMethods && typeof order.paymentMethods === "object" && !Array.isArray(order.paymentMethods)) {
    return Object.keys(order.paymentMethods).join(", ") || "Cash";
  }

  return order?.paymentMethod || order?.payment_method || order?.paymentMethodType || order?.paymentType || order?.paymentMode || "Cash";
};

// format local date as YYYY-MM-DD without UTC timezone offset distortions
export const formatLocalDate = (date) => {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// parse stock value to base numeric unit (grams, ml, or piece count)
export const parseStockValueToBase = (val, stockUnit = "g") => {
  if (val == null || val === "") return 0;
  const u = String(stockUnit || "").toLowerCase();
  if (u.includes("piece") || u.includes("pc")) {
    return safeNum(val);
  }

  if (typeof val === "number") {
    if ((u === "kg" || u === "l") && val < 1000) {
      return Math.round(val * 1000);
    }
    return Math.round(val);
  }

  const s = String(val).trim().toLowerCase();
  const nMatch = s.match(/-?[\d,.]+/);
  if (!nMatch) return 0;
  const num = Number(nMatch[0].replace(/,/g, "")) || 0;

  if (s.includes("kg") || (u === "kg" && !s.includes("g"))) {
    return Math.round(num * 1000);
  }
  if ((s.includes("l") && !s.includes("ml")) || (u === "l" && !s.includes("ml"))) {
    return Math.round(num * 1000);
  }
  return Math.round(num);
};

// splits base quantity into kg/l, g/ml, and piece components
export const convertQuantities = (qty, unit = "g") => {
  let kgL = 0, gMl = 0, piece = 0;
  const u = String(unit || "").toLowerCase();
  const isPiece = u.includes("piece") || u.includes("pc");

  if (isPiece) {
    piece = Math.max(0, safeNum(qty));
  } else {
    const total = Math.max(0, safeNum(qty));
    kgL = Math.floor(total / 1000);
    gMl = Math.round(total % 1000);
  }
  return { kgL, gMl, piece };
};

// utility to format combined quantity strings showing both kg and gm explicitly
export const formatKgMlString = (qData, unit = "g") => {
  const u = String(unit || "").toLowerCase();
  if (u.includes("piece") || u.includes("pc")) {
    return `${qData?.piece || 0} pcs`;
  }
  const isVolume = u.includes("l") || u.includes("ml");
  const mainUnit = isVolume ? "L" : "kg";
  const subUnit = isVolume ? "ml" : "g";

  const { kgL = 0, gMl = 0 } = qData || {};
  if (kgL > 0 && gMl > 0) return `${kgL} ${mainUnit} ${gMl} ${subUnit}`;
  if (kgL > 0) return `${kgL} ${mainUnit} 0 ${subUnit}`;
  return `${gMl} ${subUnit}`;
};

const formatNumber = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return "0";
  const rounded = Number(Number(num).toFixed(2));
  return rounded % 1 === 0
    ? rounded.toString()
    : rounded.toFixed(2).replace(/\.?0+$/, "");
};

const buildCafeDailyReport = (isoDate, stocks, typeFilter = "cafe") => {
  const key = dateToKey(isoDate);
  const items = [];

  stocks
    .filter((s) => {
      const sType = String(s.type || "").toLowerCase();
      if (typeFilter === "bar") return sType === "bar";
      return !sType || sType === "cafe" || sType !== "bar";
    })
    .forEach((stock) => {
      const update = (stock.stockupdate || {})[key] || {};
      const unit = stock.unit || "g";
      const hasExplicitOpening = (update.openingStock ?? update.opening ?? update.open) != null;
      const receivedRaw = update.received ?? 0;
      let receivedQty = parseStockValueToBase(receivedRaw, unit);

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

      let openingQty = 0;
      let closingQty = 0;

      if (hasExplicitOpening) {
        const openingVal = update.openingStock ?? update.opening ?? update.open;
        openingQty = parseStockValueToBase(openingVal, unit);
        const totalQty = openingQty + receivedQty;
        closingQty = Math.max(0, totalQty - consumptionQty);
      } else {
        // If openingStock has not been recorded by End Day yet, stock.quantity in DB represents the current live stock balance
        const liveCurrentQty = parseStockValueToBase(stock.quantity ?? 0, unit);
        closingQty = Math.max(0, liveCurrentQty);
        openingQty = Math.max(0, closingQty - receivedQty + consumptionQty);
      }

      const opening = convertQuantities(openingQty, unit);
      const received = convertQuantities(receivedQty, unit);
      const consumption = convertQuantities(consumptionQty, unit);
      const closing = convertQuantities(closingQty, unit);

      items.push({
        stockId: stock.stockId,
        stockName: stock.stockName || stock.name || "-",
        openingRaw: openingQty,
        receivedRaw,
        consumptionRaw: consumptionQty,
        closingRaw: closingQty,
        opening,
        received,
        consumption,
        closing,
        openingDisplay: formatKgMlString(opening, unit),
        receivedDisplay: formatKgMlString(received, unit),
        consumptionDisplay: formatKgMlString(consumption, unit),
        closingDisplay: formatKgMlString(closing, unit),
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
  const { includeLogo = false, logoDataUrl = null, filenamePrefix = "", reportTitle = "DAILY STOCK REPORT", reportSlug = "stock" } = options;

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
  const subtitleText = reportTitle.toUpperCase();
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
    doc.setFontSize(14);
    const leftX = includeLogo && logoDataUrl ? margin.left + (logoSize + 6) : margin.left;
    doc.text(titleText, leftX, headerY + 4);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(dateText, leftX, headerY + 10);
    doc.text(generatedText, pageWidth - margin.right, headerY + 10, { align: "right" });

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
  const totalReceived = items.reduce((s, it) => s + Number(it.receivedRaw ?? it.received ?? 0), 0);
  const totalConsumed = items.reduce((s, it) => s + Number(it.consumptionRaw ?? it.consumption ?? 0), 0);
  const totalClosing = items.reduce((s, it) => s + Number(it.closingRaw ?? it.closing ?? 0), 0);

  const summaryRows = [
    ["Total Items Tracked", String(totalItems)],
    ["Total Received (sum)", String(totalReceived)],
    ["Total Consumption / Waste (sum)", String(totalConsumed)],
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
  const tableHead = [
    [
      { content: "S.No", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
      { content: "Item Name", rowSpan: 2, styles: { valign: "middle", halign: "left" } },
      { content: "Opening", colSpan: 3, styles: { halign: "center" } },
      { content: "Received", colSpan: 3, styles: { halign: "center" } },
      { content: "Consumption / Waste", colSpan: 3, styles: { halign: "center" } },
      { content: "Closing", colSpan: 3, styles: { halign: "center" } },
    ],
    [
      "kg/l", "g/ml", "pcs",
      "kg/l", "g/ml", "pcs",
      "kg/l", "g/ml", "pcs",
      "kg/l", "g/ml", "pcs",
    ]
  ];

  const tableBody = items.map((it, idx) => {
    const isPiece = it.unit?.toLowerCase().includes("piece") || it.unit?.toLowerCase().includes("pc");
    return [
      idx + 1,
      it.stockName || "-",
      isPiece ? "-" : (it.opening?.kgL ?? 0),
      isPiece ? "-" : (it.opening?.gMl ?? 0),
      isPiece ? (it.opening?.piece ?? 0) : "-",
      isPiece ? "-" : (it.received?.kgL ?? 0),
      isPiece ? "-" : (it.received?.gMl ?? 0),
      isPiece ? (it.received?.piece ?? 0) : "-",
      isPiece ? "-" : (it.consumption?.kgL ?? 0),
      isPiece ? "-" : (it.consumption?.gMl ?? 0),
      isPiece ? (it.consumption?.piece ?? 0) : "-",
      isPiece ? "-" : (it.closing?.kgL ?? 0),
      isPiece ? "-" : (it.closing?.gMl ?? 0),
      isPiece ? (it.closing?.piece ?? 0) : "-",
    ];
  });

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
  const filename = `${filenamePrefix || safeName}_${reportSlug}_report_${isoDate}.pdf`;
  doc.save(filename);
};



// ================== Night Audit Report Functions ==================
const buildNightAuditData = (start, end, orders) => {
  const startTime = new Date(start).setHours(0, 0, 0, 0);
  const endTime = new Date(end).setHours(23, 59, 59, 999);

  const filtered = (orders || []).filter((order) => {
    const orderDate = getOrderDateValue(order);
    const time = orderDate instanceof Date ? orderDate.getTime() : new Date(orderDate).getTime();
    return time >= startTime && time <= endTime;
  });

  const dateMap = new Map();

  filtered.forEach((order) => {
    const orderDate = getOrderDateValue(order);
    const dObj = orderDate instanceof Date ? orderDate : new Date(orderDate);
    const dateStr = dObj.toISOString().slice(0, 10);

    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, {
        date: dateStr,
        restaurantOrders: 0,
        restaurantRevenue: 0,
        roomServiceOrders: 0,
        roomServiceRevenue: 0,
        zomatoOrders: 0,
        zomatoRevenue: 0,
        swiggyOrders: 0,
        swiggyRevenue: 0,
        banquetOrders: 0,
        banquetRevenue: 0,
        boardRoomOrders: 0,
        boardRoomRevenue: 0,
        totalOrders: 0,
        totalRevenue: 0,
      });
    }

    const row = dateMap.get(dateStr);
    const amt = safeNum(order.totalAmount || order.finalTotal || order.total || 0);
    const tbl = String(order.tableName || order.table || "").toLowerCase();
    const src = String(order.orderSource || order.source || order.orderSourceGroup || "").toLowerCase();
    const billNo = String(order.billNo || order.bill_no || order.orderId || "").toUpperCase();

    row.totalOrders += 1;
    row.totalRevenue += amt;

    if (tbl.includes("room") || tbl.includes("hotel") || src.includes("room") || tbl.startsWith("rm")) {
      row.roomServiceOrders += 1;
      row.roomServiceRevenue += amt;
    } else if (tbl.startsWith("zomato") || src.includes("zomato") || billNo.startsWith("ZM_") || billNo.startsWith("ZOMATO")) {
      row.zomatoOrders += 1;
      row.zomatoRevenue += amt;
    } else if (tbl.startsWith("swiggy") || src.includes("swiggy") || billNo.startsWith("SW_") || billNo.startsWith("SWIGGY")) {
      row.swiggyOrders += 1;
      row.swiggyRevenue += amt;
    } else if (tbl.includes("banquet") || src.includes("banquet")) {
      row.banquetOrders += 1;
      row.banquetRevenue += amt;
    } else if (tbl.includes("board") || src.includes("board") || tbl.includes("conference")) {
      row.boardRoomOrders += 1;
      row.boardRoomRevenue += amt;
    } else {
      row.restaurantOrders += 1;
      row.restaurantRevenue += amt;
    }
  });

  const rows = Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));

  const totals = rows.reduce(
    (acc, r) => ({
      restaurantOrders: acc.restaurantOrders + r.restaurantOrders,
      restaurantRevenue: acc.restaurantRevenue + r.restaurantRevenue,
      roomServiceOrders: acc.roomServiceOrders + r.roomServiceOrders,
      roomServiceRevenue: acc.roomServiceRevenue + r.roomServiceRevenue,
      zomatoOrders: acc.zomatoOrders + r.zomatoOrders,
      zomatoRevenue: acc.zomatoRevenue + r.zomatoRevenue,
      swiggyOrders: acc.swiggyOrders + r.swiggyOrders,
      swiggyRevenue: acc.swiggyRevenue + r.swiggyRevenue,
      banquetOrders: acc.banquetOrders + r.banquetOrders,
      banquetRevenue: acc.banquetRevenue + r.banquetRevenue,
      boardRoomOrders: acc.boardRoomOrders + r.boardRoomOrders,
      boardRoomRevenue: acc.boardRoomRevenue + r.boardRoomRevenue,
      totalOrders: acc.totalOrders + r.totalOrders,
      totalRevenue: acc.totalRevenue + r.totalRevenue,
    }),
    {
      restaurantOrders: 0,
      restaurantRevenue: 0,
      roomServiceOrders: 0,
      roomServiceRevenue: 0,
      zomatoOrders: 0,
      zomatoRevenue: 0,
      swiggyOrders: 0,
      swiggyRevenue: 0,
      banquetOrders: 0,
      banquetRevenue: 0,
      boardRoomOrders: 0,
      boardRoomRevenue: 0,
      totalOrders: 0,
      totalRevenue: 0,
    }
  );

  return { rows, totals };
};

const exportNightAuditExcel = (builtData, institutionData, start, end) => {
  const { rows = [], totals = {} } = builtData || {};
  const exportData = rows.map((r) => ({
    "Date": r.date,
    "Restaurant Orders": r.restaurantOrders,
    "Restaurant Revenue": safeNum(r.restaurantRevenue),
    "Room Service Orders": r.roomServiceOrders,
    "Room Service Revenue": safeNum(r.roomServiceRevenue),
    "Zomato Orders": r.zomatoOrders,
    "Zomato Revenue": safeNum(r.zomatoRevenue),
    "Swiggy Orders": r.swiggyOrders,
    "Swiggy Revenue": safeNum(r.swiggyRevenue),
    "Banquet Hall Orders": r.banquetOrders,
    "Banquet Hall Revenue": safeNum(r.banquetRevenue),
    "Board Room Orders": r.boardRoomOrders,
    "Board Room Revenue": safeNum(r.boardRoomRevenue),
    "Total Orders": r.totalOrders,
    "Total Revenue": safeNum(r.totalRevenue),
  }));

  if (totals && rows.length > 0) {
    exportData.push({
      "Date": "TOTAL",
      "Restaurant Orders": totals.restaurantOrders,
      "Restaurant Revenue": safeNum(totals.restaurantRevenue),
      "Room Service Orders": totals.roomServiceOrders,
      "Room Service Revenue": safeNum(totals.roomServiceRevenue),
      "Zomato Orders": totals.zomatoOrders,
      "Zomato Revenue": safeNum(totals.zomatoRevenue),
      "Swiggy Orders": totals.swiggyOrders,
      "Swiggy Revenue": safeNum(totals.swiggyRevenue),
      "Banquet Hall Orders": totals.banquetOrders,
      "Banquet Hall Revenue": safeNum(totals.banquetRevenue),
      "Board Room Orders": totals.boardRoomOrders,
      "Board Room Revenue": safeNum(totals.boardRoomRevenue),
      "Total Orders": totals.totalOrders,
      "Total Revenue": safeNum(totals.totalRevenue),
    });
  }

  const ws = XLSX.utils.json_to_sheet(exportData);
  applyExcelStyles(ws, exportData);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Night Audit");
  const comp = (institutionData?.companyName || "Restaurant").replace(/\s+/g, "_");
  XLSX.writeFile(
    wb,
    `${comp}_Night_Audit_${start.toISOString().slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString()
        ? `_to_${end.toISOString().slice(0, 10)}`
        : ""
    }.xlsx`
  );
};

const exportNightAuditPDF = (builtData, institutionData, start, end) => {
  const { rows = [], totals = {} } = builtData || {};
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

  const title = (institutionData?.companyName || "Restaurant").toUpperCase();
  const subtitle = "NIGHT AUDIT REPORT - CHANNEL REVENUE BREAKDOWN";
  const dateText = `Period: ${start.toLocaleDateString("en-IN")} to ${end.toLocaleDateString("en-IN")}`;
  const generatedText = `Generated: ${currentTime}`;

  let yPos = addProfessionalHeader(doc, title, subtitle, dateText, generatedText);

  // Executive Summary
  yPos += 6;
  doc.setFont("helvetica", "bold").setFontSize(11).text("NIGHT AUDIT CHANNEL SUMMARY", 15, yPos);
  yPos += 4;
  doc.setDrawColor(200).line(15, yPos, 90, yPos);
  yPos += 6;

  const summaryBody = [
    ["Restaurant Dine-in", `${totals.restaurantOrders || 0} ord`, `₹${safeNum(totals.restaurantRevenue).toFixed(2)}`, "Room Service", `${totals.roomServiceOrders || 0} ord`, `₹${safeNum(totals.roomServiceRevenue).toFixed(2)}`],
    ["Zomato Delivery", `${totals.zomatoOrders || 0} ord`, `₹${safeNum(totals.zomatoRevenue).toFixed(2)}`, "Swiggy Delivery", `${totals.swiggyOrders || 0} ord`, `₹${safeNum(totals.swiggyRevenue).toFixed(2)}`],
    ["Banquet Hall", `${totals.banquetOrders || 0} ord`, `₹${safeNum(totals.banquetRevenue).toFixed(2)}`, "Board Room", `${totals.boardRoomOrders || 0} ord`, `₹${safeNum(totals.boardRoomRevenue).toFixed(2)}`],
    ["Total Orders Processed", `${totals.totalOrders || 0}`, "", "Total Day Revenue", "", `₹${safeNum(totals.totalRevenue).toFixed(2)}`],
  ];

  doc.autoTable({
    startY: yPos,
    body: summaryBody,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5 },
    margin: { left: 15, right: 15 },
  });

  yPos = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "bold").setFontSize(10).text("DAILY NIGHT AUDIT BREAKDOWN", 15, yPos);
  yPos += 4;
  doc.line(15, yPos, 80, yPos);
  yPos += 6;

  const tableColumns = [
    "Date",
    "Rest (Ord / Rev)",
    "Room Svc (Ord / Rev)",
    "Zomato (Ord / Rev)",
    "Swiggy (Ord / Rev)",
    "Banquet (Ord / Rev)",
    "Board Rm (Ord / Rev)",
    "Total (Ord / Rev)",
  ];

  const tableData = rows.map((r) => [
    r.date,
    `${r.restaurantOrders} / ₹${safeNum(r.restaurantRevenue).toFixed(0)}`,
    `${r.roomServiceOrders} / ₹${safeNum(r.roomServiceRevenue).toFixed(0)}`,
    `${r.zomatoOrders} / ₹${safeNum(r.zomatoRevenue).toFixed(0)}`,
    `${r.swiggyOrders} / ₹${safeNum(r.swiggyRevenue).toFixed(0)}`,
    `${r.banquetOrders} / ₹${safeNum(r.banquetRevenue).toFixed(0)}`,
    `${r.boardRoomOrders} / ₹${safeNum(r.boardRoomRevenue).toFixed(0)}`,
    `${r.totalOrders} / ₹${safeNum(r.totalRevenue).toFixed(0)}`,
  ]);

  if (totals && rows.length > 0) {
    tableData.push([
      "TOTAL",
      `${totals.restaurantOrders} / ₹${safeNum(totals.restaurantRevenue).toFixed(0)}`,
      `${totals.roomServiceOrders} / ₹${safeNum(totals.roomServiceRevenue).toFixed(0)}`,
      `${totals.zomatoOrders} / ₹${safeNum(totals.zomatoRevenue).toFixed(0)}`,
      `${totals.swiggyOrders} / ₹${safeNum(totals.swiggyRevenue).toFixed(0)}`,
      `${totals.banquetOrders} / ₹${safeNum(totals.banquetRevenue).toFixed(0)}`,
      `${totals.boardRoomOrders} / ₹${safeNum(totals.boardRoomRevenue).toFixed(0)}`,
      `${totals.totalOrders} / ₹${safeNum(totals.totalRevenue).toFixed(0)}`,
    ]);
  }

  doc.autoTable({
    startY: yPos,
    head: [tableColumns],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
    bodyStyles: { fontSize: 8, textColor: [44, 62, 80], halign: "center" },
    styles: { cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1 },
    margin: { left: 15, right: 15 },
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addProfessionalFooter(doc, i, totalPages, "Confidential - Night Audit Daily Channel Report");
  }

  const safeName = (institutionData?.companyName || "Restaurant").replace(/\s+/g, "_").toLowerCase();
  doc.save(`${safeName}_Night_Audit_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}.pdf`);
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
    ["Analysis Period", `${Math.floor((end-start)/(1000*60*60*24))+1} days`, "", ""],
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

  // Detailed Orders
  yPos = doc.lastAutoTable.finalY + 15;
  doc.setFont("helvetica","bold").setFontSize(10).text("DETAILED ORDER INFORMATION",20,yPos);
  yPos += 5; doc.line(20,yPos,115,yPos); yPos += 8;

  const isBhuk = institutionData?.institution === "bhuk2323";
  const isHotel = institutionData?.integration === "HOTEL" || institutionData?.hotel_integration === true || institutionData?.hotel_integration === "Yes";
  let tableColumns = [...(isHotel ? ["Bill No"] : []), "Order ID","Customer","Table",...(isBhuk?["Phone"]:[]),"Date","Time","Items","Amount"];

  const tableData = orders.map(order=>{
    const itemsText = Array.isArray(order.items)?order.items.map(i=>`${i.name}(${i.quantity})`).join(", "):"No items";
    const row = [
      ...(isHotel ? [order.billNo || order.billNumber || order.orderId || "-"] : []),
      order.orderId||"N/A", order.name||"N/A", order.tableName||"N/A", ...(isBhuk?[order.phoneNumber||"N/A"]:[]),
      new Date(order.createdAt).toLocaleDateString("en-IN"),
      new Date(order.createdAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",hour12:false}),
      itemsText.length>60?itemsText.slice(0,57)+"...":itemsText,
      `${safeNum(order.totalAmount).toFixed(2)}`
    ];
    if (subtype==="cancelled") row.push(order.reason||"N/A");
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



// ================== exportComplementaryPDF ==================
const exportComplementaryPDF = (builtData, institutionData, start, end) => {
  const { orders = [], totalBilledAmount = 0, totalBarAmount = 0, totalCafeAmount = 0 } = builtData || {};

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const currentTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const title = (institutionData?.companyName || "Company Name").toUpperCase();
  const subtitle = "COMPLEMENTARY ORDERS REPORT";
  const dateText = `Period: ${start.toLocaleDateString("en-IN")} to ${end.toLocaleDateString("en-IN")}`;
  const generatedText = `Generated: ${currentTime}`;

  let yPos = addProfessionalHeader(doc, title, subtitle, dateText, generatedText);

  // Executive Summary
  yPos += 8;
  doc.setFont("helvetica", "bold").setFontSize(12).text("EXECUTIVE SUMMARY", 20, yPos);
  yPos += 5;
  doc.setDrawColor(200).line(20, yPos, 80, yPos);
  yPos += 8;

  const summaryBody = [
    ["Total Complementary Orders", String(orders.length), "Total Complementary Value", `${totalBilledAmount.toFixed(2)}`],
    ["Bar Complementary Value", `${totalBarAmount.toFixed(2)}`, "Cafe Complementary Value", `${totalCafeAmount.toFixed(2)}`],
  ];

  doc.autoTable({
    startY: yPos,
    body: summaryBody,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 20, right: 20 },
    tableWidth: "auto",
    halign: "center",
  });

  // Detailed Orders
  yPos = doc.lastAutoTable.finalY + 15;
  doc.setFont("helvetica", "bold").setFontSize(10).text("DETAILED COMPLEMENTARY ORDERS", 20, yPos);
  yPos += 5;
  doc.line(20, yPos, 115, yPos);
  yPos += 8;

  const tableColumns = ["Order ID", "Customer", "Table", "Option / Reason", "Date", "Items", "Value"];

  const tableData = orders.map((order) => {
    const itemsText = Array.isArray(order.items)
      ? order.items.map((i) => `${i.name || "Item"}(x${i.quantity || 1})`).join(", ")
      : "No items";
    const optionText = order.orderSource || order.payerName || order.narration || order.staffName || "Complementary";
    return [
      order.orderId || "N/A",
      getCustomerDisplayName(order),
      order.tableName || "N/A",
      optionText,
      new Date(order.createdAt).toLocaleDateString("en-IN"),
      itemsText.length > 50 ? itemsText.slice(0, 47) + "..." : itemsText,
      `${safeNum(order.totalAmount).toFixed(2)}`,
    ];
  });

  doc.autoTable({
    startY: yPos,
    head: [tableColumns],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [52, 73, 94], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
    bodyStyles: { fontSize: 7, textColor: [44, 62, 80] },
    styles: { cellPadding: 2, overflow: "linebreak", lineColor: [189, 195, 199], lineWidth: 0.1 },
    margin: { left: 20, right: 20 },
    tableWidth: "auto",
    halign: "center",
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addProfessionalFooter(doc, i, totalPages, "This document is computer generated and requires no signature for authenticity.");
    if (i === totalPages) {
      const footerY = Math.max(doc.lastAutoTable.finalY + 15, doc.internal.pageSize.height - 40);
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(40, 40, 40);
      doc.text(`TOTAL COMPLEMENTARY ORDERS: ${orders.length}`, 20, footerY);
      doc.text(`TOTAL VALUE: ${totalBilledAmount.toFixed(2)}`, doc.internal.pageSize.width - 80, footerY);
    }
  }

  const safeName = (institutionData.companyName || "company").replace(/\s+/g, "_").toLowerCase();
  doc.save(`${safeName}_Complementary_Report_${start.toISOString().slice(0, 10)}_to_${end.toISOString().slice(0, 10)}.pdf`);
};

// ================== exportComplementaryExcel ==================
const exportComplementaryExcel = (builtData, institutionData, start, end) => {
  const { orders = [], totalBilledAmount = 0 } = builtData;
  const exportData = orders.map((order) => ({
    "Order ID": order.orderId || "N/A",
    Customer: getCustomerDisplayName(order),
    Table: order.tableName || "N/A",
    "Option / Reason": order.orderSource || order.payerName || order.narration || "Complementary",
    "Authorized By / Staff": order.staffName || "N/A",
    Date: getOrderDateValue(order).toLocaleDateString(),
    Time: getOrderDateValue(order).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    "Value ()": safeNum(order.totalAmount),
    Items: order.items
      ? order.items.map((it) => `${it.name || "N/A"}(x${it.quantity || 0})`).join("; ")
      : "",
  }));

  exportData.push({
    "Order ID": "Total",
    Customer: "",
    Table: "",
    "Option / Reason": "",
    "Authorized By / Staff": "",
    Date: "",
    Time: "",
    "Value ()": totalBilledAmount,
    Items: `${orders.length} orders`,
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  applyExcelStyles(ws, exportData);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Complementary Report");
  XLSX.writeFile(
    wb,
    `${institutionData.companyName}_complementary_${start.toISOString().slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString()
        ? `_to_${end.toISOString().slice(0, 10)}`
        : ""
    }.xlsx`
  );
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

  const isHotel = institutionData?.integration === "HOTEL" || institutionData?.hotel_integration === true || institutionData?.hotel_integration === "Yes";
  const orderSummaryData = orders.slice(0,15).map(o=>[
    ...(isHotel ? [o.billNo || o.billNumber || o.orderId || "-"] : []),
    o.orderId||"N/A", o.name||"N/A",
    new Date(o.createdAt).toLocaleDateString("en-IN"),
    `${safeNum(o.totalAmount).toFixed(2)}`
  ]);
  if (orders.length>15) orderSummaryData.push([
    ...(isHotel ? ["..."] : []),
    "... ",
    `${orders.length - 15} more orders`,
    "...",
    "" + orders.slice(15).reduce((s, o) => s + safeNum(o.totalAmount), 0).toFixed(2)
  ]);

  doc.autoTable({
    startY: yPos,
    head: [[...(isHotel ? ["Bill No"] : []), "Order ID","Customer","Date","Amount"]],
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

// Detailed cafe Excel export with kg/l, g/ml and piece breakdown
const exportCafeExcel = (builtData, institutionData, isoDate, options = {}) => {
  const { sheetName = "Stock Report", reportSlug = "stock" } = options;
  const { items } = builtData;
  const exportData = items.map((it) => {
    const isPiece = it.unit?.toLowerCase().includes("piece") || it.unit?.toLowerCase().includes("pc");
    return {
      "Item Name": it.stockName,
      "Base Unit": it.unit,
      "Opening (kg/l)": isPiece ? "-" : (it.opening?.kgL ?? 0),
      "Opening (g/ml)": isPiece ? "-" : (it.opening?.gMl ?? 0),
      "Opening (pcs)": isPiece ? (it.opening?.piece ?? 0) : "-",
      "Received (kg/l)": isPiece ? "-" : (it.received?.kgL ?? 0),
      "Received (g/ml)": isPiece ? "-" : (it.received?.gMl ?? 0),
      "Received (pcs)": isPiece ? (it.received?.piece ?? 0) : "-",
      "Consumption / Waste (kg/l)": isPiece ? "-" : (it.consumption?.kgL ?? 0),
      "Consumption / Waste (g/ml)": isPiece ? "-" : (it.consumption?.gMl ?? 0),
      "Consumption / Waste (pcs)": isPiece ? (it.consumption?.piece ?? 0) : "-",
      "Closing (kg/l)": isPiece ? "-" : (it.closing?.kgL ?? 0),
      "Closing (g/ml)": isPiece ? "-" : (it.closing?.gMl ?? 0),
      "Closing (pcs)": isPiece ? (it.closing?.piece ?? 0) : "-",
      "Opening Summary": it.openingDisplay,
      "Received Summary": it.receivedDisplay,
      "Consumption Summary": it.consumptionDisplay,
      "Closing Summary": it.closingDisplay,
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  applyExcelStyles(ws, exportData);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(
    wb,
    `${institutionData.companyName || "Company"}_${reportSlug}_report_${isoDate}.xlsx`
  );
};

const getPaymentMethod = (order) => {
  return getPaymentMethodLabel(order) || "Unknown";
};

const getPaymentDisplay = (order) => {
  // For unpaid or cancelled orders, show status instead of payment method
  if (order.paymentStatus !== true) {
    if (order.cancel === true) {
      return `CANCELLED${order.reason ? ` - ${order.reason}` : ''}`;
    }
    return "PENDING PAYMENT";
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
  return getPaymentMethodLabel(order);
};
const buildOrderReport = (start, end, filteredOrders) => {
  const startTime = new Date(start).setHours(0, 0, 0, 0);
  const endTime = new Date(end).setHours(23, 59, 59, 999);
  
  const orders = filteredOrders
    .filter((order) => {
      const orderDate = getOrderDateValue(order);
      return orderDate >= startTime && orderDate <= endTime;
    })
    .sort((a, b) => getPaymentMethod(a).localeCompare(getPaymentMethod(b)));

  let totalBilledAmount = 0, totalCgst = 0, totalSgst = 0, totalServiceTax = 0;
  let totalBarAmount = 0, totalCafeAmount = 0, totalBarItemsCount = 0, totalCafeItemsCount = 0;
  const paymentBreakdown = {};
  const itemQuantities = {};

  // Separate calculation for paid vs unpaid orders
  const paidOrders = orders.filter((order) => isPaidOrCompletedOrder(order));
  const unpaidOrders = orders.filter(order => order.paymentStatus !== true);

  // Calculate totals from ALL orders (billed amounts include pending/cancelled)
  orders.forEach((order) => {
    totalBilledAmount += safeNum(order.totalAmount);
    totalCgst += safeNum(order.cgst);
    totalSgst += safeNum(order.sgst);
    totalServiceTax += safeNum(order.serviceTax);

    getOrderItems(order).forEach((it) => {
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

  // Calculate payment breakdown ONLY from PAID orders
  paidOrders.forEach((order) => {
    const payKey = getPaymentMethodLabel(order);
    paymentBreakdown[payKey] = (paymentBreakdown[payKey] || 0) + safeNum(order.totalAmount);
  });

  // For pending/cancelled reports, you might want to track unpaid amounts separately
  if (filteredOrders.length > 0 && !isPaidOrCompletedOrder(filteredOrders[0])) {
    // For pending/cancelled reports, add a special category for unpaid amounts
    const totalUnpaid = unpaidOrders.reduce((sum, order) => sum + safeNum(order.totalAmount), 0);
    if (totalUnpaid > 0) {
      paymentBreakdown["Unpaid/Pending"] = totalUnpaid;
    }
  }

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

const buildFoodDeliveryReport = (start, end, allOrders) => {
  const foodDeliveryOrders = allOrders.filter((order) => isFoodDeliveryOrder(order));
  return buildOrderReport(start, end, foodDeliveryOrders);
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
  const isHotel = institutionData?.integration === "HOTEL" || institutionData?.hotel_integration === true || institutionData?.hotel_integration === "Yes";
  const { orders } = builtData;
  const exportData = orders.map((order) => ({
    ...(isHotel ? { "Bill No": order.billNo || order.billNumber || order.orderId || "-" } : {}),
    "Order ID": order.orderId || "N/A",
    Customer: getCustomerDisplayName(order),
    Table: order.tableName || "N/A",
    Date: getOrderDateValue(order).toLocaleDateString(),
    Time: getOrderDateValue(order).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    Total: safeNum(order.totalAmount),
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
  XLSX.utils.book_append_sheet(wb, ws, "Settlement Summary");

  if (builtData.orders && builtData.orders.length > 0) {
    const isHotel = institutionData?.integration === "HOTEL" || institutionData?.hotel_integration === true || institutionData?.hotel_integration === "Yes";
    const ordersSheetData = builtData.orders.map((order) => ({
      ...(isHotel ? { "Bill No": order.billNo || order.billNumber || order.orderId || "-" } : {}),
      "Order ID": order.orderId || "N/A",
      Customer: getCustomerDisplayName(order),
      Table: order.tableName || "N/A",
      Date: getOrderDateValue(order).toLocaleDateString(),
      Time: getOrderDateValue(order).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      Total: safeNum(order.totalAmount),
      Items: order.items
        ? order.items.map((it) => `${it.name || "N/A"}(x${it.quantity || 0})`).join("; ")
        : "",
    }));
    const ordersWs = XLSX.utils.json_to_sheet(ordersSheetData);
    applyExcelStyles(ordersWs, ordersSheetData);
    XLSX.utils.book_append_sheet(wb, ordersWs, "Settled Orders");
  }
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
  const hasFoodDeliveryInstitution = Boolean(operationData?.foodDeliveryInstitution?.trim());
  const institution =
    institutionData?.institution ||
    institutionData?.id ||
    institutionData?.name ||
    "";
  const isHotel =
    institutionData?.integration === "HOTEL" ||
    institutionData?.hotel_integration === true ||
    institutionData?.hotel_integration === "Yes";

  const [stocks, setStocks] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  });
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
      case "bar_stock":
        return reportData.data.items?.length || 0;
      case "item":
        return reportData.data.items?.length || 0;
      case "order":
      case "settlement":
      case "complementary":
      case "food_delivery_order":
        return reportData.data.orders?.length || 0;
      case "night_audit":
        return reportData.data?.rows?.length || 0;
      case "itemId":
        return reportData.data.length || 0;
      default:
        return 0;
    }
  };

  // REPORT OPTIONS
  const reportOptions = [
    { value: "", label: "Select Report" },
    { value: "night_audit", label: "Night Audit Report" },
    { value: "cafe", label: institutionData?.bar_integration === "Yes" ? "Cafe Stock Report" : "Stock Report" },
    ...(institutionData?.bar_integration === "Yes" ? [{ value: "bar_stock", label: "Bar Stock Report" }] : []),
    { value: "item", label: "Item Report" },
    { value: "beverage_item", label: "Beverage Item Report" },
    { value: "kitchen_item", label: "Kitchen Item Report" },
    { value: "order", label: "Order Report" },
    ...(hasFoodDeliveryInstitution ? [{ value: "food_delivery_order", label: "Food Delivery Report" }] : []),
    { value: "settlement", label: "Settlement Report" },
    { value: "complementary", label: "Complementary Report" },
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

        // const foodDeliveryInstitution = operationData?.foodDeliveryInstitution || "";

        const [stockResponse, orderResponse, menuResponse, foodDeliveryResponse] = await Promise.all([
          API.get("main", `/admin/stock-list-items/${institution}`),
          API.get("main", `/admin/list-orders/${institution}?type=${type}`, {}),
          API.get("main", `/any/list-items/${institution}`),
          // foodDeliveryInstitution ? fetchFoodDeliveryOrders(foodDeliveryInstitution) : Promise.resolve([]),
        ]);

        setStocks(stockResponse || []);
        const combinedOrders = [
          ...tagOrderSource(orderResponse, "main"),
          ...tagOrderSource(foodDeliveryResponse, "fooddelivery"),
        ];
        setAllOrders(combinedOrders); // Keep all orders for pending/cancelled
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
    if (!hasFoodDeliveryInstitution && selectedReport === "food_delivery_order") {
      setSelectedReport("");
      setReportData(null);
    }
  }, [hasFoodDeliveryInstitution, selectedReport]);

useEffect(() => {
  const methods = new Set();
  const sources = new Set();

  // Only collect payment methods from PAID orders
  allOrders
    .filter(order => order.paymentStatus === true) // Only paid orders
    .forEach((order) => {
      if (order.paymentMethod) methods.add(order.paymentMethod);
      if (order.paymentMethods && Array.isArray(order.paymentMethods)) {
        order.paymentMethods.forEach((pm) => methods.add(pm.method));
      }
      // Collect orderSource values from all orders
      if (order.orderSource) sources.add(order.orderSource);
      if (order.orderSourceGroup === "fooddelivery") sources.add("Food Delivery");
    });

  setPaymentOptions(["All", ...Array.from(methods).sort()]);
  setOrderSourceOptions(["All", ...Array.from(sources).sort()]);
}, [allOrders]);

  useEffect(() => {
    if (!selectedReport || loading) return;

    let effectiveEnd = ["cafe", "bar_stock", "food_delivery_order"].includes(selectedReport) ? new Date(startDate) : endDate;

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
      if (source === "Food Delivery") return getOrderSourceGroup(order) === "fooddelivery";
      return order.orderSource === source;
    };

    let filteredOrders = allOrders;
if (["order", "settlement", "complementary"].includes(selectedReport)) {
  filteredOrders = allOrders.filter(
    (o) =>
      hasPayment(o, paymentFilter) &&
      hasOrderSource(o, orderSourceFilter) &&
      (selectedReport === "settlement"
        ? o.paymentStatus === true && !o.cancel && !isOrderComplementary(o)
        : selectedReport === "complementary"
        ? isOrderComplementary(o) && !o.cancel
        : true)
  );
} else if (selectedReport === "food_delivery_order") {
  filteredOrders = allOrders.filter(
    (o) =>
      isFoodDeliveryOrder(o) &&
      hasPayment(o, paymentFilter) &&
      hasOrderSource(o, orderSourceFilter)
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
      const isoStart = formatLocalDate(startDate);
      if (selectedReport === "cafe" || selectedReport === "bar_stock") {
        const typeFilter = selectedReport === "bar_stock" ? "bar" : "cafe";
        const data = buildCafeDailyReport(isoStart, stocks, typeFilter);
        setReportData({ type: "cafe", subtype: typeFilter, data });
      } else if (selectedReport === "item") {
  const data = buildItemReport(startDate, effectiveEnd, filteredOrders, null, menuItems);
  setReportData({ type: "item", data });
}  else if (selectedReport === "beverage_item") {
    const data = buildItemReport(startDate, effectiveEnd, filteredOrders, "Beverage", menuItems);
    setReportData({ type: "item", subtype: "beverage", data });
} else if (selectedReport === "kitchen_item") {
    const data = buildItemReport(startDate, effectiveEnd, filteredOrders, "Kitchen", menuItems);
    setReportData({ type: "item", subtype: "kitchen", data });
} else if (selectedReport === "food_delivery_order") {
  const data = buildFoodDeliveryReport(startDate, effectiveEnd, filteredOrders);
  setReportData({ type: "food_delivery_order", data });
} else if (selectedReport === "night_audit") {
        const data = buildNightAuditData(startDate, effectiveEnd, filteredOrders);
        setReportData({ type: "night_audit", data });
      } else if (["order", "settlement", "complementary", "pending_orders", "cancelled_orders"].includes(selectedReport)) {
        const data = buildOrderReport(startDate, effectiveEnd, filteredOrders);
        setReportData({
          type: selectedReport === "settlement" ? "settlement" : selectedReport === "complementary" ? "complementary" : "order",
          subtype: selectedReport === "pending_orders" ? "pending" : selectedReport === "cancelled_orders" ? "cancelled" : selectedReport === "complementary" ? "complementary" : null,
          data,
        });
      }
    }
  }, [selectedReport, startDate, endDate, paymentFilter, orderSourceFilter, stocks, allOrders, menuItems, loading]);

  const getDateLimits = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(today.getMonth() - 2);
    twoMonthsAgo.setHours(0, 0, 0, 0);
    return { minDate: twoMonthsAgo, maxDate: today };
  };

  const handleDateSelection = (date, setDateFunction, closePicker) => {
    if (!date) return;
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    const { minDate, maxDate } = getDateLimits();
    if (normalized >= minDate && normalized <= maxDate) {
      setDateFunction(normalized);
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
      case "night_audit": {
        const { rows = [], totals = {} } = reportData.data || {};
        return (
          <div className="space-y-6">
            {/* Channel Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-center">
                <p className="text-xs text-blue-700 font-medium">Restaurant (Dine-in)</p>
                <p className="text-lg font-bold text-blue-900 mt-1">₹{safeNum(totals.restaurantRevenue).toFixed(2)}</p>
                <p className="text-[11px] text-blue-600">{totals.restaurantOrders || 0} orders</p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg text-center">
                <p className="text-xs text-indigo-700 font-medium">Room Service</p>
                <p className="text-lg font-bold text-indigo-900 mt-1">₹{safeNum(totals.roomServiceRevenue).toFixed(2)}</p>
                <p className="text-[11px] text-indigo-600">{totals.roomServiceOrders || 0} orders</p>
              </div>
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg text-center">
                <p className="text-xs text-red-700 font-medium">Zomato</p>
                <p className="text-lg font-bold text-red-900 mt-1">₹{safeNum(totals.zomatoRevenue).toFixed(2)}</p>
                <p className="text-[11px] text-red-600">{totals.zomatoOrders || 0} orders</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg text-center">
                <p className="text-xs text-orange-700 font-medium">Swiggy</p>
                <p className="text-lg font-bold text-orange-900 mt-1">₹{safeNum(totals.swiggyRevenue).toFixed(2)}</p>
                <p className="text-[11px] text-orange-600">{totals.swiggyOrders || 0} orders</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-center">
                <p className="text-xs text-emerald-700 font-medium">Banquet Hall</p>
                <p className="text-lg font-bold text-emerald-900 mt-1">₹{safeNum(totals.banquetRevenue).toFixed(2)}</p>
                <p className="text-[11px] text-emerald-600">{totals.banquetOrders || 0} orders</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg text-center">
                <p className="text-xs text-purple-700 font-medium">Board Room</p>
                <p className="text-lg font-bold text-purple-900 mt-1">₹{safeNum(totals.boardRoomRevenue).toFixed(2)}</p>
                <p className="text-[11px] text-purple-600">{totals.boardRoomOrders || 0} orders</p>
              </div>
              <div className="bg-gray-100 border border-gray-300 p-3 rounded-lg text-center">
                <p className="text-xs text-gray-700 font-semibold">Total Revenue</p>
                <p className="text-lg font-extrabold text-gray-900 mt-1">₹{safeNum(totals.totalRevenue).toFixed(2)}</p>
                <p className="text-[11px] text-gray-600">{totals.totalOrders || 0} total orders</p>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="overflow-x-auto text-sm border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-blue-800 uppercase">Restaurant</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-indigo-800 uppercase">Room Service</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-red-800 uppercase">Zomato</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-orange-800 uppercase">Swiggy</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-emerald-800 uppercase">Banquet</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-purple-800 uppercase">Board Room</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase bg-gray-100">Day Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                        No orders recorded for selected date range
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/50 hover:bg-gray-100"}>
                        <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{r.date}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="font-medium text-gray-800">₹{safeNum(r.restaurantRevenue).toFixed(2)}</span>
                          <span className="text-xs text-gray-400 block">({r.restaurantOrders} ord)</span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="font-medium text-gray-800">₹{safeNum(r.roomServiceRevenue).toFixed(2)}</span>
                          <span className="text-xs text-gray-400 block">({r.roomServiceOrders} ord)</span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="font-medium text-gray-800">₹{safeNum(r.zomatoRevenue).toFixed(2)}</span>
                          <span className="text-xs text-gray-400 block">({r.zomatoOrders} ord)</span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="font-medium text-gray-800">₹{safeNum(r.swiggyRevenue).toFixed(2)}</span>
                          <span className="text-xs text-gray-400 block">({r.swiggyOrders} ord)</span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="font-medium text-gray-800">₹{safeNum(r.banquetRevenue).toFixed(2)}</span>
                          <span className="text-xs text-gray-400 block">({r.banquetOrders} ord)</span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <span className="font-medium text-gray-800">₹{safeNum(r.boardRoomRevenue).toFixed(2)}</span>
                          <span className="text-xs text-gray-400 block">({r.boardRoomOrders} ord)</span>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap bg-gray-50/70 font-semibold text-gray-900">
                          <span>₹{safeNum(r.totalRevenue).toFixed(2)}</span>
                          <span className="text-xs text-gray-500 block">({r.totalOrders} total)</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <tr>
                      <td className="px-4 py-3 text-gray-900">TOTAL</td>
                      <td className="px-3 py-3 text-right text-gray-900">₹{safeNum(totals.restaurantRevenue).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-gray-900">₹{safeNum(totals.roomServiceRevenue).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-gray-900">₹{safeNum(totals.zomatoRevenue).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-gray-900">₹{safeNum(totals.swiggyRevenue).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-gray-900">₹{safeNum(totals.banquetRevenue).toFixed(2)}</td>
                      <td className="px-3 py-3 text-right text-gray-900">₹{safeNum(totals.boardRoomRevenue).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-primaryColor font-extrabold bg-gray-200">
                        ₹{safeNum(totals.totalRevenue).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        );
      }

      case "cafe": {
        const { items: cafeItems } = reportData.data;
        return (
          <div className="overflow-x-auto text-sm">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th rowSpan={2} className="px-3 py-2 border text-left text-xs font-semibold text-gray-700 bg-gray-100 min-w-[160px]">
                    Item Name
                  </th>
                  <th colSpan={3} className="px-3 py-1.5 border text-center text-xs font-semibold text-blue-900 bg-blue-50/70">
                    Opening
                  </th>
                  <th colSpan={3} className="px-3 py-1.5 border text-center text-xs font-semibold text-emerald-900 bg-emerald-50/70">
                    Received
                  </th>
                  <th colSpan={3} className="px-3 py-1.5 border text-center text-xs font-semibold text-amber-900 bg-amber-50">
                    Consumption / Waste
                  </th>
                  <th colSpan={3} className="px-3 py-1.5 border text-center text-xs font-semibold text-purple-900 bg-purple-50/70">
                    Closing
                  </th>
                </tr>
                <tr className="bg-gray-50 text-[11px] font-medium text-gray-600">
                  {/* Opening */}
                  <th className="px-2 py-1 border text-right">kg/l</th>
                  <th className="px-2 py-1 border text-right font-semibold text-blue-700 bg-blue-50/40">g/ml</th>
                  <th className="px-2 py-1 border text-right">pcs</th>

                  {/* Received */}
                  <th className="px-2 py-1 border text-right">kg/l</th>
                  <th className="px-2 py-1 border text-right font-semibold text-emerald-700 bg-emerald-50/40">g/ml</th>
                  <th className="px-2 py-1 border text-right">pcs</th>

                  {/* Consumption / Waste */}
                  <th className="px-2 py-1 border text-right text-amber-700">kg/l</th>
                  <th className="px-2 py-1 border text-right font-semibold text-amber-800 bg-amber-100/50">g/ml</th>
                  <th className="px-2 py-1 border text-right text-amber-700">pcs</th>

                  {/* Closing */}
                  <th className="px-2 py-1 border text-right font-semibold text-gray-800">kg/l</th>
                  <th className="px-2 py-1 border text-right font-semibold text-purple-700 bg-purple-50/40">g/ml</th>
                  <th className="px-2 py-1 border text-right font-semibold text-gray-800">pcs</th>
                </tr>
              </thead>
              <tbody>
                {cafeItems.map((it, index) => {
                  const isPiece = it.unit?.toLowerCase().includes("piece") || it.unit?.toLowerCase().includes("pc");
                  return (
                    <tr key={index} className={index % 2 === 0 ? "bg-white hover:bg-gray-50" : "bg-gray-50/60 hover:bg-gray-100/80"}>
                      <td className="px-3 py-2 border text-left font-medium text-gray-800">
                        {it.stockName}
                        <span className="ml-1 text-[11px] text-gray-400 font-normal">({it.unit})</span>
                      </td>

                      {/* Opening */}
                      <td className="px-2 py-1.5 border text-right text-gray-700">{isPiece ? "-" : it.opening.kgL}</td>
                      <td className="px-2 py-1.5 border text-right font-medium text-blue-700 bg-blue-50/20">{isPiece ? "-" : it.opening.gMl}</td>
                      <td className="px-2 py-1.5 border text-right text-gray-700">{isPiece ? it.opening.piece : "-"}</td>

                      {/* Received */}
                      <td className="px-2 py-1.5 border text-right text-gray-700">{isPiece ? "-" : it.received.kgL}</td>
                      <td className="px-2 py-1.5 border text-right font-medium text-emerald-700 bg-emerald-50/20">{isPiece ? "-" : it.received.gMl}</td>
                      <td className="px-2 py-1.5 border text-right text-gray-700">{isPiece ? it.received.piece : "-"}</td>

                      {/* Consumption / Waste */}
                      <td className="px-2 py-1.5 border text-right text-amber-700">{isPiece ? "-" : it.consumption.kgL}</td>
                      <td className="px-2 py-1.5 border text-right font-medium text-amber-800 bg-amber-50/40">{isPiece ? "-" : it.consumption.gMl}</td>
                      <td className="px-2 py-1.5 border text-right text-amber-700">{isPiece ? it.consumption.piece : "-"}</td>

                      {/* Closing */}
                      <td className="px-2 py-1.5 border text-right font-semibold text-gray-900">{isPiece ? "-" : it.closing.kgL}</td>
                      <td className="px-2 py-1.5 border text-right font-semibold text-purple-700 bg-purple-50/20">{isPiece ? "-" : it.closing.gMl}</td>
                      <td className="px-2 py-1.5 border text-right font-semibold text-gray-900">{isPiece ? it.closing.piece : "-"}</td>
                    </tr>
                  );
                })}
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
                {/* Taxes removed from summary per request */}
              </tbody>
            </table>

            {/* Payment breakdown removed from preview */}

            {/* Orders */}
            <h2 className="text-base font-bold mb-2">Orders</h2>
            <table className="min-w-full bg-white border border-gray-300 text-sm">
              <thead className="bg-gray-100">
    <tr>
    {isHotel && <th className="px-3 py-2 border text-left text-xs font-semibold text-blue-900 bg-blue-50">Bill No</th>}
    <th className="px-3 py-2 border text-left text-xs">Order ID</th>
    <th className="px-3 py-2 border text-left text-xs">Customer</th>
    <th className="px-3 py-2 border text-left text-xs">Table</th>
    {institutionData?.institution === "bhuk2323" && (
      <th className="px-3 py-2 border text-left text-xs">Phone</th>
    )}
    <th className="px-3 py-2 border text-center text-xs">Date</th>
    <th className="px-3 py-2 border text-center text-xs">Time</th>
    <th className="px-3 py-2 border text-right text-xs">Total</th>
    <th className="px-3 py-2 border text-left text-xs">Items</th>
    {isCancelled && <th className="px-3 py-2 border text-left text-xs">Cancel Reason</th>}
  </tr>
</thead>
              <tbody>
                {orders.map((order, index) => {
                  const paymentMethod = getPaymentDisplay(order);
                  const itemsSummary = getOrderItems(order).length > 0
                    ? getOrderItems(order)
                        .map((item) => `${item.name || item.itemName || "N/A"} (Qty: ${item.quantity || 0})`)
                        .join(", ")
                    : "N/A";

                  return (
                    <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                      {isHotel && (
                        <td className="px-3 py-2 border text-left font-mono font-bold text-blue-700 bg-blue-50/50">
                          {order.billNo || order.billNumber || order.orderId || "-"}
                        </td>
                      )}
                      <td className="px-3 py-2 border text-left">{order.orderId}</td>
                      <td className="px-3 py-2 border text-left">{getCustomerDisplayName(order)}</td>
                      <td className="px-3 py-2 border text-left">{order.tableName || "N/A"}</td>
                      {institutionData?.institution === "bhuk2323" && (
                        <td className="px-3 py-2 border text-left">{order.phoneNumber || "N/A"}</td>
                      )}
                      <td className="px-3 py-2 border text-center">{getOrderDateValue(order).toLocaleDateString()}</td>
                      <td className="px-3 py-2 border text-center">
                        {getOrderDateValue(order).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="px-3 py-2 border text-right">{safeNum(order.totalAmount).toFixed(2)}</td>
                      <td className="px-3 py-2 border text-left">{itemsSummary}</td>
                      {isCancelled && <td className="px-3 py-2 border text-left">{order.reason || "N/A"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      case "food_delivery_order": {
        const {
          orders,
          totalBilledAmount,
          totalCgst,
          totalSgst,
          totalServiceTax,
          paymentBreakdown,
        } = reportData.data;

        return (
          <div className="overflow-x-auto text-sm">
            <h2 className="text-base font-bold mb-2">Food Delivery Order Summary</h2>
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
                {/* Taxes removed from summary per request */}
              </tbody>
            </table>

            {/* Payment breakdown removed from preview */}

            <h2 className="text-base font-bold mb-2">Orders</h2>
            <table className="min-w-full bg-white border border-gray-300 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {isHotel && <th className="px-3 py-2 border text-left text-xs font-semibold text-blue-900 bg-blue-50">Bill No</th>}
                  <th className="px-3 py-2 border text-left text-xs">Order ID</th>
                  <th className="px-3 py-2 border text-left text-xs">Customer</th>
                  <th className="px-3 py-2 border text-center text-xs">Date</th>
                  <th className="px-3 py-2 border text-center text-xs">Time</th>
                  <th className="px-3 py-2 border text-right text-xs">Total</th>
                  <th className="px-3 py-2 border text-left text-xs">Items</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => {
                  const paymentMethod = getPaymentDisplay(order);
                  const itemsSummary = getOrderItems(order).length > 0
                    ? getOrderItems(order).map((item) => `${item.name || item.itemName || "N/A"} (Qty: ${item.quantity || 0})`).join(", ")
                    : "N/A";

                  return (
                    <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                      {isHotel && (
                        <td className="px-3 py-2 border text-left font-mono font-bold text-blue-700 bg-blue-50/50">
                          {order.billNo || order.billNumber || order.orderId || "-"}
                        </td>
                      )}
                      <td className="px-3 py-2 border text-left">{order.orderId}</td>
                      <td className="px-3 py-2 border text-left">{getCustomerDisplayName(order)}</td>
                      <td className="px-3 py-2 border text-center">{getOrderDateValue(order).toLocaleDateString()}</td>
                      <td className="px-3 py-2 border text-center">
                        {getOrderDateValue(order).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="px-3 py-2 border text-right">{safeNum(order.totalAmount).toFixed(2)}</td>
                      <td className="px-3 py-2 border text-left">{itemsSummary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }

      case "complementary": {
        const { orders, totalBilledAmount, totalBarAmount, totalCafeAmount } = reportData.data;
        return (
          <div className="overflow-x-auto text-sm">
            <h2 className="text-base font-bold mb-2">Complementary Orders Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
                <span className="text-xs text-amber-700 block">Total Complementary Orders</span>
                <span className="text-xl font-bold text-amber-900">{orders.length}</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
                <span className="text-xs text-amber-700 block">Total Value</span>
                <span className="text-xl font-bold text-amber-900">{totalBilledAmount.toFixed(2)}</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
                <span className="text-xs text-amber-700 block">Bar / Cafe Value</span>
                <span className="text-sm font-semibold text-amber-900">{totalBarAmount.toFixed(2)} / {totalCafeAmount.toFixed(2)}</span>
              </div>
            </div>

            <h2 className="text-base font-bold mb-2">Complementary Orders List</h2>
            <table className="min-w-full bg-white border border-gray-300 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border text-left text-xs">Order ID</th>
                  <th className="px-3 py-2 border text-left text-xs">Customer</th>
                  <th className="px-3 py-2 border text-left text-xs">Table</th>
                  <th className="px-3 py-2 border text-left text-xs">Option / Reason</th>
                  <th className="px-3 py-2 border text-left text-xs">Staff</th>
                  <th className="px-3 py-2 border text-center text-xs">Date</th>
                  <th className="px-3 py-2 border text-center text-xs">Time</th>
                  <th className="px-3 py-2 border text-right text-xs">Value</th>
                  <th className="px-3 py-2 border text-left text-xs">Items</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => {
                  const itemsSummary = order.items
                    ? order.items.map((item) => `${item.name || "N/A"} (Qty: ${item.quantity || 0})`).join(", ")
                    : "N/A";
                  const reason = order.orderSource || order.payerName || order.narration || "Complementary";
                  return (
                    <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                      <td className="px-3 py-2 border text-left font-mono font-medium">{order.orderId}</td>
                      <td className="px-3 py-2 border text-left">{getCustomerDisplayName(order)}</td>
                      <td className="px-3 py-2 border text-left">{order.tableName || "N/A"}</td>
                      <td className="px-3 py-2 border text-left font-medium text-amber-800">{reason}</td>
                      <td className="px-3 py-2 border text-left">{order.staffName || "N/A"}</td>
                      <td className="px-3 py-2 border text-center">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 border text-center">
                        {new Date(order.createdAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </td>
                      <td className="px-3 py-2 border text-right font-medium">{safeNum(order.totalAmount).toFixed(2)}</td>
                      <td className="px-3 py-2 border text-left">{itemsSummary}</td>
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

            {/* Payment breakdown removed from preview */}

            {/* Orders */}
            <h2 className="text-base font-bold mb-2">Orders</h2>
            <table className="min-w-full bg-white border border-gray-300 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {isHotel && <th className="px-3 py-2 border text-left text-xs font-semibold text-blue-900 bg-blue-50">Bill No</th>}
                  <th className="px-3 py-2 border text-left text-xs">Order ID</th>
                  <th className="px-3 py-2 border text-left text-xs">Customer</th>
                  <th className="px-3 py-2 border text-left text-xs">Table</th>
                  {institutionData?.institution === "bhuk2323" && (
                    <th className="px-3 py-2 border text-left text-xs">Phone</th>
                  )}
                  <th className="px-3 py-2 border text-center text-xs">Date</th>
                  <th className="px-3 py-2 border text-center text-xs">Time</th>
                  <th className="px-3 py-2 border text-right text-xs">Total</th>
                  <th className="px-3 py-2 border text-left text-xs">Items</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => {
                  const itemsSummary = order.items
                    ? order.items
                        .map((item) => `${item.name || "N/A"} (Qty: ${item.quantity || 0})`)
                        .join(", ")
                    : "N/A";

                  return (
                    <tr key={index} className={index % 2 === 0 ? "bg-gray-50" : ""}>
                      {isHotel && (
                        <td className="px-3 py-2 border text-left font-mono font-bold text-blue-700 bg-blue-50/50">
                          {order.billNo || order.billNumber || order.orderId || "-"}
                        </td>
                      )}
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
                      <td className="px-3 py-2 border text-right">{safeNum(order.totalAmount).toFixed(2)}</td>
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

    const isoDate = formatLocalDate(startDate);
    const buttons = [];

    switch (selectedReport) {
      case "cafe":
      case "bar_stock": {
        const isBar = selectedReport === "bar_stock";
        const title = isBar
          ? "Bar Stock Report"
          : (institutionData?.bar_integration === "Yes" ? "Cafe Stock Report" : "Stock Report");
        const slug = isBar ? "bar_stock" : "stock";
        buttons.push(
          <button
            key="stock-excel"
            onClick={() => exportCafeExcel(reportData.data, institutionData, isoDate, { sheetName: title, reportSlug: slug })}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FileSpreadsheet className="w-3 h-3" />
            Excel
          </button>,
          <button
            key="stock-pdf"
            onClick={() => exportCafeDailyReport(reportData.data, institutionData, isoDate, { reportTitle: title, reportSlug: slug })}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            <FileText className="w-3 h-3" />
            PDF
          </button>
        );
        break;
      }

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
      case "food_delivery_order":
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

      case "complementary":
        buttons.push(
          <button
            key="complementary-excel"
            onClick={() => exportComplementaryExcel(reportData.data, institutionData, startDate, endDate)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FileSpreadsheet className="w-3 h-3" />
            Excel
          </button>,
          <button
            key="complementary-pdf"
            onClick={() => exportComplementaryPDF(reportData.data, institutionData, startDate, endDate)}
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

      case "night_audit":
        buttons.push(
          <button
            key="night-audit-excel"
            onClick={() => exportNightAuditExcel(reportData.data, institutionData, startDate, endDate)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            <FileSpreadsheet className="w-3 h-3" />
            Excel
          </button>,
          <button
            key="night-audit-pdf"
            onClick={() => exportNightAuditPDF(reportData.data, institutionData, startDate, endDate)}
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {["cafe", "bar_stock"].includes(selectedReport) ? "Report Date" : "Start Date"}
                  </label>
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
                ["item", "beverage_item", "kitchen_item", "order", "settlement", "complementary", "pending_orders", "cancelled_orders"].includes(
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
              {["order", "settlement", "complementary", "pending_orders", "cancelled_orders"].includes(selectedReport) && (
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