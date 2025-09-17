import React, { useState, useRef, useEffect } from "react";
import { Search, Filter } from "lucide-react";

const MenuItems = ({
  itemsData,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  selectedTable,
  addItemToKOT,
  setSelectedCategory,
  categories,
}) => {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
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

  // Enhanced filtering and sorting logic
  const getFilteredAndSortedItems = () => {
    return itemsData
      .filter((item) => {
        // If no search term, use category filter only
        if (!searchTerm) {
          return (
            selectedCategory === "All" || item.category === selectedCategory
          );
        }

        const searchLower = searchTerm.toLowerCase();
        const itemIdStr = item.itemId
          ? item.itemId.toString().toLowerCase()
          : "";

        // Check if search term is numeric
        const isNumericSearch = /^\d+$/.test(searchTerm);

        if (isNumericSearch) {
          // For numeric search, only match IDs
          const exactIdMatch = itemIdStr === searchLower;
          const shorthandIdMatch =
            itemIdStr === `1000${searchLower}` ||
            itemIdStr.endsWith(searchLower);

          return (
            (exactIdMatch || shorthandIdMatch) &&
            (selectedCategory === "All" || item.category === selectedCategory)
          );
        } else {
          // For text search, search in names only
          const nameMatch = item.itemName.toLowerCase().includes(searchLower);

          return (
            nameMatch &&
            (selectedCategory === "All" || item.category === selectedCategory)
          );
        }
      })
      .sort((a, b) => {
        // If no search term, sort alphabetically by name
        if (!searchTerm) {
          return a.itemName.localeCompare(b.itemName);
        }

        const searchLower = searchTerm.toLowerCase();
        const isNumericSearch = /^\d+$/.test(searchTerm);

        if (isNumericSearch) {
          // For numeric search, prioritize exact ID matches
          const aIdStr = a.itemId ? a.itemId.toString().toLowerCase() : "";
          const bIdStr = b.itemId ? b.itemId.toString().toLowerCase() : "";

          // Exact ID match first
          const aIdExact = aIdStr === searchLower;
          const bIdExact = bIdStr === searchLower;
          if (aIdExact && !bIdExact) return -1;
          if (!aIdExact && bIdExact) return 1;

          // Shorthand match (like "1" for "10001")
          const aShorthand = aIdStr === `1000${searchLower}`;
          const bShorthand = bIdStr === `1000${searchLower}`;
          if (aShorthand && !bShorthand) return -1;
          if (!aShorthand && bShorthand) return 1;

          // ID ends with search term
          const aIdEnds = aIdStr.endsWith(searchLower);
          const bIdEnds = bIdStr.endsWith(searchLower);
          if (aIdEnds && !bIdEnds) return -1;
          if (!aIdEnds && bIdEnds) return 1;

          return a.itemName.localeCompare(b.itemName);
        } else {
          // For text search, prioritize name matches
          const aNameExact = a.itemName.toLowerCase() === searchLower;
          const bNameExact = b.itemName.toLowerCase() === searchLower;
          if (aNameExact && !bNameExact) return -1;
          if (!aNameExact && bNameExact) return 1;

          const aNameStarts = a.itemName.toLowerCase().startsWith(searchLower);
          const bNameStarts = b.itemName.toLowerCase().startsWith(searchLower);
          if (aNameStarts && !bNameStarts) return -1;
          if (!aNameStarts && bNameStarts) return 1;

          return a.itemName.localeCompare(b.itemName);
        }
      });
  };

  return (
    <>
      {screenWidth > 1025 ? (
        <div className="flex-1 p-2 sm:p-4">
          <div className="flex gap-2 sm:gap-3 lg:gap-4 mb-2 sm:mb-4">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search items..."
                className="w-full px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 lg:py-3 pl-8 sm:pl-10 lg:pl-12 
                  rounded-lg border bg-white text-[10px] sm:text-xs lg:text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search
                className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-gray-400 
                absolute left-2 sm:left-3 lg:left-4 top-1/2 transform -translate-y-1/2"
              />
            </div>
          </div>
          <div className="overflow-y-auto h-[25rem]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
              {getFilteredAndSortedItems().map((item) => (
                <button
                  key={item.itemId}
                  onClick={() => handleItemClick(item)}
                  disabled={!selectedTable}
                  className={`bg-white p-2 sm:p-3 lg:p-4 rounded-lg border transition-all text-left
                      ${
                        selectedTable
                          ? "hover:shadow-md hover:border-blue-300"
                          : "opacity-50 cursor-not-allowed"
                      }`}>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-medium text-[10px] sm:text-xs lg:text-sm break-words">
                      {item.itemName}
                    </h3>
                    <div
                      className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center 
                        border border-gray-300">
                      {item.veg ? (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      ) : (
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-500 text-[9px] sm:text-[10px] lg:text-xs mt-1">
                    {item.category}
                  </p>
                  <p className="font-bold text-[10px] sm:text-xs lg:text-sm mt-1 sm:mt-2">
                    ₹{item.price}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-2 sm:p-4">
          <div className="mb-4 flex items-center">
            <div className="relative mr-2" ref={filterRef}>
              <button
                onClick={() => setShowFilterPopup(!showFilterPopup)}
                className="p-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition-all">
                <Filter className="w-5 h-5" />
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
                      className={`block w-full text-left px-4 py-2 rounded-lg transition-all ${
                        selectedCategory === category
                          ? "bg-blue-500 text-white"
                          : "hover:bg-gray-100"
                      }`}>
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
                className="w-full pl-10 pr-4 py-2 rounded-lg border"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search
                className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-gray-400 
                absolute left-2 sm:left-3 lg:left-4 top-1/2 transform -translate-y-1/2"
              />
            </div>
          </div>
          <div className="overflow-y-auto h-[24rem]">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 ">
              {getFilteredAndSortedItems().map((item) => (
                <button
                  key={item.itemId}
                  onClick={() => handleItemClick(item)} // Trigger addItemToKOT on click
                  disabled={!selectedTable}
                  className={`bg-white p-3 rounded-lg border transition-all text-left shadow-sm hover:shadow-md ${
                    selectedTable
                      ? "hover:border-blue-300"
                      : "opacity-50 cursor-not-allowed"
                  }`}>
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium text-sm break-words">
                      {item.itemName}
                    </h3>
                    <div
                      className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center 
                        border border-gray-300">
                      {item.veg ? (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      ) : (
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{item.category}</p>
                  <p className="font-bold text-sm mt-2">₹{item.price}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MenuItems;
