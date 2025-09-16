import { Link } from "react-router-dom";
import { FaFacebookF, FaTwitter, FaInstagram, FaEdit } from "react-icons/fa";
import React, { useContext, useState, useEffect } from "react";
import { Context } from "../../../Context";
import { Modal } from "flowbite-react";
import { toast } from "react-toastify";
import { API, Storage } from "aws-amplify";
import InstitutionData from "../../../../Operation/institutionData.json";

const Footer = () => {
  const { institutionData, setInstitutionData } = useContext(Context);
  const finalLogoUrl =
    institutionData?.logoUrl || InstitutionData.logoUrl || "";
  const finalCompanyName =
    institutionData?.companyName || InstitutionData.companyName || "";
  const finalTagLine1 =
    institutionData?.tagLine1 || InstitutionData.tagLine1 || "";
  const finalUsefulLinks =
    institutionData?.usefulLinks && institutionData.usefulLinks.length > 0
      ? [...institutionData.usefulLinks]
      : InstitutionData.usefulLinks && InstitutionData.usefulLinks.length > 0
      ? [...InstitutionData.usefulLinks]
      : [];
  const finalAddress =
    institutionData?.Query_Address || InstitutionData.Query_Address || "";
  const finalPhone =
    institutionData?.Query_PhoneNumber ||
    InstitutionData.Query_PhoneNumber ||
    "";
  const finalSocialLinks =
    institutionData?.socialMediaLinks &&
    institutionData.socialMediaLinks.length > 0
      ? [...institutionData.socialMediaLinks]
      : InstitutionData.socialMediaLinks &&
        InstitutionData.socialMediaLinks.length > 0
      ? [...InstitutionData.socialMediaLinks]
      : [];
  const finalCopyrightText =
    institutionData?.copyrightText ||
    `© ${new Date().getFullYear()} ${finalCompanyName}. All rights reserved.`;

  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editData, setEditData] = useState({
    logoUrl: finalLogoUrl,
    companyName: finalCompanyName,
    tagLine1: finalTagLine1,
    usefulLinks: finalUsefulLinks,
    address: finalAddress,
    phone: finalPhone,
    socialMediaLinks: finalSocialLinks,
    copyrightText: finalCopyrightText,
  });

  const [logoFile, setLogoFile] = useState(null);

  const UserCtx = useContext(Context);
  const isAdmin = UserCtx.userData.userType === "admin";

  // Initialize with context data
  useEffect(() => {
    setEditData({
      logoUrl: finalLogoUrl,
      companyName: finalCompanyName,
      tagLine1: finalTagLine1,
      usefulLinks: finalUsefulLinks,
      address: finalAddress,
      phone: finalPhone,
      socialMediaLinks: finalSocialLinks,
      copyrightText: finalCopyrightText,
    });
  }, [institutionData]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditData((prev) => ({ ...prev, logoUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogoToS3 = async (file) => {
    try {
      const fileName = `logos/${institutionData.institution}-${Date.now()}-${
        file.name
      }`;
      await Storage.put(fileName, file, {
        contentType: file.type,
        level: "public",
      });
      const fileUrl = await Storage.get(fileName);
      return fileUrl.split("?")[0];
    } catch (error) {
      console.error("Error uploading logo to S3:", error);
      throw error;
    }
  };

  const handleLinkChange = (index, field, value) => {
    const newLinks = [...editData.usefulLinks];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setEditData((prev) => ({ ...prev, usefulLinks: newLinks }));
  };

  const addNewLink = () => {
    setEditData((prev) => ({
      ...prev,
      usefulLinks: [...prev.usefulLinks, { title: "New Link", url: "/" }],
    }));
  };

  const removeLink = (index) => {
    const newLinks = [...editData.usefulLinks];
    newLinks.splice(index, 1);
    setEditData((prev) => ({ ...prev, usefulLinks: newLinks }));
  };

  const handleSocialLinkChange = (platform, url) => {
    const newSocialLinks = [...editData.socialMediaLinks];
    const existingIndex = newSocialLinks.findIndex(
      (link) => link.platform === platform
    );

    if (existingIndex >= 0) {
      newSocialLinks[existingIndex] = { platform, url };
    } else {
      newSocialLinks.push({ platform, url });
    }

    setEditData((prev) => ({ ...prev, socialMediaLinks: newSocialLinks }));
  };

  const handleSave = async () => {
    try {
      setIsUploading(true);

      let finalLogo = editData.logoUrl;
      if (logoFile) {
        finalLogo = await uploadLogoToS3(logoFile);
      }

      const changedData = {};

      if (finalLogo !== finalLogoUrl) changedData.logoUrl = finalLogo;
      if (editData.companyName !== finalCompanyName)
        changedData.companyName = editData.companyName;
      if (editData.tagLine1 !== finalTagLine1)
        changedData.tagLine1 = editData.tagLine1;

      // Deep compare usefulLinks by JSON string
      if (
        JSON.stringify(editData.usefulLinks) !==
        JSON.stringify(finalUsefulLinks)
      ) {
        changedData.usefulLinks = editData.usefulLinks;
      }
      if (editData.address !== finalAddress)
        changedData.Query_Address = editData.address;
      if (editData.phone !== finalPhone)
        changedData.Query_PhoneNumber = editData.phone;

      // Deep compare socialMediaLinks by JSON string
      if (
        JSON.stringify(editData.socialMediaLinks) !==
        JSON.stringify(finalSocialLinks)
      ) {
        changedData.socialMediaLinks = editData.socialMediaLinks;
      }
      if (editData.copyrightText !== finalCopyrightText) {
        changedData.copyrightText = editData.copyrightText;
      }

      if (Object.keys(changedData).length === 0) {
        toast.info("No changes detected.");
        setIsEditing(false);
        setIsUploading(false);
        return;
      }

      // Compose optional index parameter
      const indexParam =
        institutionData.index !== undefined && institutionData.index !== null
          ? `&index=${institutionData.index}`
          : "";

      // Send only changed fields in API call
      await API.put(
        "main",
        `/admin/editable-ui/${institutionData.institution}?query=footer${indexParam}`,
        {
          body: changedData,
        }
      );

      // Update local context state merging changed fields
      setInstitutionData((prev) => ({
        ...prev,
        ...changedData,
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

      setLogoFile(null);
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
      logoUrl: finalLogoUrl,
      companyName: finalCompanyName,
      tagLine1: finalTagLine1,
      usefulLinks: finalUsefulLinks,
      address: finalAddress,
      phone: finalPhone,
      socialMediaLinks: finalSocialLinks,
      copyrightText: finalCopyrightText,
    });
    setLogoFile(null);
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

  // Combine mandatory links with institution's useful links
  const quickLinks = [
    { title: "Login", url: "/login" },
    { title: "Products", url: "/product" },
    ...(editData.usefulLinks || []),
  ];

  const socialIcons = {
    Facebook: FaFacebookF,
    Twitter: FaTwitter,
    Instagram: FaInstagram,
  };

  const getSocialLink = (platform) => {
    return editData.socialMediaLinks?.find((link) => link.platform === platform)
      ?.url;
  };

  const isValidSocialLink = (platform) => {
    const link = getSocialLink(platform);
    return link && link.trim() !== "" && link !== "#";
  };
  const getValidSocialPlatforms = () => {
    return Object.keys(socialIcons).filter((platform) =>
      isValidSocialLink(platform)
    );
  };

  const isFormValid = () => {
    const expectedPrefixes = {
      Instagram: "https://www.instagram.com/",
      Facebook: "https://www.facebook.com/",
      Twitter: "https://twitter.com/",
    };

    for (const [platform, expected] of Object.entries(expectedPrefixes)) {
      const url = getSocialLink(platform);
      if (url && !url.startsWith(expected)) {
        return false;
      }
    }

    return !!editData.logoUrl;
  };

  return (
    <footer className="bg-[#2C2C2C] text-white relative">
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

      <div className="max-w-[1440px] mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Section */}
          <div>
            <div
              onClick={scrollToTop}
              className="flex items-center gap-2.5 mb-6 cursor-pointer transition-opacity duration-300 hover:opacity-80"
            >
              <img
                src={editData.logoUrl}
                alt={`${editData.companyName} Logo`}
                className="w-14 h-14 object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  // e.target.src = 'https://via.placeholder.com/56';
                }}
              />
              <span className="text-[#E8C9A3] text-base tracking-tight">
                {editData.companyName}
              </span>
            </div>
            <p className="text-white/60 text-sm">{editData.tagLine1}</p>
          </div>

          {/* Quick Links Section */}
          <div>
            <h3 className="text-white font-medium mb-4">Quick Links</h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={`${link.url}-${index}`}>
                  <Link
                    to={link.url}
                    className="text-white/60 hover:text-white transition-colors duration-300"
                  >
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="text-white font-medium mb-4">Contact</h3>
            <ul className="space-y-3 text-white/60">
              <li>{editData.address || "No address provided"}</li>
              <li>
                {editData.phone ? (
                  <a
                    href={`tel:${editData.phone}`}
                    className="text-white/60 hover:text-white transition-colors duration-300"
                  >
                    {editData.phone}
                  </a>
                ) : (
                  "No phone number provided"
                )}
              </li>
            </ul>
          </div>

          {/* Social Media Section - Only show if there are valid social links */}
          {getValidSocialPlatforms().length > 0 && (
            <div>
              <h3 className="text-white font-medium mb-4">Follow Us</h3>
              <div className="flex gap-4">
                {getValidSocialPlatforms().map((platform) => {
                  const Icon = socialIcons[platform];
                  const socialLink = getSocialLink(platform);

                  return (
                    <a
                      key={platform}
                      href={socialLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 bg-white/10 hover:bg-white/20"
                    >
                      <Icon className="text-white" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Copyright Section */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center text-white/40 text-sm">
          {editData.copyrightText}
        </div>
      </div>

      {/* Flowbite Modal */}
      <Modal show={isEditing} onClose={handleCancel} size="lg">
        <Modal.Header className="border-b p-4">
          Edit Footer Content
        </Modal.Header>
        <Modal.Body className="p-4 space-y-4">
          {/* Brand Info */}
          <div className="space-y-2">
            <h3 className="font-medium">
              Brand Logo <span className="text-red-500">*</span>
            </h3>
            <div className="flex items-center gap-4">
              {editData.logoUrl && (
                <img
                  src={editData.logoUrl}
                  alt="Logo Preview"
                  className="w-16 h-16 object-contain rounded"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="text-sm"
                disabled={isUploading}
              />
            </div>
            {!editData.logoUrl && (
              <p className="text-sm text-red-500 mt-1">
                Brand logo is required.
              </p>
            )}
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-white">
                Phone Number
              </label>
              <input
                type="text"
                name="phone"
                value={editData.phone}
                onChange={handleInputChange}
                placeholder="Enter phone number"
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                disabled={isUploading}
              />
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-white">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={editData.address}
                onChange={handleInputChange}
                placeholder="Enter address"
                className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                disabled={isUploading}
              />
            </div>
          </div>

          {/* Useful Links */}
          <div>
            <h3 className="font-medium mb-2">Quick Links</h3>
            <div className="space-y-4 max-h-48 overflow-y-auto p-2 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
              {editData.usefulLinks.map((link, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={link.title}
                    placeholder="Link Text"
                    onChange={(e) =>
                      handleLinkChange(index, "title", e.target.value)
                    }
                    className="flex-1 p-2 text-sm border rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                    disabled={isUploading}
                  />
                  <input
                    type="url"
                    value={link.url}
                    placeholder="URL"
                    onChange={(e) =>
                      handleLinkChange(index, "url", e.target.value)
                    }
                    className="flex-1 p-2 text-sm border rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                    disabled={isUploading}
                  />
                  <button
                    onClick={() => removeLink(index)}
                    disabled={isUploading}
                    className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addNewLink}
              disabled={isUploading}
              className="mt-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              + Add Link
            </button>
          </div>

          {/* Social Links */}
          <div>
            <h3 className="font-medium mb-2">Social Links</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(socialIcons).map(([platform, Icon]) => {
                const value = getSocialLink(platform) || "";
                const expectedPrefixes = {
                  Instagram: "https://www.instagram.com/",
                  Facebook: "https://www.facebook.com/",
                  Twitter: "https://twitter.com/",
                };
                const expected = expectedPrefixes[platform];
                const isInvalid =
                  value && expected && !value.startsWith(expected);

                return (
                  <div key={platform} className="flex flex-col">
                    <label className="text-sm font-medium mb-1">
                      {platform}
                    </label>
                    <div className="flex items-center gap-2">
                      <Icon className="text-xl text-gray-600 dark:text-gray-400" />
                      <input
                        type="url"
                        value={value}
                        placeholder={`${platform} URL`}
                        onChange={(e) =>
                          handleSocialLinkChange(platform, e.target.value)
                        }
                        className={`flex-1 p-2 text-sm border rounded focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:border-gray-500 ${
                          isInvalid ? "border-red-500" : "border-gray-300"
                        } dark:text-white`}
                        disabled={isUploading}
                      />
                    </div>
                    {isInvalid && (
                      <p className="text-xs text-red-500 mt-1">
                        URL must start with {expected}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer className="border-t p-4">
          <div className="flex justify-center w-full">
            <button
              onClick={handleSave}
              disabled={isUploading || !isFormValid()}
              className={`text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center focus:outline-none
    ${
      isUploading || !isFormValid()
        ? "bg-gray-400 cursor-not-allowed"
        : "bg-primaryColor hover:bg-primaryColor/90 focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
    }`}
            >
              {isUploading ? "Saving..." : "Save"}
            </button>
          </div>
        </Modal.Footer>
      </Modal>
    </footer>
  );
};

export default Footer;
