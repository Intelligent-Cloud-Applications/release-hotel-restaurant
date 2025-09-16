import React from 'react';
import { Check, X } from 'lucide-react';

const PendingOrdersList = ({ orders = [], onAcceptOrder, onRejectOrder }) => {
  if (!orders || !Array.isArray(orders)) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="text-center text-gray-500 py-8">
          Select a table to start taking orders
        </div>
      </div>
    );
  }

  const sortedOrders = [...orders].sort((a, b) => {
    if (!a.paymentStatus && b.paymentStatus) return -1;
    if (a.paymentStatus && !b.paymentStatus) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const pendingOrders = sortedOrders.filter(order => !order.paymentStatus && order.status !== "delivered");
  const confirmedOrders = sortedOrders.filter(order => order.paymentStatus && order.status !== "delivered");

  if (orders.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="text-center text-gray-500 py-8">
          Select a table to start taking orders
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {pendingOrders.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-3 text-yellow-600">Pending Orders</h2>
          {pendingOrders.map((order) => (
            <div 
              key={order.orderId}
              className="border rounded-lg p-4 mb-3 bg-yellow-50"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold">Order #{order.orderId}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">Table: {order.tableName || 'N/A'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAcceptOrder(order)}
                    className="p-2 rounded-full bg-green-100 hover:bg-green-200 transition-colors"
                    title="Accept Order"
                  >
                    <Check className="w-4 h-4 text-green-600" />
                  </button>
                  <button
                    onClick={() => onRejectOrder(order)}
                    className="p-2 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
                    title="Reject Order"
                  >
                    <X className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>

              <div className="text-sm mt-2">
                <h4 className="font-semibold">Order Items:</h4>
                <ul className="list-disc pl-5 text-gray-700">
                  {order.items?.map((item, index) => (
                    <li key={index}>
                      {item.name} - {item.quantity}
                    </li>
                  )) || <li>No items</li>}
                </ul>
                <p className="mt-2">Total Items: {order.items?.length || 0}</p>
                <p>Total Amount: ₹{order.totalAmount?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmedOrders.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-3 text-green-600">Confirmed Orders</h2>
          {confirmedOrders.map((order) => (
            <div 
              key={order.orderId}
              className="border rounded-lg p-4 mb-3 bg-green-50"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold">Order #{order.orderId}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">Table: {order.tableName || 'N/A'}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAcceptOrder(order)}
                    className="p-2 rounded-full bg-green-100 hover:bg-green-200 transition-colors"
                    title="Accept Order"
                  >
                    <Check className="w-4 h-4 text-green-600" />
                  </button>
                  <button
                    onClick={() => onRejectOrder(order)}
                    className="p-2 rounded-full bg-red-100 hover:bg-red-200 transition-colors"
                    title="Reject Order"
                  >
                    <X className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>

              <div className="text-sm mt-2">
                <h4 className="font-semibold">Order Items:</h4>
                <ul className="list-disc pl-5 text-gray-700">
                  {order.items?.map((item, index) => (
                    <li key={index}>
                      {item.name} - {item.quantity}
                    </li>
                  )) || <li>No items</li>}
                </ul>
                <p className="mt-2">Total Items: {order.items?.length || 0}</p>
                <p>Total Amount: ₹{order.totalAmount?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingOrdersList;
