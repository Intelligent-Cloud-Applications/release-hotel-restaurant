import { Sidebar } from "flowbite-react";
import { MdFastfood, MdOutlineProductionQuantityLimits, MdQrCodeScanner, MdOutlinePendingActions } from "react-icons/md";
import { IoMdPersonAdd } from "react-icons/io";
import { CgProfile } from "react-icons/cg";
import { TbToolsKitchen3 } from "react-icons/tb";
import { MdInventory2 } from "react-icons/md";
import { TbReportSearch } from "react-icons/tb";
import { RiMoneyRupeeCircleFill, RiBillLine } from "react-icons/ri";
import { FiMaximize, FiMinimize } from "react-icons/fi";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import { API } from "aws-amplify";
import { Context } from "../../../Context";
import { useWebSocket } from '../../../Context/WebSocketContext'; 

const routes = [
  { path: 'counterorder', label: '', icon: TbToolsKitchen3, allowedUserTypes: ['admin'] },
  { path: 'orders', label: '', icon: MdFastfood, allowedUserTypes: ['member', 'chef', 'waiter'] },
  // { path: 'pendingorders', label: '', icon: MdOutlinePendingActions, allowedUserTypes: ['admin', 'waiter'] },
  { path: 'addstaff', label: '', icon: IoMdPersonAdd, allowedUserTypes: ['admin'] },
  { path: 'item', label: '', icon: MdOutlineProductionQuantityLimits, allowedUserTypes: ['admin', 'chef'] },
  { path: 'stockmanagement', label: '', icon: MdInventory2, allowedUserTypes: ['admin'] },
  { path: 'qrmanage', label: '', icon: MdQrCodeScanner, allowedUserTypes: ['admin'] },
  { path: 'revenue', label: '', icon: RiMoneyRupeeCircleFill, allowedUserTypes: ['admin'] },
  { path: 'orderhistory', label: '', icon: RiBillLine, allowedUserTypes: ['admin'] },
  { path: 'report', label: '', icon: TbReportSearch, allowedUserTypes: ['admin'] },
  { path: 'profile', label: '', icon: CgProfile, allowedUserTypes: ['member', 'admin', 'chef', 'waiter'] },
];


const SideBar = () => {
  const { userData, items, institutionData } = useContext(Context);
  const { subscribe } = useWebSocket();
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const userType = userData?.userType;
  const { institution } = institutionData;
  const location = useLocation();

  // Fullscreen Toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  // const fetchPendingOrdersCount = async () => {
  //   try {
  //     const orders = await API.get("main", `/admin/list-orders/${institution}`, {});
  //     const pendingCount = orders.filter(order => 
  //       order.status === "pending" && 
  //       !(order.verify && order.paymentStatus)
  //     ).length;
  //     setPendingOrdersCount(pendingCount);
  //   } catch (error) {
  //     console.error("Error fetching pending orders:", error);
  //   }
  // };

  // const fetchOrdersCount = async () => {
  //   try {
  //     const orders = await API.get("main", `/admin/list-orders/${institution}`, {});
  //     const pendingCount = orders.filter(order => 
  //       order.status === "pending" && 
  //       (order.verify || order.paymentStatus)
  //     ).length;
  //     setTotalOrdersCount(pendingCount);
  //   } catch (error) {
  //     console.error("Error fetching orders count:", error);
  //   }
  // };

  const fetchOutOfStockCount = () => {
    if (items) {
      const outOfStockItems = items.filter(item => item.outOfStock === true);
      setOutOfStockCount(outOfStockItems.length);
    }
  };

  useEffect(() => {
    // fetchPendingOrdersCount();
    // fetchOrdersCount();
    fetchOutOfStockCount();
    const unsubscribe = subscribe(() => {
      // fetchPendingOrdersCount();
      // fetchOrdersCount();
    });

    return () => unsubscribe();
  }, [subscribe, institution]);

  return (
    <div className="flex flex-col lg:flex-row lg:min-h-screen">
      <Sidebar className="lg:block hidden border-r-2 w-auto">
        <Sidebar.Items>
          <Sidebar.ItemGroup>
            {routes.map((item, index) => (
              item.allowedUserTypes.includes(userType) && (
                <Link
                  key={index}
                  to={`/dashboard/${item.path}`}
                  className={`relative flex items-center p-2 rounded-lg hover:bg-gray-200 transition-colors ${
                   location.pathname === `/dashboard/${item.path}` ? 'bg-gray-300' : ''
                  }`}
                >
                  <item.icon className="text-xl" />
                  <span className="ml-2">{item.label}</span>
                  {item.path === "pendingorders" && pendingOrdersCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {pendingOrdersCount}
                    </span>
                  )}
                  {item.path === "orders" && totalOrdersCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {totalOrdersCount}
                    </span>
                  )}
                  {item.path === "item" && outOfStockCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {outOfStockCount}
                    </span>
                  )}
                </Link>
              )
            ))}
            
            <button onClick={toggleFullScreen} className="text-gray-600 hover:text-black text-xl ml-2">
              {isFullScreen ? <FiMinimize /> : <FiMaximize />}
            </button>
             <Link
    to="/logout"
    className="flex items-center p-2 mt-4 text-red-600 hover:bg-red-100 transition-colors rounded-lg"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
    </svg>
  </Link>
          </Sidebar.ItemGroup>
        </Sidebar.Items>
      </Sidebar>

      <div className="lg:hidden fixed bottom-0 left-0 w-full bg-white z-10 shadow-md">
        <div className="flex justify-around py-2">
          {routes.map((item, index) => (
            item.allowedUserTypes.includes(userType) && (
              <Link
                key={index}
                to={`/dashboard/${item.path}`}
                className={`relative flex flex-col items-center ${
                 location.pathname === `/dashboard/${item.path}` ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                <item.icon className="text-xl" />
                <span className="text-xs">{item.label}</span>
              </Link>
            )
          ))}
          <Link
    to="/logout"
    className="flex flex-col items-center text-red-600"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
    </svg>
  </Link>
        </div>
      </div>
    </div>
  );
}

export default SideBar;