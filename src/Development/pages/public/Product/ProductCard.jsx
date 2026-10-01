import React, { useState, useEffect } from "react";
import { getCurrencySymbol } from "../../../common/Inputs";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { isItemOutOfStock } from "./Product";

const ProductCard = ({
  isSearchClicked,
  filteredItems,
  groupedItems,
  isItemInCart,
  handleAddToCart,
  navigate,
  handleViewCartClick,
  isButtonVisible
}) => {
  const [expandedCategory, setExpandedCategory] = useState([]);

  useEffect(() => {
    if (groupedItems.length > 0) {
      setExpandedCategory(new Array(groupedItems.length).fill(true)); 
    }
  }, [groupedItems]);

  const toggleCategory = (index) => {
    const newExpandedCategory = [...expandedCategory];
    newExpandedCategory[index] = !newExpandedCategory[index];
    setExpandedCategory(newExpandedCategory);
  };

  return (
    <div className="lg:px-20 px-2">
      {isSearchClicked && filteredItems.length === 0 ? (
        <p className="text-center text-gray-500 mt-4">No items found</p>
      ) : groupedItems.length === 0 ? (
        <div className="text-center">
          <p className="text-lg text-gray-700">No categories available.</p>
        </div>
      ) : (
        <div>
          {groupedItems.map(({ category, items }, index) => (
            <div
              key={category}
              className="flex justify-center flex-col items-center my-8"
            >
              <div className="w-full max-w-3xl px-2">
                <h2 className="text-2xl font-bold text-gray-700 mb-6 border-b-2 border-gray-200 pb-2 text-center flex justify-between items-center">
                  <span>
                    {category
                      ? category[0].toUpperCase() + category.slice(1)
                      : "Unknown Category"}
                  </span>
                  <button
                    onClick={() => toggleCategory(index)}
                    className="text-blue-600 hover:text-blue-800 focus:outline-none transform transition-transform duration-300"
                  >
                    {expandedCategory[index] ? (
                      <FiChevronUp className="transform transition-transform duration-300" />
                    ) : (
                      <FiChevronDown className="transform transition-transform duration-300" />
                    )}
                  </button>
                </h2>

                <div
                  className={`overflow-hidden transition-all duration-700 ease-out ${
                    expandedCategory[index] ? "max-h-full" : "max-h-0"
                  }`}
                >
                  {expandedCategory[index] && (
                    <div className="grid gap-4">
                      {items
                        .filter((item) => !isItemOutOfStock(item))
                        .map((item) => (
                        <div
                          key={item.itemId || Math.random()}
                          className={`relative flex items-center rounded-lg p-4 shadow-md hover:shadow-lg transition-all duration-300 bg-secondaryColor`}
                        >
                          {item.outOfStock && (
                            <div className="absolute inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center rounded-lg z-10">
                              <span className="text-white font-bold text-2xl">
                                Out of Stock
                              </span>
                            </div>
                          )}

                          <div className="flex-1">
                            {/* {item.veg !== undefined && (
                              <div
                                className={`absolute top-2 right-2 flex items-center justify-center w-4 h-4 border rounded-md ${
                                  item.veg
                                    ? "bg-green-100 border-green-500"
                                    : "bg-red-100 border-red-500"
                                }`}
                              >
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    item.veg ? "bg-green-500" : "bg-red-500"
                                  }`}
                                ></div>
                               
                              </div>
                            )} */}

                            <div className="ml-4 flex flex-col">
                            <div className="flex flex-row gap-1">
                              {item.veg !== undefined && (
                              <div
                                className={` flex items-center mt-[6px] justify-center w-4 h-4 border rounded-md ${
                                  item.veg
                                    ? "bg-green-100 border-green-500"
                                    : "bg-red-100 border-red-500"
                                }`}
                              >
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    item.veg ? "bg-green-500" : "bg-red-500"
                                  }`}
                                ></div>
                                {/* <span
                                  className={`ml-2 text-[7px] font-bold ${
                                    item.veg ? "text-green-700" : "text-red-700"
                                  }`}
                                >
                                  {item.veg ? "VEG" : "NON-VEG"}
                                </span> */}
                              </div>
                            )}
                              <h3 className="font-semibold text-lg text-gray-800">

                                {item.itemName
                                  ? item.itemName[0].toUpperCase() +
                                    item.itemName.slice(1)
                                  : "Unnamed Item"}
                              </h3>
                              </div>
                              <p className="text-gray-600 text-sm">
                                {item.price
                                  ? `${getCurrencySymbol(item.currency) || ""}${
                                      item.price
                                    }`
                                  : "Price Not Available"}
                              </p>
                            </div>
                          </div>
                          {isButtonVisible && (
                          <div className="absolute bottom-[10px] right-2 flex space-x-2 items-center">
                            {item.outOfStock ? (
                              <button
                                className="text-white font-medium rounded-sm text-xs px-3 py-[6px] bg-primaryColor cursor-not-allowed"
                                disabled
                              >
                                Out of Stock
                              </button>
                            ) : isItemInCart(item.itemId) ? (
                              <button
                                className="text-white font-medium rounded-sm text-xs px-4 py-[8px] bg-primaryColor"
                                onClick={handleViewCartClick}
                              >
                                View Cart
                              </button>
                            ) : (
                              <button
                                className="text-white font-medium rounded-sm text-xs px-4 py-[8px] bg-primaryColor"
                                onClick={() => handleAddToCart(item)}
                              >
                                Add to Cart
                              </button>
                            )}
                          </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductCard;
