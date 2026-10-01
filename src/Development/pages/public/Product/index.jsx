import React, { useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Product from './Product';
import { Context } from '../../../Context';
import Header from '../../../components/Header';
import Footer from '../Home/Footer';
import { API } from 'aws-amplify';

const index = () => {
  const { items: contextItems, setItems: setContextItems, institutionData } = useContext(Context);
  const [items, setItems] = useState(contextItems || []);
  const [stocks, setStocks] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();

  const institution =
    institutionData?.institution ||
    institutionData?.id ||
    institutionData?.name ||
    "";

  useEffect(() => {
    if (contextItems && Array.isArray(contextItems) && contextItems.length > 0) {
      setItems(contextItems);
    }
  }, [contextItems]);

  useEffect(() => {
    const fetchFreshData = async () => {
      if (!institution) return;
      try {
        const [itemsRes, stockRes] = await Promise.all([
          API.get("main", `/any/list-items/${institution}`, {}).catch(() => []),
          API.get("main", `/admin/stock-list-items/${institution}`).catch(() => []),
        ]);
        if (Array.isArray(itemsRes) && itemsRes.length > 0) {
          setItems(itemsRes);
          if (setContextItems) setContextItems(itemsRes);
        }
        if (Array.isArray(stockRes)) {
          setStocks(stockRes);
        }
      } catch (err) {
        console.error("Error fetching fresh items/stocks in Product page:", err);
      }
    };
    fetchFreshData();
  }, [institution]);

  // Improved table validation function with debugging
  const isTableValid = (tableName, institutionData) => {
    console.log('Checking table:', tableName, 'Type:', typeof tableName);
    console.log('Institution data:', institutionData);

    if (!institutionData || !institutionData.Table || !Array.isArray(institutionData.Table)) {
      console.log('No valid table data found in institution data');
      return false;
    }

    // Log available tables for debugging
    console.log('Available tables:', institutionData.Table.map(t => t.tableNo));

    // Make sure we're comparing strings to strings
    const tableFound = institutionData.Table.some(table => String(table.tableNo) === String(tableName));
    console.log('Table found:', tableFound);

    return tableFound;
  };

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const tableNameFromQuery = queryParams.get('tableName');

    console.log('Table name from query:', tableNameFromQuery);
    console.log('Institution object:', institutionData);

    if (tableNameFromQuery) {
      const isValid = isTableValid(tableNameFromQuery, institutionData);
      if (!isValid) {
        console.log('Invalid table detected, navigating away');
        toast.error('Invalid table selected. Please scan a valid QR code.');
        navigate('/product', { replace: true });
      } else {
        console.log('Valid table confirmed:', tableNameFromQuery);
      }
    }
  }, [location, institutionData, navigate]);

  return (
    <div>
      <Header />
      <Product items={items} stocks={stocks} />
      <Footer />
    </div>
  );
};

export default index