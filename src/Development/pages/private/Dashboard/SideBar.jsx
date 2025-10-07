import { Sidebar } from "flowbite-react";
import { MdFastfood, MdOutlineProductionQuantityLimits, MdQrCodeScanner, MdOutlinePendingActions } from "react-icons/md";
import { IoMdPersonAdd } from "react-icons/io";
import { CgProfile } from "react-icons/cg";
import { TbToolsKitchen3 } from "react-icons/tb";
import { MdInventory2 } from "react-icons/md";
import { TbReportSearch } from "react-icons/tb";
import { RiMoneyRupeeCircleFill, RiBillLine } from "react-icons/ri";
import { FiMaximize, FiMinimize } from "react-icons/fi";
import { IoMdTimer } from "react-icons/io";
import { FaHotel } from "react-icons/fa";
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import { API } from "aws-amplify";
import { Context } from "../../../Context";
import { useWebSocket } from '../../../Context/WebSocketContext'; 
import { FaCashRegister } from "react-icons/fa";


const routes = [
  { path: 'counterorder', label: '', icon: TbToolsKitchen3, allowedUserTypes: ['admin'] },
  { path: 'orders', label: '', icon: MdFastfood, allowedUserTypes: ['member', 'chef', 'waiter'] },
  // { path: 'pendingorders', label: '', icon: MdOutlinePendingActions, allowedUserTypes: ['admin', 'waiter'] },
  { path: 'addstaff', label: '', icon: IoMdPersonAdd, allowedUserTypes: ['admin'], requiresOwnerRole: true },
  { path: 'item', label: '', icon: MdOutlineProductionQuantityLimits, allowedUserTypes: ['admin', 'chef'] },
  { path: 'stockmanagement', label: '', icon: MdInventory2, allowedUserTypes: ['admin'], showIfBarOrStock: true },
  { path: 'qrmanage', label: '', icon: MdQrCodeScanner, allowedUserTypes: ['admin'], requiresOwnerRole: true },
  { path: 'room-details', label: '', icon: FaHotel, allowedUserTypes: ['admin', 'waiter'] ,requiresCafeIntegration: true},
  { path: 'day-end', label: '', icon: IoMdTimer, allowedUserTypes: ['admin', 'waiter'], requiresBarIntegration: true },
  { path: 'revenue', label: '', icon: RiMoneyRupeeCircleFill, allowedUserTypes: ['admin'] },
  { path: 'orderhistory', label: '', icon: RiBillLine, allowedUserTypes: ['admin'] },
  { path: 'cashbook', label: '', icon: FaCashRegister, allowedUserTypes: ['admin'], requiresCafeIntegration: true },
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
  const role = userData?.role;
  const { institution, bar_integration, stock } = institutionData;
  const location = useLocation();

  // Helper function to check if route should be displayed
  const shouldDisplayRoute = (route) => {
    const hasUserType = route.allowedUserTypes.includes(userType);
    // Check for owner role if required
    if (route.requiresOwnerRole) {
      return hasUserType && role === 'owner';
    }
    // Check for bar integration for day-end route
    if (route.requiresBarIntegration) {
      return hasUserType && bar_integration === "Yes";
    }
     if (route.requiresCafeIntegration) {
      return hasUserType && bar_integration !== "Yes";
    }
    if (route.showIfBarOrStock) {
      return hasUserType && (bar_integration === "Yes" || stock === true);
    }
    return hasUserType;
  };

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

  const fetchOutOfStockCount = () => {
    if (items) {
      const outOfStockItems = items.filter(item => item.outOfStock === true);
      setOutOfStockCount(outOfStockItems.length);
    }
  };

  useEffect(() => {
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
              shouldDisplayRoute(item) && (
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
            shouldDisplayRoute(item) && (
              <Link
                key={index}
                to={`/dashboard/${item.path}`}
                className={`relative flex flex-col items-center ${
                  location.pathname === `/dashboard/${item.path}` ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                <item.icon className="text-xl" />
                <span className="text-xs">{item.label}</span>
                {item.path === "pendingorders" && pendingOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1 py-0.5 rounded-full">
                    {pendingOrdersCount}
                  </span>
                )}
                {item.path === "orders" && totalOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs font-bold px-1 py-0.5 rounded-full">
                    {totalOrdersCount}
                  </span>
                )}
                {item.path === "item" && outOfStockCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1 py-0.5 rounded-full">
                    {outOfStockCount}
                  </span>
                )}
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
            <span className="text-xs">Logout</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SideBar;