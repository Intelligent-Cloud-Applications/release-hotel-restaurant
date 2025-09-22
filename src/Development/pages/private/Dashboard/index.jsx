import Header from "../../../components/Header";
import { Outlet } from "react-router-dom";
import SideBar from "./SideBar";
import React, { useContext, useState, useEffect } from "react";
import { Context } from "../../../Context";
import { API } from "aws-amplify";
import { toast } from "react-toastify";
const Dashboard = () => {
  const { userData, institutionData, setLoader } = useContext(Context);
  const [showDayStartModal, setShowDayStartModal] = useState(false);

  // Check if day start modal should be shown
  useEffect(() => {
    if (
      (userData?.userType === "admin" &&
      (institutionData?.dayStart === false ||
        institutionData?.dayStart === undefined) ) &&
      institutionData?.bar_integration === "Yes"
    ) {
      setShowDayStartModal(true);
    } else {
      setShowDayStartModal(false);
    }
  }, [institutionData?.dayStart, userData?.userType]);

  const handleStartDay = async () => {
    try {
      console.log("🔄 Starting day process...");
      setLoader(true);

      const apiUrl = `/admin/start-day/${institutionData.institution}?index=${institutionData.index}`;
      console.log("🌐 API URL:", apiUrl);

      const requestBody = {
        dayStart: true,
        type: institutionData?.bar_integration === "Yes" ? "bar" : "cafe",
      };
      console.log("📦 Request body:", requestBody);

      const response = await API.post("main", apiUrl, {
        body: requestBody,
      });

      console.log("✅ API Response:", response);

      if (response.message && response.message.includes("successfully")) {
        toast.success("Day started successfully!");
        setShowDayStartModal(false);

        

        // Refresh to update context
        window.location.reload();
      } else {
        console.log("❌ Response indicates failure:", response);
        toast.error("Failed to start day. Please try again.");
      }
    } catch (error) {
      console.error("💥 Error starting day:", error);
      toast.error("Failed to start day. Please try again.");
    } finally {
      console.log("🏁 Setting loader to false");
      setLoader(false);
    }
  };

  const handleCancelDayStart = () => {
    setShowDayStartModal(false);
    toast.info("Day start cancelled. Some features may be limited.");
  };
  return (
    <>
      {/* Day Start Modal */}
      {showDayStartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
            <div className="text-center">
              <div className="mb-4">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
                  <svg
                    className="h-6 w-6 text-yellow-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Day Start Required
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  The business day has not been started yet. You need to start
                  the day to access the admin dashboard and begin operations.
                </p>
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    console.log("🖱️ Start Day button clicked!");
                    handleStartDay();
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200">
                  Start Day
                </button>
                <button
                  onClick={handleCancelDayStart}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded-lg font-medium transition-colors duration-200">
                  Cancel
                </button>
              </div>

              <div className="mt-4 text-xs text-gray-400">
                Starting the day will enable all admin functions and operations.
              </div>
            </div>
          </div>
        </div>
      )}

      {userData?.userType !== "admin" && <Header />}
      <main className="grid grid-cols-[auto_1fr] min-h-[93vh]">
        <SideBar />
        <Outlet />
      </main>
    </>
  );
};

export default Dashboard;
