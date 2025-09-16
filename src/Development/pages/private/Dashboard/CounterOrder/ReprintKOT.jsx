import React from "react";
import { toast } from "react-toastify";
import data from '../../../../../Operation/data.json';

const ReprintKOT = ({
  table,
  customerDetails,
  billItems,
  institutionData,
  saveKOT,
  screenWidth,
  tableInstructions,
  tableData,
  printData,
  connected,
  setShowReprintKOT 
}) => {
  const { printerpaperSize } = data;

  const getKOTNumber = (tableId) => {
    const today = new Date().toISOString().split("T")[0];
    let kotData = JSON.parse(localStorage.getItem("kotOrders")) || { date: today, lastKOT: 0, kotTables: {} };
    if (kotData.date !== today) {
      kotData = { date: today, lastKOT: 0, kotTables: {} };
    }
    if (kotData.kotTables[tableId]) {
      return kotData.kotTables[tableId];
    }
    const newKOT = kotData.lastKOT + 1;
    kotData.kotTables[tableId] = newKOT;
    kotData.lastKOT = newKOT;

    localStorage.setItem("kotOrders", JSON.stringify(kotData));

    return newKOT;
  };

  const reprintKOT = async () => {
    const formatDateTime = () => {
      const now = new Date();
      return now.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).replace(",", "");
    };
    const orderType = !isNaN(table.id)
      ? "Dine In"
      : table.id.toLowerCase().startsWith("takeaway")
      ? "Takeaway"
      : "Dine In";

    const itemsToPrint = billItems || [];
    const tableIdStr = String(table.id);
    const instruction = tableInstructions?.[tableIdStr] || tableData?.[tableIdStr]?.instruction || "";

    if (itemsToPrint.length === 0) {
      toast.info("No bill items to reprint in KOT format.");
      setShowReprintKOT(false); // Close the component if no items to print
      return;
    }

    const kotNo = getKOTNumber(table.id) || "N/A";

    const printArea = document.createElement("div");
    printArea.id = "printArea";
    const itemsHTML = itemsToPrint
      .map(
        (item) => `
          <tr>
            <td>${item.itemName || item.name}</td>
            <td style="text-align: right; white-space: nowrap;">${item.quantity}</td>
          </tr>
        `
      )
      .join("");
    const totalQty = itemsToPrint.reduce((sum, item) => sum + item.quantity, 0);

    if (printerpaperSize === "80") {
      printArea.innerHTML = `
        <div class="kot">
          <div class="header">KOT No: ${kotNo} (Reprint)</div>
          <div class="sub-header">${orderType}</div>
          <div class="info">Date: ${formatDateTime()}</div>
          <div class="divider"></div>
          <div class="header">Table: ${table.id || "N/A"}</div>
          <div class="divider"></div>
          <table class="table">
            <tr>
              <td colspan="2" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; width: 100%;">
                <b>Item</b>
                <b>Qty</b>
              </td>
            </tr>
            ${itemsHTML}
          </table>
          <div class="divider"></div>
          ${institutionData.institution === "bhuk2323" ? `
            <table class="table total">
              <tr><td><b>Total Qty:</b></td><td style="text-align:right;">${totalQty}</td></tr>
            </table>
          ` : ''}
          ${instruction ? `
            <div class="spacer"></div>
            <div class="instruction">Special Instructions: ${instruction}</div>
            <div class="spacer"></div>
          ` : ''}
        </div>
      `;
      document.body.appendChild(printArea);

      const style = document.createElement("style");
      style.innerHTML = `
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            margin-top: 1px;
            padding: 0;
          }
          body * {
            visibility: hidden;
          }
          #printArea, #printArea * {
            visibility: visible;
          }
          #printArea {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 80mm;
            padding: 3mm;
            page-break-inside: avoid;
          }
        }

        .kot {
          font-family: monospace;
          text-align: left;
          font-size: 12pt;
          padding: 0;
          line-height: 1.2;
          max-width: 80mm;
          word-wrap: break-word;
          margin: 0 auto;
          page-break-inside: avoid;
        }
        .header {
          font-size: 14pt;
          font-weight: bold;
          text-align: center;
          margin: 2px 0;
        }
        .sub-header, .info {
          font-size: 12pt;
          text-align: center;
          margin: 2px 0;
        }
        .instruction {
          font-size: 12pt;
          text-align: left;
          margin: 5px 0;
          word-wrap: break-word;
        }
        .spacer {
          height: 25px;
        }
        .divider {
          border-top: 1px dashed black;
          margin: 3px 0;
        }
        .table {
          width: 100%;
          font-size: 12pt;
          border-collapse: collapse;
        }
        .table td {
          padding: 1px 0;
          word-break: break-word;
        }
        .total {
          font-weight: bold;
          border-top: 1px solid black;
          margin-top: 3px;
        }
      `;
      document.head.appendChild(style);
    } else {
      printArea.innerHTML = `
        <div class="kot">
          <div class="header">KOT No: ${kotNo} (Reprint)</div>
          <div class="sub-header">${orderType}</div>
          <div class="info">Date: ${formatDateTime()}</div>
          <div class="divider"></div>
          <div class="header">Table: ${table.id || "N/A"}</div>
          <div class="divider"></div>
          <table class="table">
            <tr>
              <td colspan="2" style="display: flex; flex-direction: row; justify-content: space-between; align-items: center; width: 100%;">
                <b>Item</b>
                <b>Qty</b>
              </td>
            </tr>
            ${itemsHTML}
          </table>
          <div class="divider"></div>
          ${institutionData.institution === "bhuk2323" ? `
            <table class="table total">
              <tr><td><b>Total Qty:</b></td><td style="text-align:right;">${totalQty}</td></tr>
            </table>
          ` : ''}
          ${instruction ? `
            <div class="spacer"></div>
            <div class="instruction">Special Instructions: ${instruction}</div>
            <div class="spacer"></div>
          ` : ''}
        </div>
      `;
      document.body.appendChild(printArea);

      const style = document.createElement("style");
      style.innerHTML = screenWidth <= 1025 ? `
        @media print {
          @page {
            size: 55mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            margin-top: 1px;
            padding: 0;
          }
          body * {
            visibility: hidden;
          }
          #printArea, #printArea * {
            visibility: visible;
          }
          #printArea {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 55mm;
            padding: 3mm;
            page-break-inside: avoid;
          }
        }

        .kot {
          font-family: monospace;
          text-align: left;
          font-size: 30px;
          padding: 0;
          line-height: 1;
          max-width: 55mm;
          word-wrap: break-word;
          margin: 0 auto;
          page-break-inside: avoid;
        }
        .header {
          font-size: 15px;
          font-weight: bold;
          text-align: center;
          margin: 0;
        }
        .sub-header, .info {
          font-size: 15px;
          text-align: center;
          margin: 0;
        }
        .instruction {
          font-size: 15px;
          text-align: left;
          margin: 5px 0;
          word-wrap: break-word;
        }
        .spacer {
          height: 25px;
        }
        .divider {
          border-top: 1px dashed black;
          margin: 1px 0;
        }
        .table {
          width: 100%;
          font-size: 15px;
          border-collapse: collapse;
        }
        .table td {
          padding: 0;
          word-break: break-word;
        }
        .total {
          font-weight: bold;
          border-top: 1px solid black;
        }
      ` : `
        @media print {
          @page {
            size: 55mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            margin-top: 1px;
            padding: 0;
          }
          body * {
            visibility: hidden;
          }
          #printArea, #printArea * {
            visibility: visible;
          }
          #printArea {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 55mm;
            padding: 0;
            page-break-inside: avoid;
          }
        }

        .kot {
          font-family: monospace;
          text-align: left;
          font-size: 30px;
          padding: 0;
          line-height: 1;
          max-width: 55mm;
          word-wrap: break-word;
          margin: 0 auto;
          page-break-inside: avoid;
        }
        .header {
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          margin: 0;
        }
        .sub-header, .info {
          font-size: 18px;
          text-align: center;
          margin: 0;
        }
        .instruction {
          font-size: 18px;
          text-align: left;
          margin: 5px 0;
          word-wrap: break-word;
        }
        .spacer {
          height: 25px;
        }
        .divider {
          border-top: 1px dashed black;
          margin: 1px 0;
        }
        .table {
          width: 100%;
          font-size: 18px;
          border-collapse: collapse;
        }
        .table td {
          padding: 0;
          word-break: break-word;
        }
        .total {
          font-weight: bold;
          border-top: 1px solid black;
        }
      `;
      document.head.appendChild(style);
    }

    if (connected && printData) {
      const kotData = formatKOT();
      // await printData(kotData);
      setShowReprintKOT(false); // Close the component after network printing
    } else {
      window.onbeforeprint = () => {
        // Optional: Any setup before print dialog opens
      };

      window.onafterprint = () => {
        document.body.removeChild(printArea);
        document.head.removeChild(style);
        setShowReprintKOT(false); // Close the component after print or cancel
        window.onbeforeprint = null; // Clean up event listener
        window.onafterprint = null; // Clean up event listener
      };

      window.print();
    }

    // Cleanup in case print dialog is dismissed without triggering onafterprint
    setTimeout(() => {
      const existingPrintArea = document.getElementById("printArea");
      if (existingPrintArea) existingPrintArea.remove();
      const existingStyle = document.querySelector("style[id='printStyle']");
      if (existingStyle) existingStyle.remove();
      setShowReprintKOT(false); // Ensure component is closed
    }, 5000); // Increased timeout to 5 seconds to account for slow user interaction
  };

  const formatKOT = () => {
    const formatDateTime = () => {
      const now = new Date();
      return now.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).replace(",", "");
    };
    const orderType = !isNaN(table.id) ? "Dine In" : table.id.toLowerCase().startsWith("takeaway") ? "Takeaway" : "Dine In";
    const kotNo = getKOTNumber(table.id) || "N/A";
    const items = billItems || [];
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const tableIdStr = String(table.id);
    const instruction = tableInstructions?.[tableIdStr] || tableData?.[tableIdStr]?.instruction || "";

    const lineWidth = printerpaperSize === "80" ? 48 : 32;
    const itemNameLength = lineWidth - 5;

    const headerFont = printerpaperSize === "80" ? "\x1B\x4D\x00" : "\x1B\x4D\x00";
    const itemFont = printerpaperSize === "80" ? "\x1B\x4D\x00" : "\x1B\x4D\x01";
    const resetFont = "\x1D\x21\x00";

    const centerText = (text, width = lineWidth) => {
      const textLength = text.length;
      if (textLength >= width) return text.substring(0, width);
      const padding = Math.floor((width - textLength) / 2);
      return " ".repeat(padding) + text + " ".repeat(padding + (textLength % 2));
    };

    let kot = `\x1B\x61\x01${headerFont}`;
    kot += `${centerText(`KOT No: ${kotNo} (Reprint)`)}\n`;
    kot += `${centerText(orderType)}\n`;
    kot += `${centerText(`Date: ${formatDateTime()}`)}\n`;
    kot += `${centerText(`Table: ${table.id || "N/A"}`)}\n`;
    kot += `${resetFont}${itemFont}${centerText(`-`.repeat(lineWidth))}\n`;
    kot += `Item${" ".repeat(lineWidth - 4 - 3)}Qty\n`;
    kot += `${centerText(`-`.repeat(lineWidth))}\n`;

    items.forEach((item) => {
      const itemName = item.itemName || item.name;
      const qty = item.quantity.toString().padStart(4, " ");
      if (itemName.length <= itemNameLength) {
        kot += `${itemName.padEnd(itemNameLength)}${qty}\n`;
      } else {
        const chunks = itemName.match(new RegExp(`.{1,${itemNameLength}}`, "g"));
        chunks.forEach((chunk, index) => {
          if (index === 0) {
            kot += `${chunk.padEnd(itemNameLength)}${qty}\n`;
          } else {
            kot += `${chunk.padEnd(itemNameLength)}${" ".repeat(4)}\n`;
          }
        });
      }
    });

    kot += `${centerText(`-`.repeat(lineWidth))}\n`;
    if (institutionData.institution === "bhuk2323") {
      kot += `${centerText(`Total Qty: ${totalQty}`)}\n`;
    }
    if (instruction) {
      kot += `\n${centerText(`Special Instructions: ${instruction}`)}\n`;
    }
    kot += `${centerText(`-`.repeat(lineWidth))}\n`;
    kot += `${resetFont}\n\n\n`;
    return kot;
  };

  // Call reprintKOT immediately when component mounts
  React.useEffect(() => {
    reprintKOT();
  }, []); // Empty dependency array to run once on mount

  return null; // Component doesn't render anything visible
};

export default ReprintKOT;