import {Avatar, Navbar} from "flowbite-react";
import {useContext} from "react";
import {Context} from "../../Context";
import {NavLink} from "react-router-dom";
import InstitutionData from "../../../Operation/institutionData.json";

const Header = ({...props}) => {
  const { userData, institutionData } = useContext(Context);
  const { userName, imgUrl } = userData;
  const { logoUrl } = institutionData;
    const finalLogoUrl =
    institutionData?.logoUrl || InstitutionData.logoUrl || "";


  const getInitials = (userName) => {
    if (!userName) return '';
    const initials = userName
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
    return initials;
  };

  const getColor = (userName) => {
    if (!userName) return '#888888';
    const colors = [
      '#FF5733', '#33FF57', '#5733FF',
      '#FF5733', '#33FF57', '#5733FF',
      '#FF5733', '#33FF57', '#5733FF',
      '#FF5733', '#33FF57', '#5733FF'
    ];
    const index = userName.length % colors.length;
    return colors[index];
  };

  const content = [
  { label: 'HOME', path: '/' },
  { label: 'PRODUCT', path: '/product' },
  {
    label: userName ? (
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
        style={{ backgroundColor: getColor(userName) }}
        aria-label={userName || "User"}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={`${userName}'s profile`}
            className="w-full h-full rounded-full"
          />
        ) : (
          getInitials(userName)
        )}
      </div>
    ) : 'LOGIN',
    path:  userName
    ? (userData.userType === 'admin' ? '/dashboard/counterorder' : '/dashboard/orders')
    : '/login',
  }

];

  return (
    <Navbar border style={{
      zIndex: 50,
      position: 'sticky',
      top: 0,
      padding: '1rem',
      width: '100%',
    }} {...props}>
      <Navbar.Brand href="/"  className="logo bg-white w-[2rem] h-[2.4rem] rounded-xl py-[1.5px] flex items-center justify-center ">
        <img src={finalLogoUrl} alt="Cafe Logo" />
      </Navbar.Brand>
      <Navbar.Toggle />
      <Navbar.Collapse className='font-roboto'>
        {content.map((item, index) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              'flex items-center text-lg ' +
              (isActive ? 'text-primaryColor'
                : 'text-stone-400 hover:text-primaryColor')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </Navbar.Collapse>
    </Navbar>
  )
}

export default Header;

