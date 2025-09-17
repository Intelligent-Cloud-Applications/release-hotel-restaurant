"use client";
import { useState, useEffect, useContext } from "react";
import { API } from "aws-amplify";
import { toast } from "react-toastify";
import { ArrowRightLeft } from "lucide-react";
import { Context } from "../../../../Context";

const TabSelector = ({
  activeTab,
  setActiveTab,
  selectedTable,
  setSelectedTable,
  fetchPendingOrders,
  tables,
  setKOTByTable,
  setLocalBillItems,
  localBillItems,
  splitBillMode,
  setSplitBillMode,
  toggleSplitBillMode,
  KOTByTable,
}) => {
  const hasItems = localBillItems.length > 0;
  const { institutionData, userData } = useContext(Context);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [destinationTable, setDestinationTable] = useState("");
  const [availableTables, setAvailableTables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Check if user can cancel orders (admin with owner role)
  const canCancelOrders = userData?.userType === 'admin' && userData?.role === 'owner';

  useEffect(() => {
    if (tables && selectedTable) {
      const filtered = tables.filter(
        (table) =>
          table.id !== selectedTable.id &&
          (!KOTByTable?.[table.id]?.items?.length)
      );
      setAvailableTables(filtered);
    }
  }, [tables, selectedTable]);

  const handleSwapTable = async () => {
    if (!selectedTable || !destinationTable) {
      toast.error("Please select source and destination tables");
      return;
    }

    setIsLoading(true);
    try {
      await API.put(
        "main",
        `/admin/swap-table/${institutionData.institution}`,
        {
          body: {
            sourceTable: String(selectedTable.id),
            destinationTable: destinationTable,
          },
        }
      );
      setKOTByTable((prev) => ({
        ...prev,
        [String(selectedTable.id)]: null,
      }));
      setIsLoading(false);
      setShowSwapModal(false);
      toast.success(`Table ${selectedTable.id} moved to Table ${destinationTable}`);

      await fetchPendingOrders();
      setDestinationTable("");

      const newSelectedTable = tables.find((table) => table.id === destinationTable);
      if (newSelectedTable) {
        setSelectedTable(newSelectedTable);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error swapping tables:", error);
      toast.error("Failed to swap tables. Please try again.");
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedTable || !hasItems) {
      toast.error("No table or items selected to cancel");
      return;
    }

    setIsLoading(true);
    try {
      const response = await API.post(
        "main",
        `/admin/cancel-order/${institutionData.institution}`,
        {
          body: {
            tableName: String(selectedTable.id),
            institution: institutionData.institution,
          },
        }
      );
      setKOTByTable((prev) => ({
        ...prev,
        [String(selectedTable.id)]: null,
      }));
      setLocalBillItems([]); // Clear local bill items
      setIsLoading(false);
      setShowCancelConfirm(false);
      toast.success(`Order for Table ${selectedTable.id} cancelled successfully`);
      await fetchPendingOrders();
    } catch (error) {
      setIsLoading(false);
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order. Please try again.");
    }
  };

  const SwapModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-80 max-w-full">
        <h2 className="text-lg font-semibold mb-4">Move Table</h2>
        <p className="mb-2 text-sm text-gray-600">
          Move items from Table {selectedTable?.id} to another table
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Source Table
          </label>
          <div className="p-2 border rounded bg-gray-100">
            {selectedTable?.id || "No table selected"}
          </div>
        </div>

        <div className="mb-6">
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

        <div className="flex justify-between">
          <button
            onClick={() => setShowSwapModal(false)}
            className="px-4 py-2 border text-gray-700 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSwapTable}
            disabled={!destinationTable || isLoading}
            className={`px-4 py-2 ${
              !destinationTable || isLoading
                ? "bg-gray-400"
                : "bg-blue-500 hover:bg-blue-600"
            } text-white rounded`}
          >
            {isLoading ? "Moving..." : "Move Table"}
          </button>
        </div>
      </div>
    </div>
  );

  const CancelConfirmModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-80 max-w-full">
        <h2 className="text-lg font-semibold mb-4">Cancel Order</h2>
        <p className="mb-4 text-sm text-gray-600">
          Are you sure you want to cancel the order for Table {selectedTable?.id}?
        </p>
        <div className="flex justify-between">
          <button
            onClick={() => setShowCancelConfirm(false)}
            className="px-4 py-2 border text-gray-700 rounded hover:bg-gray-100"
          >
            No
          </button>
          <button
            onClick={handleCancelOrder}
            disabled={isLoading}
            className={`px-4 py-2 ${
              isLoading ? "bg-gray-400" : "bg-red-500 hover:bg-red-600"
            } text-white rounded`}
          >
            {isLoading ? "Cancelling..." : "Yes, Cancel"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 bg-gray-50">
        <div className="flex items-center">
          <span className="text-xs font-medium text-gray-700 mr-2">
            Table: {selectedTable?.id || "None"}
          </span>
          {selectedTable && (
            <div className="flex flex-row gap-2">
              <button
                onClick={() => setShowSwapModal(true)}
                className="flex items-center text-xs bg-white border border-gray-300 rounded px-2 py-1 hover:bg-gray-100"
                title="Move Table"
              >
                <ArrowRightLeft className="w-3 h-3 mr-1" />
                Move
              </button>
              {hasItems && (
                <button
                  onClick={toggleSplitBillMode}
                  className={`flex items-center text-xs px-1 py-0.5 rounded ${
                    hasItems
                      ? splitBillMode
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-yellow-500 text-white hover:bg-yellow-600"
                      : "bg-gray-400 text-white"
                  }`}
                  disabled={!hasItems}
                  title={splitBillMode ? "Exit Split Bill Mode" : "Enable Split Bill"}
                >
                  {splitBillMode ? "Exit Split Bill" : "Split Bill"}
                </button>
              )}
              {canCancelOrders && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className={`flex items-center text-xs px-1 py-0.5 rounded ${
                    hasItems
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-gray-400 text-white"
                  }`}
                  disabled={!hasItems}
                  title="Cancel Order"
                >
                  Cancel Order
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("KOT")}
          className={`flex-1 py-2 text-xs sm:text-sm font-medium ${
            activeTab === "KOT"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-500"
          }`}
        >
          KOT
        </button>
        <button
          onClick={() => setActiveTab("BILL")}
          className={`flex-1 py-2 text-xs sm:text-sm font-medium ${
            activeTab === "BILL"
              ? "border-b-2 border-blue-500 text-blue-500"
              : "text-gray-500"
          }`}
        >
          BILL
        </button>
      </div>

      {showSwapModal && <SwapModal />}
      {showCancelConfirm && <CancelConfirmModal />}
    </div>
  );
};

export default TabSelector;