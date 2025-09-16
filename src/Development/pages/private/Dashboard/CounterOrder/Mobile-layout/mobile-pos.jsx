import React, { useState, useEffect, useRef } from "react";
import OrderPanel from "../OrderPanel";
import { Search, ChevronRight, ChevronLeft, Filter } from "lucide-react";

const ResponsivePOSLayout = ({
  categories,
  selectedCategory,
  setSelectedCategory,
  tables,
  selectedTable,
  setSelectedTable,
  itemsData,
  setTables,
  searchTerm,
  setSearchTerm,
  addItemToKOT,
  KOTByTable,
  removeItemFromKOT,
  updateItemQuantity,
  printKOT,
  printBill,
  customerDetails,
  setCustomerDetails,
  setShowModal,
  printAllItems,
  setPrintAllItems,
  institutionData,
  pendingOrdersByTable,
  fetchPendingOrders,
  pendingOrders,
  tableOccupancy,
  setCurrentKOT,
  setKOTByTable,
  fetchTableData,
  tableData,
  saveKOT,
  billItemsByStore,
  localBillItems,
  setLocalBillItems,
  setTableOccupancy,
  settleBill,
  bluetoothConnected,
  bluetoothDeviceName,
  connectBluetooth,
  printBluetooth,showReprintKOT, setShowReprintKOT
}) => {
  const [orderPanelOpen, setOrderPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("KOT");
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const filterRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilterPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [showFilterPopup, setShowFilterPopup] = useState(false);

  const handleItemClick = (item) => {
    if (selectedTable) {
      const formattedItem = {
        ...item,
        name: item.itemName,
      };
      delete formattedItem.itemName;
      addItemToKOT(selectedTable.id, formattedItem);
    }
  };

  return (
    <div className="h-screen w-full bg-gray-50 flex relative overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Add Bluetooth connection status and button */}
        <div className="bg-white p-2 flex items-center justify-between border-b">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                bluetoothConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            ></div>
            <span className="text-sm">
              {bluetoothConnected
                ? `Connected to ${bluetoothDeviceName}`
                : 'Printer Disconnected'}
            </span>
          </div>
          <button
            onClick={connectBluetooth}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {bluetoothConnected ? 'Reconnect' : 'Connect Printer'}
          </button>
        </div>

        <TableGrid
          institutionData={institutionData}
          tables={tables}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          pendingOrdersByTable={pendingOrdersByTable}
          KOTByTable={KOTByTable}
        />
        {/* menu items */}
        <div className="flex-1 p-1 sm:p-4 overflow-hidden flex flex-col">
          <div className="mb-2 sm:mb-4 flex items-center">
            <div className="relative mr-2" ref={filterRef}>
              <button
                onClick={() => setShowFilterPopup(!showFilterPopup)}
                className="p-1.5 sm:p-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition-all"
              >
                <Filter className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              {showFilterPopup && (
                <div className="absolute left-0 mt-2 w-40 bg-white border rounded-lg shadow-lg z-10 max-h-[20rem] overflow-auto">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowFilterPopup(false);
                      }}
                      className={`block w-full text-left px-3 py-1.5 text-sm rounded-lg transition-all ${selectedCategory === category
                          ? "bg-blue-500 text-white"
                          : "hover:bg-gray-100"
                        }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search items..."
                className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto h-[24rem]">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {itemsData
                .filter(
                  (item) =>
                    item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) &&
                    (selectedCategory === "All" || item.category === selectedCategory)
                )
                .map((item) => (
                  <button
                    key={item.itemId}
                    onClick={() => handleItemClick(item)}
                    disabled={!selectedTable}
                    className={`bg-white p-2 rounded-lg border transition-all text-left shadow-sm hover:shadow-md ${selectedTable ? "hover:border-blue-300" : "opacity-50 cursor-not-allowed"
                      }`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-xs break-words">{item.itemName}</h3>
                      <div className="flex-shrink-0 w-3 h-3 rounded-full flex items-center justify-center border border-gray-300">
                        {item.veg ? (
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        ) : (
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-500 text-[10px] mt-0.5">{item.category}</p>
                    <p className="font-bold text-xs mt-1">₹{item.price}</p>
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`absolute top-0 right-0 h-full bg-white border-l shadow-lg transition-transform duration-300 px-4 ${orderPanelOpen ? "w-96 max406:w-full overflow-auto" : "translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between p-4 border-b bg-white">
          <h1 className="text-lg font-bold">Order Details</h1>
        </div>
        <OrderPanel
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          tables={tables}
          setTables={setTables}
          setCurrentKOT={setCurrentKOT}
          fetchPendingOrders={fetchPendingOrders}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingOrders={pendingOrders}
          KOTByTable={KOTByTable}
          customerDetails={customerDetails}
          setCustomerDetails={setCustomerDetails}
          updateItemQuantity={updateItemQuantity}
          removeItemFromKOT={removeItemFromKOT}
          printKOT={printKOT}
          printBill={printBill}
          setShowModal={setShowModal}
          printAllItems={printAllItems}
          setPrintAllItems={setPrintAllItems}
          setKOTByTable={setKOTByTable}
          tableOccupancy={tableOccupancy}
          fetchTableData={fetchTableData}
          tableData={tableData}
          saveKOT={saveKOT}
          billItemsByStore={billItemsByStore}
          localBillItems={localBillItems}
          setLocalBillItems={setLocalBillItems}
          setTableOccupancy={setTableOccupancy}
          settleBill={settleBill}
          bluetoothConnected={bluetoothConnected}
          bluetoothDeviceName={bluetoothDeviceName}
          connectBluetooth={connectBluetooth}
          printBluetooth={printBluetooth}
          setShowReprintKOT={setShowReprintKOT}
          showReprintKOT={showReprintKOT}
        />
      </div>

      <button
        onClick={() => setOrderPanelOpen(!orderPanelOpen)}
        className="absolute top-4 right-2 p-2 bg-white border rounded-lg shadow-md hover:bg-gray-100 transition-all z-50"
      >
        {orderPanelOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>
    </div>
  );
};
const TableGrid = ({ tables, selectedTable, setSelectedTable, pendingOrdersByTable, KOTByTable, institutionData }) => {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [activeTab, setActiveTab] = useState("Table");

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getFilteredTables = () => {
    if (institutionData?.integration !== "HOTEL") {
      return tables;
    }

    if (activeTab === "Table") {
      return tables.filter(
        (table) =>
          String(table.name).toLowerCase().startsWith("table") ||
          String(table.id).toLowerCase().startsWith("takeaway")
      );
    } else if (activeTab === "Hotel") {
      return tables.filter((table) => String(table.id).toLowerCase().startsWith("hotel"));
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

    const getTableName = (table) => {
      if (String(table.id).toLowerCase().startsWith("takeaway")) return table.name;
      if (String(table.id).toLowerCase().startsWith("hotel")) {
        const hotelId = String(table.id).replace(/^hotel/i, "");
        return `Hotel ${hotelId}`;
      }
      return `Table ${table.id}`;
    };

    return (
      <button
        key={table.id}
        onClick={() => setSelectedTable(table)}
        className={`
          p-1.5 sm:p-2 rounded-lg border transition-all flex flex-col justify-between relative
          ${
            selectedTable?.id === table.id
              ? "bg-blue-600 text-white border-blue-700"
              : pendingCount > 0
              ? "bg-yellow-600 text-white border-yellow-700"
              : table.orders.length > 0
              ? "bg-green-600 text-white border-green-700"
              : "bg-gray-100 text-gray-800 border-gray-200"
          } min-h-[60px] sm:min-h-[70px] min-w-[60px] sm:min-w-[80px] max-h-[70px] sm:max-h-[90px] max-w-[70px] sm:max-w-[90px]
        `}
      >
        <h3 className="font-bold text-[9px] sm:text-[10px]">{getTableName(table)}</h3>
        {Number(table.currentBill) > 0 && (
          <div className="mt-0.5 sm:mt-1 text-center">
            <p className="text-[7px] sm:text-[8px] opacity-90">Items: {table.orders.length}</p>
            <p className="font-bold text-[8px] sm:text-[10px]">
              ₹{table.currentBill.toFixed(2)}
            </p>
          </div>
        )}
        {unprintedCount > 0 && pendingCount <= 0 && Number(table.currentBill) <= 0 && (
          <div className="mt-0.5 sm:mt-1 text-center">
            <p className="text-[7px] sm:text-[8px] opacity-90">Selected Items: {unprintedCount}</p>
          </div>
        )}
        {pendingCount > 0 && (
          <div
            className="
              absolute -top-1 sm:-top-1.5 -right-1 sm:-right-1.5 w-3.5 sm:w-4 h-3.5 sm:h-4
              rounded-full bg-red-500 text-white text-[7px] sm:text-[8px] flex items-center justify-center
            "
          >
            {pendingCount}
          </div>
        )}
      </button>
    );
  };

  const renderVerticalTabs = () => {
    if (institutionData?.integration !== "HOTEL") return null;

    return (
      <div className="flex flex-col w-12 sm:w-14 bg-gray-50 border-r">
        <button
          onClick={() => setActiveTab("Table")}
          className={`
            p-1.5 sm:p-2 text-[10px] sm:text-xs font-medium border-b transition-all
            ${activeTab === "Table" ? "bg-blue-600 text-white border-blue-700" : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"}
          `}
        >
          Table
        </button>
        <button
          onClick={() => setActiveTab("Hotel")}
          className={`
            p-1.5 sm:p-2 text-[10px] sm:text-xs font-medium border-b transition-all
            ${activeTab === "Hotel" ? "bg-blue-600 text-white border-blue-700" : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"}
          `}
        >
          Hotel
        </button>
      </div>
    );
  };

  return (
    <div className="flex bg-white border-b">
      {renderVerticalTabs()}
      <div className="flex-1 p-2 sm:p-3 max-h-[200px] sm:max-h-[230px] overflow-y-auto">
        <div
          className={`
            grid gap-1 sm:gap-2
            ${screenWidth > 768 ? "grid-cols-4 sm:grid-cols-5 lg:grid-cols-6" : "grid-cols-3 max-[400px]:grid-cols-2"}
          `}
        >
          {filteredTables.map(renderTableButton)}
        </div>
      </div>
    </div>
  );
};

export default ResponsivePOSLayout;