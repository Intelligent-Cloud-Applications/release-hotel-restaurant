import React, { useState, useEffect, useCallback, useContext } from 'react';
import { API } from 'aws-amplify';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Context } from '../../../../Context';

const CashBookManager = () => {
  const { institutionData } = useContext(Context);
  const { institution } = institutionData || {};

  const [dayEndData, setDayEndData] = useState(null);
  const [ordersData, setOrdersData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [formData, setFormData] = useState({
    openingCash: 0,
    closingCash: 0,
    totalAmount: 0,         // total OUTFLOW (sum of movement amounts)
    cashFromOrders: 0,
    amount: [{ amount: '', to: '', narration: '' }]
  });
  const [showForm, setShowForm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [warningMsg, setWarningMsg] = useState('');

  // ---------- utilities ----------
  const getDateId = useCallback((date) => {
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }, []);

  const formatDate = useCallback((date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }, []);

  const toTimestamp = (d) => {
    if (d == null) return 0;
    if (typeof d === 'number') return d;
    const parsed = Date.parse(d);
    if (!isNaN(parsed)) return parsed;
    const n = Number(d);
    return isNaN(n) ? 0 : n;
  };

  // ---------- stricter cash sum ----------
  const sumCashFromOrders = useCallback((orders = [], predicate = null) => {
    if (!Array.isArray(orders) || orders.length === 0) return 0;

    const defaultPredicate = (order) => {
      if (!order) return false;
      if (order.cancel === true || order.isCancelled === true) return false;
      if (typeof order.paymentStatus !== 'undefined' && order.paymentStatus !== true) return false;

      if (order.paymentMethod === 'Cash') return true;

      if (Array.isArray(order.paymentMethods)) {
        return order.paymentMethods.some(p => p && p.method === 'Cash' && (parseFloat(p.amount) || 0) > 0);
      }

      return false;
    };

    const pred = typeof predicate === 'function' ? predicate : defaultPredicate;

    return orders.reduce((total, order) => {
      if (!pred(order)) return total;
      let orderCash = 0;
      if (order.paymentMethod === 'Cash') {
        orderCash = parseFloat(order.totalAmount) || 0;
      } else if (Array.isArray(order.paymentMethods)) {
        orderCash = order.paymentMethods.reduce((s, p) => {
          return p && p.method === 'Cash' ? s + (parseFloat(p.amount) || 0) : s;
        }, 0);
      }
      return total + orderCash;
    }, 0);
  }, []);

  const fetchAllOrdersUpToDate = useCallback(async (targetDate) => {
    if (!institution) return [];
    try {
      const response = await API.get('main', `/admin/list-orders/${institution}`, {
        queryStringParameters: { type: 'cafe' }
      });
      const allOrders = Array.isArray(response) ? response : [];
      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);
      return allOrders.filter(o => (toTimestamp(o.createdAt || o.updatedAt) <= endDate.getTime()));
    } catch (err) {
      console.error('Error fetching orders (all):', err);
      return [];
    }
  }, [institution]);

  const calculateTotalAmount = useCallback((amounts = []) => {
    // Still sum positive movement amounts — they represent outflows
    return (amounts || []).reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + (amount > 0 ? amount : 0);
    }, 0);
  }, []);

  const getFilteredOrdersForSelectedDate = useCallback(() => {
    if (!Array.isArray(ordersData) || ordersData.length === 0) return [];
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(selectedDate);
    endDate.setHours(23, 59, 59, 999);
    return ordersData.filter(order => {
      const ts = toTimestamp(order.createdAt || order.updatedAt);
      return ts >= startDate.getTime() && ts <= endDate.getTime();
    });
  }, [ordersData, selectedDate]);

  // ---------- corrected opening cash ----------
  const calculateOpeningCash = useCallback(async (currentDayData, targetDate) => {
    setWarningMsg('');
    if (!institution) return;

    const allOrdersUpToDate = await fetchAllOrdersUpToDate(targetDate);
    const currentDayOrders = getFilteredOrdersForSelectedDate(); // Orders for the selected date

    let openingCash = 0;
    let cashFromOrders = 0;

    if (currentDayData && currentDayData.data) {
      const dayData = currentDayData.data;
      const recordedClosingCash = parseFloat(dayData.closingCash) || 0;
      const closingOrderId = dayData.closingOrderId;

      // Opening cash is always the previous day's closing cash
      openingCash = recordedClosingCash;
      setIsUpdating(true);

      // For updating: cashFromOrders should be ALL eligible cash orders for the current day
      // (Don't filter by closing order timestamp when updating existing record)
      cashFromOrders = sumCashFromOrders(currentDayOrders, () => true);
      
      // Verify if the closing order is still valid (exists and was paid)
      if (closingOrderId) {
        const closingOrderExists = currentDayOrders.some(order => 
          order.orderId === closingOrderId && 
          !(order.cancel === true || order.isCancelled === true) &&
          (order.paymentStatus === true || 
           (order.paymentMethod === 'Cash') ||
           (Array.isArray(order.paymentMethods) && 
            order.paymentMethods.some(p => p && p.method === 'Cash' && (parseFloat(p.amount) || 0) > 0)))
        );
        
        if (!closingOrderExists) {
          setWarningMsg(`⚠️ Closing order ${closingOrderId} is no longer valid. Consider updating the closing order reference.`);
        }
      }

    } else {
      // For new record: opening cash is 0 (or could be previous day's closing if available)
      // But for simplicity, start from 0 if no previous record
      openingCash = 0;
      
      // Sum ALL eligible cash orders up to and including the target date
      cashFromOrders = sumCashFromOrders(allOrdersUpToDate, () => true);
      setIsUpdating(false);
    }

    const currentTotalOutflow = calculateTotalAmount(formData.amount || []); // outflows
    // IMPORTANT: movements are OUTFLOWS, so subtract them
    const closingCash = parseFloat((openingCash + cashFromOrders - currentTotalOutflow).toFixed(2));

    setFormData(prev => ({
      ...prev,
      openingCash,
      cashFromOrders: parseFloat(cashFromOrders.toFixed(2)),
      totalAmount: parseFloat(currentTotalOutflow.toFixed(2)), // store as positive outflow total
      closingCash
    }));

  }, [institution, fetchAllOrdersUpToDate, sumCashFromOrders, formData.amount, calculateTotalAmount, getFilteredOrdersForSelectedDate]);

  // ---------- Fetch day end ----------
  const fetchDayEndData = useCallback(async (targetDate = selectedDate) => {
    if (!institution) return;
    setLoading(true);
    setWarningMsg('');
    try {
      const response = await API.get('main', `/admin/get-day-cafe/${institution}`);
      if (response && response.success && Array.isArray(response.items)) {
        const dateId = getDateId(targetDate);
        const filteredData = response.items.find(item => item.dateId === dateId);

        if (filteredData) {
          setDayEndData({
            ...response,
            data: filteredData,
            items: [filteredData]
          });
          await calculateOpeningCash({ data: filteredData }, targetDate);
        } else {
          setDayEndData({
            ...response,
            data: null,
            items: response.items.filter(item => item.dateId !== dateId)
          });
          await calculateOpeningCash(null, targetDate);
        }
      } else {
        setDayEndData(null);
        await calculateOpeningCash(null, targetDate);
      }
    } catch (err) {
      console.error('Error fetching day end data:', err);
      setDayEndData(null);
      await calculateOpeningCash(null, targetDate);
    } finally {
      setLoading(false);
    }
  }, [institution, selectedDate, calculateOpeningCash, getDateId]);

  // ---------- Fetch orders for date ----------
  const fetchOrdersData = useCallback(async (targetDate = selectedDate) => {
    if (!institution) return;
    setLoading(true);
    try {
      const allOrdersUpToDate = await fetchAllOrdersUpToDate(targetDate);
      const startDate = new Date(targetDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(targetDate);
      endDate.setHours(23, 59, 59, 999);
      const filteredOrders = allOrdersUpToDate.filter(order => {
        const ts = toTimestamp(order.createdAt || order.updatedAt);
        return ts >= startDate.getTime() && ts <= endDate.getTime();
      });

      setOrdersData(filteredOrders);

      // Always calculate cash from ALL eligible orders for the current day
      const cashFromOrdersForDate = sumCashFromOrders(filteredOrders, () => true);
      const currentTotalOutflow = calculateTotalAmount(formData.amount || []);
      const closingCash = parseFloat((formData.openingCash + cashFromOrdersForDate - currentTotalOutflow).toFixed(2));

      setFormData(prev => ({
        ...prev,
        cashFromOrders: parseFloat(cashFromOrdersForDate.toFixed(2)),
        totalAmount: parseFloat(currentTotalOutflow.toFixed(2)),
        closingCash
      }));
    } catch (err) {
      console.error('Error fetching orders for date:', err);
      setOrdersData([]);
    } finally {
      setLoading(false);
    }
  }, [institution, fetchAllOrdersUpToDate, selectedDate, sumCashFromOrders, formData.amount, calculateTotalAmount]);

  // ---------- Handlers ----------
  const handleAmountChange = useCallback((index, field, value) => {
    setFormData(prev => {
      const currentAmounts = Array.isArray(prev.amount) ? [...prev.amount] : [];
      if (currentAmounts[index] === undefined) {
        currentAmounts[index] = { amount: '', to: '', narration: '' };
      }
      currentAmounts[index] = {
        ...currentAmounts[index],
        [field]: field === 'amount' ? (value === '' ? '' : parseFloat(value) || 0) : value
      };
      const totalOutflow = calculateTotalAmount(currentAmounts);
      const closingCash = parseFloat((prev.openingCash + prev.cashFromOrders - totalOutflow).toFixed(2));
      return { ...prev, amount: currentAmounts, totalAmount: parseFloat(totalOutflow.toFixed(2)), closingCash };
    });
  }, [calculateTotalAmount]);

  const addAmountEntry = useCallback(() => {
    setFormData(prev => {
      const newAmounts = [...(prev.amount || []), { amount: '', to: '', narration: '' }];
      const totalOutflow = calculateTotalAmount(newAmounts);
      const closingCash = parseFloat((prev.openingCash + prev.cashFromOrders - totalOutflow).toFixed(2));
      return { ...prev, amount: newAmounts, totalAmount: parseFloat(totalOutflow.toFixed(2)), closingCash };
    });
  }, [calculateTotalAmount]);

  const removeAmountEntry = useCallback((index) => {
    setFormData(prev => {
      const newAmounts = (prev.amount || []).filter((_, i) => i !== index);
      const finalAmounts = newAmounts.length > 0 ? newAmounts : [{ amount: '', to: '', narration: '' }];
      const totalOutflow = calculateTotalAmount(finalAmounts);
      const closingCash = parseFloat((prev.openingCash + prev.cashFromOrders - totalOutflow).toFixed(2));
      return { ...prev, amount: finalAmounts, totalAmount: parseFloat(totalOutflow.toFixed(2)), closingCash };
    });
  }, [calculateTotalAmount]);

  // ---------- Form toggle with validation ----------
  const handleToggleForm = useCallback(() => {
    // Get current filtered orders for this check
    const currentFilteredOrders = getFilteredOrdersForSelectedDate();
    const currentPendingOrders = currentFilteredOrders.filter(order => {
      return typeof order.paymentStatus !== 'undefined' && order.paymentStatus !== true && order.cancel !== true && order.isCancelled !== true;
    });

    if (currentPendingOrders.length > 0) {
      alert(`There are ${currentPendingOrders.length} pending/unpaid orders for ${formatDate(selectedDate)}. Please settle all active/unpaid orders before adding cash movements.`);
      return;
    }

    setShowForm(prev => !prev);
  }, [getFilteredOrdersForSelectedDate, selectedDate, formatDate]);

  // ---------- Validation ----------
  const validateForm = useCallback(() => {
    const hasValidAmounts = (formData.amount || []).some(item => {
      const amount = parseFloat(item.amount) || 0;
      return amount > 0 && item.to && item.to.trim() && item.narration && item.narration.trim();
    });

    return true;
  }, [formData]);

  // ---------- Submit ----------
const submitCashBook = useCallback(async () => {
  if (!validateForm()) {
    console.log('Form validation failed, submission aborted.');
    return;
  }

  setLoading(true);
  console.log('Starting cash book submission for date:', formatDate(selectedDate));

  try {
    const dateId = getDateId(selectedDate);
    console.log('Generated dateId:', dateId);

    // Refresh orders to ensure we have the latest data
    console.log('Refreshing orders data before unpaid order check...');
    await fetchOrdersData(selectedDate);
    const currentFilteredOrders = getFilteredOrdersForSelectedDate();
    console.log('Filtered orders for selected date:', currentFilteredOrders.length, 'orders found');
    console.log(
      'Order IDs in filtered orders:',
      currentFilteredOrders.map(o => ({
        orderId: o.orderId,
        status: o.status,
        paymentStatus: o.paymentStatus,
        cancel: o.cancel,
        isCancelled: o.isCancelled,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt
      }))
    );

    // Determine the closingOrderId
    let closingOrderId = null;
    const isUpdate = dayEndData?.data && dayEndData.data.dateId === dateId;
    console.log('Is updating existing record?', isUpdate);

    if (isUpdate && dayEndData.data.closingOrderId) {
      closingOrderId = dayEndData.data.closingOrderId;
      console.log('Using existing closingOrderId from dayEndData:', closingOrderId);
    } else if (ordersData && ordersData.length > 0) {
      const eligible = ordersData.filter(order => {
        if (!order) return false;
        if (order.cancel === true || order.isCancelled === true) return false;
        if (typeof order.paymentStatus !== 'undefined' && order.paymentStatus !== true) return false;
        if (order.paymentMethod === 'Cash') return true;
        if (Array.isArray(order.paymentMethods)) {
          return order.paymentMethods.some(p => p && p.method === 'Cash' && (parseFloat(p.amount) || 0) > 0);
        }
        return false;
      });
      console.log('Eligible orders for closingOrderId:', eligible.length);

      if (eligible.length > 0) {
        const latestOrder = eligible.reduce((latest, order) => {
          const currentTs = toTimestamp(order.createdAt || order.updatedAt);
          const latestTs = toTimestamp(latest.createdAt || latest.updatedAt);
          return currentTs > latestTs ? order : latest;
        }, eligible[0]);
        closingOrderId = latestOrder.orderId;
        console.log('Selected latest closingOrderId:', closingOrderId);
      } else {
        console.log('No eligible orders found for closingOrderId.');
      }
    } else {
      console.log('No orders available to determine closingOrderId.');
    }

    // Check for unpaid and active orders with orderId > closingOrderId
    console.log('Checking for unpaid/active orders with orderId >', closingOrderId);
    const unpaidActiveOrders = currentFilteredOrders.filter(order => {
      if (!order || !closingOrderId) return false;
      const isOrderIdGreater = String(order.orderId) > String(closingOrderId);
      // Consider order as unpaid if paymentStatus is false/undefined or status is "pending"
      const isUnpaidActive =
        (typeof order.paymentStatus === 'undefined' || order.paymentStatus !== true || order.status === 'pending') &&
        order.cancel !== true &&
        order.isCancelled !== true;
      if (isOrderIdGreater && isUnpaidActive) {
        console.log(
          `Found unpaid/active order: orderId=${order.orderId}, status=${order.status}, paymentStatus=${
            order.paymentStatus
          }, cancel=${order.cancel}, isCancelled=${order.isCancelled}, createdAt=${new Date(
            toTimestamp(order.createdAt || order.updatedAt)
          ).toLocaleString('en-GB')}`
        );
      }
      return isOrderIdGreater && isUnpaidActive;
    });

    if (unpaidActiveOrders.length > 0) {
      const unpaidOrderIds = unpaidActiveOrders.map(order => order.orderId).join(', ');
      console.log('Unpaid/active orders found:', unpaidActiveOrders.length, 'Orders:', unpaidOrderIds);
      alert(
        `There are ${unpaidActiveOrders.length} unpaid and active orders with orderId greater than ${closingOrderId} for ${formatDate(
          selectedDate
        )}: ${unpaidOrderIds}. Please settle these orders before submitting the cash book.`
      );
      setLoading(false);
      return;
    } else {
      console.log('No unpaid/active orders with orderId >', closingOrderId, 'found. Proceeding with submission.');
    }

    // Prepare valid amounts for submission
    const validAmounts = (formData.amount || [])
      .filter(item => {
        const amount = parseFloat(item.amount) || 0;
        const isValid = amount > 0 && item.to && item.to.trim() && item.narration && item.narration.trim();
        console.log(
          `Validating amount entry: amount=${item.amount}, to=${item.to}, narration=${item.narration}, isValid=${isValid}`
        );
        return isValid;
      })
      .map(item => ({
        amount: parseFloat(item.amount),
        to: item.to.trim(),
        narration: item.narration.trim()
      }));
    console.log('Valid amounts prepared for submission:', validAmounts);

    const payload = {
      dateId,
      openingCash: parseFloat(formData.openingCash.toFixed(2)),
      closingCash: parseFloat(formData.closingCash.toFixed(2)),
      totalAmount: parseFloat(formData.totalAmount.toFixed(2)),
      amountDetails: validAmounts,
      closingOrderId
    };
    console.log('Submission payload:', payload);

    const endpoint = isUpdate ? `/admin/update-cash-book/${institution}` : `/admin/cash-book/${institution}`;
    console.log('Submitting to endpoint:', endpoint);

    const response = await API.post('main', endpoint, { body: payload });
    console.log('API response:', response);

    if (response?.success !== false) {
      console.log('Cash book entry submitted successfully:', response?.message || 'Success');
      alert(response?.message || (isUpdate ? 'Cash book entry updated successfully!' : 'Cash book entry saved successfully!'));
      setFormData(prev => ({
        ...prev,
        amount: [{ amount: '', to: '', narration: '' }],
        totalAmount: 0,
        closingCash: parseFloat(prev.openingCash.toFixed(2))
      }));
      setShowForm(false);
      setIsUpdating(false);
      console.log('Resetting form and state after successful submission.');
      await fetchDayEndData(selectedDate);
      await fetchOrdersData(selectedDate);
      console.log('Refreshed day end and orders data.');
    } else {
      console.log('Failed to save cash book entry:', response?.message);
      alert(response?.message || 'Failed to save cash book entry');
    }
  } catch (err) {
    console.error('Error submitting cash book:', err, { stack: err.stack, response: err.response });
    alert(`Error: ${err?.response?.data?.message || err.message || 'Unknown error occurred'}`);
  } finally {
    console.log('Submission process completed, setting loading to false.');
    setLoading(false);
  }
}, [
  formData,
  ordersData,
  institution,
  selectedDate,
  dayEndData,
  fetchDayEndData,
  fetchOrdersData,
  validateForm,
  getDateId,
  getFilteredOrdersForSelectedDate,
  formatDate
]);

  // ---------- Derived ----------
  const filteredOrders = getFilteredOrdersForSelectedDate();

  const cashOrders = filteredOrders.filter(order => {
    if (order.cancel === true || order.isCancelled === true) return false;
    if (typeof order.paymentStatus !== 'undefined' && order.paymentStatus !== true) return false;
    if (order.paymentMethod === 'Cash') return true;
    if (order.paymentMethods) return order.paymentMethods.some(p => p.method === 'Cash' && (parseFloat(p.amount) || 0) > 0);
    return false;
  });

  const pendingOrders = filteredOrders.filter(order => {
    return typeof order.paymentStatus !== 'undefined' && order.paymentStatus !== true && order.cancel !== true && order.isCancelled !== true;
  });

  // ---------- Effects ----------
  useEffect(() => {
    if (institution) {
      fetchDayEndData(selectedDate);
      fetchOrdersData(selectedDate);
    }
  }, [institution, selectedDate]);

  const handleDateChange = useCallback((date) => {
    setSelectedDate(date);
    setDayEndData(null);
    setOrdersData([]);
    setIsUpdating(false);
    setFormData({
      openingCash: 0,
      closingCash: 0,
      totalAmount: 0,
      cashFromOrders: 0,
      amount: [{ amount: '', to: '', narration: '' }]
    });
    setWarningMsg('');
  }, []);

  if (!institution) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading...</h2>
          <p className="text-gray-600">Institution data not available</p>
        </div>
      </div>
    );
  }

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Cash Book Manager</h1>
          <p className="mt-2 text-sm text-gray-500">
            Manage daily cash flow for <span className="font-semibold">{institution}</span>
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white shadow sm:rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Institution:</label>
              <input type="text" value={institution} readOnly className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 w-64" />
            </div>

            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Date:</label>
              <DatePicker selected={selectedDate} onChange={handleDateChange} dateFormat="dd/MM/yyyy" className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholderText="Select date" />
              <button onClick={() => { fetchDayEndData(selectedDate); fetchOrdersData(selectedDate); }} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500">
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Date ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{getDateId(selectedDate)}</span>
            {isUpdating && <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Updating existing record</span>}
          </div>
        </div>

        {/* Warning message */}
        {warningMsg && <div className="mb-4 p-3 rounded bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">{warningMsg}</div>}

        {/* Cash Flow Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Opening Cash</h3>
            <p className="text-2xl font-bold text-green-600">₹{(formData.openingCash || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{isUpdating ? 'From existing record' : 'Sum of all cash up to date'}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cash from Orders</h3>
            <p className="text-2xl font-bold text-blue-600">₹{(formData.cashFromOrders || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{cashOrders.length} orders</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Outflows (Withdrawals)</h3>
            <p className="text-2xl font-bold text-purple-600">₹{(formData.totalAmount || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">{formData.amount?.filter(item => parseFloat(item?.amount) > 0).length || 0} entries</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border-2 border-green-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Closing Cash</h3>
            <p className="text-2xl font-bold text-green-800">₹{(formData.closingCash || 0).toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">Opening + Orders − Outflows</p>
          </div>
        </div>

        {/* Existing Day End Record */}
        {dayEndData?.data && (
          <div className="bg-white shadow sm:rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">Existing Record for {formatDate(selectedDate)}
              {dayEndData.data.updatedCount > 0 && <span className="ml-2 bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">Updated {dayEndData.data.updatedCount} times</span>}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Opening Cash:</span> ₹{(dayEndData.data.openingCash || 0).toFixed(2)}</p>
                  <p><span className="font-medium">Closing Cash:</span> ₹{(dayEndData.data.closingCash || 0).toFixed(2)}</p>
                  <p><span className="font-medium">Total Outflow:</span> ₹{(dayEndData.data.totalAmount || 0).toFixed(2)}</p>
                  <p><span className="font-medium">Closing Order:</span> {dayEndData.data.closingOrderId || 'No orders'}</p>
                  <p><span className="font-medium">Total Entries:</span> {dayEndData.data.amountDetails?.length || 0}</p>
                  <p><span className="font-medium">Date ID:</span> {dayEndData.data.dateId}</p>
                  <p><span className="font-medium">Status:</span> <span className={`px-2 py-1 rounded text-xs ${dayEndData.data.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{dayEndData.data.status}</span></p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3 text-sm">Cash Movements (Outflows):</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {dayEndData.data.amountDetails?.length ? dayEndData.data.amountDetails.map((item, index) => (
                    <div key={`${index}-${item.narration}`} className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs">
                      <div>
                        <div className="font-medium">₹{parseFloat(item.amount).toFixed(2)}</div>
                        <div className="text-gray-600">{item.to}</div>
                      </div>
                      <div className="text-gray-500 text-right"><div>{item.narration}</div></div>
                    </div>
                  )) : <p className="text-gray-500 text-sm">No cash movements</p>}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-600">
                <span className="font-medium">Created:</span> {new Date(dayEndData.data.createdAt).toLocaleString('en-GB')}<br/>
                <span className="font-medium">Updated:</span> {new Date(dayEndData.data.updatedAt).toLocaleString('en-GB')}
              </p>
            </div>
          </div>
        )}

        {/* Pending Orders Warning */}
        {pendingOrders.length > 0 && (
          <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-red-900 mb-4">Pending/Unpaid Orders ({pendingOrders.length})</h2>
            <p className="text-sm text-red-700 mb-4">Please settle these active orders (pay or cancel) before adding movements or submitting the cash book.</p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-red-200">
                <thead className="bg-red-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">Table</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-red-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-red-200">
                  {pendingOrders.slice(0, 10).map((order) => {
                    const orderTime = toTimestamp(order.createdAt || order.updatedAt || 0);
                    const timeString = new Date(orderTime).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

                    return (
                      <tr key={order.orderId} className="hover:bg-red-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-900">{order.orderId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-700">{order.tableName || 'Takeaway'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-900 text-right">₹{(order.totalAmount || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-700">{timeString}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-700">Pending Payment</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {pendingOrders.length > 10 && <div className="px-6 py-3 bg-red-100 text-right text-sm text-red-500">Showing first 10 of {pendingOrders.length} pending orders</div>}
          </div>
        )}

        {/* Cash Orders Table */}
        {cashOrders.length > 0 && (
          <div className="bg-white shadow sm:rounded-lg mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Settled Cash Orders ({cashOrders.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cash</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cashOrders.slice(0, 10).map((order) => {
                    let orderCash = 0;
                    if (order.paymentMethod === 'Cash') orderCash = order.totalAmount || 0;
                    else if (order.paymentMethods) orderCash = order.paymentMethods.reduce((sum, p) => p && p.method === 'Cash' ? sum + (parseFloat(p.amount) || 0) : sum, 0);

                    const orderTime = toTimestamp(order.createdAt || order.updatedAt || 0);
                    const timeString = new Date(orderTime).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

                    return (
                      <tr key={order.orderId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.orderId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.tableName || 'Takeaway'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">₹{parseFloat(orderCash).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">₹{(order.totalAmount || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{timeString}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {cashOrders.length > 10 && <div className="px-6 py-3 bg-gray-50 text-right text-sm text-gray-500">Showing first 10 of {cashOrders.length} orders</div>}
          </div>
        )}

        {/* Cash Entry Form */}
        <div className="bg-white shadow sm:rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Cash Movements (Outflows)</h2>
            <button 
              type="button" 
              onClick={handleToggleForm} 
              disabled={loading || pendingOrders.length > 0}
              className={`px-4 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                showForm 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              } ${loading || pendingOrders.length > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={pendingOrders.length > 0 ? `Cannot add movements: ${pendingOrders.length} pending orders` : undefined}
            >
              {showForm ? 'Cancel' : '+ Add Movement'}
            </button>
          </div>

          {showForm && (
            <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
              {/* Summary Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Opening Cash (₹)</label>
                  <input type="number" value={formData.openingCash} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-lg font-semibold text-green-600" />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cash from Orders (₹)</label>
                  <input type="number" value={formData.cashFromOrders} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-lg font-semibold text-blue-600" />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Outflows (₹)</label>
                  <input type="number" value={formData.totalAmount} readOnly className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-lg font-semibold text-purple-600" />
                </div>
              </div>

              {/* Movement Entries */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Cash Movements <span className="text-gray-500">(Add each transaction)</span>
                </label>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Array.isArray(formData.amount) && formData.amount.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-900">Movement #{index + 1}</h4>
                        {formData.amount.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeAmountEntry(index)}
                            className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                            title="Remove this movement"
                          >
                            Remove ×
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₹) *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.amount || ''}
                            onChange={(e) => handleAmountChange(index, 'amount', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="0.00"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">To * </label>
                          <input
                            type="text"
                            value={item.to || ''}
                            onChange={(e) => handleAmountChange(index, 'to', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Cash Register, Bank, Supplier, etc."
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Narration * </label>
                          <input
                            type="text"
                            value={item.narration || ''}
                            onChange={(e) => handleAmountChange(index, 'narration', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Brief description of transaction"
                            required
                          />
                        </div>
                      </div>
                      
                      {parseFloat(item.amount) > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-600">
                            This entry: ₹{parseFloat(item.amount).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addAmountEntry}
                  className="mt-4 px-4 py-2 border border-dashed border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  + Add Another Movement
                </button>
              </div>

              {/* Closing Cash Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Closing Cash (Auto-calculated)</label>
                  <span className="text-xs text-green-600 font-medium">✓ Verified</span>
                </div>
                <div className="relative mb-2">
                  <input type="number" value={formData.closingCash} readOnly className="w-full px-3 py-3 border-2 border-green-300 rounded-md bg-green-50 text-lg font-bold text-green-800 pr-10" />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
                <p className="text-xs text-gray-600"><strong>Formula:</strong> ₹{formData.openingCash.toFixed(2)} + ₹{formData.cashFromOrders.toFixed(2)} − ₹{formData.totalAmount.toFixed(2)} = <strong>₹{formData.closingCash.toFixed(2)}</strong></p>
              </div>

              <div className="pt-4">
                <button 
                  type="button" 
                  onClick={submitCashBook} 
                  disabled={loading || !validateForm() || pendingOrders.length > 0} 
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  {loading ? 'Submitting...' : (isUpdating ? 'Update Cash Book Entry' : 'Create Cash Book Entry')}
                </button>

                {dayEndData?.data && <p className="text-xs text-gray-500 mt-2 text-center">This will add {formData.amount?.filter(item => { const amount = parseFloat(item?.amount) || 0; return amount > 0 && item?.to && item?.narration; }).length || 0} outflow entries to the existing {dayEndData.data.amountDetails?.length || 0} entries</p>}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashBookManager;