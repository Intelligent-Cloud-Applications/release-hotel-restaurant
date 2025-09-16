import Header from "../../../components/Header";
import Hero from "./Hero";
import Categories from "./Categories";
import VisitUs from "./VisitUs";
import Feedback from "./Feedback";
import Footer from "./Footer";
import OurMission from "./OurMission";
import { Context } from "../../../Context";
import React,{useContext} from "react";
function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <Categories />
      <Feedback />
      <OurMission />
      <VisitUs />
      <Footer />
    </main>
  );
}

export default Home;