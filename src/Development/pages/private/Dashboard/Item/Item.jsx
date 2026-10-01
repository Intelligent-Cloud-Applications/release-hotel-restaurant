import React, { useState, useEffect, useContext } from "react";
import { API, Storage } from "aws-amplify";
import { PaginatedTable } from "../../../../common/DataDisplay";
import { Button } from "flowbite-react";
import { Context } from "../../../../Context";
import ItemModal from "./ItemModal";
import currencies from "../../../../common/Inputs/currencies.json";
import { getCurrencySymbol } from "../../../../common/Inputs";
import { MdDeleteForever } from "react-icons/md";
import { FaEdit } from "react-icons/fa";
import { toast } from "react-toastify";
import MenuExtractor from "./MenuTextExtractor";
import { useNavigate } from "react-router-dom";

const Loader = () => (
  <div className="flex flex-col items-center justify-center p-12">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-gray-300 border-t-primaryColor rounded-full animate-spin"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl font-bold">
        🍽️
      </div>
    </div>
    <p className="mt-4 text-primaryColor font-medium">Loading items...</p>
  </div>
);

const isOutOfStockBoolean = (val) => {
  return val === true || val === "true" || val === 1 || val === "1";
};

const Item = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const { institutionData, setItems: setContextItems } = useContext(Context);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState({
    save: false,
    delete: false,
    toggleItemId: null,
  });

  const [showMenu, setShowMenu] = useState(false);
  const [call, setCall] = useState(false);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const [itemData, setItemData] = useState({
    institution: institutionData?.institution || "",
    itemName: "",
    price: 0,
    veg: false,
    category: "Select",
    currency: "INR",
    outOfStock: false,
    description: "",
    itemImage: null,
    type: "cafe",
    materials: [],
  });
  const [categories, setCategories] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleItemGet = async () => {
      if (!institutionData || !institutionData.institution) {
        return;
      }

      setIsLoading(true);
      try {
        const itemsData = await API.get(
          "main",
          `/any/list-items/${institutionData.institution}`,
          {}
        );

        const dbStocks = await API.get(
          "main",
          `/admin/stock-list-items/${institutionData.institution}`
        );
        setStocks(dbStocks);

        const updatedItems = itemsData
          .filter((item) => item.itemId && item.itemId !== "undefined")
          .map((item) => ({
            ...item,
            outOfStock: isOutOfStockBoolean(item.outOfStock),
          }));

        console.log("Updated items:", updatedItems);

        setItems(updatedItems);
        if (setContextItems) {
          setContextItems(updatedItems);
        }
        const uniqueCategories = [
          ...new Set(updatedItems.map((item) => item.category).filter(Boolean)),
        ];
        console.log("Unique categories:", uniqueCategories);

        setCategories(uniqueCategories);
      } catch (error) {
        console.error("Error fetching items:", error);
      } finally {
        setIsLoading(false);
      }
    };

    handleItemGet();
  }, [institutionData, call]);

  const handleToggleStock = async (itemId) => {
    console.log("Toggling stock for item ID:", itemId);
    if (!itemId) {
      console.error("Invalid itemId:", itemId);
      return;
    }

    const currentItem = items.find((item) => item.itemId === itemId);

    if (!currentItem) {
      console.error("Item not found for id:", itemId);
      return;
    }

    setIsProcessing((prev) => ({ ...prev, toggleItemId: itemId }));

    const isCurrentlyOOS = isOutOfStockBoolean(currentItem.outOfStock);
    const updatedItem = {
      ...currentItem,
      outOfStock: !isCurrentlyOOS,
    };

    setItems((prevItems) => {
      const nextItems = prevItems.map((item) =>
        item.itemId === itemId ? updatedItem : item
      );
      if (setContextItems) setContextItems(nextItems);
      return nextItems;
    });

    try {
      localStorage.removeItem("cafeItems");
    } catch (e) {
      console.error("Failed to remove cafeItems from localStorage:", e);
    }

    try {
      await API.put(
        "main",
        `/admin/update-item/${institutionData.institution}/${itemId}`,
        {
          body: updatedItem,
        }
      );
      console.log(`Stock status successfully updated for item ${itemId}`);
    } catch (error) {
      console.error("Failed to update stock status:", error);

      setItems((prevItems) => {
        const revertedItems = prevItems.map((item) =>
          item.itemId === itemId ? currentItem : item
        );
        if (setContextItems) setContextItems(revertedItems);
        return revertedItems;
      });

      toast.error("Failed to update stock status. Please try again.");
    } finally {
      setIsProcessing((prev) => ({ ...prev, toggleItemId: null }));
    }
  };

  const handleEdit = (item) => {
    setCurrentItem(item);
    setIsEditMode(true);
    setShowModal(true);
  };

  const handleAdd = () => {
    setCurrentItem(null);
    setIsEditMode(false);
    setItemData({
      itemName: "",
      price: 0,
      veg: false,
      category: "Select",
      currency: "INR",
      outOfStock: false,
      institution: institutionData.institution,
      description: "",
      itemImage: null,
      type: "cafe",
      materials: [],
    });
    setShowModal(true);
  };

  const handleSave = async (itemData) => {
    if (
      !itemData.itemName ||
      itemData.price <= 0 ||
      !itemData.category ||
      itemData.category === "Select"
    ) {
      toast.info(
        "Please fill in all required fields: Name, Price, and Category."
      );
      return;
    }

    setIsProcessing((prev) => ({ ...prev, save: true }));

    try {
      const submissionData = { ...itemData };
      // Only format itemName for type 'bar'
      if (
        submissionData.type === "bar" &&
        submissionData.materials &&
        submissionData.materials.length > 0
      ) {
        const mat = submissionData.materials[0];
        // Remove any previous material info from itemName
        let baseName = submissionData.itemName.replace(/\s*\(.*\)$/, "").trim();
        submissionData.itemName = `${baseName} (${mat.quantity})`;
      }
      console.log(`Final submission data:`, submissionData);

      if (isEditMode) {
        if (
          currentItem.imageUrl &&
          currentItem.imageUrl !== submissionData.imageUrl
        ) {
          try {
            const oldImageKey = currentItem.imageUrl
              .split("/")
              .slice(-2)
              .join("/");
            await Storage.remove(oldImageKey, { level: "public" });
          } catch (error) {
            console.error("Error deleting old image from S3:", error);
          }
        }

        if (currentItem.imageUrl === submissionData.imageUrl) {
          delete submissionData.imageUrl;
        }

        const updatedItems = items.map((item) =>
          item.itemId === currentItem.itemId
            ? { ...item, ...submissionData, itemId: currentItem.itemId }
            : item
        );
        setItems(updatedItems);
        if (setContextItems) setContextItems(updatedItems);
        try {
          localStorage.removeItem("cafeItems");
        } catch (e) {}

        const response = await API.put(
          "main",
          `/admin/update-item/${institutionData.institution}/${currentItem.itemId}`,
          {
            body: submissionData,
          }
        );

        console.log(`Item "${submissionData.itemName}" updated successfully`);
        console.log("Response", response);
      } else {
        console.log(`Creating new item:`, submissionData);
        const response = await API.post(
          "main",
          `/admin/create-item/${institutionData.institution}`,
          {
            body: [submissionData],
          }
        );

        console.log("Response", response);

        const itemsData = await API.get(
          "main",
          `/any/list-items/${institutionData.institution}`,
          {}
        );

        const updatedItems = itemsData
          .filter((item) => item.itemId && item.itemId !== "undefined")
          .map((item) => ({
            ...item,
            outOfStock: isOutOfStockBoolean(item.outOfStock),
          }));

        setItems(updatedItems);
        if (setContextItems) setContextItems(updatedItems);
        try {
          localStorage.removeItem("cafeItems");
        } catch (e) {}

        if (!categories.includes(submissionData.category)) {
          setCategories((prev) => [...prev, submissionData.category]);
        }

        console.log(
          `New item "${submissionData.itemName}" created successfully`
        );
      }

      setShowModal(false);

      return true;
    } catch (error) {
      console.error("Error saving item:", error);

      try {
        const itemsData = await API.get(
          "main",
          `/any/list-items/${institutionData.institution}`,
          {}
        );

        const updatedItems = itemsData
          .filter((item) => item.itemId && item.itemId !== "undefined")
          .map((item) => ({
            ...item,
            outOfStock: isOutOfStockBoolean(item.outOfStock),
          }));

        setItems(updatedItems);
        if (setContextItems) setContextItems(updatedItems);
      } catch (refreshError) {
        console.error("Error refreshing items list:", refreshError);
      }

      throw error;
    } finally {
      setIsProcessing((prev) => ({ ...prev, save: false }));
    }
  };

  const handleDelete = async (itemId) => {
    if (!itemId) {
      console.error("Invalid itemId:", itemId);
      return;
    }

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this item?"
    );
    if (!confirmDelete) return;

    setIsProcessing((prev) => ({
      ...prev,
      delete: true,
      deleteItemId: itemId,
    }));

    const itemToDelete = items.find((item) => item.itemId === itemId);

    setItems((prevItems) => {
      const nextItems = prevItems.filter((item) => item.itemId !== itemId);
      if (setContextItems) setContextItems(nextItems);
      return nextItems;
    });

    try {
      localStorage.removeItem("cafeItems");
    } catch (e) {}

    try {
      if (itemToDelete && itemToDelete.imageUrl) {
        try {
          const imageKey = itemToDelete.imageUrl.split("/").slice(-2).join("/");
          await Storage.remove(imageKey, { level: "public" });
        } catch (error) {
          console.error("Error deleting image from S3:", error);
        }
      }

      await API.del(
        "main",
        `/admin/delete-item/${institutionData.institution}/${itemId}`
      );

      console.log(`Item deleted successfully`);
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete item. Please try again.");

      try {
        const itemsData = await API.get(
          "main",
          `/any/list-items/${institutionData.institution}`,
          {}
        );

        const updatedItems = itemsData
          .filter((item) => item.itemId && item.itemId !== "undefined")
          .map((item) => ({
            ...item,
            outOfStock: isOutOfStockBoolean(item.outOfStock),
          }));

        setItems(updatedItems);
        if (setContextItems) setContextItems(updatedItems);
      } catch (refreshError) {
        console.error("Error refreshing items list:", refreshError);

        if (itemToDelete) {
          setItems((prevItems) => {
            const reverted = [...prevItems, itemToDelete];
            if (setContextItems) setContextItems(reverted);
            return reverted;
          });
        }
      }
    } finally {
      setIsProcessing((prev) => ({
        ...prev,
        delete: false,
        deleteItemId: null,
      }));
    }
  };

  const filteredItems = items.filter((item) =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const head = [
    "Item Name",
    "Price",
    "Category",
    "Veg/Non-Veg",
    "Stock",
    "Description",
    "",
  ];

  return showMenu ? (
    <MenuExtractor setShowMenu={setShowMenu} setCall={setCall} call={call} />
  ) : (
    <div className="w-full p-8 rounded-lg">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">
        Items Management
      </h1>
      <div className="flex flex-col items-center space-y-4 lg:flex-row lg:justify-between lg:items-center mb-6">
        <div className="flex gap-3">
          <Button
            onClick={handleAdd}
            className="bg-primaryColor text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
            disabled={isProcessing.save}>
            {isProcessing.save ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Processing...
              </div>
            ) : (
              "Add Item"
            )}
          </Button>
          <Button
            onClick={() => setShowMenu(true)}
            className="bg-primaryColor text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto">
            Upload Menu Image
          </Button>
        </div>

        <div className="w-full max-w-md lg:max-w-xs">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="px-3 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-primaryColor focus:border-transparent text-sm lg:text-base"
          />
        </div>
      </div>
      {isLoading ? (
        <Loader message="Loading items data..." />
      ) : (
        <>
          {filteredItems.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-6xl text-gray-300 mb-4">🍽️</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                No items found
              </h2>
              <p className="text-gray-500">
                Click "Add Item" to start adding products to your menu.
              </p>
            </div>
          ) : screenWidth > 1025 ? (
            <div className="overflow-x-auto">
              <PaginatedTable
                head={head}
                data={filteredItems.map((item) => [
                  item.itemName,
                  `${getCurrencySymbol(item.currency)}${item.price}`,
                  item.category,
                  item.veg ? "Veg" : "Non-Veg",
                  <div className="flex flex-col items-start gap-1">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={!isOutOfStockBoolean(item.outOfStock)}
                        onChange={() => {
                          if (
                            item.itemId &&
                            isProcessing.toggleItemId === null
                          ) {
                            handleToggleStock(item.itemId);
                          } else {
                            console.error(
                              "Item ID is missing or action in progress"
                            );
                          }
                        }}
                        disabled={isProcessing.toggleItemId !== null}
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full dark:bg-gray-700 peer-checked:bg-blue-600">
                        <div className="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                      </div>
                    </label>
                    <span
                      className={`text-sm font-semibold ${
                        isOutOfStockBoolean(item.outOfStock) ? "text-red-500" : "text-green-500"
                      }`}>
                      {isProcessing.toggleItemId === item.itemId ? (
                        <span className="flex items-center">
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                          Updating...
                        </span>
                      ) : isOutOfStockBoolean(item.outOfStock) ? (
                        "Out of Stock"
                      ) : (
                        "In Stock"
                      )}
                    </span>
                  </div>,
                  item.description || "-",
                  <div className="gap-2 justify-between max478:mt-4">
                    <div className="flex gap-2">
                      <div
                        onClick={() => !isProcessing.save && handleEdit(item)}
                        className={`text-primaryColor text-2xl ${
                          isProcessing.save
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer"
                        }`}>
                        <FaEdit />
                      </div>
                      <div
                        onClick={() =>
                          !isProcessing.delete && handleDelete(item.itemId)
                        }
                        className={`text-red-600 text-2xl ${
                          isProcessing.delete
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer"
                        }`}>
                        {isProcessing.deleteItemId === item.itemId ? (
                          <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <MdDeleteForever />
                        )}
                      </div>
                    </div>
                  </div>,
                ])}
                className="bg-white shadow rounded-lg"
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                searchQuery={searchQuery}
              />
            </div>
          ) : (
            <>
              {filteredItems.map((item) => (
                <div
                  key={item.itemId}
                  className="mb-4 p-4 bg-secondaryColor shadow rounded-lg flex flex-col gap-4">
                  <div className="flex justify-between">
                    <h2 className="text-lg font-semibold">{item.itemName}</h2>
                    <div className="flex gap-2">
                      <button
                        className={`text-primaryColor ${
                          isProcessing.save
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                        onClick={() => !isProcessing.save && handleEdit(item)}
                        disabled={isProcessing.save}>
                        <FaEdit size={20} />
                      </button>
                      <button
                        className={`text-red-600 ${
                          isProcessing.delete
                            ? "opacity-50 cursor-not-allowed"
                            : ""
                        }`}
                        onClick={() =>
                          !isProcessing.delete && handleDelete(item.itemId)
                        }
                        disabled={isProcessing.delete}>
                        {isProcessing.deleteItemId === item.itemId ? (
                          <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <MdDeleteForever size={20} />
                        )}
                      </button>
                    </div>
                  </div>

                  {item.imageUrl && (
                    <div className="flex justify-center">
                      <img
                        src={item.imageUrl}
                        alt={item.itemName}
                        className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                      />
                    </div>
                  )}

                  <p className="text-gray-600">
                    Price:{" "}
                    <span className="font-semibold">
                      {getCurrencySymbol(item.currency)}
                      {item.price}
                    </span>
                  </p>
                  <p className="text-gray-600">
                    Type:{" "}
                    <span
                      className={`font-semibold ${
                        item.veg ? "text-green-600" : "text-red-600"
                      }`}>
                      {item.veg ? "Veg" : "Non-Veg"}
                    </span>
                  </p>

                  <p className="text-gray-600">
                    Category:{" "}
                    <span className="font-semibold">{item.category}</span>
                  </p>
                  <p className="text-gray-600">
                    Description:{" "}
                    <span className="font-semibold">
                      {item.description || "-"}
                    </span>
                  </p>

                  <div className="flex justify-between items-center">
                    <span
                      className={`text-sm font-semibold ${
                        isOutOfStockBoolean(item.outOfStock) ? "text-red-500" : "text-green-500"
                      }`}>
                      {isProcessing.toggleItemId === item.itemId ? (
                        <span className="flex items-center">
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></div>
                          Updating...
                        </span>
                      ) : isOutOfStockBoolean(item.outOfStock) ? (
                        "Out of Stock"
                      ) : (
                        "In Stock"
                      )}
                    </span>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={!isOutOfStockBoolean(item.outOfStock)}
                        onChange={() =>
                          item.itemId &&
                          isProcessing.toggleItemId === null &&
                          handleToggleStock(item.itemId)
                        }
                        disabled={isProcessing.toggleItemId !== null}
                      />
                      <div className="relative w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-blue-600">
                        <div className="absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
      <ItemModal
        showModal={showModal}
        setShowModal={setShowModal}
        currentItem={currentItem}
        setItemData={setItemData}
        isEditMode={isEditMode}
        handleSave={handleSave}
        itemData={itemData}
        stocks={stocks}
        setCategories={setCategories}
        categories={categories}
        currencies={currencies}
        institution={institutionData.institution}
        institutionData={institutionData}
        items={items}
      />
    </div>
  );
};

export default Item;
