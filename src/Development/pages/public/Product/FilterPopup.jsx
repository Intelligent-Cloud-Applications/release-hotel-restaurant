import React from 'react'

const FilterPopup = ({
  categories,
  setCategoryFilter,
  categoryFilter,
  sortOrder,
  setSortOrder,
  applyFilters,
  setIsModalOpen,
  allCategories, // This prop will contain all categories regardless of filters
}) => {
  // Use allCategories if provided, otherwise fall back to categories
  const categoriesToDisplay = allCategories || categories;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg w-11/12 max-w-md">
        <h2 className="text-lg font-bold mb-4">Filters</h2>
        <div className="mb-4">
          <label
            htmlFor="category"
            className="block text-sm font-medium mb-2"
          >
            Select Category
          </label>
          <select
            className="p-2 border border-gray-300 rounded-lg w-full"
            onChange={(e) => setCategoryFilter(e.target.value)}
            value={categoryFilter}
          >
            <option value="">All Categories</option>
            {categoriesToDisplay.map((category, idx) => (
              <option key={idx} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Sort by Price
          </label>
          <div className="flex items-center">
            <input
              type="radio"
              name="sortOrder"
              value="lowToHigh"
              checked={sortOrder === "lowToHigh"}
              onChange={() => setSortOrder("lowToHigh")}
              className="mr-2"
            />
            <span>Low to High</span>
          </div>
          <div className="flex items-center">
            <input
              type="radio"
              name="sortOrder"
              value="highToLow"
              checked={sortOrder === "highToLow"}
              onChange={() => setSortOrder("highToLow")}
              className="mr-2"
            />
            <span>High to Low</span>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            className="px-4 py-2 text-white bg-primaryColor rounded-lg"
            onClick={applyFilters}
          >
            Apply
          </button>
          <button
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg ml-2"
            onClick={() => setIsModalOpen(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default FilterPopup