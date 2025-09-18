import React, { useState, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import Select from "react-select";

const OrderPaymentModal = ({
  selectedTable,
  institutionData,
  onClose,
  selectedOrderId,
  fetchTableData,
  fetchPendingOrders,
  customerDetails,
  orderGroups,
}) => {
  const matchedOrder = orderGroups.find((order) => order.orderId === selectedOrderId);

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
  const [companies, setCompanies] = useState([]);
  const [newCompany, setNewCompany] = useState({ gstin: "", name: "" });
  const [showAddCompanyForm, setShowAddCompanyForm] = useState(false);
  const [error, setError] = useState(null);

  // Management dropdown options
  const [managementOptions] = useState([
    { value: "Md Sir", label: "Md Sir" },
    { value: "Staff", label: "Staff" },
    { value: "Police Station", label: "Police Station" },
    { value: "Food Dep.", label: "Food Dep." },
    { value: "custom", label: "Custom" },
  ]);
  const [customManagementInput, setCustomManagementInput] = useState("");

  const paymentMethods = ["QR", "Cash", "Card", "BTC"];
  const isPartialPayment = institutionData.paymentMethod === "partial";

  // Detect special management institutions
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

  // ---------- Robust fetchCompanies ----------
  const fetchCompanies = async () => {
    setLoader(true);
    setError(null);
    try {
      const resp = await API.get("frontdesk", `/company/${institutionData?.institutionId}`, {});
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
      const inst = institutionData?.institution || institutionData?.institutionId;
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
      setOrderSource(newCompanyObj.company_id || newCompanyObj.companyId || newCompanyObj.id || "");
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

  // ---------- Update Company Credit ----------
  const updateCompanyCredit = async (companyId, amount, name, orderId) => {
    try {
      const type = institutionData?.bar_integration === "Yes" ? "bar" : "cafe";
      const creditData = {
        amount: Number(amount),
        date: new Date().toISOString().split("T")[0],
        name: name || "Unknown",
        type: type,
        orderId: orderId,
      };
      await API.patch("frontdesk", `/company`, {
        body: {
          credit: creditData,
          institutionId: institutionData.institutionId,
          company_id: companyId,
        },
      });
      toast.success("Company credit updated successfully");
    } catch (error) {
      console.error("updateCompanyCredit error:", error);
      toast.error("Failed to update company credit");
      throw error;
    }
  };

  // ---------- Calculate Totals ----------
  const calculateTotals = (items) => {
    if (!items || !Array.isArray(items)) {
      return {
        subtotal: 0,
        cgst: 0,
        sgst: 0,
        serviceTax: 0,
        totalWithTax: 0,
      };
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const serviceTaxPercentage =
      institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0;
    const cgstPercentage = institutionData?.cgst !== undefined ? institutionData.cgst : 2.5;
    const sgstPercentage = institutionData?.sgst !== undefined ? institutionData.sgst : 2.5;

    const taxableSubtotal = items
      .filter((item) => item.type !== "bar")
      .reduce((sum, item) => sum + item.price * item.quantity, 0);

    const cgst = (taxableSubtotal * cgstPercentage) / 100;
    const sgst = (taxableSubtotal * sgstPercentage) / 100;
    const serviceTax = (subtotal * serviceTaxPercentage) / 100;

    const totalWithTax = Math.round(subtotal + cgst + sgst + serviceTax);

    return {
      subtotal,
      cgst,
      sgst,
      serviceTax,
      totalWithTax,
    };
  };

  // Fetch companies only when BTC is selected
  useEffect(() => {
    if (selectedPaymentMethod === "BTC") {
      fetchCompanies();
    }
  }, [selectedPaymentMethod]);

  // Handle new company form submission
  const handleAddCompany = async () => {
    if (!newCompany.gstin || !newCompany.name) {
      toast.error("Please provide both GSTIN and Company Name");
      return;
    }
    await createCompany({
      gstin: newCompany.gstin,
      name: newCompany.name,
    });
  };

  // Defensive mapping for react-select options
  const companyOptions = (companies || []).map((company) => ({
    value: company.company_id || company.companyId || company.id || company.name || "",
    label: `${company.name || company.label || "Unnamed"}${company.gst_no ? ` — ${company.gst_no}` : ""}`,
    raw: company,
  }));

  // Calculate total bill amount for the specific order
  useEffect(() => {
    if (!matchedOrder) return;

    const totals = calculateTotals(matchedOrder.items);
    setTotalBillAmount(totals.totalWithTax);
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
    if (selectedPaymentMethod === "BTC" && !orderSource) {
      toast.error("Please select a company for BTC payment.");
      setLoader(false);
      return;
    }

    try {
      // Create bill link
      let billLink = `https://bhukkadrestrocafe.awsaiapp.com/receipt?orderIds=${selectedOrderId}`;

      if (institutionData.institution === "manas25") {
        billLink = `https://manasrestaurant.tekkzy.com/receipt?orderIds=${selectedOrderId}`;
      }

      // Send message if phone number exists and we have a bill link
      const customerPhone = customerDetails[selectedTable?.id]?.phone;
      if (
        customerPhone &&
        billLink &&
        (institutionData.institution === "bhuk2323" || institutionData.institution === "manas25")
      ) {
        try {
          await API.post("main", `/admin/send-message/${institutionData.institution}`, {
            body: {
              customerName: customerDetails[selectedTable?.id]?.name || "",
              customerPhone: `+91${customerPhone}`,
              billLink: billLink,
              companyName: institutionData.companyName,
            },
          });
        } catch (msgError) {
          console.error("Error sending message:", msgError);
        }
      }

      // Prepare settle payload, include meta if BTC
      const settleBody = {
        paymentStatus: true,
        paymentMode: "offline",
        paymentMethod: selectedPaymentMethod,
        type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        status: "delivered",
      };

      if (selectedPaymentMethod === "BTC") {
        settleBody.meta = {
          orderSource,
          payerName,
        };
        // Update company credit for BTC payment
        await updateCompanyCredit(orderSource, totalBillAmount, payerName, selectedOrderId);
      }

      // Handle hotel room billing
      if (selectedPaymentMethod === "ROOM") {
        let totalFoodBill = matchedOrder.items
          .filter((item) => item.type !== "bar")
          .reduce((total, item) => total + item.price * item.quantity, 0);

        let totalBarBill = matchedOrder.items
          .filter((item) => item.type === "bar")
          .reduce((total, item) => total + item.price * item.quantity, 0);

        const totals = calculateTotals(matchedOrder.items);
        const totalFoodBillWithGST = totalFoodBill + totals.cgst + totals.sgst;

        if (!booking?.bookingId) {
          toast.error("Please select a room for hotel billing.");
          setLoader(false);
          return;
        }

        await addHotelService(booking.bookingId, {
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
        if (apiError.message) errorMessage += ` - ${apiError.message}`;
        if (apiError.error) errorMessage += `: ${apiError.error}`;
      }

      toast.error(errorMessage);
      setLoader(false);
    }
  };

  // Management (444/555) direct-free settle
  const handleManagementFreeSettle = async () => {
    if (!orderSource) {
      toast.error("Please select or enter a management option.");
      return;
    }

    setLoader(true);
    try {
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
              orderSource: orderSource === "custom" ? customManagementInput : orderSource,
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

    if (btcAmountFinal > 0 && !orderSource) {
      toast.error("Please select a company for BTC payment.");
      setLoader(false);
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
        },
      });
      await updateCompanyCredit(orderSource, btcAmountFinal, payerName, selectedOrderId);
    }

    setLoader(true);

    try {
      const totalFoodBill = matchedOrder.items
        .filter((item) => item.type !== "bar")
        .reduce((sum, item) => sum + item.price * item.quantity, 0);

      const totalBarBill = matchedOrder.items
        .filter((item) => item.type === "bar")
        .reduce((sum, item) => sum + item.price * item.quantity, 0);

      if (roomAmountFinal > 0) {
        if (!booking?.bookingId) {
          toast.error("Please select a room for hotel billing.");
          setLoader(false);
          return;
        }
        const totals = calculateTotals(matchedOrder.items);
        const totalFoodBillWithGST = totalFoodBill + totals.cgst + totals.sgst;
        await addHotelService(booking.bookingId, {
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
                {btcAmount > 0 && (
                  <div className="mt-2 space-y-2">
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
                          value={newCompany.gstin}
                          onChange={(e) => setNewCompany({ ...newCompany, gstin: e.target.value })}
                          className="w-full p-2 border rounded-md mb-2"
                          placeholder="GSTIN"
                        />
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
                      className="w-full p-2 border rounded-md"
                      placeholder="Name (employee / payer)"
                    />
                  </div>
                )}
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
            {/* If special management institution -> show the management dropdown */}
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

                {/* BTC fields for single-pay */}
                {selectedPaymentMethod === "BTC" && (
                  <div className="mt-3 space-y-2">
                    <div>
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
                            value={newCompany.gstin}
                            onChange={(e) => setNewCompany({ ...newCompany, gstin: e.target.value })}
                            className="w-full p-2 border rounded-md mb-2"
                            placeholder="GSTIN"
                          />
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
                      <label className="text-gray-700 text-sm mb-1">Name</label>
                      <input
                        type="text"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        className="w-full p-2 border rounded-md"
                        placeholder="Name (employee / payer)"
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      BTC payment will use the total bill amount (₹{totalBillAmount}). Company selection is required.
                    </div>
                  </div>
                )}

                {/* Hotel Room Selection */}
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