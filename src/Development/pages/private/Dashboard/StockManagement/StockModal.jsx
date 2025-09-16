import { useEffect, useState } from "react";

const StockModal = ({
  showModal,
  editMode,
  form,
  handleFormChange,
  handleSubmit,
  setShowModal,
  setForm,
  modalLoading,
  institutionData,
  stocks = [],
}) => {
  const units = ["ml", "l", "g", "kg", "piece"];
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  // Sentinel value for custom category option to avoid collision with a real "Other" category
  const CUSTOM_CATEGORY_VALUE = "__CUSTOM__";

  const categories = Array.from(
    new Set(
      [
        ...( (stocks || institutionData?.stock || [])
            .filter(item => item?.type === "bar" && item?.category)
            .map(item => (item.category || "").trim())
        || []),
        ...(editMode && form.category && form.type === "bar" ? [form.category] : []),
      ].filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

useEffect(() => {

    if (!editMode) {
      if (form.type === "cafe" && !["kg", "g", "piece"].includes(form.unit)) {
        setForm((prev) => ({ ...prev, unit: "kg" }));
      } else if (form.type === "bar" && !["l", "ml"].includes(form.unit)) {
        setForm((prev) => ({ ...prev, unit: "l" }));
      }
    }

    // Set default bottle unit for bar
    if (form.type === "bar" && !form.oneBottleUnit) {
      setForm((prev) => ({ ...prev, oneBottleUnit: "ml" }));
    }

    // When editing, split oneBottleVolume into num and unit
    if (editMode && form.type === "bar" && form.oneBottleVolume) {
      const [num, unit] = form.oneBottleVolume.split(" ");
      if (num && unit) {
        setForm((prev) => ({
          ...prev,
          oneBottleVolumeNum: num,
          oneBottleUnit: unit,
        }));
      }
    }

    // Only control showCustomCategory when in edit mode and we have a category OR when type changes.
    if (form.type === "bar") {
      if (editMode && form.category) {
        setShowCustomCategory(
          form.category === CUSTOM_CATEGORY_VALUE || !categories.includes(form.category)
        );
      }
    } else {
      setShowCustomCategory(false);
    }
  }, [
    form.type,
    editMode,
    form.oneBottleVolume,
    form.category,
    categories,
    setForm,
    stocks,
  ]);

  if (!showModal) return null;

  // Convert value from one unit to another (frontend conversion)
  const unitConversion = (value, fromUnit, toUnit) => {
    const conversionRates = {
      ml: 1,
      l: 1000,
      g: 1,
      kg: 1000,
      piece: 1,
    };
    return (value * conversionRates[fromUnit]) / conversionRates[toUnit];
  };

  // Get the base unit for the type
  const getBaseUnit = (type) => (type === "cafe" ? "g" : "ml");

  const getQuantityNumber = (quantity) => {
    if (typeof quantity === "string") {
      const parts = quantity.split(" ");
      return Number(parts[0]) || 0;
    }
    return Number(quantity) || 0;
  };

  const getQuantityUnit = (quantity, defaultUnit = "kg") => {
    if (typeof quantity === "string") {
      const parts = quantity.split(" ");
      return parts[1] || defaultUnit;
    }
    return defaultUnit;
  };

  const handleCategoryChange = (e) => {
    const value = e.target.value;
    const isCustom = value === CUSTOM_CATEGORY_VALUE;
    setShowCustomCategory(isCustom);
    // If user chose Other, mark category sentinel and keep customCategory separate
    setForm((prev) => ({
      ...prev,
      category: isCustom ? CUSTOM_CATEGORY_VALUE : value,
      // don't overwrite existing customCategory here
    }));
  };

  const handleCustomCategoryChange = (e) => {
    const custom = e.target.value;
    // store typed custom category in a separate field
    setForm((prev) => ({
      ...prev,
      customCategory: custom,
      // do not modify prev.category (it should remain the sentinel while typing)
    }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const updatedForm = { ...form };
    const baseUnit = getBaseUnit(form.type);

    // Convert to base unit before sending to backend
    let finalQuantity;
    const inputQuantity = getQuantityNumber(form.quantity);
    const inputUnit = getQuantityUnit(form.quantity, form.unit);
    if (inputUnit !== baseUnit && inputUnit !== "piece") {
      finalQuantity = unitConversion(inputQuantity, inputUnit, baseUnit);
    } else {
      finalQuantity = inputQuantity;
    }
    updatedForm.quantity = `${finalQuantity} ${inputUnit === "piece" ? "piece" : baseUnit}`;
    updatedForm.unit = inputUnit === "piece" ? "piece" : baseUnit;
    if (form.type === "bar") {
      // Always store bottle volume in ml
      let bottleNum = Number(form.oneBottleVolumeNum) || 0;
      let bottleUnit = form.oneBottleUnit || "ml";
      let bottleMl = bottleUnit === "l" ? bottleNum * 1000 : bottleNum;
      updatedForm.oneBottleVolume = `${bottleMl} ml`;

      // Resolve category: if sentinel, use customCategory; otherwise use category
      let finalCategory = updatedForm.category;
      if (finalCategory === CUSTOM_CATEGORY_VALUE) {
        finalCategory = (form.customCategory || "").trim();
      }

      // if (!finalCategory) {
      //   alert("Category is required for bar items");
      //   return;
      // }
      updatedForm.category = finalCategory;
      // remove customCategory field before submit if you don't want it in payload
      delete updatedForm.customCategory;
    } else {
      // Remove category for cafe
      delete updatedForm.category;
      delete updatedForm.customCategory;
    }

    handleSubmit(e, updatedForm);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden border border-gray-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              {editMode ? "Edit Stock" : "Add Stock"}
            </h2>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              onClick={() => setShowModal(false)}>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <form onSubmit={onSubmit}>
            <div className="space-y-5">
              {/* Stock Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Name
                </label>
                <input
                  type="text"
                  name="stockName"
                  value={form.stockName || ""}
                  onChange={handleFormChange}
                  className="border border-gray-300 px-3 py-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  required
                />
              </div>

              {/* Quantity + Unit */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={getQuantityNumber(form.quantity) || ""}
                    onChange={handleFormChange}
                    className="border border-gray-300 px-3 py-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    min={0}
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <select
                    name="unit"
                    value={getQuantityUnit(form.quantity, form.unit) || form.unit}
                    onChange={handleFormChange}
                    className="border border-gray-300 px-3 py-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm">
                    {form.type === "cafe" ? (
                      <>
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="l">l</option>
                        <option value="piece">piece</option>
                      </>
                    ) : (
                      <>
                        <option value="ml">ml</option>
                        <option value="l">l</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Type */}
              {institutionData?.bar_integration === "Yes" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    name="type"
                    value={form.type || "cafe"}
                    onChange={handleFormChange}
                    className="border border-gray-300 px-3 py-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm bg-white"
                    required>
                    <option value="cafe">Cafe</option>
                    <option value="bar">Bar</option>
                  </select>
                </div>
              )}

              {/* Category (bar only) */}
              {form.type === "bar" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    name="category"
                    value={showCustomCategory ? CUSTOM_CATEGORY_VALUE : (form.category === CUSTOM_CATEGORY_VALUE ? CUSTOM_CATEGORY_VALUE : form.category || "")}
                    onChange={handleCategoryChange}
                    className="border border-gray-300 px-3 py-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    required={form.type === "bar"}
                  >
                    <option value="" disabled>Select a category</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                    <option value={CUSTOM_CATEGORY_VALUE}>Other</option>
                  </select>
                </div>
              )}

              {/* Custom Category Input */}
              {form.type === "bar" && showCustomCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Category
                  </label>
                  <input
                    type="text"
                    name="customCategory"
                    value={form.customCategory || ""}
                    onChange={handleCustomCategoryChange}
                    className="border border-gray-300 px-3 py-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    placeholder="Enter custom category"
                    required
                  />
                </div>
              )}

              {/* One Bottle Volume (bar only) */}
              {form.type === "bar" && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      One Bottle Volume
                    </label>
                    <input
                      type="number"
                      name="oneBottleVolumeNum"
                      value={form.oneBottleVolumeNum || ""}
                      onChange={handleFormChange}
                      className="border border-gray-300 px-3 py-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      min={0}
                      required={form.type === "bar"}
                      placeholder="e.g., 750"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      name="oneBottleUnit"
                      value={form.oneBottleUnit || "ml"}
                      onChange={handleFormChange}
                      className="border border-gray-300 px-3 py-2 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      required={form.type === "bar"}>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 mt-6">
                <button
                  type="button"
                  className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm min-w-[100px] font-medium"
                  onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`bg-primaryColor text-white px-6 py-2 rounded-md hover:bg-primaryColor/90 transition-colors shadow-sm font-medium min-w-[100px] flex items-center justify-center ${
                    modalLoading ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                  disabled={modalLoading}>
                  {modalLoading ? (
                    <span className="flex items-center">
                      <svg
                        className="animate-spin w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          d="M12 2a10 10 0 0 1 10 10"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                      </svg>
                      {editMode ? "Updating..." : "Adding..."}
                    </span>
                  ) : editMode ? (
                    <span>Update</span>
                  ) : (
                    <span className="flex items-center">
                      <svg
                        className="w-5 h-5 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                      Add
                    </span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StockModal;