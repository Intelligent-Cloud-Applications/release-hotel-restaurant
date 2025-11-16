import React from "react";
import { toast } from "react-toastify";
import data from '../../../../../Operation/data.json';

const PrintKOT = ({
  table,
  customerDetails,
  KOTByTable,
  institutionData,
  saveKOT,
  screenWidth,
  setActiveTab,
  tableInstructions,
  tableData
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

  const printKOT = async () => {
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

    const currentKOT = KOTByTable[table.id] || { items: [], totalAmount: 0 };
    const itemsToPrint = currentKOT.items;
    const tableIdStr = String(table.id);
    const instruction = tableInstructions?.[tableIdStr] || tableData?.[tableIdStr]?.instruction || "None";


    itemsToPrint.forEach((item, index) => {
      console.log(`PrintKOT Debug - Item ${index}:`, {
        name: item.name,
        itemName: item.itemName,
        quantity: item.quantity,
        instruction: item.instruction,
        fullItem: item
      });
    });

    // Check if table is management and get customer name
    const isManagementTable = String(table.id).toLowerCase().startsWith("management");
    const customerName = customerDetails[table.id]?.name || "";

    if (itemsToPrint.length === 0) {
      toast.info("No items to print in KOT.");
    }

    await saveKOT(table);

    const kotNo = getKOTNumber(table.id) || "N/A";
   
    const printArea = document.createElement("div");
    printArea.id = "printArea";
    
    if (printerpaperSize === "80") {
      // Check if duplicate copy is needed
      const needsDuplicate = institutionData?.institution === "DISH5877";
      
      const itemsHTML = itemsToPrint
        .map(
          (item) => {
            console.log("PrintKOT Debug - Processing item for HTML:", {
              name: item.name,
              instruction: item.instruction,
              hasInstruction: !!item.instruction
            });
            return `
            <tr>
              <td>${item.name}</td>
              <td style="text-align: right; white-space: nowrap;">${item.quantity}</td>
            </tr>
            ${item.instruction ? `
            <tr>
              <td colspan="2" style="font-size: 10pt; color: #666; font-style: italic; padding-left: 10px;">
                → ${item.instruction}
              </td>
            </tr>
            ` : ''}
          `;
          }
        )
        .join("");
      const totalQty = itemsToPrint.reduce((sum, item) => sum + item.quantity, 0);
      
      // KOT content template
      const kotContent = `
        <div class="kot">
          <div class="header">KOT No: ${kotNo}</div>
          <div class="sub-header">${orderType}</div>
          <div class="info">Date: ${formatDateTime()}</div>
          <div class="divider"></div>
          <div class="header">Table: ${table.id || "N/A"}</div>
          ${isManagementTable && customerName ? `<div class="customer-name">Customer: ${customerName}</div>` : ''}
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
          <table class="table total">
            <tr><td><b>Total Qty:</b></td><td style="text-align:right;">${totalQty}</td></tr>
          </table>
            <div class="spacer"></div>
           ${(instruction && instruction!=="None")? ` <div class="instruction">Special Instructions: ${instruction}</div>` : ''}
            
        </div>
      `;
      
      if (needsDuplicate) {
        // Two copies with cut line in between
        printArea.innerHTML = `
          ${kotContent}
          <div>
              <span>✂ ------------------------------------✂</span>
            </div>
          ${kotContent}
        `;
      } else {
        // Single copy
        printArea.innerHTML = kotContent;
      }
      
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
        .cut-line {
          text-align: center;
          margin: 5mm 0;
          padding: 3mm 0;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          font-size: 10pt;
          font-weight: bold;
          letter-spacing: 1px;
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
        .customer-name {
          font-size: 12pt;
          font-weight: bold;
          text-align: center;
          margin: 2px 0;
          text-decoration: underline;
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
    } else if (printerpaperSize === "100") {
      const itemsHTML = itemsToPrint
        .map(
          (item) => `
            <tr>
              <td>${item.name}</td>
              <td style="text-align: right; white-space: nowrap;">${item.quantity}</td>
            </tr>
            ${item.instruction ? `
            <tr>
              <td colspan="2" style="font-size: 14pt; color: #666; font-style: italic; padding-left: 10px;">
                → ${item.instruction}
              </td>
            </tr>
            ` : ''}
          `
        )
        .join("");
      const totalQty = itemsToPrint.reduce((sum, item) => sum + item.quantity, 0);
      
      printArea.innerHTML = `
        <div class="kot">
          <div class="header">KOT No: ${kotNo}</div>
          <div class="sub-header">${orderType}</div>
          <div class="info">Date: ${formatDateTime()}</div>
          <div class="divider"></div>
          <div class="header">Table: ${table.id || "N/A"}</div>
          ${isManagementTable && customerName ? `<div class="customer-name">Customer: ${customerName}</div>` : ''}
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
          <table class="table total">
            <tr><td><b>Total Qty:</b></td><td style="text-align:right;">${totalQty}</td></tr>
          </table>
          <div class="spacer"></div>
           ${(instruction && instruction!=="None")? ` <div class="instruction">Special Instructions: ${instruction}</div>` : ''}
        
        </div>
      `;
      document.body.appendChild(printArea);
    
      const style = document.createElement("style");
      style.innerHTML = `
        @media print {
          @page {
            size: 100mm auto; 
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
            width: 100mm;
            padding: 4mm;
            page-break-inside: avoid;
          }
        }
    
        .kot {
          font-family: monospace;
          text-align: left;
          font-size: 16pt; 
          padding: 0; 
          line-height: 1.3; 
          max-width: 100mm;
          word-wrap: break-word;
          margin: 0 auto;
          page-break-inside: avoid; 
        }
        .header {
          font-size: 18pt; 
          font-weight: bold;
          text-align: center;
          margin: 3px 0;
        }
        .sub-header, .info {
          font-size: 16pt; 
          text-align: center;
          margin: 3px 0;
        }
        .customer-name {
          font-size: 16pt;
          font-weight: bold;
          text-align: center;
          margin: 3px 0;
          text-decoration: underline;
        }
        .instruction {
          font-size: 16pt;
          text-align: left;
          margin: 6px 0;
          word-wrap: break-word;
        }
        .spacer {
          height: 30px;
        }
        .divider {
          border-top: 1px dashed black;
          margin: 4px 0; 
        }
        .table {
          width: 100%;
          font-size: 16pt; 
          border-collapse: collapse;
        }
        .table td {
          padding: 2px 0; 
          word-break: break-word;
        }
        .total {
          font-weight: bold;
          border-top: 1px solid black;
          margin-top: 4px;
        }
      `;
      document.head.appendChild(style);
    } else {
      const itemsHTML = itemsToPrint
        .map(
          (item) => `
            <tr>
              <td>${item.name}</td>
              <td style="text-align: right; white-space: nowrap;">${item.quantity}</td>
            </tr>
            ${item.instruction ? `
            <tr>
              <td colspan="2" style="font-size: 12px; color: #666; font-style: italic; padding-left: 10px;">
                → ${item.instruction}
              </td>
            </tr>
            ` : ''}
          `
        )
        .join("");
      const totalQty = itemsToPrint.reduce((sum, item) => sum + item.quantity, 0);
      
      printArea.innerHTML = `
        <div class="kot">
          <div class="header">KOT No: ${kotNo}</div>
          <div class="sub-header">${orderType}</div>
          <div class="info">Date: ${formatDateTime()}</div>
          <div class="divider"></div>
          <div class="header">Table: ${table.id || "N/A"}</div>
          ${isManagementTable && customerName ? `<div class="customer-name">Customer: ${customerName}</div>` : ''}
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
          <table class="table total">
            <tr><td><b>Total Qty:</b></td><td style="text-align:right;">${totalQty}</td></tr>
          </table>
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
            margin-top:1px;
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
        .customer-name {
          font-size: 15px;
          font-weight: bold;
          text-align: center;
          margin: 0;
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
            margin-top:1px;
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
        .customer-name {
          font-size: 18px;
          font-weight: bold;
          text-align: center;
          margin: 0;
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

    window.print();

    window.onafterprint = () => {
      document.body.removeChild(printArea);
      document.head.removeChild(style);
      setActiveTab("BILL");
    };

    setTimeout(() => {
      const existingPrintArea = document.getElementById("printArea");
      if (existingPrintArea) existingPrintArea.remove();
      const existingStyle = document.getElementById("printStyle");
      if (existingStyle) existingStyle.remove();
    }, 2000);
  };

  printKOT();
};

export default PrintKOT;