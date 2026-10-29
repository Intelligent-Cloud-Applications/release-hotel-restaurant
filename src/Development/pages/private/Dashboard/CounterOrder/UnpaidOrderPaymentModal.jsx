import React, { useState, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import Select from "react-select";

const UnpaidOrderPaymentModal = ({
  selectedTable,
  institutionData,
  onClose,
  unpaidOrder,
  settleUnpaidOrder,
  fetchTableData,
  fetchPendingOrders,
  customerDetails,
  discountData,
  setDiscountData,
}) => {
  const { setLoader, hotelBookings, addHotelService, nextBillNumber } = useContext(Context);
  const tableIdStr = String(selectedTable.id);
    // Resolve active bill number for this unpaid order
  const existingBillNo = unpaidOrder?.billNo || unpaidOrder?.billNumber || null;
  const displayBillNo = existingBillNo || nextBillNumber;
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [booking, setBooking] = useState(null);
  const [cashAmount, setCashAmount] = useState(null);
  const [cardAmount, setCardAmount] = useState(null);
  const [qrAmount, setQrAmount] = useState(null);
  const [roomAmount, setRoomAmount] = useState(null);
  const [btcAmount, setBtcAmount] = useState(null);
  const [complementaryAmount, setComplementaryAmount] = useState(null);
  const [voidAmount, setVoidAmount] = useState(null);
  const [orderSource, setOrderSource] = useState("");
  const [payerName, setPayerName] = useState("");
  const [narration, setNarration] = useState("");
  const [companies, setCompanies] = useState([]);
  const [newCompany, setNewCompany] = useState({ gstin: "", name: "" });
  const [showAddCompanyForm, setShowAddCompanyForm] = useState(false);
  const [error, setError] = useState(null);
  const [isPartialPayment, setIsPartialPayment] = useState(institutionData.paymentMethod === "partial");

  const managementOptions = [
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

  const [customManagementInput, setCustomManagementInput] = useState("");
  const paymentMethods = ["QR", "Cash", "Card", "BTC", "Complementary", "Void"];

  const isManagementSpecial = (() => {
    const inst = String(institutionData?.institution || "").trim();
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

  const fetchCompanies = async () => {
    setLoader(true);
    setError(null);
    try {
      const resp = await API.get("frontdesk", `/company/${institutionData?.institution}`, {});
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

  const createCompany = async (payload) => {
    setLoader(true);
    setError(null);
    try {
      const inst = institutionData?.institution;
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
      setOrderSource(newCompanyObj.name || ""); // Immediately select the new company
      setShowAddCompanyForm(false); // Close the form
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

  const updateCompanyCredit = async (companyName, amount, name, orderId) => {
    try {
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
      const epochSec = Math.floor(Date.now() / 1000);

      const creditData = {
        [epochSec]: {
          amount: Number(amount),
          name: String(name).trim(),
          createdOn: epochSec,
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

  const calculateTotals = (items) => {
    if (!items || !Array.isArray(items)) {
      return {
        subtotal: 0,
        cgst: 0,
        sgst: 0,
        serviceTax: 0,
        totalWithTax: 0,
        discountAmount: 0,
        discountPercentage: 0,
        discountMethod: "none",
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

    const discountInfo = discountData[tableIdStr]?.[unpaidOrder.orderId] || { method: "none", value: 0, amount: 0 };
    let discountAmount = 0;
    let discountPercentage = 0;

    if (discountInfo.method === "percentage" && discountInfo.value > 0) {
      discountPercentage = Math.min(Number(discountInfo.value), 100);
      discountAmount = (subtotal * discountPercentage) / 100;
    } else if (discountInfo.method === "amount" && discountInfo.value > 0) {
      discountAmount = Math.min(Number(discountInfo.value), subtotal);
    }

    const discountedSubtotal = subtotal - discountAmount;
    const discountedTaxableSubtotal = Math.max(0, taxableSubtotal - discountAmount);

    const cgst = (discountedTaxableSubtotal * cgstPercentage) / 100;
    const sgst = (discountedTaxableSubtotal * sgstPercentage) / 100;
    const serviceTax = (discountedSubtotal * serviceTaxPercentage) / 100;

    const totalWithTax = Math.round(discountedSubtotal + cgst + sgst + serviceTax);

    return {
      subtotal,
      cgst,
      sgst,
      serviceTax,
      totalWithTax,
      discountAmount,
      discountPercentage,
      discountMethod: discountInfo.method,
    };
  };

  useEffect(() => {
    if (selectedPaymentMethod === "BTC" || btcAmount > 0) {
      fetchCompanies();
    }
  }, [selectedPaymentMethod, btcAmount]);

  const handleAddCompany = async () => {
    if (!newCompany.name) {
      toast.error("Please provide a Company Name");
      return;
    }
    await createCompany({
      gstin: newCompany.gstin,
      name: newCompany.name,
    });
    await fetchCompanies();
  };

  const companyOptions = (companies || []).map((company) => ({
    value: company.name || "Unnamed",
    label: `${company.name || "Unnamed"}${company.gst_no ? ` — ${company.gst_no}` : ""}`,
    raw: company,
  }));

  const totalBillAmount = calculateTotals(unpaidOrder.items).totalWithTax;

  useEffect(() => {
    if (institutionData.integration === "HOTEL" && tableIdStr.toLowerCase().startsWith("hotel")) {
      const roomNumber = tableIdStr.replace(/^hotel/i, "");
      const matchingBooking = hotelBookings.find((b) => String(b.roomNumber) === roomNumber);
      setBooking(matchingBooking || null);
    }
  }, [tableIdStr, hotelBookings, institutionData.integration]);

  const validateAmountInput = (value, setAmount) => {
    const numValue = value === null || value === "" ? null : Number(value);

    if (numValue !== null && numValue < 0) {
      toast.error("Payment amount cannot be negative");
      return null;
    }

    setAmount(numValue);
  };

  const handlePayment = async (paymentMethod, isManagementFree = false) => {
    setLoader(true);

    if (!selectedPaymentMethod && !isManagementFree) {
      toast.error("Please select a payment method.");
      setLoader(false);
      return;
    }

    // Enforce validations for BTC and Complementary
    if (selectedPaymentMethod === "BTC" || selectedPaymentMethod === "Complementary" || isManagementFree) {
      if (!orderSource) {
        toast.error(
          `Please select a ${isManagementFree ? "management option" : selectedPaymentMethod === "BTC" ? "company" : "complementary option"}.`
        );
        setLoader(false);
        return;
      }
      if (!payerName || String(payerName).trim() === "") {
        toast.error(`Payer name is required for ${isManagementFree ? "management free" : selectedPaymentMethod} payment.`);
        setLoader(false);
        return;
      }
      // Verify company exists for BTC
      if (selectedPaymentMethod === "BTC" && !getCompanyIdByName(orderSource)) {
        toast.error("Selected company not found.");
        setLoader(false);
        return;
      }
    }

    // Enforce room selection for ROOM
    if (selectedPaymentMethod === "ROOM" && !booking) {
      toast.error("Please select a room for ROOM payment.");
      setLoader(false);
      return;
    }

    try {
      const settleBody = {
        narration,
      };

      if (isManagementFree) {
        settleBody.paymentMethod = "Complementary";
        settleBody.meta = {
          orderSource: orderSource === "custom" ? customManagementInput : orderSource,
          payerName,
          narration,
        };
        paymentMethod = "Free";
      } else if (selectedPaymentMethod === "Complementary") {
        settleBody.paymentMethod = "Complementary";
        settleBody.meta = {
          orderSource: orderSource === "custom" ? customManagementInput : orderSource,
          payerName,
          narration,
        };
      } else if (selectedPaymentMethod === "Void") {
        settleBody.paymentStatus = true; // Consistent with settleUnpaidOrder
        settleBody.paymentMethod = "Void";
        settleBody.meta = {
          payerName,
          narration,
        };
      } else if (selectedPaymentMethod === "BTC") {
        settleBody.paymentMethod = "BTC";
        settleBody.meta = {
          orderSource,
          payerName,
          narration,
        };
        await updateCompanyCredit(orderSource, totalBillAmount, payerName, unpaidOrder.orderId);
      } else if (selectedPaymentMethod === "ROOM") {
        settleBody.paymentMethod = "ROOM";
        settleBody.meta = { narration };
        settleBody.bookingInfo = booking ? { bookingId: booking.bookingId, roomNumber: booking.roomNumber } : null;
      } else {
        settleBody.paymentMethod = selectedPaymentMethod;
        settleBody.meta = { narration };
      }

      if (selectedPaymentMethod === "ROOM" || isManagementFree) {
        if (!booking?.bookingId && selectedPaymentMethod === "ROOM") {
          toast.error("Please select a room for hotel billing.");
          setLoader(false);
          return;
        }

        if (booking) {
          const totalFoodBill = unpaidOrder.items
            .filter((item) => item.type !== "bar")
            .reduce((total, item) => total + item.price * item.quantity, 0);

          const totalBarBill = unpaidOrder.items
            .filter((item) => item.type === "bar")
            .reduce((total, item) => total + item.price * item.quantity, 0);

          const totals = calculateTotals(unpaidOrder.items);
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
                  order_id: unpaidOrder.orderId,
                },
              ],
            },
          });
        }
      }

      await settleUnpaidOrder(unpaidOrder, paymentMethod, settleBody);
      await completePayment();
    } catch (error) {
      console.error("Payment Error:", error);
      let errorMessage = isManagementFree ? "Failed to process management free payment." : "Failed to process payment.";
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

  const handlePartialPayment = async () => {
    const cashAmountFinal = cashAmount || 0;
    const cardAmountFinal = cardAmount || 0;
    const qrAmountFinal = qrAmount || 0;
    const roomAmountFinal = roomAmount || 0;
    const btcAmountFinal = btcAmount || 0;
    const complementaryAmountFinal = complementaryAmount || 0;
    const voidAmountFinal = voidAmount || 0;

    const totalPaid =
      cashAmountFinal +
      cardAmountFinal +
      qrAmountFinal +
      roomAmountFinal +
      btcAmountFinal +
      complementaryAmountFinal +
      voidAmountFinal;

    if (totalPaid !== totalBillAmount) {
      toast.error(`Total paid (₹${totalPaid}) must equal bill amount (₹${totalBillAmount})`);
      return;
    }

    // Validation for BTC
    if (btcAmountFinal > 0) {
      if (!orderSource) {
        toast.error("Please select a company for BTC payment.");
        return;
      }
      if (!payerName || String(payerName).trim() === "") {
        toast.error("Payer name is required for BTC payment.");
        return;
      }
      if (!getCompanyIdByName(orderSource)) {
        toast.error("Selected company not found.");
        return;
      }
    }

    // Validation for Complementary
    if (complementaryAmountFinal > 0) {
      if (!orderSource) {
        toast.error("Please select a complementary option.");
        return;
      }
      if (!payerName || String(payerName).trim() === "") {
        toast.error("Payer name is required for Complementary payment.");
        return;
      }
    }

    // Validation for ROOM
    if (roomAmountFinal > 0 && !booking) {
      toast.error("Please select a room for ROOM payment.");
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
          narration,
        },
      });
      await updateCompanyCredit(orderSource, btcAmountFinal, payerName, unpaidOrder.orderId);
    }
    if (complementaryAmountFinal > 0) {
      paymentMethodsArray.push({
        method: "Complementary",
        amount: complementaryAmountFinal,
        meta: {
          orderSource: orderSource === "custom" ? customManagementInput : orderSource,
          payerName,
          narration,
        },
      });
    }
    if (voidAmountFinal > 0) {
      paymentMethodsArray.push({
        method: "Void",
        amount: voidAmountFinal,
        meta: {
          payerName,
          narration,
        },
      });
    }

    setLoader(true);

    try {
      if (roomAmountFinal > 0) {
        if (!booking?.bookingId) {
          toast.error("Please select a room for hotel billing.");
          setLoader(false);
          return;
        }
        const totalFoodBill = unpaidOrder.items
          .filter((item) => item.type !== "bar")
          .reduce((sum, item) => sum + item.price * item.quantity, 0);

        const totalBarBill = unpaidOrder.items
          .filter((item) => item.type === "bar")
          .reduce((sum, item) => sum + item.price * item.quantity, 0);

        const totals = calculateTotals(unpaidOrder.items);
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
                order_id: unpaidOrder.orderId,
              },
            ],
          },
        });
      }

      const settleBody = {
        paymentMethods: paymentMethodsArray,
        narration,
      };

      if (roomAmountFinal > 0) {
        settleBody.bookingInfo = booking ? { bookingId: booking.bookingId, roomNumber: booking.roomNumber } : null;
      }

      await settleUnpaidOrder(unpaidOrder, "Multiple", settleBody);
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

  const completePayment = async () => {
    onClose();
    setLoader(false);
    await fetchTableData(tableIdStr);
    await fetchPendingOrders();
    toast.success(`Order #${unpaidOrder.orderId} payment successful!`);
  };

  const remainingAmount =
    totalBillAmount -
    ((cashAmount || 0) +
      (cardAmount || 0) +
      (qrAmount || 0) +
      (roomAmount || 0) +
      (btcAmount || 0) +
      (complementaryAmount || 0) +
      (voidAmount || 0));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-auto flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-[30rem] max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-center mb-4 text-gray-800">
          {isPartialPayment ? "Split Payment" : "Settle Unpaid Order"}
        </h2>

        <div className="mb-4 text-center">
          <p className="text-gray-600">
            Table: <strong>{selectedTable.id}</strong>
          </p>
          <p className="text-gray-600 mb-2">
            Order ID: <strong>{unpaidOrder.orderId}</strong>
            {displayBillNo && selectedPaymentMethod !== "Complementary" && (
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono font-semibold">
                Bill #{displayBillNo}
              </span>
            )}
            {selectedPaymentMethod === "Complementary" && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono font-semibold">
                Complementary (No Bill No)
              </span>
            )}
          </p>
          <p className="text-3xl font-bold text-green-600 mt-2">₹{unpaidOrder.totalAmount}</p>
        </div>

        {isPartialPayment ? (
          <div className="space-y-4">
            <div
              className={`grid gap-2 ${
                institutionData.integration === "HOTEL" ? "grid-cols-3" : "grid-cols-3"
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
              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">BTC</label>
                <input
                  type="number"
                  value={btcAmount === null ? "" : btcAmount}
                  onChange={(e) => validateAmountInput(e.target.value, setBtcAmount)}
                  className="w-full p-2 border rounded-md text-center"
                  placeholder="BTC"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">Complementary</label>
                <input
                  type="number"
                  value={complementaryAmount === null ? "" : complementaryAmount}
                  onChange={(e) => validateAmountInput(e.target.value, setComplementaryAmount)}
                  className="w-full p-2 border rounded-md text-center"
                  placeholder="Complementary"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-gray-700 text-sm mb-1">Void</label>
                <input
                  type="number"
                  value={voidAmount === null ? "" : voidAmount}
                  onChange={(e) => validateAmountInput(e.target.value, setVoidAmount)}
                  className="w-full p-2 border rounded-md text-center"
                  placeholder="Void"
                />
              </div>
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

            {(btcAmount > 0 || complementaryAmount > 0) && (
              <div className="mt-2">
                <label className="text-gray-700 text-sm mb-1">
                  {btcAmount > 0 ? "Select Company" : "Select Complementary Option"}
                </label>
                <Select
                  options={btcAmount > 0 ? companyOptions : managementOptions}
                  value={
                    btcAmount > 0
                      ? companyOptions.find((option) => option.value === orderSource) || null
                      : managementOptions.find((option) => option.value === orderSource) || null
                  }
                  onChange={(selected) => {
                    setOrderSource(selected ? selected.value : "");
                    if (selected && selected.value !== "custom") {
                      setCustomManagementInput("");
                    }
                  }}
                  placeholder={btcAmount > 0 ? "Select a company..." : "Select an option..."}
                  isClearable
                  className="w-full"
                />
                {btcAmount > 0 && (
                  <button
                    onClick={() => setShowAddCompanyForm(true)}
                    className="mt-2 text-blue-600 hover:underline text-sm"
                  >
                    Add New Company
                  </button>
                )}
                {showAddCompanyForm && btcAmount > 0 && (
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
                {complementaryAmount > 0 && orderSource === "custom" && (
                  <input
                    type="text"
                    value={customManagementInput}
                    onChange={(e) => setCustomManagementInput(e.target.value)}
                    className="w-full p-2 border rounded-md mt-2"
                    placeholder="Enter custom option"
                  />
                )}
                {(btcAmount > 0 || complementaryAmount > 0) && (
                  <input
                    type="text"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="w-full p-2 border rounded-md mt-2"
                    placeholder="Name (employee / payer) *"
                  />
                )}
                {(btcAmount > 0 || complementaryAmount > 0) && (!payerName || payerName.trim() === "") && (
                  <div className="text-xs text-red-600 mt-1">
                    Payer name is required for {btcAmount > 0 ? "BTC" : "Complementary"} payments.
                  </div>
                )}
              </div>
            )}

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

            {institutionData.integration === "HOTEL" && roomAmount > 0 && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded-md mt-3 text-sm">
                <strong>Note:</strong> Room charges will be collected during hotel checkout.
              </div>
            )}

            {voidAmount > 0 && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-md mt-3 text-sm">
                <strong>Warning:</strong> Void amount will clear the bill without payment for the specified amount.
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
                  This will settle the order as <strong>Free</strong> for management.
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-semibold mb-3 text-gray-700">Choose Payment Method:</h3>
                <div className="grid gap-3 grid-cols-3">
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
                      <label className="text-gray-700 text-sm mb-1">Name *</label>
                      <input
                        type="text"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        className="w-full p-2 border rounded-md"
                        placeholder="Enter name"
                      />
                      {(!payerName || payerName.trim() === "") && (
                        <div className="text-xs text-red-600 mt-1">Payer name is required for Complementary payments.</div>
                      )}
                    </div>
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-md mt-2 text-sm">
                      This will settle the order as <strong>Complementary</strong>.
                    </div>
                  </div>
                )}

                {selectedPaymentMethod === "Void" && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-md mt-3 text-sm">
                    <strong>Warning:</strong> This will void the bill and clear the order without any payment.
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
                      {hotelBookings.map((bookingItem) => (
                        <option key={bookingItem.bookingId} value={bookingItem.bookingId}>
                          {bookingItem.roomNumber}
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

                <div className="text-center mt-4">
                  <button onClick={() => setIsPartialPayment(true)} className="text-blue-600 hover:underline">
                    Switch to Partial Payment
                  </button>
                </div>
              </div>
            )}
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
              onClick={() => handlePayment("Free", true)}
              className="px-4 py-2 rounded-md text-white bg-green-700 hover:bg-green-800"
            >
              Confirm Free Settlement
            </button>
          ) : (
            <button
              onClick={isPartialPayment ? handlePartialPayment : () => handlePayment(selectedPaymentMethod)}
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

export default UnpaidOrderPaymentModal;