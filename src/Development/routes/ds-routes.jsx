import {Routes, Route} from 'react-router-dom';
import Error from '../pages/Error';
// import Auth from "../pages/Auth";
import Logout from "../pages/Auth/Logout";
import Home from '../pages/public/Home';
import Product from "../pages/public/Product";
import Dashboard from "../pages/private/Dashboard";
import Orders from "../pages/private/Dashboard/Orders";
// import AddStaff from '../pages/private/Dashboard/AddStaff/CreatePopup';
import Item from '../pages/private/Dashboard/Item';
import Stafflist from '../pages/private/Dashboard/AddStaff';
import Profile from "../pages/private/Dashboard/Profile/Profile.jsx"
import QRManage from '../pages/private/Dashboard/QRManage/QRManage.jsx';
import PendingOrders from '../pages/private/Dashboard/PendingOrders';
import Login from "../pages/Auth/Login";
import Redirect from "../pages/Auth/Login/Redirect";
import Signup from "../pages/Auth/Signup";
import ForgotPassword from "../pages/Auth/ForgotPassword";
import RevenueDashboard from '../pages/private/Dashboard/Revenue'
import CounterOrder from '../pages/private/Dashboard/CounterOrder'
import OrderHistory from '../pages/private/Dashboard/OrderHistory'
import MenuTextExtractor from '../pages/private/Dashboard/Item/MenuTextExtractor.jsx';
import Receipt  from '../pages/public/Receiept';
import StockManagement from '../pages/private/Dashboard/StockManagement/index.jsx';
import Report from '../pages/private/Dashboard/Report/index.jsx';
import RoomDetails from '../pages/private/Dashboard/RoomDetails/index.jsx';
import EndDay from '../pages/private/Dashboard/EndDay/index.jsx';
const RoutesContainer = () => {
  return (
    <Routes>
      <Route path='/' element={ <Home /> } />
      {/*<Route path='/auth' element={ <Auth /> } />*/}
      <Route path='/dashboard' element={ <Dashboard /> }>
        <Route path='orders' element={ <Orders /> } />
        <Route path='revenue' element={ <RevenueDashboard /> } />
        <Route path='counterorder' element={ <CounterOrder /> } />
        <Route path='orderhistory' element={ <OrderHistory /> } />
        <Route path='' element={ <Orders /> } />
        <Route path='addstaff' element={ <Stafflist /> } />
        <Route path='stockmanagement' element={ <StockManagement /> } />
        <Route path='item' element={ <Item /> } />
        <Route path='profile' element={ <Profile /> } />
        <Route path='qrmanage' element={ <QRManage /> } />
        <Route path='room-details' element={ <RoomDetails /> } />
        <Route path='pendingorders' element={ <PendingOrders /> } />
        <Route path='menu' element={ <MenuTextExtractor /> } />
        <Route path='report' element={ <Report /> } />
        <Route path='day-end' element={<EndDay />} />
      </Route>
      <Route path='/redirect' element={ <Redirect /> } />
      <Route path='/receipt' element={ <Receipt /> } />
      <Route path='/login' element={ <Login /> } />
      <Route path='/signup' element={ <Signup /> } />
      <Route path='/logout' element={ <Logout /> } />
      <Route path='/forgot-password' element={ <ForgotPassword /> } />
      <Route path='/product' element={ <Product /> } />
      <Route path='*' element={ <Error /> } />
    </Routes>
  )
}

export default RoutesContainer;