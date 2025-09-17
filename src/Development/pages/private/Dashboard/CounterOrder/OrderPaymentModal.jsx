import React, { useState, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";

const OrderPaymentModal = ({ 
  selectedTable, 
  institutionData, 
  onClose, 
  selectedOrderId, 
  fetchTableData,
  fetchPendingOrders,
  customerDetails,
  orderGroups
}) => {
  const matchedOrder = orderGroups.find(order => order.orderId === selectedOrderId);

  // Common state
  const { setLoader, hotelBookings, addHotelService } = useContext(Context);
  const tableIdStr = String(selectedTable.id);
  const [totalBillAmount, setTotalBillAmount] = useState(0);

  // State for single payment method
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [booking, setBooking] = useState(null);

  // State for partial payment method
  const [cashAmount, setCashAmount] = useState(null);
  const [cardAmount, setCardAmount] = useState(null);
  const [qrAmount, setQrAmount] = useState(null);
  const [roomAmount, setRoomAmount] = useState(null);
  const [btcAmount, setBtcAmount] = useState(null);

  // Management-specific / BTC payer fields
  const [orderSource, setOrderSource] = useState("");
  const [payerName, setPayerName] = useState("");

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

  // Calculate total bill amount for the specific order
  useEffect(() => {
    if (!matchedOrder) return;

    const subtotal = matchedOrder.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const serviceTaxPercentage =
      institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0;
    const cgstPercentage =
      institutionData?.cgst !== undefined ? institutionData.cgst : 2.5;
    const sgstPercentage =
      institutionData?.sgst !== undefined ? institutionData.sgst : 2.5;

    const totalTaxPercentage =
      serviceTaxPercentage + cgstPercentage + sgstPercentage;

    const taxAmount = (subtotal * totalTaxPercentage) / 100;
    const totalWithTax = Math.round(subtotal + taxAmount);

    setTotalBillAmount(totalWithTax);
  }, [matchedOrder, institutionData]);

  // Validate amount input for partial payment
  const validateAmountInput = (value, setAmount) => {
    const numValue = value === null || value === "" ? null : Number(value);

    if (numValue !== null && numValue < 0) {
      toast.error("Payment amount cannot be negative");
      return null;
    }

    setAmount(numValue);
  };

  // Handle single payment method
  const handleSinglePayment = async () => {
    setLoader(true);

    if (!selectedPaymentMethod) {
      toast.error("Please select a payment method.");
      setLoader(false);
      return;
    }

    // If BTC selected, require orderSource
    if (selectedPaymentMethod === "BTC") {
      if (!orderSource) {
        toast.error("Please select Order Source for BTC payment.");
        setLoader(false);
        return;
      }
      // payerName can be optional but allow empty
    }

    try {
      // Create bill link
      let billLink = `https://bhukkadrestrocafe.awsaiapp.com/receipt?orderIds=${selectedOrderId}`;

      if (institutionData.institution === "manas25") {
        billLink = `https://manasrestaurant.tekkzy.com/receipt?orderIds=${selectedOrderId}`;
      }

      // Only send message if phone number exists and we have a bill link
      const customerPhone = customerDetails[selectedTable?.id]?.phone;
      if (customerPhone && billLink && (institutionData.institution === "bhuk2323" || institutionData.institution === "manas25")) {
        try {
          await API.post(
            'main', 
            `/admin/send-message/${institutionData.institution}`,
            {
              body: {
                customerName: customerDetails[selectedTable?.id]?.name || "",
                customerPhone: `+91${customerPhone}`,
                billLink: billLink,
                companyName: institutionData.companyName
              }
            }
          );
        } catch (msgError) {
          console.error("Error sending message:", msgError);
        }
      }

      // prepare settle payload. include meta if BTC
      const settleBody = {
        paymentStatus: true,
        paymentMode: "offline",
        paymentMethod: selectedPaymentMethod,
        type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
      };

      if (selectedPaymentMethod === "BTC") {
        settleBody.meta = {
          orderSource,
          payerName,
        };
      }

      // Handle hotel room billing
      if (selectedPaymentMethod === "ROOM") {
        let totalFoodBill = matchedOrder.items
          .filter(item => item.type !== "bar")
          .reduce((total, item) => total + item.price * item.quantity, 0);

        let totalBarBill = matchedOrder.items
          .filter(item => item.type === "bar")
          .reduce((total, item) => total + item.price * item.quantity, 0);

        if (!booking?.bookingId) {
          toast.error("Please select a room for hotel billing.");
          setLoader(false);
          return;
        }

        await addHotelService(booking.bookingId, {
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
        `/admin/settle-bill-order/${institutionData.institution}/${tableIdStr}/${selectedOrderId}`,
        {
          body: settleBody,
        }
      );

      await completePayment();
    } catch (error) {
      console.error("Payment Error:", error);

      let errorMessage = "Failed to process payment.";

      if (error?.response?.data) {
        const apiError = error.response.data;
        // Append backend message + error details
        if (apiError.message) errorMessage += ` - ${apiError.message}`;
        if (apiError.error) errorMessage += `: ${apiError.error}`;
      }

      toast.error(errorMessage);
      setLoader(false);
    }
  };

  // Management (444/555) direct-free settle
  const handleManagementFreeSettle = async () => {
    // orderSource is required
    if (!orderSource) {
      toast.error("Please select Order Source.");
      return;
    }
    // payerName optional

    setLoader(true);
    try {
      // include orderSource and payerName in the settle request body
      await API.post(
        "main",
        `/admin/settle-bill-order/${institutionData.institution}/${tableIdStr}/${selectedOrderId}`,
        {
          body: {
            paymentStatus: true,
            type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
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

  // Handle partial payment method
  const handlePartialPayment = async () => {
    const cashAmountFinal = cashAmount || 0;
    const cardAmountFinal = cardAmount || 0;
    const qrAmountFinal = qrAmount || 0;
    const roomAmountFinal = roomAmount || 0;
    const btcAmountFinal = btcAmount || 0;
    const totalPaid = cashAmountFinal + cardAmountFinal + qrAmountFinal + roomAmountFinal + btcAmountFinal;

    if (totalPaid !== totalBillAmount) {
      toast.error(`Total paid (₹${totalPaid}) must equal bill amount (₹${totalBillAmount})`);
      return;
    }

    // Validate BTC if used
    if (btcAmountFinal > 0 && !orderSource) {
      toast.error("Please select Order Source for BTC payment.");
      return;
    }

    const paymentMethodsArray = [];
    if (cashAmountFinal > 0) {
      paymentMethodsArray.push({ method: "Cash", amount: cashAmountFinal });
    }
    if (cardAmountFinal > 0) {
      paymentMethodsArray.push({ method: "Card", amount: cardAmountFinal });
    }
    if (qrAmountFinal > 0) {
      paymentMethodsArray.push({ method: "QR", amount: qrAmountFinal });
    }
    if (roomAmountFinal > 0) {
      paymentMethodsArray.push({ method: "ROOM", amount: roomAmountFinal });
    }
    if (btcAmountFinal > 0) {
      paymentMethodsArray.push({
        method: "BTC",
        amount: btcAmountFinal,
        meta: {
          orderSource,
          payerName,
        }
      });
    }

    setLoader(true);

    try {
      const totalFoodBill = matchedOrder.items
        .filter(item => item.type !== "bar")
        .reduce((sum, item) => sum + item.price * item.quantity, 0);

      const totalBarBill = matchedOrder.items
        .filter(item => item.type === "bar")
        .reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Handle hotel room billing if room amount is present
      if (roomAmountFinal > 0) {
        if (!booking?.bookingId) {
          toast.error("Please select a room for hotel billing.");
          setLoader(false);
          return;
        }
        await addHotelService(booking.bookingId, {
          [booking.roomNumber]: {
            [new Date().toISOString().split("T")[0]]: [
              {
                food_charges: totalFoodBill,
                extra_bed_charges: 0,
                laundry_charges: 0,
                manual_charges: 0,
                minibar_charges: totalBarBill,
                orderId: selectedOrderId,
              },
            ],
          },
        });
      }

      await API.post(
        "main",
        `/admin/partial-settle-bill-order/${institutionData.institution}/${tableIdStr}/${selectedOrderId}`,
        {
          body: {
            paymentStatus: true,
            paymentMode: "offline",
            paymentMethods: paymentMethodsArray,
            status: "delivered",
            type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
          },
        }
      );

      await completePayment();
    } catch (error) {
      console.error("Payment Error:", error);

      let errorMessage = "Failed to process payment.";

      if (error?.response?.data) {
        const apiError = error.response.data;
        // Append backend message + error details
        if (apiError.message) errorMessage += ` - ${apiError.message}`;
        if (apiError.error) errorMessage += `: ${apiError.error}`;
      }

      toast.error(errorMessage);
      setLoader(false);
    }
  };

  // Common completion logic
  const completePayment = async () => {
    onClose();
    setLoader(false);

    // Refresh the table data and pending orders
    await fetchTableData(tableIdStr);
    await fetchPendingOrders();

    toast.success(`Order #${selectedOrderId} payment successful!`);
  };

  // Calculate remaining amount for partial payment
  const remainingAmount =
    totalBillAmount -
    ((cashAmount || 0) + (cardAmount || 0) + (qrAmount || 0) + (roomAmount || 0) + (btcAmount || 0));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
          {isPartialPayment ? "Split Payment" : "Settle Order"}
        </h2>

        {/* Order Summary */}
        <div className="mb-4 text-center">
          <p className="text-gray-600">
            Table: <strong>{selectedTable.id}</strong>
          </p>
          <p className="text-gray-600 mb-2">
            Order ID: <strong>{selectedOrderId}</strong>
          </p>
          {isPartialPayment && (
            <p className="text-3xl font-bold text-green-600 mt-2">
              ₹{totalBillAmount}
            </p>
          )}
        </div>

        {/* Conditional UI based on payment method */}
        {isPartialPayment ? (
          // Partial Payment UI
          <div className="space-y-4">
            <div
              className={`grid gap-2 ${
                institutionData.integration === "HOTEL" ? "grid-cols-2" : "grid-cols-4"
              }`}
            >
              {/* Cash Payment */}
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

              {/* Card Payment */}
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

              {/* QR Payment */}
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

              {/* BTC Payment */}
              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">BTC</label>
                <input
                  type="number"
                  value={btcAmount === null ? "" : btcAmount}
                  onChange={(e) => validateAmountInput(e.target.value, setBtcAmount)}
                  className="w-full p-2 border rounded-md text-center mb-2"
                  placeholder="BTC"
                />
                {/* Order Source & Name for BTC partial */}
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="text-gray-700 text-sm mb-1 block">Order Source</label>
                    <select
                      className="border rounded-md p-2 w-full"
                      value={orderSource}
                      onChange={(e) => setOrderSource(e.target.value)}
                    >
                      <option value="">Select Source</option>
                      <option value="Md sir">Md sir</option>
                      <option value="Staff">Staff</option>
                      <option value="Police Station">Police Station</option>
                      <option value="Food Dep.">Food Dep.</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  {orderSource === "Other" && (
                    <input
                      type="text"
                      value={orderSource}
                      onChange={(e) => setOrderSource(e.target.value)}
                      className="w-full p-2 border rounded-md"
                      placeholder="Enter custom order source"
                    />
                  )}
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="w-full p-2 border rounded-md"
                    placeholder="Name (employee / payer)"
                  />
                </div>
              </div>

              {/* Room Payment - Only show if hotel integration */}
              {institutionData.integration === "HOTEL" && (
                <div className="flex flex-col">
                  <label className="text-gray-700 text-sm mb-1">Room</label>
                  <input
                    type="number"
                    value={roomAmount === null ? "" : roomAmount}
                    onChange={(e) => validateAmountInput(e.target.value, setRoomAmount)}
                    className="w-full p-2 border rounded-md text-center"
                    placeholder="Room"
                  />
                </div>
              )}
            </div>

            {/* Hotel Room Selection - Only show if room amount is entered */}
            {institutionData.integration === "HOTEL" && roomAmount > 0 && (
              <div className="flex flex-row gap-2 my-2">
                <h3>Select Room:</h3>
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
                  {hotelBookings.map((bookingItem) => (
                    <option key={bookingItem.bookingId} value={bookingItem.bookingId}>
                      {bookingItem.roomNumber}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Hotel Bill Note - Only show if room amount is entered */}
            {institutionData.integration === "HOTEL" && roomAmount > 0 && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded-md mt-3 text-sm">
                <strong>Note:</strong> Room charges will be collected during hotel checkout.
              </div>
            )}

            {/* Remaining Amount Indicator */}
            <div className="text-center mt-2">
              <p
                className={`font-semibold ${
                  remainingAmount === 0 ? "text-green-600" : "text-red-500"
                }`}
              >
                Remaining: ₹{remainingAmount}
              </p>
            </div>
          </div>
        ) : (
          // Single Payment Method UI
          <div>
            {/* If special management institution -> show the orderSource/name and direct-free settle */}
            {isManagementSpecial ? (
              <div className="space-y-3">
                <h3 className="font-semibold mb-1 text-gray-700">Management Settlement</h3>

                <div className="mt-2">
                  <label className="text-gray-700 text-sm mb-1">Order Source</label>
                  {["Md sir", "Staff", "Police Station", "Food Dep."].includes(orderSource) ? (
                    <select
                      className="border rounded-md p-2 w-full"
                      value={orderSource}
                      onChange={(e) => setOrderSource(e.target.value)}
                    >
                      <option value="Md sir">Md sir</option>
                      <option value="Staff">Staff</option>
                      <option value="Police Station">Police Station</option>
                      <option value="Food Dep.">Food Dep.</option>
                      <option value="Other">Other</option>
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
                  This will settle the order as <strong>Free</strong> for management.
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-semibold mb-3 text-gray-700">Choose Payment Method:</h3>
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
                </div>

                {/* BTC fields for single-pay */}
                {selectedPaymentMethod === "BTC" && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <label className="text-gray-700 text-sm mb-1">Order Source</label>
                      <select
                        className="border rounded-md p-2 w-full"
                        value={orderSource}
                        onChange={(e) => setOrderSource(e.target.value)}
                      >
                        <option value="">Select Source</option>
                        <option value="Md sir">Md sir</option>
                        <option value="Staff">Staff</option>
                        <option value="Police Station">Police Station</option>
                        <option value="Food Dep.">Food Dep.</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    {orderSource === "Other" && (
                      <input
                        type="text"
                        value={orderSource}
                        onChange={(e) => setOrderSource(e.target.value)}
                        className="w-full p-2 border rounded-md"
                        placeholder="Enter custom order source"
                      />
                    )}
                    <input
                      type="text"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      className="w-full p-2 border rounded-md"
                      placeholder="Name (employee / payer)"
                    />
                    <div className="text-xs text-gray-600">
                      Order Source is required for BTC. Make sure the BTC amount matches the bill total.
                    </div>
                  </div>
                )}

                {/* Hotel Room Selection */}
                {selectedPaymentMethod === "ROOM" && (
                  <div className="flex flex-row gap-2 my-2">
                    <h3>Select Room:</h3>
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
                      {hotelBookings.map((bookingItem) => (
                        <option key={bookingItem.bookingId} value={bookingItem.bookingId}>
                          {bookingItem.roomNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Hotel Bill Note */}
                {selectedPaymentMethod === "ROOM" && (
                  <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded-md mt-3 text-sm">
                    <strong>Note:</strong> Payment will be collected during hotel checkout.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
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
              disabled={isPartialPayment ? remainingAmount !== 0 : !selectedPaymentMethod}
              className={`px-4 py-2 rounded-md text-white ${
                isPartialPayment
                  ? remainingAmount === 0
                    ? "flex-1 bg-green-600 hover:bg-green-700"
                    : "flex-1 bg-gray-400 text-gray-600 cursor-not-allowed"
                  : selectedPaymentMethod
                  ? "bg-green-700 hover:bg-green-800"
                  : "bg-gray-400"
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

export default OrderPaymentModal;