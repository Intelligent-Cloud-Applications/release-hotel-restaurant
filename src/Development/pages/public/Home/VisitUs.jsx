import { motion } from "framer-motion";
import { useContext, useState, useEffect } from "react";
import { Context } from "../../../Context";
import { FaEdit } from "react-icons/fa";
import { Modal } from "flowbite-react";
import { toast } from "react-toastify";
import { API, Storage } from "aws-amplify";
import InstitutionData from "../../../../Operation/institutionData.json";

const VisitUs = () => {
  const { institutionData, setInstitutionData } = useContext(Context);
  const finalTitle = "Visit Us"; // or InstitutionData.visitUs.title if exists
  const finalAddress =
    institutionData?.Query_Address || InstitutionData.Query_Address || "";
  const finalPhone =
    institutionData?.Query_PhoneNumber ||
    InstitutionData.Query_PhoneNumber ||
    "";
  const finalDescription =
    institutionData?.visitUs?.description ||
    InstitutionData.visitUs?.description ||
    "Drop by anytime! We're open all week and ready to serve you with the finest tea experience.";
  const finalMap =
    institutionData?.visitUs?.locationMap ||
    InstitutionData.visitUs?.locationMap ||
    "";

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editData, setEditData] = useState({
    title: "Visit Us",
    address: "",
    phone: "",
    description:
      "Drop by anytime! We're open all week and ready to serve you with the finest tea experience.",
    map: "",
  });

  const UserCtx = useContext(Context);
  const isAdmin = UserCtx.userData.userType === "admin";

  // Initialize with context data
  useEffect(() => {
    setEditData({
      title: finalTitle,
      address: finalAddress,
      phone: finalPhone,
      description: finalDescription,
      map: finalMap,
    });
  }, [institutionData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

 const handleSave = async () => {
  try {
    setIsUploading(true);

    // Prepare changed fields only
    const changedData = {};

    // Check nested visitUs values for changes
    const changedVisitUs = {};
    if (editData.title !== (institutionData?.visitUs?.title || "Visit Us")) {
      changedVisitUs.title = editData.title;
    }
    if (
      editData.description !==
      (institutionData?.visitUs?.description || InstitutionData.visitUs?.description)
    ) {
      changedVisitUs.description = editData.description;
    }
    if (
      editData.map !==
      (institutionData?.visitUs?.locationMap || InstitutionData.visitUs?.locationMap)
    ) {
      changedVisitUs.locationMap = editData.map;
    }

    if (Object.keys(changedVisitUs).length > 0) {
      changedData.visitUs = changedVisitUs;
    }

    // Optionally check and add Query_Address and Query_PhoneNumber if applicable
    if (editData.address !== (institutionData?.Query_Address || InstitutionData.Query_Address)) {
      changedData.Query_Address = editData.address;
    }
    if (editData.phone !== (institutionData?.Query_PhoneNumber || InstitutionData.Query_PhoneNumber)) {
      changedData.Query_PhoneNumber = editData.phone;
    }

    if (Object.keys(changedData).length === 0) {
      toast.info("No changes detected.");
      setIsEditing(false);
      setIsUploading(false);
      return;
    }

    // Compose optional index param for query string
    const indexParam =
      institutionData.index !== undefined && institutionData.index !== null
        ? `&index=${institutionData.index}`
        : "";

    // Send only changed fields in API call
    await API.put(
      "main",
      `/admin/editable-ui/${institutionData.institution}?query=location${indexParam}`,
      {
        body: changedData,
      }
    );

    // Update local context state merging changed fields & deep merge visitUs
    setInstitutionData((prev) => ({
      ...prev,
      ...changedData,
      visitUs: {
        ...prev.visitUs,
        ...changedData.visitUs,
      },
    }));

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
      title: finalTitle,
      address: finalAddress,
      phone: finalPhone,
      description: finalDescription,
      map: finalMap,
    });
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

  const isFormValid =
    editData.address.trim() !== "" &&
    /^\+\d{11,13}$/.test(editData.phone) &&
    editData.map.includes("google.com/maps/embed");

  return (
    <section className="flex flex-col md:flex-row items-center justify-center bg-secondaryColor py-16 px-8 font-lora relative">
      <div className="absolute top-4 right-4 z-20">
        {isAdmin && (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-[var(--primary-color)] text-white px-4 py-2 rounded-full font-medium shadow-lg transition-all duration-300 flex items-center gap-2"
          >
            <FaEdit className="text-md" />
            <span className="text-md">Edit</span>
          </button>
        )}
      </div>
      {/* Map Section */}
      <motion.div
        className="w-full md:w-1/2 flex justify-center"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        <div className="w-full max-w-lg h-[300px] md:h-[400px] lg:h-[450px] rounded-2xl overflow-hidden shadow-xl border-4 border-primaryColor/20 hover:shadow-2xl transition-all duration-300 ease-in-out hover:border-primaryColor/40">
          <iframe
            title="Location Map"
            src={editData.map}
            className="w-full h-full border-0 rounded-2xl"
            allowFullScreen=""
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          ></iframe>
        </div>
      </motion.div>

      {/* Text Section */}
      <motion.div
        className="w-full md:w-1/2 p-8 text-center md:text-left mt-8 md:mt-0"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primaryColor mb-6">
          {editData.title}
        </h2>

        <div className="space-y-6">
          <p className="text-primaryColor/80 text-lg sm:text-xl leading-relaxed">
            We're conveniently located at{" "}
            <span className="font-semibold text-primaryColor">
              {editData.address}
            </span>
          </p>

          <p className="text-primaryColor/80 text-lg sm:text-xl leading-relaxed">
            For inquiries, call us at{" "}
            <a
              href={`tel:${editData.phone}`}
              className="font-semibold text-primaryColor"
            >
              {editData.phone}
            </a>
          </p>

          <p className="text-primaryColor/80 text-lg sm:text-xl leading-relaxed">
            {editData.description}
          </p>
        </div>

        {/* Get Directions button */}
        <motion.a
          href={`https://maps.google.com/?q=${editData.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-8 px-8 py-3 bg-primaryColor text-white rounded-full font-medium hover:bg-primaryColor/90 transition-colors duration-300 shadow-lg hover:shadow-xl"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Get Directions
        </motion.a>
      </motion.div>

      {/* Flowbite Modal */}
      <Modal show={isEditing} onClose={handleCancel} size="md">
        <Modal.Header className="border-b p-4">
          Edit Location Details
        </Modal.Header>
        <Modal.Body className="p-4 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Visit Us Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={editData.title}
                onChange={handleInputChange}
                maxLength={50}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                disabled={isUploading}
                required
                placeholder="e.g. Visit Us"
              />
              <p className="text-xs text-gray-500 mt-1">
                {editData.title.length}/50 characters
              </p>
            </div>
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                name="description"
                value={editData.description}
                onChange={handleInputChange}
                maxLength={200}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                disabled={isUploading}
                required
                placeholder="Write something about visiting..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {editData.description.length}/200 characters
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Map Embed URL <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                name="map"
                value={editData.map}
                onChange={handleInputChange}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://www.google.com/maps/embed?pb=..."
                disabled={isUploading}
              />
              {editData.map &&
                !editData.map.includes("google.com/maps/embed") && (
                  <p className="text-xs text-red-500 mt-1">
                    Please use a valid Google Maps embed URL
                  </p>
                )}
              <p className="text-xs text-gray-500 mt-1">
                Tip: In Google Maps, click "Share" → "Embed a map" → Copy the
                iframe src URL
              </p>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-t p-4">
          <div className="w-full flex justify-center gap-2">
            <button
              onClick={handleSave}
              disabled={isUploading || !isFormValid}
              className={`text-white ${
                isUploading || !isFormValid
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-primaryColor"
              } focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:focus:ring-blue-800`}
            >
              {isUploading ? "Saving..." : "Save"}
            </button>
          </div>
        </Modal.Footer>
      </Modal>
    </section>
  );
};

export default VisitUs;
