// import Header from "../components/Header";
// import Footer from "../components/Footer";

const Error = () => {
  return (
    <>
      {/*<Header />*/}
      <div className="h-[80vh] w-full flex justify-center items-center flex-col gap-2">
        <h1 className="text-[6rem] font-semibold max600:text-[2.8rem]">404 Page Not Found</h1>
        <p className={`text-[1.2rem] `}>
          Oops! The page you are looking for does not exist.
        </p>
        <p className={``}>Please check the URL or go back to the homepage.</p>
      </div>
      {/*<Footer />*/}
    </>
  );
};

export default Error;
