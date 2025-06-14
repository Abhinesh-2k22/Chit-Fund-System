import { FaHome, FaUserFriends, FaBell, FaMoneyBillWave, FaUser } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          <Link to="/home" className="flex flex-col items-center text-gray-600 hover:text-blue-600 transition-colors">
            <FaHome className="text-xl" />
            <span className="text-xs mt-1">Home</span>
          </Link>
          
          <Link to="/friends" className="flex flex-col items-center text-gray-600 hover:text-blue-600 transition-colors">
            <FaUserFriends className="text-xl" />
            <span className="text-xs mt-1">Friends</span>
          </Link>
          
          <Link to="/alerts" className="flex flex-col items-center text-gray-600 hover:text-blue-600 transition-colors">
            <FaBell className="text-xl" />
            <span className="text-xs mt-1">Alerts</span>
          </Link>
          
          <Link to="/funds" className="flex flex-col items-center text-gray-600 hover:text-blue-600 transition-colors">
            <FaMoneyBillWave className="text-xl" />
            <span className="text-xs mt-1">Funds</span>
          </Link>
          
          <Link to="/profile" className="flex flex-col items-center text-gray-600 hover:text-blue-600 transition-colors">
            <FaUser className="text-xl" />
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 