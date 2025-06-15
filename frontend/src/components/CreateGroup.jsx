import { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { FaRupeeSign, FaCalendarAlt } from 'react-icons/fa';

const CREATE_GROUP = gql`
  mutation CreateGroup($name: String!, $totalPoolAmount: Float!, $totalMonths: Int!) {
    createGroup(name: $name, totalPoolAmount: $totalPoolAmount, totalMonths: $totalMonths) {
      id
      name
      totalPoolAmount
      totalMonths
      status
      createdAt
      owner {
        id
        username
        email
        mobile
      }
    }
  }
`;

const CreateGroup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    totalPoolAmount: '',
    totalMonths: ''
  });
  const [error, setError] = useState('');

  const [createGroup, { loading }] = useMutation(CREATE_GROUP, {
    onCompleted: (data) => {
      navigate('/home');
    },
    onError: (error) => {
      setError(error.message);
    }
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await createGroup({
        variables: {
          name: formData.name,
          totalPoolAmount: parseFloat(formData.totalPoolAmount),
          totalMonths: parseInt(formData.totalMonths)
        }
      });
    } catch (err) {
      // Error is handled in onError callback
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <main className="pt-20 pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Create New Chit Fund Group</h1>
            <p className="mt-2 text-gray-600">Set up a new chit fund group with your desired parameters</p>
          </div>

          {/* Form */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Group Name */}
              <div>
                <label htmlFor="name" className="block text-base font-medium text-gray-700 mb-2">
                  Group Name
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 text-base border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter group name"
                  />
                </div>
              </div>

              {/* Total Pool Amount */}
              <div>
                <label htmlFor="totalPoolAmount" className="block text-base font-medium text-gray-700 mb-2">
                  Total Pool Amount
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FaRupeeSign className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    name="totalPoolAmount"
                    id="totalPoolAmount"
                    required
                    min="1000"
                    value={formData.totalPoolAmount}
                    onChange={handleChange}
                    className="block w-full pl-12 pr-4 py-3 text-base border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter total pool amount"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">Minimum amount: ₹1,000</p>
              </div>

              {/* Duration */}
              <div>
                <label htmlFor="totalMonths" className="block text-base font-medium text-gray-700 mb-2">
                  Duration (Months)
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FaCalendarAlt className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    name="totalMonths"
                    id="totalMonths"
                    required
                    min="1"
                    max="12"
                    value={formData.totalMonths}
                    onChange={handleChange}
                    className="block w-full pl-12 pr-4 py-3 text-base border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter duration in months"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">Duration must be between 1 and 12 months</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-lg bg-red-50 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Error
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>{error}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/home')}
                  className="px-6 py-3 text-base font-medium rounded-lg border border-gray-300 shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 text-base font-medium rounded-lg border border-transparent shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateGroup; 