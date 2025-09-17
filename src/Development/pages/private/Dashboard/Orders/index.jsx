import { useContext, useEffect, useState } from "react";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import { PaginatedTable } from "../../../../common/DataDisplay";
import OrderModal from "./OrderModal";
import { FaEye } from "react-icons/fa6";
import { Button } from "flowbite-react";
import { getCurrencySymbol } from "../../../../common/Inputs";
import { useWebSocket } from '../../../../Context/WebSocketContext';
import KOT from "./kot";
import { RiBillLine } from "react-icons/ri";
const Orders = () => {
  const { institution } = useContext(Context).institutionData;
    const { institutionData } = useContext(Context);
  const [orders, setOrders] = useState([]);
  const { userData } = useContext(Context);
  const [statusFilter, setStatusFilter] = useState("all");
  const { setLoader } = useContext(Context);
  const [modalOrder, setModalOrder] = useState({});
  const [modalIndex, setModalIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [ws, setWs] = useState(null);
  const [connectionTime, setConnectionTime] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [timers, setTimers] = useState({});
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [staffList, setStaffList] = useState([]);
  const [chefNames, setChefNames] = useState({});
  const { subscribe } = useWebSocket();
  const [showKOT, setShowKOT] = useState(false);
  const [kotOrderId, setKotOrderId] = useState(null);
  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prevTimers) => {
        const updatedTimers = { ...prevTimers };

        for (const [orderId, remainingTime] of Object.entries(updatedTimers)) {
          if (remainingTime > 0) {
            updatedTimers[orderId] = remainingTime - 1000;
          } else {
            updatedTimers[orderId] = 0;
          }
        }

        return updatedTimers;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const newTimers = {};
    orders.forEach((order) => {
      if (order.status === "preparing" && order.deliveryTime) {
        const timeRemaining = Math.max(order.deliveryTime - Date.now(), 0);
        newTimers[order.orderId] = timeRemaining;
      }
    });
    setTimers(newTimers);
  }, [orders]);

  const formatTime = (milliseconds) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };
  
  useEffect(() => {
    getOrders();
    
    const unsubscribe = subscribe((message) => {
      console.log("Received WebSocket message:", message);
      alert("New order received!");
      getOrders();
    });

    return () => unsubscribe();
  }, [institution, userData, statusFilter, subscribe]);

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
      const userType = userData.userType;
      const chefCognitoId = userData.cognitoId;
      let filteredOrders 
      = result.filter(
        (order) =>
          order.paymentStatus !== true || order.status !== "delivered" || order.paymentStatus == true
      );
      
      if (statusFilter !== "all") {
        filteredOrders = filteredOrders.filter(
          (order) => order.status === statusFilter
        );
      }
      if (userData && userData.userType === "chef") {
        filteredOrders =  filteredOrders.filter((order) => {
          if (order.status === "preparing" || order.status === "ready") {
            const isChefOrder = order.chefId === chefCognitoId;
            return isChefOrder;
          }
          return order.verify === true || order.paymentStatus === true;
        });
      }
      else if (userType === "waiter" || userType === "admin"||
        userType === "member" ||
        userType === "chef") {
        filteredOrders = filteredOrders.filter(
          (order) => order.verify === true || order.paymentStatus === true
        );
      }else {
        filteredOrders = statusFilter !== "all"
          ? result.filter((order) => order.status === statusFilter)
          : result;
      }

      const sortedOrders = filteredOrders.sort(
        (a, b) => b.createdAt - a.createdAt
      );

      setOrders(sortedOrders);
      if (userData.userType === "admin") {
        const staffResult = await API.get(
          "main",
          `/admin/staff-list/${institution}`,
          {}
        );
        setStaffList(staffResult);

        const chefNameMapping = {};
        staffResult.forEach((staff) => {
        
            chefNameMapping[staff.cognitoId] = staff.userName;
          
        });
        setChefNames(chefNameMapping);
      }
      setLoader(false);
    } catch (e) {
      console.error("Error fetching orders:", e);
      setLoader(false);
    }
  };

  const head = [
    "Customer",
    "Table",
    "Amount",
    "Status",
    ...(userData.userType === "admin" ? ["Chef"] : [""]),
    "Timer",
    "More",
    ...(userData.userType === "admin" ? ["KOT"] : [""]),
  ];

  return (
    <>
      <div className="w-full p-8 bg-gray-100">
        <h1 className="max478:text-[22px] text-5xl mb-8">Orders</h1>
        <div className="mb-4">
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded bg-primaryColor text-white"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        {screenWidth > 1025 ? (
          <PaginatedTable
            head={head}
            data={orders.map((obj, index) => [
              obj.name,
              obj.tableName,
              ` ${getCurrencySymbol(obj.currency)}${obj.totalAmount}`,
              <div className="w-16 flex justify-center items-center">
                <div
                  className={`${
                    obj.status === "ready"
                      ? "bg-green-600"
                      : obj.status === "pending"
                      ? "bg-red-600"
                      : obj.status === "preparing"
                      ? "bg-blue-600"
                      : obj.status === "delivered"
                      ? "bg-purple-600"
                      : "bg-gray-600"
                  } flex items-center justify-center p-1 mt-1 h-8 text-white font-bold px-2 rounded-md`}
                >
                  {obj.status}
                </div>
              </div>,
              userData.userType === "admin" && obj.chefId
                ? chefNames[obj.chefId]
                  ? chefNames[obj.chefId].includes(" ")
                    ? chefNames[obj.chefId].split(" ")[0]
                    : chefNames[obj.chefId]
                  : "Chef Not Found"
                : "",
              !obj.deliveryTime
                ? "--"
                : obj.status === "preparing"
                ? timers[obj.orderId] > 0
                  ? formatTime(timers[obj.orderId])
                  : "Time Over"
                : obj.status === "pending"
                ? "--"
                : "Ready",
              <Button
                onClick={() => {
                  setModalOrder(obj);
                  setShowModal(true);
                }}
                className="bg-primaryColor"
              >
                <FaEye />
              </Button>,
              userData.userType === "admin" && (
                <Button
                  onClick={() => {
                    setKotOrderId(obj.orderId);
                    setShowKOT(true);
                  }}
                  className="bg-green-500"
                >
                  <RiBillLine />
                </Button>)
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
                  {userData.userType === "admin" && (
                      <button
                        onClick={() => {
                          setKotOrderId(order.orderId);
                          setShowKOT(true);
                        }}
                        className="text-primaryColor text-lg"
                      >
                        <RiBillLine />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setModalOrder(order);
                        setShowModal(true);
                      }}
                      className="text-primaryColor text-lg"
                    >
                      <FaEye />
                    </button>
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
                {userData.userType === "admin" && order.chefId && (
                  <div className="text-xs text-gray-600 mb-2">
                    <span className="font-semibold">Chef:</span>{" "}
                    {chefNames[order.chefId] ? chefNames[order.chefId] : "Chef Not Found"}
                  </div>
                )}
                <div className="flex justify-between items-center mb-2">
                  <div
                    className={`${
                      order.status === "ready"
                        ? "bg-green-500"
                        : order.status === "pending"
                        ? "bg-red-500"
                        : order.status === "preparing"
                        ? "bg-blue-500"
                        : order.status === "delivered"
                        ? "bg-purple-500"
                        : "bg-gray-500"
                    } text-white text-xs font-semibold px-3 py-1 rounded-full`}
                  >
                    {order.status}
                  </div>
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold">Time Left:</span>{" "}
                    <span className="font-bold">
                      {!order.deliveryTime
                        ? "--"
                        : order.status === "preparing"
                        ? timers[order.orderId] > 0
                          ? formatTime(timers[order.orderId])
                          : "Time Over"
                        : order.status === "pending"
                        ? "--"
                        : "Ready"}
                    </span>
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
        timers={timers}
        formatTime={formatTime}
      />
      {showKOT && (
        <KOT
          show={showKOT}
          onClose={() => setShowKOT(false)} 
          selectedOrderId={kotOrderId}
          institutionData={{ institution }}
          fetchOrders={getOrders}
        />
      )}
    </>
  );
};

export default Orders;