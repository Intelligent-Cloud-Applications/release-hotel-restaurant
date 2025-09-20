import { memo, useMemo } from "react";
import { Percent } from "lucide-react";

const DiscountSection = memo(({ orderItems, calculateTotals, getCurrentDiscountInfo, handleDiscountMethodChange, handleDiscountValueChange, discountValueInputRef }) => {
  const totals = useMemo(() => calculateTotals(orderItems), [orderItems, calculateTotals]);
  const { billSubtotal, discountAmount } = totals;
  const currentDiscount = getCurrentDiscountInfo();

  return (
    <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded-md border">
      <select
        value={currentDiscount.method}
        onChange={(e) => handleDiscountMethodChange(e.target.value)}
        className="text-xs border rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="none">None</option>
        <option value="percentage">%</option>
        <option value="amount">Amount</option>
      </select>

      {currentDiscount.method !== "none" && (
        <div className="relative flex-1">
          {currentDiscount.method === "percentage" && (
            <Percent className="w-3 h-3 absolute left-2 top-2 text-gray-400" />
          )}
          {currentDiscount.method === "amount" && (
            <span className="absolute left-2 top-1.5 text-gray-400 text-xs">₹</span>
          )}
          <input
            ref={discountValueInputRef}
            type="number"
            placeholder={currentDiscount.method === "percentage" ? "0-100" : "Amount"}
            min="0"
            max={currentDiscount.method === "percentage" ? "100" : billSubtotal}
            step={currentDiscount.method === "percentage" ? "0.1" : "0.01"}
            className="w-full pl-6 pr-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            value={currentDiscount.value || ""}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (currentDiscount.method === "percentage") {
                handleDiscountValueChange(Math.max(0, Math.min(100, value)));
              } else {
                handleDiscountValueChange(Math.max(0, Math.min(billSubtotal, value)));
              }
            }}
          />
        </div>
      )}

      {currentDiscount.value > 0 && (
        <span className="text-xs font-medium text-red-600">
          -₹{discountAmount.toFixed(2)}
        </span>
      )}
    </div>
  );
});

DiscountSection.displayName = 'DiscountSection'; // For debugging
export default DiscountSection