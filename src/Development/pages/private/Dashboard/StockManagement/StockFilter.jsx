import React, { useContext, useEffect } from "react";
import { Context } from "../../../../Context";

const StockFilter = ({ filterType, setFilterType }) => {
  const { institutionData } = useContext(Context) || {};

  useEffect(() => {
    if (institutionData?.bar_integration === "Yes") {
      setFilterType("bar");
    } else {
      setFilterType("cafe");
    }
  }, [institutionData?.bar_integration, setFilterType]);

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <label htmlFor="stockType" className="font-medium whitespace-nowrap">
        Type:
      </label>
      <select
        id="stockType"
        value={filterType}
        onChange={(e) => setFilterType(e.target.value)}
        className="border px-3 py-2 rounded min-w-[120px] bg-white"
      >
        <option value="cafe">Cafe</option>
        {institutionData?.bar_integration === "Yes" && (
          <option value="bar">Bar</option>
        )}
      </select>
    </div>
  );
};

export default StockFilter;
