import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";

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
  // New: receive discountData from parent
  discountData,
  setDiscountData,
}) => {
  const { setLoader, hotelBookings, addHotelService } = useContext(Context);
  const tableIdStr = String(selectedTable?.id || "");
  const [totalBillAmount, setTotalBillAmount] = useState(0);

  // Payment method state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [booking, setBooking] = useState(null);
  const [extractedOrderIds, setExtractedOrderIds] = useState([]);

  // Partial payment amounts
  const [cashAmount, setCashAmount] = useState(null);
  const [cardAmount, setCardAmount] = useState(null);
  const [qrAmount, setQrAmount] = useState(null);
  const [roomAmount, setRoomAmount] = useState(null);

  // Management-specific / BTC payer fields (for 444 and 555 and BTC)
  const [orderSource, setOrderSource] = useState("");
  const [payerName, setPayerName] = useState("");

  // Extended payment methods (added BTC)
  const paymentMethods = ["QR", "Cash", "Card", "BTC"];
  const isPartialPayment = institutionData.paymentMethod === "partial";

  // Detect special management institutions
  const isManagementSpecial = (() => {
    const inst = String(institutionData?.institution || "").trim();
    const name = String(institutionData?.companyName || "").toLowerCase();
    if (inst === "444" || inst === "555") return true;
    if (String(selectedTable?.id || "").includes("Management444") || String(selectedTable?.id || "").includes("Management555")) return true;
    return false;
  })();

  // ---------- Discount helper (reads discountData prop similar to OrderContent) ----------
  const getDiscountInfo = () => {
    if (!selectedTable) return { method: "none", value: 0, amount: 0 };

    const tid = String(selectedTable.id);
    const tableDiscountData = (discountData && discountData[tid]) || null;

    if (!tableDiscountData) return { method: "none", value: 0, amount: 0 };

    // If orderId provided (split-bill scenario), prefer order-specific discount
    if (orderId && typeof tableDiscountData === "object" && tableDiscountData[orderId]) {
      return tableDiscountData[orderId];
    }

    // If tableDiscountData is an object keyed by orderIds (no method property) pick first order discount if present
    if (typeof tableDiscountData === "object" && !tableDiscountData.method) {
      const firstKey = Object.keys(tableDiscountData)[0];
      if (firstKey) {
        return tableDiscountData[firstKey] || { method: "none", value: 0, amount: 0 };
      }
    }

    // Otherwise assume it's a direct discount object
    return tableDiscountData;
  };

  // ---------- Totals calculation (mirrors OrderContent.calculateTotals) ----------
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
    const serviceTaxRate =
      institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0;

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

  // compute total whenever items, institution or discount changes
  useEffect(() => {
    const totals = calculateTotals(localBillItems || []);
    setTotalBillAmount(totals.finalTotal);
  }, [localBillItems, institutionData, discountData, orderId]);

  // ---------- Extract order IDs (same as before) ----------
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

  // ---------- Hotel auto-select ----------
  useEffect(() => {
    if (
      institutionData.integration === "HOTEL" &&
      tableIdStr.toLowerCase().startsWith("hotel")
    ) {
      const roomNumber = tableIdStr.replace(/^hotel/i, "");
      const matchingBooking = hotelBookings.find(
        (b) => String(b.roomNumber) === roomNumber
      );
      setBooking(matchingBooking || null);
    }
  }, [tableIdStr, hotelBookings, institutionData.integration]);

  // ---------- saveBill includes discount + computed tax fields ----------
  const saveBill = async () => {
    setLoader(true);
    try {
      const totals = calculateTotals(localBillItems || []);

      await API.put(
        "main",
        `/admin/orders-items/${institutionData.institution}/${tableIdStr}`,
        {
          body: {
            items: localBillItems,
            serviceTaxPercentage:
              institutionData?.serviceTax !== undefined
                ? institutionData.serviceTax
                : 0,
            cgstPercentage: institutionData?.cgst ?? 2.5,
            sgstPercentage: institutionData?.sgst ?? 2.5,
            // discount & computed tax fields
            discountMethod: totals.discountMethod,
            discountValue:
              totals.discountMethod === "percentage"
                ? totals.discountPercentage
                : totals.discountAmount,
            discountPercentage: totals.discountPercentage,
            discountAmount: totals.discountAmount,
            cgst: totals.cgst,
            sgst: totals.sgst,
            serviceTax: totals.serviceTax,
            finalTotal: totals.finalTotal,
            type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
          },
        }
      );

      await API.post(
        "main",
        `/admin/orders-bill/${institutionData.institution}/${tableIdStr}`,
        {
          body: {
            items: localBillItems,
            type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
          },
        }
      );
    } catch (error) {
      console.error("Error saving KOT:", error);
      toast.error("Failed to save KOT. Please try again.");
      setLoader(false);
      throw error;
    }
  };

  // ---------- Input validation ----------
  const validateAmountInput = (value, setAmount) => {
    const numValue = value === null || value === "" ? null : Number(value);
    if (numValue !== null && (isNaN(numValue) || numValue < 0)) {
      toast.error("Payment amount cannot be negative");
      return null;
    }
    setAmount(numValue);
  };

  // ---------- Single payment handling ----------
  const handleSinglePayment = async () => {
    setLoader(true);

    if (!selectedPaymentMethod) {
      toast.error("Please select a payment method.");
      setLoader(false);
      return;
    }

    // If BTC selected, require btcAmount === totalBillAmount and tx id
    if (selectedPaymentMethod === "BTC") {
   
      if (!orderSource) {
        toast.error("Please select Order Source for BTC payment.");
        setLoader(false);
        return;
      }
      // payerName can be optional but allow empty
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
      if (
        customerPhone &&
        billLink &&
        (institutionData.institution === "bhuk2323" ||
          institutionData.institution === "manas25")
      ) {
        try {
          await API.post(
            "main",
            `/admin/send-message/${institutionData.institution}`,
            {
              body: {
                customerName: customerDetails[selectedTable?.id]?.name || "",
                customerPhone: `+91${customerPhone}`,
                billLink: billLink,
                companyName: institutionData.companyName,
              },
            }
          );
        } catch (msgError) {
          console.error("Error sending message:", msgError);
          setLoader(false);
        }
      }

      // prepare settle payload. include btc tx id and orderSource/payerName if BTC selected
      const settleBody = {
        paymentStatus: true,
        type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        paymentMode: "offline",
        paymentMethod: selectedPaymentMethod,
        status: "delivered",
      };

      if (selectedPaymentMethod === "BTC") {
        settleBody.meta = {
          orderSource,
          payerName,
        };
      }

      await API.post(
        "main",
        `/admin/settle-bill/${institutionData.institution}/${tableIdStr}`,
        {
          body: settleBody,
        }
      );

      // Hotel room charges
      if (selectedPaymentMethod === "ROOM") {
        let totalFoodBill = localBillItems
          .filter((item) => item.type !== "bar")
          .reduce((total, item) => total + item.price * item.quantity, 0);

        let totalBarBill = localBillItems
          .filter((item) => item.type === "bar")
          .reduce((total, item) => total + item.price * item.quantity, 0);

        await addHotelService(booking?.bookingId, {
          [booking.roomNumber]: {
            [new Date().toISOString().split("T")[0]]: [
              {
                food_charges: totalFoodBill,
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

  // ---------- Management (444/555) direct-free settle ----------
  const handleManagementFreeSettle = async () => {
    // orderSource and payerName are required-ish: validate lightly
    if (!orderSource) {
      toast.error("Please select Order Source.");
      return;
    }
    // payerName optional but set empty string allowed

    setLoader(true);
    try {
      await saveBill();

      // include orderSource and payerName in the settle request body
      await API.post(
        "main",
        `/admin/settle-bill/${institutionData.institution}/${tableIdStr}`,
        {
          body: {
            type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
            paymentStatus: true,
            paymentMode: "offline",
            paymentMethod: "Free",
            status: "delivered",
            meta: {
              orderSource,
              payerName,
            },
          },
        }
      );

      // No hotel-room-add needed because Free payment is not room charge
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

  // ---------- Partial payment handling ----------
  const handlePartialPayment = async () => {
    const cashAmountFinal = cashAmount || 0;
    const cardAmountFinal = cardAmount || 0;
    const qrAmountFinal = qrAmount || 0;
    const roomAmountFinal = roomAmount || 0;

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
    if (btcAmountFinal > 0) paymentMethodsPayload.push({
      method: "BTC",
      amount: totalBillAmount,
      meta: {
        orderSource,
        payerName,
      }
    });

    setLoader(true);

    try {
      await saveBill();

      let selectedOrderId = "";
      if (extractedOrderIds.length > 0) {
        selectedOrderId = extractedOrderIds[0].split(",")[0];
      }

      const totalFoodBill = localBillItems
        .filter((item) => item.type !== "bar")
        .reduce((sum, item) => sum + item.price * item.quantity, 0);

      const totalBarBill = localBillItems
        .filter((item) => item.type === "bar")
        .reduce((sum, item) => sum + item.price * item.quantity, 0);

      if (roomAmountFinal > 0) {
        await addHotelService(booking?.bookingId, {
          [booking.roomNumber]: {
            [new Date().toISOString().split("T")[0]]: [
              {
                food_charges: totalFoodBill,
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

      await API.post(
        "main",
        `/admin/partial-settle-bill/${institutionData.institution}/${tableIdStr}`,
        {
          body: {
            paymentStatus: true,
            paymentMode: "offline",
            paymentMethods: paymentMethodsPayload,
            status: "delivered",
          },
        }
      );

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

  // ---------- Completion ----------
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
    ((cashAmount || 0) + (cardAmount || 0) + (qrAmount || 0) + (roomAmount || 0) );

  // ---------- Render ----------
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
          {isPartialPayment ? "Split Payment" : "Settle Bill"}
        </h2>

        <div className="mb-4 text-center">
          <p className="text-gray-600">
            Table: <strong>{selectedTable?.id}</strong>
          </p>
          {isPartialPayment && (
            <p className="text-3xl font-bold text-green-600 mt-2">
              ₹{totalBillAmount}
            </p>
          )}
        </div>

        {isPartialPayment ? (
          <div className="space-y-4">
            <div className={`grid gap-2 ${institutionData.integration === "HOTEL" ? 'grid-cols-2' : 'grid-cols-3'}`}>
              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">Cash</label>
                <input
                  type="number"
                  value={cashAmount === null ? '' : cashAmount}
                  onChange={(e) => validateAmountInput(e.target.value, setCashAmount)}
                  className="w-full p-2 border rounded-md text-center"
                  placeholder="Cash"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">Card</label>
                <input
                  type="number"
                  value={cardAmount === null ? '' : cardAmount}
                  onChange={(e) => validateAmountInput(e.target.value, setCardAmount)}
                  className="w-full p-2 border rounded-md text-center"
                  placeholder="Card"
                />
              </div>

              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">QR</label>
                <input
                  type="number"
                  value={qrAmount === null ? '' : qrAmount}
                  onChange={(e) => validateAmountInput(e.target.value, setQrAmount)}
                  className="w-full p-2 border rounded-md text-center"
                  placeholder="QR"
                />
              </div>

              {institutionData.integration === "HOTEL" && (
                <div className="flex flex-col">
                  <label className="text-gray-700 text-sm mb-1">Room</label>
                  <input
                    type="number"
                    value={roomAmount === null ? '' : roomAmount}
                    onChange={(e) => validateAmountInput(e.target.value, setRoomAmount)}
                    className="w-full p-2 border rounded-md text-center"
                    placeholder="Room"
                  />
                </div>
              )}

              {/* BTC field for partial payments */}
              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">BTC</label>
                

                {/* Order Source & Name for BTC partial */}
                <div className="mt-2">
                  <label className="text-gray-700 text-sm mb-1">Order Source</label>
                  <select
                    className="border rounded-md p-2 w-full"
                    value={orderSource}
                    onChange={(e) => setOrderSource(e.target.value)}
                  >
                    <option>Md sir</option>
                    <option>Staff</option>
                    <option>Police Station</option>
                    <option>Food Dep.</option>
                  </select>
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="w-full p-2 border rounded-md mt-2"
                    placeholder="Name (employee / payer)"
                  />
                </div>
              </div>
            </div>

            {institutionData.integration === "HOTEL" && roomAmount > 0 && (
              <div className="flex flex-row gap-2 my-2">
                <h3 className="text-sm font-semibold">Select Room:</h3>
                <select
                  className="border rounded-md p-2 w-full"
                  value={booking?.bookingId || ""}
                  onChange={(e) =>
                    setBooking(hotelBookings.find((b) => b.bookingId === e.target.value))
                  }
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
              <p className={`font-semibold ${remainingAmount === 0 ? 'text-green-600' : 'text-red-500'}`}>
                Remaining: ₹{remainingAmount}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* If special management institution -> show the orderSource/name popup and direct-free settle */}
            {isManagementSpecial ? (
              <div className="space-y-3">
                <h3 className="font-semibold mb-1 text-gray-700">Management Settlement</h3>

                <div className="mt-2">
  <label className="text-gray-700 text-sm mb-1">Order Source</label>
  {["","Md sir", "Staff", "Police Station", "Food Dep."].includes(orderSource) ? (
    <select
      className="border rounded-md p-2 w-full"
      value={orderSource}
      onChange={(e) => setOrderSource(e.target.value)}
    >
      <option value="Md sir">Md sir</option>
      <option value="Staff">Staff</option>
      <option value="Police Station">Police Station</option>
      <option value="Food Dep.">Food Dep.</option>
      <option value="">Other</option>
    </select>
  ) : (
    <input
      type="text"
      value={orderSource}
      onChange={(e) => setOrderSource(e.target.value)}
      className="w-full p-2 border rounded-md"
      placeholder="Enter custom order source"
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
                <h3 className="font-semibold mb-3 text-gray-700">
                  Choose Payment Method:
                </h3>
                <div className="grid grid-cols-4 gap-3">
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

                {/* BTC input for single-pay */}
                {selectedPaymentMethod === "BTC" && (
                  <div className="mt-3 space-y-2">
                   
                    

                    {/* Order Source & Name for single BTC */}
                    <div className="mt-2">
  <label className="text-gray-700 text-sm mb-1">Order Source</label>
  <input
    type="text"
    value={orderSource}
    onChange={(e) => setOrderSource(e.target.value)}
    className="w-full p-2 border rounded-md"
    placeholder="Order Source"
  />

  <input
    type="text"
    value={payerName}
    onChange={(e) => setPayerName(e.target.value)}
    className="w-full p-2 border rounded-md mt-2"
    placeholder="Name (employee / payer)"
  />
</div>


                    <div className="text-xs text-gray-600">
                      Make sure the BTC amount (in ₹) matches the bill. Tx ID and Order Source are required for BTC.
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === "ROOM" && (
                  <div className="flex flex-row gap-2 my-2">
                    <h3 className="text-sm font-semibold">Select Room:</h3>
                    <select
                      className="border rounded-md p-2 w-full"
                      value={booking?.bookingId || ""}
                      onChange={(e) =>
                        setBooking(hotelBookings.find((b) => b.bookingId === e.target.value))
                      }
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
          </div>
        )}

        <div className={`flex justify-between mt-6 ${isPartialPayment ? 'space-x-4' : ''}`}>
          <button
            onClick={onClose}
            className={`${
              isPartialPayment 
                ? 'flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300' 
                : 'bg-gray-400 text-white hover:bg-gray-500'
            } px-4 py-2 rounded-md`}
          >
            Cancel
          </button>

          {/* Confirm button: changes behavior for management special */}
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
                    ? 'flex-1 bg-green-600 hover:bg-green-700' 
                    : 'flex-1 bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-green-700'
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
