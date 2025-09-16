import React, { useState, useContext, useRef, useEffect } from "react";
import { FaEdit } from "react-icons/fa";
import { Context } from "../../../Context";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { toast } from "react-toastify";
import { API, Storage } from "aws-amplify";
import Spoon from "./images/spoon.png";
import SpoonR from "./images/spoonR.png";
import InstitutionData from "../../../../Operation/institutionData.json";

const Feedback = () => {
  const { institutionData, setInstitutionData } = useContext(Context);
  const { testimonials = [] } = institutionData;

  const finalTestimonials =
    Array.isArray(testimonials) && testimonials.length > 0
      ? testimonials
      : InstitutionData.testimonials;

  // Sync editTestimonials state with finalTestimonials
  const [editTestimonials, setEditTestimonials] = useState(
    finalTestimonials.map((t) => ({ ...t }))
  );
  useEffect(() => {
    setEditTestimonials(finalTestimonials.map((t) => ({ ...t })));
  }, [finalTestimonials]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageFiles, setImageFiles] = useState({});
  const sliderRef = useRef(null);

  const UserCtx = useContext(Context);
  const isAdmin = UserCtx.userData.userType === "admin";

  const settings = {
    dots: false,
    infinite: finalTestimonials.length > 1,
    speed: 500,
    slidesToShow: Math.min(3, finalTestimonials.length),
    slidesToScroll: 1,
    centerMode: false,
    focusOnSelect: false,
    arrows: false,
    beforeChange: (_, next) => setActiveIndex(next),
    responsive: [
      { breakpoint: 1280, settings: { slidesToShow: Math.min(3, finalTestimonials.length) } },
      { breakpoint: 1024, settings: { slidesToShow: Math.min(2, finalTestimonials.length) } },
      { breakpoint: 768, settings: { slidesToShow: Math.min(1, finalTestimonials.length) } },
    ],
  };

  const handlePrev = () => {
    if (sliderRef.current) {
      sliderRef.current.slickPrev();
    }
  };

  const handleNext = () => {
    if (sliderRef.current) {
      sliderRef.current.slickNext();
    }
  };

  const handleTestimonialChange = (index, field, value) => {
    const updated = [...editTestimonials];
    updated[index] = { ...updated[index], [field]: value };
    setEditTestimonials(updated);
  };

  const handleAddTestimonial = () => {
    setEditTestimonials([...editTestimonials, { name: "", text: "", image: "" }]);
  };

  const handleDeleteTestimonial = (index) => {
    if (editTestimonials.length <= 1) return; // Prevent deleting last testimonial
    setEditTestimonials(editTestimonials.filter((_, i) => i !== index));
    setImageFiles((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const handleTestimonialImageUpload = (index, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFiles((prev) => ({ ...prev, [index]: file }));
    const reader = new FileReader();
    reader.onloadend = () => {
      handleTestimonialChange(index, "image", reader.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadImageToS3 = async (file, index) => {
    try {
      const fileName = `testimonials/${institutionData.institution}-${Date.now()}-${index}-${file.name}`;
      await Storage.put(fileName, file, { contentType: file.type, level: "public" });
      const fileUrl = await Storage.get(fileName);
      return fileUrl.split("?")[0];
    } catch (error) {
      console.error(`Error uploading image for testimonial ${index} to S3:`, error);
      throw error;
    }
  };

  const areRequiredFieldsFilled = () => {
    return editTestimonials.every(
      (t) => t.name?.trim() && t.text?.trim() && t.image
    );
  };

  const handleSave = async () => {
    if (!areRequiredFieldsFilled()) {
      toast.error("Please fill in all required fields marked with *", {
        position: "top-right",
        autoClose: 3000,
        style: { background: "#EF4444", color: "#fff", borderRadius: "8px", padding: "12px" },
      });
      return;
    }
    try {
      setIsUploading(true);

      const uploadPromises = Object.entries(imageFiles).map(([idx, file]) =>
        uploadImageToS3(file, Number(idx)).then((url) => ({ index: Number(idx), url }))
      );
      const uploadedImages = await Promise.all(uploadPromises);

      const updatedTestimonials = editTestimonials.map((t, idx) => {
        const found = uploadedImages.find((img) => img.index === idx);
        return found ? { ...t, image: found.url } : t;
      });

      const updatedData = { ...institutionData, testimonials: updatedTestimonials };
      setInstitutionData(updatedData);

      const indexParam =
        institutionData.index !== undefined && institutionData.index !== null
          ? `&index=${institutionData.index}`
          : "";
      await API.put(
        "main",
        `/admin/editable-ui/${institutionData.institution}?query=testimonial${indexParam}`,
        { body: { testimonials: updatedTestimonials } }
      );

      toast.success("Testimonials saved successfully!", {
        position: "top-right",
        autoClose: 3000,
        style: { background: "#16A34A", color: "#fff", borderRadius: "8px", padding: "12px" },
      });

      setImageFiles({});
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving testimonials:", error);
      toast.error("Failed to save testimonials. Please try again.", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setEditTestimonials(finalTestimonials.map((t) => ({ ...t })));
    setImageFiles({});
    toast.info("Changes discarded.", {
      position: "top-right",
      autoClose: 3000,
      style: { background: "#722F37", color: "#fff", borderRadius: "8px", padding: "12px" },
    });
    setIsEditing(false);
  };

  if (finalTestimonials.length === 0 && !isEditing) return null;

  return (
    <section className="bg-secondaryColor flex flex-col items-center px-3 md:px-6 py-0 sm:pt-5 pb-16 font-lora relative">
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

      <div className="w-full md:w-[80%] lg:w-[70%] text-center text-primaryColor">
        <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold">
          Hear from those who know us Better
        </h1>
      </div>

      <div className="w-full mt-7 md:mt-16 max-w-7xl mx-auto">
        <Slider ref={sliderRef} {...settings}>
          {finalTestimonials.map((testimonial, index) => (
            <div key={index} className="focus:outline-none">
              <div className="relative bg-white rounded-3xl shadow-lg px-6 md:px-8 py-6 flex items-center h-[250px] mx-auto transition-all duration-300 max-w-[280px] sm:max-w-[300px] md:max-w-[320px] lg:max-w-[345px]">
                <div className="absolute -left-10 top-1/2 transform -translate-y-1/2">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-20 h-20 sm:w-28 sm:h-28 object-cover rounded-full border-[6px] border-[#F5F5DC]"
                  />
                </div>
                <div className="ml-16 pl-3 text-left">
                  <h1 className="text-lg sm:text-xl font-semibold italic">
                    {testimonial.name}
                  </h1>
                  <p className="mt-3 text-sm sm:text-base leading-relaxed text-gray-700">
                    "{testimonial.text}"
                  </p>
                </div>
              </div>
            </div>
          ))}
        </Slider>
      </div>

      {finalTestimonials.length > 1 && (
        <div className="flex justify-center items-center mt-10 sm:mt-14 gap-8">
          <button
            className="text-black object-cover p-2 rounded-full hover:scale-110 transition-transform"
            onClick={handlePrev}
            aria-label="Previous testimonial"
          >
            <img src={Spoon} alt="Previous" className="w-20 h-9" />
          </button>
          <button
            className="text-black object-cover p-2 rounded-full hover:scale-110 transition-transform"
            onClick={handleNext}
            aria-label="Next testimonial"
          >
            <img src={SpoonR} alt="Next" className="w-20 h-9" />
          </button>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Testimonials Section
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close edit modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {editTestimonials.map((testimonial, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-medium text-gray-800">
                      Testimonial #{index + 1}
                    </h4>
                    <button
                      onClick={() => handleDeleteTestimonial(index)}
                      disabled={editTestimonials.length <= 1}
                      className={`text-red-500 ${
                        editTestimonials.length <= 1 ? "opacity-50 cursor-not-allowed" : "hover:text-red-700"
                      }`}
                      aria-label={`Delete testimonial ${index + 1}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block mb-1 text-sm font-medium text-gray-900">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          maxLength={50}
                          value={testimonial.name}
                          onChange={(e) => handleTestimonialChange(index, "name", e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">{testimonial.name?.length || 0}/50 characters</p>
                      </div>

                      <div>
                        <label className="block mb-1 text-sm font-medium text-gray-900">
                          Testimonial <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={testimonial.text}
                          onChange={(e) => handleTestimonialChange(index, "text", e.target.value)}
                          maxLength={150}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          rows="4"
                        />
                        <p className="text-xs text-gray-500 mt-1">{testimonial.text?.length || 0}/150 characters</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block mb-1 text-sm font-medium text-gray-900">
                          Image <span className="text-red-500">*</span>
                        </label>
                        {testimonial.image && (
                          <img
                            src={testimonial.image}
                            alt="Preview"
                            className="w-24 h-24 object-cover rounded-lg mb-2"
                          />
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleTestimonialImageUpload(index, e)}
                          className="text-xs text-gray-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={handleAddTestimonial}
                className="w-full py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Testimonial
              </button>
            </div>

            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={isUploading || !areRequiredFieldsFilled()}
                className={`px-5 py-2.5 text-white bg-primaryColor rounded-lg text-sm font-medium ${
                  isUploading || !areRequiredFieldsFilled() ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isUploading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Feedback;
