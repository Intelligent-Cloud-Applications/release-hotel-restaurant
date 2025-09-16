import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  TextInput,
  Label,
  Select,
  FileInput,
  Textarea,
  Spinner,
} from "flowbite-react";
import { Storage, Auth } from "aws-amplify";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { MdDeleteForever } from "react-icons/md";
import { MdAddToPhotos } from "react-icons/md";

const ItemModal = ({
  showModal,
  setShowModal,
  currentItem,
  isEditMode,
  handleSave,
  institution,
  categories,
  stocks,
  currencies,
  setItemData,
  itemData = {},
  institutionData,
  items
}) => {
  const [descriptionError, setDescriptionError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [selectedFoodType, setSelectedFoodType] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [barSizes, setBarSizes] = useState({
    bottle: { volume: "", price: "" },
    large: { volume: "60", price: "" },
    small: { volume: "30", price: "" },
    unit: "ml",
  });

  // ... (rest of the state and useEffect hooks remain unchanged)
  useEffect(() => {
    if (showModal) {
      setIsOtherSelected(false);
      setImageError(null);
      setSelectedFoodType(null);
      setIsSubmitting(false);
      if (!isEditMode) {
        setBarSizes({
          bottle: { volume: "", price: "" },
          large: { volume: "60", price: "" },
          small: { volume: "30", price: "" },
          unit: "ml",
        });
      }
    }

    if (isEditMode && currentItem) {
      let materials = currentItem.materials || [];
      if (currentItem.type === "bar" && materials.length === 0) {
        materials = [{ stockName: "", stockId: "", quantity: "0 ml", unit: "ml" }];
      } else {
        materials = materials.map((mat) => ({
          stockName: mat.stockName || "",
          stockId: mat.stockId || "",
          quantity: mat.quantity || "0 ml",
          unit: mat.unit || "ml",
        }));
      }
      setItemData({
        institution,
        itemName: currentItem.itemName,
        price: currentItem.price,
        veg: currentItem.veg,
        category: currentItem.category || "",
        currency: currentItem.currency || "INR",
        outOfStock: currentItem.outOfStock || false,
        description: currentItem.description || "",
        imageUrl: currentItem.imageUrl || null,
        type: currentItem.type || "cafe",
        materials,
      });
      setSelectedFoodType(
        currentItem.veg === true
          ? "veg"
          : currentItem.veg === false
          ? "non-veg"
          : null
      );
      setImagePreview(currentItem.imageUrl);

      if (currentItem.barSizes) {
        setBarSizes((prev) => ({
          ...prev,
          ...currentItem.barSizes,
          unit: currentItem.barSizes.unit || prev.unit,
        }));
      }

      if (currentItem.type === "bar" && materials.length > 0) {
        const m = materials[0];
        if (!m.quantity) {
          m.quantity = `${barSizes.large.volume || 60} ${barSizes.unit}`;
        }
      }
    }

    if (!isEditMode) {
      setItemData({
        itemName: "",
        price: 0,
        veg: undefined,
        category: "Select",
        currency: "INR",
        outOfStock: false,
        institution,
        description: "",
        itemImage: null,
        imageUrl: null,
        type: "cafe",
        materials: [],
      });
      setSelectedFoodType(null);
      setImagePreview(null);
    }
  }, [currentItem, isEditMode, showModal]);

  useEffect(() => {
    if (itemData.type === "bar") {
      setItemData((prevData) => {
        if (!prevData.materials || prevData.materials.length === 0) {
          return {
            ...prevData,
            materials: [{ stockName: "", stockId: "", quantity: "0 ml", unit: "ml" }],
          };
        }
        return prevData;
      });
    }
  }, [itemData.type]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const updatedValue = name === "price" ? parseFloat(value) || 0 : value;
    if (name === "price" && updatedValue < 0) return;

    if (name === "type") {
      setItemData((prevData) => {
        let newMaterials = prevData.materials;
        if (value === "bar") {
          newMaterials = [{ stockName: "", quantity: "0 ml", unit: "ml" }];
        } else if (value === "cafe") {
          newMaterials = prevData.materials.length > 0 ? prevData.materials : [];
        }
        return {
          ...prevData,
          [name]: value,
          materials: newMaterials,
          veg: value === "bar" ? true : prevData.veg,
        };
      });
      return;
    }

    setItemData((prevData) => ({
      ...prevData,
      [name]: updatedValue,
      veg: prevData.type === "bar" ? true : prevData.veg,
    }));
  };

  const handleCategoryChange = (e) => {
    const { value } = e.target;
    if (value === "Other") {
      setItemData((prevData) => ({
        ...prevData,
        category: "",
        veg: prevData.type === "bar" ? true : prevData.veg,
      }));
      setIsOtherSelected(true);
    } else {
      setItemData((prevData) => ({
        ...prevData,
        category: value,
        veg: prevData.type === "bar" ? true : prevData.veg,
      }));
      setIsOtherSelected(false);
    }
  };

  const handleImageChange = async (event) => {
    const file = event.target.files[0];
    setImageError(null);
    setUploading(true);

    try {
      if (file) {
        const allowedExtensions = ["png", "jpg", "jpeg", "svg"];
        const fileExtension = file.name.split(".").pop().toLowerCase();

        if (!allowedExtensions.includes(fileExtension)) {
          throw new Error("Invalid file format. Only PNG, JPG, JPEG, and SVG are allowed.");
        }

        if (file.size > 5 * 1024 * 1024) {
          throw new Error("Image size must be less than 5MB");
        }

        const currentUser = await Auth.currentAuthenticatedUser();
        const cognitoId = currentUser.attributes.sub;

        const timestamp = new Date().getTime();
        const filename = `${institution}/${cognitoId}/items/${timestamp}-${file.name}`;

        const uploadResult = await Storage.vault.put(filename, file, {
          contentType: file.type,
          level: "public",
          region: "us-east-1",
          ACL: "public-read",
        });

        let imageUrl = await Storage.get(uploadResult.key);
        imageUrl = imageUrl.split("?")[0];

        setImagePreview(imageUrl);
        setItemData((prev) => ({ ...prev, imageUrl }));
      }
    } catch (error) {
      console.error("Error processing image:", error);
      setImageError(error.message || "Error processing image. Please try again.");
      setItemData((prev) => ({ ...prev, imageUrl: null }));
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFoodTypeChange = (value) => {
    setSelectedFoodType(value);
    setItemData((prevData) => ({ ...prevData, veg: value === "veg" }));
  };

  const handleBarSizeChange = (sizeType, field, value) => {
    setBarSizes((prev) => {
      if (field === "volume" && (sizeType === "large" || sizeType === "small")) {
        return prev;
      }
      return {
        ...prev,
        [sizeType]: {
          ...prev[sizeType],
          [field]: value,
        },
      };
    });
  };

  const isFormValid = () => {
    const baseValidation =
      itemData?.itemName?.trim() &&
      (itemData.type === "bar" || selectedFoodType !== null) &&
      itemData.category &&
      itemData.category !== "Select";

    if (itemData.type === "bar") {
      if (isEditMode && currentItem) {
        const hasMaterial =
          !!(itemData.materials?.[0]?.stockName && itemData.materials?.[0]?.stockId) ||
          !!(currentItem.materials?.[0]?.stockName && currentItem.materials?.[0]?.stockId);

        const existingSizesHavePrice = Boolean(
          currentItem?.barSizes &&
            Object.entries(currentItem.barSizes)
              .filter(([k]) => k !== "unit")
              .some(([, s]) => parseFloat(s?.price) > 0)
        );

        const localSizesHavePrice = ["bottle", "large", "small"].some((k) =>
          Boolean(barSizes[k] && parseFloat(barSizes[k].price) > 0)
        );

        const fallbackSinglePrice = parseFloat(currentItem?.price) > 0;

        const hasValidSize = existingSizesHavePrice || localSizesHavePrice || fallbackSinglePrice;

        return Boolean(baseValidation && hasMaterial && hasValidSize);
      }

      const hasValidSize = ["bottle", "large", "small"].some((k) => {
        const s = barSizes[k];
        return s && parseFloat(s.price) > 0;
      });
      const hasMaterial = !!(itemData.materials?.[0]?.stockName && itemData.materials?.[0]?.stockId);
      return Boolean(baseValidation && hasValidSize && hasMaterial);
    } else {
      return Boolean(baseValidation && itemData.price > 0);
    }
  };

  const validateForm = () => {
    if (!itemData.itemName.trim()) {
      toast.info("Please enter an item name");
      return false;
    }

    if (itemData.type !== "bar" && selectedFoodType === null) {
      toast.info("Please select food type (Veg/Non-veg)");
      return false;
    }

    if (!itemData.category || itemData.category === "Select") {
      toast.info("Please select or enter a category");
      return false;
    }

    if (itemData.type === "bar") {
      if (!itemData.materials?.[0]?.stockName || !itemData.materials?.[0]?.stockId) {
        toast.info("Please select a valid stock material for bar item");
        return false;
      }
      const validSizes = ["bottle", "large", "small"].filter((key) => {
        const s = barSizes[key];
        return s && parseFloat(s.price) > 0;
      });
      if (validSizes.length === 0 && !isEditMode) {
        toast.info("Please configure at least one size (bottle, large, or small) with price");
        return false;
      }
    } else {
      if (itemData.price <= 0) {
        toast.info("Price must be greater than zero");
        return false;
      }
    }
    return true;
  };

  const convertToBaseUnit = (value, fromUnit, type) => {
    if (type === "cafe") {
      if (fromUnit === "kg") return value * 1000;
      if (fromUnit === "g") return value;
      if (fromUnit === "l") return value * 1000;
      if (fromUnit === "ml") return value;
      if (fromUnit === "piece") return value; 
      return value;
    } else {
      if (fromUnit === "l") return value * 1000;
      if (fromUnit === "ml") return value;
      return value;
    }
  };

  const sanitizeNameBase = (name) => {
    return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  };

  const buildSizedName = (base, sizeType, vol, unit) => {
    const niceType = sizeType.charAt(0).toUpperCase() + sizeType.slice(1);
    return `${sanitizeNameBase(base)} (${niceType} - ${vol} ${unit})`;
  };

 
  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Check for duplicate item name
    if (!isEditMode) {
      const sanitizedItemName = sanitizeNameBase(itemData.itemName).toLowerCase();
      const isDuplicate = items.some(
        (item) =>
          sanitizeNameBase(item.itemName).toLowerCase() === sanitizedItemName &&
          (!isEditMode || item.itemId !== currentItem?.itemId)
      );
      if (isDuplicate) {
        toast.error("An item with this name already exists. Please use a different name.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (itemData.type === "bar") {
        if (isEditMode && currentItem) {
          const bs = currentItem.barSizes || {};
          const sizeKeys = Object.keys(bs).filter((k) => k !== "unit");
          const sizeType = sizeKeys.length > 0 ? sizeKeys[0] : "bottle";

          const materialQty = (itemData.materials && itemData.materials[0] && itemData.materials[0].quantity) || "0 ml";
          const [volStr, unit] = materialQty.split(" ");
          const vol = volStr || (bs[sizeType] && bs[sizeType].volume) || "0";
          const price = currentItem.price || (bs[sizeType] && bs[sizeType].price) || 0;

          const sizeItemData = {
            ...itemData,
            itemId: currentItem.itemId || currentItem.id || null,
            itemName: buildSizedName(itemData.itemName || currentItem.itemName, sizeType, vol, unit || barSizes.unit),
            price: parseFloat(price),
            materials: itemData.materials.map((mat) => ({
              ...mat,
              quantity: `${vol} ${unit || barSizes.unit}`,
            })),
            barSizes: {
              ...bs,
              unit: unit || barSizes.unit,
              [sizeType]: { volume: vol, price: parseFloat(price) },
            },
          };

          await handleSave(sizeItemData);
        } else {
          const validSizes = Object.entries(barSizes).filter(([key, size]) => (key === "unit") ? false : parseFloat(size.price) > 0);

          for (const [sizeType, sizeData] of validSizes) {
            const vol = (sizeData.volume || "").toString().replace(/[^0-9.]/g, "") || "0";
            const quantityString = `${vol} ${barSizes.unit}`;

            const sizeItemData = {
              ...itemData,
              itemName: `${itemData.itemName} (${sizeType.charAt(0).toUpperCase() + sizeType.slice(1)} - ${vol} ${barSizes.unit})`,
              price: parseFloat(sizeData.price),
              materials: itemData.materials.map((mat) => ({
                ...mat,
                quantity: quantityString,
              })),
              barSizes: {
                [sizeType]: { volume: vol, price: parseFloat(sizeData.price) },
                unit: barSizes.unit,
              },
            };

            await handleSave(sizeItemData);
          }
        }
      } else {
        const baseUnit = itemData.type === "cafe" ? "g" : "ml";
        const convertedMaterials = (itemData.materials || []).map((mat) => {
          const [qtyStr, unit] = (mat.quantity || "").split(" ");
          const qtyNum = Number(qtyStr) || 0;
          const convertedQty = convertToBaseUnit(qtyNum, unit, itemData.type);
          return {
            stockName: mat.stockName,
            stockId: mat.stockId,
            quantity: `${convertedQty} ${baseUnit}`,
            unit: baseUnit,
          };
        });
        const submissionData = { ...itemData, materials: convertedMaterials };
        await handleSave(submissionData);
      }
    } catch (error) {
      console.error("Error saving item:", error);
      toast.error("Failed to save item: " + (error.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setShowModal(false);
    setIsOtherSelected(false);
    setSelectedFoodType(null);
  };

  const renderBarSizesSection = () => {
    if (itemData.type !== "bar") return null;
    if (isEditMode) return null;

    return (
      <div className="mb-4 p-4 border border-gray-200 rounded-lg">
        <Label value="Size Configuration *" className="mb-2 font-medium" />
        <p className="text-sm text-gray-600 mb-3">
          Presets: Large = 60 ml, Small = 30 ml. Bottle volume is editable. Only fill prices.
        </p>

        <div className="mb-3">
          <Label value="Bottle" className="mb-1 text-sm font-medium" />
          <div className="grid grid-cols-3 gap-2">
            <TextInput
              placeholder="Volume (numeric)"
              value={barSizes.bottle.volume}
              onChange={(e) => handleBarSizeChange("bottle", "volume", e.target.value.replace(/[^0-9.]/g, ""))}
              disabled={isSubmitting}
            />
            <TextInput placeholder="Unit" value={barSizes.unit} disabled />
            <TextInput
              type="number"
              placeholder="Price (INR)"
              value={barSizes.bottle.price}
              onChange={(e) => handleBarSizeChange("bottle", "price", e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="mb-3">
          <Label value="Large (preset)" className="mb-1 text-sm font-medium" />
          <div className="grid grid-cols-3 gap-2">
            <TextInput value={barSizes.large.volume} disabled />
            <TextInput value={barSizes.unit} disabled />
            <TextInput
              type="number"
              placeholder="Price (INR)"
              value={barSizes.large.price}
              onChange={(e) => handleBarSizeChange("large", "price", e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="mb-3">
          <Label value="Small (preset)" className="mb-1 text-sm font-medium" />
          <div className="grid grid-cols-3 gap-2">
            <TextInput value={barSizes.small.volume} disabled />
            <TextInput value={barSizes.unit} disabled />
            <TextInput
              type="number"
              placeholder="Price (INR)"
              value={barSizes.small.price}
              onChange={(e) => handleBarSizeChange("small", "price", e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderMaterialsSection = () => {
    if (itemData.type === "bar") {
      const material = itemData.materials && itemData.materials.length > 0
        ? itemData.materials[0]
        : { stockName: "", stockId: "", quantity: `0 ${barSizes.unit}`, unit: barSizes.unit };

      const qtyParts = (material.quantity || `0 ${barSizes.unit}`).split(" ");
      const qtyNumber = qtyParts[0] || "0";
      const qtyUnit = qtyParts[1] || barSizes.unit;

      return (
        <div className="mb-4">
          <Label value="Select Stock Material *" className="mb-1" />
          <Select
            value={material.stockName}
            onChange={(e) => {
              const selectedStock = stocks.find((stock) => stock.stockName === e.target.value);
              const updatedMaterials = [{
                ...material,
                stockName: e.target.value,
                stockId: selectedStock ? selectedStock.stockId : "",
              }];
              setItemData((prevData) => ({ ...prevData, materials: updatedMaterials }));
            }}
            className="w-full"
            disabled={isSubmitting}
          >
            <option value="">Select Stock</option>
            {stocks
              .filter((stock) => stock.type === "bar")
              .map((stock) => (
                <option key={stock.stockId} value={stock.stockName}>
                  {stock.stockName}
                </option>
              ))}
          </Select>

          {isEditMode ? (
            <div className="mt-2 grid grid-cols-3 gap-2 items-center">
              <TextInput
                type="number"
                placeholder="Volume"
                value={
                  (() => {
                    const q =
                      (itemData.materials && itemData.materials[0] && itemData.materials[0].quantity) ||
                      (currentItem && currentItem.materials && currentItem.materials[0] && currentItem.materials[0].quantity) ||
                      `${barSizes.large.volume || "60"} ${barSizes.unit}`;
                    return q.split(" ")[0] || "0";
                  })()
                }
                onChange={(e) => {
                  let value = e.target.value;
                  if (value === "" || isNaN(Number(value)) || Number(value) < 0) value = "0";
                  const currentUnit =
                    (itemData.materials && itemData.materials[0] && itemData.materials[0].quantity && itemData.materials[0].quantity.split(" ")[1]) ||
                    (currentItem && currentItem.materials && currentItem.materials[0] && currentItem.materials[0].quantity && currentItem.materials[0].quantity.split(" ")[1]) ||
                    barSizes.unit;
                  const updatedMaterials = [{
                    ...(itemData.materials?.[0] || {}),
                    quantity: `${value} ${currentUnit}`,
                  }];
                  setItemData((prevData) => ({ ...prevData, materials: updatedMaterials }));
                }}
                disabled={isSubmitting}
              />
              <Select
                value={
                  (() => {
                    const q =
                      (itemData.materials && itemData.materials[0] && itemData.materials[0].quantity) ||
                      (currentItem && currentItem.materials && currentItem.materials[0] && currentItem.materials[0].quantity) ||
                      `${barSizes.large.volume || "60"} ${barSizes.unit}`;
                    return q.split(" ")[1] || barSizes.unit;
                  })()
                }
                onChange={(e) => {
                  const currentQuantity = (itemData.materials && itemData.materials[0] && itemData.materials[0].quantity && itemData.materials[0].quantity.split(" ")[0]) ||
                                         (currentItem && currentItem.materials && currentItem.materials[0] && currentItem.materials[0].quantity && currentItem.materials[0].quantity.split(" ")[0]) ||
                                         (barSizes.large.volume || "60");
                  const updatedMaterials = [{
                    ...(itemData.materials?.[0] || {}),
                    quantity: `${currentQuantity} ${e.target.value}`,
                  }];
                  setItemData((prevData) => ({ ...prevData, materials: updatedMaterials }));
                }}
                disabled={isSubmitting}
              >
                <option value="ml">ml</option>
                <option value="l">l</option>
              </Select>
              <div className="text-sm text-gray-500">
                Unit is <strong>{barSizes.unit}</strong>. This quantity will be used to update the size when saving in edit mode.
              </div>
            </div>
          ) : null}
        </div>
      );
    } else {
      return (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <Label value="Materials" />
            <button
              type="button"
              onClick={() => {
                const updatedMaterials = [...(itemData.materials || []), { stockName: "", stockId: "", quantity: "0 kg", unit: "kg" }];
                setItemData((prevData) => ({ ...prevData, materials: updatedMaterials }));
              }}
              className="text-primaryColor hover:text-primaryColor/90"
              disabled={isSubmitting}
            >
              <MdAddToPhotos className="inline mr-1 mb-1 w-4 h-4" />
            </button>
          </div>
          {itemData.materials &&
            itemData.materials.map((material, index) => (
              <div key={index} className="flex items-center gap-4 mb-2">
                <Select
                  value={material.stockName}
                  onChange={(e) => {
                    const selectedStock = stocks.find((stock) => stock.stockName === e.target.value);
                    const updatedMaterials = [...itemData.materials];
                    updatedMaterials[index] = {
                      ...updatedMaterials[index],
                      stockName: e.target.value,
                      stockId: selectedStock ? selectedStock.stockId : "",
                    };
                    setItemData((prevData) => ({ ...prevData, materials: updatedMaterials }));
                  }}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  <option value="">Select Stock</option>
                  {stocks
                    .filter((stock) => stock.type === "cafe")
                    .map((stock) => (
                      <option key={stock.stockId} value={stock.stockName}>
                        {stock.stockName}
                      </option>
                    ))}
                </Select>
                <TextInput
                  type="number"
                  placeholder="Quantity"
                  value={
                    isNaN(Number(material.quantity.split(" ")[0])) || material.quantity.split(" ")[0] === "" ? "0" : material.quantity.split(" ")[0]
                  }
                  onChange={(e) => {
                    let value = e.target.value;
                    if (value === "" || isNaN(Number(value)) || Number(value) < 0) {
                      value = "0";
                    }
                    const currentUnit = material.quantity.split(" ")[1] || "kg";
                    const updatedMaterials = [...itemData.materials];
                    updatedMaterials[index].quantity = `${value} ${currentUnit}`;
                    setItemData((prevData) => ({ ...prevData, materials: updatedMaterials }));
                  }}
                  className="flex-1"
                  disabled={isSubmitting}
                />
                <Select
                  value={material.quantity.split(" ")[1] || "kg"}
                  onChange={(e) => {
                    const currentQuantity = material.quantity.split(" ")[0] || "0";
                    const updatedMaterials = [...itemData.materials];
                    updatedMaterials[index].quantity = `${currentQuantity} ${e.target.value}`;
                    setItemData((prevData) => ({ ...prevData, materials: updatedMaterials }));
                  }}
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="piece">piece</option> 
                </Select>
                <button
                  type="button"
                  onClick={() => {
                    const updatedMaterials = itemData.materials.filter((_, i) => i !== index);
                    setItemData((prevData) => ({ ...prevData, materials: updatedMaterials }));
                  }}
                  className="text-red-500 hover:text-red-700"
                  disabled={isSubmitting}
                >
                  <MdDeleteForever className="w-5 h-5" />
                </button>
              </div>
            ))}
        </div>
      );
    }
  };

  return (
    <Modal show={showModal} size="lg" onClose={closeModal} popup dismissible={!isSubmitting}>
      <div className="relative">
        <button onClick={closeModal} disabled={isSubmitting} className={`absolute right-4 top-4 text-gray-500 ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:text-gray-700"}`}>
          <X size={24} />
        </button>
        <div className="flex flex-row justify-center">
          <h2 className="text-xl font-semibold mt-6">{isEditMode ? "Edit Item" : "Add Item"}</h2>
        </div>
      </div>

      <Modal.Body>
        <div className="px-4 py-2">
          {institutionData?.bar_integration === "Yes" && (
            <div className="mb-4">
              <Label htmlFor="type" value="Type *" className="mb-1" />
              <Select id="type" name="type" value={itemData.type || "cafe"} onChange={handleInputChange} disabled={isSubmitting}>
                <option value="cafe">Cafe</option>
                <option value="bar">Bar</option>
              </Select>
            </div>
          )}

          <div className="mb-4">
            <Label htmlFor="itemName" value="Item Name *" className="mb-1" />
            <TextInput
              id="itemName"
              name="itemName"
              placeholder="Enter the item name"
              value={itemData.itemName || ""}
              onChange={(e) => {
                const value = e.target.value.replace(/[^a-zA-Z0-9\s]/g, "").slice(0, 100);
                handleInputChange({ target: { name: "itemName", value } });
              }}
              required
              disabled={isSubmitting}
            />
          </div>

          {renderMaterialsSection()}

          {renderBarSizesSection()}

          <div className="mb-4">
            <Label htmlFor="description" value="Description (Optional)" className="mb-1" />
            <Textarea id="description" name="description" placeholder="Enter item description" value={itemData.description || ""} onChange={handleInputChange} rows={3} disabled={isSubmitting} />
          </div>

          <div className="mb-4">
            <Label htmlFor="itemImage" value="Item Image (Optional)" className="mb-1" />
            <FileInput id="itemImage" accept="image/*" onChange={handleImageChange} helperText="Maximum file size: 5MB" disabled={uploading || isSubmitting} />
            {uploading && (
              <div className="flex items-center mt-2 text-sm text-blue-600">
                <Spinner size="sm" className="mr-2" />
                Uploading image...
              </div>
            )}
            {imageError && <p className="text-red-500 text-sm mt-1">{imageError}</p>}
            {imagePreview && (
              <div className="mt-2 flex items-end gap-2">
                <img src={imagePreview} alt="Item preview" className="w-32 h-32 object-cover rounded-lg border border-gray-200" />
                {!isSubmitting && (
                  <button onClick={() => { setImagePreview(null); setItemData((prev) => ({ ...prev, imageUrl: null })); }} className="text-red-500 text-sm mb-2 hover:underline focus:outline-none" type="button">Remove image</button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {itemData.type === "cafe" && (
              <div>
                <Label htmlFor="price" value="Price * (in INR)" className="mb-1" />
                <TextInput id="price" name="price" type="number" value={itemData.price || ""} onChange={handleInputChange} required disabled={isSubmitting} className="w-full" />
              </div>
            )}

            {itemData.type === "cafe" && (
              <div>
                <Label value="Food Type *" className="mb-1" />
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center">
                    <input type="radio" id="foodTypeVeg" name="foodType" checked={selectedFoodType === "veg"} onChange={() => handleFoodTypeChange("veg")} className="mr-2" disabled={isSubmitting} />
                    <Label htmlFor="foodTypeVeg" className="text-green-600 font-medium">Veg</Label>
                  </div>
                  <div className="flex items-center">
                    <input type="radio" id="foodTypeNonVeg" name="foodType" checked={selectedFoodType === "non-veg"} onChange={() => handleFoodTypeChange("non-veg")} className="mr-2" disabled={isSubmitting} />
                    <Label htmlFor="foodTypeNonVeg" className="text-red-600 font-medium">Non-veg</Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            {!isOtherSelected && (
              <div>
                <Label htmlFor="category" value="Category *" className="mb-1" />
                <Select id="category" name="category" value={itemData.category || ""} onChange={handleCategoryChange} disabled={isSubmitting}>
                  {!isEditMode && <option value="Select" disabled>Select</option>}
                  {categories.length > 0 ? (categories.map((category, index) => (<option key={index} value={category}>{category}</option>))) : (<option disabled>Loading categories...</option>)}
                  <option value="Other">Other</option>
                </Select>
              </div>
            )}

            {isOtherSelected && (
              <div>
                <Label htmlFor="customCategory" value="Custom Category *" className="mb-1" />
                <TextInput id="customCategory" name="category" placeholder="Enter custom category" value={itemData.category || ""} onChange={handleInputChange} required disabled={isSubmitting} />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-row justify-center items-center mt-6">
          <Button onClick={handleSubmit} className={`w-full sm:w-auto ${isFormValid() ? "bg-primaryColor hover:bg-primaryColor/90" : "bg-gray-400"}`} disabled={descriptionError || uploading || isSubmitting || !isFormValid()}>
            {isSubmitting ? (isEditMode ? "Saving..." : "Creating Items...") : isEditMode ? "Save Changes" : (itemData.type === "bar" ? "Create Bar Items" : "Add Item")}
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default ItemModal;