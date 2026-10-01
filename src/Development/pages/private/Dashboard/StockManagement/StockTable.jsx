import { FaEdit } from "react-icons/fa";
import { MdDeleteForever } from "react-icons/md";

// Helper function to format quantity
const formatQuantity = (stock, filterType) => {
  if (!stock || stock.quantity === undefined || stock.quantity === null) return "-";
  const rawQty = String(stock.quantity).trim();
  const parts = rawQty.split(" ");
  const num = parseFloat(parts[0]);
  const unit = (parts[1] || stock.unit || "").toLowerCase();

  if (isNaN(num)) return rawQty;

  if (filterType === "cafe") {
    // Grams: e.g. 5000 g -> 5 kg, 1500 g -> 1 kg 500 g, 500 g -> 500 g
    if (unit === "g" || (rawQty.endsWith("g") && !rawQty.endsWith("kg"))) {
      const kg = Math.floor(num / 1000);
      const gm = num % 1000;
      if (kg > 0 && gm > 0) return `${kg} kg ${gm} g`;
      if (kg > 0) return `${kg} kg`;
      return `${gm} g`;
    }
    // Kilograms: e.g. 5 kg
    if (unit === "kg" || rawQty.includes("kg")) {
      return `${num} kg`;
    }
    // Milliliters: e.g. 5000 ml -> 5 l, 1500 ml -> 1 l 500 ml, 500 ml -> 500 ml
    if (unit === "ml" || rawQty.includes("ml")) {
      const l = Math.floor(num / 1000);
      const ml = num % 1000;
      if (l > 0 && ml > 0) return `${l} l ${ml} ml`;
      if (l > 0) return `${l} l`;
      return `${ml} ml`;
    }
    // Liters: e.g. 5 l
    if (unit === "l" || rawQty.endsWith("l") || rawQty.includes(" l")) {
      return `${num} l`;
    }
    return `${num} ${unit || "piece"}`.trim();
  }

  if (filterType === "bar") {
    const bottleVol = parseInt(stock.oneBottleVolume, 10) || 1000; // default 1000 ml
    const bottles = Math.floor(num / bottleVol);
    const remaining = num % bottleVol;
    return `${bottles > 0 ? bottles + " bottle " : ""}${remaining > 0 ? remaining + " ml" : ""}`.trim() || `${num} ml`;
  }

  return rawQty;
};

// StockTable Component
const StockTable = ({ stocks, onEdit, onDelete, menuItems = [] }) => {
  const filterType = stocks[0]?.type || "cafe";

  const getConnectedItemNames = (stock) => {
    if (!stock || !menuItems.length) return [];
    const sId = stock.stockId;
    const sName = (stock.stockName || stock.name || "").trim().toLowerCase();

    return menuItems
      .filter((item) => {
        if (Array.isArray(item.materials)) {
          return item.materials.some((m) => {
            if (m.stockId && sId && m.stockId === sId) return true;
            if (
              m.stockName &&
              sName &&
              m.stockName.trim().toLowerCase() === sName
            )
              return true;
            return false;
          });
        }
        if (item.stockId && sId && item.stockId === sId) return true;
        return false;
      })
      .map((it) => it.itemName || it.name)
      .filter(Boolean);
  };

  return (
    <table className="w-full">
      <thead>
        <tr className="bg-gray-50 border-b">
          <th className="py-3 px-4 text-left font-medium text-gray-700">
            Stock Name
          </th>
          <th className="py-3 px-4 text-center font-medium text-gray-700">
            Quantity
          </th>
          {filterType === "bar" && (
            <th className="py-3 px-4 text-center font-medium text-gray-700">
              One Bottle Volume
            </th>
          )}
          <th className="py-3 px-4 text-center font-medium text-gray-700">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {stocks.length === 0 ? (
          <tr>
            <td
              colSpan={filterType === "bar" ? 4 : 3}
              className="text-center py-6 text-gray-500"
            >
              No stock found.
            </td>
          </tr>
        ) : (
          stocks.map((stock) => {
            const connectedItems = getConnectedItemNames(stock);
            const isConnected = connectedItems.length > 0;
            return (
              <tr key={stock.stockId} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4 font-medium text-gray-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{stock.stockName}</span>
                    {isConnected && (
                      <span
                        className="text-[10px] bg-amber-100 text-amber-800 font-medium px-1.5 py-0.5 rounded border border-amber-200"
                        title={`Connected to: ${connectedItems.join(", ")}`}
                      >
                        In {connectedItems.length} item{connectedItems.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-4 text-center">
                  {formatQuantity(stock, filterType)}
                </td>
                {filterType === "bar" && (
                  <td className="py-2 px-4 text-center">
                    {stock.oneBottleVolume || "N/A"}
                  </td>
                )}
                <td className="py-2 px-4">
                  <div className="flex gap-2 justify-center items-center">
                    <button
                      className="text-blue-600 hover:text-blue-800 transition-colors px-2 py-1 rounded border border-blue-600 hover:bg-blue-50"
                      onClick={() => onEdit(stock)}
                      title="Edit Stock"
                    >
                      <FaEdit />
                    </button>
                    <button
                      className={`transition-colors px-2 py-1 rounded border ${
                        isConnected
                          ? "text-gray-400 border-gray-300 hover:bg-gray-100 hover:text-gray-600 cursor-not-allowed"
                          : "text-red-600 border-red-600 hover:text-red-800 hover:bg-red-50"
                      }`}
                      onClick={() => onDelete(stock)}
                      title={
                        isConnected
                          ? `Connected to: ${connectedItems.join(", ")} (Cannot delete)`
                          : "Delete Stock"
                      }
                    >
                      <MdDeleteForever />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
};

export default StockTable;
