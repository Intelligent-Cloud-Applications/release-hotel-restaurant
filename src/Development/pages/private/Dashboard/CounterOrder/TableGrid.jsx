import React, { useState, useEffect, useContext } from "react";
import { Context } from "../../../../Context";

const TableGrid = ({ tables, selectedTable, setSelectedTable, pendingOrdersByTable, KOTByTable, unpaidOrders }) => {
  const { institutionData } = useContext(Context);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [activeTab, setActiveTab] = useState("Table");

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getFilteredTables = () => {
        if (institutionData?.integration !== "HOTEL") {
      return tables.filter(
        (table) =>
          String(table.name).toLowerCase().startsWith("table") ||
          String(table.id).toLowerCase().startsWith("takeaway") ||
          String(table.orderType).toLowerCase() === "management"
      );
    }
    if (activeTab === "Table") {
      return tables.filter(
        (table) =>
          String(table.name).toLowerCase().startsWith("table") ||
          String(table.id).toLowerCase().startsWith("takeaway")
      );
    } else if (activeTab === "Room" || activeTab === "Hotel") {
      return tables.filter(
        (table) =>
          String(table.id).toLowerCase().startsWith("hotel") ||
          String(table.id).toLowerCase().startsWith("room") ||
          String(table.orderType).toLowerCase() === "hotel"
      );
    } else if (activeTab === "Swiggy") {
      return tables.filter(
        (table) =>
          String(table.id).toLowerCase().startsWith("swiggy") ||
          String(table.name).toLowerCase().startsWith("swiggy") ||
          String(table.orderType).toLowerCase() === "swiggy"
      );
    } else if (activeTab === "Zomato") {
      return tables.filter(
        (table) =>
          String(table.id).toLowerCase().startsWith("zomato") ||
          String(table.name).toLowerCase().startsWith("zomato") ||
          String(table.orderType).toLowerCase() === "zomato"
      );
    } else if (activeTab === "Management") {
      return tables.filter(
        (table) => String(table.orderType).toLowerCase() === "management"
      );
    }
    return tables;
  };

  const filteredTables = getFilteredTables();

  const renderTableButton = (table) => {
    const pendingOrders = pendingOrdersByTable[table.id] || [];
    const pendingCount = pendingOrders.length;
    const kotItemsForTable = KOTByTable && KOTByTable[table.id] || [];
    const unprintedKOTItems = kotItemsForTable.items
      ? kotItemsForTable.items.filter((item) => item && !item.isPrinted)
      : [];
    const unprintedCount = unprintedKOTItems.length || 0;
    const hasUnpaidOrders = unpaidOrders.some(order => String(order.tableName) === String(table.id));

    const getTableName = (table) => {
      if (String(table.id).toLowerCase().startsWith("takeaway")) return table.name;
      if (String(table.id).toLowerCase().startsWith("hotel")) {
        const hotelId = String(table.id).replace(/^hotel/i, "");
        return `Room ${hotelId}`;
      }
      if (String(table.id).toLowerCase().startsWith("room")) return table.name;
      if (String(table.id).toLowerCase().startsWith("swiggy")) return table.name;
      if (String(table.id).toLowerCase().startsWith("zomato")) return table.name;
      if (String(table.orderType).toLowerCase() === "management") {
        return table.name;
      }
      return `Table ${table.id}`;
    };

    return (
      <button
        key={table.id}
        onClick={() => setSelectedTable(table)}
        className={`p-2 rounded-lg border transition-all relative h-20 ${
          hasUnpaidOrders
            ? "bg-red-600 text-white border-red-700"
            : pendingCount > 0
            ? "bg-yellow-600 text-white border-yellow-700"
            : selectedTable?.id === table.id
            ? "bg-blue-600 text-white border-blue-700"
            : table.orders.length > 0
            ? "bg-green-600 text-white border-green-700"
            : "bg-gray-100 text-gray-800 border-gray-200"
        }`}
      >
        <h3 className="font-bold text-sm">{getTableName(table)}</h3>
        {Number(table.currentBill) > 0 && (
          <div className="text-xs mt-1">
            <p className="opacity-90">Items: {table.orders.length}</p>
            <p className="font-bold">₹{table.currentBill.toFixed(2)}</p>
          </div>
        )}
        {unprintedCount > 0 && pendingCount <= 0 && Number(table.currentBill) <= 0 && (
          <div className="mt-1 text-center">
            <p className="text-[10px] opacity-90">Selected Items: {unprintedCount}</p>
          </div>
        )}
        {(pendingCount > 0 || hasUnpaidOrders) && (
          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {pendingCount + (hasUnpaidOrders ? 1 : 0)}
          </div>
        )}
      </button>
    );
  };

  const renderMobileTableButton = (table) => {
    const pendingOrders = pendingOrdersByTable[table.id] || [];
    const pendingCount = pendingOrders.length;
    const kotItemsForTable = KOTByTable && KOTByTable[table.id] || [];
    const unprintedKOTItems = kotItemsForTable.items
      ? kotItemsForTable.items.filter((item) => item && !item.isPrinted)
      : [];
    const unprintedCount = unprintedKOTItems.length || 0;
    const hasUnpaidOrders = unpaidOrders.some(order => String(order.tableName) === String(table.id));

    const getTableName = (table) => {
      if (String(table.id).toLowerCase().startsWith("takeaway")) return table.name;
      if (String(table.id).toLowerCase().startsWith("hotel")) {
        const hotelId = String(table.id).replace(/^hotel/i, "");
        return `Room ${hotelId}`;
      }
      if (String(table.id).toLowerCase().startsWith("room")) return table.name;
      if (String(table.id).toLowerCase().startsWith("swiggy")) return table.name;
      if (String(table.id).toLowerCase().startsWith("zomato")) return table.name;
      if (String(table.orderType).toLowerCase() === "management") {
        return table.name;
      }
      return `Table ${table.id}`;
    };

    return (
      <button
        key={table.id}
        onClick={() => setSelectedTable(table)}
        className={`p-3 rounded-lg border transition-all flex flex-col justify-between relative ${
          hasUnpaidOrders
            ? "bg-red-600 text-white border-red-700"
            : pendingCount > 0
            ? "bg-yellow-600 text-white border-yellow-700"
            : selectedTable?.id === table.id
            ? "bg-blue-600 text-white border-blue-700"
            : table.orders.length > 0
            ? "bg-green-600 text-white border-green-700"
            : "bg-gray-100 text-gray-800 border-gray-200"
        } min-h-[70px] min-w-[70px] max-h-[90px] max-w-[90px]`}
      >
        <h3 className="font-bold text-xs">{getTableName(table)}</h3>
        {table.currentBill > 0 && (
          <div className="mt-1 text-center">
            <p className="text-[10px] opacity-90">Items: {table.orders.length}</p>
            <p className="font-bold text-xs">₹{table.currentBill.toFixed(2)}</p>
          </div>
        )}
        {unprintedCount > 0 && pendingCount <= 0 && Number(table.currentBill) <= 0 && (
          <div className="mt-1 text-center">
            <p className="text-[10px] opacity-90">Selected Items: {unprintedCount}</p>
          </div>
        )}
        {(pendingCount > 0 || hasUnpaidOrders) && (
          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
            {pendingCount + (hasUnpaidOrders ? 1 : 0)}
          </div>
        )}
      </button>
    );
  };

  const renderVerticalTabs = () => {
    const tabs = [
      { id: "Table", label: "Table" },
      { id: "Room", label: "Room" },
      { id: "Swiggy", label: "Swiggy" },
      { id: "Zomato", label: "Zomato" },
      { id: "Management", label: "Mng." },
    ];

    return (
      <div className="flex flex-col w-20 bg-gray-50 border-r select-none shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-2 text-xs font-semibold border-b transition-all text-center ${
              activeTab === tab.id
                ? "bg-blue-600 text-white border-blue-700 shadow-sm"
                : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex bg-white border-b">
      {renderVerticalTabs()}
      <div className="flex-1 p-3 overflow-auto max-h-48">
        <div
          className={`grid gap-2 ${
            screenWidth > 1025 ? "grid-cols-5" : "grid-cols-4 lg:grid-cols-6 max406:grid-cols-2"
          }`}
        >
          {filteredTables.map(screenWidth > 1025 ? renderTableButton : renderMobileTableButton)}
        </div>
      </div>
    </div>
  );
};

export default TableGrid;
