import React, { useState, useEffect, useRef, useContext } from "react";
import { toast } from "react-toastify";
import { API } from "aws-amplify";
import TableGrid from "./TableGrid";
import CategoryList from "./CategoryList";
import MenuItems from "./MenuItems";
import OrderPanel from "./OrderPanel";
import PaymentModal from "./PaymentModal";
import ResponsivePOSLayout from "./Mobile-layout/mobile-pos";
import { useWebSocket } from "../../../../Context/WebSocketContext";
import PrintKOT from "./PrintKOT";
import PrintBill from "./PrintBill";
import { Context } from "../../../../Context";
import data from '../../../../../Operation/data.json';

const RestaurantPOS = ({ itemsData = [], institutionData, userData, hotelBookings }) => {
  const { printerType } = data;
  const { setLoader, addHotelService, nextBillNumber, fetchNextBillNumber } = useContext(Context);
  const { subscribe, isConnected } = useWebSocket();
  const [showReprintKOT, setShowReprintKOT] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [printAllItems, setPrintAllItems] = useState(false);
  const [customerDetails, setCustomerDetails] = useState({});
  const [tableOccupancy, setTableOccupancy] = useState({});
  const [billItemsByStore, setBillItemsByStore] = useState({});
  const [ordersId, setorderId] = useState({});
  const [unpaidOrders, setUnpaidOrders] = useState([]);
  
  // DISCOUNT STATE - Moved to parent component
  const [discountData, setDiscountData] = useState({}); // { tableId: { method: 'percentage'|'amount'|'none', value: number, amount: number } } or { tableId: { orderId: { method, value, amount } } }

  const totalTableNumber = institutionData?.Table?.length || 0;
  const [isAudioEnabled, setIsAudioEnabled] = useState(localStorage.getItem("audioEnabled") === "true");
  const [orderIds, setorderIds] = useState({});
  const [localBillItems, setLocalBillItems] = useState([]);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const pendingSoundRef = useRef(false);

  // Split Bill Modal States
  const [showOrderIdModal, setShowOrderIdModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [pendingKOTData, setPendingKOTData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const takeawayCount = institutionData?.institution === 'chineseq18' ? 4 : institutionData?.institution === 'Hang7438' ? 10 : 10;
const [tables, setTables] = useState([
  // Restaurant tables
  ...(institutionData?.Table || []).map(t => ({
    id: t.tableNo,
    name: `Table ${t.tableNo}`,
    status: "available",
    orders: [],
    currentBill: 0,
    orderType: "dineIn",
  })),

  // Takeaway counters
  ...Array(takeawayCount).fill(null).map((_, i) => ({
    id: `takeaway${i + 1}`,
    name: `Takeaway ${i + 1}`,
    status: "available",
    orders: [],
    currentBill: 0,
    orderType: "takeaway",
  })),

  // Swiggy counters (1 to 10)
  ...Array(10).fill(null).map((_, i) => ({
    id: `Swiggy${i + 1}`,
    name: `Swiggy ${i + 1}`,
    status: "available",
    orders: [],
    currentBill: 0,
    orderType: "swiggy",
  })),

  // Zomato counters (1 to 10)
  ...Array(10).fill(null).map((_, i) => ({
    id: `Zomato${i + 1}`,
    name: `Zomato ${i + 1}`,
    status: "available",
    orders: [],
    currentBill: 0,
    orderType: "zomato",
  })),

  // Hotel rooms
  ...(institutionData?.integration === "HOTEL" && hotelBookings
    ? hotelBookings.map(booking => {
        const sanitizedRoomNumber = booking.roomNumber.replace(/[^a-zA-Z0-9]/g, '');
        return {
          id: `Hotel${sanitizedRoomNumber}`,
          name: `Hotel ${booking.roomNumber}`,
        status: "available",
        orders: [],
        currentBill: 0,
        orderType: "hotel",
        };
      })
    : []
  ),

  // Management rooms
  {
    id: "Management444",
    name: "MNG 444",
    status: "available",
    orders: [],
    currentBill: 0,
    orderType: "management",
  },
  {
    id: "Management555",
    name: "MNG 555",
    status: "available",
    orders: [],
    currentBill: 0,
    orderType: "management",
  },
]);

  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [selectedTable, setSelectedTable] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeTab, setActiveTab] = useState("KOT");
  const [KOTByTable, setKOTByTable] = useState({});
  const [currentKOT, setCurrentKOT] = useState({ items: [], totalAmount: 0 });
  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingOrdersByTable, setPendingOrdersByTable] = useState({});
  const [tableData, setTableData] = useState({});
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [allTablesData, setAllTablesData] = useState(null);
  const [tableInstructions, setTableInstructions] = useState({});

  // Bluetooth State
  const [device, setDevice] = useState(null);
  const [server, setServer] = useState(null);
  const [connected, setConnected] = useState(false);
  const [characteristics, setCharacteristics] = useState([]);

  // Fetch unpaid orders
  const fetchUnpaidOrders = async () => {
    try {
      setLoader(true);
      const type = institutionData?.bar_integration === "Yes" ? "bar" : "cafe";
      const result = await API.get("main", `/admin/unpaid-orders/${institutionData.institution}?type=${type}`);
      const responseBody = result.body ? JSON.parse(result.body) : result;
      setUnpaidOrders(responseBody.orders || []);
      setLoader(false);
    } catch (error) {
      console.error("Error fetching unpaid orders:", error);
      setLoader(false);
      toast.error("Failed to fetch unpaid orders.");
    }
  };

// Helper function to calculate totals with discount
const calculateTotals = (items, discountInfo = null) => {
  const billSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  // Updated: Exclude 'bar' type AND 'No Tax Beverage' category from taxable subtotal
  const taxableSubtotal = items.reduce((sum, item) => {
    const isTaxable = item.type !== 'bar' && item.category !== 'No Tax Beverage';
    return sum + (isTaxable ? item.price * item.quantity : 0);
  }, 0);
  
  const cgstRate = institutionData?.cgst ?? 2.5;
  const sgstRate = institutionData?.sgst ?? 2.5;
  const serviceTaxRate = institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0;

  // Calculate discount
  let discountAmount = 0;
  let discountPercentage = 0;
  
  if (discountInfo) {
    if (discountInfo.method === "percentage" && discountInfo.value > 0) {
      discountPercentage = Math.min(Number(discountInfo.value), 100);
      discountAmount = (billSubtotal * discountPercentage) / 100;
    } else if (discountInfo.method === "amount" && discountInfo.value > 0) {
      discountAmount = Math.min(Number(discountInfo.value), billSubtotal);
    }
  }

  const discountedSubtotal = billSubtotal - discountAmount;
  // Updated: Apply discount to taxable subtotal (prorate or cap at taxable amount)
  const discountedTaxableSubtotal = Math.max(0, taxableSubtotal - Math.min(discountAmount, taxableSubtotal));
  
  const cgst = (discountedTaxableSubtotal * cgstRate) / 100;
  const sgst = (discountedTaxableSubtotal * sgstRate) / 100;
  const serviceTax = (discountedSubtotal * serviceTaxRate) / 100;

  const finalTotal = institutionData?.cgst === 0 || institutionData?.sgst === 0
    ? Math.round(discountedSubtotal + serviceTax)
    : Math.round(discountedSubtotal + cgst + sgst + serviceTax);

  return {
    billSubtotal,
    taxableSubtotal,
    cgst,
    sgst,
    serviceTax,
    finalTotal,
    discountAmount,
    discountPercentage,
    discountMethod: discountInfo?.method || "none"
  };
};

  // Helper function to get booking from table name
  const getBookingFromTableName = (tableIdStr) => {
    const tableObj = tables.find(t => String(t.id) === tableIdStr);
    const tableName = tableObj?.name || "";
    let booking = null;
    if (tableName.toLowerCase().startsWith("hotel ")) {
      const roomNumber = tableName.replace(/^hotel\s+/i, "");
      booking = hotelBookings?.find((b) => String(b.roomNumber) === String(roomNumber));
    } else if (tableName.toLowerCase().startsWith("room ")) {
      const roomNumber = tableName.replace(/^room\s+/i, "");
      booking = hotelBookings?.find((b) => String(b.roomNumber) === String(roomNumber));
    } else if (String(tableIdStr).toLowerCase().startsWith("hotel")) {
      const cleanId = String(tableIdStr).toLowerCase().replace(/^hotel/, "");
      booking = hotelBookings?.find((b) => String(b.roomNumber).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() === cleanId);
    }
    return booking;
  };

  // Split Bill Modal Functions
  const handleCreateNewOrder = async () => {
    if (!pendingKOTData) return;
    setIsLoading(true);
    const { tableIdStr, tableDataForTable } = pendingKOTData;

    try {
      const kotnow = KOTByTable[tableIdStr] || { items: [], totalAmount: 0 };
      const { billSubtotal, taxableSubtotal, cgst, sgst, serviceTax, finalTotal } = calculateTotals(kotnow.items);
    const isHotelTable = tableIdStr?.toLowerCase().startsWith("hotel");
    // Resolve bookingId for hotel tables
    let bookingid = null;
    let guestid = null;
   if (isHotelTable) {
      const booking = getBookingFromTableName(tableIdStr);
      bookingid = booking?.bookingId;
      guestid = booking?.guest_id;
      if (!bookingid) {
        console.warn(`No booking found for table ${tableIdStr}. Skipping amend-booking API call.`);
      }
    }
    const getDaySessionFromStorage = () => {
    try {
      // First try to get table-specific session
      const tableSpecificSession = localStorage.getItem(`daySession_${institutionData.institution}_${tableIdStr}`);
      if (tableSpecificSession) {
        return tableSpecificSession;
      }
      
      // Fallback to global session
      const globalSession = localStorage.getItem(`daySession_${institutionData.institution}_global`);
      if (globalSession) {
        return globalSession;
      }
      
      // Default fallback
      return "breakfast";
    } catch (error) {
      console.error("Error retrieving day session from localStorage:", error);
      return "breakfast";
    }
  };

  const currentDaySession = getDaySessionFromStorage();
      await API.post("main", `/any/create-order/${institutionData.institution}`, {
        body: {
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
          name: customerDetails[tableIdStr]?.name || "",
          phoneNumber: customerDetails[tableIdStr]?.phone || "",
          tableName: tableIdStr,
          totalAmount: finalTotal,
          currency: tableDataForTable.kotItems[0]?.currency || "INR",
          items: kotnow.items,
          cgst,
          sgst,
          serviceTax,
          instruction: tableInstructions[tableIdStr] || '',
          ...(userData && { orderBy: userData.cognitoId }),
          tableOccupied: true,
          daySession: currentDaySession,
        },
      });
if (isHotelTable) {
       await API.put("frontdesk", `/offline/amend-booking/${bookingid}?institutionId=${institutionData.institution}`, {
        body: {
          restaurant_hold: true,
        },
      });
    }
      await API.post("main", `/admin/orders-bill/${institutionData.institution}/${tableIdStr}`, {
        body: {
          name: customerDetails[tableIdStr]?.name || "",
          phoneNumber: customerDetails[tableIdStr]?.phone || "",
          items: tableDataForTable.mergedItems,
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });

      toast.success("New order created successfully");
      setShowCreateOrderModal(false);
      setPendingKOTData(null);
      await fetchAllTableData();
    } catch (error) {
      console.error("Error creating new order:", error);
      toast.error("Failed to create new order.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderIdSelection = async (orderId) => {
    if (!pendingKOTData || !orderId) {
      toast.warning("Please select an order ID");
      return;
    }

    setIsLoading(true);
    const { tableIdStr, tableDataForTable } = pendingKOTData;
    const kotnow = KOTByTable[tableIdStr] || { items: [], totalAmount: 0 };

    try {
      const { cgst, sgst, serviceTax } = calculateTotals(kotnow.items);

      await API.post("main", `/admin/split-update-items/${institutionData.institution}/${tableIdStr}/${orderId}`, {
        body: {
          items: kotnow.items,
          serviceTaxPercentage: institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0,
          cgstPercentage: institutionData?.cgst ?? 2.5,
          sgstPercentage: institutionData?.sgst ?? 2.5,
          cgst,
          sgst,
          serviceTax,
          instruction: tableInstructions[tableIdStr] || '',
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });

      await API.post("main", `/admin/orders-bill/${institutionData.institution}/${tableIdStr}`, {
        body: {
          name: customerDetails[tableIdStr]?.name || "",
          phoneNumber: customerDetails[tableIdStr]?.phone || "",
          items: tableDataForTable.mergedItems,
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });

      toast.success("KOT Updated Successfully for Order ID: " + orderId);
      setShowOrderIdModal(false);
      setPendingKOTData(null);
      setSelectedOrderId(null);
      await fetchAllTableData();
    } catch (error) {
      console.error("Error updating KOT for selected order:", error);
      toast.error("Failed to update KOT.");
    } finally {
      setIsLoading(false);
    }
  };

  // Bluetooth Functions
  const requestDevice = async () => {
    if (!navigator.bluetooth) {
      toast.error("Web Bluetooth API is not supported in this browser.");
      return;
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
      });

      setDevice(device);
      localStorage.setItem("bluetoothDeviceId", device.id);
      localStorage.setItem("bluetoothDeviceName", device.name);
      toast.success("Device selected: " + device.name);
      device.addEventListener("gattserverdisconnected", handleDisconnect);
      await connectToDevice(device);
    } catch (error) {
      console.error("Error requesting device:", error);
      toast.error("Failed to request Bluetooth device");
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    setServer(null);
    setCharacteristics([]);
    toast.error("Printer disconnected. Please reconnect manually.");
  };

  const restoreConnection = async (deviceId, deviceName) => {
    if (!navigator.bluetooth) {
      toast.error("Web Bluetooth API is not supported in this browser.");
      return;
    }

    if (device && device.gatt.connected) {
      setServer(device.gatt);
      setConnected(true);
      await discoverServicesAndCharacteristics(device.gatt);
      toast.success("Restored connection to " + deviceName);
      return;
    }

    try {
      if (!device) {
        toast.info("Please reconnect to the printer manually.");
        return;
      }
      toast.info("Restoring connection to " + deviceName);
      await connectToDevice(device);
    } catch (error) {
      console.error("Error restoring connection:", error);
      toast.error("Failed to restore connection: ");
      setConnected(false);
    }
  };

  const connectToDevice = async (selectedDevice) => {
    if (!selectedDevice) {
      toast.error("No device selected.");
      return;
    }

    try {
      if (selectedDevice.gatt.connected) {
        setServer(selectedDevice.gatt);
        setConnected(true);
        await discoverServicesAndCharacteristics(selectedDevice.gatt);
        toast.success("Already connected to " + selectedDevice.name);
        return;
      }

      const server = await selectedDevice.gatt.connect();
      setServer(server);
      setConnected(true);
      toast.success("Connected to " + selectedDevice.name);
      await discoverServicesAndCharacteristics(server);
    } catch (error) {
      console.error("Error connecting to device:", error);
      toast.error("Failed to connect to device: ");
      setConnected(false);
    }
  };

  const discoverServicesAndCharacteristics = async (server) => {
    if (!server) return;

    try {
      const services = await server.getPrimaryServices();
      const chars = [];
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        chars.push(...characteristics);
      }
      setCharacteristics(chars);
      if (chars.length === 0) toast.error("No characteristics found.");
    } catch (error) {
      console.error("Error discovering services:", error);
      toast.error("Failed to discover services: ");
    }
  };

  const printData = async (data) => {
    if (!connected || !characteristics.length) {
      toast.error("No printer connected. Please connect first.");
      return;
    }

    try {
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(data);
      const writeCharacteristic = characteristics.find(
        (char) => char.properties.write || char.properties.writeWithoutResponse
      );

      if (!writeCharacteristic) {
        toast.error("No writable characteristic found.");
        return;
      }

      const maxChunkSize = 512;
      for (let offset = 0; offset < encodedData.length; offset += maxChunkSize) {
        const chunk = encodedData.slice(offset, offset + maxChunkSize);
        await writeCharacteristic.writeValue(chunk);
      }

      toast.success("Print command sent successfully.");
    } catch (error) {
      console.error("Error sending data:", error);
      toast.error("Failed to print: ");
    }
  };

  // Show printer modal on every mount
  useEffect(() => {
    if (printerType === "local") {
      return;
    }
    setShowPrinterModal(true);
    const storedDeviceId = localStorage.getItem("bluetoothDeviceId");
    const storedDeviceName = localStorage.getItem("bluetoothDeviceName");

    if (storedDeviceId && storedDeviceName && !device) {
      restoreConnection(storedDeviceId, storedDeviceName);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Modified fetchAllTableData to include unpaid orders and extract discount data
  const fetchAllTableData = async () => {
    try {
      setLoader(true);
      const type = institutionData?.bar_integration === "Yes" ? "bar" : "cafe";

      const [tableResult, unpaidResult] = await Promise.all([
        API.get("main", `/admin/get-tabledata/${institutionData.institution}?type=${type}`, {}),
        API.get("main", `/admin/unpaid-orders/${institutionData.institution}?type=${type}`)
      ]);

      // Process table data
      const responseBody = tableResult.body ? JSON.parse(tableResult.body) : tableResult;
      const responseData = responseBody.data || {};
      setAllTablesData(responseData);

      let orderData = [];
      const newDiscountData = {};

      if (!Array.isArray(responseData)) {
        Object.entries(responseData).forEach(([tableId, tableInfo]) => {
          const tableOrders = tableInfo.orders || [];
          
          // Extract discount data from orders
          if (tableOrders.length > 0) {
            const tableDiscounts = {};
            tableOrders.forEach(order => {
              let discountMethod = "none";
              let discountValue = 0;
              const discountAmount = order.discountAmount || 0;
              
              if (discountAmount > 0) {
                if (order.discountPercentage > 0) {
                  discountMethod = "percentage";
                  discountValue = order.discountPercentage;
                } else {
                  discountMethod = "amount";
                  discountValue = discountAmount;
                }
              }
              
              tableDiscounts[order.orderId] = {
                method: discountMethod,
                value: discountValue,
                amount: discountAmount
              };
            });
            newDiscountData[tableId] = tableDiscounts;
          } else {
            // For tables without split orders, check if there's any discount in tableInfo
            newDiscountData[tableId] = {
              method: "none",
              value: 0,
              amount: 0
            };
          }

          if (tableOrders.length === 0) {
            orderData.push({
              tableName: tableId,
              tableOccupied: tableInfo.tableOccupied,
              totalAmount: tableInfo.totalAmount || 0,
              totalCGST: tableInfo.totalCGST || 0,
              totalSGST: tableInfo.totalSGST || 0,
              totalServiceTax: tableInfo.totalServiceTax || 0,
              billItems: tableInfo.billItems || [],
              kotItems: tableInfo.kotItems || [],
              mergedItems: tableInfo.mergedItems || []
            });
          } else {
            tableOrders.forEach(order => {
              orderData.push({
                ...order,
                tableName: tableId,
                tableOccupied: tableInfo.tableOccupied
              });
            });
          }
        });
      } else {
        orderData = responseData;
      }

      // Update discount data state
      setDiscountData(newDiscountData);

      const allTableIds = [...new Set(orderData.map((order) => order.tableName))];
      const pendingOrders = orderData.filter((order) => !order.tableOccupied);
      const ordersByTable = pendingOrders.reduce((acc, order) => {
        acc[order.tableName] = acc[order.tableName] || [];
        acc[order.tableName].push(order);
        return acc;
      }, {});

      const occupancy = orderData.reduce((acc, order) => {
        acc[order.tableName] = order.tableOccupied === true;
        return acc;
      }, {});

      const tableDataMap = {};
      if (!Array.isArray(responseData)) {
        Object.entries(responseData).forEach(([tableId, tableInfo]) => {
          processTableData(tableId, tableInfo);
          tableDataMap[tableId] = tableInfo;
        });
      }

      setTables((prev) =>
        prev.map((table) => {
          const tableIdStr = String(table.id);
          if (!occupancy[tableIdStr] && !ordersByTable[tableIdStr]?.length) {
            return {
              ...table,
              orders: [],
              currentBill: 0,
              status: "available"
            };
          }

          const tableInfo = responseData[tableIdStr];
          if (tableInfo && tableInfo.mergedItems && tableInfo.mergedItems.length > 0) {
            return {
              ...table,
              orders: tableInfo.mergedItems,
              currentBill: tableInfo.totalAmount || 0,
              status: "occupied"
            };
          }

          return table;
        })
      );

      setPendingOrders(pendingOrders);
      setPendingOrdersByTable(ordersByTable);
      setTableOccupancy(occupancy);
      setTableData(tableDataMap);

      // Process unpaid orders
      const unpaidResponseBody = unpaidResult.body ? JSON.parse(unpaidResult.body) : unpaidResult;
      setUnpaidOrders(unpaidResponseBody.orders || []);

      setLoader(false);
    } catch (error) {
      console.error("Error fetching table data or unpaid orders:", error);
      setLoader(false);
      toast.error("Failed to fetch data.");
    }
  };

  // Function to handle settling an unpaid order
const settleUnpaidOrder = async (order, paymentMethod, settleBody = null) => {
  if (!order || !paymentMethod) {
    toast.error("Order or payment method not selected.");
    return;
  }

  setLoader(true);
  try {
    const tableIdStr = String(order.tableName);
    let booking = null;

    // Handle booking logic for hotel orders
    if (settleBody?.bookingInfo && settleBody.bookingInfo.bookingId) {
      booking =
        hotelBookings?.find((b) => String(b.bookingId) === String(settleBody.bookingInfo.bookingId)) || null;
    } else {
      const isHotelOrder = tableIdStr.toLowerCase().startsWith("hotel");
      if (isHotelOrder) {
        booking = getBookingFromTableName(tableIdStr);
      }
    }

    // Add hotel service if booking exists
    if (booking) {
      const items = order.items || [];
      const totalFoodBill = items.reduce(
        (sum, item) => sum + (item.type !== "bar" ? item.price * item.quantity : 0),
        0
      );
      const totalBarBill = items.reduce(
        (sum, item) => sum + (item.type === "bar" ? item.price * item.quantity : 0),
        0
      );

      const totals = calculateTotals(order.items || []);
      const totalFoodBillWithGST = totalFoodBill + totals.cgst + totals.sgst;

      await addHotelService(booking?.bookingId, {
        [booking.roomNumber]: {
          [new Date().toISOString().split("T")[0]]: [
            {
              food_charges: totalFoodBillWithGST,
              extra_bed_charges: 0,
              laundry_charges: 0,
              manual_charges: 0,
              minibar_charges: totalBarBill,
              order_id: order.orderId,
            },
          ],
        },
      });
    }

    // Prepare the API body
    const apiBody = {
      paymentStatus: paymentMethod === "Void" ? true : true,
      paymentMode: "offline",
      type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
      table: false,
      ...(booking && booking.roomNumber ? { room_number: "Hotel"+booking.roomNumber } : {}),
    };

    // Helper: pull orderSource/payerName out of settleBody (either top-level or inside meta)
    const extractField = (fieldName) => {
      if (settleBody && settleBody[fieldName]) return settleBody[fieldName];
      if (settleBody && settleBody.meta && settleBody.meta[fieldName]) return settleBody.meta[fieldName];
      return undefined;
    };

    const orderSourceVal = extractField("orderSource");
    const payerNameVal = extractField("payerName");

    // Attach top-level orderSource/payerName if present
    if (orderSourceVal !== undefined && orderSourceVal !== null && String(orderSourceVal).trim() !== "") {
      apiBody.orderSource = orderSourceVal;
    }
    if (payerNameVal !== undefined && payerNameVal !== null && String(payerNameVal).trim() !== "") {
      apiBody.name = payerNameVal;
    }

    // Preserve remaining meta keys (except orderSource/payerName) if any
    if (settleBody?.meta && typeof settleBody.meta === "object") {
      const remainingMeta = Object.keys(settleBody.meta).reduce((acc, k) => {
        if (k !== "orderSource" && k !== "payerName") acc[k] = settleBody.meta[k];
        return acc;
      }, {});
      if (Object.keys(remainingMeta).length > 0) {
        apiBody.meta = remainingMeta;
      }
    }

    // For partial payments, include paymentMethods array; otherwise, use single paymentMethod
    if (settleBody?.paymentMethods && paymentMethod === "Multiple") {
      apiBody.paymentMethods = settleBody.paymentMethods;
      if (settleBody.narration) {
        apiBody.narration = settleBody.narration;
      }
    } else {
      apiBody.paymentMethod = paymentMethod;
      if (settleBody?.narration) {
        apiBody.narration = settleBody.narration;
      }
    }
if (
  institutionData.bar_integration === "Yes" 
) {
  apiBody.dateId = institutionData.dateId;
}
    if (institutionData?.integration === "HOTEL" || institutionData?.hotel_integration === true || institutionData?.hotel_integration === "Yes") {
      apiBody.hotelIntegration = true;
    }
    const isHotelTable = tableIdStr?.toLowerCase().startsWith("hotel");
    // Make the API call to settle the order
    const settleRes = await API.post(
      "main",
      `/admin/settle-bill-order/${institutionData.institution}/${tableIdStr}/${order.orderId}`,
      {
        body: apiBody,
      }
    );
    if (typeof fetchNextBillNumber === "function") fetchNextBillNumber();

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

    toast.success(`Order ${order.orderId} settled successfully!`);
    await fetchAllTableData(); // Refresh data
  } catch (error) {
    console.error("Error settling unpaid order:", error);
    let errorMessage = "Failed to settle order.";
    if (error?.response?.data) {
      const apiError = error.response.data;
      if (apiError.message) errorMessage += ` - ${apiError.message}`;
      if (apiError.error) errorMessage += `: ${apiError.error}`;
    }
    toast.error(errorMessage);
  } finally {
    setLoader(false);
  }
};


  const processTableData = (tableId, tableInfo) => {
    if (!tableId || !tableInfo) return;

    const tableIdStr = String(tableId);
    const orderId = tableInfo.orders && tableInfo.orders.length > 0
      ? tableInfo.orders
          .map(order => order.orderId)
          .filter(id => id !== null && id !== undefined)
          .join(',')
      : null;

    setorderId((prev) => ({
      ...prev,
      [tableIdStr]: orderId
    }));

    const kotItems = tableInfo.kotItems || [];
    const billItems = tableInfo.billItems || [];
    const mergedItems = tableInfo.mergedItems || [];
    
    const { billSubtotal, taxableSubtotal, cgst, sgst, serviceTax, finalTotal } = calculateTotals(mergedItems);

    const phoneNumber = tableInfo.phoneNumber || "";
    const customerName = tableInfo.customerName || "";
    const kotNumber = tableInfo.kotNumber || "";
    const instruction = tableInfo.instruction || "";

    setCustomerDetails((prev) => ({
      ...prev,
      [tableIdStr]: {
        phone: phoneNumber,
        name: customerName
      }
    }));

    setBillItemsByStore((prev) => ({
      ...prev,
      [tableIdStr]: {
        items: kotItems.map((item) => ({ ...item, name: item.name })),
        billItems: billItems.map((item) => ({ ...item, name: item.name })),
        totalAmount: finalTotal,
      },
    }));

    setTableData((prev) => ({
      ...prev,
      [tableIdStr]: {
        kotItems,
        billItems,
        mergedItems,
        totalAmount: finalTotal,
        totalCGST: cgst.toFixed(2),
        totalSGST: sgst.toFixed(2),
        totalServiceTax: serviceTax.toFixed(2),
        instruction
      },
    }));

    setKOTByTable((prev) => ({
      ...prev,
      [tableIdStr]: {
        items: kotItems.map((item) => ({ ...item, name: item.name })),
        billItems: billItems.map((item) => ({ ...item, name: item.name })),
        totalAmount: finalTotal,
        kotNumber,
      },
    }));

    setTableInstructions((prev) => ({
      ...prev,
      [tableIdStr]: instruction
    }));

    if (String(selectedTable?.id) === tableIdStr) {
      setCurrentKOT({
        items: kotItems.map((item) => ({ ...item, name: item.name })),
        totalAmount: finalTotal
      });
    }
  };

  const fetchTableData = async (tableId) => {
    if (!tableId || !institutionData?.institution) return null;
    setLoader(true);
    const tableIdStr = String(tableId);

    try {
      if (allTablesData && allTablesData[tableIdStr]) {
        const tableInfo = allTablesData[tableIdStr];
        processTableData(tableIdStr, tableInfo);
        setLoader(false);
        return tableInfo;
      }
      setLoader(false);
      return null;
    } catch (error) {
      console.error("Error fetching table data:", error);
      setLoader(false);
      return null;
    }
  };

  const addItemToKOT = (tableId, item) => {
    if (!tableId) return;

    const tableIdStr = String(tableId);

    setTableData((prev) => {
      const currentTable = prev[tableIdStr] || {
        kotItems: [],
        billItems: [],
        mergedItems: [],
        totalAmount: 0,
        totalCGST: "0.00",
        totalSGST: "0.00",
        totalServiceTax: "0.00"
      };

      const existingItem = currentTable.mergedItems.find((i) => i.itemId === item.itemId);
      const updatedMergedItems = existingItem
        ? currentTable.mergedItems.map((i) =>
            i.itemId === item.itemId ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [...currentTable.mergedItems, { ...item, quantity: 1 }];

      const updatedKotItems = updatedMergedItems.filter((item) =>
        currentTable.billItems.every((billItem) => billItem.itemId !== item.itemId)
      );

      const { billSubtotal, taxableSubtotal, cgst, sgst, serviceTax, finalTotal } = calculateTotals(updatedMergedItems);

      return {
        ...prev,
        [tableIdStr]: {
          ...currentTable,
          kotItems: updatedKotItems,
          mergedItems: updatedMergedItems,
          totalAmount: finalTotal,
          totalCGST: cgst.toFixed(2),
          totalSGST: sgst.toFixed(2),
          totalServiceTax: serviceTax.toFixed(2)
        },
      };
    });

    setKOTByTable((prev) => {
      const currentKOT = prev[tableIdStr] || { items: [], totalAmount: 0 };
      const newItems = currentKOT.items.some((i) => i.itemId === item.itemId)
        ? currentKOT.items.map((i) =>
            i.itemId === item.itemId ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [...currentKOT.items, { ...item, quantity: 1 }];

      const { finalTotal } = calculateTotals(newItems);
      const updatedKOT = { items: newItems, totalAmount: finalTotal };

      setCurrentKOT(updatedKOT);
      return { ...prev, [tableIdStr]: updatedKOT };
    });
  };

  const updateItemQuantity = (tableId, itemId, newQuantity) => {
    if (newQuantity < 1) return removeItemFromKOT(tableId, itemId);

    const tableIdStr = String(tableId);

    setTableData((prev) => {
      const currentTable = prev[tableIdStr] || {
        kotItems: [],
        billItems: [],
        mergedItems: [],
        totalAmount: 0,
        totalCGST: "0.00",
        totalSGST: "0.00",
        totalServiceTax: "0.00"
      };

      const updatedMergedItems = currentTable.mergedItems.map((i) =>
        i.itemId === itemId ? { ...i, quantity: newQuantity } : i
      );

      const updatedKotItems = updatedMergedItems.filter((item) =>
        currentTable.billItems.every((billItem) => billItem.itemId !== item.itemId)
      );

      const { billSubtotal, taxableSubtotal, cgst, sgst, serviceTax, finalTotal } = calculateTotals(updatedMergedItems);

      return {
        ...prev,
        [tableIdStr]: {
          ...currentTable,
          kotItems: updatedKotItems,
          mergedItems: updatedMergedItems,
          totalAmount: finalTotal,
          totalCGST: cgst.toFixed(2),
          totalSGST: sgst.toFixed(2),
          totalServiceTax: serviceTax.toFixed(2)
        },
      };
    });

    setKOTByTable((prev) => {
      const currentKOT = prev[tableIdStr] || { items: [], totalAmount: 0 };
      const newItems = currentKOT.items.map((i) =>
        i.itemId === itemId ? { ...i, quantity: newQuantity } : i
      );

      const { finalTotal } = calculateTotals(newItems);
      const updatedKOT = { items: newItems, totalAmount: finalTotal };

      setCurrentKOT(updatedKOT);
      return { ...prev, [tableIdStr]: updatedKOT };
    });
  };

  const removeItemFromKOT = (tableId, itemId) => {
    const tableIdStr = String(tableId);

    setTableData((prev) => {
      const currentTable = prev[tableIdStr] || {
        kotItems: [],
        billItems: [],
        mergedItems: [],
        totalAmount: 0,
        totalCGST: "0.00",
        totalSGST: "0.00",
        totalServiceTax: "0.00"
      };

      const updatedMergedItems = currentTable.mergedItems.filter((i) => i.itemId !== itemId);
      const updatedKotItems = updatedMergedItems.filter((item) =>
        currentTable.billItems.every((billItem) => billItem.itemId !== item.itemId)
      );

      const { billSubtotal, taxableSubtotal, cgst, sgst, serviceTax, finalTotal } = calculateTotals(updatedMergedItems);

      return {
        ...prev,
        [tableIdStr]: {
          ...currentTable,
          kotItems: updatedKotItems,
          mergedItems: updatedMergedItems,
          totalAmount: finalTotal,
          totalCGST: cgst.toFixed(2),
          totalSGST: sgst.toFixed(2),
          totalServiceTax: serviceTax.toFixed(2)
        },
      };
    });

    setKOTByTable((prev) => {
      const currentKOT = prev[tableIdStr] || { items: [], totalAmount: 0 };
      const newItems = currentKOT.items.filter((i) => i.itemId !== itemId);

      const { finalTotal } = calculateTotals(newItems);
      const updatedKOT = { items: newItems, totalAmount: finalTotal };

      setCurrentKOT(updatedKOT);
      return { ...prev, [tableIdStr]: updatedKOT };
    });
  };

  const saveKOT = async (selectedTable) => {
    setLoader(true);
    const tableIdStr = String(selectedTable.id);
    const tableDataForTable = tableData[tableIdStr] || {
      kotItems: [],
      billItems: [],
      mergedItems: [],
      totalAmount: 0,
      totalCGST: "0.00",
      totalSGST: "0.00",
      totalServiceTax: "0.00"
    };

    if (tableDataForTable.mergedItems.length === 0) {
      setLoader(false);
      return;
    }

    try {
      const type = institutionData?.bar_integration === "Yes" ? "bar" : "cafe";

      const result = await API.get("main", `/admin/get-tabledata/${institutionData.institution}?type=${type}`, {});
      const responseBody = result.body ? JSON.parse(result.body) : result;
      const responseData = responseBody.data || {};
      setAllTablesData(responseData);

      const hasExistingOrder = !Array.isArray(responseData)
        ? (responseData[tableIdStr] && responseData[tableIdStr].orders && responseData[tableIdStr].orders.length > 0)
        : responseData.some(order => order.tableName === tableIdStr);

      const { billSubtotal, taxableSubtotal, cgst, sgst, serviceTax, finalTotal } = calculateTotals(tableDataForTable.mergedItems);
const isHotelTable = tableIdStr?.toLowerCase().startsWith("hotel");
    // Resolve bookingId for hotel tables
    let bookingid = null;
    let guestid=null;
   if (isHotelTable) {
      const booking = getBookingFromTableName(tableIdStr);
      bookingid = booking?.bookingId;
      guestid=booking?.guest_id;
      if (!bookingid) {
        console.warn(`No booking found for table ${tableIdStr}. Skipping amend-booking API call.`);
      }
    }
    const getDaySessionFromStorage = () => {
    try {
      // First try to get table-specific session
      const tableSpecificSession = localStorage.getItem(`daySession_${institutionData.institution}_${tableIdStr}`);
      if (tableSpecificSession) {
        return tableSpecificSession;
      }
      
      // Fallback to global session
      const globalSession = localStorage.getItem(`daySession_${institutionData.institution}_global`);
      if (globalSession) {
        return globalSession;
      }
      
      // Default fallback
      return "breakfast";
    } catch (error) {
      console.error("Error retrieving day session from localStorage:", error);
      return "breakfast";
    }
  };

  const currentDaySession = getDaySessionFromStorage();
      if (!hasExistingOrder) {
        await API.post("main", `/any/create-order/${institutionData.institution}`, {
          body: {
            name: customerDetails[tableIdStr]?.name || "",
            phoneNumber: customerDetails[tableIdStr]?.phone || "",
            tableName: tableIdStr,
            totalAmount: finalTotal,
            currency: tableDataForTable.mergedItems[0]?.currency || "INR",
            items: tableDataForTable.mergedItems,
            cgst,
            sgst,
            serviceTax,
            instruction: tableInstructions[tableIdStr] || '',
            ...(userData && { orderBy: userData.cognitoId }),
            tableOccupied: true,
            type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
            daySession: currentDaySession,
          },
        });
if (isHotelTable) {
      await API.put("frontdesk", `/offline/amend-booking/${bookingid}?institutionId=${institutionData.institution}`, {
         body: {
        bookingData: {
          booking_id: bookingid,    
          restaurant_hold: true          
        },
        guestDetailsData: {
          guest_id: guestid    
        }
      },
      });
    }
        await API.post("main", `/admin/orders-kot/${institutionData.institution}/${tableIdStr}`, {
          body: { 
            items: tableDataForTable.mergedItems,
            instruction: tableInstructions[tableIdStr] || '',
            type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe", 
          }
        });

        toast.success("KOT Saved Successfully");
      } else if (tableDataForTable.splitBill) {
        setPendingKOTData({ tableIdStr, tableDataForTable });
        setShowCreateOrderModal(true);
        setLoader(false);
        return;
      } else {
        await API.put("main", `/admin/orders-items/${institutionData.institution}/${tableIdStr}`, {
          body: {
            items: tableDataForTable.mergedItems,
            serviceTaxPercentage: institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0,
            cgstPercentage: institutionData?.cgst ?? 2.5,
            sgstPercentage: institutionData?.sgst ?? 2.5,
            cgst,
            sgst,
            serviceTax,
            type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
          },
        });

        await API.post("main", `/admin/orders-bill/${institutionData.institution}/${tableIdStr}`, {
          body: {
            name: customerDetails[tableIdStr]?.name || "",
            phoneNumber: customerDetails[tableIdStr]?.phone || "",
            items: tableDataForTable.mergedItems,
            type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
          },
        });

        toast.success("KOT Updated Successfully");
      }

      setLoader(false);
      fetchAllTableData();
    } catch (error) {
      console.error("Error saving KOT:", error);
      setLoader(false);
      toast.error("Failed to save KOT.");
    }
  };

  const settleBill = async () => {
    if (!selectedTable || !localBillItems.length) return;

    setLoader(true);
    const tableIdStr = String(selectedTable.id);

    try {
      const { cgst, sgst, serviceTax } = calculateTotals(localBillItems);

      await API.put("main", `/admin/orders-items/${institutionData.institution}/${tableIdStr}`, {
        body: {
          items: localBillItems,
          serviceTaxPercentage: institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0,
          cgstPercentage: institutionData?.cgst ?? 2.5,
          sgstPercentage: institutionData?.sgst ?? 2.5,
          cgst,
          sgst,
          serviceTax,
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });

      await API.post("main", `/admin/orders-bill/${institutionData.institution}/${tableIdStr}`, {
        body: { items: localBillItems,type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe", }
      });

      setTables((prev) =>
        prev.map((t) =>
          String(t.id) === tableIdStr
            ? { ...t, orders: [], currentBill: 0, status: "available" }
            : t
        )
      );

      setTableOccupancy((prev) => ({ ...prev, [tableIdStr]: false }));
      setLocalBillItems([]);
      setKOTByTable((prev) => ({ ...prev, [tableIdStr]: { items: [], totalAmount: 0 } }));
      setCurrentKOT({ items: [], totalAmount: 0 });

      await fetchAllTableData();
      setLoader(false);
      toast.success("Bill settled successfully!");
    } catch (error) {
      console.error("Error settling bill:", error);
      setLoader(false);
      toast.error("Failed to settle bill.");
    }
  };

  const getTableDataFromCache = (tableId) => {
    if (!tableId || !allTablesData) return null;

    const tableIdStr = String(tableId);
    if (allTablesData[tableIdStr]) {
      processTableData(tableIdStr, allTablesData[tableIdStr]);
      return allTablesData[tableIdStr];
    }

    return null;
  };

  useEffect(() => {
    if (selectedTable) {
      const tableIdStr = String(selectedTable.id);
      const currentLocalData = tableData[tableIdStr];

      if (!currentLocalData) {
        const cachedData = getTableDataFromCache(tableIdStr);
        if (!cachedData) {
          fetchTableData(tableIdStr);
        }
      }
    }
  }, [selectedTable]);

  useEffect(() => {
    fetchAllTableData();
  }, [institutionData.institution]);

  const notificationSound = new Audio("/notification-18-270129.mp3");

  const enableAudio = () => {
    notificationSound.play().then(() => {
      notificationSound.pause();
      notificationSound.currentTime = 0;
      setIsAudioEnabled(true);
      setHasUserInteracted(true);
      localStorage.setItem("audioEnabled", "true");
      toast.success("Notifications enabled!");
      if (pendingSoundRef.current) {
        notificationSound.play().catch(console.error);
        pendingSoundRef.current = false;
      }
    }).catch((error) => {
      console.error("Error enabling audio:", error);
      toast.error("Failed to enable notifications");
    });
  };

  useEffect(() => {
    const handleInteraction = () => {
      setHasUserInteracted(true);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      if (pendingSoundRef.current && isAudioEnabled) {
        notificationSound.play().catch(console.error);
        pendingSoundRef.current = false;
      }
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [isAudioEnabled]);

  useEffect(() => {
    const unsubscribe = subscribe((message) => {
      if (message) {
        toast.info("New order received!");
        fetchAllTableData();

        if (isAudioEnabled && hasUserInteracted) {
          notificationSound.play().catch((error) =>
            console.error("Failed to play notification sound:", error)
          );
        } else {
          pendingSoundRef.current = true;
        }
      }
    });

    return () => unsubscribe();
  }, [institutionData.institution, subscribe, isConnected, isAudioEnabled, hasUserInteracted]);

  // Modal Components
  const CreateOrderModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg relative min-w-96">
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <button
              onClick={() => {
                setShowCreateOrderModal(false);
                setPendingKOTData(null);
                setIsLoading(false);
              }}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <h2 className="text-lg font-semibold mb-4">Create New Order</h2>
            <p className="mb-6 text-gray-600">
              Do you want to create a new order for another person on this table?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowCreateOrderModal(false);
                  if (pendingKOTData) {
                    const { tableIdStr, tableDataForTable } = pendingKOTData;
                    const orders = Array.isArray(tableDataForTable.orders) ? tableDataForTable.orders : [];
                    const uniqueOrderIds = [...new Set(orders.map(order => order.orderId).filter(id => id !== null && id !== undefined))];
                    if (uniqueOrderIds.length > 0) {
                      setShowOrderIdModal(true);
                    } else {
                      handleOrderIdSelection(null);
                    }
                  }
                }}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                No
              </button>
              <button
                onClick={handleCreateNewOrder}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Yes
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const OrderIdModal = () => {
    if (!pendingKOTData) return null;

    const { tableIdStr, tableDataForTable } = pendingKOTData;
    const orders = Array.isArray(tableDataForTable.orders) ? tableDataForTable.orders : [];
    const uniqueOrderIds = [...new Set(orders.map(order => order.orderId).filter(id => id !== null && id !== undefined))];

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg relative min-w-96">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowOrderIdModal(false);
                  setPendingKOTData(null);
                  setSelectedOrderId(null);
                  setIsLoading(false);
                }}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
              <h2 className="text-lg font-semibold mb-4">Select Order ID</h2>
              <p className="mb-4 text-gray-600">
                Multiple orders exist for this table. Please select an order ID to update:
              </p>
              {uniqueOrderIds.length === 0 ? (
                <p className="text-red-500 mb-4">No valid order IDs found for this table.</p>
              ) : (
                <div className="mb-6">
                  <select
                    value={selectedOrderId || ''}
                    onChange={(e) => setSelectedOrderId(e.target.value || null)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select an Order ID</option>
                    {uniqueOrderIds.map((orderId) => (
                      <option key={orderId} value={orderId}>
                        {orderId}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowOrderIdModal(false);
                    setPendingKOTData(null);
                    setSelectedOrderId(null);
                    setIsLoading(false);
                  }}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleOrderIdSelection(selectedOrderId)}
                  disabled={!selectedOrderId}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const PrinterModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg relative">
        <button
          onClick={() => setShowPrinterModal(false)}
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
              requestDevice();
              setShowPrinterModal(false);
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Bluetooth Printer
          </button>
          <button
            onClick={() => {
              setShowPrinterModal(false);
              toast.info("Local printing selected.");
            }}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Wired Printer
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!isAudioEnabled && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in">
          <button
            onClick={enableAudio}
            className="group relative inline-flex items-center justify-center px-6 py-3 overflow-hidden font-medium text-white transition-all duration-300 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <span className="absolute inset-0 w-full h-full transition-all duration-300 ease-out bg-indigo-500 opacity-0 group-hover:opacity-20"></span>
            <span className="relative flex items-center gap-2">
              <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              Enable Notifications
            </span>
          </button>
        </div>
      )}

      {screenWidth > 700 ? (
        <div className="flex h-screen bg-gray-50">
          <div className="flex-1 flex flex-col">
            <TableGrid
              tables={tables}
              selectedTable={selectedTable}
              setSelectedTable={setSelectedTable}
              pendingOrdersByTable={pendingOrdersByTable}
              KOTByTable={KOTByTable}
              unpaidOrders={unpaidOrders}
            />
            <div className="flex flex-1">
              <CategoryList
                categories={["All", ...new Set(itemsData.map((item) => item.category))]}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
              />
              <MenuItems
                itemsData={itemsData}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                selectedCategory={selectedCategory}
                selectedTable={selectedTable}
                addItemToKOT={addItemToKOT}
                categories={["All", ...new Set(itemsData.map((item) => item.category))]}
                setSelectedCategory={setSelectedCategory}
              />
            </div>
          </div>
          <OrderPanel
            selectedTable={selectedTable}
            billItemsByStore={billItemsByStore}
            tables={tables}
            setSelectedTable={setSelectedTable}
            setCurrentKOT={setCurrentKOT}
            fetchPendingOrders={fetchAllTableData}
            activeTab={activeTab}
            setTables={setTables}
            setActiveTab={setActiveTab}
            KOTByTable={KOTByTable}
            customerDetails={customerDetails}
            updateItemQuantity={updateItemQuantity}
            setCustomerDetails={setCustomerDetails}
            removeItemFromKOT={removeItemFromKOT}
            setLocalBillItems={setLocalBillItems}
            localBillItems={localBillItems}
            printKOT={(table) =>
              PrintKOT({
                table,
                customerDetails,
                KOTByTable,
                institutionData,
                saveKOT,
                screenWidth,
                setActiveTab,
                tableData,
                printData,
                connected,
                tableInstructions
              })
            }
            setTableOccupancy={setTableOccupancy}
            printBill={({ table, items, orderId, discountMethod, discountValue, billNo }) =>
              PrintBill({
                table,
                items,
                institutionData,
                screenWidth,
                orderId,
                discountMethod: discountMethod ?? "none",
                discountValue: discountValue ?? 0,
                billNo,
              })
            }
            setShowModal={setShowModal}
            printAllItems={printAllItems}
            setPrintAllItems={setPrintAllItems}
            setKOTByTable={setKOTByTable}
            tableOccupancy={tableOccupancy}
            pendingOrders={selectedTable ? pendingOrdersByTable[String(selectedTable.id)] || [] : []}
            fetchTableData={fetchTableData}
            tableData={tableData}
            saveKOT={saveKOT}
            settleBill={settleBill}
            bluetoothConnected={connected}
            bluetoothDeviceName={device?.name}
            connectBluetooth={requestDevice}
            printBluetooth={printData}
            setShowReprintKOT={setShowReprintKOT}
            showReprintKOT={showReprintKOT}
            unpaidOrders={unpaidOrders}
            settleUnpaidOrder={settleUnpaidOrder}
            // Pass discount props
            discountData={discountData}
            setDiscountData={setDiscountData}
            // Pass instructions props
            tableInstructions={tableInstructions}
            setTableInstructions={setTableInstructions}
          />
          {showModal && (
            <PaymentModal
              saveKOT={() => saveKOT(selectedTable)}
              selectedTable={selectedTable}
              institutionData={institutionData}
              localBillItems={localBillItems}
              onClose={() => setShowModal(false)}
              setKOTByTable={setKOTByTable}
              setTables={setTables}
              setCurrentKOT={setCurrentKOT}
              setCustomerDetails={setCustomerDetails}
              fetchPendingOrders={fetchAllTableData}
              setTableOccupancy={setTableOccupancy}
              orderId={ordersId[String(selectedTable?.id)]}
              customerDetails={customerDetails}
              discountData={discountData} 
    setDiscountData={setDiscountData}
            />
          )}
        </div>
      ) : (
        <div className="flex h-screen bg-gray-50">
          <ResponsivePOSLayout
            categories={["All", ...new Set(itemsData.map((item) => item.category))]}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            tables={tables}
            selectedTable={selectedTable}
            setSelectedTable={setSelectedTable}
            itemsData={itemsData}
            setTables={setTables}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            addItemToKOT={addItemToKOT}
            billItemsByStore={billItemsByStore}
            localBillItems={localBillItems}
            setLocalBillItems={setLocalBillItems}
            setTableOccupancy={setTableOccupancy}
            KOTByTable={KOTByTable}
            removeItemFromKOT={removeItemFromKOT}
            updateItemQuantity={updateItemQuantity}
            printKOT={(table) => PrintKOT({ table, customerDetails, KOTByTable, institutionData, saveKOT, screenWidth, setActiveTab, tableData, printData, connected, tableInstructions })}
            printBill={({ table, items, orderId, discountMethod, discountValue, billNo }) => PrintBill({ table, items, institutionData, screenWidth, orderId, discountMethod: discountMethod ?? "none",
    discountValue: discountValue ?? 0, billNo, })}
            customerDetails={customerDetails}
            setCustomerDetails={setCustomerDetails}
            setShowModal={setShowModal}
            printAllItems={printAllItems}
            setPrintAllItems={setPrintAllItems}
            institutionData={institutionData}
            pendingOrdersByTable={pendingOrdersByTable}
            fetchPendingOrders={fetchAllTableData}
            pendingOrders={selectedTable ? pendingOrdersByTable[String(selectedTable.id)] || [] : []}
            tableOccupancy={tableOccupancy}
            setCurrentKOT={setCurrentKOT}
            setKOTByTable={setKOTByTable}
            fetchTableData={fetchTableData}
            tableData={tableData}
            saveKOT={saveKOT}
            settleBill={settleBill}
            bluetoothConnected={connected}
            bluetoothDeviceName={device?.name}
            connectBluetooth={requestDevice}
            printBluetooth={printData}
            setShowReprintKOT={setShowReprintKOT}
            showReprintKOT={showReprintKOT}
            unpaidOrders={unpaidOrders} // Pass unpaid orders
            settleUnpaidOrder={settleUnpaidOrder} // Pass settle function
            tableInstructions={tableInstructions}
            setTableInstructions={setTableInstructions}
          />
          {showModal && (
            <PaymentModal
              saveKOT={() => saveKOT(selectedTable)}
              selectedTable={selectedTable}
              institutionData={institutionData}
              localBillItems={localBillItems}
              onClose={() => setShowModal(false)}
              setKOTByTable={setKOTByTable}
              setTables={setTables}
              setCurrentKOT={setCurrentKOT}
              setCustomerDetails={setCustomerDetails}
              fetchPendingOrders={fetchAllTableData}
              setTableOccupancy={setTableOccupancy}
              orderId={ordersId[String(selectedTable?.id)]}
              customerDetails={customerDetails}
            />
          )}
        </div>
      )}
      {showPrinterModal && <PrinterModal />}
      {showOrderIdModal && <OrderIdModal />}
      {showCreateOrderModal && <CreateOrderModal />}
    </>
  );
};

export default RestaurantPOS;
