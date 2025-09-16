import React from "react";

const EmptyOrderPanel = ({
  tableOrders,
  onOrderAccepted,
  selectedTable,
  fetchPendingOrders,
  pendingOrders,
  isCancelling,
  isAccepting,
  handleAcceptOrder,
  handleCancelOrder,
  mergedItemsState = [],
  institutionData,
}) => {
  // Process pending orders to get all items
  const pendingItems = pendingOrders?.flatMap(order =>
    (order.items || []).map(item => ({
      ...item,
      name: item.name,
      price: item.price || 0,
      quantity: item.quantity || 1
    }))
  ) || [];
  
  // Combine pending items with merged items (if any), avoiding duplicates
  const allItems = [
    ...pendingItems,
    ...mergedItemsState.filter(mergedItem =>
      !pendingItems.some(pending => pending.itemId === mergedItem.itemId)
    )
  ];
  
  // Calculate subtotal and taxes
  const subtotal = allItems.reduce(
    (sum, item) => sum + (item.price * item.quantity),
    0
  );
  
  // Tax rates (default values if institutionData is not provided)
  const cgstRate = institutionData?.cgst !== undefined ? institutionData.cgst : 2.5;
  const sgstRate = institutionData?.sgst !== undefined ? institutionData.sgst : 2.5;
  const serviceTaxRate = institutionData?.serviceTax !== undefined ? institutionData.serviceTax : 0;

  // Calculate taxes
  const calculatedCgst = (subtotal * cgstRate) / 100;
  const calculatedSgst = (subtotal * sgstRate) / 100;
  const calculatedServiceTax = (subtotal * serviceTaxRate) / 100;
  
  // Final total including all taxes, rounded to the nearest whole number and formatted with .00
  const totalAmount = Math.round(subtotal + calculatedCgst + calculatedSgst + calculatedServiceTax).toFixed(2);

  return (
    <div className="p-2 sm:p-4 flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-200px)] bg-gray-50">
      {selectedTable ? (
        <div className="w-full max-w-sm bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="p-2 sm:p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <h2 className="text-base sm:text-xl font-bold text-center text-gray-800">
              {selectedTable.name}
            </h2>
          </div>
          
          {allItems.length > 0 ? (
            <div className="p-3 sm:p-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2 sm:mb-3">
                {pendingOrders && pendingOrders.length > 0 ? "Pending Orders" : "Current Orders"}
              </h3>
              
              {/* Scrollable Items Section */}
              <div className="max-h-48 sm:max-h-64 overflow-y-auto mb-3 sm:mb-4">
                <div className="space-y-1.5 sm:space-y-2">
                  {allItems.map((item, index) => (
                    <div 
                      key={index} 
                      className="flex justify-between items-center p-1.5 sm:p-2 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1 mr-2 overflow-hidden">
                        <p className="font-medium text-gray-800 truncate text-sm sm:text-base">
                          {item.itemName || item.name}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                        <span className="bg-gray-200 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
                          x{item.quantity}
                        </span>
                        <span className="font-semibold text-gray-900 w-16 text-right text-sm sm:text-base">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Total Amount (including taxes, rounded and formatted as .00) */}
              <div className="p-2 sm:p-3 bg-gray-100 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center text-gray-900">
                  <span className="font-semibold text-sm sm:text-base">Total Amount:</span>
                  <span className="font-bold text-base sm:text-lg">₹{totalAmount}</span>
                </div>
              </div>
              
              {/* Action Buttons */}
              {pendingOrders && pendingOrders.length > 0 && (
                <div className="mt-2 sm:mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={handleCancelOrder}
                    className="bg-white border border-red-500 text-red-500 py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm rounded-lg hover:bg-red-50 transition-colors duration-200"
                    disabled={isCancelling || isAccepting}
                  >
                    {isCancelling ? "Cancelling..." : "Cancel Order"}
                  </button>
                  <button
                    onClick={handleAcceptOrder}
                    className="bg-green-500 text-white py-1.5 sm:py-2 px-2 sm:px-3 text-xs sm:text-sm rounded-lg hover:bg-green-600 disabled:bg-gray-400 transition-colors duration-200"
                    disabled={isCancelling || isAccepting}
                  >
                    {isAccepting ? "Accepting..." : "Accept Order"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 sm:p-6 text-center text-gray-500 text-sm sm:text-base">
              <p>No active or pending orders for this table.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 sm:p-6 text-center text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200 w-full max-w-sm text-sm sm:text-base">
          <p>Select a table to view or manage orders.</p>
        </div>
      )}
    </div>
  );
};

export default EmptyOrderPanel;
