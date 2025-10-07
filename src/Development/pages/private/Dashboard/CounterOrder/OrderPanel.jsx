import React, { useState, useEffect, useContext } from "react";
import { Context } from "../../../../Context";
import EmptyOrderPanel from "./EmptyOrderPanel";
import TabSelector from "./TabSelector";
import OrderContent from "./OrderContent";
import { API } from "aws-amplify";
import { toast } from "react-toastify";

const OrderPanel = ({
  selectedTable,
  setSelectedTable,
  setTables,
  setCurrentKOT,
  activeTab,
  setActiveTab,
  KOTByTable,
  customerDetails,
  setCustomerDetails,
  updateItemQuantity,
  removeItemFromKOT,
  printKOT,
  printBill,
  tables,
  setShowModal,
  printAllItems,
  setPrintAllItems,
  setKOTByTable,
  tableOccupancy,
  fetchPendingOrders,
  pendingOrders,
  fetchTableData,
  tableData,
  saveKOT,
  billItemsByStore,
  localBillItems,
  setLocalBillItems,
  fetchAllTableData,
  setTableOccupancy,
  bluetoothConnected,
  bluetoothDeviceName,
  connectBluetooth,
  printBluetooth,
  tableInstructions,
  showReprintKOT,
  setShowReprintKOT,
  unpaidOrders,
  settleUnpaidOrder,
     discountData,
  setDiscountData,
}) => {
  const { institutionData, setLoader } = useContext(Context);
  const [mergedItemsState, setMergedItemsState] = useState([]);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [splitBillMode, setSplitBillMode] = useState(false);
  const [orderGroups, setOrderGroups] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const handleSettleBill = () => {
    setShowModal(true);
  };

  // Filter unpaid orders for the selected table
  const tableUnpaidOrders = selectedTable
    ? unpaidOrders.filter((order) => String(order.tableName) === String(selectedTable.id))
    : [];

  useEffect(() => {
    if (selectedTable) {
      const tableIdStr = String(selectedTable.id);
      const currentTableData = tableData[tableIdStr] || {};
      const hasPendingOrders = pendingOrders && pendingOrders.length > 0;

      const itemsToShow = hasPendingOrders
        ? pendingOrders.flatMap((order) => order.items?.L || [])
        : currentTableData.mergedItems || [];

      setMergedItemsState(currentTableData.mergedItems);

    } else {
      setMergedItemsState([]);
    }
  }, [selectedTable, tableData, pendingOrders]);

  useEffect(() => {
    if (selectedTable) {
      const tableIdStr = String(selectedTable.id);
      const currentTableData = tableData[tableIdStr] || {};
      if (currentTableData && currentTableData.splitBill) {
        setSplitBillMode(true);
      } else {
        setSplitBillMode(false);
        setOrderGroups([]);
        setSelectedOrderId(null);
      }
    }
  }, [selectedTable, tableData]);

  useEffect(() => {
    if (splitBillMode && selectedTable) {
      const tableIdStr = String(selectedTable.id);
      const currentTableData = tableData[tableIdStr] || {};
      if (currentTableData.orders && Object.keys(currentTableData.orders).length > 0) {
        const groups = Object.values(currentTableData.orders).map((order) => ({
          orderId: order.orderId,
          customerName: order.name || "",
          phoneNumber: order.phoneNumber || "",
          items: order.items || [],
          cgst: order.cgst || 0,
          sgst: order.sgst || 0,
          serviceTax: order.serviceTax || 0,
          totalAmount: order.totalAmount || 0,
        }));
        setOrderGroups(groups);
        if (groups.length > 0 && !selectedOrderId) {
          setSelectedOrderId(groups[0].orderId);
        }
      }
    }
  }, [splitBillMode, selectedTable, tableData]);

  const toggleSplitBillMode = async () => {
    if (!selectedTable) {
      toast.error("No table selected.");
      return;
    }

    if (!localBillItems.length) {
      toast.error("No items to split. Add items first.");
      return;
    }

    setLoader(true);
    try {
      const tableIdStr = String(selectedTable.id);
      const newSplitBillMode = !splitBillMode;

      await API.put("main", `/admin/split-bill/${institutionData.institution}/${tableIdStr}`, {
        body: { splitBill: newSplitBillMode,type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe", },
      });
      await fetchPendingOrders();
      setSplitBillMode(newSplitBillMode);

      if (newSplitBillMode) {
        const initialOrder = {
          orderId: `ORDER-${Date.now()}`,
          customerName: customerDetails[selectedTable?.id]?.name || "",
          phoneNumber: customerDetails[selectedTable?.id]?.phone || "",
          items: [...localBillItems],
          cgst: 0,
          sgst: 0,
          serviceTax: 0,
          totalAmount: 0,
        };
        setOrderGroups([initialOrder]);
        setSelectedOrderId(initialOrder.orderId);
      } else {
        setOrderGroups([]);
        setSelectedOrderId(null);
      }

      toast.success(newSplitBillMode ? "Split bill mode enabled" : "Split bill mode disabled");
    } catch (error) {
      console.error("Error toggling split bill mode:", error);
      toast.error("Failed to toggle split bill mode. Please try again.");
    } finally {
      setLoader(false);
    }
  };

  const handleAcceptOrder = async () => {
    if (!selectedTable || !institutionData) return;

    setIsAccepting(true);
    try {
      const response = await API.post("main", `/admin/accept-order/${institutionData.institution}`, {
        body: { tableName: String(selectedTable.id), institution: institutionData.institution,type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe", },
      });

      await fetchTableData(selectedTable.id);
      await fetchPendingOrders();
      toast.success(`Successfully accepted ${response.count} orders`);
    } catch (error) {
      console.error("Error accepting orders:", error);
      toast.error("Failed to accept orders: " + (error.response?.data?.message || error.message));
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedTable || !institutionData) return;

    setIsCancelling(true);
    setLoader(true);

    try {
      const response = await API.post("main", `/admin/cancel-order/${institutionData.institution}`, {
        body: {
          tableName: String(selectedTable.id),
          institution: institutionData.institution,
          type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
        },
      });

      await Promise.all([fetchTableData(selectedTable.id), fetchPendingOrders()]);

      const tableIdStr = String(selectedTable.id);
      setMergedItemsState([]);
      setKOTByTable((prev) => ({
        ...prev,
        [tableIdStr]: { items: [], totalAmount: 0, billItems: [] },
      }));
      setTableOccupancy((prev) => ({
        ...prev,
        [tableIdStr]: false,
      }));

      toast.success(`Successfully canceled the order`);
    } catch (error) {
      console.error("Error canceling orders:", error);
      const errorMessage = error.response?.data?.message || error.message;
      toast.error(`Failed to cancel order: ${errorMessage}`);
    } finally {
      setIsCancelling(false);
      setLoader(false);
    }
  };

  const kotcurrent =
    selectedTable && KOTByTable[String(selectedTable.id)]
      ? KOTByTable[String(selectedTable.id)]
      : { items: [], totalAmount: 0, billItems: [] };

  const tableIdStr = selectedTable ? String(selectedTable.id) : null;
  const currentTableData = tableIdStr ? tableData[tableIdStr] || {} : {};
  const hasPendingOrders = selectedTable && pendingOrders && pendingOrders.length > 0;
  const isTableOccupied = tableIdStr && tableOccupancy[tableIdStr];
  const safeBillItems = tableIdStr ? tableData[tableIdStr] || {} : {};

  // Modified condition to prioritize unpaid orders and occupied tables only
  const shouldShowOrderContent =
    selectedTable &&
    (tableUnpaidOrders.length > 0 || // Show if there are unpaid orders
      isTableOccupied);

  return (
    <div className="w-full sm:w-80 md:w-96 bg-white border-t sm:border-t-0 sm:border-l flex flex-col">
      {shouldShowOrderContent ? (
        <>
          <TabSelector
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedTable={selectedTable}
            setSelectedTable={setSelectedTable}
            fetchPendingOrders={fetchPendingOrders}
            tables={tables}
            setKOTByTable={setKOTByTable}
            setLocalBillItems={setLocalBillItems}
            localBillItems={localBillItems}
            splitBillMode={splitBillMode}
            setSplitBillMode={setSplitBillMode}
            toggleSplitBillMode={toggleSplitBillMode}
            hasItems={localBillItems.length > 0}
            KOTByTable={KOTByTable}
            tableData={tableData} // Added
  fetchTableData={fetchTableData} // Added
          />
          <OrderContent
            unpaidOrders={unpaidOrders}
            settleUnpaidOrder={settleUnpaidOrder}
            selectedTable={selectedTable}
            setSelectedTable={setSelectedTable}
            fetchPendingOrders={fetchPendingOrders}
            KOTByTable={KOTByTable}
            customerDetails={customerDetails}
            setCustomerDetails={setCustomerDetails}
            updateItemQuantity={updateItemQuantity}
            removeItemFromKOT={removeItemFromKOT}
            kotcurrent={kotcurrent}
            total={currentTableData.totalAmount || 0}
            cgst={currentTableData.totalCGST || "0.00"}
            sgst={currentTableData.totalSGST || "0.00"}
            serviceTax={currentTableData.totalServiceTax || "0.00"}
            institutionData={institutionData}
            activeTab={activeTab}
            printAllItems={printAllItems}
            currentTableData={currentTableData}
            setPrintAllItems={setPrintAllItems}
            printKOT={printKOT}
            printBill={printBill}
            setShowModal={setShowModal}
            saveKOT={saveKOT}
            settleBill={handleSettleBill}
            billItems={safeBillItems.billItems || []}
            setLocalBillItems={setLocalBillItems}
            localBillItems={localBillItems}
            fetchTableData={fetchTableData}
            bluetoothConnected={bluetoothConnected}
            bluetoothDeviceName={bluetoothDeviceName}
            connectBluetooth={connectBluetooth}
            printBluetooth={printBluetooth}
            splitBillMode={splitBillMode}
            setSplitBillMode={setSplitBillMode}
            orderGroups={orderGroups}
            setOrderGroups={setOrderGroups}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
            showReprintKOT={showReprintKOT}
            setShowReprintKOT={setShowReprintKOT}
                 discountData={discountData}
            setDiscountData={setDiscountData}
          />
        </>
      ) : (
        <EmptyOrderPanel
          tableOrders={currentTableData.orders?.M || {}}
          onOrderAccepted={fetchTableData}
          selectedTable={selectedTable}
          fetchPendingOrders={fetchPendingOrders}
          pendingOrders={pendingOrders}
          mergedItemsState={mergedItemsState}
          isCancelling={isCancelling}
          isAccepting={isAccepting}
          handleAcceptOrder={handleAcceptOrder}
          handleCancelOrder={handleCancelOrder}
          institutionData={institutionData}
        />
      )}
    </div>
  );
};

export default OrderPanel;