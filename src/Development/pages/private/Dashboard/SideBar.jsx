import { Sidebar, Tooltip } from "flowbite-react";
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
  { path: 'counterorder', label: 'Counter Order (POS)', icon: TbToolsKitchen3, allowedUserTypes: ['admin'] },
  { path: 'orders', label: 'Orders', icon: MdFastfood, allowedUserTypes: ['member', 'waiter'] },
  // { path: 'pendingorders', label: 'Pending Orders', icon: MdOutlinePendingActions, allowedUserTypes: ['admin', 'waiter'] },
  { path: 'addstaff', label: 'Add Staff', icon: IoMdPersonAdd, allowedUserTypes: ['admin'] },
  { path: 'item', label: 'Menu Items', icon: MdOutlineProductionQuantityLimits, allowedUserTypes: ['admin', 'chef'] },
  { path: 'stockmanagement', label: 'Stock Management', icon: MdInventory2, allowedUserTypes: ['admin'], showIfBarOrStock: true },
  { path: 'qrmanage', label: 'QR Manage', icon: MdQrCodeScanner, allowedUserTypes: ['admin'] },
  { path: 'room-details', label: 'Room Details', icon: FaHotel, allowedUserTypes: ['admin', 'waiter'] ,requiresCafeIntegration: true},
  { path: 'day-end', label: 'Day End', icon: IoMdTimer, allowedUserTypes: ['admin', 'waiter'], requiresBarIntegration: true },
  { path: 'revenue', label: 'Revenue', icon: RiMoneyRupeeCircleFill, allowedUserTypes: ['admin'] },
  { path: 'orderhistory', label: 'Order History', icon: RiBillLine, allowedUserTypes: ['admin'] },
  { path: 'cashbook', label: 'Cashbook', icon: FaCashRegister, allowedUserTypes: ['admin'], requiresCafeIntegration: true },
  { path: 'report', label: 'Reports', icon: TbReportSearch, allowedUserTypes: ['admin'] },
  { path: 'profile', label: 'Profile', icon: CgProfile, allowedUserTypes: ['admin', 'member', 'chef', 'waiter'] },
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
    if (!hasUserType) return false;

    // Cashier cannot access Add Staff
    if (route.path === 'addstaff' && role === 'cashier') {
      return false;
    }

    // Check for owner role if required
    if (route.requiresOwnerRole) {
      return role === 'owner' || role === 'admin' || role === 'manager';
    }
    // Check for bar integration for day-end route
    if (route.requiresBarIntegration) {
      return bar_integration === "Yes";
    }
    if (route.requiresCafeIntegration) {
      return bar_integration !== "Yes";
    }
    if (route.showIfBarOrStock) {
      return bar_integration === "Yes" || stock === true;
    }
    return true;
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
                <Tooltip key={index} content={item.label} placement="right" style="dark">
                  <Link
                    to={`/dashboard/${item.path}`}
                    title={item.label}
                    className={`relative flex items-center p-2 rounded-lg hover:bg-gray-200 transition-colors ${
                      location.pathname === `/dashboard/${item.path}` ? 'bg-gray-300' : ''
                    }`}
                  >
                    <item.icon className="text-xl" />
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
                </Tooltip>
              )
            ))}
            <Tooltip content={isFullScreen ? "Exit Full Screen" : "Full Screen"} placement="right" style="dark">
              <button
                onClick={toggleFullScreen}
                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                className="text-gray-600 hover:text-black text-xl p-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
              >
                {isFullScreen ? <FiMinimize /> : <FiMaximize />}
              </button>
            </Tooltip>
            <Tooltip content="Logout" placement="right" style="dark">
              <Link
                to="/logout"
                title="Logout"
                className="flex items-center p-2 mt-4 text-red-600 hover:bg-red-100 transition-colors rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
                </svg>
              </Link>
            </Tooltip>
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
                title={item.label}
                className={`relative flex flex-col items-center ${
                  location.pathname === `/dashboard/${item.path}` ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                <item.icon className="text-xl" />
                <span className="text-[10px] hidden sm:block truncate max-w-[65px]">{item.label}</span>
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