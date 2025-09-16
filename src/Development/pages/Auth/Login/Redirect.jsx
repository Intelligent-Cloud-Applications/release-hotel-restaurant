import {useContext, useEffect} from "react";
import {API, Auth} from "aws-amplify";
import {toast} from "react-toastify";
import {Context} from "../../../Context";
import {useNavigate} from "react-router-dom";

const Redirect = () => {
  const { 
    setLoader, 
    setUserData, 
    institutionData, 
    setAuth, 
    hotelBookings, 
    setHotelBookings 
  } = useContext(Context);
  const { InstitutionId } = institutionData;
  const navigate = useNavigate();

  const fetchHotelBookings = async () => {
    if (institutionData.integration === "HOTEL") {
      try {
        const response = await API.get(
          "hotelHouseKeeping",
          `/bookings/active?institutionId=${institutionData.institutionId}`
        );
        const dataList = response.list.map((item) => ({
          bookingId: item.booking.booking_id,
          roomId: item.room.room_id,
          roomNumber: item.room.room_number,
        }));
        setHotelBookings(dataList);
        console.log("Hotel bookings fetched after login:", dataList);
      } catch (e) {
        console.log("Error fetching hotel bookings after login:", e);
      }
    }
  };

  useEffect(() => {
    const redirect = async () => {
      setLoader(true);
      try {
        await Auth.currentAuthenticatedUser();

        const userdata = await API.get(
          'main',
          `/user/get-userdata/${InstitutionId}`,
          {}
        );
        setUserData(userdata);
        setAuth(true);
        await fetchHotelBookings();
        
        toast.info('Logged in');
        setLoader(false);
        const path = window.sessionStorage.getItem('login_redirect');
        window.sessionStorage.removeItem('login_redirect');
        
        navigate('/dashboard/profile', { replace: true });
      } catch (e) {
        toast.error('Please signup first');
        setLoader(false);
        navigate('/signup');
      }
    }

    redirect();
  }, []);
}

export default Redirect;