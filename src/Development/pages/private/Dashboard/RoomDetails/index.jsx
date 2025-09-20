import React, { useEffect, useState, useCallback, useContext } from "react";
import { API } from "aws-amplify";
import { PaginatedTable } from "../../../../common/DataDisplay";
import { FaHotel } from "react-icons/fa6";
import { Context } from "../../../../Context";

// Search Bar Component (flexible width)
const SearchBar = ({
  searchQuery,
  setSearchQuery,
  className = "w-64",
  style,
}) => (
  <div className={`mb-6 ${className}`}>
    <input
      type="text"
      placeholder="Search by room number, type, or dates..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className={`w-full p-3 rounded-lg border focus:outline-none`}
      style={style}
    />
  </div>
);

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center p-12">
    <div className="relative">
      <div className="w-16 h-16 border-4 border-gray-300 border-t-primaryColor rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-primaryColor">
        <FaHotel />
      </div>
    </div>
    <p className="mt-4 text-primaryColor font-medium">Loading Details...</p>
  </div>
);

// Error Component
const ErrorDisplay = ({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="text-red-500 text-xl mb-4">⚠️ Error</div>
      <p className="text-gray-600 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
        Try Again
      </button>
    </div>
  </div>
);

// Main RoomDetails Component
const RoomDetails = () => {
  const [roomDetails, setRoomDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { institutionData } = useContext(Context);
  const primary =
    (institutionData && institutionData.PrimaryColor) || "#6B4226";

  // Memoized fetch function
  const fetchRoomDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get(
        "hotelHouseKeeping",
        `/bookings/active?institutionId=${institutionData.InstitutionId}`
      );
      console.log("Room Details Response:", response);
      setRoomDetails(response.list || []);
    } catch (error) {
      console.error("Error fetching room details:", error);
      setError(error.message || "Failed to fetch room details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoomDetails();
  }, [fetchRoomDetails]);

  // Format date from timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const d = new Date(timestamp);
    if (isNaN(d)) return "Invalid date";
    // Return date with time (24-hour format HH:MM)
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Calculate total charges for a booking
  const calculateTotalCharges = (detailedServices) => {
    let total = 0;
    if (detailedServices) {
      Object.values(detailedServices).forEach((day) => {
        if (Array.isArray(day)) {
          day.forEach((service) => {
            total +=
              (service.food_charges || 0) +
              (service.minibar_charges || 0) +
              (service.laundry_charges || 0) +
              (service.manual_charges || 0) +
              (service.extra_bed_charges || 0);
          });
        }
      });
    }
    return total;
  };

  // Prepare and sort table data
  const tableHeaders = [
    "Room No",
    "Room Type",
    "No. of Persons",
    "No. of Children",
    "Check-in",
    "Check-out",
  ];

  const tableData = roomDetails.map((roomData) => {
    const { room, booking } = roomData;
    return [
      room.room_number,
      room.room_type,
      booking?.no_of_adults || 0,
      booking?.no_of_children || 0,
      booking?.checkin_date ? formatDate(booking.checkin_date) : "N/A",
      booking?.checkout_date ? formatDate(booking.checkout_date) : "N/A",
    ];
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={fetchRoomDetails} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-full mx-auto">
        {/* Centered title with search under it (search left-aligned) */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 text-center">
            Room Management
          </h2>

          <div className="mt-3 flex justify-start">
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              className="w-1/3"
              style={{ borderColor: primary }}
            />
          </div>
        </div>

        <PaginatedTable
          head={tableHeaders}
          data={tableData}
          itemsPerPage={7}
          searchQuery={searchQuery}
          className="shadow-lg rounded-lg"
        />
      </div>
    </div>
  );
};

export default RoomDetails;
