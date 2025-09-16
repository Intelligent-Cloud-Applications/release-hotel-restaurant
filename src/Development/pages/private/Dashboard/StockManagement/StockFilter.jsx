// StockFilter Component
const StockFilter = ({ filterType, setFilterType }) => (
  <div className="flex items-center gap-2 flex-shrink-0">
    <label htmlFor="stockType" className="font-medium whitespace-nowrap">
      Type:
    </label>
    <select
      id="stockType"
      value={filterType}
      onChange={(e) => setFilterType(e.target.value)}
      className="border px-3 py-2 rounded min-w-[120px] bg-white">
      <option value="cafe">Cafe</option>
      <option value="bar">Bar</option>
    </select>
  </div>
);

export default StockFilter;