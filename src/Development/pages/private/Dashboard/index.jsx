import Header from "../../../components/Header";
import { Outlet } from "react-router-dom";
import SideBar from "./SideBar";
import React,{useContext} from "react";
import { Context } from "../../../Context";
import institutionData from "../../../constants";
const Dashboard = () => {
  const{userData}=useContext(Context);
  return (
    <>
    {userData?.userType !== "admin" && <Header />}
      <main className='grid grid-cols-[auto_1fr] min-h-[93vh]'>
        <SideBar/>
        <Outlet/>
      </main>
    </>

  )
}

export default Dashboard;