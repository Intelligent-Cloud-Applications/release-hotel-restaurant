import { useContext, useEffect, useState } from "react";
import { API, Auth } from "aws-amplify";
import AWS from 'aws-sdk';
import { Context } from "../../../../Context";
import { PaginatedTable } from "../../../../common/DataDisplay";
import OrderModal from "./OrderModal";
import { FaEye, FaCheck } from "react-icons/fa6";
import { Button } from "flowbite-react";
import { getCurrencySymbol } from "../../../../common/Inputs";
import { useWebSocket } from '../../../../Context/WebSocketContext';
import { FaXmark } from "react-icons/fa6";
import Error from "../../../Error";

const PendingOrders = () => {
  const { institution } = useContext(Context).institutionData;
    const { institutionData } = useContext(Context);
  const [orders, setOrders] = useState([]);
  const { userData } = useContext(Context);
  const { setLoader } = useContext(Context);
  const [modalOrder, setModalOrder] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [totalorders, settotalOrders] = useState([]);
  const { subscribe } = useWebSocket();
  if (userData?.userType !== 'admin') {
    return <Error message="Access Denied: Admins Only" />;
  }
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    getOrders();
  
    const unsubscribe = subscribe(async (message) => {
      console.log("Received WebSocket message:", message);
  
      const orderIdFromMessage = message?.message?.match(/Order ID: (\d+)/)?.[1];
  
      if (!orderIdFromMessage) {
        return;
      }

      const orderExists = totalorders.some(totalorders => totalorders.orderId === orderIdFromMessage);
  
      if (!orderExists) {
        
        alert(`A pending order has been created with Order ID: ${orderIdFromMessage}`);
        getOrders();
      }
    });
  
    return () => unsubscribe();
  }, [institution, userData, subscribe]);

  const getOrders = async () => {
    if (!userData || !userData.userType || !userData.cognitoId) {
      console.log("Waiting for userData to load...");
      return;
    }
    try {
      setLoader(true);
      const type = institutionData?.bar_integration === "Yes" ? "bar" : "cafe";

      const result = await API.get(
        "main",
        `/admin/list-orders/${institution}?type=${type}`,
        {}
      );
      console.log("Fetched orders:", result);
      settotalOrders(result);
  
      let filteredOrders = [];
  
     
      filteredOrders = result.filter((order) => {
        const verifyCondition = order.hasOwnProperty('verify') && order.verify === true;
        const paymentCondition = order.hasOwnProperty('paymentStatus') && order.paymentStatus === true;
      
     
        return !(verifyCondition || paymentCondition);
      });
      
      
      const sortedOrders = filteredOrders.sort(
        (a, b) => b.createdAt - a.createdAt
      );
  
      setOrders(sortedOrders);
  
    
  
      setLoader(false);
    } catch (e) {
      console.error("Error fetching orders:", e);
      setLoader(false);
    }
  };
  const handleCancelOrder = async (orderId) => {
    try {
      const confirmAction = window.confirm("Are you sure you want to cancel this order?");
      if (!confirmAction) return;
      
      setLoader(true);
      await API.del("main", `/admin/delete-order/${institution}/${orderId}`, {}); 
      alert("Order cancelled successfully!");
      getOrders();
    } catch (error) {
      console.error("Error cancelling order:", error);
      alert("Failed to cancel order. Please try again.");
    } finally {
      setLoader(false);
    }
  };
  
  const handleVerifyOrder = async (orderId) => {
    try {
      const confirmAction = window.confirm(
        "Are you sure you want to process this order without payment?"
      );
  
      if (!confirmAction) {
        return; 
      }
      setLoader(true);
      await API.put("main", `/admin/verify-order/${institution}/${orderId}`, {});
      const credentials = await Auth.currentCredentials();
      const Lambda = new AWS.Lambda({
        credentials: credentials,
        region: process.env.REACT_APP_STAGE === 'prod'?'us-east-1':'us-east-2' 
      });

      await Lambda.invoke({
        FunctionName: process.env.REACT_APP_STAGE === 'prod'?'cafe-prod-sendOrderUpdate':'cafe-sendOrderUpdate',
        InvocationType: 'Event',
        Payload: JSON.stringify({
          orderId: orderId,
          institution: institution,
          userType:"chef",
        })
      }).promise();
      await Lambda.invoke({
        FunctionName: process.env.REACT_APP_STAGE === 'prod'?'cafe-prod-sendOrderUpdate':'cafe-sendOrderUpdate',
        InvocationType: 'Event',
        Payload: JSON.stringify({
          orderId: orderId,
          institution: institution,
          userType:"admin",
        })
      }).promise();
      alert("Order verified successfully!");
      getOrders(); 
    } catch (error) {
      console.error("Error verifying order:", error);
      alert("Failed to verify order. Please try again.");
    } finally {
      setLoader(false);
    }
  };
  const head = [
    "Customer",
    "Table",
    "Amount",
    "More",
    ...((userData.userType === "admin"|| userData.userType==="waiter") ? ["Verify"] : [""]),
    ...((userData.userType === "admin" || userData.userType==="waiter")  ? ["Cancel"] : [""]),
  ];

  return (
    <>
      <div className="w-full p-8 bg-gray-100 ">
        <h1 className="max478:text-[22px] text-5xl mb-8">Pending Orders</h1>
       
        {screenWidth > 1025 ? (
          <PaginatedTable
            head={head}
            data={orders.map((obj, index) => [
              obj.name,
              obj.tableName,
               ` ${getCurrencySymbol(obj.currency)}${obj.totalAmount}`,

              <Button
                onClick={() => {
                  setModalOrder(obj);
                  setShowModal(true);
                }}
                className="bg-primaryColor"
              >
                <FaEye />
              </Button>,
                (userData.userType === "admin"|| userData.userType==="waiter") && (
                  <Button
                    onClick={() => handleVerifyOrder(obj.orderId)}
                    className="bg-green-500 hover:bg-green-600"
                    disabled={obj.verify}
                  >
                    <FaCheck className="text-white" />
                  </Button>
                ),
                (userData.userType === "admin" || userData.userType === "waiter") && (
                  <Button
                    onClick={() => handleCancelOrder(obj.orderId)}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    <FaXmark className="text-white" />
                  </Button>
                ),                
              
            ])}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {orders.map((order) => (
            <div
              key={order.orderId}
              className="relative bg-secondaryColor rounded-lg shadow-lg overflow-hidden p-4 flex flex-col justify-between h-full"
            >
             
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-lg font-semibold text-gray-800">{order.name}</h2>
        
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setModalOrder(order);
                      setShowModal(true);
                    }}
                    className="text-primaryColor text-lg"
                  >
                    <FaEye />
                  </button>
                  {(userData.userType === "admin"||  userData.userType==="waiter")  && (
                      <button
                        onClick={() => handleVerifyOrder(order.orderId)}
                        className={`p-1 rounded-full ${
                          order.verify
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-green-500 hover:bg-green-600"
                        }`}
                        disabled={order.verify}
                      >
                        <FaCheck className="text-white text-sm" />
                      </button>
                    )}
                 {(userData.userType === "admin" || userData.userType === "waiter") && (
  <button
    onClick={() => handleCancelOrder(order.orderId)}
    className="p-1 bg-red-500 hover:bg-red-600 rounded-full"
  >
    <FaXmark className="text-white text-sm" />
  </button>
)
}   

                </div>
              </div>
        
             
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <div>
                  <span className="font-semibold text-xs">Table:</span> {order.tableName}
                </div>
                <div>
                  <span className="text-xs font-semibold">Total Amount:</span> {getCurrencySymbol(order.currency)}{order.totalAmount}
                </div>
              </div>
              
            </div>
          ))}
        </div>
        
        
        )}
      </div>
      <OrderModal
        showModal={showModal}
        setShowModal={setShowModal}
        order={modalOrder}
        setOrder={setOrders}
        fetchOrders={getOrders}
      />
    </>
  );
};

export default PendingOrders;
