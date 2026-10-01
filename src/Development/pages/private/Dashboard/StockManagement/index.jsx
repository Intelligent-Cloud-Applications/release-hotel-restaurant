import React, { useState, useEffect, useContext } from "react";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import StockModal from "./StockModal";
import StockTable from "./StockTable";
import StockFilter from "./StockFilter";
import { Button } from "flowbite-react";
import { X, PlusCircle, Trash2, Package } from "lucide-react";
import { exportStockPDF } from "./StockPDFExporter";
import { StockInput } from "../../../../common/Inputs/DropDownInput";
import operationData from "../../../../../Operation/data.json";
const Loader = () => (
  <div className="flex flex-col items-center justify-center p-12">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-gray-300 border-t-primaryColor rounded-full animate-spin"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl font-bold">
        🍽️
      </div>
    </div>
    <p className="mt-4 text-primaryColor font-medium">Loading items...</p>
  </div>
);

const hasBarIntegration = Boolean(operationData?.bar_integration?.trim());

const AdjustmentModal = ({
  showModal,
  setShowModal,
  adjustmentType,
  adjustments,
  setAdjustments,
  handleAdjustmentSubmit,
  adjustmentLoading,
  stocks,
  filterType,
}) => {
  if (!showModal) return null;
  const filteredStocks = stocks.filter((s) => s.type === filterType);
  const addAdjustment = () => {
    setAdjustments([
      ...adjustments,
      { stockId: "", amount: 1, unit: filterType === "cafe" ? "kg" : "l" },
    ]);
  };
  const removeAdjustment = (index) =>
    setAdjustments(adjustments.filter((_, i) => i !== index));
  const handleChange = (index, field, value) => {
    const newAdjs = [...adjustments];
    newAdjs[index][field] = field === "amount" ? (value === "" ? "" : Number(value)) : value;
    if (field === "stockId") {
      const selected = stocks.find((s) => s.stockId === value);
      if (selected) {
        const sUnit = String(selected.unit || "").toLowerCase();
        const sQty = String(selected.quantity || "").toLowerCase();
        if (sUnit === "l" || sQty.includes("l") || sUnit === "ml" || sQty.includes("ml")) {
          newAdjs[index].unit = "l";
        } else if (sUnit === "piece" || sQty.includes("piece")) {
          newAdjs[index].unit = "piece";
        } else {
          newAdjs[index].unit = "kg";
        }
      }
    }
    setAdjustments(newAdjs);
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 relative">
        <button
          onClick={() => setShowModal(false)}
          className="absolute top-2 right-2 text-gray-500 hover:text-red-500">
          <X size={18} />
        </button>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Package className="text-primaryColor" size={20} />{" "}
          {adjustmentType === "receive"
            ? "Receive Stock"
            : "Record Consumption / Waste"}
        </h2>

        <form onSubmit={handleAdjustmentSubmit} noValidate className="space-y-3">
          {adjustments.map((adj, index) => (
            <div
              key={index}
              className="border rounded-md p-3 bg-gray-50 relative">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Stock Item
                  </label>
                  <StockInput
                    stocks={filteredStocks}
                    value={adj.stockId}
                    onChange={(value) => handleChange(index, "stockId", value)}
                    filterType={filterType}
                    className="text-sm focus:ring-1 focus:ring-primaryColor focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600">
                    Amount
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-gray-300 rounded overflow-hidden w-full bg-white focus-within:ring-1 focus-within:ring-primaryColor">
                      <button
                        type="button"
                        onClick={() => {
                          const current = Number(adj.amount) || 0;
                          handleChange(index, "amount", Math.max(1, current - 1));
                        }}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold border-r transition select-none"
                        title="Decrease by 1"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={adj.amount}
                        onChange={(e) =>
                          handleChange(index, "amount", e.target.value)
                        }
                        className="px-2 py-1 w-full text-sm text-center border-0 focus:outline-none focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const current = Number(adj.amount) || 0;
                          handleChange(index, "amount", current + 1);
                        }}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold border-l transition select-none"
                        title="Increase by 1"
                      >
                        +
                      </button>
                    </div>
                    <select
                      value={adj.unit}
                      onChange={(e) =>
                        handleChange(index, "unit", e.target.value)
                      }
                      className="border border-gray-300 px-2 py-1 rounded w-20 text-sm focus:ring-1 focus:ring-primaryColor focus:outline-none">
                      {filterType === "cafe" ? (
                        <>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="l">l</option>
                          <option value="ml">ml</option>
                          <option value="piece">piece</option>
                        </>
                      ) : (
                        <>
                          <option value="l">L</option>
                          <option value="ml">ML</option>
                          <option value="btl">BTL</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {adjustments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAdjustment(index)}
                  className="absolute top-2 right-2 text-red-500 hover:text-red-700 transition">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addAdjustment}
            className="flex items-center gap-1 text-primaryColor hover:text-primaryColor-dark text-sm font-medium transition">
            <PlusCircle size={16} /> Add Another
          </button>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 transition text-sm text-gray-700">
              Cancel
            </button>
            <Button
              type="submit"
              disabled={adjustmentLoading}
              className="bg-primaryColor text-white px-3 py-1 rounded-md text-sm shadow-sm hover:opacity-90 transition">
              {adjustmentLoading ? "Saving..." : "Submit"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const dateToKey = (dateOrStr) => {
  if (!dateOrStr) return "";
  if (typeof dateOrStr === "string") {
    const parts = dateOrStr.split("-");
    if (parts.length === 3) {
      const yy = parts[0].slice(-2);
      const mm = parts[1].padStart(2, "0");
      const dd = parts[2].slice(0, 2).padStart(2, "0");
      return `${yy}${mm}${dd}`;
    }
    if (/^\d{6}$/.test(dateOrStr)) {
      return dateOrStr;
    }
  }
  const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
  if (isNaN(d.getTime())) return "";
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
};

const safeNum = (val) => {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const m = String(val).match(/-?[\d,.]+/);
  if (!m) return 0;
  return Number(String(m[0]).replace(/,/g, "")) || 0;
};

const parseVolumeToMl = (str) => {
  if (!str && str !== 0) return 0;
  if (typeof str === "number") return str;
  const s = String(str).trim().toLowerCase();
  if (s.includes("piece")) return Number(s.match(/([\d,.]+)/)?.[1] || 1); // Treat piece as count-based for cafe
  const nMatch = s.match(/([\d,.]+)/);
  if (!nMatch) return 0;
  let num = Number(nMatch[1].replace(/,/g, ""));
  if (s.includes("l") && !s.includes("ml")) {
    num = num * 1000;
  } else if (s.includes("ml")) {
    // num stays
  } else if (s.includes("kg")) {
    num = num * 1000;
  } else if (s.includes("g")) {
    // num stays
  } else if (!isNaN(num) && num > 0 && num < 10) {
    // ambiguous small number; assume L or kg if single-digit? keep as-is (rare)
  }
  return Math.round(num);
};

const formatBottlesMl = (mlTotal, oneBottleMl) => {
  const bottleSize = oneBottleMl > 0 ? oneBottleMl : 1000;
  const bottles = Math.floor(mlTotal / bottleSize);
  const remainder = mlTotal - bottles * bottleSize;
  return { bottles, remainder };
};

const StockManagement = () => {
  const { institutionData, items: contextItems } = useContext(Context) || {};
  const institution =
    institutionData?.institution ||
    institutionData?.id ||
    institutionData?.name ||
    "";

  const [stocks, setStocks] = useState([]);
  const [menuItems, setMenuItems] = useState(contextItems || []);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentStock, setCurrentStock] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    stockName: "",
    quantity: 0,
    type: "cafe",
    oneBottleVolume: "",
    unit: "kg",
  });
  const [filterType, setFilterType] = useState("cafe");
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        setLoading(true);
        if (!institution) {
          console.warn(
            "No institution id available in Context. Skipping fetch."
          );
          setStocks([]);
          setMenuItems([]);
          return;
        }
        const [stockResponse, itemsResponse] = await Promise.all([
          API.get("main", `/admin/stock-list-items/${institution}`),
          API.get("main", `/any/list-items/${institution}`, {}).catch(() => []),
        ]);
        setStocks(stockResponse || []);
        const loadedItems =
          Array.isArray(itemsResponse) && itemsResponse.length > 0
            ? itemsResponse
            : (contextItems || []);
        setMenuItems(loadedItems);
      } catch (error) {
        console.error("Error fetching stock data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStockData();
  }, [institution]);

  useEffect(() => {
    if (contextItems && Array.isArray(contextItems) && contextItems.length > 0) {
      setMenuItems((prev) => (prev.length === 0 ? contextItems : prev));
    }
  }, [contextItems]);

  const handleSearch = (e) => setSearch(e.target.value);

  const filteredStocks = stocks.filter(
    (stock) =>
      stock.type === filterType &&
      stock.stockName &&
      stock.stockName.toLowerCase().includes(search.toLowerCase())
  );

  const openAddModal = () => {
    setEditMode(false);
    setCurrentStock(null);
    setForm({
      stockName: "",
      quantity: 0,
      type: filterType,
      oneBottleVolume: "",
      unit: filterType === "cafe" ? "kg" : "l",
    });
    setShowModal(true);
  };

  const openEditModal = (stock) => {
    setEditMode(true);
    setCurrentStock(stock);
    let quantityNum = 0;
    let unitStr = stock.type === "cafe" ? "kg" : "l";
    let oneBottleVolumeNum = "";
    let oneBottleUnit = "ml";

    if (typeof stock.quantity === "string") {
      const parts = stock.quantity.split(" ");
      quantityNum = parseFloat(parts[0]) || 0;
      unitStr = (parts[1] || stock.unit || unitStr).toLowerCase();
    } else {
      quantityNum = Number(stock.quantity) || 0;
      unitStr = (stock.unit || unitStr).toLowerCase();
    }

    // De-convert base units so the user sees clean, friendly values and avoids double-multiplication on update
    if (unitStr === "g" && quantityNum >= 1000 && quantityNum % 1000 === 0) {
      quantityNum = quantityNum / 1000;
      unitStr = "kg";
    } else if (unitStr === "ml" && quantityNum >= 1000 && quantityNum % 1000 === 0) {
      quantityNum = quantityNum / 1000;
      unitStr = "l";
    }

    if (stock.type === "bar" && stock.oneBottleVolume) {
      const parts = stock.oneBottleVolume.split(" ");
      oneBottleVolumeNum = Number(parts[0]) || "";
      oneBottleUnit = parts[1] || "ml";
    }

    setForm({
      stockName: stock.stockName || stock.name || "",
      quantity: quantityNum,
      type: stock.type || filterType,
      unit: unitStr,
      category: stock.category || "",
      oneBottleVolume: stock.oneBottleVolume || "",
      oneBottleVolumeNum: oneBottleVolumeNum,
      oneBottleUnit: oneBottleUnit,
    });
    setShowModal(true);
  };

  const handleDelete = async (stockOrId) => {
    const id = typeof stockOrId === "object" ? stockOrId.stockId : stockOrId;
    const targetStock =
      stocks.find((s) => s.stockId === id) ||
      (typeof stockOrId === "object" ? stockOrId : null);
    const stockName =
      targetStock?.stockName || targetStock?.name || "this stock item";

    // Check if any menu item is connected to this stock
    const connected = (menuItems || []).filter((item) => {
      if (Array.isArray(item.materials)) {
        return item.materials.some((m) => {
          if (m.stockId && id && m.stockId === id) return true;
          if (
            m.stockName &&
            targetStock?.stockName &&
            m.stockName.trim().toLowerCase() ===
              targetStock.stockName.trim().toLowerCase()
          )
            return true;
          return false;
        });
      }
      if (item.stockId && id && item.stockId === id) return true;
      return false;
    });

    if (connected.length > 0) {
      const names = connected
        .map((it) => it.itemName || it.name)
        .filter(Boolean)
        .join(", ");
      alert(
        `Cannot delete "${stockName}" because it is connected to the following menu item(s):\n\n• ${names}\n\nPlease remove this stock material from those item(s) before deleting.`
      );
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${stockName}"?`))
      return;

    try {
      await API.del("main", `/admin/stock-delete-item/${institution}/${id}`);
      setStocks((prev) => prev.filter((stock) => stock.stockId !== id));
    } catch (error) {
      console.error("Error deleting stock item:", error);
      alert("Delete failed. Please try again.");
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "oneBottleVolumeNum"
          ? (value === "" ? "" : Number(value))
          : value,
    }));
  };

  const handleSubmit = async (e, updatedForm = form) => {
    e.preventDefault();
    if (!updatedForm.stockName.trim() || updatedForm.quantity < 0) {
      alert("Please fill in all required fields with valid values");
      return;
    }
    if (updatedForm.type === "bar" && !updatedForm.oneBottleVolume) {
      alert("One bottle volume is required for bar items");
      return;
    }

    setModalLoading(true);
    try {
      let response;
      if (editMode && currentStock) {
        if (
  institutionData.bar_integration === "Yes"
) {
  updatedForm.dateId = institutionData.dateId;
}
        response = await API.put(
          "main",
          `/admin/stock-update-item/${institution}/${currentStock.stockId}`,
          { body: updatedForm }
        );
        setStocks(
          stocks.map((stock) =>
            stock.stockId === currentStock.stockId
              ? { ...stock, ...updatedForm }
              : stock
          )
        );
      } else {
        response = await API.post(
          "main",
          `/admin/stock-create-item/${institution}`,
          { body: updatedForm }
        );
        if (response && response.stockId) {
          setStocks((prev) => [...prev, response]);
        } else {
          const refreshed = await API.get(
            "main",
            `/admin/stock-list-items/${institution}`
          );
          setStocks(refreshed || []);
        }
      }
      setShowModal(false);
    } catch (error) {
      console.error("Error saving stock item:", error);
      alert("Error saving stock item. Please try again.");
    } finally {
      setModalLoading(false);
    }
  };

  const openAdjustmentModal = (type) => {
    setAdjustmentType(type);
    setAdjustments([
      { stockId: "", amount: 1, unit: filterType === "cafe" ? "kg" : "l" },
    ]);
    setShowAdjustmentModal(true);
  };

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (
      adjustments.some(
        (adj) => !adj.stockId || adj.amount <= 0 || !adj.unit.trim()
      )
    ) {
      alert(
        "Please fill all fields correctly with positive amounts and valid units"
      );
      return;
    }

    setAdjustmentLoading(true);

    try {
      await Promise.all(
        adjustments.map((adj) => {
          let adjustedAmount = adj.amount;
          let adjustedUnit = adj.unit.toLowerCase();

          if (filterType === "cafe") {
            if (adjustedUnit === "kg") {
              adjustedAmount = adj.amount * 1000;
              adjustedUnit = "g";
            } else if (adjustedUnit === "g") {
              adjustedUnit = "g";
            } else if (adjustedUnit === "l") {
              adjustedAmount = adj.amount * 1000;
              adjustedUnit = "ml";
            } else if (adjustedUnit === "ml") {
              adjustedUnit = "ml";
            } else if (adjustedUnit === "piece") {
              adjustedUnit = "piece";
            } else {
              throw new Error(`Invalid unit for cafe: ${adj.unit}`);
            }
          } else if (filterType === "bar") {
            if (adjustedUnit === "l") {
              adjustedAmount = adj.amount * 1000;
              adjustedUnit = "ml";
            } else if (adjustedUnit === "ml") {
              adjustedUnit = "ml";
            } else if (adjustedUnit === "btl") {
              const stock = stocks.find(s => s.stockId === adj.stockId);
              if (!stock) {
                throw new Error(`Stock not found for ID: ${adj.stockId}`);
              }
              const oneBottleMl = parseVolumeToMl(stock.oneBottleVolume || "1000 ml");
              adjustedAmount = adj.amount * oneBottleMl;
              adjustedUnit = "ml";
            } else {
              throw new Error(`Invalid unit for bar: ${adj.unit}`);
            }
          }

          return API.post("main", `/admin/stock-adjust/${institution}`, {
            body: {
              stockId: adj.stockId,
              adjustmentType,
              amount: adjustedAmount,
              unit: adjustedUnit,
               ...(institutionData?.bar_integration === "Yes"
        ? { dateId: institutionData.dateId }
        : {}),
            },
          });
        })
      );
      setShowAdjustmentModal(false);
      const response = await API.get(
        "main",
        `/admin/stock-list-items/${institution}`
      );
      setStocks(response);
    } catch (error) {
      console.error("Error adjusting stocks:", error);
      alert("Error adjusting stocks. Please try again.");
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Stock Name",
      "Quantity",
      filterType === "bar" ? "One Bottle Volume" : null,
    ].filter(Boolean);
    const rows = filteredStocks.map((stock) =>
      [
        stock.stockName,
        stock.quantity,
        filterType === "bar" ? stock.oneBottleVolume || "N/A" : null,
      ].filter(Boolean)
    );
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\n";
    rows.forEach((row) => {
      csvContent += row.join(",") + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `stock_${filterType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => exportStockPDF(filteredStocks, filterType);

  const baseSaleCols = ["60 ml", "30 ml"];

  const buildDailyReportByCategory = (isoDate, typeFilter) => {
    const key = dateToKey(isoDate);
    const saleSizes = new Set(baseSaleCols);
    const rateSizes = new Set();
    const groups = {};

    // Group stocks by category
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

          // Calculate closing stock in ml
          const closingMl = Math.max(
            0,
            totalMl - salesVolumeMl - transferredMl
          );
          const oneBottleMl = parseVolumeToMl(
            stock.oneBottleVolume || "1000 ml"
          );
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
          closingBottles: 0, // Aggregate bottles
          closingRemainderMl: 0, // Aggregate remainder ml
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
          // Aggregate bottles and remainder for category
          catTotals.closingBottles += safeNum(it.closingBTL.bottles);
          catTotals.closingRemainderMl += safeNum(it.closingBTL.remainder);
        });

        const oneBottleMl = items.length > 0 ? items[0].oneBottleMl : 1000; // Use first item's bottle size or default
        catTotals.openingBTL = formatBottlesMl(
          catTotals.openingMl,
          oneBottleMl
        );
        catTotals.receivedBTL = formatBottlesMl(
          catTotals.receivedMl,
          oneBottleMl
        );
        catTotals.totalBTL = formatBottlesMl(catTotals.totalMl, oneBottleMl);
        catTotals.transferredBTL = formatBottlesMl(
          catTotals.transferredMl,
          oneBottleMl
        );
        // Use aggregated values for closing
        catTotals.closingBTL = {
          bottles: catTotals.closingBottles,
          remainder: catTotals.closingRemainderMl,
        };

        grandTotalAmount += catTotals.amount;
        categories.push({ category: cat, items, totals: catTotals });
      });

    return { categories, saleCols, rateCols, grandTotalAmount };
  };

  const exportDailyReport = (isoDate) => {
    if (!isoDate) {
      alert("Choose a date first");
      return;
    }

    const forcedType = "bar";
    const { saleCols, rateCols, categories, grandTotalAmount } =
      buildDailyReportByCategory(isoDate, forcedType);

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
          <div style="text-align: right;">${totalSgst.toFixed(2)}</div>
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
            <th colspan="2" style="text-align: center; padding: 1px; border-bottom: 1px solid #ccc;">CONSUMPTION / WASTE</th>
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
             <td colspan="18" style="border-bottom: 1px dashed #000; height: 1px;"></td>
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

    // Remove existing report if any
    const existingReport = document.getElementById("report-container");
    if (existingReport) {
      existingReport.remove();
    }

    // Create and append new report
    const reportDiv = document.createElement("div");
    reportDiv.innerHTML = html;
    document.body.appendChild(reportDiv);

    // Show the report
    document.getElementById("report-container").style.display = "block";

    // Auto-trigger print dialog
    setTimeout(() => {
      window.print();
      // Hide report after printing
      setTimeout(() => {
        const container = document.getElementById("report-container");
        if (container) container.style.display = "none";
      }, 1000);
    }, 500);
  };
  if (loading) return <Loader />;
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-primaryColor text-center sm:text-left">
        Stock Management
      </h1>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full">
          {institutionData?.bar_integration === "Yes" && (
            <StockFilter
              filterType={filterType}
              setFilterType={setFilterType}
            />
          )}
          <div className="relative w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search stock..."
              value={search}
              onChange={handleSearch}
              className="border px-3 py-2 rounded w-full sm:w-64 focus:ring-2 focus:ring-primaryColor"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full flex-wrap items-center">
          {/* <Button className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md" onClick={exportCSV}>Export CSV</Button>
          <Button className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md" onClick={exportPDF}>Export PDF</Button> */}
          <Button
            className="bg-blue-600 text-white font-semibold px-3 py-1 rounded-lg shadow-md hover:bg-blue-700 transition"
            onClick={() => openAdjustmentModal("receive")}>
            Receive Stock
          </Button>
          <Button
            className="bg-amber-600 text-white font-semibold px-3 py-1 rounded-lg shadow-md hover:bg-amber-700 transition"
            onClick={() => openAdjustmentModal("transfer")}>
            Consumption / Waste
          </Button>
          <Button
            className="bg-primaryColor text-white font-semibold px-3 py-1 rounded-lg shadow-md hover:opacity-90 transition"
            onClick={openAddModal}>
            <span className="flex items-center justify-center">
              <svg
                className="w-5 h-5 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Stock
            </span>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <StockTable
            stocks={filteredStocks}
            onEdit={openEditModal}
            onDelete={handleDelete}
            menuItems={menuItems}
          />
        </div>
      </div>

      <StockModal
        showModal={showModal}
        editMode={editMode}
        form={form}
        handleFormChange={handleFormChange}
        handleSubmit={handleSubmit}
        setShowModal={setShowModal}
        setForm={setForm}
        modalLoading={modalLoading}
        institutionData={institutionData}
        stocks={stocks}
      />

      <AdjustmentModal
        showModal={showAdjustmentModal}
        setShowModal={setShowAdjustmentModal}
        adjustmentType={adjustmentType}
        adjustments={adjustments}
        setAdjustments={setAdjustments}
        handleAdjustmentSubmit={handleAdjustmentSubmit}
        adjustmentLoading={adjustmentLoading}
        stocks={stocks}
        filterType={filterType}
      />
    </div>
  );
};
export { safeNum, parseVolumeToMl, formatBottlesMl, dateToKey };
export default StockManagement;