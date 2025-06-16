import { useQuery, gql } from '@apollo/client';
import Navbar from './Navbar';
import { FaUsers, FaRupeeSign, FaCalendarAlt, FaUser, FaTrophy, FaMoneyBillWave, FaPlus } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const GET_MY_GROUPS = gql`
  query GetMyGroups($username: String!) {
    myGroups(username: $username) {
      id
      name
      totalPoolAmount
      totalMonths
      status
      shuffleDate
      createdAt
      currentmonth
      owner {
        id
        username
        email
        mobile
      }
      role
      joinedAt
      wonMonth
      wonAmount
      wonAt
      nextPayment
      totalPaid
      remainingPayments
    }
  }
`;

const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { loading, error, data, refetch } = useQuery(GET_MY_GROUPS, {
    variables: { username: user?.username },
    skip: !user?.username,
    fetchPolicy: 'network-only',
  });

  // Refetch groups when user changes
  useEffect(() => {
    if (user?.username) {
      refetch();
    }
  }, [user?.username, refetch]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="pt-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-8">
              <p className="text-gray-600">Please log in to view your groups</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your groups...</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (error) {
    console.error('Error loading groups:', error);
    return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="pt-20 px-4">
        <div className="max-w-7xl mx-auto">
            <div className="text-center py-8">
              <p className="text-red-600">Error loading groups. Please try refreshing the page.</p>
              <button 
                onClick={() => refetch()} 
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Retry
              </button>
          </div>
        </div>
      </div>
    </div>
  );
  }

  const groups = data?.myGroups || [];

  const formatDate = (dateString) => {
    if (!dateString) return 'Not started';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'started':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <main className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header with Create Button */}
          <div className="mb-8 flex justify-between items-center">
            <div>
            <h1 className="text-3xl font-bold text-gray-900">My Chit Funds</h1>
            <p className="mt-2 text-gray-600">View and manage your chit fund groups</p>
            </div>
            <button
              onClick={() => navigate('/create-group')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <FaPlus className="mr-2" />
              Create New Group
            </button>
          </div>

          {/* Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div key={group.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Group Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{group.name}</h3>
                      <p className="text-sm text-gray-500">Owner: {group.owner.username}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(group.status)}`}>
                      {group.status}
                    </span>
                  </div>
                </div>

                {/* Group Details */}
                <div className="p-6 space-y-4">
                  {/* Pool Amount */}
                  <div className="flex items-center text-gray-700">
                    <FaRupeeSign className="mr-2" />
                    <span>Pool Amount: {formatCurrency(group.totalPoolAmount)}</span>
                  </div>

                  {/* Duration */}
                  <div className="flex items-center text-gray-700">
                    <FaCalendarAlt className="mr-2" />
                    <span>Duration: {group.totalMonths} months</span>
                  </div>

                  {/* Your Role */}
                  <div className="flex items-center text-gray-700">
                    <FaUser className="mr-2" />
                    <span>Your Role: {group.role}</span>
                  </div>

                  {/* Winning Status */}
                  {group.wonMonth && (
                    <div className="flex items-center text-green-600">
                      <FaTrophy className="mr-2" />
                      <span>Won in Month {group.wonMonth} ({formatCurrency(group.wonAmount)})</span>
                    </div>
                  )}

                  {/* Payment Status */}
                  <div className="flex items-center text-gray-700">
                    <FaMoneyBillWave className="mr-2" />
                    <span>Next Payment: {formatCurrency(group.nextPayment)}</span>
                  </div>

                  {/* Progress */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{group.currentmonth}/{group.totalMonths} months</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full" 
                        style={{ width: `${(group.currentmonth / group.totalMonths) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="space-y-1 text-sm text-gray-500">
                    <p>Created: {formatDate(group.createdAt)}</p>
                    <p>Joined: {formatDate(group.joinedAt)}</p>
                    {group.shuffleDate && <p>Started: {formatDate(group.shuffleDate)}</p>}
                    {group.wonAt && <p>Won: {formatDate(group.wonAt)}</p>}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <button 
                    onClick={() => navigate(`/group/${group.id}/${encodeURIComponent(group.name)}`)}
                    className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {groups.length === 0 && (
            <div className="text-center py-12">
              <FaUsers className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No groups found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new chit fund group.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HomePage; 