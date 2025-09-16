import { useContext, useState, useEffect } from "react";
import { Context } from "../../../Context";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import { API, Storage } from "aws-amplify";
import { FaEdit } from "react-icons/fa";
import InstitutionData from "../../../../Operation/institutionData.json";

const Hero = () => {
  const { institutionData, setInstitutionData } = useContext(Context);
  const {
    tagLine1,
    tagLine2,
    heroImage,
    testimonials,
    customerCount = "18k",
  } = institutionData;

  const getValueOrDefault = (value, defaultValue) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return defaultValue;
    }
    return value;
  };

  const finalTagLine1 = getValueOrDefault(tagLine1, InstitutionData.tagLine1);
  const finalTagLine2 = getValueOrDefault(tagLine2, InstitutionData.tagLine2);
  const finalHeroImage = getValueOrDefault(
    heroImage,
    InstitutionData.heroImage
  );
  const finalTestimonials = getValueOrDefault(
    testimonials,
    InstitutionData.testimonials
  );
  const finalCustomerCount = getValueOrDefault(
    customerCount,
    InstitutionData.customerCount || "18k"
  );

  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editData, setEditData] = useState({
    tagLine1: finalTagLine1,
    tagLine2: finalTagLine2,
    heroImage: finalHeroImage,
    customerCount: finalCustomerCount,
  });

  const [imageFile, setImageFile] = useState(null);

  const UserCtx = useContext(Context);
  const isAdmin = UserCtx.userData.userType === "admin";

  const customerImages = (finalTestimonials || [])
    .slice(0, 5)
    .map((testimonial) => ({
      image: testimonial.image,
      name: testimonial.name,
    }));

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setEditData((prev) => ({ ...prev, heroImage: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToS3 = async (file) => {
    try {
      const fileName = `hero-images/${
        institutionData.institution
      }-${Date.now()}-${file.name}`;
      await Storage.put(fileName, file, {
        contentType: file.type,
        level: "public",
      });

      const fileUrl = await Storage.get(fileName);
      return fileUrl;
    } catch (error) {
      console.error("Error uploading image to S3:", error);
      throw error;
    }
  };

  // Validation function to check if all required fields are filled
  const areRequiredFieldsFilled = () => {
    return (
      editData.tagLine1?.trim() &&
      editData.tagLine2?.trim() &&
      editData.heroImage &&
      editData.customerCount?.trim()
    );
  };

  const handleSave = async () => {
    // Check if all required fields are filled
    if (!areRequiredFieldsFilled()) {
      toast.error("Please fill in all required fields marked with *", {
        position: "top-right",
        autoClose: 3000,
        style: {
          background: "#EF4444",
          color: "#ffffff",
          borderRadius: "8px",
          padding: "12px",
        },
      });
      return;
    }

    try {
      setIsUploading(true);

      let finalHeroImageToUpload = editData.heroImage;
      if (imageFile) {
        const uploadedUrl = await uploadImageToS3(imageFile);
        finalHeroImageToUpload = uploadedUrl.split("?")[0];
      }

      // Prepare a filtered updatedData with only changed fields
      const updatedData = {};
      if (editData.tagLine1 !== finalTagLine1) {
        updatedData.tagLine1 = editData.tagLine1;
      }
      if (editData.tagLine2 !== finalTagLine2) {
        updatedData.tagLine2 = editData.tagLine2;
      }
      if (finalHeroImageToUpload !== finalHeroImage) {
        updatedData.heroImage = finalHeroImageToUpload;
      }
      if (editData.customerCount !== finalCustomerCount) {
        updatedData.customerCount = editData.customerCount;
      }

      // If nothing changed, no need to call API or set state
      if (Object.keys(updatedData).length === 0) {
        toast.info("No changes detected.");
        setIsEditing(false);
        setIsUploading(false);
        return;
      }

      // Update local state
      const newInstitutionData = {
        ...institutionData,
        ...updatedData,
      };
      setInstitutionData(newInstitutionData);
const indexParam = institutionData.index !== undefined && institutionData.index !== null
  ? `&index=${institutionData.index}`
  : '';
      await API.put('main', `/admin/editable-ui/${institutionData.institution}?query=home${indexParam}`, {
        body: updatedData
      });

      toast.success("Changes saved successfully!", {
        position: "top-right",
        autoClose: 3000,
        style: {
          background: "#16A34A",
          color: "#ffffff",
          borderRadius: "8px",
          padding: "12px",
        },
      });

      setImageFile(null);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Failed to save changes. Please try again.", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      tagLine1,
      tagLine2,
      heroImage,
      customerCount,
    });
    setImageFile(null);
    toast.info("Changes discarded.", {
      position: "top-right",
      autoClose: 3000,
      style: {
        background: "#722F37",
        color: "#ffffff",
        borderRadius: "8px",
        padding: "12px",
      },
    });
    setIsEditing(false);
  };

  return (
    <section className="relative flex items-center justify-center h-screen text-white overflow-hidden px-6">
      <motion.div
        className="absolute inset-0 bg-cover bg-center filter blur-sm brightness-75 p-4"
        style={{ backgroundImage: `url(${finalHeroImage})` }}
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      ></motion.div>

      <div className="absolute top-4 right-4 z-20">
        {isAdmin && (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-[var(--primary-color)] text-white px-4 py-2 rounded-full font-medium shadow-lg transition-all duration-300 flex items-center gap-2"
            data-modal-target="edit-modal"
            data-modal-toggle="edit-modal"
          >
            <FaEdit className="text-md" />
            <span className="text-md">Edit</span>
          </button>
        )}
      </div>

      {isEditing && (
        <div
          id="edit-modal"
          tabIndex="-1"
          aria-hidden="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900 bg-opacity-50"
        >
          <div className="relative p-4 w-full max-w-md max-h-full">
            <div className="relative bg-white rounded-lg shadow dark:bg-gray-700">
              <div className="flex items-center justify-between p-4 border-b rounded-t dark:border-gray-600">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Edit Hero Section
                </h3>
                <button
                  type="button"
                  className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 inline-flex items-center justify-center dark:hover:bg-gray-600 dark:hover:text-white"
                  onClick={handleCancel}
                >
                  <svg
                    className="w-3 h-3"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 14 14"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                    />
                  </svg>
                  <span className="sr-only">Close modal</span>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label
                    htmlFor="tagLine1"
                    className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    Tagline 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="tagLine1"
                    name="tagLine1"
                    value={editData.tagLine1}
                    onChange={handleInputChange}
                    maxLength={100}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                    {editData.tagLine1.length}/100 characters
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="tagLine2"
                    className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    Tagline 2 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="tagLine2"
                    name="tagLine2"
                    value={editData.tagLine2}
                    onChange={handleInputChange}
                    maxLength={100}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                    {editData.tagLine2.length}/100 characters
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="heroImage"
                    className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    Hero Image <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    id="heroImage"
                    name="heroImage"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                  />
                  {editData.heroImage && (
                    <img
                      src={editData.heroImage}
                      alt="Preview"
                      className="mt-2 w-full h-32 object-cover rounded-lg"
                    />
                  )}
                </div>
                <div>
                  <label
                    htmlFor="customerCount"
                    className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                  >
                    Customer Count <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="customerCount"
                    name="customerCount"
                    value={editData.customerCount}
                    onChange={handleInputChange}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-center justify-center p-4 border-t border-gray-200 rounded-b dark:border-gray-600">
                <button
                  onClick={handleSave}
                  type="button"
                  disabled={isUploading || !areRequiredFieldsFilled()}
                  className={`text-white bg-primaryColor focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-primaryColor dark:focus:ring-blue-800 ${
                    isUploading || !areRequiredFieldsFilled()
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isUploading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 text-center max-w-3xl">
        <motion.h1
          className="text-5xl font-extrabold leading-tight tracking-tight text-white drop-shadow-lg"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          {finalTagLine1}
        </motion.h1>
        <motion.h2
          className="text-2xl text-gray-300 mt-2 drop-shadow-md"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          {finalTagLine2}
        </motion.h2>

        <motion.div
          className="mt-6"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <p className="text-lg font-medium">
            <span className="text-3xl text-white">{finalCustomerCount}+</span>{" "}
            Happy Customers
          </p>

          <div className="flex justify-center mt-4">
            {customerImages.map((customer, index) => (
              <motion.div
                key={index}
                className="relative w-14 h-14 rounded-full border-2 border-white -ml-3 first:ml-0 shadow-md"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
              >
                {customer.image ? (
                  <img
                    src={customer.image}
                    alt={customer.name}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-500 text-white text-sm font-semibold rounded-full">
                    {getInitials(customer.name)}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.7 }}
        >
          <button
            onClick={() => navigate("/product")}
            className="bg-white text-black px-8 py-3 rounded-full font-medium inline-flex items-center gap-3 shadow-lg hover:bg-gray-200 transition-all duration-300"
          >
            <span className="text-lg">Order now</span>
            <motion.div
              className="bg-red-600 rounded-full p-2"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.3 }}
            >
              <svg
                className="w-6 h-6 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14m-7-7l7 7-7 7" />
              </svg>
            </motion.div>
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
