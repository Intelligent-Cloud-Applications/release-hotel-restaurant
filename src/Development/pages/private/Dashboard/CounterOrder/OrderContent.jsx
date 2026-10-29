"use client";
import { User, Phone, X, MoveRight, ChevronDown, ChevronUp, AlertTriangle, Clock, Bluetooth, Printer, Percent, DollarSign } from "lucide-react";
import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import PrintKOT from "./PrintKOT";
import PrintBill from "./PrintBill";
import ReprintKOT from "./ReprintKOT";
import data from "../../../../../Operation/data.json";
import OrderPaymentModal from "./OrderPaymentModal";
import StaffSelectionModal from "./StaffSelectionModal";
import DiscountSection from "./DiscountSection";
import UnpaidOrderPaymentModal from "./UnpaidOrderPaymentModal";
const OrderContent = ({
  selectedTable,
  setSelectedTable,
  KOTByTable,
  setKOTByTable,
  customerDetails,
  setCustomerDetails,
  updateItemQuantity,
  addItemToMerged,
  removeItemFromKOT,
  kotcurrent,
  total,
  cgst,
  sgst,
  serviceTax,
  institutionData,
  activeTab,
  setActiveTab,
  printAllItems,
  setPrintAllItems,
  printKOT,
  printBill,
  setShowModal,
  saveKOT,
  settleBill,
  billItems,
  localBillItems,
  setLocalBillItems,
  fetchTableData,
  bluetoothConnected,
  bluetoothDeviceName,
  connectBluetooth,
  printBluetooth,
  currentTableData,
  fetchPendingOrders,
  splitBillMode,
  setSplitBillMode,
  orderGroups,
  setOrderGroups,
  selectedOrderId,
  setSelectedOrderId,
  toggleSplitBillMode,
  showReprintKOT,
  setShowReprintKOT,
  unpaidOrders = [],
  settleUnpaidOrder,
  discountData,
  setDiscountData,
  tableInstructions,
  setTableInstructions,
}) => {
  const { printerType, printerpaperSize } = data;
  const { staffData, fetchStaffData, setLoader, hotelBookings, nextBillNumber, fetchNextBillNumber } = useContext(Context);
  const screenWidth = window.innerWidth;
  // Existing state variables
  const [orderRoomSelection, setOrderRoomSelection] = useState({});
  const [showOrderPaymentModal, setShowOrderPaymentModal] = useState(false);
  const [showUnpaidOrderPaymentModal, setShowUnpaidOrderPaymentModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState("local");
  const [showPrintBill, setShowPrintBill] = useState(false);
  const [showStaffSelectionModal, setShowStaffSelectionModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [movingItem, setMovingItem] = useState(null);
  const [targetOrderId, setTargetOrderId] = useState(null);
  const [isUnpaidOrdersOpen, setIsUnpaidOrdersOpen] = useState(false);
  const [selectedUnpaidOrder, setSelectedUnpaidOrder] = useState(null);
  // New state for day session
  const [selectedDaySession, setSelectedDaySession] = useState("breakfast");
  // State for custom name input when "custom" is selected
  const [isCustomName, setIsCustomName] = useState(false);
  // Day session options
  const daySessionOptions = [
    { value: "breakfast", label: "Breakfast" },
    { value: "lunch", label: "Lunch" },
    { value: "dinner", label: "Dinner" },
    { value: "snacks", label: "Snacks" },
    { value: "late-night", label: "Late Night" },
  ];
  // Management customer options
  const managementCustomerOptions = [
    { value: "Md Sir", label: "Md Sir" },
    { value: "GM Sir", label: "GM Sir" },
    { value: "Md House", label: "Md House" },
    { value: "House Guest", label: "House Guest" },
    { value: "Room Compliment", label: "Room Compliment" },
    { value: "Account Staff", label: "Account Staff" },
    { value: "Md Guest", label: "Md Guest" },
    { value: "F.O.M", label: "F.O.M" },
    { value: "HK EXE", label: "HK EXE" },
    { value: "HR Manager", label: "HR Manager" },
    { value: "Guest Entartaintment", label: "Guest Entartaintment" },
    { value: "Ac Manager", label: "Ac Manager" },
    { value: "Maintanence Eng", label: "Maintanence Eng" },
    { value: "EXE Chef", label: "EXE Chef" },
    { value: "C.M.D Sir", label: "C.M.D Sir" },
    { value: "Hotel Staff Food", label: "Hotel Staff Food" },
    { value: "Store Keeper", label: "Store Keeper" },
    { value: "Maintanence", label: "Maintanence" },
    { value: "Sales Manager", label: "Sales Manager" },
    { value: "F.O Executive", label: "F.O Executive" },
    { value: "EDP", label: "EDP" },
    { value: "F&B Manager", label: "F&B Manager" },
    { value: "Town Thana", label: "Town Thana" },
    { value: "Police Staff", label: "Police Staff" },
    { value: "custom", label: "Custom" },
  ];
  // Use refs to prevent input focus loss
  const discountValueInputRef = useRef(null);
  // Load day session from localStorage on component mount
  useEffect(() => {
    const loadDaySession = () => {
      try {
        const savedSession = localStorage.getItem(`daySession_${institutionData?.institution}_${selectedTable?.id || 'global'}`);
        if (savedSession && daySessionOptions.find(option => option.value === savedSession)) {
          setSelectedDaySession(savedSession);
        } else {
          // Set default to breakfast if no valid session found
          setSelectedDaySession("breakfast");
        }
      } catch (error) {
        console.error("Error loading day session from localStorage:", error);
        setSelectedDaySession("breakfast");
      }
    };
    if (institutionData?.institution) {
      loadDaySession();
    }
  }, [institutionData?.institution, selectedTable?.id]);
  // Save day session to localStorage when it changes
  useEffect(() => {
    const saveDaySession = () => {
      try {
        if (institutionData?.institution) {
          const tableKey = `daySession_${institutionData.institution}_${selectedTable?.id || 'global'}`;
          const globalKey = `daySession_${institutionData.institution}_global`;
        
          // Remove existing day session for this table/institution
          localStorage.removeItem(tableKey);
          localStorage.removeItem(globalKey);
        
          // Save new day session
          localStorage.setItem(tableKey, selectedDaySession);
          localStorage.setItem(globalKey, selectedDaySession);
        
          console.log(`Day session saved: ${selectedDaySession} for institution ${institutionData.institution}, table ${selectedTable?.id || 'global'}`);
        }
      } catch (error) {
        console.error("Error saving day session to localStorage:", error);
        toast.error("Failed to save day session settings");
      }
    };
    if (institutionData?.institution && selectedDaySession) {
      saveDaySession();
    }
  }, [selectedDaySession, institutionData?.institution, selectedTable?.id]);
  // Handle day session change
  const handleDaySessionChange = (newSession) => {
    if (newSession !== selectedDaySession) {
      // Show confirmation if there are existing items
      const hasItems = (kotcurrent?.items || localBillItems || []).length > 0;
      if (hasItems) {
        const currentSessionName = daySessionOptions.find(s => s.value === selectedDaySession)?.label || selectedDaySession;
        const newSessionName = daySessionOptions.find(s => s.value === newSession)?.label || newSession;
        const confirmChange = window.confirm(
          `Changing day session from ${currentSessionName} to ${newSessionName} will affect menu availability. Continue?`
        );
      
        if (!confirmChange) {
          return;
        }
      }
    
      setSelectedDaySession(newSession);
      toast.success(`Day session changed to ${daySessionOptions.find(s => s.value === newSession)?.label || newSession}`);
    
      // Optional: Refresh table data to reflect new day session menu items
      if (selectedTable?.id && fetchTableData) {
        fetchTableData(String(selectedTable.id));
      }
    }
  };
  // Reset instruction states when table changes
  useEffect(() => {
    setInstructionStates({});
    if (fetchNextBillNumber) {
      fetchNextBillNumber();
    }
  }, [selectedTable?.id]);

  // Get current day session display name
  const getCurrentDaySessionName = () => {
    const current = daySessionOptions.find(option => option.value === selectedDaySession);
    return current ? current.label : selectedDaySession.toUpperCase();
  };
  // Helper function to get current discount info
  const getCurrentDiscountInfo = () => {
    if (!selectedTable) return { method: "none", value: 0, amount: 0 };
    const tableIdStr = String(selectedTable.id);
    const tableDiscountData = discountData[tableIdStr];
    if (!tableDiscountData) return { method: "none", value: 0, amount: 0 };
    if (splitBillMode && selectedOrderId) {
      return tableDiscountData[selectedOrderId] || { method: "none", value: 0, amount: 0 };
    }
    if (typeof tableDiscountData === 'object' && !tableDiscountData.method) {
      const firstOrderId = Object.keys(tableDiscountData)[0];
      return tableDiscountData[firstOrderId] || { method: "none", value: 0, amount: 0 };
    }
    return tableDiscountData;
  };
  // Helper function to set discount info
  const setCurrentDiscountInfo = (discountInfo) => {
    if (!selectedTable) return;
    const tableIdStr = String(selectedTable.id);
    setDiscountData((prev) => {
      const newData = { ...prev };
      if (splitBillMode && selectedOrderId) {
        newData[tableIdStr] = {
          ...newData[tableIdStr],
          [selectedOrderId]: { ...discountInfo },
        };
      } else {
        newData[tableIdStr] = { ...discountInfo };
      }
      return newData;
    });
  };
  const totalKotQuantity = (kotcurrent?.items || kotcurrent?.billItems || []).reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  useEffect(() => {
    const newItems = billItems || [];
    setLocalBillItems((prev) => {
      if (!prev || prev.length !== newItems.length) return newItems;
      for (let i = 0; i < prev.length; i++) {
        if (
          prev[i].itemId !== newItems[i]?.itemId ||
          prev[i].quantity !== newItems[i]?.quantity
        ) {
          return newItems;
        }
      }
      return prev;
    });
  }, [billItems, setLocalBillItems]);
  useEffect(() => {
    if (bluetoothConnected) {
      setPrintMode("bluetooth");
    }
  }, [bluetoothConnected]);
  useEffect(() => {
    if (!staffData || staffData.length === 0) {
      fetchStaffData();
    }
  }, [fetchStaffData]);
  // Update isCustomName based on customerDetails
  useEffect(() => {
    if (selectedTable?.id) {
      const currentName = customerDetails[selectedTable.id]?.name || "";
      const isManagementTable = selectedTable?.id?.toString().toLowerCase().startsWith("management");
      const isPredefined = managementCustomerOptions.some(option => option.value === currentName);
      setIsCustomName(isManagementTable && currentName && !isPredefined);
    }
  }, [customerDetails, selectedTable?.id]);
  const tableUnpaidOrders = selectedTable
    ? unpaidOrders.filter((order) => String(order.tableName) === String(selectedTable.id))
    : [];
  const getKOTNumber = (tableId) => {
    const today = new Date().toISOString().split("T")[0];
    let kotData = JSON.parse(localStorage.getItem("kotOrders")) || {
      date: today,
      lastKOT: 0,
      kotTables: {},
    };
    if (kotData.date !== today) {
      kotData = { date: today, lastKOT: 0, kotTables: {} };
    }
    if (kotData.kotTables[tableId]) {
      return kotData.kotTables[tableId];
    }
    const newKOT = kotData.lastKOT + 1;
    kotData.kotTables[tableId] = newKOT;
    kotData.lastKOT = newKOT;
    localStorage.setItem("kotOrders", JSON.stringify(kotData));
    return newKOT;
  };
  const handleUnpaidPaymentMethodChange = (order, value) => {
    const method = (value || "").toString().trim().toUpperCase();
    if (method === "ROOM") {
      const firstBooking = hotelBookings && hotelBookings.length > 0 ? hotelBookings[0] : null;
      setOrderRoomSelection((prev) => ({
        ...prev,
        [order.orderId]: firstBooking ? firstBooking.bookingId : "",
      }));
      handleSettleUnpaidOrder(order, method);
    } else {
      handleSettleUnpaidOrder(order, method);
    }
  };
  const handleProceedRoomSettlement = (order) => {
    const selectedBookingId = orderRoomSelection[order.orderId];
    const booking = (hotelBookings || []).find((b) => b.bookingId === selectedBookingId) || null;
    const roomNumber = booking ? String(booking.roomNumber) : formatOrderTableLabel(order);
    handleSettleUnpaidOrder(order, "ROOM", { bookingId: selectedBookingId, roomNumber });
  };
  const formatOrderTableLabel = (order) => {
    return order.tableName || "N/A";
  };
 const calculateTotals = (items) => {
  const billSubtotal = items.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    return sum + price * quantity;
  }, 0);
  // Updated: Exclude 'bar' type AND 'No Tax Beverage' category from taxable subtotal
  const taxableSubtotal = items.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    const isTaxable = item.type !== "bar" && item.category !== "No Tax Beverage";
    return sum + (isTaxable ? price * quantity : 0);
  }, 0);
  const cgstRate = institutionData?.cgst ?? 2.5;
  const sgstRate = institutionData?.sgst ?? 2.5;
  const serviceTaxRate = institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0;
  const discountInfo = getCurrentDiscountInfo();
  let discountAmount = 0;
  let discountPercentage = 0;
  if (discountInfo.method === "percentage" && discountInfo.value > 0) {
    discountPercentage = Math.min(Number(discountInfo.value), 100);
    discountAmount = (billSubtotal * discountPercentage) / 100;
  } else if (discountInfo.method === "amount" && discountInfo.value > 0) {
    discountAmount = Math.min(Number(discountInfo.value), billSubtotal);
  }
  const discountedSubtotal = billSubtotal - discountAmount;
  // Updated: Apply discount to taxable subtotal (prorate or cap at taxable amount)
  const discountedTaxableSubtotal = Math.max(0, taxableSubtotal - Math.min(discountAmount, taxableSubtotal));
  const cgst = (discountedTaxableSubtotal * cgstRate) / 100;
  const sgst = (discountedTaxableSubtotal * sgstRate) / 100;
  const serviceTax = (discountedSubtotal * serviceTaxRate) / 100;
  const finalTotal =
    institutionData?.cgst === 0 || institutionData?.sgst === 0
      ? Math.round(discountedSubtotal + serviceTax)
      : Math.round(discountedSubtotal + cgst + sgst + serviceTax);
  return {
    billSubtotal,
    taxableSubtotal,
    cgst,
    sgst,
    serviceTax,
    finalTotal,
    serviceTaxRate,
    discountAmount,
    discountPercentage,
    discountMethod: discountInfo.method,
  };
};
  const handleDiscountMethodChange = (method) => {
    const currentInfo = getCurrentDiscountInfo();
    setCurrentDiscountInfo({
      method,
      value: method === "none" ? 0 : currentInfo.value,
      amount: method === "none" ? 0 : currentInfo.amount,
    });
  };
  const handleDiscountValueChange = (value) => {
    const currentInfo = getCurrentDiscountInfo();
    const newValue = Number(value) || 0;
    let discountAmount = 0;
    if (currentInfo.method === "percentage") {
      const items = splitBillMode
        ? (orderGroups.find((g) => g.orderId === selectedOrderId)?.items || [])
        : localBillItems;
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      discountAmount = (subtotal * newValue) / 100;
    } else if (currentInfo.method === "amount") {
      discountAmount = newValue;
    }
    setCurrentDiscountInfo({
      method: currentInfo.method,
      value: newValue,
      amount: discountAmount,
    });
  };
  // New function to update order items via API (without loader for incremental updates)
  const updateOrderItems = async (items, orderId = null) => {
    if (!selectedTable) return;
     setLoader(true);
    const tableIdStr = String(selectedTable.id);
    try {
      const endpoint = orderId
        ? `/admin/orderId-save/${institutionData.institution}/${tableIdStr}/${orderId}`
        : `/admin/orders-items/${institutionData.institution}/${tableIdStr}`;
      const discountInfo = getCurrentDiscountInfo();
      const { cgst, sgst, serviceTax, discountAmount, discountPercentage, discountMethod } = calculateTotals(items);
      await API.put("main", endpoint, {
        body: {
          items,
          serviceTaxPercentage: institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0,
          cgstPercentage: institutionData?.cgst ?? 2.5,
          sgstPercentage: institutionData?.sgst ?? 2.5,
          discountMethod: discountInfo.method,
          discountValue: discountInfo.value,
          discountPercentage: discountInfo.method === "percentage" ? discountInfo.value : 0,
          discountAmount,
          cgst,
          sgst,
          serviceTax,
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });
      if (!orderId) {
        const billEndpoint = `/admin/orders-bill/${institutionData.institution}/${tableIdStr}`;
        await API.post("main", billEndpoint, {
          body: { items, type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe" },
        });
      }
      if (fetchPendingOrders) {
        await fetchPendingOrders();
      }
    } catch (error) {
      console.error("Error updating order items:", error);
      toast.error("Failed to update items. Please try again.");
    }
    finally {
      setLoader(false);
    }
  };
  const formatKOT = () => {
    const formatDateTime = () => {
      const now = new Date();
      return now
        .toLocaleString("en-IN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        .replace(",", "");
    };
    const orderType = !isNaN(selectedTable?.id)
      ? "Dine In"
      : selectedTable?.id.toLowerCase().startsWith("takeaway")
      ? "Takeaway"
      : "Dine In";
    const kotNo = getKOTNumber(selectedTable?.id) || "N/A";
    const items = kotcurrent?.items || [];
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const lineWidth = printerpaperSize === "80" ? 68 : 38;
    const itemNameLength = lineWidth - 5;
    const headerFont = "\x1B\x4D\x00";
    const itemFont = printerpaperSize === "80" ? "\x1B\x4D\x00" : "\x1B\x4D\x01";
    const resetFont = "\x1D\x21\x00";
    let kot = "";
    kot += `\x1B\x61\x01${headerFont}`;
    kot += `KOT No: ${kotNo}\n`;
    kot += `${orderType}\n`;
    kot += `Session: ${getCurrentDaySessionName()}\n`; // Added day session
    kot += `Date: ${formatDateTime()}\n`;
    kot += `Table: ${selectedTable?.id || "N/A"}\n`;
    kot += `\x1B\x61\x00${resetFont}${itemFont}`;
    kot += `${"-".repeat(lineWidth)}\n`;
    kot += `Item${" ".repeat(lineWidth - 4 - 3)}Qty\n`;
    kot += `${"-".repeat(lineWidth)}\n`;
    items.forEach((item) => {
      const itemName = item.itemName || item.name;
      const qty = item.quantity.toString().padStart(4, " ");
      if (itemName.length <= itemNameLength) {
        kot += `${itemName.padEnd(itemNameLength)}${qty}\n`;
      } else {
        const chunks = itemName.match(new RegExp(`.{1,${itemNameLength}}`, "g"));
        chunks.forEach((chunk, index) => {
          if (index === 0) {
            kot += `${chunk.padEnd(itemNameLength)}${qty}\n`;
          } else {
            kot += `${chunk}\n`;
          }
        });
      }
      
      // Add item instruction if present
      if (item.instruction && item.instruction.trim()) {
        const instructionText = `-> ${item.instruction}`;
        if (instructionText.length <= lineWidth) {
          kot += `${instructionText}\n`;
        } else {
          const instructionChunks = instructionText.match(new RegExp(`.{1,${lineWidth}}`, "g"));
          instructionChunks.forEach((chunk) => {
            kot += `${chunk}\n`;
          });
        }
      }
    });
    kot += `\x1B\x61\x01`;
    kot += `${"-".repeat(lineWidth)}\n`;
    kot += `Total Qty: ${totalQty}\n`;
    
    // Add table instruction if present
    const tableIdStr = String(selectedTable?.id);
    const tableInstruction = tableInstructions?.[tableIdStr] || "";
    if (tableInstruction && tableInstruction.trim()) {
      kot += `\nSpecial Instructions:\n`;
      if (tableInstruction.length <= lineWidth) {
        kot += `${tableInstruction}\n`;
      } else {
        const chunks = tableInstruction.match(new RegExp(`.{1,${lineWidth}}`, "g"));
        chunks.forEach((chunk) => {
          kot += `${chunk}\n`;
        });
      }
    }
    
    kot += `${"-".repeat(lineWidth)}\n`;
    kot += `${resetFont}\n\n\n`;
    return kot;
  };
  const centerText = (text, width) => {
    const textLength = text.length;
    if (textLength >= width) return text.substring(0, width);
    const padding = Math.floor((width - textLength) / 2);
    return " ".repeat(padding) + text + " ".repeat(width - textLength - padding);
  };
const formatBill = (orderItems, customerId) => {
  const gstShow = institutionData?.gstshow ?? false;
  const lineWidth = printerpaperSize === "80" ? 68 : 38;
  const itemNameLength = Math.floor(lineWidth * 0.55);
  const qtyLength = 4;
  const rateLength = 6;
  const totalLength = lineWidth - itemNameLength - qtyLength - rateLength - 3;
  const headerFont = printerpaperSize === "80" ? "\x1B\x4D\x00" : "\x1B\x4D\x00";
  const itemFont = printerpaperSize === "80" ? "\x1B\x4D\x00" : "\x1B\x4D\x01";
  const resetFont = "\x1D\x21\x00";
  const justifyBetween = (leftText, rightText, width = lineWidth) => {
    const totalLength = leftText.length + rightText.length;
    if (totalLength >= width) return `${leftText}${rightText}`.substring(0, width);
    const spaceBetween = width - totalLength;
    return `${leftText}${" ".repeat(spaceBetween)}${rightText}`;
  };
  const formatDateTime = () => {
    const now = new Date();
    return now
      .toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .replace(",", "");
  };
  const items = orderItems || localBillItems;
  const {
    billSubtotal,
    taxableSubtotal,
    cgst,
    sgst,
    serviceTax,
    finalTotal,
    discountAmount,
    discountPercentage,
    discountMethod,
  } = calculateTotals(items);
  let adjustedCgst = cgst;
  let adjustedSgst = sgst;
  let adjustedFinalTotal = finalTotal;
  if (!gstShow) {
    adjustedCgst = 0;
    adjustedSgst = 0;
    adjustedFinalTotal = Math.round(billSubtotal + serviceTax);
  }
  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  let bill = `\x1B\x61\x01${headerFont}`;
  bill += `${institutionData?.companyName || "The Chai Theka"}\n`;
  bill += `${institutionData?.Query_Address || "BhawaniPeth"}\n`;
  bill += `Contact: ${institutionData?.Query_PhoneNumber || "+917008120727"}\n`;
  bill += `Date: ${formatDateTime()}\n`;
  bill += `Session: ${getCurrentDaySessionName()}\n`; // Added day session
  bill += `${gstShow && institutionData?.gstin ? `GSTIN: ${institutionData.gstin}\n` : ""}`;
  bill += `Table: ${selectedTable?.id || "N/A"}\n`;
  const firstOrderForBt = Object.values(currentTableData?.orders || {})[0];
  const activeBillNoForBt = customerId
    ? orderGroups?.find(g => g.orderId === customerId)?.billNo || nextBillNumber
    : firstOrderForBt?.billNo || firstOrderForBt?.billNumber || nextBillNumber;
  if (activeBillNoForBt) {
    bill += `Bill No: ${activeBillNoForBt}\n`;
  }
  if (splitBillMode && customerId) {
    bill += `Order ID: ${customerId}\n`;
  }
  bill += `${resetFont}${itemFont}${centerText(`-`.repeat(lineWidth), lineWidth)}\n`;
  bill += `Item${" ".repeat(itemNameLength - 4)}Qty Rate Total\n`;
  bill += `${centerText(`-`.repeat(lineWidth), lineWidth)}\n`;
  items.forEach((item) => {
    const itemName = (item.itemName || item.name || "Unknown")
      .substring(0, itemNameLength)
      .padEnd(itemNameLength, " ");
    const qty = (Number(item.quantity) || 0).toString().padStart(qtyLength, " ");
    const price = Number(item.price) || 0;
    const rate = (price % 1 === 0 ? price : price.toFixed(2))
      .toString()
      .padStart(rateLength, " ");
    const totalValue = price * (Number(item.quantity) || 0);
    const total = (totalValue % 1 === 0 ? totalValue : totalValue.toFixed(2))
      .toString()
      .padStart(totalLength, " ");
    const line = `${itemName}${qty}${rate}${total}`;
    bill += `${line}\n`;
    if ((item.itemName || item.name || "").length > itemNameLength) {
      const remaining = (item.itemName || item.name || "").substring(itemNameLength);
      const chunks = remaining.match(new RegExp(`.{1,${itemNameLength}}`, "g")) || [];
      chunks.forEach((chunk) => {
        bill += `${chunk.padEnd(itemNameLength)}${" ".repeat(lineWidth - itemNameLength)}\n`;
      });
    }
  });
  bill += `${resetFont}${centerText(`-`.repeat(lineWidth), lineWidth)}\n`;
  bill += `${justifyBetween("Total Qty:", `${totalQty}`)}\n`;
  if (gstShow && institutionData.cgst !== 0 && institutionData.sgst !== 0) {
    bill += `${justifyBetween("Subtotal:", `₹${billSubtotal.toFixed(2)}`)}\n`;
  }
  if (discountAmount > 0) {
    if (discountMethod === "percentage") {
      bill += `${justifyBetween(`Discount (${discountPercentage}%):`, `-₹${discountAmount.toFixed(2)}`)}\n`;
    } else if (discountMethod === "amount") {
      bill += `${justifyBetween("Discount (Fixed):", `-₹${discountAmount.toFixed(2)}`)}\n`;
    }
  }
  if (gstShow) {
    bill += `${justifyBetween("CGST:", `₹${adjustedCgst.toFixed(2)}`)}\n`;
    bill += `${justifyBetween("SGST:", `₹${adjustedSgst.toFixed(2)}`)}\n`;
  }
  if (serviceTax > 0) {
    bill += `${justifyBetween(`Service Tax (${institutionData?.serviceTax ?? 0}%):`, `₹${serviceTax.toFixed(2)}`)}\n`;
  }
  bill += `${justifyBetween("Total (Rounded):", `₹${adjustedFinalTotal.toFixed(2)}`)}\n`;
  bill += `${centerText(`-`.repeat(lineWidth), lineWidth)}\n`;
  bill += `Thanks for visiting!\n`;
  bill += `\x1B\x34`;
  bill += `Empower your business with tekkzy.com\n`;
  bill += `\x1B\x35`;
  bill += `${resetFont}\n\n\n`;
  return bill;
};
  const handlePrintBill = async () => {
    if (splitBillMode) {
      if (!selectedOrderId) {
        toast.error("Please select an order to print.");
     return;
      }
      const selectedOrder = orderGroups.find((group) => group.orderId === selectedOrderId);
      if (!selectedOrder || !selectedOrder.items.length) {
        toast.error("No items to print in selected order.");
        return;
      }
      await saveBill(selectedTable, selectedOrder.items, selectedOrderId);
      if (printMode === "bluetooth" && bluetoothConnected) {
        const billData = formatBill(selectedOrder.items, selectedOrderId);
        console.log("Attempting Bluetooth print for split Bill...");
        await printBluetooth(billData);
      } else {
        console.log("Attempting local print for split Bill...");
        const discountInfo = getCurrentDiscountInfo();
        const activeBillNo = selectedOrder?.billNo || selectedOrder?.billNumber || nextBillNumber;
        printBill({
          table: selectedTable,
          items: selectedOrder.items,
          orderId: selectedOrderId,
          billNo: activeBillNo,
          discountMethod: discountInfo.method,
          discountValue: discountInfo.value,
        });
        setShowPrintBill(true);
      }
    } else {
      if (!localBillItems.length) {
        toast.error("No items to print in bill.");
        return;
      }
      if (!selectedTable) {
        console.error("Selected table is undefined.");
        toast.error("No table selected.");
        return;
      }
      await saveBill(selectedTable);
      if (printMode === "bluetooth" && bluetoothConnected) {
        const billData = formatBill();
        console.log("Attempting Bluetooth print for Bill...");
        await printBluetooth(billData);
      } else {
        console.log("Attempting local print for Bill...");
        const discountInfo = getCurrentDiscountInfo();
        const firstOrder = Object.values(currentTableData?.orders || {})[0];
        const activeBillNo = firstOrder?.billNo || firstOrder?.billNumber || currentTableData?.billNo || currentTableData?.billNumber || nextBillNumber;
        printBill({
          table: selectedTable,
          items: localBillItems,
          orderId: firstOrder?.orderId,
          billNo: activeBillNo,
          discountMethod: discountInfo.method,
          discountValue: discountInfo.value,
        });
        setShowPrintBill(true);
      }
    }
    // setShowStaffSelectionModal(true);
  };
  const handleAssignStaffToBill = async () => {
    if (!selectedStaff) {
      toast.error("Please select a staff member.");
      return;
    }
    if (!selectedTable) {
      console.error("Selected table is undefined.");
      toast.error("No table selected.");
      return;
    }
    setLoader(true);
    try {
      const tableIdStr = String(selectedTable.id);
      const endpoint = `/admin/print-settle-bill/${institutionData.institution}/${tableIdStr}`;
      const body = {
        staffName: selectedStaff,
        orderId: splitBillMode ? selectedOrderId : null,
        type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
      };
      await API.post("main", endpoint, { body });
      toast.success("Staff assigned to bill successfully.");
      setShowStaffSelectionModal(false);
      setSelectedStaff("");
      await fetchPendingOrders();
    } catch (error) {
      console.error("Error assigning staff to bill:", error);
    } finally {
      setLoader(false);
    }
  };
  const handlePrintKOT = async () => {
    if (!kotcurrent?.items?.length) {
      console.log("No items in KOT.");
      toast.info("No items to print.");
      return;
    }
    if (!selectedTable) {
      console.error("Selected table is undefined.");
      toast.error("No table selected.");
      return;
    }
    const kotData = formatKOT();
    if (printMode === "bluetooth" && bluetoothConnected) {
      await saveKOT(selectedTable);
      console.log("Attempting Bluetooth print for KOT...");
      printBluetooth(kotData);
    } else {
      console.log("Attempting local print for KOT...");
      printKOT(selectedTable, kotData);
    }
  };
  const handleReprintKOT = async () => {
    if (!selectedTable) {
      console.error("Selected table is undefined.");
      toast.error("No table selected.");
      return;
    }
    setShowReprintKOT(true);
  };
  const saveBill = async (selectedTable, orderItems, orderId) => {
    if (!selectedTable) {
      console.error("Selected table is undefined in saveBill.");
      toast.error("No table selected.");
      return;
    }
    const tableIdStr = String(selectedTable.id);
    setLoader(true);
    try {
      const endpoint = orderId
        ? `/admin/orderId-save/${institutionData.institution}/${tableIdStr}/${orderId}`
        : `/admin/orders-items/${institutionData.institution}/${tableIdStr}`;
      const items = orderItems || localBillItems;
      const { cgst, sgst, serviceTax, discountAmount, discountPercentage, discountMethod } = calculateTotals(items);
      const discountInfo = getCurrentDiscountInfo();
      await API.put("main", endpoint, {
        body: {
          items,
          serviceTaxPercentage: institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0,
          cgstPercentage: institutionData?.cgst ?? 2.5,
          sgstPercentage: institutionData?.sgst ?? 2.5,
          discountMethod: discountInfo.method,
          discountValue: discountInfo.value,
          discountPercentage: discountInfo.method === "percentage" ? discountInfo.value : 0,
          discountAmount: discountAmount,
          cgst,
          sgst,
          serviceTax,
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });
      if (orderId) {
        console.log("Order ID exists, skipping saveBill API calls.");
        setLoader(false);
        return;
      }
      const billEndpoint = orderId
        ? `/admin/orders-bill/${institutionData.institution}/${tableIdStr}/${orderId}`
        : `/admin/orders-bill/${institutionData.institution}/${tableIdStr}`;
      const billResponse = await API.post("main", billEndpoint, {
        body: { items, type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe" },
      });
      if (billResponse?.billNo && setNextBillNumber) {
        setNextBillNumber(billResponse.billNo);
      }
      setLoader(false);
      await fetchTableData(tableIdStr);
    } catch (error) {
      setLoader(false);
      console.error("Error saving bill:", error);
      toast.error("Failed to save bill. Please try again.");
    }
  };
  const handleSettleBill = async () => {
    if (splitBillMode) {
      if (!selectedOrderId) {
        toast.error("Please select an order to settle.");
        return;
      }
      const selectedOrder = orderGroups.find((group) => group.orderId === selectedOrderId);
      await saveBill(selectedTable, selectedOrder.items, selectedOrderId);
      setShowOrderPaymentModal(true);
    } else {
      settleBill();
    }
  };
  const handleSettleUnpaidOrder = (order, paymentMethod, bookingInfo = null) => {
    const normalizedMethod = (paymentMethod || "").toString().trim().toUpperCase();
    const orderWithPayment = {
      ...order,
      paymentMethod: normalizedMethod,
      bookingInfo: bookingInfo,
    };
    setSelectedUnpaidOrder(orderWithPayment);
    if (normalizedMethod === "ROOM" && !bookingInfo) {
      // For ROOM payment without bookingInfo, proceed to room selection
      setShowUnpaidOrderPaymentModal(true);
    } else {
      // For other payment methods or ROOM with bookingInfo, open the modal
      setShowUnpaidOrderPaymentModal(true);
    }
  };
  const confirmSettleOrder = async (order, paymentMethod, settleBody) => {
    if (!order || !settleUnpaidOrder) {
      toast.error("Unable to settle order. Please try again.");
      return;
    }
    try {
      await settleUnpaidOrder(order, paymentMethod, settleBody);
      toast.success(`Order #${order.orderId} settled successfully`);
      setShowUnpaidOrderPaymentModal(false);
      setSelectedUnpaidOrder(null);
      await fetchPendingOrders();
      await fetchTableData(String(selectedTable.id));
    } catch (error) {
      toast.error("Failed to settle order. Please try again.");
    }
  };
  const moveItemBetweenOrders = async (item, fromOrderId, toOrderId, quantity) => {
    if (!fromOrderId || !toOrderId) {
      toast.error("Please select source and target orders.");
      return;
    }
    const moveQty = Math.min(quantity || 1, item.quantity);
    setOrderGroups((prevGroups) => {
      const updatedGroups = prevGroups.map((group) => {
        if (group.orderId === fromOrderId) {
          if (moveQty >= item.quantity) {
            return {
              ...group,
              items: group.items.filter((i) => i.itemId !== item.itemId),
            };
          } else {
            return {
              ...group,
              items: group.items.map((i) =>
                i.itemId === item.itemId ? { ...i, quantity: i.quantity - moveQty } : i
              ),
            };
          }
        }
        if (group.orderId === toOrderId) {
          const existingItem = group.items.find((i) => i.itemId === item.itemId);
          if (existingItem) {
            return {
              ...group,
              items: group.items.map((i) =>
                i.itemId === item.itemId ? { ...i, quantity: i.quantity + moveQty } : i
              ),
            };
          }
          return {
            ...group,
            items: [...group.items, { ...item, quantity: moveQty }],
          };
        }
        return group;
      });
      return updatedGroups;
    });
    setLoader(true);
    try {
      const tableIdStr = String(selectedTable.id);
      const { cgst, sgst, serviceTax, discountAmount } = calculateTotals([
        { ...item, quantity: moveQty },
      ]);
      const discountInfo = getCurrentDiscountInfo();
      await API.post("main", `/admin/move-items/${institutionData.institution}/${tableIdStr}`, {
        body: {
          sourceOrderId: fromOrderId,
          destinationOrderId: toOrderId,
          items: [
            {
              itemId: item.itemId,
              quantity: moveQty,
              price: item.price,
              itemName: item.itemName || item.name,
            },
          ],
          serviceTaxPercentage: institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0,
          cgstPercentage: institutionData?.cgst ?? 2.5,
          sgstPercentage: institutionData?.sgst ?? 2.5,
          discountMethod: discountInfo.method,
          discountValue: discountInfo.value,
          discountAmount,
          cgst,
          sgst,
          serviceTax,
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });
      await fetchPendingOrders();
      setMovingItem(null);
      setTargetOrderId(null);
      toast.success(`${moveQty} item${moveQty > 1 ? "s" : ""} moved successfully`);
    } catch (error) {
      console.error("Error moving item between orders:", error);
      toast.error("Failed to move item. Please try again.");
    } finally {
      setLoader(false);
    }
  };
  const handleUpdateItemQuantity = (tableId, itemId, newQuantity) => {
    if (newQuantity < 1) return handleRemoveItemFromKOT(tableId, itemId);
    if (activeTab === "KOT") {
      updateItemQuantity(tableId, itemId, newQuantity);
    } else if (splitBillMode) {
      setOrderGroups((prevGroups) => {
        const newGroups = prevGroups.map((group) => {
          if (group.orderId === selectedOrderId) {
            const updatedItems = group.items
              .map((item) =>
                item.itemId === itemId ? { ...item, quantity: newQuantity } : item
              )
              .filter((item) => item.quantity > 0);
            return { ...group, items: updatedItems };
          }
          return group;
        }).filter((group) => group.items.length > 0); // Remove empty groups
        const updatedItemsForApi = newGroups.find((g) => g.orderId === selectedOrderId)?.items || [];
        updateOrderItems(updatedItemsForApi, selectedOrderId);
        return newGroups;
      });
    } else {
      const updatedItems = localBillItems
        .map((item) =>
          item.itemId === itemId ? { ...item, quantity: newQuantity } : item
        )
        .filter((item) => item.quantity > 0);
      setLocalBillItems(updatedItems);
      updateOrderItems(updatedItems);
    }
  };
  const handleUpdateItemInstruction = (tableId, itemId, instruction) => {
    if (activeTab === "KOT") {
      // Update KOT items with instruction (local state only)
      setKOTByTable((prev) => {
        const currentKOT = prev[String(tableId)] || { items: [], totalAmount: 0, billItems: [] };
        const updatedItems = currentKOT.items.map((item) =>
          item.itemId === itemId ? { ...item, instruction } : item
        );
        return {
          ...prev,
          [String(tableId)]: { ...currentKOT, items: updatedItems }
        };
      });
    } else if (splitBillMode) {
      // Update split bill items with instruction (local state only)
      setOrderGroups((prevGroups) => {
        const newGroups = prevGroups.map((group) => {
          if (group.orderId === selectedOrderId) {
            const updatedItems = group.items.map((item) =>
              item.itemId === itemId ? { ...item, instruction } : item
            );
            return { ...group, items: updatedItems };
          }
          return group;
        });
        return newGroups;
      });
    } else {
      // Update local bill items with instruction (local state only)
      const updatedItems = localBillItems.map((item) =>
        item.itemId === itemId ? { ...item, instruction } : item
      );
      setLocalBillItems(updatedItems);
    }
  };

  const handleRemoveItemFromKOT = (tableId, itemId) => {
    if (activeTab === "KOT") {
      removeItemFromKOT(tableId, itemId);
    } else if (splitBillMode) {
      setOrderGroups((prevGroups) => {
        const newGroups = prevGroups.map((group) => {
          if (group.orderId === selectedOrderId) {
            const updatedItems = group.items.filter((item) => item.itemId !== itemId);
            return { ...group, items: updatedItems };
          }
          return group;
        }).filter((group) => group.items.length > 0); // Remove empty groups
        const updatedItemsForApi = newGroups.find((g) => g.orderId === selectedOrderId)?.items || [];
        updateOrderItems(updatedItemsForApi, selectedOrderId);
        return newGroups;
      });
    } else {
      const updatedItems = localBillItems.filter((item) => item.itemId !== itemId);
      setLocalBillItems(updatedItems);
      updateOrderItems(updatedItems);
    }
  };
  const renderOrderTabs = () => {
    if (!splitBillMode || !orderGroups.length) return null;
    return (
      <div className="flex border-b overflow-x-auto py-2 px-2">
        {orderGroups.map((group) => (
          <button
            key={group.orderId}
            className={`px-3 py-1 mr-2 text-xs rounded-md whitespace-nowrap ${
              selectedOrderId === group.orderId
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
            onClick={() => setSelectedOrderId(group.orderId)}
          >
            Order #{group.orderId} ({group.items.length} items)
          </button>
        ))}
      </div>
    );
  };
  const UnpaidOrdersSection = () => {
    if (tableUnpaidOrders.length === 0) return null;
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg mb-1">
        <div
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-red-100 transition-colors"
          onClick={() => setIsUnpaidOrdersOpen(!isUnpaidOrdersOpen)}
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold text-red-800">
              Unpaid Orders ({tableUnpaidOrders.length})
            </h3>
            <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs">
              ₹{" "}
              {tableUnpaidOrders
                .reduce((sum, order) => sum + (order.totalAmount || 0), 0)
                .toFixed(2)}
            </span>
          </div>
          {isUnpaidOrdersOpen ? (
            <ChevronUp className="w-5 h-5 text-red-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-red-500" />
          )}
        </div>
        {isUnpaidOrdersOpen && (
          <div className="px-3 pb-3 space-y-2">
            {tableUnpaidOrders.map((order, index) => (
              <div
                key={`${order.orderId}-${index}`}
                className="bg-white border border-red-200 rounded-md p-3"
              >
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">#{order.orderId}</span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        Table {order.tableName}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>
                        Amount:{" "}
                        <span className="font-semibold text-red-600">
                          ₹{Number(order.totalAmount || 0).toFixed(2)}
                        </span>
                      </p>
                      <p>Staff: {order.staffName || "Not Assigned"}</p>
                      {order.createdAt && (
                        <p className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <button
                      onClick={() => handleUnpaidPaymentMethodChange(order, "cash")}
                      className="text-xs border rounded px-3 py-1.5 bg-red-100 text-red-700 font-medium hover:bg-red-200 transition-colors"
                    >
                      Settle
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  const renderContent = () => {
    if (!selectedTable) {
      return <div className="p-4 text-center text-gray-500">Please select a table</div>;
    }
    const isManagementTable = selectedTable?.id?.toString().toLowerCase().startsWith("management");
    if (activeTab === "KOT") {
      const hasKOTItems = (kotcurrent?.items || []).length > 0;
      return (
        <>
          <div className="p-3">
            <UnpaidOrdersSection />
          </div>
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 max-h-[18rem] max406:max-h-[12rem]">
            {(kotcurrent?.items || []).map((item) => (
              <ItemControls key={item.itemId} item={item} />
            ))}
          </div>
          <div className="p-2 sm:p-4 border-b space-y-2">
            <div className="flex gap-2">
              {/* Customer Name (Dropdown or Input based on table name) */}
              <div className="relative w-1/3">
                {isManagementTable ? (
                  isCustomName ? (
                    <>
                      <User className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Custom Name"
                        className="w-full pl-7 pr-2 py-1 text-xs border rounded"
                        value={customerDetails[selectedTable?.id]?.name || ""}
                        onChange={(e) =>
                          setCustomerDetails((prev) => ({
                            ...prev,
                            [selectedTable?.id]: {
                              ...(prev[selectedTable?.id] || {}),
                              name: e.target.value,
                            },
                          }))
                        }
                      />
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                      <select
                        value={customerDetails[selectedTable?.id]?.name || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setIsCustomName(value === "custom");
                          setCustomerDetails((prev) => ({
                            ...prev,
                            [selectedTable?.id]: {
                              ...(prev[selectedTable?.id] || {}),
                              name: value === "custom" ? "" : value,
                            },
                          }));
                        }}
                        className="w-full pl-7 pr-6 py-1 text-xs border rounded appearance-none"
                      >
                        <option value="">Select Customer</option>
                        {managementCustomerOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-1 flex items-center pointer-events-none">
                        <ChevronDown className="h-3 w-3 text-gray-400" />
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <User className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Name"
                      className="w-full pl-7 pr-2 py-1 text-xs border rounded"
                      value={customerDetails[selectedTable?.id]?.name || ""}
                      onChange={(e) =>
                        setCustomerDetails((prev) => ({
                          ...prev,
                          [selectedTable?.id]: {
                            ...(prev[selectedTable?.id] || {}),
                            name: e.target.value,
                          },
                        }))
                      }
                    />
                  </>
                )}
              </div>
              {/* Phone Number */}
              <div className="relative w-1/3">
                <Phone className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                <input
                  type="tel"
                  placeholder="Phone"
                  className="w-full pl-7 pr-2 py-1 text-xs border rounded"
                  value={customerDetails[selectedTable?.id]?.phone || ""}
                  onChange={(e) =>
                    setCustomerDetails((prev) => ({
                      ...prev,
                      [selectedTable?.id]: {
                        ...(prev[selectedTable?.id] || {}),
                        phone: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              {/* Day Session Dropdown (Compact) */}
              <div className="relative w-1/3">
                <select
                  value={selectedDaySession}
                  onChange={(e) => handleDaySessionChange(e.target.value)}
                  className="w-full pl-2 pr-6 py-1 text-xs border rounded appearance-none"
                >
                  {daySessionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-1 flex items-center pointer-events-none">
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                </div>
              </div>
            </div>
            {/* Instructions Section */}
            <div className="w-full mt-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Special Instructions</label>
              <textarea
                rows={2}
                placeholder="Enter any special instructions for the kitchen..."
                className="w-full p-2 text-sm border rounded resize-none"
                value={tableInstructions[selectedTable?.id] || ''}
                onChange={(e) => 
                  setTableInstructions((prev) => ({
                    ...prev,
                    [selectedTable?.id]: e.target.value
                  }))
                }
              />
            </div>
          </div>
          <div className="p-4 border-t space-y-2">
            <div className="flex justify-between font-bold text-sm sm:text-base mt-3 mb-3">
              <span>Total Items:</span>
              <span>{totalKotQuantity}</span>
            </div>
            {printerType !== "local" && (
              <button
                onClick={() => setShowPrintModal(true)}
                className="w-full py-2 bg-blue-500 text-white rounded-lg text-xs sm:text-sm"
              >
                Change Printer Mode
              </button>
            )}
            {institutionData.saveKot === "Yes" && (
              <button
                onClick={async () => await saveKOT(selectedTable)}
                className={`w-full py-2 ${
                  hasKOTItems ? "bg-green-500" : "bg-gray-400"
                } text-white rounded-lg text-xs sm:text-sm mb-2`}
                disabled={!hasKOTItems}
              >
                Save KOT
              </button>
            )}
            <button
              onClick={handlePrintKOT}
              className={`w-full py-2 ${
                hasKOTItems ? "bg-green-500" : "bg-gray-400"
              } text-white rounded-lg text-xs sm:text-sm mb-2`}
              disabled={!hasKOTItems}
            >
              Print KOT
            </button>
            {printerType !== "local" && (
              <p
                className={`text-sm ${
                  printMode === "local" || (printMode === "bluetooth" && bluetoothConnected)
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {printMode === "local"
                  ? "Print Mode: Local Print"
                  : printMode === "bluetooth" && bluetoothConnected
                  ? `Print Mode: Bluetooth - Using device: ${bluetoothDeviceName}`
                  : "Print Mode: Bluetooth - Not connected"}
              </p>
            )}
          </div>
          {showPrintModal && <PrintModal />}
        </>
      );
    } else {
      if (splitBillMode) {
        const selectedOrder = orderGroups.find((group) => group.orderId === selectedOrderId);
        const orderItems = selectedOrder?.items || [];
        const { billSubtotal, taxableSubtotal, cgst, sgst, serviceTax, finalTotal, discountAmount } =
          calculateTotals(orderItems);
        return (
          <>
            <div className="p-3">
              <UnpaidOrdersSection />
            </div>
            {renderOrderTabs()}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 max-h-[16rem] max406:max-h-[10rem]">
              {selectedOrderId ? (
                orderItems.length > 0 ? (
                  orderItems.map((item) => (
                    <ItemControls key={item.itemId} item={item} orderId={selectedOrderId} />
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No items in this order</p>
                )
              ) : (
                <p className="text-sm text-gray-500">Please select an order</p>
              )}
            </div>
            <div className="p-2 sm:p-4 border-b space-y-3">
              <div className="flex gap-2">
                <div className="relative w-1/2">
                  <User className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Customer Name"
                    className="w-full pl-8 pr-2 py-1 text-xs sm:text-sm border rounded"
                    value={selectedOrder?.customerName || ""}
                    disabled={true}
                  />
                </div>
                <div className="relative w-1/2">
                  <Phone className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    className="w-full pl-8 pr-2 py-1 text-xs sm:text-sm border rounded"
                    value={selectedOrder?.phoneNumber || ""}
                    disabled={true}
                  />
                </div>
              </div>
              <DiscountSection
                orderItems={orderItems}
                calculateTotals={calculateTotals}
                getCurrentDiscountInfo={getCurrentDiscountInfo}
                handleDiscountMethodChange={handleDiscountMethodChange}
                handleDiscountValueChange={handleDiscountValueChange}
                discountValueInputRef={discountValueInputRef}
              />
            </div>
            <div className="border-t p-4 space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span>Subtotal:</span>
                <span>₹{billSubtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-red-600">
                  <span>
                    Discount{" "}
                    {getCurrentDiscountInfo().method === "percentage"
                      ? `(${getCurrentDiscountInfo().value}%)`
                      : "(Fixed)"}
                    :
                  </span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs sm:text-sm">
                <span>CGST ({institutionData?.cgst ?? 2.5}%):</span>
                <span>₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span>SGST ({institutionData?.sgst ?? 2.5}%):</span>
                <span>₹{sgst.toFixed(2)}</span>
              </div>
              {serviceTax > 0 && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span>Service Tax ({institutionData?.serviceTax ?? 0}%):</span>
                  <span>₹{serviceTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm sm:text-base border-t pt-2">
                <span>Total:</span>
                <span>₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="p-4 mb-10 space-y-2">
              <button
                onClick={handlePrintBill}
                className={`w-full py-2 ${
                  selectedOrderId && orderItems.length > 0 ? "bg-blue-500" : "bg-gray-400"
                } text-white rounded-lg text-xs sm:text-sm`}
                disabled={!selectedOrderId || orderItems.length === 0}
              >
                Print Selected Order Bill
              </button>
              {printerType !== "local" && (
                <p
                  className={`text-sm ${
                    printMode === "local" || (printMode === "bluetooth" && bluetoothConnected)
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {printMode === "local"
                    ? "Print Mode: Local Print"
                    : printMode === "bluetooth" && bluetoothConnected
                    ? `Print Mode: Bluetooth - Using device: ${bluetoothDeviceName}`
                    : "Print Mode: Bluetooth - Not connected"}
                </p>
              )}
              <button
                onClick={handleSettleBill}
                className={`w-full py-2 ${
                  selectedOrderId && orderItems.length > 0 ? "bg-green-500" : "bg-gray-400"
                } text-white rounded-lg text-xs sm:text-sm`}
                disabled={!selectedOrderId || orderItems.length === 0}
              >
                Settle Selected Order
              </button>
              {(institutionData.institution === "bhuk2323" || institutionData.reprintKot === "Yes") && (
                <button
                  onClick={handleReprintKOT}
                  className={`w-full py-2 ${
                    orderItems.length > 0 ? "bg-yellow-500" : "bg-gray-400"
                  } text-white rounded-lg text-xs sm:text-sm`}
                  disabled={!selectedOrderId || orderItems.length === 0}
                >
                  Reprint KOT
                </button>
              )}
            </div>
            {movingItem && <MoveItemModal />}
            {showReprintKOT && (
              <ReprintKOT
                table={selectedTable}
                customerDetails={customerDetails}
                billItems={orderItems}
                institutionData={institutionData}
                saveKOT={saveKOT}
                screenWidth={screenWidth}
                tableData={currentTableData}
                printData={printBluetooth}
                connected={bluetoothConnected}
                setShowReprintKOT={setShowReprintKOT}
              />
            )}
            {showStaffSelectionModal && (
              <StaffSelectionModal
                showStaffSelectionModal={showStaffSelectionModal}
                setShowStaffSelectionModal={setShowStaffSelectionModal}
                selectedStaff={selectedStaff}
                setSelectedStaff={setSelectedStaff}
                staffData={staffData}
                selectedTable={selectedTable}
                institutionData={institutionData}
                splitBillMode={splitBillMode}
                selectedOrderId={selectedOrderId}
                fetchPendingOrders={fetchPendingOrders}
                setLoader={setLoader}
              />
            )}
          </>
        );
      } else {
        const hasItems = localBillItems.length > 0;
        const { billSubtotal, taxableSubtotal, cgst, sgst, serviceTax, finalTotal, discountAmount } =
          calculateTotals(localBillItems);
        return (
          <>
            <div className="p-3">
              <UnpaidOrdersSection />
            </div>
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 max-h-[16rem] max406:max-h-[10rem]">
              {localBillItems.length > 0 ? (
                localBillItems.map((item) => <ItemControls key={item.itemId} item={item} />)
              ) : (
                <p className="text-sm text-gray-500">No bill items available</p>
              )}
            </div>
            <div className="p-2 sm:p-4 border-b space-y-3">
              <div className="flex gap-2">
                <div className="relative w-1/2">
                  {isManagementTable ? (
                    isCustomName ? (
                      <>
                        <User className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Custom Name"
                          className="w-full pl-8 pr-2 py-1 text-xs sm:text-sm border rounded"
                          value={customerDetails[selectedTable?.id]?.name || ""}
                          onChange={(e) =>
                            setCustomerDetails((prev) => ({
                              ...prev,
                              [selectedTable?.id]: {
                                ...(prev[selectedTable?.id] || {}),
                                name: e.target.value,
                              },
                            }))
                          }
                        />
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                        <select
                          value={customerDetails[selectedTable?.id]?.name || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setIsCustomName(value === "custom");
                            setCustomerDetails((prev) => ({
                              ...prev,
                              [selectedTable?.id]: {
                                ...(prev[selectedTable?.id] || {}),
                                name: value === "custom" ? "" : value,
                              },
                            }));
                          }}
                          className="w-full pl-8 pr-10 py-1 text-xs sm:text-sm border rounded appearance-none"
                        >
                          <option value="">Select Customer</option>
                          {managementCustomerOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-1 flex items-center pointer-events-none">
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        </div>
                      </>
                    )
                  ) : (
                    <>
                      <User className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Customer Name"
                        className="w-full pl-8 pr-2 py-1 text-xs sm:text-sm border rounded"
                        value={customerDetails[selectedTable?.id]?.name || ""}
                        onChange={(e) =>
                          setCustomerDetails((prev) => ({
                            ...prev,
                            [selectedTable?.id]: {
                              ...(prev[selectedTable?.id] || {}),
                              name: e.target.value,
                            },
                          }))
                        }
                      />
                    </>
                  )}
                </div>
                <div className="relative w-1/2">
                  <Phone className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    className="w-full pl-8 pr-2 py-1 text-xs sm:text-sm border rounded"
                    value={customerDetails[selectedTable?.id]?.phone || ""}
                    onChange={(e) =>
                      setCustomerDetails((prev) => ({
                        ...prev,
                        [selectedTable?.id]: {
                          ...(prev[selectedTable?.id] || {}),
                          phone: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
              <DiscountSection
                orderItems={localBillItems}
                calculateTotals={calculateTotals}
                getCurrentDiscountInfo={getCurrentDiscountInfo}
                handleDiscountMethodChange={handleDiscountMethodChange}
                handleDiscountValueChange={handleDiscountValueChange}
                discountValueInputRef={discountValueInputRef}
              />
            </div>
            <div className="border-t p-4 space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span>Subtotal:</span>
                <span>₹{billSubtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs sm:text-sm text-red-600">
                  <span>
                    Discount{" "}
                    {getCurrentDiscountInfo().method === "percentage"
                      ? `(${getCurrentDiscountInfo().value}%)`
                      : "(Fixed)"}
                    :
                  </span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs sm:text-sm">
                <span>CGST ({institutionData?.cgst ?? 2.5}%):</span>
                <span>₹{cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span>SGST ({institutionData?.sgst ?? 2.5}%):</span>
                <span>₹{sgst.toFixed(2)}</span>
              </div>
              {serviceTax > 0 && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span>Service Tax ({institutionData?.serviceTax ?? 0}%):</span>
                  <span>₹{serviceTax.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm sm:text-base border-t pt-2">
                <span>Total:</span>
                <span>₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="p-4 mb-10 space-y-2">
              <button
                onClick={handlePrintBill}
                className={`w-full py-2 ${
                  hasItems ? "bg-blue-500" : "bg-gray-400"
                } text-white rounded-lg text-xs sm:text-sm`}
                disabled={!hasItems}
              >
                Print Bill
              </button>
              {printerType !== "local" && (
                <p
                  className={`text-sm ${
                    printMode === "local" || (printMode === "bluetooth" && bluetoothConnected)
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {printMode === "local"
                    ? "Print Mode: Local Print"
                    : printMode === "bluetooth" && bluetoothConnected
                    ? `Print Mode: Bluetooth - Using device: ${bluetoothDeviceName}`
                    : "Print Mode: Bluetooth - Not connected"}
                </p>
              )}
              <button
                onClick={handleSettleBill}
                className={`w-full py-2 ${
                  hasItems ? "bg-green-500" : "bg-gray-400"
                } text-white rounded-lg text-xs sm:text-sm`}
                disabled={!hasItems}
              >
                Settle Payment
              </button>
              {(institutionData.institution === "bhuk2323" || institutionData.reprintKot === "Yes") && (
                <button
                  onClick={handleReprintKOT}
                  className={`w-full py-2 ${
                    hasItems ? "bg-yellow-500" : "bg-gray-400"
                  } text-white rounded-lg text-xs sm:text-sm`}
                  disabled={!hasItems}
                >
                  Reprint KOT
                </button>
              )}
            </div>
            {showReprintKOT && (
              <ReprintKOT
                table={selectedTable}
                customerDetails={customerDetails}
                billItems={localBillItems}
                institutionData={institutionData}
                saveKOT={saveKOT}
                screenWidth={screenWidth}
                tableData={currentTableData}
                printData={printBluetooth}
                connected={bluetoothConnected}
                setShowReprintKOT={setShowReprintKOT}
              />
            )}
            {showStaffSelectionModal && (
              <StaffSelectionModal
                showStaffSelectionModal={showStaffSelectionModal}
                setShowStaffSelectionModal={setShowStaffSelectionModal}
                selectedStaff={selectedStaff}
                setSelectedStaff={setSelectedStaff}
                staffData={staffData}
                selectedTable={selectedTable}
                institutionData={institutionData}
                splitBillMode={splitBillMode}
                selectedOrderId={selectedOrderId}
                fetchPendingOrders={fetchPendingOrders}
                setLoader={setLoader}
              />
            )}
          </>
        );
      }
    }
  };
  // Add state to track which items have instruction input open
  const [instructionStates, setInstructionStates] = useState({});
  
  // Handle instruction input state
  const toggleInstructionInput = useCallback((itemId) => {
    setInstructionStates(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  }, []);

  const ItemControls = ({ item, orderId }) => {
    const [localInstruction, setLocalInstruction] = useState(item.instruction || '');
    const showInstruction = instructionStates[item.itemId] || false;
    
    // Update local state when item instruction changes from outside
    useEffect(() => {
      setLocalInstruction(item.instruction || '');
    }, [item.instruction]);

    const handleSaveInstruction = () => {
      // Only save if instruction has changed
      if (localInstruction !== item.instruction) {
        handleUpdateItemInstruction(selectedTable?.id, item.itemId, localInstruction);
      }
    };

    return (
      <div className="p-3 border-b group">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex justify-between">
              <p className="font-medium text-sm">{item.itemName || item.name}</p>
              <div className="flex items-center gap-2">
                {/* Show Note button only in KOT tab */}
                {activeTab === "KOT" && (
                  <button
                    onClick={() => toggleInstructionInput(item.itemId)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      showInstruction || item.instruction 
                        ? 'bg-blue-100 text-blue-600' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="Add item instruction"
                  >
                    Note
                  </button>
                )}
                {splitBillMode && activeTab !== "KOT" && orderGroups.length > 1 ? (
                  <button
                    onClick={() => {
                      setMovingItem(item);
                      setTargetOrderId(null);
                    }}
                    className="text-blue-500 transition-opacity"
                    title="Move item to another order"
                  >
                    <MoveRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleRemoveItemFromKOT(selectedTable?.id, item.itemId)}
                    className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center">
                <button
                  onClick={() =>
                    handleUpdateItemQuantity(selectedTable?.id, item.itemId, item.quantity - 1)
                  }
                  className="w-6 h-6 flex items-center justify-center border rounded"
                >
                  -
                </button>
                <span className="mx-2 text-sm">{item.quantity}</span>
                <button
                  onClick={() =>
                    handleUpdateItemQuantity(selectedTable?.id, item.itemId, item.quantity + 1)
                  }
                  className="w-6 h-6 flex items-center justify-center border rounded"
                >
                  +
                </button>
              </div>
              <span className="text-sm">₹{(item.price * item.quantity).toFixed(2)}</span>
            </div>
            {/* Show instruction input only in KOT tab */}
            {activeTab === "KOT" && showInstruction && (
              <div className="mt-2">
                <input
                  key={`instruction-${item.itemId}`}
                  type="text"
                  placeholder="Add special instruction for this item..."
                  className="w-full p-2 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={localInstruction}
                  onChange={(e) => setLocalInstruction(e.target.value)}
                  onBlur={handleSaveInstruction}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveInstruction();
                      toggleInstructionInput(item.itemId); // Close the input
                    }
                    if (e.key === 'Escape') {
                      setLocalInstruction(item.instruction || ''); // Reset to original value
                      toggleInstructionInput(item.itemId); // Close the input
                    }
                  }}
                  autoFocus
                />
                <div className="mt-1 text-xs text-gray-500">
                  Press Enter to save, Escape to cancel
                </div>
              </div>
            )}
            {/* Show instruction display only in KOT tab when not editing */}
            {activeTab === "KOT" && item.instruction && !showInstruction && (
              <div className="mt-1">
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  Note: {item.instruction}
                </span>
              </div>
            )}
            {splitBillMode && orderId && (
              <div className="mt-1">
                <span className="text-xs text-gray-500">Order ID: {orderId}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  const PrintModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg relative">
        <button
          onClick={() => setShowPrintModal(false)}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
        <h2 className="text-lg font-semibold mb-4">Select Printing Method</h2>
        <p className="mb-4">How would you like to handle printing?</p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              connectBluetooth();
              setPrintMode("bluetooth");
              setShowPrintModal(false);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Bluetooth Printer
          </button>
          <button
            onClick={() => {
              setPrintMode("local");
              setShowPrintModal(false);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Wired Printer
          </button>
        </div>
      </div>
    </div>
  );
  const MoveItemModal = () => {
    if (!movingItem) return null;
    const otherOrders = orderGroups.filter((group) => group.orderId !== selectedOrderId);
    const [moveQuantity, setMoveQuantity] = useState(1);
    const maxQuantity = movingItem.quantity;
    useEffect(() => {
      if (otherOrders.length === 1 && !targetOrderId) {
        setTargetOrderId(otherOrders[0].orderId);
      }
    }, [otherOrders, targetOrderId]);
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg relative max-w-md w-full">
          <button
            onClick={() => setMovingItem(null)}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          <h2 className="text-lg font-semibold mb-4">Move Item to Another Order</h2>
          <p className="mb-2">Moving: {movingItem.itemName || movingItem.name}</p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Quantity to Move:
            </label>
            <div className="flex items-center">
              <button
                onClick={() => setMoveQuantity((prev) => Math.max(1, prev - 1))}
                className="w-8 h-8 flex items-center justify-center border rounded-l"
                disabled={moveQuantity <= 1}
              >
                -
              </button>
              <input
                type="number"
                min="1"
                max={maxQuantity}
                value={moveQuantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val <= maxQuantity) {
                    setMoveQuantity(val);
                  }
                }}
                className="w-16 text-center border-t border-b h-8"
              />
              <button
                onClick={() => setMoveQuantity((prev) => Math.min(maxQuantity, prev + 1))}
                className="w-8 h-8 flex items-center justify-center border rounded-r"
                disabled={moveQuantity >= maxQuantity}
              >
                +
              </button>
              <span className="ml-2 text-sm text-gray-500">of {maxQuantity} available</span>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Select Target Order:</label>
            <select
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={targetOrderId || ""}
              onChange={(e) => setTargetOrderId(e.target.value)}
            >
              <option value="">Select an order</option>
              {otherOrders.map((order) => (
                <option key={order.orderId} value={order.orderId}>
                  Order {order.orderId} - {order.items.length} items
                </option>
              ))}
            </select>
          </div>
                    <div className="flex justify-end gap-3">
            <button
              onClick={() => setMovingItem(null)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                moveItemBetweenOrders(movingItem, selectedOrderId, targetOrderId, moveQuantity)
              }
              disabled={!targetOrderId}
              className={`px-4 py-2 ${
                targetOrderId ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-300"
              } border border-transparent rounded-md shadow-sm text-sm font-medium text-white`}
            >
              Move {moveQuantity} Item{moveQuantity > 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    );
  };
  return (
    <>
      <div className="flex-1 flex flex-col">{renderContent()}</div>
    
      {showOrderPaymentModal && (
        <OrderPaymentModal
          selectedTable={selectedTable}
          orderGroups={orderGroups}
          institutionData={institutionData}
          onClose={() => setShowOrderPaymentModal(false)}
          selectedOrderId={splitBillMode ? selectedOrderId : null}
          fetchTableData={fetchTableData}
          fetchPendingOrders={fetchPendingOrders}
          customerDetails={customerDetails}
          discountData={discountData}
          setDiscountData={setDiscountData}
       
        />
      )}
    
      {showUnpaidOrderPaymentModal && selectedUnpaidOrder && (
        <UnpaidOrderPaymentModal
          selectedTable={selectedTable}
          institutionData={institutionData}
          onClose={() => {
            setShowUnpaidOrderPaymentModal(false);
            setSelectedUnpaidOrder(null);
          }}
          unpaidOrder={selectedUnpaidOrder}
          settleUnpaidOrder={confirmSettleOrder}
          fetchTableData={fetchTableData}
          fetchPendingOrders={fetchPendingOrders}
          customerDetails={customerDetails}
          discountData={discountData}
          setDiscountData={setDiscountData}
       
        />
      )}
    
      {showReprintKOT && (
        <ReprintKOT
          selectedTable={selectedTable}
          onClose={() => setShowReprintKOT(false)}
          institutionData={institutionData}
        />
      )}
        <StaffSelectionModal
          showStaffSelectionModal={showStaffSelectionModal}
          setShowStaffSelectionModal={setShowStaffSelectionModal}
          selectedStaff={selectedStaff}
          setSelectedStaff={setSelectedStaff}
          staffData={staffData}
          selectedTable={selectedTable}
          institutionData={institutionData}
          splitBillMode={splitBillMode}
          selectedOrderId={selectedOrderId}
          fetchPendingOrders={fetchPendingOrders}
          setLoader={setLoader}
        />
    </>
  );
};
export default OrderContent;
