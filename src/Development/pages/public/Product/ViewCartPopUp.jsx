import React, { useState, useEffect, useContext } from "react";
import { API } from "aws-amplify";
import { useNavigate } from "react-router-dom";
import { Context } from "../../../Context";
import { getCurrencySymbol } from "../../../common/Inputs";
import { FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";

const ViewCartPopUp = ({ isOpen, closePopup, onOrderPlaced, cartItems, updateCartItems,name, setName,phoneNumber, setPhoneNumber }) => {
  const { setLoader, institutionData, userData } = useContext(Context);
  // const [name, setName] = useState("");
  // const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [nameError, setNameError] = useState("");
  const [tableName, setTableName] = useState("");
  const [tableData, setTableData] = useState([]);
  const [instruction, setInstruction] = useState("");
  const navigate = useNavigate();
  const [includeServiceTax, setIncludeServiceTax] = useState(true);
  const [isDetailsVisible, setIsDetailsVisible] = useState(false);
  const [nameCleared, setNameCleared] = useState(false);
  const [phoneCleared, setPhoneCleared] = useState(false);
  
  // Check if user is a member
  const isMember = userData?.userType === "member" ||"undefined" && userData?.userType !== "waiter" ;
console.log("dhdh",userData?.userType)
  useEffect(() => {
    // Only apply the auto-fill logic for members
    if (isMember && !nameCleared ) {
      if (userData && userData.userName && !name) {
        setName(userData.userName);
      } else {
        const storedName = localStorage.getItem("savedUserName");
        if (storedName && !name) {
          setName(storedName);
        }
      }
    }
  }, [userData, nameCleared, isMember]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tableNameFromQuery = queryParams.get("tableName");
    if (isMember && tableNameFromQuery) {
      setTableName(tableNameFromQuery);
    } else {
      fetchTableDetails();
    }
  }, []);

  useEffect(() => {
    // Only apply the auto-fill logic for members
    if (isMember && !phoneCleared) {
      const storedPhone = localStorage.getItem("savedPhoneNumber");
      if (storedPhone && !phoneNumber) {
        setPhoneNumber(storedPhone);
      }
    }
  }, [phoneCleared, isMember]);

  const fetchTableDetails = async () => {
    try {
      const response = await API.get(
        "main",
        `/any/cafe-detail/${institutionData.institution}?index=${institutionData.index}`
      );
      const tables = response.Table || [];
      setTableData(tables);
      // if (tables.length > 0 && !tableName) {
      //   setTableName(tables[0].tableNo);
      // }
    } catch (error) {
      console.error("Error fetching table details:", error);
    }
  };

  const updateQuantity = (itemId, newQuantity) => {
    const updatedCartItems =
      newQuantity <= 0
        ? cartItems.filter((item) => item.itemId !== itemId)
        : cartItems.map((item) =>
            item.itemId === itemId ? { ...item, quantity: newQuantity } : item
          );
    updateCartItems(updatedCartItems);
    localStorage.setItem("cartItems", JSON.stringify(updatedCartItems));
  };

  const isValidPhoneNumber = (number) => {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(number);
  };

  const validatePhoneNumber = (number) => {
    if (!number) {
      setPhoneError("Phone number is required");
      return false;
    }
    if (!isValidPhoneNumber(number)) {
      setPhoneError("Enter a valid phone number");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const validateName = (name) => {
    if (!name) {
      setNameError("Name is required");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleOrderPlace = async () => {
    if (!name || !phoneNumber || !tableName) {
      if (!phoneNumber) {
        setPhoneError("Phone number is required");
      }
      if (!name) {
        setNameError("Name is required");
      }
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      return;
    }

    setLoader(true);
    
    // Only store user details in localStorage for members
    if (isMember) {
      localStorage.setItem("savedUserName", name);
      localStorage.setItem("savedPhoneNumber", phoneNumber);
    }
    
    const preparedItems = cartItems.map((item) => ({
      itemId: item.itemId,
      currency: item.currency,
      name: item.itemName,
      price: item.price,
      quantity: item.quantity,
    }));
    
    const cgst = institutionData.cgst
      ? totalItemPrice * (institutionData.cgst / 100)
      : 0;
    const sgst = institutionData.sgst
      ? totalItemPrice * (institutionData.sgst / 100)
      : 0;
    const serviceTax = includeServiceTax
      ? totalItemPrice * (institutionData.serviceTax / 100)
      : 0;
      
    try {
      const requestBody = {
        name,
        phoneNumber,
        tableName,
        totalAmount: totalPrice,
        currency: cartItems[0]?.currency,
        items: preparedItems,
        cgst: cgst.toFixed(2),
        sgst: sgst.toFixed(2),
        serviceTax: serviceTax.toFixed(2),
        serviceTax_consider: Number(serviceTax) > 0.1,
        ...(userData && { orderBy: userData.cognitoId }),
      };

      if (instruction.trim()) {
        requestBody.instruction = instruction.trim();
      }

      const response = await API.post(
        "main",
        `/any/create-order/${institutionData.institution}`,
        {
          body: requestBody,
        }
      );
      
      const orderId = response.orderId;
      const existingOrderIds =
        JSON.parse(localStorage.getItem("orderId")) || [];
      if (!Array.isArray(existingOrderIds)) {
        throw new Error("orderId in localStorage is not an array.");
      }
      existingOrderIds.push(orderId);

      localStorage.setItem("orderId", JSON.stringify(existingOrderIds));
      onOrderPlaced(orderId);
      updateCartItems([]); // Clear cart in parent
      localStorage.removeItem("cartItems");
      setLoader(false);
      
      setNameCleared(false);
      setPhoneCleared(false);
      setInstruction(""); 
      closePopup();
      toast.success("Order placed successfully!");
    } catch (error) {
      console.error("Error placing order:", error);
      toast.error("Failed to place order.");
      setLoader(false);
    }
  };

  const totalCurrency = cartItems.length > 0 ? cartItems[0].currency : "INR";
  const totalItemPrice = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  const cgst = institutionData.cgst
    ? totalItemPrice * (institutionData.cgst / 100)
    : 0;
  const sgst = institutionData.sgst
    ? totalItemPrice * (institutionData.sgst / 100)
    : 0;
  const serviceTaxPercentage = institutionData.serviceTax
    ? institutionData.serviceTax / 100
    : 0.00;

  const defaultserviceTax = includeServiceTax
    ? totalItemPrice * serviceTaxPercentage
    : 0;
  const totalPrice = Math.round(
    totalItemPrice + cgst + sgst + defaultserviceTax
  );

  const handleNameChange = (e) => {
    const newValue = e.target.value;
    setName(newValue);
    if (!newValue) {
      setNameCleared(true);
    } else {
      setNameCleared(false);
    }
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 10) {
      setPhoneNumber(value);
      validatePhoneNumber(value);
      if (!value) {
        setPhoneCleared(true);
      } else {
        setPhoneCleared(false);
      }
    }
  };
  
  const handleTableChange = (e) => {
    setTableName(e.target.value);
  };

  const handleInstructionChange = (e) => {
    setInstruction(e.target.value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800 bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-11/12 sm:w-3/4 max-w-lg">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold max478:text-[16px]">
            Your Cart
          </h1>
          <button
            onClick={closePopup}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <p className="text-center text-gray-500 text-bold">
            Your cart is empty.
          </p>
        ) : (
          <>
            <div
              className="mt-4 space-y-4"
              style={{ maxHeight: "200px", overflowY: "auto" }}
            >
              {cartItems.map((item) => (
                <div
                  key={item.itemId || Math.random()}
                  className="flex justify-between items-center p-4 border rounded-lg"
                >
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-lg max478:text-[14px]">
                      {item.itemName}
                    </h3>
                    <p className="text-sm text-gray-600 max478:text-[14px]">
                      {getCurrencySymbol(item.currency)}{" "}
                      {item.price * item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 max478:text-[14px]">
                    <button
                      className="px-2 py-1 bg-gray-200 rounded-md"
                      onClick={() =>
                        updateQuantity(
                          item.itemId,
                          item.quantity - 1
                        )
                      }
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      className="px-2 py-1 bg-gray-200 rounded-md"
                      onClick={() =>
                        updateQuantity(item.itemId, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-lg font-semibold max478:text-[14px]">
              Total(Rounded): {getCurrencySymbol(totalCurrency)}
              {totalPrice}
              <button
                className="text-blue-500 text-sm p-1"
                onClick={() => setIsDetailsVisible(!isDetailsVisible)}
                title={isDetailsVisible ? "Hide Details" : "View Details"}
              >
                ℹ️
              </button>
            </div>
            {isDetailsVisible && (
              <div className="mt-2 text-sm text-gray-700 border-t pt-2">
                <p>
                  Total Item Price: {getCurrencySymbol(totalCurrency)}
                  {totalItemPrice.toFixed(2)}
                </p>
                <p>
                  CGST ({institutionData.cgst}%):{" "}
                  {getCurrencySymbol(cartItems[0]?.currency || "INR")}
                  {cgst.toFixed(2)}
                </p>
                <p>
                  SGST ({institutionData.sgst}%):{" "}
                  {getCurrencySymbol(cartItems[0]?.currency || "INR")}
                  {sgst.toFixed(2)}
                </p>
                <div className="flex items-center gap-2">
                  <span>
                    Service Tax ({serviceTaxPercentage * 100}%):{" "}
                    {includeServiceTax
                      ? getCurrencySymbol(cartItems[0]?.currency || "INR") +
                        defaultserviceTax.toFixed(2)
                      : "Opted Out"}
                  </span>
                </div>
              </div>
            )}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max478:grid-cols-2">
              <div className="w-full">
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-gray-800 max478:text-[14px]"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  className="w-full p-3 border rounded-md max478:text-[14px]"
                  placeholder="Enter your name"
                  value={name}
                  onChange={handleNameChange}
                  onBlur={() => validateName(name)}
                  required
                />
                {nameError && (
                  <p className="text-red-500 text-xs mt-1">{nameError}</p>
                )}
              </div>
              <div className="w-full">
                <label
                  htmlFor="phone_number"
                  className="block text-sm font-semibold text-gray-800 max478:text-[14px]"
                >
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone_number"
                  className="w-full p-3 border rounded-md max478:text-[14px] appearance-none"
                  style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
                  placeholder="Enter phone number"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  onBlur={() => validatePhoneNumber(phoneNumber)}
                  required
                />
                {phoneError && (
                  <p className="text-red-500 text-xs mt-1">{phoneError}</p>
                )}
              </div>
            </div>
            
            {/* Table selection - different UI based on user type */}
            {!isMember || userData.userType==="waiter" ? (
            <div className="mt-4">
              <label
                htmlFor="table_name"
                className="block text-sm font-semibold text-gray-800 max478:text-[14px]"
              >
                Table
              </label>
              
           
                <select
                  id="table_name"
                  className="w-full p-3 border rounded-md max478:text-[14px]"
                  value={tableName}
                  onChange={handleTableChange}
                  required
                >
                  <option value="">Select Table</option>
                  {tableData.map((table) => (
                    <option key={table.tableNo} value={table.tableNo}>
                      {table.tableName || table.tableNo}
                    </option>
                  ))}
                </select>
            
            </div>
 ) : (<></>)}
 {institutionData.institution==="bhuk2323" && (
            <div className="mt-4">
              <label
                htmlFor="instruction"
                className="block text-sm font-semibold text-gray-800 max478:text-[14px]"
              >
                Special Instructions (Optional)
              </label>
              <textarea
                id="instruction"
                className="w-full p-3 border rounded-md max478:text-[14px] resize-none"
                placeholder="Any special requests? (e.g., extra spicy, no onions, etc.)"
                value={instruction}
                onChange={handleInstructionChange}
                rows="2"
                maxLength="200"
              />
              <p className="text-xs text-gray-500 mt-1 max478:text-[10px]">
                {instruction.length}/200 characters
              </p>
            </div>
 )}
            <div className="mt-4 space-x-4 flex justify-between">
              <button
                className="w-full bg-gray-500 text-white py-2 px-[5px] rounded-lg max478:text-[12px]"
                onClick={closePopup}
              >
                Add More Product
              </button>
              <button
                className="w-full bg-green-500 text-white py-2 px-4 rounded-lg max478:text-[12px]"
                onClick={handleOrderPlace}
              >
                Place Order
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ViewCartPopUp;