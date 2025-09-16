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
    // if (!customerDetails[table.id]?.phone) {
    //   toast.error("Please enter customer phone number before printing KOT");
    //   return;
    // }
    // const phoneRegex = /^\d{10}$/;
    // if (!phoneRegex.test(customerDetails[table.id].phone)) {
    //   toast.error("Please enter a valid 10-digit phone number");
    //   return;
    // }
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

    if (itemsToPrint.length === 0) {
      toast.info("No items to print in KOT.");
    }

    await saveKOT(table);

    const kotNo = getKOTNumber(table.id) || "N/A";
   

    const printArea = document.createElement("div");
    printArea.id = "printArea";
    if (printerpaperSize === "80") {
       const itemsHTML = itemsToPrint
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td style="text-align: right; white-space: nowrap;">${item.quantity}</td>
          </tr>
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
        ${institutionData.institution === "bhuk2323" ? 
            `<div class="spacer"></div>
         ${(instruction && instruction!=="None")? ` <div class="instruction">Special Instructions: ${instruction}</div>` : ''}
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
    }
    else{
    const itemsHTML = itemsToPrint
    .map(
      (item) => `
        <tr>
          <td>${item.name}</td>
          <td style="text-align: right; white-space: nowrap;">${item.quantity}</td>
        </tr>
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
  style.innerHTML =  screenWidth <= 1025 ? `
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
  document.head.appendChild(style);}

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