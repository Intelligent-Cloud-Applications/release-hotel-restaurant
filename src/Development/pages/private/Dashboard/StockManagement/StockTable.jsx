import { FaEdit } from "react-icons/fa";
import { MdDeleteForever } from "react-icons/md";

// Helper function to format quantity
const formatQuantity = (stock, filterType) => {
  const quantity = parseInt(stock.quantity, 10);

  if (filterType === "cafe") {
    if (stock.quantity.includes("g")) {
      const kg = Math.floor(quantity / 1000);
      const gm = quantity % 1000;
      return `${kg > 0 ? kg + " kg " : ""}${gm > 0 ? gm + " g" : ""}`.trim();
    }
    if (stock.quantity.includes("ml")) {
      const l = Math.floor(quantity / 1000);
      const ml = quantity % 1000;
      return `${l > 0 ? l + " l " : ""}${ml > 0 ? ml + " ml" : ""}`.trim();
    }
    return stock.quantity; // for pieces or others
  }

  if (filterType === "bar") {
    const bottleVol = parseInt(stock.oneBottleVolume, 10) || 1000; // default 1000 ml
    const bottles = Math.floor(quantity / bottleVol);
    const remaining = quantity % bottleVol;
    return `${bottles > 0 ? bottles + " bottle " : ""}${remaining > 0 ? remaining + " ml" : ""}`.trim();
  }

  return stock.quantity;
};

// StockTable Component
const StockTable = ({ stocks, onEdit, onDelete }) => {
  const filterType = stocks[0]?.type || "cafe";
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
          stocks.map((stock) => (
            <tr key={stock.stockId} className="border-b hover:bg-gray-50">
              <td className="py-2 px-4">{stock.stockName}</td>
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
                  >
                    <FaEdit />
                  </button>
                  {/* <button
                    className="text-red-600 hover:text-red-800 transition-colors px-2 py-1 rounded border border-red-600 hover:bg-red-50"
                    onClick={() => onDelete(stock.stockId)}
                  >
                    <MdDeleteForever />
                  </button> */}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
};

export default StockTable;
