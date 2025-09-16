import React from "react";

const OrderDetailsModal = ({ show, onClose, orderItems }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm z-50 transition-opacity duration-300">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md transform scale-100 transition-all">
 
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="text-2xl font-semibold text-gray-800">Order Details</h2>
          <button
            className="text-gray-600 hover:text-gray-900 text-3xl font-bold"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto mt-4">
          <ul className="space-y-3">
            {orderItems.length > 0 ? (
              orderItems.map((item, idx) => (
                <li
                  key={idx}
                  className="flex justify-between items-center bg-gray-100 p-3 rounded-md shadow-sm"
                >
                  <span className="text-lg font-medium text-gray-700">{item.name}</span>
                  <span className="text-gray-600 font-semibold">{item.quantity} </span>
                </li>
              ))
            ) : (
              <p className="text-gray-500 text-center">No items found</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;
