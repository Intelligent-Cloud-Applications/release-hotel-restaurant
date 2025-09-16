import React, { useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import { API } from "aws-amplify";

const PaymentPopup = ({ orderId, institution, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showIframe, setShowIframe] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState("");
  const [selectedMethod, setSelectedMethod] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const storedPayment = JSON.parse(localStorage.getItem("latestPayment"));
    if (storedPayment?.orderId === orderId) {
      setSelectedMethod(storedPayment.method);
    }
  }, [orderId]);

  const handlePayment = () => {
    const url = process.env.REACT_APP_STAGE === 'prod'?`https://happyprancer.com/cafepayment/${institution}/${orderId}`:`https://beta.happyprancer.com/cafepayment/${institution}/${orderId}`;
    updateLocalStorage("online");
    window.location.href = url; 
    onClose?.();
  };
  

  const handleOfflinePayment = async () => {
    try {
      await API.post("main", "/any/lambda-calling", {
        body: {
          orderId: orderId,
          institution: institution,
          userType: "admin",
        },
      });

      await API.post("main", "/any/lambda-calling", {
        body: {
          orderId: orderId,
          institution: institution,
          userType: "waiter",
        },
      });
    } catch (error) {
      console.error("Error updating order status:", error);
    }

    updateLocalStorage("offline");
    onClose?.();
  };

  const updateLocalStorage = (method) => {
    const paymentData = { orderId, institution, method };
    localStorage.setItem("latestPayment", JSON.stringify(paymentData));
    setSelectedMethod(method);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-11/12 sm:w-3/4 max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold max478:text-[16px]">
            {showIframe ? "Complete Your Payment" : "Choose Payment Method"}
          </h2>
          {/* <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes size={20} />
          </button> */}
        </div>

        
          <>
            <p className="text-gray-600 mb-6 max478:text-[14px]">
             Please choose your payment method.
            </p>

            {selectedMethod && (
              <p className="text-blue-600 font-semibold mb-4">
                You previously chose: {selectedMethod === "online" ? "Online Payment" : "Pay at Counter"}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-end">
              <button
                onClick={handleOfflinePayment}
                className={`w-full sm:w-auto px-6 py-2 rounded-lg max478:text-[14px] ${
                  selectedMethod === "offline"
                    ? "bg-gray-700 text-white"
                    : "bg-gray-500 text-white hover:bg-gray-600"
                }`}
              >
                Pay at Counter
              </button>
              <button
                onClick={handlePayment}
                className={`w-full sm:w-auto px-6 py-2 rounded-lg max478:text-[14px] ${
                  selectedMethod === "online"
                    ? "bg-green-700 text-white"
                    : "bg-green-500 text-white hover:bg-green-600"
                }`}
              >
                Pay Online Now
              </button>
            </div>
          </>
       
      </div>
    </div>
  );
};

export default PaymentPopup;
