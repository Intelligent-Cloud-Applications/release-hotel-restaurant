import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import { API } from "aws-amplify";
import { Context } from "../../../../Context";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "flowbite-react";
import ReactCrop, { makeAspectCrop } from "react-image-crop";
import { useNavigate } from "react-router-dom";

const MenuExtractor = ({ setShowMenu, setCall, call }) => {
  const navigate = useNavigate();
  const totalSteps = 4;
  const [selectedImage, setSelectedImage] = useState(null);
  const [crop, setCrop] = useState();

  const [completedCrop, setCompletedCrop] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  const [menuItems, setMenuItems] = useState([]);
  const [categoriesInput, setCategoriesInput] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoriesSet, setCategoriesSet] = useState(false);
  const [base64Image, setBase64Image] = useState(null);
  const [mergeImage, setMergeImage] = useState(null);
  const { institutionData, setLoader } = useContext(Context);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showStepsModal, setShowStepsModal] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);

  const toggleCategoryCollapse = (category) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleAddNewCategory = () => {
    // const newCat = prompt("Enter new category name:");
    if (newCategoryName && !categories.includes(newCategoryName)) {
      setCategories([...categories, newCategoryName]);
    }
    setNewCategoryName("");
    setShowNewCategoryInput(false);
  };
  const handleRemoveItem = (indexToRemove) => {
    setMenuItems((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  const [loading, setLoading] = useState(false);

  const handleCategoryInput = (e) => {
    setCategoriesInput(e.target.value);
  };

  const handleCategorySubmit = () => {
    const categoryList = categoriesInput
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c);
    setCategories(categoryList);
    setCategoriesSet(true);
  };

  const handleResetCategories = () => {
    setCategoriesInput("");
    setCategories([]);
    setCategoriesSet(false);
  };

  const handleItemChange = (index, field, value) => {
    setMenuItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = async () => {
    setLoading(true);
    setLoader(true);
    console.log("📦 Final Menu Data:", JSON.stringify(menuItems, null, 2));

    if (!validateMenuItems()) return;

    const updatedItems = menuItems.map((item) => ({
      ...item,
      veg: item.veg.toLowerCase() === "veg",
    }));
    try {
      await API.post(
        "main",
        `/admin/create-item-menuextract/${institutionData.institution}`,
        {
          body: updatedItems,
        }
      );
    } catch (err) {
      console.log("Facing error in storing Items:", err);
    } finally {
      setLoader(false);
    }
    setLoading(false);
    alert("✅ Menu data store in database!");
    setShowMenu(false);
    setCall(!call);
    navigate("/dashboard/item")
  };

  const handleAddItem = (category) => {
    setMenuItems((prev) => [
      ...prev,
      {
        itemName: "",
        price: 0,
        veg: "Veg",
        category,
      },
    ]);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  const handleAddImage = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      // console.log("Image base64:", reader.result);
      setSelectedImage(reader.result); // Base64 string (with data:image/... prefix)
      setBase64Image(reader.result.split(",")[1]);
    };
    reader.readAsDataURL(file); // This triggers the onloadend
  };

  const onImageLoaded = (img) => {
    imgRef.current = img;
  };

  const handleCropImage = useCallback(() => {
    if (!completedCrop || !imgRef.current || !canvasRef.current) return;

    const image = imgRef.current;
    const canvas = canvasRef.current;
    const crop = completedCrop;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio || 1;

    canvas.width = (crop.width || 0) * scaleX * pixelRatio;
    canvas.height = (crop.height || 0) * scaleY * pixelRatio;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); // Support high-DPI
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      image,
      (crop.x || 0) * scaleX,
      (crop.y || 0) * scaleY,
      (crop.width || 0) * scaleX,
      (crop.height || 0) * scaleY,
      0,
      0,
      (crop.width || 0) * scaleX,
      (crop.height || 0) * scaleY
    );

    const croppedImage = canvas.toDataURL("image/jpeg", 1); // Full quality
    setSelectedImage(croppedImage); // Use this for display
    setBase64Image(croppedImage.split(",")[1]); // Use this for backend or storage
    setShowCropModal(false);
  }, [completedCrop]);

  const loadImageFromSrc = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const detectColumnCountFromLines = (lines, categories) => {
    const normalizedCategories = categories.map((c) => c.toLowerCase());
    let matchCount = 0;

    // Check first 10 lines max (or less)
    const checkLimit = Math.min(lines.length, 10);

    for (let i = 0; i < checkLimit; i++) {
      const line = lines[i].toLowerCase().trim();
      if (normalizedCategories.includes(line)) {
        matchCount++;
      }
    }

    // Return at least 1 column
    return matchCount > 0 ? matchCount : 1;
  };

  const splitAndStackColumns = async (imgSrc, columns) => {
    const image = await loadImageFromSrc(imgSrc);
    const columnWidth = image.width / columns;

    const canvas = document.createElement("canvas");
    canvas.width = columnWidth;
    canvas.height = image.height * columns;

    const ctx = canvas.getContext("2d");

    for (let i = 0; i < columns; i++) {
      ctx.drawImage(
        image,
        i * columnWidth,
        0,
        columnWidth,
        image.height,
        0,
        i * image.height,
        columnWidth,
        image.height
      );
    }

    return canvas.toDataURL("image/jpeg").split(",")[1]; // base64 without prefix
  };

  const extractTextFromBase64 = async (base64Image) => {
    setLoader(true);
    try {
      const initialResponse = await API.post("main", "/admin/menu-extract", {
        body: { imageBase64: base64Image },
      });

      if (initialResponse && initialResponse.response?.Blocks) {
        const columnCount = detectColumnCountFromLines(
          initialResponse.lines,
          categories
        );

        console.log("📊 Detected columns:", columnCount);

        let linesToProcess = initialResponse.lines;
        setMergeImage(base64Image);
        if (columnCount > 1) {
          const stackedBase64 = await splitAndStackColumns(
            selectedImage,
            columnCount
          );
          setMergeImage(stackedBase64);

          const finalResponse = await API.post("main", "/admin/menu-extract", {
            body: { imageBase64: stackedBase64 },
          });

          linesToProcess = finalResponse.lines;
        }

        const cleanedLines = preprocessLines(linesToProcess);
        console.log("cleanedLines:",cleanedLines);
        console.log("categories",categories);


        const structuredMenu = parseMenu(cleanedLines, categories);

        processStructuredMenu(structuredMenu);
      } else {
        console.error("Invalid response from Textract.");
      }
    } catch (err) {
      console.error("❌ Error in extractTextFromBase64:", err);
    } finally {
      setLoader(false);
    }
  };

const parseMenu = (lines, categories) => {
  const menu = {};
  let currentCategory = null;
  const normalizedCategories = categories.map((cat) => cat.toLowerCase());

  const cleanPrice = (text) => {
    // Extract first price-looking pattern like 50, 80.00, etc.
    const match = text.match(/(\d{1,4})(\.\d{2})?/);
    if (match) {
      return parseFloat(match[0]);
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    const lowerLine = line.toLowerCase();

    // Detect category
    if (normalizedCategories.includes(lowerLine)) {
      const index = normalizedCategories.indexOf(lowerLine);
      currentCategory = categories[index];
      if (!menu[currentCategory]) {
        menu[currentCategory] = [];
      }
      continue;
    }

    if (!currentCategory) continue;

    // Try to extract name and price from the same line (even if price is inside or at end)
    const price = cleanPrice(line.replace(/₹/g, ""));
    if (price !== null) {
      const name = line.replace(/₹/g, "").replace(/(\d{1,4})(\.\d{2})?/, "").trim();
      if (name) {
        menu[currentCategory].push({ name, price });
        continue;
      }
    }

    // Fallback: line = name, next line = price (even if has ₹ ₹)
    const name = line.replace(/₹/g, "").trim();
    const nextLine = lines[i + 1]?.replace(/₹/g, "").trim();
    const nextPrice = cleanPrice(nextLine);
    if (nextPrice !== null) {
      menu[currentCategory].push({ name, price: nextPrice });
      i++; // skip next line
    }
  }

  return menu;
};


  const preprocessLines = (lines) => {
    return lines
      .filter((line) => !/^\d+\.$/.test(line))
      .map((line) => line.trim());
  };

  const processStructuredMenu = (structuredMenu) => {
    console.log("structuredMenu:",structuredMenu);

    const parsedItems = [];

    Object.entries(structuredMenu).forEach(([category, items]) => {
      items.forEach((item) => {
        const veg = !/(chicken|mutton|fish|egg)/i.test(item.name)
          ? "Veg"
          : "Non-Veg";

        parsedItems.push({
          itemName: item.name,
          price: item.price,
          veg,
          category,
        });
      });
    });
    console.log("✅ Parsed Menu Items:", parsedItems);

    setMenuItems(parsedItems);
  };

  const validateMenuItems = () => {
    if (!categoriesSet || categories.length === 0) {
      alert("Please set menu categories before proceeding.");
      return false;
    }

    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      if (!item.itemName || item.itemName.trim() === "") {
        alert(`Item name is missing at row ${i + 1}.`);
        return false;
      }

      if (!item.price || item.price <= 0) {
        alert(`Invalid price for item at row ${i + 1}.`);
        return false;
      }
    }

    return true;
  };

  const handleExtractMenu = async () => {
    if (!base64Image) {
      alert("Please upload an image first.");
      return;
    }
    await extractTextFromBase64(base64Image);
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  // validating inputs
  const handleNext = async () => {
    // Step 1: Validate Categories
    if (currentStep === 1) {
      if (!categoriesSet || categories.length === 0) {
        alert("❌ Please set at least one menu category before continuing.");
        return;
      }
    }

    // Step 2: Validate Uploaded Image
    if (currentStep === 2) {
      if (!selectedImage) {
        alert("❌ Please upload and crop an image before continuing.");
        return;
      }
    }

    // Step 3: Validate Menu Items
    // if (currentStep === 3) {
    //   if (!categoriesSet || categories.length === 0) {
    //     alert("❌ Menu categories are missing.");
    //     return;
    //   }

    //   if (menuItems.length === 0) {
    //     alert("❌ No menu items were extracted.");
    //     return;
    //   }

    //   for (let i = 0; i < menuItems.length; i++) {
    //     const item = menuItems[i];
    //     if (!item.itemName || item.itemName.trim() === "") {
    //       alert(`❌ Item name is missing at row ${i + 1}.`);
    //       return;
    //     }
    //     if (!item.price || isNaN(item.price) || item.price <= 0) {
    //       alert(`❌ Invalid or missing price for item at row ${i + 1}.`);
    //       return;
    //     }
    //     if (!item.veg || (item.veg !== "Veg" && item.veg !== "Non-Veg")) {
    //       alert(`❌ Please specify if item ${i + 1} is Veg or Non-Veg.`);
    //       return;
    //     }
    //   }

    //   setLoading(true);
    //   await handleExtractMenu();
    //   setLoading(false);
    // }

    // Move to the next step
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      {showStepsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full shadow-lg space-y-6 overflow-y-auto max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              How to Use the Menu Extractor
            </h2>
            <ol className="list-decimal list-inside text-gray-700 space-y-2">
              <li>
                <strong>Step 1:</strong> Enter your menu categories (e.g.,
                Starters, Mains, Drinks).
                <ul className="list-disc list-inside ml-5 text-sm text-gray-600">
                  <li> Make sure the spelling of each category is correct! </li>
                  <li> Double-check the spelling to avoid any mistakes!</li>
                </ul>
              </li>

              <li>
                <strong>Step 2:</strong> Upload a clear, cropped image of your
                menu section.
                <ul className="list-disc list-inside ml-5 text-sm text-gray-600">
                  <li>
                    Avoid uploading the full menu with extra graphics or ads.
                  </li>
                  <li>
                    Focus only on food item names and prices for best results.
                  </li>
                </ul>
                <div className="flex gap-4 mt-4">
                  <div className="w-1/2 text-center">
                    <img
                      src="/images/menu2.jpg"
                      alt="Full menu"
                      className="rounded-md shadow"
                    />
                    <p className="text-xs mt-2 text-gray-500">
                      ❌ Full menu with extra elements
                    </p>
                  </div>
                  <div className="w-1/2 text-center">
                    <img
                      src="/images/menu1.jpg"
                      alt="Cropped menu"
                      className="rounded-md shadow"
                    />
                    <p className="text-xs mt-2 text-green-600">
                      ✅ Cropped to item section only
                    </p>
                  </div>
                </div>
              </li>
              <li>
                <strong>Step 3:</strong> Click “Extract Menu” to process the
                image.
              </li>
              {/* <li>
                <strong>Step 4:</strong> Edit or add items and categories as
                needed.
              </li>
              <li>
                <strong>Step 5:</strong> Save your changes.
              </li> */}
            </ol>
            <div className="text-center pt-2 flex justify-center">
              <Button
                onClick={() => setShowStepsModal(false)}
                className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
              >
                Got It, Let's Start
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 sm:p-10 bg-white shadow-xl rounded-2xl">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">
          Menu Extractor
        </h2>

        <div className="flex justify-end mb-4">
          <Button
            onClick={() => setShowStepsModal(true)}
            className="bg-primaryColor text-white font-semibold px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
          >
            How to Use This Tool❓
          </Button>
        </div>

        {currentStep === 1 && (
          <section className="space-y-4">
            <h3 className="text-xl font-semibold">
              Step 1: Set Menu Categories
            </h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <input
                type="text"
                value={categoriesInput}
                onChange={handleCategoryInput}
                placeholder="e.g., Starters, Main Course, Desserts"
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400"
                disabled={categoriesSet}
              />

              <Button
                onClick={
                  categoriesSet ? handleResetCategories : handleCategorySubmit
                }
                className="bg-primaryColor text-white font-semibold px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
              >
                {categoriesSet ? "Reset" : "Set"}
              </Button>
            </div>
            {categoriesSet && (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat, idx) => (
                  <span
                    key={idx}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {currentStep === 2 && (
          <section className="space-y-4">
            <h3 className="text-xl font-semibold">Step 2: Upload Menu Image</h3>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-xl p-8 cursor-pointer hover:bg-blue-50 transition">
              <Plus size={36} className="text-blue-600" />
              <span className="mt-3 text-gray-600 text-sm font-medium">
                Click to upload an image
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAddImage}
                className="hidden"
              />
            </label>

            {selectedImage && (
              <div className="w-full h-full text-center flex flex-col  items-center gap-3">
                <p className="text-sm text-gray-600 text-center w-full mx-auto">
                  To improve the accuracy of menu extraction, please crop the
                  image to exclude any unnecessary text, backgrounds, or
                  borders. Focus only on the section that contains the actual
                  menu data.
                </p>

                <img
                  src={selectedImage}
                  alt="Uploaded"
                  className="w-72 h-auto mx-auto rounded-lg shadow-md"
                />
                <Button
                  onClick={() => setShowCropModal(true)}
                  className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
                >
                  Crop Image
                </Button>
              </div>
            )}

            {/* Crop Modal */}
            {showCropModal && selectedImage && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white px-6 rounded-lg w-[90%] max-w-xl shadow-lg relative">
                  <h2 className="text-lg font-semibold mb-4">Crop Image</h2>
                  <div className="max-h-[70vh] overflow-auto">
                    <ReactCrop
                      crop={crop}
                      onChange={(c) => setCrop(c)}
                      onComplete={(c) => {
                        if (c.width > 0 && c.height > 0) {
                          setCompletedCrop(c);
                        } else {
                          console.warn("Invalid crop object:", c);
                        }
                      }}
                    >
                      <img
                        src={selectedImage}
                        onLoad={(e) => onImageLoaded(e.currentTarget)}
                        alt="Crop preview"
                        className="max-w-full h-auto"
                      />
                    </ReactCrop>
                  </div>

                  <div className="flex justify-end mt-4 gap-2">
                    <Button
                      onClick={() => setShowCropModal(false)}
                      className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCropImage}
                      className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
                    >
                      Save Crop
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </section>
        )}

        {currentStep === 3 && selectedImage && (
          <section className="flex flex-col items-center gap-3">
            {selectedImage && (
              <div className="w-full h-full text-center">
                <img
                  src={selectedImage}
                  alt="Uploaded"
                  className="w-72 h-auto mx-auto rounded-lg shadow-md"
                />
              </div>
            )}
            {categoriesSet && (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat, idx) => (
                  <span
                    key={idx}
                    className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}

            <Button
              onClick={async () => {
                setLoading(true);
                await handleExtractMenu();
                setLoading(false);
                setCurrentStep(
                  (prev) => Math.min(prev + 1, totalSteps) // define totalSteps = 4
                );
              }}
              className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
              disabled={loading}
            >
              {loading && <Loader2 className="animate-spin w-5 h-5" />}
              Extract Menu
            </Button>
          </section>
        )}

        {currentStep === 4 && menuItems.length > 0 && (
          <section>
            <h3 className="text-2xl font-semibold mb-4 text-gray-800 text-center">
              Extracted Menu
            </h3>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-1/3 text-center">
                <img
                  src={`data:image/jpeg;base64,${mergeImage}`}
                  alt="Merged Menu"
                  className="rounded-lg shadow-md"
                />
              </div>
              <div className="md:w-2/3 space-y-8">
                {categories.map((category) => (
                  <div
                    key={category}
                    className="border rounded-lg shadow-sm mb-6"
                  >
                    <div
                      onClick={() => toggleCategoryCollapse(category)}
                      className="flex justify-between items-center bg-gray-100 px-4 py-2 cursor-pointer"
                    >
                      <h4 className="text-lg font-bold text-blue-800">
                        {category}
                      </h4>
                      <Button className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto">
                        {collapsedCategories[category]
                          ? "➕ Expand"
                          : "➖ Collapse"}
                      </Button>
                    </div>

                    {!collapsedCategories[category] && (
                      <div className="p-4 space-y-4 transition-all duration-300">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead className="bg-gray-200">
                              <tr>
                                <th className="p-2 text-left">Item Name</th>
                                <th className="p-2 text-right">Price (₹)</th>
                                <th className="p-2 text-center">Type</th>
                                <th className="p-2 text-center">Remove</th>
                              </tr>
                            </thead>
                            <tbody>
                              {menuItems
                                .map((item, index) => ({ ...item, index }))
                                .filter((item) => item.category === category)
                                .map(({ itemName, price, veg, index }) => (
                                  <tr
                                    key={`${category}-${index}`}
                                    className="border-b"
                                  >
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={itemName}
                                        onChange={(e) =>
                                          handleItemChange(
                                            index,
                                            "itemName",
                                            e.target.value
                                          )
                                        }
                                        className="w-full px-3 py-1 border rounded"
                                      />
                                    </td>
                                    <td className="p-2 text-right">
                                      <input
                                        type="number"
                                        value={price}
                                        onChange={(e) =>
                                          handleItemChange(
                                            index,
                                            "price",
                                            parseInt(e.target.value) || 0
                                          )
                                        }
                                        className="w-full px-3 py-1 border rounded text-right"
                                      />
                                    </td>
                                    <td className="p-2 text-center">
                                      <select
                                        value={veg}
                                        onChange={(e) =>
                                          handleItemChange(
                                            index,
                                            "veg",
                                            e.target.value
                                          )
                                        }
                                        className="px-2 py-1 border rounded"
                                      >
                                        <option value="Veg">Veg</option>
                                        <option value="Non-Veg">Non-Veg</option>
                                      </select>
                                    </td>
                                    <td className="p-2 text-center">
                                      <button
                                        onClick={() => handleRemoveItem(index)}
                                        className="text-red-600 hover:text-red-800"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="text-right">
                          <button
                            onClick={() => handleAddItem(category)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            ➕ Add Item to {category}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {/* Add New Category Section */}
                <div className="mt-4">
                  {showNewCategoryInput ? (
                    <div className="flex flex-col sm:flex-row items-center gap-3 bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-sm">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Enter new category name"
                        className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 w-full"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddNewCategory}
                          className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
                        >
                          ➕ Add
                        </Button>
                        <Button
                          onClick={() => {
                            setNewCategoryName("");
                            setShowNewCategoryInput(false);
                          }}
                          className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
                        >
                          ✖ Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <button
                        onClick={() => setShowNewCategoryInput(true)}
                        className="w-full p-3 text-blue-600 bg-slate-300 hover:text-blue-800 rounded-md font-medium text-sm transition"
                      >
                        ➕ Add New Category
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-center flex justify-center pt-6">
                  <Button
                    onClick={handleSave}
                    className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <Button
          onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 1))}
          className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
          disabled={currentStep === 1}
        >
          Previous
        </Button>

        <Button
          onClick={handleNext}
          className="bg-primaryColor text-white font-semibold  px-4 rounded-lg shadow-md hover:bg-opacity-80 transition duration-300 ease-in-out transform hover:scale-105 w-full max-w-xs lg:w-auto"
          disabled={currentStep === totalSteps}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default MenuExtractor;