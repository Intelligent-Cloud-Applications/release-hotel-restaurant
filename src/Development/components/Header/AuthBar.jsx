import { NavLink } from 'react-router-dom';

const AuthBar = ({ content }) => {
  const height = 'h-8';
    
  return (
    <div className={height}>
      <div
        className={
          `flex flex-row gap-4 items-center justify-end
          fixed z-50 w-full pr-12 ${height}
          bg-primaryColor`
        }
      >
        { content.map((item, index) =>
          <NavLink
            key={index}
            to={item.path}
            className={({isActive}) =>
              [
                isActive ? 'text-white' : 'text-stone-300',
                'text-md font-bold text-decoration-none hover:text-stone-100',
              ].join(' ')
            }
          >
            { item.label }
          </NavLink>
        )}
      </div>
    </div>
  )
}

export default AuthBar;