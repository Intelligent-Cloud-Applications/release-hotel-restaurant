"use client";
import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { API } from "aws-amplify";
import { toast } from "react-toastify";
import { ArrowRightLeft } from "lucide-react";
import { Context } from "../../../../Context";
import CancelConfirmModal from "./CancelConfirmModal";
import MoveItemsModal from "./MoveItemsModal";

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
  const { institutionData, userData, hotelBookings } = useContext(Context);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showMoveItemsModal, setShowMoveItemsModal] = useState(false);
  const [destinationTable, setDestinationTable] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [availableTables, setAvailableTables] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [booking, setBooking] = useState(null);

  // Ref for textarea to manage focus
  const reasonTextareaRef = useRef(null);

  const canCancelOrders = userData?.userType === "admin";

  // Update available tables when tables or selectedTable changes
  useEffect(() => {
    if (tables && selectedTable) {
      const filtered = tables.filter(
        (table) => table.id !== selectedTable.id
      );
      setAvailableTables(filtered);
    }
  }, [tables, selectedTable]);

  // Set booking for hotel tables
  useEffect(() => {
    if (institutionData.integration === "HOTEL" && selectedTable?.name?.toLowerCase().startsWith("hotel ")) {
      const roomNumber = selectedTable.name.replace(/^hotel\s+/i, "");
      const matchingBooking = hotelBookings?.find((b) => String(b.roomNumber) === roomNumber);
      setBooking(matchingBooking || null);
    } else {
      setBooking(null);
    }
  }, [selectedTable, hotelBookings, institutionData.integration]);

  // Memoized handler for reason input changes
  const handleReasonChange = useCallback((e) => {
    setReason(e.target.value);
  }, []);

  // Memoized handler for moving items
  const handleMoveItems = useCallback(async () => {
    if (!selectedTable || !destinationTable || selectedItems.length === 0) {
      toast.error("Please select source table, destination table, and items to move");
      return;
    }

    setIsLoading(true);
    try {
      await API.put("main", `/admin/move-items-table/${institutionData.institution}`, {
        body: {
          sourceTable: String(selectedTable.id),
          destinationTable: String(destinationTable),
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
          items: selectedItems,
        },
      });
      setKOTByTable((prev) => ({
        ...prev,
        [String(selectedTable.id)]: null,
      }));
      setLocalBillItems((prev) =>
        prev.reduce((acc, item) => {
          const movedItem = selectedItems.find((i) => i.itemId === item.itemId);
          if (movedItem) {
            const remainingQuantity = item.quantity - movedItem.quantity;
            if (remainingQuantity > 0) {
              acc.push({ ...item, quantity: remainingQuantity });
            }
          } else {
            acc.push(item);
          }
          return acc;
        }, [])
      );
      setIsLoading(false);
      setShowMoveItemsModal(false);
      toast.success(
        `Items moved from Table ${selectedTable.id} to Table ${destinationTable}`
      );

      await fetchPendingOrders();
      setDestinationTable("");
      setSelectedItems([]);

      const newSelectedTable = tables.find(
        (table) => table.id === destinationTable
      );
      if (newSelectedTable) {
        setSelectedTable(newSelectedTable);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error moving items:", error);
      toast.error("Failed to move items. Please try again.");
    }
  }, [
    selectedTable,
    destinationTable,
    selectedItems,
    institutionData,
    setKOTByTable,
    setLocalBillItems,
    fetchPendingOrders,
    tables,
    setSelectedTable,
  ]);

  // Memoized handler for swapping entire tables
  const handleSwapTable = useCallback(async () => {
    if (!selectedTable || !destinationTable) {
      toast.error("Please select source and destination tables");
      return;
    }

    setIsLoading(true);
    try {
      await API.put("main", `/admin/swap-table/${institutionData.institution}`, {
        body: {
          sourceTable: String(selectedTable.id),
          destinationTable: String(destinationTable),
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });
      setKOTByTable((prev) => ({
        ...prev,
        [String(selectedTable.id)]: null,
      }));
      setIsLoading(false);
      setShowSwapModal(false);
      toast.success(
        `Table ${selectedTable.id} moved to Table ${destinationTable}`
      );

      await fetchPendingOrders();
      setDestinationTable("");

      const newSelectedTable = tables.find(
        (table) => table.id === destinationTable
      );
      if (newSelectedTable) {
        setSelectedTable(newSelectedTable);
      }
    } catch (error) {
      setIsLoading(false);
      console.error("Error swapping tables:", error);
      toast.error("Failed to swap tables. Please try again.");
    }
  }, [
    selectedTable,
    destinationTable,
    institutionData,
    setKOTByTable,
    fetchPendingOrders,
    tables,
    setSelectedTable,
  ]);

  // Memoized handler for cancelling orders
  const handleCancelOrder = useCallback(async () => {
    if (!selectedTable || !hasItems) {
      toast.error("No table or items selected to cancel");
      return;
    }

    setIsLoading(true);
    try {
      await API.post(
        "main",
        `/admin/cancel-order/${institutionData.institution}`,
        {
          body: {
            tableName: String(selectedTable.id),
            institution: institutionData.institution,
            type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
            reason: reason.trim() || "No reason provided",
          },
        }
      );
      const isHotelTable = selectedTable.id?.toLowerCase().startsWith("hotel");
      if (isHotelTable && booking) {
        await API.put(
          "frontdesk",
          `/offline/amend-booking/${booking?.bookingId}?institutionId=${institutionData.institution}`,
          {
            body: {
              bookingData: {
                booking_id: booking?.bookingId,
                restaurant_hold: false,
              },
              guestDetailsData: {
                guest_id: booking?.guest_id,
              },
            },
          }
        );
      }
      setKOTByTable((prev) => ({
        ...prev,
        [String(selectedTable.id)]: null,
      }));
      setLocalBillItems([]);
      setIsLoading(false);
      setShowCancelConfirm(false);
      toast.success(`Order for Table ${selectedTable.id} cancelled successfully`);

      setReason("");
      await fetchPendingOrders();
    } catch (error) {
      setIsLoading(false);
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order. Please try again.");
    }
  }, [
    selectedTable,
    hasItems,
    institutionData,
    reason,
    setKOTByTable,
    setLocalBillItems,
    fetchPendingOrders,
    booking,
  ]);

  // Memoized handler for closing cancel modal
  const handleCancelModalClose = useCallback(() => {
    setShowCancelConfirm(false);
    setReason("");
  }, []);

  // Modal for swapping entire tables
  const SwapModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-80 max-w-full">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <ArrowRightLeft className="w-5 h-5 mr-2" />
          Move Table
        </h2>
        <p className="mb-2 text-sm text-gray-600">
          Move all items from Table {selectedTable?.id} to another table
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
              <button
                onClick={() => setShowMoveItemsModal(true)}
                className="flex items-center text-xs bg-white border border-gray-300 rounded px-2 py-1 hover:bg-gray-100"
                title="Move Items"
                disabled={!hasItems}
              >
                <ArrowRightLeft className="w-3 h-3 mr-1" />
                Items
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
      {showMoveItemsModal && (
        <MoveItemsModal
          selectedTable={selectedTable}
          destinationTable={destinationTable}
          setDestinationTable={setDestinationTable}
          availableTables={availableTables}
          localBillItems={localBillItems}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          handleMoveItems={handleMoveItems}
          setShowMoveItemsModal={setShowMoveItemsModal}
          isLoading={isLoading}
        />
      )}
      {showCancelConfirm && (
        <CancelConfirmModal
          selectedTable={selectedTable}
          isLoading={isLoading}
          reason={reason}
          setReason={setReason}
          handleCancelOrder={handleCancelOrder}
          handleCancelModalClose={handleCancelModalClose}
          reasonTextareaRef={reasonTextareaRef}
        />
      )}
    </div>
  );
};

export default TabSelector;