import { useEffect } from "react";

const CancelConfirmModal = ({
  selectedTable,
  isLoading,
  reason,
  setReason,
  handleCancelOrder,
  handleCancelModalClose,
  reasonTextareaRef,
}) => {
  // Auto-focus textarea when modal opens
  useEffect(() => {
    if (reasonTextareaRef.current) {
      reasonTextareaRef.current.focus();
    }
  }, [reasonTextareaRef]);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-80 max-w-full">
        <h2 className="text-lg font-semibold mb-4">Cancel Order</h2>
        <p className="mb-4 text-sm text-gray-600">
          Are you sure you want to cancel the order for Table {selectedTable?.id}?
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason (optional)
          </label>
          <textarea
            ref={reasonTextareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => console.log("Key pressed:", e.key, "Code:", e.code)}
            onCompositionStart={() => console.log("IME composition started")}
            onCompositionEnd={() => console.log("IME composition ended")}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter reason for cancelling (optional)"
            rows={3}
          />
        </div>

        <div className="flex justify-between">
          <button
            onClick={handleCancelModalClose}
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
};

export default CancelConfirmModal;