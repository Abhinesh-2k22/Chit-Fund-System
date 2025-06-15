import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import Navbar from './Navbar';
import { FaWallet, FaHistory, FaPlus, FaMinus } from 'react-icons/fa';

const GET_USER_BALANCE = gql`
  query GetUserBalance {
    userBalance
  }
`;

const GET_ME = gql`
  query GetMe {
    me {
      username
    }
  }
`;

const GET_TRANSACTIONS = gql`
  query GetTransactions {
    getTransactions {
      id
      fromField
      toField
      amount
      description
      timeStamp
    }
  }
`;

const ADD_FUND = gql`
  mutation AddFund($amount: Int!) {
    addFund(amount: $amount) {
      success
      newBalance
    }
  }
`;

const Funds = () => {
  const [isAddFundOpen, setIsAddFundOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  // Fetch user data
  const { data: userData } = useQuery(GET_ME);

  // Fetch user balance
  const { loading: balanceLoading, data: balanceData, refetch: refetchBalance } = useQuery(GET_USER_BALANCE, {
    fetchPolicy: 'network-only'
  });

  // Fetch transactions
  const { loading: transactionsLoading, data: transactionsData, refetch: refetchTransactions } = useQuery(GET_TRANSACTIONS, {
    fetchPolicy: 'network-only'
  });

  // Add fund mutation
  const [addFund, { loading: addFundLoading }] = useMutation(ADD_FUND, {
    onCompleted: (data) => {
      if (data.addFund.success) {
        refetchBalance();
        refetchTransactions();
        setIsAddFundOpen(false);
        setAmount('');
        setError('');
      }
    },
    onError: (error) => {
      setError(error.message);
    }
  });

  const handleAddFund = async (e) => {
    e.preventDefault();
    setError('');

    if (!amount || isNaN(amount) || parseInt(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      await addFund({
        variables: { amount: parseInt(amount) }
      });
    } catch (error) {
      console.error('Error adding funds:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (balanceLoading) {
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

  const balance = balanceData?.userBalance || 0;

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <main className="pt-20 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Funds</h2>
              <button
                onClick={() => setIsAddFundOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center gap-2"
              >
                <FaPlus />
                Add Fund
              </button>
            </div>

            {/* Balance Display */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Current Balance</h3>
              {balanceLoading ? (
                <div className="animate-pulse h-8 bg-gray-200 rounded w-32"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-900">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              )}
            </div>

            {/* Transaction History */}
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FaHistory />
                Transaction History
              </h3>
              
              {transactionsLoading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : transactionsData?.getTransactions?.length > 0 ? (
                <div className="space-y-4">
                  {transactionsData.getTransactions.map((transaction) => {
                    const isOutgoing = transaction.fromField === userData?.me.username;
                    const amount = isOutgoing ? -transaction.amount : transaction.amount;
                    
                    return (
                      <div key={transaction.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start">
              <div>
                            <p className="text-sm font-semibold text-gray-600">{transaction.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(transaction.timeStamp)}
                </p>
              </div>
                          <div className={`text-right ${isOutgoing ? 'text-red-600' : 'text-green-600'}`}>
                            <p className="font-semibold">
                              {isOutgoing ? '-' : '+'}₹{Math.abs(amount)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {isOutgoing ? `To: ${transaction.toField}` : `From: ${transaction.fromField}`}
                            </p>
              </div>
            </div>
          </div>
                    );
                  })}
          </div>
              ) : (
            <div className="text-center py-8 text-gray-500">
              No transactions yet
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add Fund Modal */}
      {isAddFundOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Funds</h3>
            
            <form onSubmit={handleAddFund}>
              <div className="mb-4">
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter amount"
                  min="1"
                  required
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddFundOpen(false);
                    setAmount('');
                    setError('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFundLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  {addFundLoading ? 'Adding...' : 'Add Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Funds; 