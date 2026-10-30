import React, { useContext, useState, useEffect } from "react";
import { Context } from "../../../Context";
import { useNavigate, useLocation } from "react-router-dom";
import FilterPopup from "./FilterPopup.jsx";
import FrontProduct from "./FrontProduct.jsx";
import OrderPopup from "./OrderPopup.jsx";
import ViewCartPopUp from "./ViewCartPopUp.jsx";
import PaymentPopup from "./PaymentPopup";
import { API } from "aws-amplify";
import { toast } from "react-toastify";
import { FiChevronDown, FiShoppingCart, FiFilter, FiShoppingBag } from "react-icons/fi";
import { BiSolidFoodMenu } from "react-icons/bi";

export const isItemOutOfStock = (item, stocks = []) => {
  if (!item) return false;

  // 1. Direct item flags (handles boolean, string, numbers)
  const oos = item.outOfStock;
  if (oos === true || oos === "true" || oos === 1 || oos === "1") return true;
  if (
    item.isOutOfStock === true ||
    item.isOutOfStock === "true" ||
    item.isOutOfStock === 1
  )
    return true;
  if (
    item.available === false ||
    item.available === "false" ||
    item.available === 0 ||
    item.available === "0"
  )
    return true;

  // 2. Check connected stocks if stocks are available
  if (stocks && Array.isArray(stocks) && stocks.length > 0) {
    if (Array.isArray(item.materials) && item.materials.length > 0) {
      const anyMaterialEmpty = item.materials.some((mat) => {
        if (!mat || (!mat.stockId && !mat.stockName)) return false;
        const matchingStock = stocks.find(
          (s) =>
            (mat.stockId && s.stockId === mat.stockId) ||
            (mat.stockName &&
              s.stockName &&
              s.stockName.trim().toLowerCase() ===
                mat.stockName.trim().toLowerCase())
        );
        if (matchingStock) {
          const qtyStr = String(matchingStock.quantity || "").trim();
          const num = parseFloat(qtyStr.split(" ")[0]);
          return !isNaN(num) && num <= 0;
        }
        return false;
      });
      if (anyMaterialEmpty) return true;
    }

    if (item.stockId) {
      const matchingStock = stocks.find((s) => s.stockId === item.stockId);
      if (matchingStock) {
        const qtyStr = String(matchingStock.quantity || "").trim();
        const num = parseFloat(qtyStr.split(" ")[0]);
        if (!isNaN(num) && num <= 0) return true;
      }
    }
  }

  return false;
};

const Product = ({ items = [], stocks: propStocks = [] }) => {
  const context = useContext(Context) || {};
  const { PrimaryColor, productTagline, institution } = context.institutionData || {};
  const itemsList = Array.isArray(items) && items.length > 0 ? items : (context.items || []);
  const [stocks, setStocks] = useState(propStocks || []);

  useEffect(() => {
    if (propStocks && Array.isArray(propStocks) && propStocks.length > 0) {
      setStocks(propStocks);
    }
  }, [propStocks]);

  useEffect(() => {
    if ((!stocks || stocks.length === 0) && institution) {
      API.get("main", `/admin/stock-list-items/${institution}`)
        .then((res) => {
          if (Array.isArray(res)) setStocks(res);
        })
        .catch(() => {});
    }
  }, [institution, stocks.length]);

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { userData, setLoader } = context;
  const [isCartPopupOpen, setIsCartPopupOpen] = useState(false);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isSearchClicked, setIsSearchClicked] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState("");
  const [cartItems, setCartItems] = useState(() => {
    // Initialize state from localStorage on mount
    return JSON.parse(localStorage.getItem("cartItems")) || [];
  });
  const [vegFilter, setVegFilter] = useState("All");
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [isButtonVisible, setIsButtonVisible] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Sync cartItems with localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("cartItems", JSON.stringify(cartItems));
  }, [cartItems]);

  // Check payment status for online payments
  useEffect(() => {
    const latestPayment = JSON.parse(localStorage.getItem("latestPayment"));
    if (latestPayment && latestPayment.method === "online") {
      const selectedOrderId = latestPayment.orderId;
      const checkPaymentStatus = async () => {
        try {
          const response = await API.get("main", `/any/get-order/${institution}`, {
            queryStringParameters: { orderId: selectedOrderId },
          });
          if (response.orders && response.orders.length > 0) {
            const order = response.orders[0];
            if (order.paymentStatus === true || order.verify === true) {
              console.log("Payment verified, no popup needed.");
            } else {
              setCurrentOrderId(selectedOrderId);
              setShowPaymentPopup(true);
            }
          } else {
            console.warn("No orders found for orderId:", selectedOrderId);
          }
        } catch (error) {
          console.error("Error fetching order:", error);
        }
      };
      checkPaymentStatus();
    }
  }, [institution]);

  // Determine button visibility based on query params and user type
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tableNameFromQuery = queryParams.get("tableName");
    const userType = userData.userType;

    if (userType === "admin" || userType === "chef" || userType === "waiter") {
      setIsButtonVisible(true);
    } else if (tableNameFromQuery) {
      setIsButtonVisible(true);
    } else {
      setIsButtonVisible(false);
    }
  }, [location, userData.userType]);

  // Handle out-of-stock items and initialize collapsed categories only on first load
  useEffect(() => {
    const outOfStockItemIds = itemsList
      .filter((item) => isItemOutOfStock(item, stocks))
      .map((item) => item.itemId);
    const updatedCart = cartItems.filter(
      (cartItem) => !outOfStockItemIds.includes(cartItem.itemId)
    );
    if (updatedCart.length !== cartItems.length) {
      setCartItems(updatedCart);
    }

    if (isFirstLoad && itemsList.length > 0) {
      const initialCollapsed = {};
      itemsList
        .filter((item) => !isItemOutOfStock(item, stocks))
        .forEach((item) => {
          if (item.category) initialCollapsed[item.category] = false;
        });
      setCollapsedCategories(initialCollapsed);
      setIsFirstLoad(false);
    }
  }, [itemsList, stocks, refreshKey, isFirstLoad]);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleViewCartClick = () => {
    setIsCartPopupOpen(true);
  };

  const handleOrderPlaced = (orderId) => {
    setCartItems([]); // Clear cart in state
    localStorage.removeItem("cartItems"); // Clear cart in localStorage
    setRefreshKey((prevKey) => prevKey + 1);
    setCurrentOrderId(orderId);
    handleOfflinePayment(orderId);
  };

  const handleOfflinePayment = async (orderId) => {
    setLoader(true);
    try {
      await API.post("main", `/admin/order-notify/${institution}`, {
        body: {
          orderId: orderId
        },
      });
      setLoader(false);
      // toast.success("Order sent successfully");
    } catch (error) {
      console.error("Error updating order status:", error);
      setLoader(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setIsSearchClicked(true);
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value) {
      const filteredSuggestions = itemsList
        .filter((item) => !isItemOutOfStock(item, stocks))
        .map((item) => item.itemName)
        .filter(
          (name) => name && name.toLowerCase().includes(value.toLowerCase())
        );
      setSuggestions(filteredSuggestions);
    } else {
      setSuggestions([]);
    }
  };

  const toggleCategory = (category) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleAddToCart = (item) => {
    const existingItem = cartItems.find((cartItem) => cartItem.itemId === item.itemId);
    if (existingItem) {
      alert("Item is already in the cart.");
    } else {
      const updatedCartItems = [...cartItems, { ...item, quantity: 1 }];
      setCartItems(updatedCartItems);
    }
  };

  const handleQuantityChange = (itemId, change) => {
    const updatedCartItems = cartItems.map((cartItem) => {
      if (cartItem.itemId === itemId) {
        const newQuantity = Math.max(0, cartItem.quantity + change);
        return newQuantity > 0 ? { ...cartItem, quantity: newQuantity } : null;
      }
      return cartItem;
    }).filter(item => item !== null);
    setCartItems(updatedCartItems);
  };

  const handleRemoveFromCart = (itemId) => {
    const updatedCartItems = cartItems.filter((cartItem) => cartItem.itemId !== itemId);
    setCartItems(updatedCartItems);
  };

  const updateCartItems = (newCartItems) => {
    setCartItems(newCartItems);
  };

  const isItemInCart = (itemId) => {
    return cartItems.some((cartItem) => cartItem.itemId === itemId);
  };

  const getItemQuantity = (itemId) => {
    const item = cartItems.find((cartItem) => cartItem.itemId === itemId);
    return item ? item.quantity : 0;
  };

  const handleOrderButtonClick = () => {
    const orderId = JSON.parse(localStorage.getItem("orderId"));
    if (userData.cognitoId) {
      navigate("/dashboard");
    } else if (orderId) {
      setIsPopupOpen(true);
    }
  };

  const filteredItems = itemsList.filter(
    (item) =>
      !isItemOutOfStock(item, stocks) &&
      item.itemName &&
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (categoryFilter ? item.category === categoryFilter : true) &&
      (vegFilter === "All" || (vegFilter === "Veg" ? item.veg : !item.veg))
  );

  const categories = [...new Set(filteredItems.map((item) => item.category))].filter(Boolean);
  const allCategories = [
    ...new Set(
      itemsList
        .filter((item) => !isItemOutOfStock(item, stocks))
        .map((item) => item.category)
    ),
  ].filter(Boolean);

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortOrder === "lowToHigh") {
      return a.price - b.price;
    } else if (sortOrder === "highToLow") {
      return b.price - a.price;
    }
    return 0;
  });

  const groupedItems = categories
    .map((category) => ({
      category,
      items: sortedItems.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);

  const ModernProductCard = ({ item }) => {
    if (!item || isItemOutOfStock(item, stocks)) return null;
    const isInCart = isItemInCart(item.itemId);
    const quantity = getItemQuantity(item.itemId);

    return (
      <div className=" bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-200 h-40 ">
        <div className="flex h-full">
          <div className="w-32 h-full flex-shrink-0">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.itemName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <BiSolidFoodMenu className="text-gray-400 text-2xl" />
              </div>
            )}
          </div>
          <div className="flex-1 p-3 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3
                  className="font-semibold text-gray-900 text-sm break-words pr-2"
                  style={{ wordWrap: "break-word" }}
                >
                  {item.itemName}
                </h3>
                <div className="flex-shrink-0">
                  {item.veg ? (
                    <div className="w-4 h-4 border border-green-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  ) : (
                    <div className="w-4 h-4 border border-red-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
              {item.description && (
                <p className="text-xs text-gray-600 line-clamp-2 mb-2">{item.description}</p>
              )}
            </div>
            <div className="flex justify-between items-center">
              <p className="text-gray-800 font-bold text-sm">₹{item.price}</p>
              {isButtonVisible ? (
                isInCart ? (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => handleQuantityChange(item.itemId, -1)}
                        className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-300 transition-colors"
                      >
                        -
                      </button>
                      <span className="text-sm font-medium">{quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(item.itemId, 1)}
                        className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-300 transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.itemId)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAddToCart(item)}
                    className="px-3 py-1.5 text-xs bg-primaryColor text-white hover:bg-primaryColorLight rounded-md flex items-center gap-1 transition-colors"
                  >
                    <FiShoppingCart size={12} />
                    <span>Add</span>
                  </button>
                )
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ProductGridView = ({ groupedItems }) => {
    return (
      <div className="px-4 sm:px-8 md:px-12 lg:px-16 xl:px-20 pb-10 pt-6">
        {groupedItems.length > 0 ? (
          groupedItems.map((group) => (
            <div key={group.category} className="mb-8">
              <button
                className="w-full flex items-center justify-between text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2  transition-opacity"
                style={{ borderColor: PrimaryColor }}
                onClick={() => toggleCategory(group.category)}
              >
                <span>{`${group.category} (${group.items.length})`}</span>
                <FiChevronDown
                  className={`transform transition-transform ${collapsedCategories[group.category] ? "-rotate-90" : ""
                    }`}
                />
              </button>
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-300 ${collapsedCategories[group.category] ? "hidden" : ""
                  }`}
              >
                {group.items.map((item) => (
                  <ModernProductCard key={item.itemId} item={item} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <FiShoppingBag className="text-6xl mb-4" />
            <h3 className="text-xl font-medium mb-2">No items found</h3>
            <p className="text-center">
              Try changing your filters or search criteria to find what you're looking for.
            </p>
          </div>
        )}
      </div>
    );
  };

  const orderIdInStorage = JSON.parse(localStorage.getItem("orderId"));

  return (
    <div className="bg-gray-50 min-h-screen relative">
      <FrontProduct
        productTagline={productTagline}
        handleSearch={handleSearch}
        handleSearchInputChange={handleSearchInputChange}
        searchTerm={searchTerm}
        suggestions={suggestions}
        setSearchTerm={setSearchTerm}
        setSuggestions={setSuggestions}
      />

      <div className="sticky top-0 bg-white shadow-md p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors w-[120px] justify-between"
                style={{ backgroundColor: PrimaryColor }}
                onClick={toggleDropdown}
              >
                <div className="flex items-center gap-2">
                  {vegFilter === "Veg" ? (
                    <div className="w-4 h-4 border border-green-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  ) : vegFilter === "NonVeg" ? (
                    <div className="w-4 h-4 border border-red-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                  ) : null}
                  <span>{vegFilter}</span>
                </div>
                <FiChevronDown
                  className={`transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isDropdownOpen && (
                <ul className="absolute left-0 w-[120px] bg-white rounded-lg mt-1 shadow-lg z-50 overflow-hidden">
                  <li
                    className="px-4 py-3 cursor-pointer hover:bg-gray-100 flex items-center gap-2"
                    onClick={() => {
                      setVegFilter("All");
                      setIsDropdownOpen(false);
                    }}
                  >
                    <span>All</span>
                  </li>
                  <li
                    className="px-4 py-3 cursor-pointer hover:bg-gray-100 flex items-center gap-2"
                    onClick={() => {
                      setVegFilter("Veg");
                      setIsDropdownOpen(false);
                    }}
                  >
                    <div className="w-4 h-4 border border-green-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                    <span>Veg</span>
                  </li>
                  <li
                    className="px-4 py-3 cursor-pointer hover:bg-gray-100 flex items-center gap-2"
                    onClick={() => {
                      setVegFilter("NonVeg");
                      setIsDropdownOpen(false);
                    }}
                  >
                    <div className="w-4 h-4 border border-red-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                    <span>Non-Veg</span>
                  </li>
                </ul>
              )}
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={() => setIsModalOpen(true)}
            >
              <FiFilter />
              <span>Filters</span>
            </button>
            {(userData.cognitoId || orderIdInStorage )&&(userData.userType !== "waiter") && (
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors sm:hidden"
                style={{ borderColor: PrimaryColor, color: PrimaryColor }}
                onClick={handleOrderButtonClick}
              >
                <FiShoppingBag />
                <span>Your Order</span>
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-3">
            {isButtonVisible && (
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white transition-colors relative"
                style={{ backgroundColor: PrimaryColor }}
                onClick={handleViewCartClick}
              >
                <FiShoppingCart />
                <span>View Cart</span>
                {cartItems.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                    {cartItems.length}
                  </span>
                )}
              </button>
            )}
            {(userData.cognitoId || orderIdInStorage )&&(userData.userType !== "waiter") && (
              <button
                className="px-4 py-2 rounded-lg border-2 transition-colors flex items-center gap-2"
                style={{ borderColor: PrimaryColor, color: PrimaryColor }}
                onClick={handleOrderButtonClick}
              >
                <FiShoppingBag />
                <span>Your Order</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <ProductGridView groupedItems={groupedItems} />

      {isButtonVisible && (
        <button
          className="sm:hidden fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-2 rounded-full text-white transition-colors shadow-lg"
          style={{ backgroundColor: PrimaryColor }}
          onClick={handleViewCartClick}
        >
          <FiShoppingCart />
          <span>View Cart</span>
          {cartItems.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {cartItems.length}
            </span>
          )}
        </button>
      )}

      {isModalOpen && (
        <FilterPopup
          categories={categories}
          setCategoryFilter={setCategoryFilter}
          categoryFilter={categoryFilter}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          applyFilters={() => {
            setIsModalOpen(false);
            setIsSearchClicked(true);
          }}
          setIsModalOpen={setIsModalOpen}
          allCategories={allCategories} // Pass all categories
        />
      )}
      {isPopupOpen && <OrderPopup setIsPopupOpen={setIsPopupOpen} isPopupOpen={isPopupOpen} />}

      {isCartPopupOpen && (
        <ViewCartPopUp
          isOpen={isCartPopupOpen}
          closePopup={() => setIsCartPopupOpen(false)}
          onOrderPlaced={handleOrderPlaced}
          cartItems={cartItems}
          updateCartItems={updateCartItems}
          name={name}
          setName={setName}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
        />
      )}

      {showPaymentPopup && currentOrderId && (
        <PaymentPopup
          orderId={currentOrderId}
          institution={institution}
          onClose={() => setShowPaymentPopup(false)}
        />
      )}
    </div>
  );
};

export default Product;
