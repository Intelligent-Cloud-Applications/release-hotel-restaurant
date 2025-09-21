import { ArrowRightLeft } from "lucide-react";

const MoveItemsModal = ({
  selectedTable,
  destinationTable,
  setDestinationTable,
  availableTables,
  localBillItems,
  selectedItems,
  setSelectedItems,
  handleMoveItems,
  setShowMoveItemsModal,
  isLoading,
}) => {
  const handleItemSelect = (item, quantity) => {
    setSelectedItems((prev) => {
      const existingItem = prev.find((i) => i.itemId === item.itemId);
      if (existingItem) {
        if (quantity === 0) {
          return prev.filter((i) => i.itemId !== item.itemId);
        }
        return prev.map((i) =>
          i.itemId === item.itemId ? { ...i, quantity } : i
        );
      }
      if (quantity > 0) {
        return [...prev, { itemId: item.itemId, quantity, price: item.price,itemName:item.itemName,category:item.category,type:item.type,materials:item.materials,name:item.name || item.itemName,currency:item.currency,veg:item.veg }];
      }
      return prev;
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-w-full">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <ArrowRightLeft className="w-5 h-5 mr-2" />
          Move Items
        </h2>
        <p className="mb-2 text-sm text-gray-600">
          Move selected items from Table {selectedTable?.id} to another table
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source Table
          </label>
          <div className="p-2 border rounded bg-gray-100">
            {selectedTable?.id || "No table selected"}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Destination Table
          </label>
          <select
            value={destinationTable}
            onChange={(e) => setDestinationTable(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="">Select a table</option>
            {availableTables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.id}
              </option>
            ))}
          </select>
          {availableTables.length === 0 && (
            <p className="text-xs text-red-500 mt-1">
              No available tables for moving
            </p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Items to Move
          </label>
          {localBillItems.length > 0 ? (
            <div className="max-h-40 overflow-y-auto border rounded p-2">
              {localBillItems.map((item) => (
                <div key={item.itemId} className="flex items-center mb-2">
                  <input
                    type="number"
                    min="0"
                    max={item.quantity}
                    value={
                      selectedItems.find((i) => i.itemId === item.itemId)?.quantity || 0
                    }
                    onChange={(e) =>
                      handleItemSelect(item, parseInt(e.target.value) || 0)
                    }
                    className="w-16 p-1 border rounded mr-2"
                  />
                  <span className="text-sm">
                    {item.itemName || item.itemId} (Available: {item.quantity})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No items available to move</p>
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => {
              setShowMoveItemsModal(false);
              setSelectedItems([]);
              setDestinationTable("");
            }}
            className="px-4 py-2 border text-gray-700 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleMoveItems}
            disabled={!destinationTable || selectedItems.length === 0 || isLoading}
            className={`px-4 py-2 ${
              !destinationTable || selectedItems.length === 0 || isLoading
                ? "bg-gray-400"
                : "bg-blue-500 hover:bg-blue-600"
            } text-white rounded`}
          >
            {isLoading ? "Moving..." : "Move Items"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveItemsModal;