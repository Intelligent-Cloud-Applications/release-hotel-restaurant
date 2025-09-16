import React, { useContext } from "react";
import { Link, NavLink } from "react-router-dom";
import { Context } from "../../Context";

import {
  Navbar,
  NavbarBrand,
  NavbarCollapse,
  NavbarLink,
  NavbarToggle,
} from "flowbite-react";

const NavBar = ({ content }) => {
  const { logoUrl } = useContext(Context).institutionData;

  return (
    <div className="py-2 px-8 fixed top-0 left-0 w-full bg-white z-10">
      <Navbar fluid className="!h-[4.5rem]">
        <NavbarBrand>
          <Link
            to="/"
            className="logo bg-white w-[9rem] h-[3.4rem] rounded-xl flex items-center justify-center max536:w-[5rem]"
          >
            <img
              src={logoUrl}
              className="h-full max-h-[3rem] max-w-full object-contain"
              alt="Happyprancer Logo"
            />
          </Link>
        </NavbarBrand>
        <NavbarToggle />
        <NavbarCollapse>
          {content.map((item) => (
            <NavbarLink
              className={`no-underline font-medium !text-[1rem] text-stone-500 cursor-pointer hover:text-primaryColor`}
              key={item.path}
            >
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  [
                    "font-semibold text-decoration-none",
                    isActive && "text-primaryColor",
                    "hover:text-primaryColor",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            </NavbarLink>
          ))}
        </NavbarCollapse>
      </Navbar>
    </div>
  );
};

export default NavBar;
