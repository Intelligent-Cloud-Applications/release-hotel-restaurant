import { Modal, Dropdown } from "flowbite-react";
import { useContext, useEffect, useState } from "react";
import { API, Auth } from "aws-amplify";
import AWS from 'aws-sdk';
import { toast } from "react-toastify";
import { FaTimes, FaCheckCircle, FaClock } from "react-icons/fa";
import { Context } from "../../../../../Context";
import { getCurrencySymbol } from "../../../../../common/Inputs";

const OrderModal = ({ showModal, setShowModal, order, setOrder, fetchOrders }) => {
  const { userData, institutionData } = useContext(Context);
  const { institution } = institutionData;
  const { setLoader } = useContext(Context);
  
  const [paymentStatus, setPaymentStatus] = useState(order?.paymentStatus || false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  useEffect(() => {
    const configureAWS = async () => {
      try {
       
        const credentials = await Auth.currentCredentials();
        AWS.config.update({
          region: process.env.REACT_APP_STAGE === 'prod'?'us-east-1':'us-east-2', 
          credentials: credentials
        });
      } catch (error) {
        console.error('Error configuring AWS:', error);
      }
    };

    configureAWS();
  }, []);
  useEffect(() => {
    setPaymentStatus(order?.paymentStatus || false);
    setSelectedPaymentMethod("");
  }, [order]);

  const totalItems = order.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const handleOfflinePayment = async () => {
    if (
      selectedPaymentMethod &&
      (selectedPaymentMethod === "Cash" || selectedPaymentMethod === "Card" || selectedPaymentMethod === "QR")
    ) {

    try {
     
      setLoader(true);
      const response = await API.put('main', `/admin/offline-payment/${institution}/${order.orderId}`, {
        body: {
          paymentStatus: true,
          paymentMode: "offline" ,
          paymentMethod: selectedPaymentMethod,
      
        }
      });
      await API.put("main", `/admin/verify-order/${institution}/${order.orderId}`, {});
         const credentials = await Auth.currentCredentials();
            const Lambda = new AWS.Lambda({
              credentials: credentials,
              region: process.env.REACT_APP_STAGE === 'prod'?'us-east-1':'us-east-2' 
            });
      
            await Lambda.invoke({
              FunctionName: process.env.REACT_APP_STAGE === 'prod'?'cafe-prod-sendOrderUpdate':'cafe-sendOrderUpdate',
              InvocationType: 'Event',
              Payload: JSON.stringify({
                orderId: order.orderId,
                institution: institution,
                userType:"chef",
              })
            }).promise();
            await Lambda.invoke({
              FunctionName: process.env.REACT_APP_STAGE === 'prod'?'cafe-prod-sendOrderUpdate':'cafe-sendOrderUpdate',
              InvocationType: 'Event',
              Payload: JSON.stringify({
                orderId: order.orderId,
                institution: institution,
                userType:"admin",
              })
            }).promise();
      if (response) {
        toast.success("Payment status updated successfully");
        fetchOrders();
        closeModal();
      }
    } catch (error) {
      console.error("Error updating payment:", error);
      toast.error(error.message || "Failed to update payment");
    } finally {
      setLoader(false);
    } 
  } else {
      toast.warning("Please select a valid payment method (Cash or Card).");
      closeModal();
    }
  };
  
  const closeModal = () => {
    setShowModal(false);
    setSelectedPaymentMethod("");
    setPaymentStatus(order?.paymentStatus || false);
  };

  return (
    <Modal show={showModal} onClose={closeModal} className="transition-all transform duration-300 ease-in-out" size="md">
      <Modal.Header closeButton>
        <div className="flex justify-between items-center w-full">
          <h1 className="text-xl font-semibold text-gray-800">Order Details</h1>
        </div>
      </Modal.Header>
      <Modal.Body className="space-y-2 bg-white shadow-lg rounded-lg p-6">
        <p className="text-lg text-gray-700">
          <span className="font-semibold">OrderID: </span>
          {order.orderId}
        </p>
        <p className="text-lg text-gray-700">
          <span className="font-semibold">Total Amount: </span>
          <span className="text-green-500">{getCurrencySymbol(order.currency)}{order.totalAmount}</span>
        </p>

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

      
        {(userData?.userType === "waiter" || userData?.userType === "admin") &&
          !order.paymentStatus && (
            <div className="mt-6 space-y-4">
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

              <button
                onClick={handleOfflinePayment}
                className="w-full mt-6 px-4 py-3 bg-primaryColor text-white rounded-lg transition-colors font-medium shadow-sm"
              >
                Update Order
              </button>
            </div>
          )}
      

      
      </Modal.Body>
    </Modal>
  );
};

export default OrderModal;