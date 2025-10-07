import React from "react";
import data from '../../../../../Operation/data.json';
import qrimage from '../../../../utils/image/qrimage.jpeg'

const PrintBill = ({ table, items, institutionData, screenWidth, orderId, discountMethod = "none", discountValue = 0 }) => {
  const { printerpaperSize } = data;

  const gstShow = institutionData?.gstshow ?? false;

  // Calculate totals based on provided items
  const billSubtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);

  // Tax rates from institutionData (fallbacks)
  const cgstRate = gstShow ? Number(institutionData?.cgst ?? 2.5) : 0;
  const sgstRate = gstShow ? Number(institutionData?.sgst ?? 2.5) : 0;
  const serviceTaxRate = Number(institutionData?.serviceTax ?? 0);

  // Taxable subtotal: exclude 'bar' type items
  const taxableSubtotal = items.reduce((sum, item) => {
    return sum + ((item.type !== 'bar') ? (Number(item.price) || 0) * (Number(item.quantity) || 0) : 0);
  }, 0);

  // ---- Discount calculation ----
  let discountAmount = 0;
  let discountPercentShown = 0;

  if (discountMethod === "percentage" && Number(discountValue) > 0) {
    discountPercentShown = Math.min(100, Number(discountValue));
    discountAmount = (billSubtotal * discountPercentShown) / 100;
  } else if (discountMethod === "amount" && Number(discountValue) > 0) {
    discountAmount = Math.min(Number(discountValue), billSubtotal);
  }

  // Subtotals after discount
  const discountedSubtotal = Math.max(0, billSubtotal - discountAmount);
  const discountedTaxableSubtotal = Math.max(0, taxableSubtotal - Math.min(discountAmount, taxableSubtotal));

  // Recalculate taxes on discountedTaxableSubtotal
  const calculatedCgst = (discountedTaxableSubtotal * cgstRate) / 100;
  const calculatedSgst = (discountedTaxableSubtotal * sgstRate) / 100;
  const calculatedServiceTax = (discountedSubtotal * serviceTaxRate) / 100;

  // Final total: if cgst or sgst are zero, use alternate rounding rule
  let calculatedTotal;
  if (Number(institutionData?.cgst) === 0 || Number(institutionData?.sgst) === 0) {
    calculatedTotal = Math.round(discountedSubtotal + calculatedServiceTax);
  } else {
    calculatedTotal = Math.round(discountedSubtotal + calculatedCgst + calculatedSgst + calculatedServiceTax);
  }

  const printBill = () => {
    // Clean up any existing print area or styles
    const existingPrintArea = document.getElementById("printArea");
    if (existingPrintArea) document.body.removeChild(existingPrintArea);
    const existingStyle = document.querySelector("#printAreaStyle");
    if (existingStyle) document.head.removeChild(existingStyle);

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

    if (!table || !table.id) {
      console.error("Invalid table information.");
      return;
    }

    // Calculate total quantity from items
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);

    const qrImageSrc = qrimage || ''; 

    // Function to proceed with printing
    const proceedWithPrint = () => {
      if (printerpaperSize === "80") {
        const showSubtotal = cgstRate > 0 || sgstRate > 0;
        const subtotalRow = showSubtotal
          ? `<div class="summary-row">
              <span>Subtotal:</span>
              <span>₹${billSubtotal.toFixed(2)}</span>
            </div>`
          : '';
        const cgstRow = gstShow
          ? `<div class="summary-row">
              <span>CGST (${cgstRate}%):</span>
              <span>₹${calculatedCgst.toFixed(2)}</span>
            </div>`
          : '';
        const sgstRow = gstShow
          ? `<div class="summary-row">
              <span>SGST (${sgstRate}%):</span>
              <span>₹${calculatedSgst.toFixed(2)}</span>
            </div>`
          : '';
        const itemsHTML = items
          .map(
            (item) => `
              <tr>
                <td class="item-name">${item.itemName || item.name}</td>
                <td class="item-qty">${item.quantity}</td>
                <td class="item-rate">₹${item.price % 1 === 0 ? item.price : item.price.toFixed(2)}</td>
                <td class="item-total">₹${(item.price * item.quantity) % 1 === 0 ? item.price * item.quantity : (item.price * item.quantity).toFixed(2)}</td>
              </tr>
            `
          )
          .join("");
        const qrSectionHTML = institutionData?.institution === "bhuk2323"
          ? `
            <div class="qr-section">
              <img src="${qrImageSrc}" alt="QR Code" class="qr-image"/>
              <p class="qr-text">Scan and Pay</p>
            </div>
          `
          : '';
        // Create print area
        const printArea = document.createElement("div");
        printArea.id = "printArea";
        printArea.innerHTML = `
          <div class="bill-container">
            <div class="bill-header">
              <h1>${institutionData?.companyName || "Restaurant Name"}</h1>
              <p class="address">${institutionData?.Query_Address || "Restaurant Address"}</p>
              <div class="contact-info">
                <div>Contact: ${institutionData?.Query_PhoneNumber || "N/A"}</div>
                <div>${formatDateTime()}</div>
              </div>
              ${gstShow && institutionData?.gstin ? `<div class="gstin">GSTIN: ${institutionData.gstin}</div>` : ""}
            </div>

            <div class="bill-details">
              <div class="table-info">Table: ${table.id}</div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>

            <div class="bill-summary">
              <div class="summary-row">
                <span>Total Qty:</span>
                <span>${totalQty}</span>
              </div>
              ${subtotalRow}
              ${discountAmount > 0 ? `<div class="summary-row"><span>Discount ${discountMethod === 'percentage' ? `(${discountPercentShown}%)` : '(Fixed)'}:</span><span>-₹${discountAmount.toFixed(2)}</span></div>` : ''}
              ${cgstRow}
              ${sgstRow}
              ${serviceTaxRate > 0 ? `
              <div class="summary-row">
                <span>Service Tax (${serviceTaxRate}%):</span>
                <span>₹${calculatedServiceTax.toFixed(2)}</span>
              </div>` : ''}
              <div class="summary-row grand-total">
                <span><b>Total(Including Taxes):</b></span>
                <span><b>₹${calculatedTotal.toFixed(2)}</b></span>
              </div>
            </div>

            <div class="bill-footer">
              <p>Thank you, visit again!</p>
              <p>Empower your business with tekkzy.com</p>
              ${qrSectionHTML}
            </div>
          </div>
        `;
        document.body.appendChild(printArea);

        // Add print styles
        const style = document.createElement("style");
        style.id = "printAreaStyle";
        style.innerHTML = `
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
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
              page-break-inside: avoid;
            }
          }

          .bill-container {
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-weight: 500;
            max-width: 80mm;
            margin: 0;
            padding: 2mm 1mm;
            box-sizing: border-box;
            font-size: 11pt;
            line-height: 1.3;
            color: #000;
          }
          .bill-header {
            text-align: center;
            margin-bottom: 4mm;
            border-bottom: 1px dashed #000;
            padding-bottom: 2mm;
          }
          .bill-header h1 {
            margin: 0 0 1mm 0;
            font-size: 16pt;
            font-weight: bold;
            font-family: 'Arial Black', 'Arial', sans-serif;
          }
          .bill-header .address {
            margin: 1mm 0;
            font-size: 10pt;
            font-weight: 400;
          }
          .contact-info {
            font-size: 10pt;
            margin-bottom: 1mm;
            text-align: center;
            line-height: 1.3;
            font-weight: 500;
          }
          .gstin {
            font-size: 10pt;
            text-align: center;
            font-weight: 500;
          }
          .bill-details {
            margin-bottom: 2mm;
            font-weight: bold;
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
            font-size: 11pt;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 2mm;
            font-size: 10pt;
            font-family: 'Arial', sans-serif;
            font-weight: 500;
          }
          .items-table thead {
            border-bottom: 1px solid #000;
          }
          .items-table th, .items-table td {
            padding: 0.5mm;
            text-align: left;
          }
          .items-table th {
            font-weight: bold;
            background-color: #f5f5f5;
            font-size: 10pt;
          }
          .items-table td {
            font-size: 10pt;
            font-weight: 500;
          }
          .item-name { 
            width: 42%; 
            word-wrap: break-word;
            font-weight: 600;
            font-size: 12pt;
          }
          .item-qty { 
            width: 18%; 
            text-align: center; 
            font-weight: bold;
            font-size: 12pt;
          }
          .item-rate { 
            width: 20%; 
            text-align: right; 
            font-weight: 500;
          }
          .item-total { 
            width: 20%; 
            text-align: right; 
            font-weight: bold;
          }
          .bill-summary {
            margin-top: 2mm;
            font-size: 10pt;
            font-weight: 500;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 0.5mm 0;
            border-bottom: 1px dashed #ddd;
            font-weight: 500;
          }
          .grand-total {
            font-weight: bold;
            border-bottom: none;
            border-top: 2px solid #000;
            padding-top: 1mm;
            font-size: 12pt;
            margin-top: 1mm;
          }
          .bill-footer {
            text-align: center;
            margin-top: 3mm;
            font-size: 9pt;
            border-top: 1px dashed #000;
            padding-top: 2mm;
            font-weight: 500;
            line-height: 1.4;
          }
          .qr-section {
            margin-top: 3mm;
            text-align: center;
          }
          .qr-image {
            max-width: 80mm;
            max-height: 40mm;
            margin: 2mm auto;
            display: block;
          }
          .qr-text {
            font-size: 10pt;
            font-weight: bold;
            margin: 1mm 0 0 0;
          }
        `;
        document.head.appendChild(style);
      } else if (printerpaperSize === "100") {
        const showSubtotal = cgstRate > 0 || sgstRate > 0;
        const subtotalRow = showSubtotal
          ? `<div class="summary-row">
              <span>Subtotal:</span>
              <span>₹${billSubtotal.toFixed(2)}</span>
            </div>`
          : '';
        const cgstRow = gstShow
          ? `<div class="summary-row">
              <span>CGST (${cgstRate}%):</span>
              <span>₹${calculatedCgst.toFixed(2)}</span>
            </div>`
          : '';
        const sgstRow = gstShow
          ? `<div class="summary-row">
              <span>SGST (${sgstRate}%):</span>
              <span>₹${calculatedSgst.toFixed(2)}</span>
            </div>`
          : '';
        const itemsHTML = items
          .map(
            (item) => `
              <tr>
                <td class="item-name">${item.itemName || item.name}</td>
                <td class="item-qty">${item.quantity}</td>
                <td class="item-rate">₹${item.price % 1 === 0 ? item.price : item.price.toFixed(2)}</td>
                <td class="item-total">₹${(item.price * item.quantity) % 1 === 0 ? item.price * item.quantity : (item.price * item.quantity).toFixed(2)}</td>
              </tr>
            `
          )
          .join("");
        const qrSectionHTML = institutionData?.institution === "bhuk2323"
          ? `
            <div class="qr-section">
              <img src="${qrImageSrc}" alt="QR Code" class="qr-image"/>
              <p class="qr-text">Scan and Pay</p>
            </div>
          `
          : '';
        // Create print area
        const printArea = document.createElement("div");
        printArea.id = "printArea";
        printArea.innerHTML = `
          <div class="bill-container">
            <div class="bill-header">
              <h1>${institutionData?.companyName || "Restaurant Name"}</h1>
              <p class="address">${institutionData?.Query_Address || "Restaurant Address"}</p>
              <div class="contact-info">
                <div>Contact: ${institutionData?.Query_PhoneNumber || "N/A"}</div>
                <div>${formatDateTime()}</div>
              </div>
              ${gstShow && institutionData?.gstin ? `<div class="gstin">GSTIN: ${institutionData.gstin}</div>` : ""}
            </div>

            <div class="bill-details">
              <div class="table-info">Table: ${table.id}</div>
            </div>

            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Rate</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>

            <div class="bill-summary">
              <div class="summary-row">
                <span>Total Qty:</span>
                <span>${totalQty}</span>
              </div>
              ${subtotalRow}
              ${discountAmount > 0 ? `<div class="summary-row"><span>Discount ${discountMethod === 'percentage' ? `(${discountPercentShown}%)` : '(Fixed)'}:</span><span>-₹${discountAmount.toFixed(2)}</span></div>` : ''}
              ${cgstRow}
              ${sgstRow}
              ${serviceTaxRate > 0 ? `
              <div class="summary-row">
                <span>Service Tax (${serviceTaxRate}%):</span>
                <span>₹${calculatedServiceTax.toFixed(2)}</span>
              </div>` : ''}
              <div class="summary-row grand-total">
                <span><b>Total(Including Taxes):</b></span>
                <span><b>₹${calculatedTotal.toFixed(2)}</b></span>
              </div>
            </div>

            <div class="bill-footer">
              <p>Thank you, visit again!</p>
              <p>Empower your business with tekkzy.com</p>
              ${qrSectionHTML}
            </div>
          </div>
        `;
        document.body.appendChild(printArea);

        // Add print styles
        const style = document.createElement("style");
        style.id = "printAreaStyle";
        style.innerHTML = `
          @media print {
            @page {
              size: 100mm auto;
              margin: 0;
            }
            body {
              margin: 0;
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
              page-break-inside: avoid;
            }
          }

          .bill-container {
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-weight: 500;
            max-width: 100mm;
            margin: 0;
            padding: 3mm 2mm;
            box-sizing: border-box;
            font-size: 14pt;
            line-height: 1.4;
            color: #000;
          }
          .bill-header {
            text-align: center;
            margin-bottom: 5mm;
            border-bottom: 1px dashed #000;
            padding-bottom: 3mm;
          }
          .bill-header h1 {
            margin: 0 0 2mm 0;
            font-size: 20pt;
            font-weight: bold;
            font-family: 'Arial Black', 'Arial', sans-serif;
          }
          .bill-header .address {
            margin: 2mm 0;
            font-size: 12pt;
            font-weight: 400;
          }
          .contact-info {
            font-size: 12pt;
            margin-bottom: 2mm;
            text-align: center;
            line-height: 1.4;
            font-weight: 500;
          }
          .gstin {
            font-size: 12pt;
            text-align: center;
            font-weight: 500;
          }
          .bill-details {
            margin-bottom: 3mm;
            font-weight: bold;
            border-bottom: 1px dashed #000;
            padding-bottom: 2mm;
            font-size: 14pt;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 3mm;
            font-size: 14pt;
            font-family: 'Arial', sans-serif;
            font-weight: 500;
          }
          .items-table thead {
            border-bottom: 1px solid #000;
          }
          .items-table th, .items-table td {
            padding: 1mm;
            text-align: left;
          }
          .items-table th {
            font-weight: bold;
            background-color: #f5f5f5;
            font-size: 14pt;
          }
          .items-table td {
            font-size: 14pt;
            font-weight: 500;
          }
          .item-name { 
            width: 42%; 
            word-wrap: break-word;
            font-weight: 600;
            font-size: 14pt;
          }
          .item-qty { 
            width: 18%; 
            text-align: center; 
            font-weight: bold;
            font-size: 14pt;
          }
          .item-rate { 
            width: 20%; 
            text-align: right; 
            font-weight: 500;
          }
          .item-total { 
            width: 20%; 
            text-align: right; 
            font-weight: bold;
          }
          .bill-summary {
            margin-top: 3mm;
            font-size: 14pt;
            font-weight: 500;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 1mm 0;
            border-bottom: 1px dashed #ddd;
            font-weight: 500;
          }
          .grand-total {
            font-weight: bold;
            border-bottom: none;
            border-top: 2px solid #000;
            padding-top: 2mm;
            font-size: 16pt;
            margin-top: 2mm;
          }
          .bill-footer {
            text-align: center;
            margin-top: 4mm;
            font-size: 12pt;
            border-top: 1px dashed #000;
            padding-top: 3mm;
            font-weight: 500;
            line-height: 1.5;
          }
          .qr-section {
            margin-top: 4mm;
            text-align: center;
          }
          .qr-image {
            max-width: 100mm;
            max-height: 50mm;
            margin: 3mm auto;
            display: block;
          }
          .qr-text {
            font-size: 12pt;
            font-weight: bold;
            margin: 2mm 0 0 0;
          }
        `;
        document.head.appendChild(style);
      } else {
        const showSubtotal = cgstRate > 0 || sgstRate > 0;
        const subtotalRow = showSubtotal
          ? `<tr><td><b>Subtotal:</b></td><td>₹${billSubtotal.toFixed(2)}</td></tr>`
          : '';
        const cgstRow = gstShow
          ? `<tr><td>CGST (${cgstRate}%):</td><td>₹${calculatedCgst.toFixed(2)}</td></tr>`
          : '';
        const sgstRow = gstShow
          ? `<tr><td>SGST (${sgstRate}%):</td><td>₹${calculatedSgst.toFixed(2)}</td></tr>`
          : '';
        const itemsHTML = items
          .map(
            (item) => `
              <tr>
                <td>${item.itemName || item.name}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">${item.price % 1 === 0 ? `₹${item.price}` : `₹${item.price.toFixed(2)}`}</td>
                <td style="text-align: right;">${(item.price * item.quantity) % 1 === 0 ? `₹${item.price * item.quantity}` : `₹${(item.price * item.quantity).toFixed(2)}`}</td>
              </tr>
            `
          )
          .join("");

        // Create print area
        const printArea = document.createElement("div");
        printArea.id = "printArea";
        printArea.innerHTML = `
          <div class="bill">
            <div class="header">${institutionData?.companyName || ""}</div>
            <div class="sub-header">${institutionData?.Query_Address || ""}</div>
            <div class="info">Contact: ${institutionData?.Query_PhoneNumber || ""}<br>Date: ${formatDateTime()}</div>
            ${gstShow && institutionData?.gstin ? `<div class="info">GSTIN: ${institutionData.gstin}</div>` : ""}
            ${orderId ? `<div class="info">Order ID: ${orderId}</div>` : ""}
            <div class="divider"></div>
            <div><b>Table:</b> ${table.id}</div>
            <div class="divider"></div>
            <table class="table" style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; table-layout: fixed;">
              <tr style="border-bottom: 2px solid #000; background-color: #f2f2f2; font-size: 10px;">
                <th style="text-align: left; padding: 8px; width: 40%;">Item</th>
                <th style="text-align: center; padding: 8px; width: 20%;">Qty</th>
                <th style="text-align: right; padding: 8px; width: 20%;">Rate</th>
                <th style="text-align: right; padding: 8px; width: 20%;">Total</th>
              </tr>
              ${itemsHTML}
            </table>
            <div class="divider"></div>
            <table class="totals">
              <tr><td><b>Total Qty:</b></td><td>${totalQty}</td></tr>
              ${subtotalRow}
              ${discountAmount > 0 ? `<tr><td>Discount ${discountMethod === 'percentage' ? `(${discountPercentShown}%)` : '(Fixed)'}:</td><td>-₹${discountAmount.toFixed(2)}</td></tr>` : ''}
              ${cgstRow}
              ${sgstRow}
              ${serviceTaxRate > 0 ? `
              <tr><td>Service Tax (${serviceTaxRate}%):</td><td>₹${calculatedServiceTax.toFixed(2)}</td></tr>` : ''}
              <tr class="grand-total"><td><b>Grand Total:</b></td><td>₹${calculatedTotal.toFixed(2)}</td></tr>
            </table>
            <div class="divider"></div>
            <div class="footer">Thank you for visiting!<br>Empowered the Business with tekkzy.com</div>
          </div>
        `;
        document.body.appendChild(printArea);

        // Add print styles
        const style = document.createElement("style");
        style.id = "printAreaStyle";
        style.innerHTML = screenWidth <= 1025
          ? `
            @media print {
              @page { size: 58mm auto; margin: 0; }
              body { margin: 0; padding: 0; }
              body * { visibility: hidden; }
              #printArea, #printArea * { visibility: visible; }
              #printArea { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 58mm; padding: 4mm; page-break-inside: avoid; }
            }
            .bill { font-family: monospace; font-size: 12px; line-height: 1.1; padding: 2px; text-align: left; max-width: 54mm; word-wrap: break-word; margin: 0 auto; }
            .header { font-size: 12px; font-weight: bold; text-align: center; }
            .table { font-size: 10px; }
            .sub-header, .info, .footer { font-size: 12px; text-align: center; }
            .divider { border-top: 1px dashed black; margin: 2px 0; }
            .table, .totals { width: 100%; border-collapse: collapse; font-size: 12px; }
            .table th, .table td, .totals td { padding: 1px; word-break: break-word; }
            .table th { text-align: center; }
            .grand-total { font-weight: bold; border-top: 1px solid black; font-size: 16px; }
          `
          : `
            @media print {
              @page { size: 58mm auto; margin: 0; }
              body { margin: 0; padding: 0; }
              body * { visibility: hidden; }
              #printArea, #printArea * { visibility: visible; }
              #printArea { position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 58mm; padding: 2mm; page-break-inside: avoid; }
            }
            .bill { font-family: monospace; font-size: 14px; line-height: 1.1; padding: 2px; text-align: left; max-width: 58mm; word-wrap: break-word; margin: 0 auto; }
            .header { font-size: 14px; font-weight: bold; text-align: center; }
            .table { font-size: 10px; }
            .sub-header, .info, .footer { font-size: 14px; text-align: center; }
            .divider { border-top: 1px dashed black; margin: 2px 0; }
            .table, .totals { width: 100%; border-collapse: collapse; font-size: 14px; }
            .table th, .table td, .totals td { padding: 1px; word-break: break-word; }
            .table th { text-align: center; }
            .grand-total { font-weight: bold; border-top: 1px solid black; font-size: 16px; }
          `;
        document.head.appendChild(style);
      }

      window.print();

      window.onafterprint = () => {
        document.body.removeChild(printArea);
        document.head.removeChild(style);
      };
      
      setTimeout(() => {
        const existingPrintArea = document.getElementById("printArea");
        if (existingPrintArea) existingPrintArea.remove();
        const existingStyle = document.getElementById("printAreaStyle");
        if (existingStyle) existingStyle.remove();
      }, 1000);
    };

    if (institutionData?.institution === "bhuk2323" && qrImageSrc) {
      const img = new Image();
      img.onload = () => {
        console.log("QR image loaded successfully");
        proceedWithPrint();
      };
      img.onerror = () => {
        console.warn("QR image failed to load, proceeding without QR");
        proceedWithPrint();
      };
      img.src = qrImageSrc;
    } else {
      proceedWithPrint();
    }
  };

  printBill();
};

export default PrintBill;