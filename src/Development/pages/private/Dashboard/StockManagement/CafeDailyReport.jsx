import { safeNum, parseVolumeToMl, dateToKey} from './index';
const formatNumber = (num) => {
  const rounded = Number(num.toFixed(2)); 
  return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2).replace(/\.?0+$/, '');
};

const buildCafeDailyReport = (isoDate, stocks) => {
  const key = dateToKey(isoDate);
  const items = [];

  stocks
    .filter((s) => s.type === "cafe")
    .forEach((stock) => {
      const update = (stock.stockupdate || {})[key] || {};
      const hasUpdate = Object.keys(update).length > 0;
      const openingRaw = hasUpdate ? (update.openingStock ?? update.opening ?? update.open ?? 0) : stock.quantity ?? 0;
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
        if (!["openingStock", "opening", "open", "received"].includes(key) && !key.startsWith("unitRate_")) {
          const cnt = safeNum(update[key] ?? 0);
          const num = Number(String(key).match(/\d+/)?.[0] || 1);
          consumptionQty += cnt * num;
        }
      });

      const closingQty = Math.max(0, totalQty - consumptionQty);

      const convertQuantities = (qty, unit) => {
        let kgL = 0, gMl = 0, piece = 0;
        if (unit === "piece") {
          piece = qty;
        } else if (["kg", "l"].includes(unit)) {
          kgL = qty;
          gMl = (qty * 1000) % 1000; // Only show remainder in g/ml
        } else if (["g", "ml"].includes(unit)) {
          kgL = Math.floor(qty / 1000); // Convert to kg/l if >= 1000
          gMl = qty % 1000; // Remainder in g/ml
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

export const exportCafeDailyReport = (isoDate, stocks,institutionData) => {
  if (!isoDate) {
    alert("Choose a date first");
    return;
  }

  const { items } = buildCafeDailyReport(isoDate, stocks);

  const currentTime = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let html = `
    <div id="cafe-report-container" style="font-family: 'Courier New', Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #333; background: #fff; width: 100%; max-width: 210mm; margin: 0 auto; padding: 10mm; box-sizing: border-box;">
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-size: 18px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">${(institutionData?.companyName || "Company Name").toUpperCase()} Cafe Daily Stock Summary</div>
        <div style="font-size: 13px; margin-top: 2px; color: #555; text-transform: uppercase;">Detailed Inventory Report</div>
        <div style="font-size: 12px; margin-top: 4px; color: #666;">
          Date: ${isoDate.split('-').reverse().join('/')} | Printed: ${currentTime}
        </div>
        <table style="width: 100%; margin: 4px 0;"><tr><td colspan="18" style="border-bottom: 1px dashed #000;"></td></tr></table>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; margin: 0 auto;">
        <thead>
          <tr style="font-weight: bold; font-size: 12px; background: #f5f5f5; border-bottom: 1px dashed #000;">
            <th rowspan="2" style="width: 25%; text-align: left; padding: 4px 8px; text-transform: uppercase;">Item</th>
            <th colspan="3" style="text-align: center; padding: 4px 8px; text-transform: uppercase;">Opening</th>
            <th colspan="3" style="text-align: center; padding: 4px 8px; text-transform: uppercase;">Received</th>
            <th colspan="3" style="text-align: center; padding: 4px 8px; text-transform: uppercase;">Consumption / Waste</th>
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
          ${items.map((it) => `
            <tr >
              <td style="padding: 4px 8px; text-align: left;">${it.stockName.substring(0, 20)}</td>
              <td style="padding: 4px 8px; text-align: right;">${formatNumber(it.opening.kgL)}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.opening.gMl.toFixed(0)}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.opening.piece}</td>
              <td style="padding: 4px 8px; text-align: right;">${formatNumber(it.received.kgL)}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.received.gMl.toFixed(0)}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.received.piece}</td>
              <td style="padding: 4px 8px; text-align: right;">${formatNumber(it.consumption.kgL)}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.consumption.gMl.toFixed(0)}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.consumption.piece}</td>
              <td style="padding: 4px 8px; text-align: right;">${formatNumber(it.closing.kgL)}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.closing.gMl.toFixed(0)}</td>
              <td style="padding: 4px 8px; text-align: right;">${it.closing.piece}</td>
            </tr>
          `).join('')}
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

  const existingReport = document.getElementById('cafe-report-container');
  if (existingReport) {
    existingReport.remove();
  }

  const reportDiv = document.createElement('div');
  reportDiv.innerHTML = html;
  document.body.appendChild(reportDiv);

  document.getElementById('cafe-report-container').style.display = 'block';

  setTimeout(() => {
    window.print();
    setTimeout(() => {
      const container = document.getElementById('cafe-report-container');
      if (container) container.style.display = 'none';
    }, 1000);
  }, 500);
};