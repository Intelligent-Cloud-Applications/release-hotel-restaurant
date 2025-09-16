"use client";
import {
  User,
  Phone,
  X,
  MoveRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  Bluetooth,
  Printer,
  Percent,
  DollarSign
} from "lucide-react";
import { useState, useEffect, useContext, useRef } from "react";
import { toast } from "react-toastify";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import PrintKOT from "./PrintKOT";
import PrintBill from "./PrintBill";
import ReprintKOT from "./ReprintKOT";
import data from "../../../../../Operation/data.json";
import OrderPaymentModal from "./OrderPaymentModal";

const OrderContent = ({
  selectedTable,
  setSelectedTable,
  KOTByTable,
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
  // NEW DISCOUNT PROPS FROM PARENT
  discountData,
  setDiscountData,
}) => {
  const { printerType, printerpaperSize } = data;
  const { staffData, fetchStaffData, setLoader, hotelBookings } = useContext(Context);
  
  const [orderRoomSelection, setOrderRoomSelection] = useState({});
  const [showOrderPaymentModal, setShowOrderPaymentModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState("local");
  const [showPrintBill, setShowPrintBill] = useState(false);
  const [showStaffSelectionModal, setShowStaffSelectionModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [movingItem, setMovingItem] = useState(null);
  const [targetOrderId, setTargetOrderId] = useState(null);
  const [isUnpaidOrdersOpen, setIsUnpaidOrdersOpen] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedUnpaidOrder, setSelectedUnpaidOrder] = useState(null);

  // Use refs to prevent input focus loss
  const discountValueInputRef = useRef(null);

  // Helper function to get current discount info
  const getCurrentDiscountInfo = () => {
    if (!selectedTable) return { method: "none", value: 0, amount: 0 };

    const tableIdStr = String(selectedTable.id);
    const tableDiscountData = discountData[tableIdStr];

    if (!tableDiscountData) return { method: "none", value: 0, amount: 0 };

    if (splitBillMode && selectedOrderId) {
      return tableDiscountData[selectedOrderId] || { method: "none", value: 0, amount: 0 };
    }

    // For non-split bill, use the table-level discount or first order discount
    if (typeof tableDiscountData === 'object' && !tableDiscountData.method) {
      // This is order-based discount data, get first order's discount
      const firstOrderId = Object.keys(tableDiscountData)[0];
      return tableDiscountData[firstOrderId] || { method: "none", value: 0, amount: 0 };
    }

    return tableDiscountData;
  };

  // Helper function to set discount info
  const setCurrentDiscountInfo = (discountInfo) => {
    if (!selectedTable) return;

    const tableIdStr = String(selectedTable.id);

    setDiscountData(prev => {
      const newData = { ...prev };
      
      if (splitBillMode && selectedOrderId) {
        // For split bill mode, set discount for specific order
        if (!newData[tableIdStr]) newData[tableIdStr] = {};
        newData[tableIdStr][selectedOrderId] = discountInfo;
      } else {
        // For non-split bill mode, set table-level discount
        newData[tableIdStr] = discountInfo;
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

  const tableUnpaidOrders = selectedTable
    ? unpaidOrders.filter((order) => String(order.tableName) === String(selectedTable.id))
    : [];

  const getKOTNumber = (tableId) => {
    const today = new Date().toISOString().split("T")[0];
    let kotData = JSON.parse(localStorage.getItem("kotOrders")) || {
      date: today,
      lastKOT: 0,
      kotTables: {}
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
      const firstBooking =
        hotelBookings && hotelBookings.length > 0 ? hotelBookings[0] : null;
      setOrderRoomSelection((prev) => ({
        ...prev,
        [order.orderId]: firstBooking ? firstBooking.bookingId : ""
      }));
    } else {
      handleSettleUnpaidOrder(order, method, null);
    }
  };

  const handleProceedRoomSettlement = (order) => {
    const selectedBookingId = orderRoomSelection[order.orderId];
    const booking =
      (hotelBookings || []).find((b) => b.bookingId === selectedBookingId) ||
      null;
    const roomNumber = booking
      ? String(booking.roomNumber)
      : formatOrderTableLabel(order);
    handleSettleUnpaidOrder(order, "ROOM", {
      bookingId: selectedBookingId,
      roomNumber
    });
  };

  // Enhanced discount calculation using current discount info
  const calculateTotals = (items) => {
    const billSubtotal = items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return sum + price * quantity;
    }, 0);

    const taxableSubtotal = items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return sum + (item.type !== "bar" ? price * quantity : 0);
    }, 0);

    const cgstRate = institutionData?.cgst ?? 2.5;
    const sgstRate = institutionData?.sgst ?? 2.5;
    const serviceTaxRate =
      institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0;

    // Get current discount info
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
    const discountedTaxableSubtotal = Math.max(0, taxableSubtotal - discountAmount);

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

  // Handle discount method change without losing focus
  const handleDiscountMethodChange = (method) => {
    const currentInfo = getCurrentDiscountInfo();
    setCurrentDiscountInfo({
      method,
      value: method === "none" ? 0 : currentInfo.value,
      amount: method === "none" ? 0 : currentInfo.amount
    });
  };

  // Handle discount value change without losing focus
  const handleDiscountValueChange = (value) => {
    const currentInfo = getCurrentDiscountInfo();
    const newValue = Number(value) || 0;
    
    // Calculate discount amount based on method
    let discountAmount = 0;
    if (currentInfo.method === "percentage") {
      const items = splitBillMode 
        ? (orderGroups.find(g => g.orderId === selectedOrderId)?.items || [])
        : localBillItems;
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      discountAmount = (subtotal * newValue) / 100;
    } else if (currentInfo.method === "amount") {
      discountAmount = newValue;
    }

    setCurrentDiscountInfo({
      method: currentInfo.method,
      value: newValue,
      amount: discountAmount
    });
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
        const chunks = itemName.match(
          new RegExp(`.{1,${itemNameLength}}`, "g")
        );
        chunks.forEach((chunk, index) => {
          if (index === 0) {
            kot += `${chunk.padEnd(itemNameLength)}${qty}\n`;
          } else {
            kot += `${chunk}\n`;
          }
        });
      }
    });

    kot += `\x1B\x61\x01`;
    kot += `${"-".repeat(lineWidth)}\n`;
    kot += `Total Qty: ${totalQty}\n`;
    kot += `${"-".repeat(lineWidth)}\n`;
    kot += `${resetFont}\n\n\n`;

    return kot;
  };

  const centerText = (text, width) => {
    const textLength = text.length;
    if (textLength >= width) return text.substring(0, width);
    const padding = Math.floor((width - textLength) / 2);
    return (
      " ".repeat(padding) +
      text +
      " ".repeat(width - textLength - padding)
    );
  };

  const formatBill = (orderItems, customerId) => {
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
      if (totalLength >= width)
        return `${leftText}${rightText}`.substring(0, width);
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

    const totalQty = items.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );

    let bill = `\x1B\x61\x01${headerFont}`;
    bill += `${institutionData?.companyName || "The Chai Theka"}\n`;
    bill += `${institutionData?.Query_Address || "BhawaniPeth"}\n`;
    bill += `Contact: ${
      institutionData?.Query_PhoneNumber || "+917008120727"
    }\n`;
    bill += `Date: ${formatDateTime()}\n`;
    bill += `${
      institutionData?.gstin ? `GSTIN: ${institutionData.gstin}\n` : ""
    }`;
    bill += `Table: ${selectedTable?.id || "N/A"}\n`;
    if (splitBillMode && customerId) {
      bill += `Order ID: ${customerId}\n`;
    }
    bill += `${resetFont}${itemFont}${centerText(
      `-`.repeat(lineWidth),
      lineWidth
    )}\n`;
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
        const remaining = (item.itemName || item.name || "").substring(
          itemNameLength
        );
        const chunks =
          remaining.match(new RegExp(`.{1,${itemNameLength}}`, "g")) || [];
        chunks.forEach((chunk) => {
          bill += `${chunk.padEnd(itemNameLength)}${" ".repeat(
            lineWidth - itemNameLength
          )}\n`;
        });
      }
    });

    bill += `${resetFont}${centerText(`-`.repeat(lineWidth), lineWidth)}\n`;
    bill += `${justifyBetween("Total Qty:", `${totalQty}`)}\n`;
    bill += `${justifyBetween("Subtotal:", `₹${billSubtotal.toFixed(2)}`)}\n`;

    // Enhanced discount display
    if (discountAmount > 0) {
      if (discountMethod === "percentage") {
        bill += `${justifyBetween(
          `Discount (${discountPercentage}%):`,
          `₹${discountAmount.toFixed(2)}`
        )}\n`;
      } else if (discountMethod === "amount") {
        bill += `${justifyBetween(
          "Discount (Fixed):",
          `₹${discountAmount.toFixed(2)}`
        )}\n`;
      }
    }

    if (institutionData.cgst !== 0 && institutionData.sgst !== 0) {
      bill += `${justifyBetween("CGST:", `₹${cgst.toFixed(2)}`)}\n`;
      bill += `${justifyBetween("SGST:", `₹${sgst.toFixed(2)}`)}\n`;
    }

    if (serviceTax > 0) {
      bill += `${justifyBetween(
        `Service Tax (${institutionData?.serviceTax ?? 0}%):`,
        `₹${serviceTax.toFixed(2)}`
      )}\n`;
    }

    bill += `${justifyBetween(
      "Total (Rounded):",
      `₹${finalTotal.toFixed(2)}`
    )}\n`;
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
      const selectedOrder = orderGroups.find(
        (group) => group.orderId === selectedOrderId
      );
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
        printBill({
          table: selectedTable,
          items: selectedOrder.items,
          orderId: selectedOrderId,
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
        printBill({
          table: selectedTable,
          items: localBillItems,
          discountMethod: discountInfo.method,
          discountValue: discountInfo.value,
        });
        setShowPrintBill(true);
      }
    }

    setShowStaffSelectionModal(true);
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
      const { cgst, sgst, serviceTax, discountAmount, discountPercentage, discountMethod } =
        calculateTotals(items);

      // Get current discount info
      const discountInfo = getCurrentDiscountInfo();

      await API.put("main", endpoint, {
        body: {
          items,
          serviceTaxPercentage:
            institutionData?.serviceTax !== undefined
              ? institutionData.serviceTax
              : 0,
          cgstPercentage: institutionData?.cgst ?? 2.5,
          sgstPercentage: institutionData?.sgst ?? 2.5,
          discountMethod: discountInfo.method,
          discountValue: discountInfo.value,
          discountPercentage: discountInfo.method === "percentage" ? discountInfo.value : 0,
          discountAmount: discountAmount,
          cgst,
          sgst,
          serviceTax,
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

      await API.post("main", billEndpoint, {
        body: { items },
      });

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
      const selectedOrder = orderGroups.find(
        (group) => group.orderId === selectedOrderId
      );
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
    setShowSettleModal(true);
  };

  const confirmSettleOrder = async () => {
    if (!selectedUnpaidOrder || !settleUnpaidOrder) {
      toast.error("Unable to settle order. Please try again.");
      return;
    }

    try {
      await settleUnpaidOrder(
        selectedUnpaidOrder,
        selectedUnpaidOrder.paymentMethod,
        selectedUnpaidOrder.bookingInfo || null
      );
      toast.success(`Order #${selectedUnpaidOrder.orderId} settled successfully`);
    } catch (error) {

      toast.error("Failed to settle order. Please try again.");
    } finally {
      setShowSettleModal(false);
      setSelectedUnpaidOrder(null);
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
                i.itemId === item.itemId
                  ? { ...i, quantity: i.quantity - moveQty }
                  : i
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
                i.itemId === item.itemId
                  ? { ...i, quantity: i.quantity + moveQty }
                  : i
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

      // Get current discount info
      const discountInfo = getCurrentDiscountInfo();

      await API.post(
        "main",
        `/admin/move-items/${institutionData.institution}/${tableIdStr}`,
        {
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
            serviceTaxPercentage:
              institutionData?.serviceTax !== undefined
                ? institutionData.serviceTax
                : 0,
            cgstPercentage: institutionData?.cgst ?? 2.5,
            sgstPercentage: institutionData?.sgst ?? 2.5,
            discountMethod: discountInfo.method,
            discountValue: discountInfo.value,
            discountAmount,
            cgst,
            sgst,
            serviceTax,
          },
        }
      );

      await fetchPendingOrders();
      setMovingItem(null);
      setTargetOrderId(null);
      toast.success(
        `${moveQty} item${moveQty > 1 ? "s" : ""} moved successfully`
      );
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
      setOrderGroups((prevGroups) =>
        prevGroups.map((group) => {
          if (group.orderId === selectedOrderId) {
            const updatedItems = group.items
              .map((item) =>
                item.itemId === itemId
                  ? { ...item, quantity: newQuantity }
                  : item
              )
              .filter((item) => item.quantity > 0);
            return { ...group, items: updatedItems };
          }
          return group;
        })
      );
    } else {
      setLocalBillItems((prev) =>
        prev
          .map((item) =>
            item.itemId === itemId ? { ...item, quantity: newQuantity } : item
          )
          .filter((item) => item.quantity > 0)
      );
    }
  };

  const handleRemoveItemFromKOT = (tableId, itemId) => {
    if (activeTab === "KOT") {
      removeItemFromKOT(tableId, itemId);
    } else if (splitBillMode) {
      setOrderGroups((prevGroups) =>
        prevGroups.map((group) => {
          if (group.orderId === selectedOrderId) {
            const updatedItems = group.items.filter(
              (item) => item.itemId !== itemId
            );
            return { ...group, items: updatedItems };
          }
          return group;
        })
      );
    } else {
      setLocalBillItems((prev) => prev.filter((item) => item.itemId !== itemId));
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

  // FIXED: One-line Compact Discount Section with refs to prevent focus loss
  const DiscountSection = ({ orderItems }) => {
    const { billSubtotal } = calculateTotals(orderItems);
    const currentDiscount = getCurrentDiscountInfo();

    return (
      <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md border">
        {/* Dropdown for method */}
        <select
          value={currentDiscount.method}
          onChange={(e) => handleDiscountMethodChange(e.target.value)}
          className="text-xs border rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="none">None</option>
          <option value="percentage">%</option>
          <option value="amount">Amount</option>
        </select>

        {/* Input for value */}
        {currentDiscount.method !== "none" && (
          <div className="relative flex-1">
            {currentDiscount.method === "percentage" && (
              <Percent className="w-3 h-3 absolute left-2 top-2 text-gray-400" />
            )}
            {currentDiscount.method === "amount" && (
              <span className="absolute left-2 top-1.5 text-gray-400 text-xs">
                ₹
              </span>
            )}
            <input
              ref={discountValueInputRef}
              type="number"
              placeholder={
                currentDiscount.method === "percentage" ? "0-100" : "Amount"
              }
              min="0"
              max={
                currentDiscount.method === "percentage" ? "100" : billSubtotal
              }
              step={currentDiscount.method === "percentage" ? "0.1" : "0.01"}
              className="w-full pl-6 pr-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              value={currentDiscount.value || ""}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (currentDiscount.method === "percentage") {
                  handleDiscountValueChange(Math.max(0, Math.min(100, value)));
                } else {
                  handleDiscountValueChange(Math.max(0, Math.min(billSubtotal, value)));
                }
              }}
              onFocus={(e) => {
                // Prevent focus loss by ensuring the input stays focused
                setTimeout(() => {
                  if (discountValueInputRef.current) {
                    discountValueInputRef.current.focus();
                  }
                }, 0);
              }}
            />
          </div>
        )}

        {/* Preview */}
        {currentDiscount.value > 0 && (
          <span className="text-xs font-medium text-red-600">
            -₹{calculateTotals(orderItems).discountAmount.toFixed(2)}
          </span>
        )}
      </div>
    );
  };

  // Render unpaid orders section
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
              ₹
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
                      <span className="font-medium text-sm">
                        #{order.orderId}
                      </span>
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
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleUnpaidPaymentMethodChange(order, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      className="text-xs border rounded px-2 py-1 bg-red-100 text-red-700 font-medium hover:bg-red-200 transition-colors"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Settle
                      </option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="room">Hotel Bill</option>
                    </select>
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
    if (activeTab === "KOT") {
      const hasKOTItems = (kotcurrent?.items || []).length > 0;

      return (
        <>
          <div className="p-3">
            <UnpaidOrdersSection />
          </div>

          <div className="flex-1 overflow-y-auto p-2 sm:p-4 max-h-[30rem] max406:max-h-[15rem]">
            {(kotcurrent?.items || []).map((item) => (
              <ItemControls key={item.itemId} item={item} />
            ))}
          </div>

          <div className="p-2 sm:p-4 border-b space-y-2">
            <div className="flex gap-2">
              <div className="relative w-1/2">
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
                        ...prev[selectedTable?.id],
                        name: e.target.value,
                      },
                    }))
                  }
                />
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
                        ...prev[selectedTable?.id],
                        phone: e.target.value,
                      },
                    }))
                  }
                />
              </div>
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
                  printMode === "local" ||
                  (printMode === "bluetooth" && bluetoothConnected)
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
        const selectedOrder = orderGroups.find(
          (group) => group.orderId === selectedOrderId
        );
        const orderItems = selectedOrder?.items || [];
        const {
          billSubtotal,
          taxableSubtotal,
          cgst,
          sgst,
          serviceTax,
          finalTotal,
          discountAmount,
        } = calculateTotals(orderItems);

        return (
          <>
            <div className="p-3">
              <UnpaidOrdersSection />
            </div>

            {renderOrderTabs()}

            <div className="flex-1 overflow-y-auto p-2 sm:p-4 max-h-[19rem] max406:max-h-[10rem]">
              {selectedOrderId ? (
                orderItems.length > 0 ? (
                  orderItems.map((item) => (
                    <ItemControls
                      key={item.itemId}
                      item={item}
                      orderId={selectedOrderId}
                    />
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

              {/* Enhanced Discount Section */}
              <DiscountSection orderItems={orderItems} />
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
                  <span>
                    Service Tax ({institutionData?.serviceTax ?? 0}%):
                  </span>
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
                  selectedOrderId && orderItems.length > 0
                    ? "bg-blue-500"
                    : "bg-gray-400"
                } text-white rounded-lg text-xs sm:text-sm`}
                disabled={!selectedOrderId || orderItems.length === 0}
              >
                Print Selected Order Bill
              </button>

              {printerType !== "local" && (
                <p
                  className={`text-sm ${
                    printMode === "local" ||
                    (printMode === "bluetooth" && bluetoothConnected)
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
                  selectedOrderId && orderItems.length > 0
                    ? "bg-green-500"
                    : "bg-gray-400"
                } text-white rounded-lg text-xs sm:text-sm`}
                disabled={!selectedOrderId || orderItems.length === 0}
              >
                Settle Selected Order
              </button>

              {(institutionData.institution === "bhuk2323" ||
                institutionData.reprintKot === "Yes") && (
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
            {showStaffSelectionModal && <StaffSelectionModal />}
          </>
        );
      } else {
        const hasItems = localBillItems.length > 0;
        const {
          billSubtotal,
          taxableSubtotal,
          cgst,
          sgst,
          serviceTax,
          finalTotal,
          discountAmount,
        } = calculateTotals(localBillItems);

        return (
          <>
            <div className="p-3">
              <UnpaidOrdersSection />
            </div>

            <div className="flex-1 overflow-y-auto p-2 sm:p-4 max-h-[19rem] max406:max-h-[10rem]">
              {localBillItems.length > 0 ? (
                localBillItems.map((item) => (
                  <ItemControls key={item.itemId} item={item} />
                ))
              ) : (
                <p className="text-sm text-gray-500">No bill items available</p>
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
                    value={customerDetails[selectedTable?.id]?.name || ""}
                    onChange={(e) =>
                      setCustomerDetails((prev) => ({
                        ...prev,
                        [selectedTable?.id]: {
                          ...prev[selectedTable?.id],
                          name: e.target.value,
                        },
                      }))
                    }
                  />
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
                          ...prev[selectedTable?.id],
                          phone: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>

              {/* Enhanced Discount Section */}
              <DiscountSection orderItems={localBillItems} />
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
                  <span>
                    Service Tax ({institutionData?.serviceTax ?? 0}%):
                  </span>
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
                    printMode === "local" ||
                    (printMode === "bluetooth" && bluetoothConnected)
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

              {(institutionData.institution === "bhuk2323" ||
                institutionData.reprintKot === "Yes") && (
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
            {showStaffSelectionModal && <StaffSelectionModal />}
          </>
        );
      }
    }
  };

  const ItemControls = ({ item, orderId }) => (
    <div
      key={item.itemId}
      className="flex items-center justify-between p-3 border-b group"
    >
      <div className="flex-1">
        <div className="flex justify-between">
          <p className="font-medium text-sm">{item.itemName || item.name}</p>
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
              onClick={() =>
                handleRemoveItemFromKOT(selectedTable?.id, item.itemId)
              }
              className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center">
            <button
              onClick={() =>
                handleUpdateItemQuantity(
                  selectedTable?.id,
                  item.itemId,
                  item.quantity - 1
                )
              }
              className="w-6 h-6 flex items-center justify-center border rounded"
            >
              -
            </button>
            <span className="mx-2 text-sm">{item.quantity}</span>
            <button
              onClick={() =>
                handleUpdateItemQuantity(
                  selectedTable?.id,
                  item.itemId,
                  item.quantity + 1
                )
              }
              className="w-6 h-6 flex items-center justify-center border rounded"
            >
              +
            </button>
          </div>
          <span className="text-sm">
            ₹{(item.price * item.quantity).toFixed(2)}
          </span>
        </div>
        {splitBillMode && orderId && (
          <div className="mt-1">
            <span className="text-xs text-gray-500">Order ID: {orderId}</span>
          </div>
        )}
      </div>
    </div>
  );

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

  const SettleModal = () => {
    if (!showSettleModal || !selectedUnpaidOrder) return null;

    const needsRoom = selectedUnpaidOrder.paymentMethod === "ROOM";
    const hasRoom = !!selectedUnpaidOrder.bookingInfo?.roomNumber;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 w-80">
          <h3 className="text-lg font-semibold mb-4 text-center">
            Confirm Settlement
          </h3>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Order ID:</span>
              <span className="text-sm font-medium">
                #{selectedUnpaidOrder.orderId}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Table:</span>
              <span className="text-sm font-medium">
                {selectedUnpaidOrder.tableName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Amount:</span>
              <span className="text-sm font-bold text-green-600">
                ₹{Number(selectedUnpaidOrder.totalAmount || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Payment Method:</span>
              <span className="text-sm font-medium capitalize">
                {selectedUnpaidOrder.paymentMethod}
              </span>
            </div>
            {needsRoom && (
              <div className="mt-3">
                <label className="block text-sm text-gray-600 mb-1">
                  Select Room:
                </label>
                <select
                  value={selectedUnpaidOrder.bookingInfo?.bookingId || ""}
                  onChange={(e) => {
                    const bookingId = e.target.value;
                    const booking = (hotelBookings || []).find(
                      (b) => b.bookingId === bookingId
                    );
                    setSelectedUnpaidOrder((prev) => ({
                      ...prev,
                      bookingInfo: booking
                        ? {
                            bookingId: booking.bookingId,
                            roomNumber: booking.roomNumber,
                          }
                        : { bookingId: "", roomNumber: "" },
                    }));
                  }}
                  className="w-full border rounded-md p-2 text-sm"
                >
                  <option value="" disabled>
                    Select a room
                  </option>
                  {(hotelBookings || []).map((b) => (
                    <option key={b.bookingId} value={b.bookingId}>
                      Room {b.roomNumber}{" "}
                      {b.guestName ? `— ${b.guestName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowSettleModal(false);
                setSelectedUnpaidOrder(null);
              }}
              className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmSettleOrder}
              disabled={needsRoom && !hasRoom}
              className={`flex-1 py-2 px-4 rounded-md text-white transition-colors ${
                needsRoom && !hasRoom
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Staff Selection Modal
  const StaffSelectionModal = () =>
    showStaffSelectionModal && (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg relative max-w-md w-full">
          <button
            onClick={() => setShowStaffSelectionModal(false)}
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
            customer.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Staff Member:
            </label>
            <select
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
            >
              <option value="">Select a staff member</option>
              {(staffData || []).map((staff) => (
                <option key={staff.cognitoId} value={staff.userName}>
                  {staff.userName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowStaffSelectionModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignStaffToBill}
              disabled={!selectedStaff}
              className={`px-4 py-2 ${
                selectedStaff
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

  const MoveItemModal = () => {
    if (!movingItem) return null;

    const otherOrders = orderGroups.filter(
      (group) => group.orderId !== selectedOrderId
    );
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
          <h2 className="text-lg font-semibold mb-4">
            Move Item to Another Order
          </h2>
          <p className="mb-2">
            Moving: {movingItem.itemName || movingItem.name}
          </p>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Quantity to Move:
            </label>
            <div className="flex items-center">
              <button
                onClick={() =>
                  setMoveQuantity((prev) => Math.max(1, prev - 1))
                }
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
                onClick={() =>
                  setMoveQuantity((prev) => Math.min(maxQuantity, prev + 1))
                }
                className="w-8 h-8 flex items-center justify-center border rounded-r"
                disabled={moveQuantity >= maxQuantity}
              >
                +
              </button>
              <span className="ml-2 text-sm text-gray-500">
                of {maxQuantity} available
              </span>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Select Target Order:
            </label>
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
                moveItemBetweenOrders(
                  movingItem,
                  selectedOrderId,
                  targetOrderId,
                  moveQuantity
                )
              }
              disabled={!targetOrderId}
              className={`px-4 py-2 ${
                targetOrderId
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-300"
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
      <SettleModal />
      <StaffSelectionModal />
      <MoveItemModal />
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
          // Pass discount props
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
    </>
  );
};

export default OrderContent; 
    