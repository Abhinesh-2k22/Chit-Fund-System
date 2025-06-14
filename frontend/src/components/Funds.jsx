import React from 'react';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import Navbar from './Navbar';
import { FaWallet, FaHistory, FaPlus, FaMinus } from 'react-icons/fa';

const GET_USER_BALANCE = gql`
  query GetUserBalance {
    userBalance
  }
`;

const Funds = () => {
  const { loading, error, data, refetch } = useQuery(GET_USER_BALANCE, {
    fetchPolicy: 'network-only'
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <main className="pt-20 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading balance...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <main className="pt-20 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <p className="text-red-600">Error loading balance: {error.message}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const balance = data?.userBalance || 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <main className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Balance Card */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Current Balance</h2>
                <p className="text-4xl font-bold text-indigo-600 mt-2">
                  ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-indigo-100 p-4 rounded-full">
                <FaWallet className="h-8 w-8 text-indigo-600" />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mb-8">
            <button className="w-full bg-green-600 text-white rounded-lg p-4 flex items-center justify-center hover:bg-green-700 transition-colors">
              <FaPlus className="mr-2" />
              Add Funds
            </button>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Transaction History</h2>
              <FaHistory className="text-gray-400" />
            </div>
            <div className="text-center py-8 text-gray-500">
              No transactions yet
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Funds; 