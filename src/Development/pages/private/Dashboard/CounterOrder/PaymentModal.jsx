import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import Select from "react-select";

const PaymentModal = ({
  selectedTable,
  institutionData,
  onClose,
  saveKOT,
  setKOTByTable,
  setTables,
  setCurrentKOT,
  setCustomerDetails,
  fetchTableData,
  fetchPendingOrders,
  setTableOccupancy,
  updateTableOccupancy,
  localBillItems,
  orderId,
  customerDetails,
  discountData,
  setDiscountData,
}) => {
  const { setLoader, hotelBookings, addHotelService } = useContext(Context);
  const tableIdStr = String(selectedTable?.id || "");
  const [totalBillAmount, setTotalBillAmount] = useState(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [booking, setBooking] = useState(null);
  const [extractedOrderIds, setExtractedOrderIds] = useState([]);
  const [cashAmount, setCashAmount] = useState(null);
  const [cardAmount, setCardAmount] = useState(null);
  const [qrAmount, setQrAmount] = useState(null);
  const [roomAmount, setRoomAmount] = useState(null);
  const [orderSource, setOrderSource] = useState("");
  const [payerName, setPayerName] = useState("");
  const [companies, setCompanies] = useState([]);
  const [newCompany, setNewCompany] = useState({ gstin: "", name: "" });
  const [showAddCompanyForm, setShowAddCompanyForm] = useState(false);
  const [error, setError] = useState(null);
  const [managementOptions, setManagementOptions] = useState([
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
  ]);
  const [customManagementInput, setCustomManagementInput] = useState("");
  const [narration, setNarration] = useState("");

  const paymentMethods = ["QR", "Cash", "Card", "BTC", "Complementary", "Void"];
  const [isPartialPayment, setIsPartialPayment] = useState(institutionData.paymentMethod === "partial");

  const isManagementSpecial = (() => {
    const inst = String(institutionData?.institution || "").trim();
    const name = String(institutionData?.companyName || "").toLowerCase();
    if (inst === "444" || inst === "555") return true;
    if (
      String(selectedTable?.id || "").includes("Management444") ||
      String(selectedTable?.id || "").includes("Management555")
    )
      return true;
    return false;
  })();

  // Utility function to get company ID by name
  const getCompanyIdByName = (companyName) => {
    const company = companies.find((c) => c.name === companyName);
    return company ? company.company_id || company.companyId || company.id || "" : "";
  };

  // ---------- Robust fetchCompanies ----------
  const fetchCompanies = async () => {
    setLoader(true);
    setError(null);
    try {
      const resp = await API.get("frontdesk", `/company/${institutionData.institution}`, {});
      let companiesList = [];

      if (!resp) {
        companiesList = [];
      } else if (Array.isArray(resp)) {
        companiesList = resp;
      } else if (resp.companies && Array.isArray(resp.companies)) {
        companiesList = resp.companies;
      } else if (resp.body) {
        try {
          const bodyObj = typeof resp.body === "string" ? JSON.parse(resp.body) : resp.body;
          if (Array.isArray(bodyObj)) companiesList = bodyObj;
          else if (bodyObj.companies && Array.isArray(bodyObj.companies)) companiesList = bodyObj.companies;
          else companiesList = bodyObj;
        } catch (e) {
          companiesList = [];
        }
      } else if (resp.data && Array.isArray(resp.data)) {
        companiesList = resp.data;
      } else {
        companiesList = [];
      }

      setCompanies(companiesList || []);
      return companiesList;
    } catch (err) {
      console.error("fetchCompanies error:", err);
      setError("Failed to get companies");
      toast.error("Failed to fetch companies");
      return null;
    } finally {
      setLoader(false);
    }
  };

  // ---------- Robust createCompany ----------
  const createCompany = async (payload) => {
    setLoader(true);
    setError(null);
    try {
      const inst = institutionData.institution;
      const resp = await API.post("frontdesk", "/company", {
        body: { ...payload, institutionId: inst },
      });

      let newCompanyObj = null;
      if (!resp) {
        throw new Error("Empty response from create company API");
      } else if (resp.company) {
        newCompanyObj = resp.company;
      } else if (resp.data && resp.data.company) {
        newCompanyObj = resp.data.company;
      } else if (resp.company_id || resp.companyId || resp.id) {
        newCompanyObj = resp;
      } else if (resp.body) {
        try {
          const bodyObj = typeof resp.body === "string" ? JSON.parse(resp.body) : resp.body;
          newCompanyObj = bodyObj.company || bodyObj;
        } catch (e) {
          throw e;
        }
      } else {
        newCompanyObj = resp;
      }

      setCompanies((prev) => [...(prev || []), newCompanyObj]);
      setOrderSource(newCompanyObj.name || ""); // Set orderSource to company name
      setShowAddCompanyForm(false);
      setNewCompany({ gstin: "", name: "" });
      toast.success("Company added successfully");
      return newCompanyObj;
    } catch (error) {
      console.error("createCompany error:", error);
      setError("Failed to create company");
      toast.error("Failed to create company");
      return null;
    } finally {
      setLoader(false);
    }
  };

  // ---- Updated: write credit using epoch-second key and require name ----
  const updateCompanyCredit = async (companyName, amount, name, orderId) => {
    try {
      // Enforce name for BTC credits
      if (!name || String(name).trim() === "") {
        throw new Error("Payer name is required for BTC/company credits.");
      }
      if (!companyName) {
        throw new Error("Company name is required for BTC payment.");
      }

      // Find company ID based on company name
      const companyId = getCompanyIdByName(companyName);
      if (!companyId) {
        throw new Error("Selected company not found.");
      }

      const type = institutionData?.bar_integration === "Yes" ? "bar" : "cafe";

      // Epoch seconds used as the dynamic key
      const epochSec = Math.floor(Date.now() / 1000);

      const creditData = {
        [epochSec]: {
          amount: Number(amount),
          name: String(name).trim(),
          createdOn: epochSec, // epoch seconds
          type: type,
          orderId: orderId,
          companyName: companyName, // Include company name for reference
        },
      };

      await API.patch("frontdesk", `/company`, {
        body: {
          credit: creditData,
          institutionId: institutionData.institution,
          company_id: companyId,
        },
      });
      toast.success("Company credit updated successfully");
    } catch (error) {
      console.error("updateCompanyCredit error:", error);
      toast.error(error?.message || "Failed to update company credit");
      throw error;
    }
  };

  // Fetch companies only when BTC is selected
  useEffect(() => {
    if (selectedPaymentMethod === "BTC") {
      fetchCompanies();
    }
  }, [selectedPaymentMethod]);

  // Handle new company form submission
  const handleAddCompany = async () => {
    await createCompany({
      gstin: newCompany.gstin,
      name: newCompany.name,
    });
  };

  // Defensive mapping for react-select options
  const companyOptions = (companies || []).map((company) => ({
    value: company.name || "Unnamed", // Use company name as value
    label: `${company.name || "Unnamed"}${company.gst_no ? ` — ${company.gst_no}` : ""}`,
    raw: company, // Store full company object for access to ID
  }));

  // Calculate totals
  const getDiscountInfo = () => {
    if (!selectedTable) return { method: "none", value: 0, amount: 0 };
    const tid = String(selectedTable.id);
    const tableDiscountData = (discountData && discountData[tid]) || null;
    if (!tableDiscountData) return { method: "none", value: 0, amount: 0 };
    if (orderId && typeof tableDiscountData === "object" && tableDiscountData[orderId]) {
      return tableDiscountData[orderId];
    }
    if (typeof tableDiscountData === "object" && !tableDiscountData.method) {
      const firstKey = Object.keys(tableDiscountData)[0];
      if (firstKey) {
        return tableDiscountData[firstKey] || { method: "none", value: 0, amount: 0 };
      }
    }
    return tableDiscountData;
  };

  const calculateTotals = (items, discountInfoOverride = null) => {
    const itemsArr = items || [];
    const billSubtotal = itemsArr.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const qty = Number(item.quantity) || 0;
      return sum + price * qty;
    }, 0);

    const taxableSubtotal = itemsArr.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const qty = Number(item.quantity) || 0;
      return sum + (item.type !== "bar" ? price * qty : 0);
    }, 0);

    const cgstRate = institutionData?.cgst ?? 2.5;
    const sgstRate = institutionData?.sgst ?? 2.5;
    const serviceTaxRate = institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0;

    const di = discountInfoOverride || getDiscountInfo() || { method: "none", value: 0, amount: 0 };

    let discountAmount = 0;
    let discountPercentage = 0;

    if (di.method === "percentage" && di.value > 0) {
      discountPercentage = Math.min(Number(di.value), 100);
      discountAmount = (billSubtotal * discountPercentage) / 100;
    } else if (di.method === "amount" && di.value > 0) {
      discountAmount = Math.min(Number(di.value), billSubtotal);
    } else if (di.amount) {
      discountAmount = Number(di.amount) || 0;
    }

    const discountedSubtotal = Math.max(0, billSubtotal - discountAmount);
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
      discountMethod: di.method,
    };
  };

  useEffect(() => {
    const totals = calculateTotals(localBillItems || []);
    setTotalBillAmount(totals.finalTotal);
  }, [localBillItems, discountData, orderId]);

  // Extract order IDs
  useEffect(() => {
    if (isPartialPayment || !selectedTable || !orderId) return;
    if (typeof orderId === "string" || typeof orderId === "number") {
      setExtractedOrderIds([String(orderId)]);
      return;
    }
    if (Array.isArray(orderId)) {
      setExtractedOrderIds(orderId.map((id) => String(id)));
      return;
    }
    if (typeof orderId === "object" && orderId !== null) {
      if (orderId.orders && typeof orderId.orders === "object") {
        setExtractedOrderIds(Object.keys(orderId.orders));
      } else {
        setExtractedOrderIds(Object.keys(orderId));
      }
    }
  }, [selectedTable, orderId, isPartialPayment]);

  // Hotel auto-select
  useEffect(() => {
    if (institutionData.integration === "HOTEL" && tableIdStr.toLowerCase().startsWith("hotel")) {
      const roomNumber = tableIdStr.replace(/^hotel/i, "");
      const matchingBooking = hotelBookings.find((b) => String(b.roomNumber) === roomNumber);
      setBooking(matchingBooking || null);
    }
  }, [tableIdStr, hotelBookings, institutionData.integration]);

  // Save bill
  const saveBill = async () => {
    setLoader(true);
    try {
      const totals = calculateTotals(localBillItems || []);
      await API.put("main", `/admin/orders-items/${institutionData.institution}/${tableIdStr}`, {
        body: {
          items: localBillItems,
          serviceTaxPercentage: institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0,
          cgstPercentage: institutionData?.cgst ?? 2.5,
          sgstPercentage: institutionData?.sgst ?? 2.5,
          discountMethod: totals.discountMethod,
          discountValue: totals.discountMethod === "percentage" ? totals.discountPercentage : totals.discountAmount,
          discountPercentage: totals.discountPercentage,
          discountAmount: totals.discountAmount,
          cgst: totals.cgst,
          sgst: totals.sgst,
          serviceTax: totals.serviceTax,
          finalTotal: totals.finalTotal,
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });
      await API.post("main", `/admin/orders-bill/${institutionData.institution}/${tableIdStr}`, {
        body: {
          items: localBillItems,
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });
    } catch (error) {
      console.error("Error saving KOT:", error);
      toast.error("Failed to save KOT. Please try again.");
      setLoader(false);
      throw error;
    }
  };

  // Input validation
  const validateAmountInput = (value, setAmount) => {
    const numValue = value === null || value === "" ? null : Number(value);
    if (numValue !== null && (isNaN(numValue) || numValue < 0)) {
      toast.error("Payment amount cannot be negative");
      return null;
    }
    setAmount(numValue);
  };

  // Single payment handling
  const handleSinglePayment = async () => {
    setLoader(true);
    if (!selectedPaymentMethod) {
      toast.error("Please select a payment method.");
      setLoader(false);
      return;
    }
    // Enforce payerName and company for BTC
    if (selectedPaymentMethod === "BTC") {
      if (!orderSource) {
        toast.error("Please select a company for BTC payment.");
        setLoader(false);
        return;
      }
      if (!payerName || String(payerName).trim() === "") {
        toast.error("Payer name is required for BTC payment.");
        setLoader(false);
        return;
      }
    }
    if ((selectedPaymentMethod === "BTC" || selectedPaymentMethod === "Complementary") && !orderSource) {
      toast.error(`Please select a ${selectedPaymentMethod === "BTC" ? "company" : "complementary option"}.`);
      setLoader(false);
      return;
    }
    try {
      await saveBill();
      let billLink = "";
      let selectedOrderId = "";
      if (extractedOrderIds.length > 0) {
        selectedOrderId = extractedOrderIds[0].split(",")[0];
        billLink = `https://bhukkadrestrocafe.awsaiapp.com/receipt?orderIds=${selectedOrderId}`;
      }
      if (institutionData.institution === "manas25") {
        selectedOrderId = extractedOrderIds[0].split(",")[0];
        billLink = `https://manasrestaurant.tekkzy.com/receipt?orderIds=${selectedOrderId}`;
      }
      const customerPhone = customerDetails[selectedTable?.id]?.phone;

      const settleBody = {
        paymentStatus: true,
        type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        paymentMode: "offline",
        paymentMethod: selectedPaymentMethod,
        status: "delivered",
        narration: narration,
        ...(booking && booking.roomNumber ? { room_number: "Hotel" + booking.roomNumber } : {}),
      };

      // --- Send orderSource and payerName as top-level fields ---
      if (selectedPaymentMethod === "Complementary") {
        settleBody.paymentMethod = "Complementary";
        settleBody.orderSource = orderSource === "custom" ? customManagementInput : orderSource;
        settleBody.name = payerName;
      } else if (selectedPaymentMethod === "Void") {
        settleBody.paymentStatus = false;
        settleBody.paymentMode = null;
        settleBody.paymentMethod = "Void";
        settleBody.status = "voided";
        settleBody.orderSource = orderSource || "";
        settleBody.name = payerName || "";
      } else if (selectedPaymentMethod === "BTC") {
        settleBody.orderSource = orderSource; // Use company name
        settleBody.name = payerName;
        settleBody.narration = narration;
        // Update company credit with company name
        await updateCompanyCredit(orderSource, totalBillAmount, payerName, selectedOrderId);
      } else if (selectedPaymentMethod === "ROOM") {
        settleBody.narration = narration;
      } else {
        if (orderSource) settleBody.orderSource = orderSource;
        if (payerName) settleBody.name = payerName;
        settleBody.narration = narration;
      }

      if (selectedPaymentMethod === "ROOM") {
        let totalFoodBill = localBillItems
          .filter((item) => item.type !== "bar")
          .reduce((total, item) => total + item.price * item.quantity, 0);
        let totalBarBill = localBillItems
          .filter((item) => item.type === "bar")
          .reduce((total, item) => total + item.price * item.quantity, 0);
        const totals = calculateTotals(localBillItems || []);
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
                order_id: selectedOrderId,
              },
            ],
          },
        });
      }

      const isHotelTable = tableIdStr?.toLowerCase().startsWith("hotel");
      await API.post("main", `/admin/settle-bill/${institutionData.institution}/${tableIdStr}`, {
        body: settleBody,
      });
      if (isHotelTable) {
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
      await completePayment();
    } catch (error) {
      console.error("Payment Error:", error);
      let errorMessage = "Failed to process payment.";
      if (error?.response?.data) {
        const apiError = error.response.data;
        if (apiError.message) errorMessage += ` - ${apiError.message}`;
        if (apiError.error) errorMessage += `: ${apiError.error}`;
      } else if (error?.message) {
        errorMessage += ` - ${error.message}`;
      }
      toast.error(errorMessage);
      setLoader(false);
    }
  };

  // Management free settle
  const handleManagementFreeSettle = async () => {
    if (!orderSource) {
      toast.error("Please select or enter a management option.");
      return;
    }
    setLoader(true);
    try {
      await saveBill();
      await API.post("main", `/admin/settle-bill/${institutionData.institution}/${tableIdStr}`, {
        body: {
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
          paymentStatus: true,
          paymentMode: "offline",
          paymentMethod: "Complementary",
          status: "delivered",
          narration: narration,
          orderSource: orderSource === "custom" ? customManagementInput : orderSource,
          name: payerName,
        },
      });
      await completePayment();
    } catch (error) {
      console.error("Management Free Payment Error:", error);
      let errorMessage = "Failed to process management free payment.";
      if (error?.response?.data) {
        const apiError = error.response.data;
        if (apiError.message) errorMessage += ` - ${apiError.message}`;
        if (apiError.error) errorMessage += `: ${apiError.error}`;
      }
      toast.error(errorMessage);
      setLoader(false);
    }
  };

  // Partial payment handling
  const handlePartialPayment = async () => {
    const cashAmountFinal = cashAmount || 0;
    const cardAmountFinal = cardAmount || 0;
    const qrAmountFinal = qrAmount || 0;
    const roomAmountFinal = roomAmount || 0;
    const btcAmountFinal = selectedPaymentMethod === "BTC" ? totalBillAmount : 0;

    const totalPaid = cashAmountFinal + cardAmountFinal + qrAmountFinal + roomAmountFinal + btcAmountFinal;

    if (totalPaid !== totalBillAmount) {
      toast.error(`Total paid (₹${totalPaid}) must equal bill amount (₹${totalBillAmount})`);
      return;
    }

    const paymentMethodsPayload = [];
    if (cashAmountFinal > 0) paymentMethodsPayload.push({ method: "Cash", amount: cashAmountFinal });
    if (cardAmountFinal > 0) paymentMethodsPayload.push({ method: "Card", amount: cardAmountFinal });
    if (qrAmountFinal > 0) paymentMethodsPayload.push({ method: "QR", amount: qrAmountFinal });
    if (roomAmountFinal > 0) paymentMethodsPayload.push({ method: "ROOM", amount: roomAmountFinal });

    let selectedOrderId = "";
    if (extractedOrderIds.length > 0) {
      selectedOrderId = extractedOrderIds[0].split(",")[0];
    }

    if (btcAmountFinal > 0) {
      if (!orderSource) {
        toast.error("Please select a company for BTC payment.");
        setLoader(false);
        return;
      }
      if (!payerName || String(payerName).trim() === "") {
        toast.error("Payer name is required for BTC payment.");
        setLoader(false);
        return;
      }
      
      paymentMethodsPayload.push({
        method: "BTC",
        amount: btcAmountFinal,
      });

      // Update company credit
      await updateCompanyCredit(orderSource, btcAmountFinal, payerName, selectedOrderId);
    }

    setLoader(true);
    try {
      await saveBill();

      const totalFoodBill = localBillItems
        .filter((item) => item.type !== "bar")
        .reduce((sum, item) => sum + item.price * item.quantity, 0);
      const totalBarBill = localBillItems
        .filter((item) => item.type === "bar")
        .reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (roomAmountFinal > 0) {
        const totals = calculateTotals(localBillItems || []);
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
                order_id: selectedOrderId,
              },
            ],
          },
        });
      }
      const isHotelTable = tableIdStr?.toLowerCase().startsWith("hotel");

      await API.post("main", `/admin/settle-bill/${institutionData.institution}/${tableIdStr}`, {
        body: {
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
          paymentStatus: true,
          paymentMode: "offline",
          paymentMethods: paymentMethodsPayload,
          status: "delivered",
          narration: narration,
          ...(booking && booking.roomNumber ? { room_number: "Hotel" + booking.roomNumber } : {}),
          ...(orderSource ? { orderSource } : {}),
          ...(payerName ? { name: payerName } : {}),
        },
      });
      if (isHotelTable) {
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
      await completePayment();
    } catch (error) {
      console.error("Payment Error:", error);
      let errorMessage = "Failed to process payment.";
      if (error?.response?.data) {
        const apiError = error.response.data;
        if (apiError.message) errorMessage += ` - ${apiError.message}`;
        if (apiError.error) errorMessage += `: ${apiError.error}`;
      }
      toast.error(errorMessage);
      setLoader(false);
    }
  };

  // Complete payment
  const completePayment = async () => {
    onClose();
    setLoader(false);
    let kotData = JSON.parse(localStorage.getItem("kotOrders") || "{}");
    if (kotData && kotData.kotTables) {
      delete kotData.kotTables[tableIdStr];
      localStorage.setItem("kotOrders", JSON.stringify(kotData));
    }
    await fetchPendingOrders();
    setKOTByTable((prev) => ({
      ...prev,
      [tableIdStr]: null,
    }));
    setCustomerDetails((prev) => ({
      ...prev,
      [tableIdStr]: { phone: null, name: null },
    }));
    toast.success("Payment Successful!");
  };

  const remainingAmount =
    totalBillAmount -
    ((cashAmount || 0) + (cardAmount || 0) + (qrAmount || 0) + (roomAmount || 0) + (selectedPaymentMethod === "BTC" ? totalBillAmount : 0));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-auto flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-[30rem] max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
          {isPartialPayment ? "Split Payment" : "Settle Bill"}
        </h2>
        <div className="mb-4 text-center">
          <p className="text-gray-600">
            Table: <strong>{selectedTable?.id}</strong>
          </p>
          {isPartialPayment && (
            <p className="text-3xl font-bold text-green-600 mt-2">₹{totalBillAmount}</p>
          )}
        </div>

        {isPartialPayment ? (
          <div className="space-y-4">
            <div
              className={`grid gap-2 ${
                institutionData.integration === "HOTEL" ? "grid-cols-2" : "grid-cols-3"
              }`}
            >
              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">Cash</label>
                <input
                  type="number"
                  value={cashAmount === null ? "" : cashAmount}
                  onChange={(e) => validateAmountInput(e.target.value, setCashAmount)}
                  className="w-full p-2 border rounded-md text-center"
                  placeholder="Cash"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">Card</label>
                <input
                  type="number"
                  value={cardAmount === null ? "" : cardAmount}
                  onChange={(e) => validateAmountInput(e.target.value, setCardAmount)}
                  className="w-full p-2 border rounded-md text-center"
                  placeholder="Card"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">QR</label>
                <input
                  type="number"
                  value={qrAmount === null ? "" : qrAmount}
                  onChange={(e) => validateAmountInput(e.target.value, setQrAmount)}
                  className="w-full p-2 border rounded-md text-center"
                  placeholder="QR"
                />
              </div>
            </div>

            {selectedPaymentMethod === "BTC" && (
              <div className="mt-2">
                <label className="text-gray-700 text-sm mb-1">Select Company</label>
                <Select
                  options={companyOptions}
                  value={companyOptions.find((option) => option.value === orderSource) || null}
                  onChange={(selected) => setOrderSource(selected ? selected.value : "")}
                  placeholder="Select a company..."
                  isClearable
                  className="w-full"
                />
                <button
                  onClick={() => setShowAddCompanyForm(true)}
                  className="mt-2 text-blue-600 hover:underline text-sm"
                >
                  Add New Company
                </button>
                {showAddCompanyForm && (
                  <div className="mt-2 p-3 border rounded-md bg-gray-50">
                    <h3 className="text-sm font-semibold mb-2">Add New Company</h3>
                    <input
                      type="text"
                      value={newCompany.name}
                      onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                      className="w-full p-2 border rounded-md mb-2"
                      placeholder="Company Name"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowAddCompanyForm(false)}
                        className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddCompany}
                        className="px-3 py-1 bg-green-600 text-white rounded-md"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-full p-2 border rounded-md mt-2"
                  placeholder="Name (employee / payer) *"
                />
                {selectedPaymentMethod === "BTC" && (!payerName || payerName.trim() === "") && (
                  <div className="text-xs text-red-600 mt-1">Payer name is required for BTC payments.</div>
                )}
              </div>
            )}

            {institutionData.integration === "HOTEL" && roomAmount > 0 && (
              <div className="flex flex-row gap-2 my-2">
                <h3 className="text-sm font-semibold">Select Room:</h3>
                <select
                  className="border rounded-md p-2 w-full"
                  value={booking?.bookingId || ""}
                  onChange={(e) => setBooking(hotelBookings.find((b) => b.bookingId === e.target.value))}
                >
                  <option value="" disabled>
                    Select a room
                  </option>
                  {hotelBookings.map((b) => (
                    <option key={b.bookingId} value={b.bookingId}>
                      {b.roomNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {institutionData.integration === "HOTEL" && roomAmount > 0 && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded-md mt-3 text-sm">
                <strong>Note:</strong> Room charges will be collected during hotel checkout.
              </div>
            )}
            <div className="text-center mt-2">
              <p
                className={`font-semibold ${
                  remainingAmount === 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                Remaining: ₹{remainingAmount}
              </p>
            </div>
            <div className="text-center mt-4">
              <button onClick={() => setIsPartialPayment(false)} className="text-blue-600 hover:underline">
                Switch to Single Payment
              </button>
            </div>
          </div>
        ) : (
          <div>
            {isManagementSpecial ? (
              <div className="space-y-3">
                <h3 className="font-semibold mb-1 text-gray-700">Management Settlement</h3>
                <div className="mt-2">
                  <label className="text-gray-700 text-sm mb-1">Select Management Option</label>
                  <Select
                    options={managementOptions}
                    value={managementOptions.find((option) => option.value === orderSource) || null}
                    onChange={(selected) => {
                      setOrderSource(selected ? selected.value : "");
                      if (selected && selected.value !== "custom") {
                        setCustomManagementInput("");
                      }
                    }}
                    placeholder="Select an option..."
                    isClearable
                    className="w-full"
                  />
                  {orderSource === "custom" && (
                    <input
                      type="text"
                      value={customManagementInput}
                      onChange={(e) => setCustomManagementInput(e.target.value)}
                      className="w-full p-2 border rounded-md mt-2"
                      placeholder="Enter custom management option"
                    />
                  )}
                </div>
                <div className="flex flex-col">
                  <label className="text-gray-700 text-sm mb-1">Name</label>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    placeholder="Enter name (optional)"
                  />
                </div>
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-md mt-2 text-sm">
                  This will settle the bill as <strong>Free</strong> for management.
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-semibold mb-3 text-gray-700">Choose Payment Method:</h3>
                <div className="grid grid-cols-3 gap-3">
                  {paymentMethods.map((method) => (
                    <button
                      key={method}
                      className={`p-3 rounded-md font-semibold border ${
                        selectedPaymentMethod === method
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setSelectedPaymentMethod(method)}
                    >
                      {method}
                    </button>
                  ))}
                  {institutionData.integration === "HOTEL" && (
                    <button
                      className={`p-3 rounded-md font-semibold border ${
                        selectedPaymentMethod === "ROOM"
                          ? "bg-green-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setSelectedPaymentMethod("ROOM")}
                    >
                      HOTEL BILL
                    </button>
                  )}
                </div>

                {selectedPaymentMethod === "BTC" && (
                  <div className="mt-3 space-y-2">
                    <div className="mt-2">
                      <label className="text-gray-700 text-sm mb-1">Select Company</label>
                      <Select
                        options={companyOptions}
                        value={companyOptions.find((option) => option.value === orderSource) || null}
                        onChange={(selected) => setOrderSource(selected ? selected.value : "")}
                        placeholder="Select a company..."
                        isClearable
                        className="w-full"
                      />
                      <button
                        onClick={() => setShowAddCompanyForm(true)}
                        className="mt-2 text-blue-600 hover:underline text-sm"
                      >
                        Add New Company
                      </button>
                      {showAddCompanyForm && (
                        <div className="mt-2 p-3 border rounded-md bg-gray-50">
                          <h3 className="text-sm font-semibold mb-2">Add New Company</h3>
                          <input
                            type="text"
                            value={newCompany.name}
                            onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                            className="w-full p-2 border rounded-md mb-2"
                            placeholder="Company Name"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setShowAddCompanyForm(false)}
                              className="px-3 py-1 bg-gray-200 text-gray-800 rounded-md"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleAddCompany}
                              className="px-3 py-1 bg-green-600 text-white rounded-md"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <label className="text-gray-700 text-sm mb-1">Name *</label>
                      <input
                        type="text"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        className="w-full p-2 border rounded-md"
                        placeholder="Name (employee / payer)"
                      />
                      {(!payerName || payerName.trim() === "") && (
                        <div className="text-xs text-red-600 mt-1">Payer name is required for BTC payments.</div>
                      )}
                    </div>

                    <div className="text-xs text-gray-600">
                      BTC payment will use the total bill amount (₹{totalBillAmount}). Company selection is required.
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === "Complementary" && (
                  <div className="space-y-3 mt-3">
                    <h3 className="font-semibold mb-1 text-gray-700">Complementary Settlement</h3>
                    <div className="mt-2">
                      <label className="text-gray-700 text-sm mb-1">Select Complementary Option</label>
                      <Select
                        options={managementOptions}
                        value={managementOptions.find((option) => option.value === orderSource) || null}
                        onChange={(selected) => {
                          setOrderSource(selected ? selected.value : "");
                          if (selected && selected.value !== "custom") {
                            setCustomManagementInput("");
                          }
                        }}
                        placeholder="Select an option..."
                        isClearable
                        className="w-full"
                      />
                      {orderSource === "custom" && (
                        <input
                          type="text"
                          value={customManagementInput}
                          onChange={(e) => setCustomManagementInput(e.target.value)}
                          className="w-full p-2 border rounded-md mt-2"
                          placeholder="Enter custom option"
                        />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <label className="text-gray-700 text-sm mb-1">Name</label>
                      <input
                        type="text"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        className="w-full p-2 border rounded-md"
                        placeholder="Enter name (optional)"
                      />
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-md mt-2 text-sm">
                      This will settle the bill as <strong>Complementary</strong>.
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === "Void" && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-md mt-3 text-sm">
                    <strong>Warning:</strong> This will void the bill and clear the table without any payment.
                  </div>
                )}

                {selectedPaymentMethod === "ROOM" && (
                  <div className="flex flex-row gap-2 my-2">
                    <h3 className="text-sm font-semibold">Select Room:</h3>
                    <select
                      className="border rounded-md p-2 w-full"
                      value={booking?.bookingId || ""}
                      onChange={(e) => setBooking(hotelBookings.find((b) => b.bookingId === e.target.value))}
                    >
                      <option value="" disabled>
                        Select a room
                      </option>
                      {hotelBookings.map((b) => (
                        <option key={b.bookingId} value={b.bookingId}>
                          {b.roomNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedPaymentMethod === "ROOM" && (
                  <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded-md mt-3 text-sm">
                    <strong>Note:</strong> Payment will be collected during hotel checkout.
                  </div>
                )}
              </div>
            )}
            <div className="text-center mt-4">
              <button onClick={() => setIsPartialPayment(true)} className="text-blue-600 hover:underline">
                Switch to Partial Payment
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="text-gray-700 text-sm mb-1">Narration (optional)</label>
          <textarea
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            className="w-full p-2 border rounded-md"
            placeholder="Add any notes or narration here..."
          />
        </div>

        <div className={`flex justify-between mt-6 ${isPartialPayment ? "space-x-4" : ""}`}>
          <button
            onClick={onClose}
            className={`${
              isPartialPayment
                ? "flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300"
                : "bg-gray-400 text-white hover:bg-gray-500"
            } px-4 py-2 rounded-md`}
          >
            Cancel
          </button>

          {isManagementSpecial ? (
            <button
              onClick={handleManagementFreeSettle}
              className="px-4 py-2 rounded-md text-white bg-green-700 hover:bg-green-800"
            >
              Confirm Free Settlement
            </button>
          ) : (
            <button
              onClick={isPartialPayment ? handlePartialPayment : handleSinglePayment}
              disabled={isPartialPayment ? remainingAmount !== 0 : false}
              className={`px-4 py-2 rounded-md text-white ${
                isPartialPayment
                  ? remainingAmount === 0
                    ? "flex-1 bg-green-600 hover:bg-green-700"
                    : "flex-1 bg-gray-400 text-gray-600 cursor-not-allowed"
                  : "bg-green-700"
              }`}
            >
              Confirm Payment
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;