import { Modal } from "flowbite-react";
import { useContext, useEffect, useState, useRef } from "react";
import { API } from "aws-amplify";
import { toast } from "react-toastify";
import { FaTimes, FaCheckCircle, FaClock } from "react-icons/fa";
import { AiOutlineInfoCircle } from "react-icons/ai";
import { Context } from "../../../../../Context";
import { getCurrencySymbol } from "../../../../../common/Inputs";
import OrderReceipt from '../../../../public/Product/OrderReceipt'

const OrderModal = ({
  showModal,
  setShowModal,
  order,
  setOrder,
  fetchOrders,
  formatTime,
  timers,
}) => {
  const { userData, institutionData } = useContext(Context);
  const { institution } = institutionData;
  const { setLoader } = useContext(Context);
  const [minutes, setMinutes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(order.status || "");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    order.paymentMethod || ""
  );
  const [showBreakdown, setShowBreakdown] = useState(false);
  const breakdownRef = useRef(null);
  const totalItems = order.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const calculateTotalWithTax = (order) => {
    const cgstAmount = order.cgst || 0;
    const sgstAmount = order.sgst || 0;
    const serviceCharge = order.serviceTax || 0;

    const itemTotal = order.totalAmount - cgstAmount - sgstAmount - serviceCharge;

    const cgstPercentage = ((cgstAmount / itemTotal) * 100).toFixed(2);
    const sgstPercentage = ((sgstAmount / itemTotal) * 100).toFixed(2);
    const serviceChargePercentage = Math.round((serviceCharge / itemTotal) * 100);

    return {
      itemTotal: itemTotal.toFixed(2),
      cgstAmount: cgstAmount,
      sgstAmount: sgstAmount,
      serviceCharge: serviceCharge,
      cgstPercentage,
      sgstPercentage,
      serviceChargePercentage,
      finalTotal: order.totalAmount.toFixed(2),
    };
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        breakdownRef.current &&
        !breakdownRef.current.contains(event.target)
      ) {
        setShowBreakdown(false);
      }
    };

    if (showBreakdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showBreakdown]);

  const handleUpdateOrder = async () => {
    if (!selectedStatus) {
      toast.warning("Please select an order status");
      return;
    }

    setLoader(true);
    try {
      const deliveryTime = selectedStatus === "preparing" && minutes && parseInt(minutes) > 0 
        ? Date.now() + parseInt(minutes) * 60 * 1000 
        : null;

      const updatedOrder = {
        ...order,
        status: selectedStatus,
        deliveryTime,
      };

      await API.put("main", `/chef/update-order/${institution}`, {
        body: updatedOrder,
      });

      if (selectedPaymentMethod && !order.paymentStatus) {
        await API.put(
          "main",
          `/admin/offline-payment/${institution}/${order.orderId}`,
          {
            body: {
              paymentStatus: true,
              paymentMode: "offline",
              paymentMethod: selectedPaymentMethod,
            },
          }
        );
      }

      fetchOrders();
      toast.success("Order updated successfully!");
      closeModal();
    } catch (e) {
      console.error("Error updating order:", e);
      toast.error("Failed to update order.");
    } finally {
      setLoader(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setMinutes("");
    setSelectedStatus(order.status || "");
    setSelectedPaymentMethod(order.paymentMethod || "");
    setShowBreakdown(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "text-yellow-500",
      preparing: "text-blue-500",
      ready: "text-green-500",
      delivered: "text-indigo-600"
    };
    return colors[status] || "text-gray-500";
  };

  const getPaymentStatusColor = () => {
    if (!order.paymentStatus) {
      return "bg-red-100 text-red-800";
    }
    return "bg-green-100 text-green-800";
  };

  useEffect(() => {
    setSelectedStatus(order.status || "");
    setSelectedPaymentMethod(order.paymentMethod || "");
  }, [order]);

  const canUpdateStatus = userData?.userType === "admin" || (userData?.userType === "chef" && order.status === "preparing") ||(userData?.userType === "chef" && order.status === "pending")||
    (userData?.userType === "waiter" && order.status === "ready");

  const canUpdatePayment = userData?.userType === "admin" || userData?.userType === "waiter";

  const showTimerInput = (userData?.userType === "admin"|| userData?.userType === "chef") &&
    selectedStatus === "preparing" &&
    order.status !== "preparing";

  const getStatusOptions = () => {
    if (userData?.userType === "admin") {
      return (
        <>
          <option value="">Select Status</option>
          <option value="pending">Pending</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="delivered">Delivered</option>
        </>
      );
    } else if (userData?.userType === "waiter" && order.status === "ready") {
      return (
        <>
          <option value="">Select Status</option>
          <option value="delivered">Delivered</option>
        </>
      );
    }
    else if (userData?.userType === "chef" && order.status === "pending") {
      return (
        <>
          <option value="">Select Status</option>
          <option value="preparing">Preparing</option>
        </>
      );
    }
    else if (userData?.userType === "chef" && order.status === "preparing") {
      return (
        <>
          <option value="">Select Status</option>
          <option value="ready">Ready</option>
        </>
      );
    }
    return <option value="">No status options available</option>;
  };

  return (
    <Modal
      show={showModal}
      onClose={closeModal}
      className="transition-all transform duration-300 ease-in-out"
      size="md"
    >
      <Modal.Header closeButton>
        <div className="flex justify-between items-center w-full">
          <h1 className="text-xl font-semibold text-gray-800">Order Details</h1>
        </div>
      </Modal.Header>

      <Modal.Body className="space-y-4 bg-white shadow-lg rounded-lg p-6">
        <div className="flex justify-between items-center">
          <p className="text-lg text-gray-700">
            <span className="font-semibold">OrderID: </span>
            {order.orderId}
          </p>
          <div className="flex flex-col items-end gap-1">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPaymentStatusColor()}`}>
              {order.paymentStatus ? "Paid" : "Unpaid"}
            </span>
          </div>
        </div>

        {userData.userType === "member" && (
          <div className="text-lg text-gray-700">
            <span className="font-semibold">Current Status: </span>
            <span className={`font-semibold ${getStatusColor(order.status)}`}>
              {order.status}
            </span>
          </div>
        )}

        <div className="space-y-2 relative">
          <p className="text-lg text-gray-700 flex items-center ">
            <span className="font-semibold">Total Amount: </span>
            <span className="text-green-500 ml-2">
              {getCurrencySymbol(order.currency)}
              {order.totalAmount}
            </span>
            <button
              className="ml-2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowBreakdown(!showBreakdown)}
            >
              <AiOutlineInfoCircle size={18} />
            </button>
          </p>

          {showBreakdown && (
            <div className="fixed inset-0 flex items-center justify-center z-50">
              <div className="fixed inset-0 bg-black opacity-20" onClick={() => setShowBreakdown(false)} />
              <div
                ref={breakdownRef}
                className="bg-white p-4 shadow-lg rounded-lg border w-72 text-sm relative"
              >
                <p className="mb-2">
                  Items Total: {getCurrencySymbol(order.currency)}
                  {isNaN(calculateTotalWithTax(order).itemTotal) 
    ? order.totalAmount 
    : calculateTotalWithTax(order).itemTotal}
                </p>
                <p className="mb-2">
                  CGST ({calculateTotalWithTax(order).cgstPercentage}%):{" "}
                  {getCurrencySymbol(order.currency)}
                  {calculateTotalWithTax(order).cgstAmount}
                </p>
                <p className="mb-2">
                  SGST ({calculateTotalWithTax(order).sgstPercentage}%):{" "}
                  {getCurrencySymbol(order.currency)}
                  {calculateTotalWithTax(order).sgstAmount}
                </p>
                {calculateTotalWithTax(order).serviceCharge > 0 && (
                  <p className="mb-2">
                    Service Charge ({calculateTotalWithTax(order).serviceChargePercentage}%):{" "}
                    {getCurrencySymbol(order.currency)}
                    {calculateTotalWithTax(order).serviceCharge}
                  </p>
                )}
                <p className="font-bold border-t mt-2 pt-2">
                  Final Total: {getCurrencySymbol(order.currency)}
                  {calculateTotalWithTax(order).finalTotal}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {order.paymentStatus && (
          <p className="text-gray-700">
            <span className="font-semibold">Payment Details: </span>
            {order.paymentMethod} (offline)
          </p>
        )}

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-800">Items: ({totalItems})</h3>
          <div className="max-h-32 overflow-y-auto">
            <ul className="space-y-3 px-2">
              {order.items?.map((item) => (
                <li
                  key={item.itemId}
                  className="flex justify-between items-center p-4 bg-gray-100 rounded-lg shadow-sm transition-all hover:bg-gray-200"
                >
                  <span className="font-medium text-gray-800">{item.name}</span>
                  <span className="text-gray-600">x{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {(canUpdateStatus || canUpdatePayment) && (
          <div className="mt-6 space-y-4">
            {canUpdateStatus && (
              <div>
                <label className="font-semibold text-gray-700 block mb-2">
                  Update Status:
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="block w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                >
                  {getStatusOptions()}
                </select>
              </div>
            )}

            {showTimerInput && (
              <div>
                <label className="block text-sm font-semibold text-gray-800">
                  Preparation Time (minutes) - Optional
                </label>
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="e.g., 15"
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            )}

            {canUpdatePayment && !order.paymentStatus && (
              <div>
                <label className="font-semibold text-gray-700 block mb-2">
                  Payment Method:
                </label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="block w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                >
                  <option value="">Select Payment Method</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="QR">QR</option>
                </select>
              </div>
            )}

            <button
              onClick={handleUpdateOrder}
              className="w-full px-4 py-3 bg-primaryColor text-white rounded-lg transition-colors hover:bg-opacity-90 font-medium shadow-sm"
            >
              Update Order
            </button>
          </div>
        )}

        {userData?.userType === "member" && !canUpdateStatus && !canUpdatePayment && order.paymentStatus && (
            <div className="mt-4 flex justify-center">
              <OrderReceipt order={order} />
            </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default OrderModal;
