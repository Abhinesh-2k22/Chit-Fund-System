import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { FaUser, FaEnvelope, FaPhone, FaBirthdayCake, FaVenusMars, FaClock } from 'react-icons/fa';
import { useQuery, gql } from '@apollo/client';

const GET_USER_DATA = gql`
  query GetUserData {
    me {
      id
      username
      email
      mobile
      age
      gender
      lastLogin
    }
  }
`;

const ProfilePage = () => {
  const { user: authUser, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery(GET_USER_DATA, {
    fetchPolicy: 'network-only',
    onError: async (error) => {
      console.error('Error fetching user data:', error);
      if (error.message.includes('Not authenticated')) {
        await logout();
        navigate('/login');
      }
    }
  });

  const user = data?.me || authUser;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleRefresh = async () => {
    try {
      await refetch();
      await refreshUser();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Not available';
    
    try {
      // Handle both Unix timestamp and ISO string
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="pt-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="pt-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-8 text-red-600">
              <p>Error loading profile: {error.message}</p>
              <div className="mt-4 space-x-4">
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Retry
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Return to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="pt-20 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-8">
              <p className="text-gray-600">No user data available</p>
              <div className="mt-4 space-x-4">
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Retry
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Return to Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <main className="pt-20 pb-8">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Profile Header */}
            <div className="bg-white rounded-t-lg shadow-xl p-8 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="bg-indigo-100 p-4 rounded-full">
                    <FaUser className="text-4xl text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">{user.username}</h2>
                    <p className="text-gray-600">Last login: {formatDate(user.lastLogin)}</p>
                  </div>
                </div>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 text-sm bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200"
                >
                  Refresh Data
                </button>
              </div>
            </div>

            {/* Profile Details */}
            <div className="bg-white rounded-b-lg shadow-xl p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Personal Information */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Personal Information</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <FaEnvelope className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Email Address</p>
                        <p className="text-gray-900">{user.email}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <FaPhone className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Mobile Number</p>
                        <p className="text-gray-900">{user.mobile}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <FaBirthdayCake className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Age</p>
                        <p className="text-gray-900">{user.age || 'Not specified'}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <FaVenusMars className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Gender</p>
                        <p className="text-gray-900 capitalize">{user.gender || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Information */}
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-gray-900 border-b pb-2">Account Information</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <FaUser className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Username</p>
                        <p className="text-gray-900">{user.username}</p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <FaClock className="text-gray-400 mt-1" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Last Login</p>
                        <p className="text-gray-900">{formatDate(user.lastLogin)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleLogout}
                  className="w-full md:w-auto inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage; 