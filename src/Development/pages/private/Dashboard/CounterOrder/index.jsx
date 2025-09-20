
import React, { useEffect, useContext, useState } from 'react';
import RestaurantPOS from './ResturentPos';
import { API } from 'aws-amplify';
import { Context } from '../../../../Context';
import { toast } from 'react-toastify';
import Error from '../../../Error';

const CounterOrder = () => {
  const {
    institutionData,
    userData,
    setHotelBookings,
    setLoader,
  } = useContext(Context);
  const [itemsData, setItemsData] = useState([]);
  const [hotelBooking, setHotelBooking] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHotelBookings = async () => {
    console.log('fetchHotelBookings called with integration:', institutionData?.integration);
    if (institutionData?.integration !== 'HOTEL') {
      setHotelBookings([]);
      setHotelBooking([]);
      console.log('Not a hotel integration, setting empty hotelBookings');
      return;
    }

    try {
      setLoader(true);
      const response = await API.get(
        'hotelHouseKeeping',
        `/bookings/active?institutionId=${institutionData.institution}`
      );

      if (!response.list || response.list.length === 0) {
        console.warn('No hotel bookings found for institutionId');
        setHotelBookings([]);
        setHotelBooking([]);
        // toast.warn('No active hotel bookings found.');
        return;
      }

      const dataList = response.list.map((item) => ({
        bookingId: item.booking.booking_id,
        roomId: item.room.room_id,
        roomNumber: item.room.room_number,
      }));

      setHotelBookings(dataList);
      setHotelBooking(dataList);
      console.log('Hotel bookings fetched:', dataList);
    } catch (e) {
      console.error('Error fetching hotel bookings:', e);
      toast.error('Failed to fetch hotel bookings. Please try again.');
      setHotelBookings([]);
      setHotelBooking([]);
    } finally {
      setLoader(false);
    }
  };

const fetchItems = async () => {
  try {
    setLoader(true);
    const items = await API.get(
      'main',
      `/any/list-items/${institutionData.institution}`,
      {}
    );
    
    // Filter items based on bar_integration and category
    let filteredItems = items.filter((item) => item.outOfStock !== true);
    
    if (institutionData?.bar_integration !== 'Yes') {
      filteredItems = filteredItems.filter((item) => {
        // If category is 'beverage' (case-insensitive), always include it
        if (item.category?.toLowerCase() === 'beverage') {
          return true;
        }
        // For other categories, only include 'cafe' type items
        return !item.type || item.type === 'cafe';
      });
    }
    
    setItemsData(filteredItems);
    console.log('Filtered items fetched:', filteredItems);
  } catch (e) {
    console.error('Error fetching items:', e);
    toast.error('Failed to fetch menu items. Please try again.');
  } finally {
    setLoader(false);
  }
};

  useEffect(() => {
    console.log('useEffect triggered with institutionData:', institutionData);

    const fetchData = async () => {
      if (!institutionData?.institution) {
        console.warn('institutionData.institution is not available');
        toast.warn('Institution data not loaded. Please refresh the page.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        await Promise.all([fetchItems(), fetchHotelBookings()]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [institutionData?.institution, institutionData?.integration, institutionData?.bar_integration, setHotelBookings, setLoader]);

  // Optional: Periodic refresh for hotel bookings
  useEffect(() => {
    if (institutionData?.integration !== 'HOTEL') return;

    const interval = setInterval(() => {
      console.log('Periodic refresh of hotel bookings');
      fetchHotelBookings();
    }, 300000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, [institutionData?.integration]);

  if (userData?.userType !== 'admin') {
    return <Error message="Access Denied: Admins Only" />;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  console.log('Passing hotelBooking to RestaurantPOS:', hotelBooking);
  return (
    <RestaurantPOS
      itemsData={itemsData}
      institutionData={institutionData}
      userData={userData}
      hotelBookings={hotelBooking}
    />
  );
};

export default CounterOrder;
