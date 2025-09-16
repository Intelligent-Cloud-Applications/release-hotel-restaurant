import { motion } from "framer-motion";
import { FaCheck, FaEdit, FaPlus } from "react-icons/fa";
import { useContext, useState, useEffect } from "react";
import { Context } from "../../../Context";
import { toast } from "react-toastify";
import { API, Storage } from "aws-amplify";
import InstitutionData from "../../../../Operation/institutionData.json";

const variants = {
  fadeInUp: {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" },
  },
  fadeInLeft: {
    initial: { opacity: 0, x: 60 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const OurMission = () => {
  const { institutionData, setInstitutionData } = useContext(Context);
  const finalTitle =
    institutionData?.ourMission?.title ||
    InstitutionData.ourMission?.title ||
    "";
  const finalDescription =
    institutionData?.ourMission?.description ||
    InstitutionData.ourMission?.description ||
    "";
  const finalPoints =
    institutionData?.ourMission?.points &&
    institutionData.ourMission.points.length > 0
      ? [...institutionData.ourMission.points]
      : InstitutionData.ourMission?.points &&
        InstitutionData.ourMission.points.length > 0
      ? [...InstitutionData.ourMission.points]
      : [""];
  const finalBackground =
    institutionData?.ourMissionBg || InstitutionData.ourMissionBg || "";

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [formValid, setFormValid] = useState(false);

  const [editData, setEditData] = useState({
    title: finalTitle,
    description: finalDescription,
    points: finalPoints,
    background: finalBackground,
  });

  useEffect(() => {
    setEditData({
      title: finalTitle,
      description: finalDescription,
      points: finalPoints,
      background: finalBackground,
    });
  }, [institutionData]);
  const UserCtx = useContext(Context);
  const isAdmin = UserCtx.userData.userType === "admin";

  // Validate form on any data change
  useEffect(() => {
    const isValid =
      editData.title.trim() !== "" &&
      editData.description.trim() !== "" &&
      editData.points.length > 0 &&
      editData.points[0].trim() !== "" &&
      (editData.background || imageFile);

    setFormValid(isValid);
  }, [editData, imageFile]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePointChange = (index, value) => {
    const newPoints = [...editData.points];
    newPoints[index] = value;
    setEditData((prev) => ({ ...prev, points: newPoints }));
  };

  const addNewPoint = () => {
    setEditData((prev) => ({
      ...prev,
      points: [...prev.points, ""],
    }));
  };

  const removePoint = (index) => {
    // Prevent removing the first point
    if (index === 0) return;

    const newPoints = editData.points.filter((_, i) => i !== index);
    setEditData((prev) => ({ ...prev, points: newPoints }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditData((prev) => ({ ...prev, background: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToS3 = async (file) => {
    try {
      const fileName = `mission-images/${
        institutionData.institution
      }-${Date.now()}-${file.name}`;
      await Storage.put(fileName, file, {
        contentType: file.type,
        level: "public",
      });
      const fileUrl = await Storage.get(fileName);
      return fileUrl.split("?")[0];
    } catch (error) {
      console.error("Error uploading image to S3:", error);
      throw error;
    }
  };

  const handleSave = async () => {
  if (!formValid) {
    toast.error("Please fill in all required fields", {
      position: "top-right",
      autoClose: 3000,
    });
    return;
  }

  try {
    setIsUploading(true);

    let finalBackgroundUrl = editData.background;
    if (imageFile) {
      finalBackgroundUrl = await uploadImageToS3(imageFile);
    }

    const changedMission = {};
    if (editData.title !== finalTitle) changedMission.title = editData.title;
    if (editData.description !== finalDescription)
      changedMission.description = editData.description;
    if (JSON.stringify(editData.points) !== JSON.stringify(finalPoints))
      changedMission.points = editData.points;

    const changedData = {};
    if (Object.keys(changedMission).length > 0) {
      changedData.ourMission = changedMission;
    }
    if (finalBackgroundUrl !== finalBackground) {
      changedData.ourMissionBg = finalBackgroundUrl;
    }

    if (Object.keys(changedData).length === 0) {
      toast.info("No changes detected.");
      setIsEditing(false);
      setIsUploading(false);
      return;
    }

    // Compose optional index param
    const indexParam =
      institutionData.index !== undefined && institutionData.index !== null
        ? `&index=${institutionData.index}`
        : "";

    // Call API with only changed data
    await API.put(
      "main",
      `/admin/editable-ui/${institutionData.institution}?query=ourmission${indexParam}`,
      {
        body: changedData,
      }
    );

    // Update local institutionData state merging
    setInstitutionData((prev) => ({
      ...prev,
      ...changedData,
      ourMission: {
        ...prev.ourMission,
        ...changedData.ourMission,
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
      title: finalTitle,
      description: finalDescription,
      points: finalPoints,
      background: finalBackground,
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

  if (!institutionData?.ourMission && !InstitutionData?.ourMission) {
    return null;
  }

  return (
    <section className="relative bg-gradient-to-b from-[#F3EDE6] to-[#F8F5F1] px-3 xs:px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 xl:py-24">
      <div className="absolute inset-0 opacity-5" />
      <div className="relative max-w-[2000px] mx-auto">
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-100px" }}
          variants={variants.fadeInUp}
          className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-xl"
        >
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

          <img
            src={
              editData.background ||
              "https://via.placeholder.com/800x400?text=Mission+Background"
            }
            alt="Mission background"
            className="w-full h-[800px] sm:h-[400px] md:h-[500px] lg:h-[600px] xl:h-[800px] object-cover"
            loading="lazy"
            onError={(e) => {
              e.target.src =
                "https://via.placeholder.com/800x400?text=Invalid+Image";
            }}
          />

          <div className="absolute inset-0 bg-gradient-to-t from-[#2C2C2C]/95 via-[#2C2C2C]/60 to-[#2C2C2C]/20" />
          <div className="absolute inset-0 flex flex-col justify-end p-5 xs:p-6 sm:p-8 lg:p-10 xl:p-12">
            <motion.div
              variants={variants.fadeInUp}
              className="max-w-4xl relative"
            >
              <h2 className="text-2xl text-left xs:text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold mb-3 xs:mb-4 sm:mb-5 lg:mb-6 text-[#E8C9A3] leading-tight">
                {editData.title}
              </h2>
              <p className="text-[#E8C9A3]/80 text-base xs:text-lg sm:text-xl lg:text-2xl mb-5 xs:mb-6 sm:mb-8 lg:mb-10 max-w-3xl leading-relaxed">
                {editData.description}
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-5 sm:gap-6 lg:gap-8 max-w-4xl">
                {editData.points.map((point, index) => (
                  <motion.li
                    key={index}
                    variants={variants.fadeInLeft}
                    initial="initial"
                    animate="animate"
                    className="flex items-center gap-3 xs:gap-4 group relative"
                  >
                    <span className="flex-shrink-0 w-6 xs:w-7 sm:w-8 h-6 xs:h-7 sm:h-8 bg-[#E8C9A3] text-[#2C2C2C] rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <FaCheck className="text-xs xs:text-sm sm:text-base" />
                    </span>
                    <span className="text-[#E8C9A3]/90 text-sm xs:text-base sm:text-lg lg:text-xl group-hover:text-[#E8C9A3] transition-colors duration-300 leading-snug">
                      {point}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-gray-900 bg-opacity-50">
          <div className="relative p-4 w-full max-w-xl max-h-full">
            <div className="relative bg-white rounded-lg shadow dark:bg-gray-700">
              <div className="flex items-center justify-between p-4 border-b rounded-t dark:border-gray-600">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Edit Our Mission Section
                </h3>
                <button
                  type="button"
                  className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 inline-flex items-center justify-center dark:hover:bg-gray-600 dark:hover:text-white"
                  onClick={handleCancel}
                  disabled={isUploading}
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
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={editData.title}
                      onChange={(e) => {
                        if (e.target.value.length <= 50) {
                          handleInputChange(e);
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                      disabled={isUploading}
                      maxLength={50}
                      required
                      placeholder="Enter title (required)"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {editData.title.length}/50 characters
                    </p>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="description"
                      value={editData.description}
                      onChange={(e) => {
                        if (e.target.value.length <= 100) {
                          handleInputChange(e);
                        }
                      }}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 h-32 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                      rows="4"
                      disabled={isUploading}
                      maxLength={100}
                      required
                      placeholder="Enter description (required)"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {editData.description.length}/100 characters
                    </p>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                      Mission Points
                    </label>
                    <div className="space-y-3 max-h-64 overflow-y-auto p-2 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-600 dark:border-gray-500">
                      {editData.points.map((point, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={point}
                              onChange={(e) => {
                                if (e.target.value.length <= 30) {
                                  handlePointChange(index, e.target.value);
                                }
                              }}
                              className="flex-1 p-2 text-sm rounded-lg border border-gray-300 bg-white focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white"
                              disabled={isUploading}
                              required={index === 0}
                              placeholder={
                                index === 0
                                  ? "Enter first point (required)"
                                  : "Enter point"
                              }
                            />
                            <button
                              onClick={() => removePoint(index)}
                              className={`p-2 text-white rounded-lg transition-colors
                                ${
                                  isUploading || index === 0
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-red-500 hover:bg-red-600 dark:hover:bg-red-600"
                                }
                              `}
                              disabled={isUploading || index === 0}
                            >
                              ×
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {point.length}/30 characters
                            {index === 0 && (
                              <span className="text-red-500 ml-1">
                                (Required)
                              </span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addNewPoint}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 dark:hover:bg-blue-700"
                      disabled={isUploading}
                    >
                      <FaPlus className="text-xs" /> Add Point
                    </button>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                      Background Image <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                      disabled={isUploading}
                      required={!editData.background}
                    />
                    {editData.background && (
                      <div className="mt-4">
                        <img
                          src={editData.background}
                          alt="Preview"
                          className="w-full h-64 object-contain rounded-lg border border-gray-200 dark:border-gray-600"
                          onError={(e) => {
                            e.target.src =
                              "https://via.placeholder.com/800x400?text=Invalid+Image";
                          }}
                        />
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Current background image preview
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Validation Message */}
              {!formValid && (
                <div className="px-6 pb-2">
                  <p className="text-sm text-red-500">
                    Please fill in all required fields marked with{" "}
                    <span className="text-red-500">*</span>
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-center items-center p-4 border-t border-gray-200 rounded-b dark:border-gray-600">
                <button
                  onClick={handleSave}
                  disabled={isUploading || !formValid}
                  className={`text-white focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center ${
                    formValid
                      ? "bg-primaryColor dark:bg-primaryColor hover:bg-blue-700 dark:focus:ring-blue-800"
                      : "bg-gray-400 cursor-not-allowed"
                  }`}
                >
                  {isUploading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-32 xs:w-40 sm:w-48 lg:w-56 h-32 xs:h-40 sm:h-48 lg:h-56 bg-[#E8C9A3]/5 rounded-full blur-3xl" />
        <div className="absolute -right-10 top-1/2 -translate-y-1/2 w-32 xs:w-40 sm:w-48 lg:w-56 h-32 xs:h-40 sm:h-48 lg:h-56 bg-[#E8C9A3]/5 rounded-full blur-3xl" />
      </div>
    </section>
  );
};

export default OurMission;
