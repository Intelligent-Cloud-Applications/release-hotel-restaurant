import jsPDF from "jspdf";

export function exportStockPDF(filteredStocks, filterType) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 60;

  // Simple color palette
  const colors = {
    headerBg: [52, 144, 220], // Blue header background
    headerText: [255, 255, 255], // White header text
    text: [0, 0, 0], // Black text
    rowBg: [248, 249, 250], // Light gray for alternate rows
    white: [255, 255, 255], // White background
  };

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.text);
  doc.text("INVENTORY STOCK REPORT", 50, y);
  y += 40;

  // Date
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const reportDate = new Date().toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
  doc.text(`Date: ${reportDate}`, 50, y);
  y += 40;

  // Table setup - Full width with minimal padding
  const headers = ["Sl No", "Stock Name", "Quantity"];
  if (filterType === "bar") headers.push("One Bottle Volume (ml)");

  const tablePadding = 30;
  const tableWidth = pageWidth - tablePadding * 2;
  const tableStartX = tablePadding;

  // Simple equal column distribution
  const numColumns = headers.length;
  const colWidth = tableWidth / numColumns;
  const colWidths = new Array(numColumns).fill(colWidth);

  function drawTableHeader() {
    let x = tableStartX;

    // Header background
    doc.setFillColor(...colors.headerBg);
    doc.rect(x, y, tableWidth, 30, "F");

    // Header text
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...colors.headerText);

    headers.forEach((header, idx) => {
      if (header === "Quantity" || header === "One Bottle Volume (ml)") {
        // Right align numeric headers
        const headerWidth = doc.getTextWidth(header);
        doc.text(header, x + colWidths[idx] - headerWidth - 10, y + 20);
      } else {
        // Default left align headers
        doc.text(header, x + 10, y + 20, {
          maxWidth: colWidths[idx] - 20,
        });
      }
      x += colWidths[idx];
    });

    y += 30;
  }

  // Draw header
  drawTableHeader();

  // Table rows
  filteredStocks.forEach((stock, rowIdx) => {
    let x = tableStartX;

    // Alternating row background
    if (rowIdx % 2 === 1) {
      doc.setFillColor(...colors.rowBg);
      doc.rect(x, y, tableWidth, 25, "F");
    }

    // Cell content
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.text);

    // Serial number (left aligned)
    doc.text(String(rowIdx + 1), x + 10, y + 16);
    x += colWidths[0];

    // Stock name (left aligned)
    doc.text(String(stock.stockName), x + 10, y + 16, {
      maxWidth: colWidths[1] - 20,
    });
    x += colWidths[1];

    // Quantity (right aligned, display as-is)
    const qtyText = String(stock.quantity);
    const qtyWidth = doc.getTextWidth(qtyText);
    doc.text(qtyText, x + colWidths[2] - qtyWidth - 8, y + 18);
    x += colWidths[2];

    // Volume for bar items (right aligned, display as-is)
    if (filterType === "bar") {
      const volumeText = stock.oneBottleVolume
        ? String(stock.oneBottleVolume)
        : "N/A";
      const volumeWidth = doc.getTextWidth(volumeText);
      doc.text(volumeText, x + colWidths[3] - volumeWidth - 10, y + 18);
    }

    y += 25;

    // Page break if needed
    if (y > pageHeight - 80) {
      doc.addPage();
      y = 60;
      drawTableHeader();
    }
  });

  // Save the PDF
  const dateStr = new Date().toISOString().split("T")[0];
  doc.save(`Stock_Report_${filterType}_${dateStr}.pdf`);
}
