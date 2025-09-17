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

const formatNumber = (num) => {
  const rounded = Number(num.toFixed(2));
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

const exportCafeDailyReport = (isoDate, stocks, institutionData) => {
  if (!isoDate) {
    alert("Choose a date first");
    return;
  }

  const { items } = buildCafeDailyReport(isoDate, stocks);

  const currentTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let html = `
    <div id="cafe-report-container" style="font-family: 'Courier New', Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #333; background: #fff; width: 100%; max-width: 210mm; margin: 0 auto; padding: 10mm; box-sizing: border-box;">
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-size: 18px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">${(
          institutionData?.companyName || "Company Name"
        ).toUpperCase()} Cafe Daily Stock Summary</div>
        <div style="font-size: 13px; margin-top: 2px; color: #555; text-transform: uppercase;">Detailed Inventory Report</div>
        <div style="font-size: 12px; margin-top: 4px; color: #666;">
          Date: ${isoDate
            .split("-")
            .reverse()
            .join("/")} | Printed: ${currentTime}
        </div>
        <table style="width: 100%; margin: 4px 0;"><tr><td colspan="18" style="border-bottom: 1px dashed #000;"></td></tr></table>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; margin: 0 auto;">
        <thead>
          <tr style="font-weight: bold; font-size: 12px; background: #f5f5f5; border-bottom: 1px dashed #000;">
            <th rowspan="2" style="width: 25%; text-align: left; padding: 4px 8px; text-transform: uppercase;">Item</th>
            <th colspan="3" style="text-align: center; padding: 4px 8px; text-transform: uppercase;">Opening</th>
            <th colspan="3" style="text-align: center; padding: 4px 8px; text-transform: uppercase;">Received</th>
            <th colspan="3" style="text-align: center; padding: 4px 8px; text-transform: uppercase;">Consumption</th>
            <th colspan="3" style="text-align: center; padding: 4px 8px; text-transform: uppercase;">Closing</th>
          </tr>
          <tr style="font-weight: bold; font-size: 11px; background: #f5f5f5; border-bottom: 1px dashed #000;">
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">kg/l</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">g/ml</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">piece</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">kg/l</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">g/ml</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">piece</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">kg/l</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">g/ml</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">piece</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">kg/l</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">g/ml</th>
            <th style="text-align: right; padding: 2px 8px; text-transform: uppercase;">piece</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it) => `
            <tr>
              <td style="padding: 4px 8px; text-align: left;">${it.stockName.substring(
                0,
                20
              )}</td>
              <td style="padding: 4px 8px; text-align: right;">${formatNumber(
                it.opening.kgL
              )}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.opening.gMl.toFixed(
                0
              )}</td>
              <td style="padding: 4px 8px; text-align: right;">${
                it.opening.piece
              }</td>
              <td style="padding: 4px 8px; text-align: right;">${formatNumber(
                it.received.kgL
              )}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.received.gMl.toFixed(
                0
              )}</td>
              <td style="padding: 4px 8px; text-align: right;">${
                it.received.piece
              }</td>
              <td style="padding: 4px 8px; text-align: right;">${formatNumber(
                it.consumption.kgL
              )}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.consumption.gMl.toFixed(
                0
              )}</td>
              <td style="padding: 4px 8px; text-align: right;">${
                it.consumption.piece
              }</td>
              <td style="padding: 4px 8px; text-align: right;">${formatNumber(
                it.closing.kgL
              )}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.closing.gMl.toFixed(
                0
              )}</td>
              <td style="padding: 4px 8px; text-align: right;">${
                it.closing.piece
              }</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <style>
      @media print {
        body * { visibility: hidden; }
        #cafe-report-container, #cafe-report-container * { visibility: visible; }
        #cafe-report-container { 
          position: absolute; 
          left: 50%; 
          top: 0; 
          transform: translateX(-50%); 
          width: 100%; 
          max-width: 210mm; 
          box-sizing: border-box; 
          text-align: center; 
        }
        @page { margin: 2mm; size: A4; }
        table { margin: 0 auto; }
        .flex { justify-content: center !important; }
      }
    </style>
  `;

  const existingReport = document.getElementById("cafe-report-container");
  if (existingReport) {
    existingReport.remove();
  }

  const reportDiv = document.createElement("div");
  reportDiv.innerHTML = html;
  document.body.appendChild(reportDiv);

  document.getElementById("cafe-report-container").style.display = "block";

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      const container = document.getElementById("cafe-report-container");
      if (container) container.style.display = "none";
    }, 1000);
  }, 500);
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
      catTotals.receivedBTL = formatBottlesMl(
        catTotals.receivedMl,
        oneBottleMl
      );
      catTotals.totalBTL = formatBottlesMl(catTotals.totalMl, oneBottleMl);
      catTotals.transferredBTL = formatBottlesMl(
        catTotals.transferredMl,
        oneBottleMl
      );
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

  const forcedType = "bar";
  const { saleCols, rateCols, categories, grandTotalAmount } =
    buildDailyReportByCategory(isoDate, forcedType, stocks, allOrders);

  const dayStart = new Date(isoDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const ordersForDate = (allOrders || []).filter((o) => {
    const created = Number(o.createdAt) || 0;
    return created >= dayStart.getTime() && created < dayEnd.getTime();
  });

  let totalBilledAmount = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalServiceTax = 0;
  let totalBarAmount = 0;
  let totalCafeAmount = 0;
  let totalBarItemsCount = 0;
  let totalCafeItemsCount = 0;
  const paymentBreakdown = {};

  ordersForDate.forEach((order) => {
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
    });
  });

  const currentTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: true,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  let html = `
    <div id="report-container" style="font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.3; color: #000; background: white; padding: 10mm; width: 100%; max-width: 210mm; margin: 0 auto; box-sizing: border-box;">
      <!-- Header Section -->
      <div style="text-align: center; margin-bottom: 15px;">
        <div style="font-size: 15px; font-weight: bold; letter-spacing: 2px;">${(
          institutionData?.companyName || "Company Name"
        ).toUpperCase()}</div>
        <div style="font-size: 11px; margin-top: 2px;">CASHIERING REPORT ${(
          institutionData?.companyName || "Company Name"
        ).toUpperCase()} BAR</div>
        <div style="margin: 10px 0; font-size: 11px;">
          Print On&nbsp;&nbsp;&nbsp;&nbsp;${isoDate
            .split("-")
            .reverse()
            .join("/")}&nbsp;&nbsp;&nbsp;&nbsp;${currentTime}
        </div>
        <div style="border-bottom: 1px dashed #000; margin: 5px 0;"></div>
      </div>

      <!-- Receipts Section -->
      <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #000; padding-bottom: 8px;">
          <div style="width: 50%;text-align:left;">
            <div style="margin-bottom: 2px;">RECEIPTS</div>
          </div>
          <div style="width: 50%; text-align: right;">
            <div style="text-align: right;">AMOUNT</div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 3px 0;">
          <div>BAR SALES</div>
          <div style="text-align: right;">${totalBarAmount.toFixed(2)}</div>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 3px 0;">
          <div>KITCHEN SALES</div>
          <div style="text-align: right;">${totalCafeAmount.toFixed(2)}</div>
        </div>
        <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>
        <div style="display: flex; justify-content: space-between; margin: 3px 0;">
          <div>SGST 2.5 %</div>
          <div style="text-align: right;">${totalSgst.toFixed(2)}
        </div>
        <div style="display: flex; justify-content: space-between; margin: 3px 0;">
          <div>CGST 2.5 %</div>
          <div style="text-align: right;">${totalCgst.toFixed(2)}</div>
        </div>
      </div>

      <!-- Payment Methods Section -->
      <div style="margin-bottom: 15px;">
        <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>
        ${Object.entries(paymentBreakdown)
          .map(
            ([method, amount]) => `
          <div style="display: flex; justify-content: space-between; margin: 3px 0;">
            <div>${method.toUpperCase()}</div>
            <div style="text-align: right;">${safeNum(amount).toFixed(2)}</div>
          </div>
        `
          )
          .join("")}
        <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <div>TOTAL</div>
          <div style="text-align: right;">${totalBilledAmount.toFixed(2)}</div>
        </div>
      </div>

      <!-- Page Break -->
      <div style="page-break-before: always;"></div>

      <!-- Stock Report Header -->
      <div style="text-align: center; margin-bottom: 15px;">
        <div style="font-size: 15px; font-weight: bold; letter-spacing: 2px;">${(
          institutionData?.companyName || "Company Name"
        ).toUpperCase()}</div>
        <div style="font-size: 11px; margin-top: 2px;">Stock Report</div>
        <div style="margin: 10px 0; font-size: 11px;">
          ${isoDate
            .split("-")
            .reverse()
            .join("/")}&nbsp;&nbsp;&nbsp;&nbsp;${currentTime}
        </div>
        <div style="border-bottom: 1px dashed #000; margin: 5px 0;"></div>
      </div>

      <!-- Stock Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 10px;">
        <thead>
          <tr style="font-weight: bold; font-size: 10px;">
            <th rowspan="2" style="width: 20%; text-align: left; padding: 3px; border-bottom: 1px dashed #000; vertical-align: bottom;">ITEM</th>
            <th colspan="2" style="text-align: center; padding: 1px; border-bottom: 1px solid #ccc;">OPENING</th>
            <th colspan="2" style="text-align: center; padding: 1px; border-bottom: 1px solid #ccc;">RECEIVED</th>
            <th colspan="2" style="text-align: center; padding: 1px; border-bottom: 1px solid #ccc;">TOTAL</th>
            <th colspan="2" style="text-align: center; padding: 1px; border-bottom: 1px solid #ccc;">TRANSFER</th>
            <th colspan="3" style="text-align: center; padding: 1px; border-bottom: 1px solid #ccc;">SALES</th>
            <th colspan="3" style="text-align: center; padding: 1px; border-bottom: 1px solid #ccc;">RATE</th>
            <th colspan="2" style="text-align: center; padding: 1px; border-bottom: 1px solid #ccc;">CLOSING</th>
            <th rowspan="2" style="width: 10%; text-align: right; padding: 2px; border-bottom: 1px dashed #000; vertical-align: bottom;">AMOUNT</th>
          </tr>
          <tr style="border-bottom: 1px dashed #000; font-weight: bold; font-size: 10px;">
            <th style="width: 6%; text-align: center; padding: 1px;">BTL</th>
            <th style="width: 4%; text-align: center; padding: 1px;">ML</th>
            <th style="width: 6%; text-align: center; padding: 1px;">BTL</th>
            <th style="width: 4%; text-align: center; padding: 1px;">ML</th>
            <th style="width: 6%; text-align: center; padding: 1px;">BTL</th>
            <th style="width: 4%; text-align: center; padding: 1px;">ML</th>
            <th style="width: 6%; text-align: center; padding: 1px;">BTL</th>
            <th style="width: 4%; text-align: center; padding: 1px;">ML</th>
            <th style="width: 5%; text-align: center; padding: 1px;">60ML</th>
            <th style="width: 5%; text-align: center; padding: 1px;">30ML</th>
            <th style="width: 5%; text-align: center; padding: 1px;">BTL</th>
            <th style="width: 5%; text-align: center; padding: 1px;">60ML</th>
            <th style="width: 5%; text-align: center; padding: 1px;">30ML</th>
            <th style="width: 5%; text-align: center; padding: 1px;">BTL</th>
            <th style="width: 6%; text-align: center; padding: 1px;">BTL</th>
            <th style="width: 4%; text-align: center; padding: 1px;">ML</th>
          </tr>
        </thead>
        <tbody>
          ${categories
            .map((cat) => {
              let catHtml = `
              <tr>
                <td colspan="17" style="text-align: center; font-weight: bold; background: #f0f0f0; padding: 3px; font-size: 12px;">${cat.category}</td>
              </tr>
              <tr><td colspan="18" style="border-bottom: 1px dashed #000;"></td></tr>
            `;

              cat.items.forEach((it, index) => {
                const oneBottleMl = parseVolumeToMl(
                  it.oneBottleVolume || "1000"
                );
                const totalSalesVolume = saleCols.reduce(
                  (sum, s) =>
                    sum +
                    safeNum(it.sales[s]) * Number(s.match(/\d+/)?.[0] || 0),
                  0
                );
                const closingMl =
                  it.totalMl - totalSalesVolume - safeNum(it.transferredMl);
                const closingBTL = formatBottlesMl(closingMl, oneBottleMl);
                const bottleSalesKeys = Object.keys(it.sales || {}).filter(
                  (k) => !["30 ml", "60 ml"].includes(k.toLowerCase())
                );
                const totalBottleSold = bottleSalesKeys.reduce(
                  (sum, k) => sum + safeNum(it.sales[k]),
                  0
                );
                const rate60ml = safeNum(it.unitRates?.["60 ml"] || 0);
                const rate30ml = safeNum(it.unitRates?.["30 ml"] || 0);
                const bottleRateKeys = Object.keys(it.unitRates || {}).filter(
                  (k) => !["30 ml", "60 ml"].includes(k.toLowerCase())
                );
                const rateBottle =
                  bottleRateKeys.length > 0
                    ? safeNum(it.unitRates[bottleRateKeys[0]])
                    : 0;
                const rowBg = index % 2 === 0 ? "#f9f9f9" : "#ffffff";

                catHtml += `
                <tr style="background: ${rowBg};">
                  <td style="font-size: 11px; padding: 2px; text-align: left;">${it.stockName.substring(
                    0,
                    12
                  )}</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    it.openingBTL.bottles
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    it.openingBTL.remainder
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    it.receivedBTL.bottles
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    it.receivedBTL.remainder
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    it.totalBTL.bottles
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    it.totalBTL.remainder
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    it.transferredBTL.bottles
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    it.transferredBTL.remainder
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${safeNum(
                    it.sales["60 ml"] || 0
                  )}</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${safeNum(
                    it.sales["30 ml"] || 0
                  )}</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${totalBottleSold}</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    rate60ml > 0 ? rate60ml.toFixed(0) : "0"
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    rate30ml > 0 ? rate30ml.toFixed(0) : "0"
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    rateBottle > 0 ? rateBottle.toFixed(0) : "0"
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    it.closingBTL.bottles
                  }</td>
                  <td style="text-align: center; font-size: 11px; padding: 2px;">${
                    it.closingBTL.remainder
                  }</td>
                  <td style="text-align: right; font-size: 11px; padding-right: 2px;">${safeNum(
                    it.amount
                  ).toFixed(0)}</td>
                </tr>
              `;
              });

              catHtml += `
              <tr><td colspan="18" style="border-bottom: 1px dashed #000;"></td></tr>
              <tr style="font-weight: bold; background: #f0f0f0;">
                <td style="font-size: 11px; padding: 2px; text-align: left;">TOTAL:</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${
                  cat.totals.openingBTL.bottles
                }</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${
                  cat.totals.openingBTL.remainder
                }</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${
                  cat.totals.receivedBTL.bottles
                }</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${
                  cat.totals.receivedBTL.remainder
                }</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${
                  cat.totals.totalBTL.bottles
                }</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${
                  cat.totals.totalBTL.remainder
                }</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${
                  cat.totals.transferredBTL.bottles
                }</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${
                  cat.totals.transferredBTL.remainder
                }</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${safeNum(
                  cat.totals.sales["60 ml"] || 0
                )}</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${safeNum(
                  cat.totals.sales["30 ml"] || 0
                )}</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${Object.entries(
                  cat.totals.sales || {}
                ).reduce(
                  (sum, [k, v]) =>
                    ["30 ml", "60 ml"].includes(k.toLowerCase())
                      ? sum
                      : sum + safeNum(v),
                  0
                )}</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;"></td>
                <td style="text-align: center; font-size: 11px; padding: 2px;"></td>
                <td style="text-align: center; font-size: 11px; padding: 2px;"></td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${
                  cat.totals.closingBTL.bottles
                }</td>
                <td style="text-align: center; font-size: 11px; padding: 2px;">${
                  cat.totals.closingBTL.remainder
                }</td>
                <td style="text-align: right; font-size: 11px; padding-right: 2px;">${safeNum(
                  cat.totals.amount
                ).toFixed(0)}</td>
              </tr>
              <tr>
                <td colspan="18" style="border-bottom: 1px dashed #000; height: 1px;"></td>
              </tr>
            `;

              return catHtml;
            })
            .join("")}
        </tbody>
      </table>

      <!-- Closing Balance -->
      <div style="margin-top: 20px; padding-top: 10px; border-top: 1px dashed #000;">
        <div style="display: flex; justify-content: space-between;">
          <div style="font-size: 12px;">Total</div>
          <div style="text-align: right; font-size: 12px;">${grandTotalAmount.toFixed(
            2
          )}</div>
        </div>
        <div style="border-bottom: 1px dashed #000; margin: 10px 0;"></div>
      </div>
    </div>

    <style>
      @media print {
        body * { visibility: hidden; }
        #report-container, #report-container * { visibility: visible; }
        #report-container { 
          position: absolute; 
          left: 50%; 
          top: 0; 
          transform: translateX(-50%); 
          width: 100%; 
          max-width: 210mm; 
          box-sizing: border-box; 
          text-align: center; 
        }
        @page { margin:2mm; size: A4; }
        table { margin: 0 auto; }
        .flex { justify-content: center !important; }
      }
    </style>
  `;

  const existingReport = document.getElementById("report-container");
  if (existingReport) {
    existingReport.remove();
  }

  const reportDiv = document.createElement("div");
  reportDiv.innerHTML = html;
  document.body.appendChild(reportDiv);

  document.getElementById("report-container").style.display = "block";

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      const container = document.getElementById("report-container");
      if (container) container.style.display = "none";
    }, 1000);
  }, 500);
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
  const items = Object.entries(itemQuantities).map(
    ([name, { quantity, type }]) => ({
      name,
      quantity,
      type: type === "bar" ? "Bar" : "Cafe",
    })
  );
  items.sort((a, b) => a.name.localeCompare(b.name));
  return { items };
};

const exportItemPDF = (start, end, institutionData, allOrders) => {
  const { items } = buildItemReport(start, end, allOrders);
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

  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  const title = `${(
    institutionData?.companyName || "Company Name"
  ).toUpperCase()} ITEM REPORT`;
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (doc.internal.pageSize.width - titleWidth) / 2, 10);
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  if (start.toLocaleDateString() === end.toLocaleDateString()) {
    doc.text(`Date: ${start.toLocaleDateString()}`, 10, 20);
  } else {
    doc.text(
      `Date Range: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
      10,
      20
    );
  }
  doc.text(`Printed: ${currentTime}`, 150, 20);

  doc.autoTable({
    startY: 30,
    head: [["Item Name", "Type", "Quantity Sold"]],
    body: items.map((item) => [item.name, item.type, item.quantity]),
    theme: "grid",
    headStyles: {
      fillColor: [41, 128, 186],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { halign: "left", cellWidth: 100 },
      1: { halign: "center", cellWidth: 40 },
      2: { halign: "right", cellWidth: 40 },
    },
  });

  doc.save(
    `${institutionData.companyName}_item_report_${start
      .toISOString()
      .slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString()
        ? `_to_${end.toISOString().slice(0, 10)}`
        : ""
    }.pdf`
  );
};

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
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.width;

  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  const title = `${institutionData.companyName} Order Report`;
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  if (start.toLocaleDateString() === end.toLocaleDateString()) {
    doc.text(`Date: ${start.toLocaleDateString()}`, 10, yPos);
  } else {
    doc.text(
      `Date Range: ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
      10,
      yPos
    );
  }
  yPos += 10;

  doc.setFontSize(12);
  doc.setFont(undefined, "bold");
  doc.text("Summary", 10, yPos);
  yPos += 10;
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.text(`Total Orders: ${orders.length}`, 10, yPos);
  doc.text(`Total Amount: ${totalBilledAmount.toFixed(2)}`, 80, yPos);
  yPos += 7;
  doc.text(`Bar Sales: ${totalBarAmount.toFixed(2)}`, 10, yPos);
  doc.text(`Cafe Sales: ${totalCafeAmount.toFixed(2)}`, 80, yPos);
  yPos += 7;
  doc.text(`CGST: ${totalCgst.toFixed(2)}`, 10, yPos);
  doc.text(`SGST: ${totalSgst.toFixed(2)}`, 80, yPos);
  yPos += 7;
  doc.text(`Service Tax: ${totalServiceTax.toFixed(2)}`, 10, yPos);
  yPos += 10;

  // Payment breakdown table with fixed alignment
  doc.autoTable({
    startY: yPos,
    head: [["Payment Method", "Amount"]],
    body: Object.entries(paymentBreakdown).map(([method, amount]) => [
      method,
      amount.toFixed(2),
    ]),
    margin: { left: 10, right: 10 },
    tableWidth: "auto",
    headStyles: {
      fillColor: [41, 128, 186],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "right" },
    },
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
  });
  yPos = doc.lastAutoTable.finalY + 20;

  orders.forEach((order, index) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text(`Order ${order.orderId}`, 10, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(`Customer: ${order.name || "N/A"}`, 10, yPos);
    doc.text(`Table: ${order.tableName || "N/A"}`, 80, yPos);
    doc.text(
      `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
      150,
      yPos
    );
    yPos += 7;
    doc.text(
      `Time: ${new Date(order.createdAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`,
      10,
      yPos
    );
    yPos += 7;
    if (institutionData?.institution === "bhuk2323") {
      doc.text(`Phone: ${order.phoneNumber || "N/A"}`, 10, yPos);
      yPos += 7;
    }
    const paymentMethod = order.paymentMethods
      ? Array.isArray(order.paymentMethods)
        ? order.paymentMethods
            .map((pm) => `${pm.method} (${pm.amount})`)
            .join(", ")
        : Object.entries(order.paymentMethods)
            .map(([method, amount]) => `${method} (${amount})`)
            .join(", ")
      : order.paymentMethod || "N/A";
    doc.text(`Payment: ${paymentMethod}`, 10, yPos);
    yPos += 7;
    doc.text(`Total: ${order.totalAmount}`, 10, yPos);
    yPos += 7;
    if (order.cgst) {
      doc.text(
        `CGST: ${order.cgst}% (${(
          order.totalAmount *
          (order.cgst / 100)
        ).toFixed(2)})`,
        10,
        yPos
      );
      yPos += 7;
    }
    if (order.sgst) {
      doc.text(
        `SGST: ${order.sgst}% (${(
          order.totalAmount *
          (order.sgst / 100)
        ).toFixed(2)})`,
        10,
        yPos
      );
      yPos += 7;
    }
    if (order.serviceTax) {
      doc.text(`Service Tax: ${order.serviceTax}`, 10, yPos);
      yPos += 7;
    }
    yPos += 5;

    // Items table with improved alignment
    if (order.items && Array.isArray(order.items)) {
      doc.autoTable({
        startY: yPos,
        head: [["Item Name", "Quantity", "Price", "Total"]],
        body: order.items.map((item) => [
          item.name || "N/A",
          item.quantity || 0,
          item.price || 0,
          item.price * item.quantity || 0,
        ]),
        margin: { left: 10, right: 10 },
        tableWidth: pageWidth - 20, // Full width minus margins
        headStyles: {
          fillColor: [41, 128, 186],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { halign: "left", cellWidth: (pageWidth - 20) * 0.5 }, // 50% width for item name
          1: { halign: "center", cellWidth: (pageWidth - 20) * 0.15 }, // 15% width for quantity
          2: { halign: "right", cellWidth: (pageWidth - 20) * 0.175 }, // 17.5% width for price
          3: { halign: "right", cellWidth: (pageWidth - 20) * 0.175 }, // 17.5% width for total
        },
        styles: {
          fontSize: 10,
          cellPadding: 3,
          overflow: "linebreak",
        },
      });
      yPos = doc.lastAutoTable.finalY + 20;
    }
  });

  doc.save(
    `${institutionData.companyName}_orders_${start.toISOString().slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString()
        ? `_to_${end.toISOString().slice(0, 10)}`
        : ""
    }.pdf`
  );
};

const exportItemCSV = (start, end, institutionData, allOrders) => {
  const { items } = buildItemReport(start, end, allOrders);

  // Prepare data for CSV
  const exportData = items.map((item) => ({
    "Item Name": item.name,
    Type: item.type,
    "Quantity Sold": item.quantity,
  }));

  // Add a header row for clarity
  const worksheetData = [
    {
      "Item Name": `${
        institutionData.companyName || "Company Name"
      } Item Report`,
      Type: "",
      "Quantity Sold": "",
    },
    ...exportData,
  ];

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Item Report");
  XLSX.writeFile(
    workbook,
    `${institutionData.companyName}_item_report_${start
      .toISOString()
      .slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString()
        ? `_to_${end.toISOString().slice(0, 10)}`
        : ""
    }.csv`
  );
};

const exportOrderCSV = (start, end, institutionData, allOrders) => {
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
  const exportData = [];

  exportData.push({
    "Order ID": `${institutionData.companName} Order Report`,
    Type: "",
    Name: "",
    Table: "",
    "Phone Number": "",
    "Total Amount": "",
    CGST: "",
    SGST: "",
    "Service Tax": "",
    Date: "",
    Time: "",
    "Payment Method": "",
    "Item Name": "",
    Quantity: "",
    "Item Price": "",
    "Item Total": "",
  });
  exportData.push({
    "Order ID": "Summary",
    Type: "Overall Totals",
    Name: "",
    Table: "",
    "Phone Number": "",
    "Total Amount": totalBilledAmount.toFixed(2),
    CGST: totalCgst.toFixed(2),
    SGST: totalSgst.toFixed(2),
    "Service Tax": totalServiceTax.toFixed(2),
    Date: "",
    Time: "",
    "Payment Method": "",
    "Item Name": "",
    Quantity: "",
    "Item Price": "",
    "Item Total": "",
  });
  Object.entries(paymentBreakdown).forEach(([method, amount]) => {
    exportData.push({
      "Order ID": "",
      Type: "",
      Name: "",
      Table: "",
      "Phone Number": "",
      "Total Amount": "",
      CGST: "",
      SGST: "",
      "Service Tax": "",
      Date: "",
      Time: "",
      "Payment Method": `${method}: ${amount.toFixed(2)}`,
      "Item Name": "",
      Quantity: "",
      "Item Price": "",
      "Item Total": "",
    });
  });

  orders.forEach((order) => {
    const paymentMethod = order.paymentMethods
      ? Array.isArray(order.paymentMethods)
        ? order.paymentMethods
            .map((pm) => `${pm.method} (${pm.amount})`)
            .join("; ")
        : Object.entries(order.paymentMethods)
            .map(([method, amount]) => `${method} (${amount})`)
            .join("; ")
      : order.paymentMethod || "N/A";
    exportData.push({
      "Order ID": order.orderId,
      Type: "Regular Order",
      Name: order.name || "N/A",
      Tablegem: order.tableName || "N/A",
      "Phone Number":
        institutionData?.institution === "bhuk2323"
          ? order.phoneNumber || "N/A"
          : "",
      "Total Amount": order.totalAmount,
      CGST: order.cgst ? `${order.cgst}%` : "",
      SGST: order.sgst ? `${order.sgst}%` : "",
      "Service Tax": order.serviceTax ? order.serviceTax : "",
      Date: new Date(order.createdAt).toLocaleDateString(),
      Time: new Date(order.createdAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      "Payment Method": paymentMethod,
      "Item Name": "",
      Quantity: "",
      "Item Price": "",
      "Item Total": "",
    });
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item) => {
        exportData.push({
          "Order ID": "",
          Type: "",
          Name: "",
          Table: "",
          "Phone Number": "",
          "Total Amount": "",
          CGST: "",
          SGST: "",
          "Service Tax": "",
          Date: "",
          Time: "",
          "Payment Method": "",
          "Item Name": item.name || "N/A",
          Quantity: item.quantity || 0,
          "Item Price": item.price || 0,
          "Item Total": item.price * item.quantity || 0,
        });
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Order Report");
  XLSX.writeFile(
    workbook,
    `${institutionData.companyName}_orders_${start.toISOString().slice(0, 10)}${
      start.toLocaleDateString() !== end.toLocaleDateString()
        ? `_to_${end.toISOString().slice(0, 10)}`
        : ""
    }.csv`
  );
};

// Item ID Reference Report - shows shorthand number mapping for search functionality
const exportItemReferenceCSV = (menuItems, institutionData) => {
  if (!menuItems || menuItems.length === 0) {
    alert("No menu items available");
    return;
  }

  // Create reference data showing shorthand number mapping
  const referenceData = [];

  // Process menu items and create shorthand mapping
  menuItems
    .filter((item) => item.itemId) // Only items with IDs
    .sort((a, b) => {
      // Sort by item ID numerically
      const aNum = parseInt(a.itemId.toString().replace(/\D/g, "")) || 0;
      const bNum = parseInt(b.itemId.toString().replace(/\D/g, "")) || 0;
      return aNum - bNum;
    })
    .forEach((item) => {
      const fullId = item.itemId.toString();
      let shorthandNo = "";

      // Extract shorthand number based on the pattern
      if (fullId.startsWith("1000") && fullId.length === 5) {
        // Pattern: 10001 → 1, 10021 → 21
        shorthandNo = fullId.substring(4);
      } else if (fullId.length === 5 && fullId.startsWith("100")) {
        // Pattern: 10007 → 7, 10011 → 11
        shorthandNo = fullId.substring(3);
      } else {
        // For other patterns, use the full ID as shorthand
        shorthandNo = fullId;
      }

      referenceData.push({
        "Shorthand Search": shorthandNo,
        "Item Name": item.itemName || "N/A",
        Category: item.category || "N/A",
        Price: item.price ? `₹${item.price}` : "N/A",
        Type: item.type || "N/A",
      });
    });

  // Create and download CSV
  const worksheet = XLSX.utils.json_to_sheet(referenceData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Item ID Reference");
  XLSX.writeFile(
    workbook,
    `${
      institutionData?.companyName || "Restaurant"
    }_Item_ID_Reference_${new Date().toISOString().slice(0, 10)}.csv`
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
  const [filterType, setFilterType] = useState("day");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

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
        const [stockResponse, orderResponse, menuResponse] = await Promise.all([
          API.get("main", `/admin/stock-list-items/${institution}`),
          API.get("main", `/admin/list-orders/${institution}`, {}),
          API.get("main", `/any/list-items/${institution}`, {}),
        ]);
        setStocks(stockResponse || []);
        const paidOrders = (orderResponse || []).filter(
          (order) => order.paymentStatus === true
        );
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-7xl bg-white rounded-2xl shadow-xl p-6 sm:p-8 lg:p-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-10 text-indigo-700 text-center tracking-tight">
          {institutionData?.companyName || "Company"} Reports
        </h1>

        {/* Filter Section */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8 justify-center">
          {/* Filter By Dropdown */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 min-w-0">
            <label className="text-gray-600 font-medium text-sm">
              Filter By:
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 rounded-lg p-2.5 w-full sm:w-40 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm">
              <option value="day">Day</option>
              <option value="dateRange">Date Range</option>
            </select>
          </div>

          {/* Day Picker */}
          {filterType === "day" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <label className="text-gray-600 font-medium text-sm">
                Select Date:
              </label>
              <div className="relative w-full sm:w-48">
                <button
                  onClick={() => setShowDayPicker(!showDayPicker)}
                  className="border border-gray-300 rounded-lg p-2.5 bg-white w-full text-left focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm text-gray-800">
                  {selectedDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </button>
                {showDayPicker && (
                  <div className="absolute z-20 mt-2 bg-white shadow-2xl rounded-lg border border-gray-200">
                    <DayPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) =>
                        handleDateSelection(
                          date,
                          setSelectedDate,
                          setShowDayPicker
                        )
                      }
                      fromDate={getDateLimits().minDate}
                      toDate={getDateLimits().maxDate}
                      className="p-4"
                      classNames={{
                        day: "text-gray-800 hover:bg-indigo-100 rounded-full",
                        day_selected: "bg-indigo-600 text-white rounded-full",
                        caption: "text-lg font-semibold text-gray-900",
                        nav_button:
                          "text-gray-600 hover:bg-gray-100 rounded-full p-1",
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Date Range Pickers */}
          {filterType === "dateRange" && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Start Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-600 font-medium text-sm">
                  Start Date:
                </label>
                <div className="relative w-full sm:w-48">
                  <button
                    onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                    className="border border-gray-300 rounded-lg p-2.5 bg-white w-full text-left focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm text-gray-800">
                    {startDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </button>
                  {showStartDatePicker && (
                    <div className="absolute z-20 mt-2 bg-white shadow-2xl rounded-lg border border-gray-200 min-w-[280px]">
                      <DayPicker
                        mode="single"
                        selected={startDate}
                        onSelect={(date) =>
                          handleDateSelection(
                            date,
                            setStartDate,
                            setShowStartDatePicker
                          )
                        }
                        fromDate={getDateLimits().minDate}
                        toDate={getDateLimits().maxDate}
                        className="p-4"
                        classNames={{
                          day: "text-gray-800 hover:bg-indigo-100 rounded-full",
                          day_selected: "bg-indigo-600 text-white rounded-full",
                          caption: "text-lg font-semibold text-gray-900",
                          nav_button:
                            "text-gray-600 hover:bg-gray-100 rounded-full p-1",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* End Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-600 font-medium text-sm">
                  End Date:
                </label>
                <div className="relative w-full sm:w-48">
                  <button
                    onClick={() => setShowEndDatePicker(!showEndDatePicker)}
                    className="border border-gray-300 rounded-lg p-2.5 bg-white w-full text-left focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors shadow-sm text-gray-800">
                    {endDate.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </button>
                  {showEndDatePicker && (
                    <div className="absolute z-20 mt-2 bg-white shadow-2xl rounded-lg border border-gray-200 min-w-[280px]">
                      <DayPicker
                        mode="single"
                        selected={endDate}
                        onSelect={(date) =>
                          handleDateSelection(
                            date,
                            setEndDate,
                            setShowEndDatePicker
                          )
                        }
                        fromDate={Math.max(startDate, getDateLimits().minDate)}
                        toDate={getDateLimits().maxDate}
                        className="p-4"
                        classNames={{
                          day: "text-gray-800 hover:bg-indigo-100 rounded-full",
                          day_selected: "bg-indigo-600 text-white rounded-full",
                          caption: "text-lg font-semibold text-gray-900",
                          nav_button:
                            "text-gray-600 hover:bg-gray-100 rounded-full p-1",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4">
          {filterType === "day" && (
            <>
              <button
                onClick={() =>
                  exportDailyReport(
                    selectedDate.toISOString().slice(0, 10),
                    stocks,
                    allOrders,
                    institutionData
                  )
                }
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-105">
                Print Bar Report
              </button>
              <button
                onClick={() =>
                  exportCafeDailyReport(
                    selectedDate.toISOString().slice(0, 10),
                    stocks,
                    institutionData
                  )
                }
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-105">
                Print Cafe Report
              </button>
            </>
          )}
          <button
            onClick={() =>
              exportItemPDF(
                filterType === "day" ? selectedDate : startDate,
                filterType === "day" ? selectedDate : endDate,
                institutionData,
                allOrders
              )
            }
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-105">
            Item PDF
          </button>
          <button
            onClick={() =>
              exportOrderPDF(
                filterType === "day" ? selectedDate : startDate,
                filterType === "day" ? selectedDate : endDate,
                institutionData,
                allOrders
              )
            }
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-105">
            Order PDF
          </button>
          <button
            onClick={() =>
              exportItemCSV(
                filterType === "day" ? selectedDate : startDate,
                filterType === "day" ? selectedDate : endDate,
                institutionData,
                allOrders
              )
            }
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-105">
            Item CSV
          </button>
          <button
            onClick={() =>
              exportOrderCSV(
                filterType === "day" ? selectedDate : startDate,
                filterType === "day" ? selectedDate : endDate,
                institutionData,
                allOrders
              )
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-105">
            Order CSV
          </button>
          <button
            onClick={() => exportItemReferenceCSV(menuItems, institutionData)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-105">
            📋 Item ID Reference
          </button>
        </div>
      </div>
    </div>
  );
};

export default Report;
