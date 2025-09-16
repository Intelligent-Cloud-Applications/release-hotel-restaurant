const OrderTypeSelector = ({ orderType, setOrderType }) => {
    return (
      <div className="flex flex-wrap gap-2 p-2 sm:p-4 border-b">
        <button
          onClick={() => setOrderType("dineIn")}
          className={`px-3 py-1 rounded-lg text-xs sm:text-sm ${
            orderType === "dineIn" ? "bg-blue-500 text-white" : "bg-gray-100"
          }`}
        >
          Dine In
        </button>
        <button
          onClick={() => setOrderType("takeaway")}
          className={`px-3 py-1 rounded-lg text-xs sm:text-sm ${
            orderType === "takeaway" ? "bg-blue-500 text-white" : "bg-gray-100"
          }`}
        >
          Takeaway
        </button>
      </div>
    );
  };
  export default OrderTypeSelector