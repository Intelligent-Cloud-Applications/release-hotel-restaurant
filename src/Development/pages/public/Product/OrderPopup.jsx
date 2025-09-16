import React, { useContext, useEffect, useState, useRef } from "react";
import { Context } from "../../../Context";
import { API } from "aws-amplify";
import { getCurrencySymbol } from "../../../common/Inputs";
import { AiOutlineInfoCircle, AiOutlineClose } from "react-icons/ai";
import OrderReceipt from './OrderReceipt';
const OrderPopup = ({ isPopupOpen, setIsPopupOpen }) => {
  const { institutionData } = useContext(Context);
  const [orderIds, setOrderIds] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orderDetails, setOrderDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const popupRef = useRef(null);
  const breakdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isPopupOpen &&
        popupRef.current &&
        !popupRef.current.contains(event.target)
      ) {
        setIsPopupOpen(false);
      }
    };
    if (isPopupOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPopupOpen, setIsPopupOpen]);

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

  useEffect(() => {
    const storedOrderIds = JSON.parse(localStorage.getItem("orderId")) || [];
    if (storedOrderIds.length > 0) {
      const sortedOrderIds = storedOrderIds.reverse();
      setOrderIds(sortedOrderIds);
      setSelectedOrderId(sortedOrderIds[0]);
    } else {
      console.warn("No order IDs found in local storage.");
    }
  }, []);
  const calculateTotalWithTax = (order) => {

    const cgstAmount = order.cgst || 0;
    const sgstAmount = order.sgst || 0;
    const serviceCharge = order.serviceTax || 0;

    const itemTotal = order.totalAmount - cgstAmount - sgstAmount - serviceCharge;

    const cgstPercentage = ((cgstAmount / itemTotal) * 100).toFixed(1);
    const sgstPercentage = ((sgstAmount / itemTotal) * 100).toFixed(1);
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
    const fetchOrderDetails = async () => {
      if (selectedOrderId) {
        setLoading(true);
        try {
          const response = await API.get(
            "main",
            `/any/get-order/${institutionData.institution}`,
            {
              queryStringParameters: { orderId: selectedOrderId },
            }
          );
          console.log("Order details fetched successfully:", response);
          const updatedOrders = response.orders.map((order) => {
            if (order.deliveryTime) {
              const { timeLeft, secondsLeft } = calculateRemainingTime(
                order.deliveryTime
              );
              return { ...order, remainingTime: timeLeft, secondsLeft };
            }
            return order;
          });

          setOrderDetails(updatedOrders || []);
        } catch (error) {
          console.error(
            "Failed to fetch order details:",
            error.response ? error.response.data : error.message
          );
        } finally {
          setLoading(false);
        }
      }
    };

    if (isPopupOpen && selectedOrderId) {
      fetchOrderDetails();
    }
  }, [isPopupOpen, selectedOrderId, institutionData]);

  const calculateRemainingTime = (deliveryTime) => {
    const timeDiff = new Date(deliveryTime) - new Date();
    if (timeDiff <= 0) return { timeLeft: "00:00", secondsLeft: 0 };

    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    const formattedMinutes = String(minutes).padStart(2, "0");
    const formattedSeconds = String(seconds).padStart(2, "0");

    return {
      timeLeft: `${formattedMinutes}:${formattedSeconds}`,
      secondsLeft: timeDiff / 1000,
    };
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (orderDetails.length > 0) {
        const updatedRemainingTime = orderDetails.map((order) => {
          if (order.deliveryTime) {
            const remainingTimeObj = calculateRemainingTime(order.deliveryTime);
            return {
              ...order,
              remainingTime: remainingTimeObj.timeLeft,
            };
          }
          return order;
        });

        setOrderDetails(updatedRemainingTime);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [orderDetails]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsPopupOpen(false);
        }
      }}
    >
      <div
        ref={popupRef}
        className="relative bg-white p-6 rounded-lg shadow-lg max-w-md w-full text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 transition-colors duration-200"
          onClick={() => setIsPopupOpen(false)}
        >
          <AiOutlineClose size={24} />
        </button>
        <h2 className="text-2xl font-bold mb-4 text-center">Order Details</h2>
        {orderIds.length > 0 && (
          <div className="mb-4">
            <label
              htmlFor="order-dropdown"
              className="block text-sm font-medium mb-2"
            >
              Select Order:
            </label>
            <select
              id="order-dropdown"
              className="w-full p-2 border rounded"
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
            >
              {orderIds.map((id) => (
                <option key={id} value={id}>
                  Order ID: {id}
                </option>
              ))}
            </select>
          </div>
        )}

        {loading ? (
          <p className="text-center">Loading...</p>
        ) : orderDetails.length > 0 ? (
          orderDetails.map((order, index) => (
            <div key={index} className="mb-4  pb-4">
              <p className="mb-2">
                Total(Rounded):{" "}
                <span className="font-bold">
                  {getCurrencySymbol(order.currency)}
                  {order.totalAmount}
                </span>
                <button
                  className="ml-2 mb-2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowBreakdown(!showBreakdown)}
                >
                  <AiOutlineInfoCircle size={18} />
                </button>
                {showBreakdown && (
                  <div
                    className="absolute bg-white p-4 shadow-md rounded-lg border mt-2 z-50"
                    ref={breakdownRef}
                  >
                    <p>
                      Items Total: {getCurrencySymbol(order.currency)}
                      {isNaN(calculateTotalWithTax(order).itemTotal) 
    ? order.totalAmount 
    : calculateTotalWithTax(order).itemTotal}
                    </p>
                    <p>
                      CGST ({calculateTotalWithTax(order).cgstPercentage}%):{" "}
                      {getCurrencySymbol(order.currency)}
                      {calculateTotalWithTax(order).cgstAmount}
                    </p>
                    <p>
                      SGST ({calculateTotalWithTax(order).sgstPercentage}%):{" "}
                      {getCurrencySymbol(order.currency)}
                      {calculateTotalWithTax(order).sgstAmount}
                    </p>
                    {calculateTotalWithTax(order).serviceCharge > 0 && (
                      <p>
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
                )}

              </p>
              <p className="mb-1">Table Name: {order.tableName}</p>
              <p className="mb-1">Name: {order.name}</p>
              <h4 className="font-bold mb-2">Items:</h4>
              <ul className="list-disc ml-5 max-h-20 overflow-y-auto">
                {order.items.map((item) => (
                  <li key={item.itemId} className="mb-1">
                    <span>
                      {item.name} (x{item.quantity}):{" "}
                      {getCurrencySymbol(order.currency)}
                      {item.price}
                    </span>
                  </li>
                ))}
              </ul>
              {order.paymentStatus && (
                <div className="flex flex-row">
                  <p className="mt-[2px]">Payment:</p>{" "}
                  <p className="text-lg text-gray-700">
                    {order.paymentMode}({order.paymentMethod})
                  </p>
                </div>
              )}
              <p className="text-sm text-gray-500">
                Created At: {new Date(order.createdAt).toLocaleString()}
              </p>

              {/* Show delivery time for preparing status */}
              {order.status === "preparing" && order.deliveryTime && (
                <div className="mt-1">
                  <span className="font-semibold">Time Left:</span>{" "}
                  <span className="text-lg font-bold text-blue-600">
                    {order.remainingTime}
                  </span>
                </div>
              )}

              {order.status && (
                <div
                  className={`${order.status === "ready"
                      ? "text-green-600"
                      : order.status === "pending"
                        ? "text-red-600"
                        : order.status === "preparing"
                          ? "text-blue-600"
                          : "text-gray-600"
                    } p-1 mt-1`}
                >
                  <span>
                    Status:{" "}
                    {order.status.charAt(0).toUpperCase() +
                      order.status.slice(1)}
                  </span>
                </div>
              )}
              {order.paymentStatus && (
                <div className="mt-4 flex justify-center ">
                  <OrderReceipt
                    order={order}
                  />
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="mb-4 text-center">No order details available.</p>
        )}


      </div>
    </div>
  );
};

export default OrderPopup;