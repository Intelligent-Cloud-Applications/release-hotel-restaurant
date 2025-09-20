import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { API } from "aws-amplify";
import { X, User } from "lucide-react";

const StaffSelectionModal = ({
  showStaffSelectionModal,
  setShowStaffSelectionModal,
  selectedStaff,
  setSelectedStaff,
  staffData,
  selectedTable,
  institutionData,
  splitBillMode,
  selectedOrderId,
  fetchPendingOrders,
  setLoader,
}) => {
  const [useCustomStaff, setUseCustomStaff] = useState(false);
  const [customStaffName, setCustomStaffName] = useState("");
  const inputRef = useRef(null);

  // Debounced state update to reduce re-renders while typing
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Memoized handler for custom staff name change
  const handleCustomStaffChange = useCallback(
    debounce((value) => {
      setCustomStaffName(value);
      setSelectedStaff(""); // Clear dropdown selection
    }, 200),
    [setCustomStaffName, setSelectedStaff]
  );

  // Memoized handler for staff selection from dropdown
  const handleStaffSelection = useCallback(
    (e) => {
      setSelectedStaff(e.target.value);
      setCustomStaffName(""); // Clear custom name
    },
    [setSelectedStaff, setCustomStaffName]
  );

  // Focus input when switching to custom staff mode
  useEffect(() => {
    if (useCustomStaff && inputRef.current) {
      inputRef.current.focus();
    }
  }, [useCustomStaff]);

  const handleAssignStaff = async () => {
    const staffName = useCustomStaff ? customStaffName.trim() : selectedStaff;

    if (!staffName) {
      toast.error("Please select a staff member or enter a valid staff name.");
      return;
    }

    if (useCustomStaff && staffName.length < 2) {
      toast.error("Custom staff name must be at least 2 characters long.");
      return;
    }

    setLoader(true);
    try {
      const tableIdStr = String(selectedTable.id);
      const endpoint = `/admin/print-settle-bill/${institutionData.institution}/${tableIdStr}`;
      const body = {
        staffName,
        orderId: splitBillMode ? selectedOrderId : null,
        type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
      };

      await API.post("main", endpoint, { body });
      toast.success("Staff assigned to bill successfully.");
      setShowStaffSelectionModal(false);
      setSelectedStaff("");
      setCustomStaffName("");
      setUseCustomStaff(false);
      await fetchPendingOrders();
    } catch (error) {
      console.error("Error assigning staff to bill:", error);
      toast.error("Failed to assign staff. Please try again.");
    } finally {
      setLoader(false);
    }
  };

  if (!showStaffSelectionModal) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg relative max-w-md w-full">
        <button
          onClick={() => {
            setShowStaffSelectionModal(false);
            setCustomStaffName("");
            setUseCustomStaff(false);
            setSelectedStaff("");
          }}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-semibold mb-4">
          Select Staff for Bill Delivery
        </h2>
        <p className="mb-4">
          Please select the staff member who will deliver the bill to the
          customer or enter a custom staff name.
        </p>
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <label className="mr-4 text-sm font-medium text-gray-700">
              <input
                type="radio"
                checked={!useCustomStaff}
                onChange={() => {
                  setUseCustomStaff(false);
                  setCustomStaffName("");
                }}
                className="mr-2"
              />
              Select Existing Staff
            </label>
            <label className="text-sm font-medium text-gray-700">
              <input
                type="radio"
                checked={useCustomStaff}
                onChange={() => {
                  setUseCustomStaff(true);
                  setSelectedStaff("");
                }}
                className="mr-2"
              />
              Enter Custom Name
            </label>
          </div>

          <div className="relative">
            {useCustomStaff ? (
              <div className="relative">
                <User className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Enter staff name"
                  className="mt-1 block w-full pl-8 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={customStaffName}
                  onChange={(e) => handleCustomStaffChange(e.target.value)}
                />
              </div>
            ) : (
              <select
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={selectedStaff}
                onChange={handleStaffSelection}
              >
                <option value="">Select a staff member</option>
                {(staffData || []).map((staff) => (
                  <option key={staff.cognitoId} value={staff.userName}>
                    {staff.userName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => {
              setShowStaffSelectionModal(false);
              setCustomStaffName("");
              setUseCustomStaff(false);
              setSelectedStaff("");
            }}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssignStaff}
            disabled={!selectedStaff && !customStaffName.trim()}
            className={`px-4 py-2 ${
              selectedStaff || customStaffName.trim()
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-300"
            } border border-transparent rounded-md shadow-sm text-sm font-medium text-white`}
          >
            Assign Staff
          </button>
        </div>
      </div>
    </div>
  );
};
export default StaffSelectionModal;