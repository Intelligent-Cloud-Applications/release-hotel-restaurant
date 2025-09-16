import React, { createContext, useEffect, useState } from "react";
import initialInstitutionData from "../constants";
import data from "../../Operation/data.json";
import { API, Auth } from "aws-amplify";
import InstitutionData from "../../Operation/institutionData.json";

const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour
const BACKGROUND_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const Context = createContext({});

const Provider = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [userData, setUserData] = useState({});
  const [institutionData, setInstitutionData] = useState(initialInstitutionData);
  const [items, setItems] = useState([]);
  const [loader, setLoader] = useState(false);
  const [auth, setAuth] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [hotelBookings, setHotelBookings] = useState([]); 

  const saveToCache = (key, data) => {
    try {
      const cacheData = {
        timestamp: Date.now(),
        data: data,
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
      console.log(
        `${key} saved to cache at`,
        new Date(cacheData.timestamp).toLocaleTimeString()
      );
    } catch (error) {
      console.error(`Error saving ${key} to cache:`, error);
    }
  };

  const checkCache = (key) => {
    try {
      const cachedDataString = localStorage.getItem(key);
      if (!cachedDataString) {
        console.log(`No cache found for ${key}`);
        return null;
      }

      const cachedData = JSON.parse(cachedDataString);
      const { timestamp, data } = cachedData;

      if (Date.now() - timestamp > CACHE_EXPIRY) {
        console.log(
          `Cache expired for ${key}. Last updated:`,
          new Date(timestamp).toLocaleTimeString()
        );
        return null;
      }

      console.log(
        `Valid cache found for ${key}. Last updated:`,
        new Date(timestamp).toLocaleTimeString()
      );
      return data;
    } catch (error) {
      console.error(`Error reading ${key} from cache:`, error);
      return null;
    }
  };

  const fetchInstitutionData = async (isBackgroundRefresh = false) => {
    const defaultColors = {
      LightPrimaryColor: "#FFFFFF",
      LightSecondaryColor: "#F7F7F7",
      PrimaryColor: "#6B4226",
      SecondaryColor: "#D4A373",
    };

    try {
      if (!isBackgroundRefresh) {
        setLoader(true);
      }

      const response = await API.get(
        "main",
        `/any/cafe-detail/${institutionData.institution}?index=${institutionData.index}`
      );

      const updatedResponse = {
        ...response,
        ...Object.keys(defaultColors).reduce((acc, key) => {
          acc[key] =
            response[key] && response[key].trim() !== ""
              ? response[key]
              : defaultColors[key];
          return acc;
        }, {}),
      };

      setInstitutionData((prevData) => ({
        ...prevData,
        ...updatedResponse,
      }));

      saveToCache("cafeInstitutionData", updatedResponse);
      setLastUpdated(new Date());
      return true;
    } catch (e) {
      console.log("Error fetching institution data:", e);
      return false;
    } finally {
      if (!isBackgroundRefresh) {
        setLoader(false);
      }
    }
  };

  const fetchItems = async (isBackgroundRefresh = false) => {
    try {
      if (!isBackgroundRefresh) {
        setLoader(true);
      }

      const itemsData = await API.get(
        "main",
        `/any/list-items/${institutionData.institution}`,
        {}
      );
      const finalItems =
        Array.isArray(itemsData) && itemsData.length > 0
          ? itemsData
          : InstitutionData.items || [];

      setItems(finalItems);
      saveToCache("cafeItems", itemsData);
      setLastUpdated(new Date());
      return true;
    } catch (e) {
      console.log("Error fetching items:", e);
      const cached = checkCache("cafeItems");
      if (cached && cached.length > 0) {
        setItems(cached);
      } else {
        setItems(InstitutionData.items || []);
      }
      return false;
    } finally {
      if (!isBackgroundRefresh) {
        setLoader(false);
      }
    }
  };

  const fetchUserData = async (isBackgroundRefresh = false) => {
    try {
      if (!isBackgroundRefresh) {
        setLoader(true);
      }

      await Auth.currentAuthenticatedUser();
      const userData = await API.get(
        "main",
        `/user/get-userdata/${institutionData.institution}`,
        {}
      );

      setUserData(userData);
      setAuth(true);
      saveToCache("cafeUserData", userData);
      return true;
    } catch (e) {
      console.log("Error fetching user data:", e);
      setAuth(false);
      return false;
    } finally {
      if (!isBackgroundRefresh) {
        setLoader(false);
      }
    }
  };

  const refreshData = async (isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) {
      setIsBackgroundRefreshing(true);
    } else {
      setLoader(true);
    }

    console.log(
      `${isBackgroundRefresh ? "Background" : "Foreground"} refresh started`
    );

 await Promise.all([
      fetchInstitutionData(true),
      fetchItems(true),
      fetchUserData(true),
    ]);

    if (isBackgroundRefresh) {
      setIsBackgroundRefreshing(false);
    } else {
      setLoader(false);
      setReady(true);
    }

    console.log(
      `${isBackgroundRefresh ? "Background" : "Foreground"} refresh completed`
    );
  };

  const clearCache = () => {
    try {
      localStorage.removeItem("cafeInstitutionData");
      localStorage.removeItem("cafeItems");
      localStorage.removeItem("cafeUserData");
      localStorage.removeItem("hotelBookings");
      console.log("Cache cleared");
      refreshData(false);
      return true;
    } catch (error) {
      console.error("Error clearing cache:", error);
      return false;
    }
  };

  const addHotelService = async (booking_id, services) => {
    try {
      setLoader(true);
      const response = await API.patch(
        "hotelHouseKeeping",
        `/bookings/services?institutionId=${data.institutionId}`,
        {
          body: {
            institutionId: data.institutionId,
            booking_id,
            services,
          },
        }
      );
      console.log("Hotel service added successfully:", response);
      return true;
    } catch (e) {
      console.log("Error adding hotel service:", e);
      return false;
    } finally {
      setLoader(false);
    }
  };

  const checkIfReady = (institutionDataLoaded, itemsLoaded) => {
    return institutionDataLoaded && itemsLoaded;
  };

  useEffect(() => {
    const init = async () => {
      setLoader(true);

      let institutionDataLoaded = false;
      let itemsLoaded = false;

      const cachedInstitutionData = checkCache("cafeInstitutionData");
      if (cachedInstitutionData) {
        setInstitutionData((prevData) => ({
          ...prevData,
          ...cachedInstitutionData,
        }));
        institutionDataLoaded = true;
      }

      const cachedItems = checkCache("cafeItems");
      if (cachedItems) {
        setItems(cachedItems);
        itemsLoaded = true;
      }

      const cachedUserData = checkCache("cafeUserData");
      if (cachedUserData) {
        setUserData(cachedUserData);
        setAuth(true);
      }

      const cachedHotelBookings = checkCache("hotelBookings");
      if (cachedHotelBookings) {
        setHotelBookings(cachedHotelBookings);
      }

      if (checkIfReady(institutionDataLoaded, itemsLoaded)) {
        setLoader(false);
        setReady(true);
        setTimeout(() => {
          console.log("Starting background refresh after cache load");
          refreshData(true);
        }, 2000);
      } else {
        if (!institutionDataLoaded) {
          try {
            const response = await API.get(
              "main",
              `/any/cafe-detail/${institutionData.institution}?index=${institutionData.index}`
            );
            setInstitutionData((prevData) => ({
              ...prevData,
              ...response,
            }));
            saveToCache("cafeInstitutionData", response);
            institutionDataLoaded = true;
          } catch (e) {
            console.log("Error fetching institution data:", e);
          }
        }

        if (!itemsLoaded) {
          try {
            const itemsData = await API.get(
              "main",
              `/any/list-items/${institutionData.institution}`,
              {}
            );
            setItems(itemsData);
            saveToCache("cafeItems", itemsData);
            itemsLoaded = true;
          } catch (e) {
            console.log("Error fetching items:", e);
          }
        }

        try {
          await Auth.currentAuthenticatedUser();
          const userData = await API.get(
            "main",
            `/user/get-userdata/${institutionData.institution}`,
            {}
          );
          setUserData(userData);
          setAuth(true);
          saveToCache("cafeUserData", userData);
        } catch (e) {
          console.log("Error fetching user data:", e);
        }

        setLoader(false);
        setReady(true);
         const response = await API.get(
              "main",
              `/any/cafe-detail/${institutionData.institution}?index=${institutionData.index}`
            );

            setInstitutionData((prevData) => ({
              ...prevData,
              ...response,
            }));
 localStorage.removeItem("cafeInstitutionData");
            saveToCache("cafeInstitutionData", response);
      }
    };

    init();

    const intervalId = setInterval(() => {
      if (!isBackgroundRefreshing && !loader) {
        console.log("Running periodic background refresh");
        refreshData(true);
      } else {
        console.log("Skipping periodic refresh - another operation in progress");
      }
    }, BACKGROUND_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <Context.Provider
      value={{
        userData,
        setUserData,
        institutionData,
        setInstitutionData,
        items,
        setItems,
        loader,
        setLoader,
        ready,
        setReady,
        auth,
        setAuth,
        refreshData: () => refreshData(false),
        clearCache,
        lastUpdated,
        isBackgroundRefreshing,
        hotelBookings,
        setHotelBookings,
        addHotelService,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export { Context, Provider };